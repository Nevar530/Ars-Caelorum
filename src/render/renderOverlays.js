// src/render/renderOverlays.js

import { RENDER_CONFIG } from "../config.js";
import {
  getTile,
  getDetailRenderCells,
  isDetailTileUniform,
  getTileFootElevation
} from "../map.js";
import { getUnitById } from "../mechs.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { getTopdownCellSize, projectScene, projectTileCenter } from "./projection.js";
import {
  getUnitFootprintBounds,
  getUnitCenterPoint,
  getUnitCenterTile
} from "../scale/scaleMath.js";
import {
  getPrimaryOccupantAt
} from "../scale/occupancy.js";

const DETAIL_OVERLAY_LIFT = 0.02;
const DETAIL_STROKE_WIDTH = 2;
const DIAMOND_STROKE_WIDTH = 2.5;

const DEFAULT_DRAW_OPTIONS = {
  drawShapes: true,
  drawLabels: true
};

export function drawSceneActionOverlayForTile(state, item, parent, options = DEFAULT_DRAW_OPTIONS) {
  const { drawShapes } = normalizeOptions(options);

  if (state.ui.mode !== "action-target") return;
  if (!drawShapes) return;

  const key = `${item.x},${item.y}`;
  const fireArc = tileSetFromList(state.ui.action.fireArcTiles || []);
  const evaluatedTargetTiles = state.ui.action.evaluatedTargetTiles || [];
  const targetMap = new Map(
    evaluatedTargetTiles.map((tile) => [`${tile.x},${tile.y}`, tile])
  );
  const effectTiles = tileSetFromList(state.ui.action.effectTiles || []);

  let fill = null;
  let stroke = null;

  if (fireArc.has(key)) {
    fill = "rgba(255, 176, 0, 0.22)";
    stroke = "rgba(255, 176, 0, 0.96)";
  }

  const evaluatedTarget = targetMap.get(key);
  if (evaluatedTarget) {
    const cover = evaluatedTarget.cover ?? "none";
    const visible = evaluatedTarget.visible ?? evaluatedTarget.los?.visible ?? false;

    if (visible && cover === "none") {
      fill = "rgba(82, 208, 146, 0.24)";
      stroke = "rgba(82, 208, 146, 0.98)";
    } else if (visible && cover === "half") {
      fill = "rgba(240, 176, 0, 0.24)";
      stroke = "rgba(240, 176, 0, 0.98)";
    } else {
      fill = "rgba(255, 74, 74, 0.24)";
      stroke = "rgba(255, 74, 74, 0.98)";
    }
  }

  if (effectTiles.has(key)) {
    fill = "rgba(255, 74, 74, 0.24)";
    stroke = "rgba(255, 74, 74, 1)";
  }

  if (!fill || !stroke) return;

  const occupantUnit = getUnitAtTile(state, item.x, item.y);

  if (occupantUnit) {
    drawOverlayForUnitFootprint(
      state,
      occupantUnit,
      "action-preview-unit",
      fill,
      stroke,
      parent
    );
    return;
  }

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(state, item.screenX, item.screenY, fill, stroke, parent);
    return;
  }

  drawOverlayForTile(state, item, "action-preview-tile", fill, stroke, parent);
}

export function drawSceneFocusOverlayForTile(state, item, parent, options = DEFAULT_DRAW_OPTIONS) {
  const { drawShapes } = normalizeOptions(options);

  if (item.x !== state.focus.x || item.y !== state.focus.y) return;
  if (!drawShapes) return;

  const activeUnit = getActiveUnit(state);

  if (state.ui.mode === "move" && activeUnit) {
    const previewUnit = { ...activeUnit, x: state.focus.x, y: state.focus.y };
    drawOverlayForUnitFootprint(
      state,
      previewUnit,
      "focus-tile",
      "rgba(240, 176, 0, 0.16)",
      "rgba(240, 176, 0, 1)",
      parent
    );
    return;
  }

  const occupantUnit = getUnitAtTile(state, item.x, item.y);
  if (occupantUnit) {
    drawOverlayForUnitFootprint(
      state,
      occupantUnit,
      "focus-unit",
      "rgba(240, 176, 0, 0.16)",
      "rgba(240, 176, 0, 1)",
      parent
    );
    return;
  }

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      state,
      item.screenX,
      item.screenY,
      "rgba(240, 176, 0, 0.16)",
      "rgba(240, 176, 0, 1)",
      parent
    );
    return;
  }

  drawOverlayForTile(
    state,
    item,
    "focus-tile",
    "rgba(240, 176, 0, 0.16)",
    "rgba(240, 176, 0, 1)",
    parent
  );
}

