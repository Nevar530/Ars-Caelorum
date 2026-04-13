// src/render/renderUnits.js

import { getTile, getTileRenderElevation } from "../map.js";
import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { projectScene, TOPDOWN_CONFIG } from "./projection.js";
import { getUnitScenePosition } from "../mechs.js";

export function drawMech(state, unit, screenX, screenY, parent, isActive = false) {
  const group = svgEl("g");
  const anchor = getUnitScenePosition(unit);
  const tile = getTile(state.map, anchor.mechX, anchor.mechY);

  if (!tile) return;

  const tileElevation = getTileRenderElevation(tile);

  if (unit.unitType === "pilot") {
    drawPilot(state, unit, anchor, screenX, screenY, tileElevation, parent, isActive);
    return;
  }

  if (state.ui.viewMode === "top") {
    const cellX = screenX + (TOPDOWN_CONFIG.cellSize / 2);
    const cellY = screenY + (TOPDOWN_CONFIG.cellSize / 2);
    const size = 14;

    const body = svgEl("rect");
    body.setAttribute("x", cellX - size);
    body.setAttribute("y", cellY - size);
    body.setAttribute("width", size * 2);
    body.setAttribute("height", size * 2);
    body.setAttribute("rx", "3");
    body.setAttribute("class", getTopMechBodyClass(state, unit, isActive));

    const facingMark = makePolygon(
      getTopFacingStripePointsFromWorld(state, unit, tileElevation, cellX, cellY, anchor),
      getTopFacingClass(state, unit),
      "currentColor"
    );
    facingMark.removeAttribute("fill");

    const label = makeText(cellX, cellY + 24, unit.name, "mech-label");

    group.appendChild(body);
    group.appendChild(facingMark);
    group.appendChild(label);
    parent.appendChild(group);
    return;
  }

  const halfW = 18;
  const halfH = 10;
  const cubeHeight = 18;
  const mechLevels = 2;

  const anchorX = screenX;
  const anchorY = screenY + (RENDER_CONFIG.isoTileHeight / 2);

  const shadow = svgEl("ellipse");
  shadow.setAttribute("cx", anchorX);
  shadow.setAttribute("cy", anchorY + 10);
  shadow.setAttribute("rx", 18);
  shadow.setAttribute("ry", 8);
  shadow.setAttribute("class", "mech-shadow");
  group.appendChild(shadow);

  for (let level = 0; level < mechLevels; level++) {
    const levelOffset = level * cubeHeight;

    const top = [
      { x: anchorX, y: anchorY - cubeHeight - halfH - levelOffset },
      { x: anchorX + halfW, y: anchorY - cubeHeight - levelOffset },
      { x: anchorX, y: anchorY - cubeHeight + halfH - levelOffset },
      { x: anchorX - halfW, y: anchorY - cubeHeight - levelOffset }
    ];

    const left = [
      top[3],
      top[2],
      { x: top[2].x, y: top[2].y + cubeHeight },
      { x: top[3].x, y: top[3].y + cubeHeight }
    ];

    const right = [
      top[1],
      top[2],
      { x: top[2].x, y: top[2].y + cubeHeight },
      { x: top[1].x, y: top[1].y + cubeHeight }
    ];

    const leftPoly = makePolygon(left, "mech-cube-left", "currentColor");
    leftPoly.removeAttribute("fill");

    const rightPoly = makePolygon(right, "mech-cube-right", "currentColor");
    rightPoly.removeAttribute("fill");

    const topPoly = makePolygon(
      top,
      getIsoTopClass(state, unit, isActive),
      "currentColor"
    );
    topPoly.removeAttribute("fill");

    group.appendChild(leftPoly);
    group.appendChild(rightPoly);
    group.appendChild(topPoly);

    if (level === mechLevels - 1) {
      const stripe = makePolygon(
        getIsoTopStripePointsFromWorld(
          state,
          unit,
          tileElevation + level,
          anchorX,
          anchorY - levelOffset,
          cubeHeight,
          halfH,
          anchor
        ),
        getIsoTopStripeClass(state, unit),
        "currentColor"
      );
      stripe.removeAttribute("fill");
      group.appendChild(stripe);
    }
  }

  const label = makeText(
    anchorX,
    anchorY - (cubeHeight * mechLevels) + 6,
    unit.name,
    "mech-label"
  );

  group.appendChild(label);
  parent.appendChild(group);
}

