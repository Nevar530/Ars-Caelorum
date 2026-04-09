// src/render/renderUnits.js

import { getTile } from "../map.js";
import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { projectScene, TOPDOWN_CONFIG } from "./projection.js";

export function drawMech(state, mech, screenX, screenY, parent, isActive = false) {
  const group = svgEl("g");
  const tile = getTile(state.map, mech.x, mech.y);

  if (!tile) return;

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
    body.setAttribute("class", getTopMechBodyClass(state, mech, isActive));

    const facingMark = makePolygon(
      getTopFacingStripePointsFromWorld(state, mech, tile.elevation, cellX, cellY),
      getTopFacingClass(state, mech),
      "currentColor"
    );
    facingMark.removeAttribute("fill");

    const label = makeText(
      cellX,
      cellY + 24,
      mech.name,
      "mech-label"
    );

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
      { x: anchorX,         y: anchorY - cubeHeight - halfH - levelOffset },
      { x: anchorX + halfW, y: anchorY - cubeHeight - levelOffset },
      { x: anchorX,         y: anchorY - cubeHeight + halfH - levelOffset },
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
      getIsoTopClass(state, mech, isActive),
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
          mech,
          tile.elevation + level,
          anchorX,
          anchorY - levelOffset,
          cubeHeight,
          halfH
        ),
        getIsoTopStripeClass(state, mech),
        "currentColor"
      );
      stripe.removeAttribute("fill");
      group.appendChild(stripe);
    }
  }

  const label = makeText(
    anchorX,
    anchorY - (cubeHeight * mechLevels) + 6,
    mech.name,
    "mech-label"
  );

  group.appendChild(label);
  parent.appendChild(group);
}

export function getWorldFacing(state, mech) {
  const isPreviewing =
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? state.ui.facingPreview : mech.facing;
}

export function facingToWorldDelta(facing) {
  switch (facing) {
    case 0:
      return { dx: 0, dy: -1 };
    case 1:
      return { dx: 1, dy: 0 };
    case 2:
      return { dx: 0, dy: 1 };
    case 3:
      return { dx: -1, dy: 0 };
    default:
      return { dx: 0, dy: -1 };
  }
}

export function getTopMechBodyClass(state, mech, isActive) {
  const classes = ["mech-top-body"];

  if (isActive) {
    classes.push("mech-top-body-active");
  }

  if (
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null
  ) {
    classes.push("mech-top-body-preview");
  }

  return classes.join(" ");
}

export function getTopFacingClass(state, mech) {
  const isPreviewing =
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-top-facing-preview" : "mech-top-facing";
}

export function getIsoTopClass(state, mech, isActive) {
  const classes = ["mech-cube-top"];

  if (isActive) {
    classes.push("mech-cube-top-active");
  }

  if (
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null
  ) {
    classes.push("mech-cube-top-preview");
  }

  return classes.join(" ");
}

export function getIsoTopStripeClass(state, mech) {
  const isPreviewing =
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-cube-top-stripe-preview" : "mech-cube-top-stripe";
}

export function getTopFacingStripePointsFromWorld(state, mech, elevation, centerX, centerY) {
  const facing = getWorldFacing(state, mech);
  const { dx, dy } = facingToWorldDelta(facing);

  const from = projectScene(state, mech.x, mech.y, elevation);
  const to = projectScene(state, mech.x + dx, mech.y + dy, elevation);

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const length = Math.hypot(vx, vy) || 1;
  const ux = vx / length;
  const uy = vy / length;
  const px = -uy;
  const py = ux;

  const start = {
    x: centerX - (ux * 4),
    y: centerY - (uy * 4)
  };

  const end = {
    x: centerX + (ux * 10),
    y: centerY + (uy * 10)
  };

  const halfThickness = 2.8;

  return [
    {
      x: start.x + (px * halfThickness),
      y: start.y + (py * halfThickness)
    },
    {
      x: end.x + (px * halfThickness),
      y: end.y + (py * halfThickness)
    },
    {
      x: end.x - (px * halfThickness),
      y: end.y - (py * halfThickness)
    },
    {
      x: start.x - (px * halfThickness),
      y: start.y - (py * halfThickness)
    }
  ];
}

export function getIsoTopStripePointsFromWorld(state, mech, elevation, anchorX, anchorY, height, halfH) {
  const facing = getWorldFacing(state, mech);
  const { dx, dy } = facingToWorldDelta(facing);

  const from = projectScene(state, mech.x, mech.y, elevation);
  const to = projectScene(state, mech.x + dx, mech.y + dy, elevation);

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const length = Math.hypot(vx, vy) || 1;
  const ux = vx / length;
  const uy = vy / length;
  const px = -uy;
  const py = ux;

  const center = {
    x: anchorX,
    y: anchorY - height
  };

  const start = {
    x: center.x - (ux * 3),
    y: center.y - (uy * 3)
  };

  const end = {
    x: center.x + (ux * 12),
    y: center.y + (uy * 12)
  };

  const halfThickness = 2.4;

  return [
    {
      x: start.x + (px * halfThickness),
      y: start.y + (py * halfThickness)
    },
    {
      x: end.x + (px * halfThickness),
      y: end.y + (py * halfThickness)
    },
    {
      x: end.x - (px * halfThickness),
      y: end.y - (py * halfThickness)
    },
    {
      x: start.x - (px * halfThickness),
      y: start.y - (py * halfThickness)
    }
  ];
}
