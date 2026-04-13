// src/render/renderUnits.js

import { svgEl, makePolygon, makeText } from "../utils.js";
import { TOPDOWN_CONFIG } from "./projection.js";
import { getUnitFootprint } from "../scale/scaleMath.js";
import { RENDER_CONFIG } from "../config.js";

export function drawMech(state, unit, screenX, screenY, parent, isActive = false) {
  const footprint = getUnitFootprint(unit);
  const group = svgEl("g");

  if (state.ui.viewMode === "top") {
    drawTopUnit(state, unit, group, screenX, screenY, footprint, isActive);
    parent.appendChild(group);
    return;
  }

  drawIsoCubeUnit(state, unit, group, screenX, screenY, footprint, isActive);
  parent.appendChild(group);
}

export function getUnitCubeHeightPx(unit) {
  const footprint = getUnitFootprint(unit);
  const cubeSize = Math.max(footprint.width, footprint.height);

  // True cube height in world language:
  // 4x4 mech = 4 elevation steps tall
  // 2x2 pilot = 2 elevation steps tall
  return cubeSize * RENDER_CONFIG.elevationStepPx;
}

function drawTopUnit(state, unit, group, screenX, screenY, footprint, isActive) {
  const cellSize = TOPDOWN_CONFIG.cellSize;
  const widthPx = footprint.width * cellSize;
  const heightPx = footprint.height * cellSize;

  const body = svgEl("rect");
  body.setAttribute("x", screenX);
  body.setAttribute("y", screenY);
  body.setAttribute("width", widthPx);
  body.setAttribute("height", heightPx);
  body.setAttribute("rx", unit.unitType === "pilot" ? "6" : "10");
  body.setAttribute("class", getTopBodyClass(isActive));

  const facingLine = svgEl("line");
  const linePoints = getTopFacingLinePoints(state, unit, screenX, screenY, widthPx, heightPx);
  facingLine.setAttribute("x1", linePoints.x1);
  facingLine.setAttribute("y1", linePoints.y1);
  facingLine.setAttribute("x2", linePoints.x2);
  facingLine.setAttribute("y2", linePoints.y2);
  facingLine.setAttribute("class", getFacingLineClass(state, unit));

  const label = makeText(
    screenX + (widthPx / 2),
    screenY + heightPx + 16,
    unit.name,
    "mech-label"
  );

  group.appendChild(body);
  group.appendChild(facingLine);
  group.appendChild(label);
}

function drawIsoCubeUnit(state, unit, group, screenX, screenY, footprint, isActive) {
  const cubeSize = Math.max(footprint.width, footprint.height);
  const halfW = cubeSize * (RENDER_CONFIG.isoTileWidth / 2);
  const halfH = cubeSize * (RENDER_CONFIG.isoTileHeight / 2);
  const cubeHeight = getUnitCubeHeightPx(unit);

  const topDiamond = makeDiamond(screenX, screenY, halfW, halfH);

  const shadow = svgEl("ellipse");
  shadow.setAttribute("cx", screenX);
  shadow.setAttribute("cy", screenY + (halfH * 2) + cubeHeight + 8);
  shadow.setAttribute("rx", Math.max(10, halfW * 0.62));
  shadow.setAttribute("ry", Math.max(4, halfH * 0.30));
  shadow.setAttribute("class", "mech-shadow");
  group.appendChild(shadow);

  const leftFace = makeSideFace(topDiamond.left, topDiamond.bottom, cubeHeight);
  const rightFace = makeSideFace(topDiamond.right, topDiamond.bottom, cubeHeight);

  const leftPoly = makePolygon(leftFace, "mech-cube-left", "currentColor");
  leftPoly.removeAttribute("fill");

  const rightPoly = makePolygon(rightFace, "mech-cube-right", "currentColor");
  rightPoly.removeAttribute("fill");

  const topPoly = makePolygon(
    topDiamond.points,
    getIsoTopClass(state, unit, isActive),
    "currentColor"
  );
  topPoly.removeAttribute("fill");

  const facingLine = svgEl("line");
  const facing = getIsoFacingLinePoints(state, unit, topDiamond);
  facingLine.setAttribute("x1", facing.x1);
  facingLine.setAttribute("y1", facing.y1);
  facingLine.setAttribute("x2", facing.x2);
  facingLine.setAttribute("y2", facing.y2);
  facingLine.setAttribute("class", getFacingLineClass(state, unit));

  const label = makeText(
    screenX,
    screenY + halfH - 10,
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

function makeDiamond(centerX, topY, halfW, halfH) {
  const top = { x: centerX, y: topY };
  const right = { x: centerX + halfW, y: topY + halfH };
  const bottom = { x: centerX, y: topY + (halfH * 2) };
  const left = { x: centerX - halfW, y: topY + halfH };
  const center = { x: centerX, y: topY + halfH };

  return {
    top,
    right,
    bottom,
    left,
    center,
    points: [top, right, bottom, left]
  };
}

function makeSideFace(upperEdgeA, upperEdgeB, height) {
  return [
    upperEdgeA,
    upperEdgeB,
    { x: upperEdgeB.x, y: upperEdgeB.y + height },
    { x: upperEdgeA.x, y: upperEdgeA.y + height }
  ];
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