function drawPilot(state, unit, anchor, screenX, screenY, tileElevation, parent, isActive) {
  const group = svgEl("g");

  if (state.ui.viewMode === "top") {
    const cellSize = TOPDOWN_CONFIG.cellSize / 2;
    const topX = screenX;
    const topY = screenY;
    const centerX = topX + (cellSize / 2);
    const centerY = topY + (cellSize / 2);

    const body = svgEl("circle");
    body.setAttribute("cx", centerX);
    body.setAttribute("cy", centerY);
    body.setAttribute("r", "8");
    body.setAttribute("class", isActive ? "pilot-top-body-active" : "pilot-top-body");

    const facingMark = makePolygon(
      getPilotTopFacingStripePoints(state, unit, centerX, centerY, anchor),
      getTopFacingClass(state, unit),
      "currentColor"
    );
    facingMark.removeAttribute("fill");

    const label = makeText(centerX, centerY + 18, unit.name, "pilot-label");

    group.appendChild(body);
    group.appendChild(facingMark);
    group.appendChild(label);
    parent.appendChild(group);
    return;
  }

  const anchorX = screenX;
  const anchorY = screenY + (RENDER_CONFIG.isoTileHeight * 0.25);

  const shadow = svgEl("ellipse");
  shadow.setAttribute("cx", anchorX);
  shadow.setAttribute("cy", anchorY + 6);
  shadow.setAttribute("rx", 8);
  shadow.setAttribute("ry", 4);
  shadow.setAttribute("class", "pilot-shadow");
  group.appendChild(shadow);

  const body = svgEl("circle");
  body.setAttribute("cx", anchorX);
  body.setAttribute("cy", anchorY - 6);
  body.setAttribute("r", "8");
  body.setAttribute("class", isActive ? "pilot-iso-body-active" : "pilot-iso-body");
  group.appendChild(body);

  const facing = makePolygon(
    getPilotIsoFacingTriangle(state, unit, anchorX, anchorY - 6, anchor, tileElevation),
    isActive ? "pilot-iso-facing-active" : "pilot-iso-facing",
    "currentColor"
  );
  facing.removeAttribute("fill");
  group.appendChild(facing);

  const label = makeText(anchorX, anchorY - 18, unit.name, "pilot-label");
  group.appendChild(label);

  parent.appendChild(group);
}

export function getWorldFacing(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? state.ui.facingPreview : unit.facing;
}

export function facingToWorldDelta(facing) {
  switch (facing) {
    case 0: return { dx: 0, dy: -1 };
    case 1: return { dx: 1, dy: 0 };
    case 2: return { dx: 0, dy: 1 };
    case 3: return { dx: -1, dy: 0 };
    default: return { dx: 0, dy: -1 };
  }
}

