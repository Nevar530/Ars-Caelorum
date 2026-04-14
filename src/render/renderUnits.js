// src/render/renderUnits.js

import { svgEl, makePolygon, makeText } from "../utils.js";
import { getUnitFootprint } from "../scale/scaleMath.js";
import { RENDER_CONFIG } from "../config.js";
import { getTopdownCellSize } from "./projection.js";

export function drawMech(state, unit, renderModel, parent, isActive = false) {
  const items = getUnitRenderSceneItems(state, unit, renderModel, isActive);

  for (const item of items) {
    item.render(parent);
  }
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

export function getUnitRenderSceneItems(state, unit, renderModel, isActive = false) {
  if (state.ui.viewMode === "top") {
    return buildTopUnitSceneItems(state, unit, renderModel, isActive);
  }

  return buildIsoUnitSceneItems(state, unit, renderModel, isActive);
}

function buildTopUnitSceneItems(state, unit, renderModel, isActive) {
  const footprint = getUnitFootprint(unit);
  const cellSize = getTopdownCellSize(state);
  const halfW = footprint.width * (cellSize / 2);
  const halfH = footprint.height * (cellSize / 4);

  const anchorX = renderModel.top.center.x;
  const anchorY = renderModel.top.center.y;

  const diamond = {
    top: { x: anchorX, y: anchorY - halfH },
    right: { x: anchorX + halfW, y: anchorY },
    bottom: { x: anchorX, y: anchorY + halfH },
    left: { x: anchorX - halfW, y: anchorY },
    center: { x: anchorX, y: anchorY }
  };

  const topPoints = [diamond.top, diamond.right, diamond.bottom, diamond.left];

  return [
    {
      sortDepth: diamond.bottom.y,
      sortKey: diamond.center.x,
      render(parent) {
        const poly = makePolygon(topPoints, getTopBodyClass(isActive), "currentColor");
        poly.removeAttribute("fill");
        parent.appendChild(poly);
      }
    },
    {
      sortDepth: diamond.bottom.y + 0.01,
      sortKey: diamond.center.x,
      render(parent) {
        const line = svgEl("line");
        const facing = getDiamondFacingLinePoints(state, unit, diamond);
        line.setAttribute("x1", facing.x1);
        line.setAttribute("y1", facing.y1);
        line.setAttribute("x2", facing.x2);
        line.setAttribute("y2", facing.y2);
        line.setAttribute("class", getFacingLineClass(state, unit));
        parent.appendChild(line);
      }
    },
    {
      sortDepth: diamond.bottom.y + 0.02,
      sortKey: diamond.center.x,
      render(parent) {
        const label = makeText(
          diamond.center.x,
          diamond.center.y + 4,
          unit.name,
          "mech-label"
        );
        parent.appendChild(label);
      }
    }
  ];
}

function buildIsoUnitSceneItems(state, unit, renderModel, isActive) {
  const footprint = getUnitFootprint(unit);
  const prismHeight = getUnitCubeHeightPx(unit);

  const halfW = footprint.width * (RENDER_CONFIG.isoTileWidth / 2);
  const halfH = footprint.height * (RENDER_CONFIG.isoTileHeight / 2);

  const anchorX = renderModel.iso.center.x;
  const anchorY = renderModel.iso.center.y;

  const base = {
    top: { x: anchorX, y: anchorY - halfH },
    right: { x: anchorX + halfW, y: anchorY },
    bottom: { x: anchorX, y: anchorY + halfH },
    left: { x: anchorX - halfW, y: anchorY },
    center: { x: anchorX, y: anchorY }
  };

  const top = {
    top: { x: base.top.x, y: base.top.y - prismHeight },
    right: { x: base.right.x, y: base.right.y - prismHeight },
    bottom: { x: base.bottom.x, y: base.bottom.y - prismHeight },
    left: { x: base.left.x, y: base.left.y - prismHeight },
    center: { x: base.center.x, y: base.center.y - prismHeight }
  };

  const leftFace = [top.left, top.bottom, base.bottom, base.left];
  const rightFace = [top.right, top.bottom, base.bottom, base.right];
  const topFace = [top.top, top.right, top.bottom, top.left];

  const leftDepth = maxY(leftFace);
  const rightDepth = maxY(rightFace);
  const topDepth = maxY(topFace);

  const items = [
    {
      sortDepth: leftDepth,
      sortKey: avgX(leftFace),
      render(parent) {
        const poly = makePolygon(leftFace, "mech-cube-left", "currentColor");
        poly.removeAttribute("fill");
        parent.appendChild(poly);
      }
    },
    {
      sortDepth: rightDepth,
      sortKey: avgX(rightFace),
      render(parent) {
        const poly = makePolygon(rightFace, "mech-cube-right", "currentColor");
        poly.removeAttribute("fill");
        parent.appendChild(poly);
      }
    },
    {
      sortDepth: topDepth,
      sortKey: avgX(topFace),
      render(parent) {
        const poly = makePolygon(topFace, getIsoTopClass(state, unit, isActive), "currentColor");
        poly.removeAttribute("fill");
        parent.appendChild(poly);
      }
    },
    {
      sortDepth: topDepth + 0.01,
      sortKey: top.center.x,
      render(parent) {
        const line = svgEl("line");
        const facing = getDiamondFacingLinePoints(state, unit, top);
        line.setAttribute("x1", facing.x1);
        line.setAttribute("y1", facing.y1);
        line.setAttribute("x2", facing.x2);
        line.setAttribute("y2", facing.y2);
        line.setAttribute("class", getFacingLineClass(state, unit));
        parent.appendChild(line);
      }
    },
    {
      sortDepth: topDepth + 0.02,
      sortKey: top.center.x,
      render(parent) {
        const label = makeText(
          top.center.x,
          top.center.y + 6,
          unit.name,
          "mech-label"
        );
        parent.appendChild(label);
      }
    }
  ];

  return items;
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

function maxY(points) {
  return Math.max(...points.map((p) => p.y));
}

function avgX(points) {
  return points.reduce((sum, p) => sum + p.x, 0) / points.length;
}
