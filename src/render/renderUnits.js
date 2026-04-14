// src/render/renderUnits.js

import { svgEl, makePolygon, makeText } from "../utils.js";
import { TOPDOWN_CONFIG } from "./projection.js";
import { getUnitFootprint } from "../scale/scaleMath.js";
import { RENDER_CONFIG } from "../config.js";

export function drawMech(state, unit, renderModel, parent, isActive = false) {
  const footprint = getUnitFootprint(unit);
  const group = svgEl("g");

  if (state.ui.viewMode === "top") {
    drawTopUnit(state, unit, renderModel, group, isActive);
    parent.appendChild(group);
    return;
  }

  drawIsoStackedUnit(state, unit, renderModel, group, footprint, isActive);
  parent.appendChild(group);
}

export function getUnitVisualLevels(unit) {
  if (unit?.unitType === "pilot") {
    return 3;
  }

  return 8;
}

export function getUnitCubeHeightPx(unit) {
  return getUnitVisualLevels(unit) * RENDER_CONFIG.isoTileHeight;
}

function drawTopUnit(state, unit, renderModel, group, isActive) {
  const { topLeftX, topLeftY, widthPx, heightPx } = renderModel.top;

  const body = svgEl("rect");
  body.setAttribute("x", topLeftX);
  body.setAttribute("y", topLeftY);
  body.setAttribute("width", widthPx);
  body.setAttribute("height", heightPx);
  body.setAttribute("rx", unit.unitType === "pilot" ? "6" : "10");
  body.setAttribute("class", getTopBodyClass(isActive));

  const facingLine = svgEl("line");
  const linePoints = getTopFacingLinePoints(state, unit, topLeftX, topLeftY, widthPx, heightPx);
  facingLine.setAttribute("x1", linePoints.x1);
  facingLine.setAttribute("y1", linePoints.y1);
  facingLine.setAttribute("x2", linePoints.x2);
  facingLine.setAttribute("y2", linePoints.y2);
  facingLine.setAttribute("class", getFacingLineClass(state, unit));

  const label = makeText(
    topLeftX + (widthPx / 2),
    topLeftY + heightPx + 16,
    unit.name,
    "mech-label"
  );

  group.appendChild(body);
  group.appendChild(facingLine);
  group.appendChild(label);
}

function drawIsoStackedUnit(state, unit, renderModel, group, footprint, isActive) {
  const levels = getUnitVisualLevels(unit);
  const cubeHeight = RENDER_CONFIG.isoTileHeight;

  // Stable old-school cube recipe, scaled by footprint.
  const halfW = footprint.width * (RENDER_CONFIG.isoTileWidth / 2);
  const halfH = footprint.height * (RENDER_CONFIG.isoTileHeight / 2);

  // This is the screen-space center of the footprint on the ground.
  const anchorX = renderModel.iso.center.x;
  const anchorY = renderModel.iso.center.y;

  let topMostDiamond = null;

  for (let level = 0; level < levels; level += 1) {
    const levelOffset = level * cubeHeight;

    const diamond = {
      top:    { x: anchorX,         y: anchorY - cubeHeight - halfH - levelOffset },
      right:  { x: anchorX + halfW, y: anchorY - cubeHeight - levelOffset },
      bottom: { x: anchorX,         y: anchorY - cubeHeight + halfH - levelOffset },
      left:   { x: anchorX - halfW, y: anchorY - cubeHeight - levelOffset }
    };

    diamond.center = {
      x: anchorX,
      y: anchorY - cubeHeight - levelOffset
    };

    diamond.points = [
      diamond.top,
      diamond.right,
      diamond.bottom,
      diamond.left
    ];

    const leftFace = [
      diamond.left,
      diamond.bottom,
      { x: diamond.bottom.x, y: diamond.bottom.y + cubeHeight },
      { x: diamond.left.x, y: diamond.left.y + cubeHeight }
    ];

    const rightFace = [
      diamond.right,
      diamond.bottom,
      { x: diamond.bottom.x, y: diamond.bottom.y + cubeHeight },
      { x: diamond.right.x, y: diamond.right.y + cubeHeight }
    ];

    const leftPoly = makePolygon(leftFace, "mech-cube-left", "currentColor");
    leftPoly.removeAttribute("fill");

    const rightPoly = makePolygon(rightFace, "mech-cube-right", "currentColor");
    rightPoly.removeAttribute("fill");

    const topPoly = makePolygon(
      diamond.points,
      getIsoTopClass(state, unit, isActive),
      "currentColor"
    );
    topPoly.removeAttribute("fill");

    group.appendChild(leftPoly);
    group.appendChild(rightPoly);
    group.appendChild(topPoly);

    topMostDiamond = diamond;
  }

  if (topMostDiamond) {
    const facingLine = svgEl("line");
    const facing = getIsoFacingLinePoints(state, unit, topMostDiamond);
    facingLine.setAttribute("x1", facing.x1);
    facingLine.setAttribute("y1", facing.y1);
    facingLine.setAttribute("x2", facing.x2);
    facingLine.setAttribute("y2", facing.y2);
    facingLine.setAttribute("class", getFacingLineClass(state, unit));

    const label = makeText(
      topMostDiamond.center.x,
      topMostDiamond.center.y + 6,
      unit.name,
      "mech-label"
    );

    group.appendChild(facingLine);
    group.appendChild(label);
  }
}

export function getWorldFacing(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? state.ui.facingPreview : unit.facing;
}

function getTopBodyClass(isActive) {
  return isActive ? "mech-top-body mech-top-body-active" : "mech-top-body";
}

export function getIsoTopClass(state, unit, isActive) {
  const classes = ["mech-cube-top"];

  if (isActive) {
    classes.push("mech-cube-top-active");
  }

  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  if (
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null
  ) {
    classes.push("mech-cube-top-preview");
  }

  return classes.join(" ");
}

function getFacingLineClass(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-top-facing-preview" : "mech-top-facing";
}

function getTopFacingLinePoints(state, unit, x, y, width, height) {
  const facing = normalizeFacing(getWorldFacing(state, unit));
  const cx = x + (width / 2);
  const cy = y + (height / 2);
  const reachX = width * 0.24;
  const reachY = height * 0.24;

  switch (facing) {
    case 0:
      return { x1: cx, y1: cy, x2: cx + reachX, y2: cy - reachY };
    case 1:
      return { x1: cx, y1: cy, x2: cx + reachX, y2: cy + reachY };
    case 2:
      return { x1: cx, y1: cy, x2: cx - reachX, y2: cy + reachY };
    case 3:
    default:
      return { x1: cx, y1: cy, x2: cx - reachX, y2: cy - reachY };
  }
}

function getIsoFacingLinePoints(state, unit, topDiamond) {
  const facing = normalizeFacing(getWorldFacing(state, unit));
  const center = topDiamond.center;

  const northEast = midpoint(topDiamond.top, topDiamond.right);
  const southEast = midpoint(topDiamond.right, topDiamond.bottom);
  const southWest = midpoint(topDiamond.bottom, topDiamond.left);
  const northWest = midpoint(topDiamond.left, topDiamond.top);

  const t = 0.72;

  switch (facing) {
    case 0: {
      const end = lerpPoint(center, northEast, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 1: {
      const end = lerpPoint(center, southEast, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 2: {
      const end = lerpPoint(center, southWest, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 3:
    default: {
      const end = lerpPoint(center, northWest, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
  }
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + ((b.x - a.x) * t),
    y: a.y + ((b.y - a.y) * t)
  };
}

function normalizeFacing(value) {
  const n = Number.isFinite(value) ? value : 0;
  return ((n % 4) + 4) % 4;
}