export function drawScenePathOverlayForTile(state, item, parent, options = DEFAULT_DRAW_OPTIONS) {
  const { drawShapes, drawLabels } = normalizeOptions(options);

  if (state.ui.mode !== "move") return;

  const path = state.ui.previewPath || [];
  if (!path.length) return;

  const stepIndex = path.findIndex((p) => p.x === item.x && p.y === item.y);
  if (stepIndex === -1) return;

  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return;

  const previewUnit = { ...activeUnit, x: item.x, y: item.y };

  if (drawShapes) {
    drawOverlayForUnitFootprint(
      state,
      previewUnit,
      "move-path-tile",
      "rgba(240, 176, 0, 0.24)",
      "rgba(240, 176, 0, 1)",
      parent
    );
  }

  if (drawLabels) {
    const labelPoint = getUnitLabelPoint(state, previewUnit);
    const label = makeText(
      labelPoint.x,
      labelPoint.y,
      String(stepIndex),
      "move-cost-label"
    );
    styleMoveCostLabel(label);
    parent.appendChild(label);
  }
}

export function drawSceneMoveOverlay(state, item, parent, text, options = DEFAULT_DRAW_OPTIONS) {
  const { drawShapes, drawLabels } = normalizeOptions(options);
  const activeUnit = getActiveUnit(state);

  if (!activeUnit) return;
  if (!item.reachableData) return;

  const previewUnit = { ...activeUnit, x: item.reachableData.x, y: item.reachableData.y };

  if (drawShapes) {
    drawOverlayForUnitFootprint(
      state,
      previewUnit,
      "move-range-tile",
      "rgba(80, 180, 255, 0.24)",
      "rgba(80, 180, 255, 0.92)",
      parent
    );
  }

  if (drawLabels) {
    const labelPoint = getUnitLabelPoint(state, previewUnit);
    const label = makeText(
      labelPoint.x,
      labelPoint.y,
      text,
      "move-cost-label"
    );
    styleMoveCostLabel(label);
    parent.appendChild(label);
  }
}

export function drawSceneActiveUnitOverlay(state, parent) {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return;

  if (state.ui.mode === "move") return;
  if (state.ui.mode === "face") return;

  drawOverlayForUnitFootprint(
    state,
    activeUnit,
    "active-unit-footprint",
    "rgba(255, 255, 255, 0.06)",
    "rgba(255, 255, 255, 0.7)",
    parent
  );
}

function drawOverlayForUnitFootprint(state, unit, className, fill, stroke, parent) {
  const bounds = getUnitFootprintBounds(unit);

  if (state.ui.viewMode === "top") {
    drawTopOverlayBounds(state, bounds, fill, stroke, parent);
    return;
  }

  const supportElevation = getUnitSupportElevation(state, unit);
  if (supportElevation === null) return;

  const centerTile = getUnitCenterTile(unit);

  const center = projectTileCenter(
    state,
    centerTile.x,
    centerTile.y,
    supportElevation + DETAIL_OVERLAY_LIFT
  );

  const halfW = bounds.width * (RENDER_CONFIG.isoTileWidth / 2);
  const halfH = bounds.height * (RENDER_CONFIG.isoTileHeight / 2);

  const points = [
    { x: center.x,         y: center.y - halfH },
    { x: center.x + halfW, y: center.y },
    { x: center.x,         y: center.y + halfH },
    { x: center.x - halfW, y: center.y }
  ];

  const poly = makePolygon(points, className, fill);
  poly.setAttribute("stroke", stroke);
  poly.setAttribute("stroke-width", String(DIAMOND_STROKE_WIDTH));
  poly.setAttribute("paint-order", "stroke fill");
  poly.setAttribute("stroke-linejoin", "round");
  parent.appendChild(poly);
}

function drawOverlayForTile(state, item, className, fill, stroke, parent) {
  const tile = getTile(state.map, item.x, item.y);
  if (!tile || isDetailTileUniform(tile)) {
    drawOverlayDiamond(item.screenX, item.screenY, className, fill, stroke, parent);
    return;
  }

  const detailCells = getDetailRenderCells(state.map, item.x, item.y);
  if (!detailCells.length) {
    drawOverlayDiamond(item.screenX, item.screenY, className, fill, stroke, parent);
    return;
  }

  for (const cell of detailCells) {
    drawOverlayCellTop(state, cell, className, fill, stroke, parent);
  }
}