export function getTopMechBodyClass(state, unit, isActive) {
  const classes = ["mech-top-body"];

  if (isActive) classes.push("mech-top-body-active");

  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  if (
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null
  ) {
    classes.push("mech-top-body-preview");
  }

  return classes.join(" ");
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

  if (isActive) classes.push("mech-cube-top-active");

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

export function getIsoTopStripeClass(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-cube-top-stripe-preview" : "mech-cube-top-stripe";
}

export function getTopFacingStripePointsFromWorld(state, unit, elevation, centerX, centerY, anchor = null) {
  const facing = getWorldFacing(state, unit);
  const { dx, dy } = facingToWorldDelta(facing);

  const sceneAnchor = anchor ?? getUnitScenePosition(unit);

  const from = projectScene(state, sceneAnchor.sceneX, sceneAnchor.sceneY, elevation, sceneAnchor.sceneSize);
  const to = projectScene(
    state,
    sceneAnchor.sceneX + (dx * sceneAnchor.sceneSize),
    sceneAnchor.sceneY + (dy * sceneAnchor.sceneSize),
    elevation,
    sceneAnchor.sceneSize
  );

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const len = Math.hypot(vx, vy) || 1;
  const nx = vx / len;
  const ny = vy / len;
  const px = -ny;
  const py = nx;

  const stripeLength = 9;
  const stripeWidth = 6;

  return [
    {
      x: centerX + (nx * stripeLength) + (px * stripeWidth),
      y: centerY + (ny * stripeLength) + (py * stripeWidth)
    },
    {
      x: centerX + (nx * stripeLength) - (px * stripeWidth),
      y: centerY + (ny * stripeLength) - (py * stripeWidth)
    },
    {
      x: centerX - (nx * 2),
      y: centerY - (ny * 2)
    }
  ];
}

export function getIsoTopStripePointsFromWorld(
  state,
  unit,
  elevation,
  anchorX,
  anchorY,
  cubeHeight,
  halfH,
  anchor = null
) {
  const facing = getWorldFacing(state, unit);
  const { dx, dy } = facingToWorldDelta(facing);

  const sceneAnchor = anchor ?? getUnitScenePosition(unit);

  const from = projectScene(state, sceneAnchor.sceneX, sceneAnchor.sceneY, elevation, sceneAnchor.sceneSize);
  const to = projectScene(
    state,
    sceneAnchor.sceneX + (dx * sceneAnchor.sceneSize),
    sceneAnchor.sceneY + (dy * sceneAnchor.sceneSize),
    elevation,
    sceneAnchor.sceneSize
  );

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const len = Math.hypot(vx, vy) || 1;
  const nx = vx / len;
  const ny = vy / len;
  const px = -ny;
  const py = nx;

  const centerX = anchorX;
  const centerY = anchorY - cubeHeight - (halfH / 2);

  const stripeLength = 12;
  const stripeWidth = 6;

  return [
    {
      x: centerX + (nx * stripeLength) + (px * stripeWidth),
      y: centerY + (ny * stripeLength) + (py * stripeWidth)
    },
    {
      x: centerX + (nx * stripeLength) - (px * stripeWidth),
      y: centerY + (ny * stripeLength) - (py * stripeWidth)
    },
    {
      x: centerX - (nx * 2),
      y: centerY - (ny * 2)
    }
  ];
}

function getPilotTopFacingStripePoints(state, unit, centerX, centerY, anchor) {
  const facing = getWorldFacing(state, unit);
  const { dx, dy } = facingToWorldDelta(facing);

  const from = projectScene(state, anchor.sceneX, anchor.sceneY, 0, anchor.sceneSize);
  const to = projectScene(
    state,
    anchor.sceneX + (dx * anchor.sceneSize),
    anchor.sceneY + (dy * anchor.sceneSize),
    0,
    anchor.sceneSize
  );

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const len = Math.hypot(vx, vy) || 1;
  const nx = vx / len;
  const ny = vy / len;
  const px = -ny;
  const py = nx;

  return [
    { x: centerX + (nx * 8) + (px * 4), y: centerY + (ny * 8) + (py * 4) },
    { x: centerX + (nx * 8) - (px * 4), y: centerY + (ny * 8) - (py * 4) },
    { x: centerX - (nx * 2), y: centerY - (ny * 2) }
  ];
}

function getPilotIsoFacingTriangle(state, unit, centerX, centerY, anchor, elevation) {
  const facing = getWorldFacing(state, unit);
  const { dx, dy } = facingToWorldDelta(facing);

  const from = projectScene(state, anchor.sceneX, anchor.sceneY, elevation, anchor.sceneSize);
  const to = projectScene(
    state,
    anchor.sceneX + (dx * anchor.sceneSize),
    anchor.sceneY + (dy * anchor.sceneSize),
    elevation,
    anchor.sceneSize
  );

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const len = Math.hypot(vx, vy) || 1;
  const nx = vx / len;
  const ny = vy / len;
  const px = -ny;
  const py = nx;

  return [
    { x: centerX + (nx * 9) + (px * 4), y: centerY + (ny * 9) + (py * 4) },
    { x: centerX + (nx * 9) - (px * 4), y: centerY + (ny * 9) - (py * 4) },
    { x: centerX - (nx * 2), y: centerY - (ny * 2) }
  ];
}
