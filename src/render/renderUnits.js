// src/render/renderUnits.js

import { svgEl, makePolygon, makeText } from "../utils.js";
import { TOPDOWN_CONFIG } from "./projection.js";
import { getUnitFootprint } from "../scale/scaleMath.js";

export function drawMech(state, unit, screenX, screenY, parent, isActive = false) {
  const footprint = getUnitFootprint(unit);
  const group = svgEl("g");

  if (state.ui.viewMode === "top") {
    drawTopUnit(state, unit, group, screenX, screenY, footprint, isActive);
    parent.appendChild(group);
    return;
  }

  drawIsoStackedUnit(state, unit, group, screenX, screenY, footprint, isActive);
  parent.appendChild(group);
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
  body.setAttribute("class", getTopBodyClass(unit, isActive));

  const facingLine = svgEl("line");
  const linePoints = getTopFacingLinePoints(unit, screenX, screenY, widthPx, heightPx);
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

function drawIsoStackedUnit(state, unit, group, screenX, screenY, footprint, isActive) {
  const unitSize = Math.max(footprint.width, footprint.height);
  const halfW = unitSize * 48;
  const halfH = unitSize * 24;

  // Lower cube height and upper cube lift.
  // Pilot stays smaller but uses the exact same stacked language.
  const lowerHeight = unit.unitType === "pilot" ? 22 : 34;
  const upperHeight = unit.unitType === "pilot" ? 18 : 28;
  const upperLift = unit.unitType === "pilot" ? 18 : 28;

  const lowerTop = makeDiamond(screenX, screenY + upperLift, halfW, halfH);
  const upperTop = makeDiamond(screenX, screenY, halfW, halfH);

  const shadow = svgEl("ellipse");
  shadow.setAttribute("cx", screenX);
  shadow.setAttribute("cy", screenY + upperLift + (halfH * 2) + 10);
  shadow.setAttribute("rx", Math.max(10, halfW * 0.62));
  shadow.setAttribute("ry", Math.max(4, halfH * 0.32));
  shadow.setAttribute("class", "mech-shadow");
  group.appendChild(shadow);

  // Lower cube
  const lowerLeft = makeSideFace(lowerTop.left, lowerTop.bottom, lowerHeight);
  const lowerRight = makeSideFace(lowerTop.right, lowerTop.bottom, lowerHeight);

  const lowerLeftPoly = makePolygon(lowerLeft, "mech-cube-left", "currentColor");
  lowerLeftPoly.removeAttribute("fill");

  const lowerRightPoly = makePolygon(lowerRight, "mech-cube-right", "currentColor");
  lowerRightPoly.removeAttribute("fill");

  const lowerTopPoly = makePolygon(
    lowerTop.points,
    getIsoTopClass(state, unit, isActive),
    "currentColor"
  );
  lowerTopPoly.removeAttribute("fill");

  // Upper cube
  const upperLeft = makeSideFace(upperTop.left, upperTop.bottom, upperHeight);
  const upperRight = makeSideFace(upperTop.right, upperTop.bottom, upperHeight);

  const upperLeftPoly = makePolygon(upperLeft, "mech-cube-left", "currentColor");
  upperLeftPoly.removeAttribute("fill");

  const upperRightPoly = makePolygon(upperRight, "mech-cube-right", "currentColor");
  upperRightPoly.removeAttribute("fill");

  const upperTopPoly = makePolygon(
    upperTop.points,
    getIsoTopClass(state, unit, isActive),
    "currentColor"
  );
  upperTopPoly.removeAttribute("fill");

  const facingLine = svgEl("line");
  const facing = getIsoFacingLinePoints(state, unit, upperTop);
  facingLine.setAttribute("x1", facing.x1);
  facingLine.setAttribute("y1", facing.y1);
  facingLine.setAttribute("x2", facing.x2);
  facingLine.setAttribute("y2", facing.y2);
  facingLine.setAttribute("class", getFacingLineClass(state, unit));

  const label = makeText(
    screenX,
    screenY + halfH - Math.max(12, upperHeight * 0.15),
    unit.name,
    "mech-label"
  );

  group.appendChild(lowerLeftPoly);
  group.appendChild(lowerRightPoly);
  group.appendChild(lowerTopPoly);

  group.appendChild(upperLeftPoly);
  group.appendChild(upperRightPoly);
  group.appendChild(upperTopPoly);

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

function getTopBodyClass(_unit, isActive) {
  return isActive ? "mech-top-body mech-top-body-active" : "mech-top-body";
}

export function getTopFacingClass(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-top-facing-preview" : "mech-top-facing";
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

function getTopFacingLinePoints(unit, x, y, width, height) {
  const facing = normalizeFacing(unit.facing);
  const cx = x + (width / 2);
  const cy = y + (height / 2);
  const reach = Math.max(8, Math.min(width, height) * 0.34);

  switch (facing) {
    case 0:
      return { x1: cx, y1: cy, x2: cx, y2: cy - reach };
    case 1:
      return { x1: cx, y1: cy, x2: cx + reach, y2: cy };
    case 2:
      return { x1: cx, y1: cy, x2: cx, y2: cy + reach };
    case 3:
    default:
      return { x1: cx, y1: cy, x2: cx - reach, y2: cy };
  }
}

function getIsoFacingLinePoints(state, unit, topDiamond) {
  const facing = normalizeFacing(getWorldFacing(state, unit));
  const center = topDiamond.center;
  const north = topDiamond.top;
  const east = topDiamond.right;
  const south = topDiamond.bottom;
  const west = topDiamond.left;

  const tipInset = 0.34;

  switch (facing) {
    case 0: {
      const end = lerpPoint(center, north, tipInset);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 1: {
      const end = lerpPoint(center, east, tipInset);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 2: {
      const end = lerpPoint(center, south, tipInset);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 3:
    default: {
      const end = lerpPoint(center, west, tipInset);
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