function drawOverlayCellTop(state, cell, className, fill, stroke, parent) {
  const liftedElevation = cell.elevation + DETAIL_OVERLAY_LIFT;
  const topPoint = projectScene(
    state,
    cell.x,
    cell.y,
    liftedElevation,
    cell.size
  );

  const halfW = (RENDER_CONFIG.isoTileWidth * cell.size) / 2;
  const halfH = (RENDER_CONFIG.isoTileHeight * cell.size) / 2;

  const points = [
    { x: topPoint.x, y: topPoint.y },
    { x: topPoint.x + halfW, y: topPoint.y + halfH },
    { x: topPoint.x, y: topPoint.y + (halfH * 2) },
    { x: topPoint.x - halfW, y: topPoint.y + halfH }
  ];

  const poly = makePolygon(points, className, fill);
  poly.setAttribute("stroke", stroke);
  poly.setAttribute("stroke-width", String(DETAIL_STROKE_WIDTH));
  poly.setAttribute("paint-order", "stroke fill");
  poly.setAttribute("stroke-linejoin", "round");
  parent.appendChild(poly);
}

function normalizeOptions(options) {
  return {
    drawShapes: options?.drawShapes !== false,
    drawLabels: options?.drawLabels !== false
  };
}

export function tileSetFromList(tiles) {
  const set = new Set();
  for (const tile of tiles) {
    set.add(`${tile.x},${tile.y}`);
  }
  return set;
}

export function drawOverlayDiamond(screenX, screenY, className, fill, stroke, parent) {
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;

  const points = [
    { x: screenX, y: screenY },
    { x: screenX + halfW, y: screenY + halfH },
    { x: screenX, y: screenY + RENDER_CONFIG.isoTileHeight },
    { x: screenX - halfW, y: screenY + halfH }
  ];

  const poly = makePolygon(points, className, fill);
  poly.setAttribute("stroke", stroke);
  poly.setAttribute("stroke-width", String(DIAMOND_STROKE_WIDTH));
  poly.setAttribute("paint-order", "stroke fill");
  poly.setAttribute("stroke-linejoin", "round");
  parent.appendChild(poly);
}

export function drawTopOverlayBox(state, screenX, screenY, fill, stroke, parent) {
  const cellSize = getTopdownCellSize(state);

  const rect = svgEl("rect");
  rect.setAttribute("x", screenX + 2);
  rect.setAttribute("y", screenY + 2);
  rect.setAttribute("width", Math.max(4, cellSize - 4));
  rect.setAttribute("height", Math.max(4, cellSize - 4));
  rect.setAttribute("rx", "6");
  rect.setAttribute("fill", fill);
  rect.setAttribute("stroke", stroke);
  rect.setAttribute("stroke-width", "2.5");
  rect.setAttribute("paint-order", "stroke fill");
  parent.appendChild(rect);
}

function drawTopOverlayBounds(state, bounds, fill, stroke, parent) {
  const size = getTopdownCellSize(state);

  const width = bounds.width * size;
  const height = bounds.height * size;
  const x = bounds.minX * size;
  const y = bounds.minY * size;

  const rect = svgEl("rect");
  rect.setAttribute("x", x + 2);
  rect.setAttribute("y", y + 2);
  rect.setAttribute("width", Math.max(4, width - 4));
  rect.setAttribute("height", Math.max(4, height - 4));
  rect.setAttribute("rx", "8");
  rect.setAttribute("fill", fill);
  rect.setAttribute("stroke", stroke);
  rect.setAttribute("stroke-width", "2.5");
  rect.setAttribute("paint-order", "stroke fill");
  parent.appendChild(rect);
}

function getUnitSupportElevation(state, unit) {
  const centerTile = getUnitCenterTile(unit);
  const tile = getTile(state.map, centerTile.x, centerTile.y);
  if (!tile) return null;

  return getTileFootElevation(tile);
}

function getUnitLabelPoint(state, unit) {
  const bounds = getUnitFootprintBounds(unit);

  if (state.ui.viewMode === "top") {
    const size = getTopdownCellSize(state);

    return {
      x: (bounds.minX * size) + ((bounds.width * size) / 2),
      y: (bounds.minY * size) + ((bounds.height * size) / 2) + 4
    };
  }

  const supportElevation = getUnitSupportElevation(state, unit) ?? 0;
  const centerTile = getUnitCenterTile(unit);

  const center = projectTileCenter(
    state,
    centerTile.x,
    centerTile.y,
    supportElevation + DETAIL_OVERLAY_LIFT
  );

  return {
    x: center.x,
    y: center.y + 6
  };
}

function styleMoveCostLabel(label) {
  label.setAttribute("fill", "#ffffff");
  label.setAttribute("stroke", "rgba(0,0,0,0.72)");
  label.setAttribute("stroke-width", "4");
  label.setAttribute("paint-order", "stroke fill");
  label.setAttribute("font-size", "18");
  label.setAttribute("font-weight", "700");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "middle");
}

function getActiveUnit(state) {
  const activeId = state.turn?.activeUnitId ?? null;
  if (!activeId) return null;

  const units = state.units ?? [];
  return getUnitById(units, activeId);
}

function getUnitAtTile(state, x, y) {
  const occupant = getPrimaryOccupantAt(state, x, y);
  return occupant?.unit ?? null;
}
