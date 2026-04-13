// src/render/renderUnits.js

import { getTile, getTileRenderElevation } from "../map.js";
import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { TOPDOWN_CONFIG } from "./projection.js";
import { getUnitFootprint, getUnitFootprintBounds } from "../scale/scaleMath.js";

export function drawMech(state, unit, screenX, screenY, parent, isActive = false) {
  const footprint = getUnitFootprint(unit);
  const bounds = getUnitFootprintBounds(unit);
  const anchorTile = getTile(state.map, unit.x, unit.y);
  const tileElevation = anchorTile ? getTileRenderElevation(anchorTile) : 0;

  const group = svgEl("g");

  if (state.ui.viewMode === "top") {
    drawTopUnit(state, unit, group, screenX, screenY, footprint, isActive);
    parent.appendChild(group);
    return;
  }

  drawIsoUnit(state, unit, group, screenX, screenY, footprint, bounds, tileElevation, isActive);
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

  const facingStripe = makePolygon(
    getTopFacingStripePoints(unit, screenX, screenY, widthPx, heightPx),
    getTopFacingClass(state, unit),
    "currentColor"
  );
  facingStripe.removeAttribute("fill");

  const label = makeText(
    screenX + (widthPx / 2),
    screenY + heightPx + 16,
    unit.name,
    unit.unitType === "pilot" ? "pilot-label" : "mech-label"
  );

  group.appendChild(body);
  group.appendChild(facingStripe);
  group.appendChild(label);
}

function drawIsoUnit(state, unit, group, screenX, screenY, footprint, _bounds, _tileElevation, isActive) {
  const size = footprint.width;
  const halfW = (RENDER_CONFIG.isoTileWidth * size) / 2;
  const halfH = (RENDER_CONFIG.isoTileHeight * size) / 2;
  const bodyHeight = unit.unitType === "pilot" ? 18 : 36;

  const top = [
    { x: screenX, y: screenY },
    { x: screenX + halfW, y: screenY + halfH },
    { x: screenX, y: screenY + (halfH * 2) },
    { x: screenX - halfW, y: screenY + halfH }
  ];

  const left = [
    top[3],
    top[2],
    { x: top[2].x, y: top[2].y + bodyHeight },
    { x: top[3].x, y: top[3].y + bodyHeight }
  ];

  const right = [
    top[1],
    top[2],
    { x: top[2].x, y: top[2].y + bodyHeight },
    { x: top[1].x, y: top[1].y + bodyHeight }
  ];

  const shadow = svgEl("ellipse");
  shadow.setAttribute("cx", screenX);
  shadow.setAttribute("cy", screenY + (halfH * 2) + 8);
  shadow.setAttribute("rx", Math.max(10, halfW * 0.55));
  shadow.setAttribute("ry", Math.max(4, halfH * 0.28));
  shadow.setAttribute("class", unit.unitType === "pilot" ? "pilot-shadow" : "mech-shadow");
  group.appendChild(shadow);

  const leftPoly = makePolygon(
    left,
    unit.unitType === "pilot" ? "pilot-cube-left" : "mech-cube-left",
    "currentColor"
  );
  leftPoly.removeAttribute("fill");

  const rightPoly = makePolygon(
    right,
    unit.unitType === "pilot" ? "pilot-cube-right" : "mech-cube-right",
    "currentColor"
  );
  rightPoly.removeAttribute("fill");

  const topPoly = makePolygon(
    top,
    getIsoTopClass(state, unit, isActive),
    "currentColor"
  );
  topPoly.removeAttribute("fill");

  const facingStripe = makePolygon(
    getIsoFacingStripePoints(unit, top),
    getIsoTopStripeClass(state, unit),
    "currentColor"
  );
  facingStripe.removeAttribute("fill");

  const label = makeText(
    screenX,
    screenY + halfH - Math.max(10, bodyHeight * 0.15),
    unit.name,
    unit.unitType === "pilot" ? "pilot-label" : "mech-label"
  );

  group.appendChild(leftPoly);
  group.appendChild(rightPoly);
  group.appendChild(topPoly);
  group.appendChild(facingStripe);
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

function getTopBodyClass(unit, isActive) {
  if (unit.unitType === "pilot") {
    return isActive ? "pilot-top-body-active" : "pilot-top-body";
  }

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
  const classes = [unit.unitType === "pilot" ? "pilot-iso-body" : "mech-cube-top"];

  if (isActive) {
    classes.push(unit.unitType === "pilot" ? "pilot-iso-body-active" : "mech-cube-top-active");
  }

  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  if (
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null
  ) {
    classes.push(unit.unitType === "pilot" ? "pilot-iso-body-active" : "mech-cube-top-preview");
  }

  return classes.join(" ");
}

export function getIsoTopStripeClass(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  if (unit.unitType === "pilot") {
    return isPreviewing ? "pilot-iso-facing-active" : "pilot-iso-facing";
  }

  return isPreviewing ? "mech-top-facing-preview" : "mech-top-facing";
}

function getTopFacingStripePoints(unit, x, y, width, height) {
  const facing = normalizeFacing(unit.facing);
  const inset = Math.max(4, Math.min(width, height) * 0.18);

  switch (facing) {
    case 0:
      return [
        { x: x + (width / 2), y: y + inset },
        { x: x + width - inset, y: y + (height / 2) },
        { x: x + inset, y: y + (height / 2) }
      ];
    case 1:
      return [
        { x: x + width - inset, y: y + (height / 2) },
        { x: x + (width / 2), y: y + inset },
        { x: x + (width / 2), y: y + height - inset }
      ];
    case 2:
      return [
        { x: x + (width / 2), y: y + height - inset },
        { x: x + inset, y: y + (height / 2) },
        { x: x + width - inset, y: y + (height / 2) }
      ];
    case 3:
    default:
      return [
        { x: x + inset, y: y + (height / 2) },
        { x: x + (width / 2), y: y + height - inset },
        { x: x + (width / 2), y: y + inset }
      ];
  }
}

function getIsoFacingStripePoints(unit, top) {
  const facing = normalizeFacing(unit.facing);

  const north = [top[0], midpoint(top[0], top[1]), midpoint(top[0], top[3])];
  const east = [top[1], midpoint(top[1], top[2]), midpoint(top[1], top[0])];
  const south = [top[2], midpoint(top[2], top[3]), midpoint(top[2], top[1])];
  const west = [top[3], midpoint(top[3], top[0]), midpoint(top[3], top[2])];

  switch (facing) {
    case 0: return north;
    case 1: return east;
    case 2: return south;
    case 3:
    default: return west;
  }
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function normalizeFacing(value) {
  const n = Number.isFinite(value) ? value : 0;
  return ((n % 4) + 4) % 4;
}
