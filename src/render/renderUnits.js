// src/render/renderUnits.js

import { svgEl, makePolygon, makeText } from "../utils.js";
import { getUnitFootprint } from "../scale/scaleMath.js";
import { RENDER_CONFIG } from "../config.js";
import { getTopdownCellSize } from "./projection.js";

export function drawMech(state, unit, renderModel, parent, isActive = false) {
  const footprint = getUnitFootprint(unit);
  const group = svgEl("g");

  if (state.ui.viewMode === "top") {
    drawTopUnit(state, unit, renderModel, group, footprint, isActive);
    parent.appendChild(group);
    return;
  }

  drawIsoPrismUnit(state, unit, renderModel, group, footprint, isActive);
  parent.appendChild(group);
}

export function getUnitVisualLevels(unit) {
  if (unit?.unitType === "pilot") {
    return 4;
  }

  return 8;
}

export function getUnitCubeHeightPx(unit) {
  return getUnitVisualLevels(unit) * RENDER_CONFIG.isoTileHeight;
}

function drawTopUnit(state, unit, renderModel, group, footprint, isActive) {
  const cellSize = getTopdownCellSize(state);
  const halfW = footprint.width * (cellSize / 2);
  const halfH = footprint.height * (cellSize / 4);

  const anchorX = renderModel.top.center.x;
  const anchorY = renderModel.top.center.y;

  const topDiamond = {
    top:    { x: anchorX,         y: anchorY - halfH },
    right:  { x: anchorX + halfW, y: anchorY },
    bottom: { x: anchorX,         y: anchorY + halfH },
    left:   { x: anchorX - halfW, y: anchorY },
    center: { x: anchorX,         y: anchorY }
  };

  const body = makePolygon(
    [topDiamond.top, topDiamond.right, topDiamond.bottom, topDiamond.left],
    getTopBodyClass(isActive),
    "currentColor"
  );
  body.removeAttribute("fill");

  const facingLine = svgEl("line");
  const linePoints = getDiamondFacingLinePoints(state, unit, topDiamond);
  facingLine.setAttribute("x1", linePoints.x1);
  facingLine.setAttribute("y1", linePoints.y1);
  facingLine.setAttribute("x2", linePoints.x2);
  facingLine.setAttribute("y2", linePoints.y2);
  facingLine.setAttribute("class", getFacingLineClass(state, unit));

  const label = makeText(
    topDiamond.center.x,
    topDiamond.center.y + 4,
    unit.name,
    "mech-label"
  );

  group.appendChild(body);
  group.appendChild(facingLine);
  group.appendChild(label);
}

function drawIsoPrismUnit(state, unit, renderModel, group, footprint, isActive) {
  const prismHeight = getUnitCubeHeightPx(unit);

  const halfW = footprint.width * (RENDER_CONFIG.isoTileWidth / 2);
  const halfH = footprint.height * (RENDER_CONFIG.isoTileHeight / 2);

  const anchorX = renderModel.iso.center.x;
  const anchorY = renderModel.iso.center.y;

  const baseDiamond = {
    top:    { x: anchorX,         y: anchorY - halfH },
    right:  { x: anchorX + halfW, y: anchorY },
    bottom: { x: anchorX,         y: anchorY + halfH },
    left:   { x: anchorX - halfW, y: anchorY },
    center: { x: anchorX,         y: anchorY }
  };

  const topDiamond = {
    top:    { x: baseDiamond.top.x,    y: baseDiamond.top.y - prismHeight },
    right:  { x: baseDiamond.right.x,  y: baseDiamond.right.y - prismHeight },
    bottom: { x: baseDiamond.bottom.x, y: baseDiamond.bottom.y - prismHeight },
    left:   { x: baseDiamond.left.x,   y: baseDiamond.left.y - prismHeight },
    center: { x: baseDiamond.center.x, y: baseDiamond.center.y - prismHeight }
  };

  const leftFace = [
    topDiamond.left,
    topDiamond.bottom,
    baseDiamond.bottom,
    baseDiamond.left
  ];

  const rightFace = [
    topDiamond.right,
    topDiamond.bottom,
    baseDiamond.bottom,
    baseDiamond.right
  ];

  const leftPoly = makePolygon(leftFace, "mech-cube-left", "currentColor");
  leftPoly.removeAttribute("fill");

  const rightPoly = makePolygon(rightFace, "mech-cube-right", "currentColor");
  rightPoly.removeAttribute("fill");

  const topPoly = makePolygon(
    [topDiamond.top, topDiamond.right, topDiamond.bottom, topDiamond.left],
    getIsoTopClass(state, unit, isActive),
    "currentColor"
  );
  topPoly.removeAttribute("fill");

  const facingLine = svgEl("line");
  const facing = getDiamondFacingLinePoints(state, unit, topDiamond);
  facingLine.setAttribute("x1", facing.x1);
  facingLine.setAttribute("y1", facing.y1);
  facingLine.setAttribute("x2", facing.x2);
  facingLine.setAttribute("y2", facing.y2);
  facingLine.setAttribute("class", getFacingLineClass(state, unit));

  const label = makeText(
    topDiamond.center.x,
    topDiamond.center.y + 6,
    unit.name,
    "mech-label"
  );

  group.appendChild(leftPoly);
  group.appendChild(rightPoly);
  group.appendChild(topPoly);
  group.appendChild(facingLine);
  group.appendChild(label);
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

function getDiamondFacingLinePoints(state, unit, diamond) {
  const facing = normalizeFacing(getWorldFacing(state, unit));
  const center = diamond.center;

  const northEast = midpoint(diamond.top, diamond.right);
  const southEast = midpoint(diamond.right, diamond.bottom);
  const southWest = midpoint(diamond.bottom, diamond.left);
  const northWest = midpoint(diamond.left, diamond.top);

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
