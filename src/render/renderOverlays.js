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
import { TOPDOWN_CONFIG, projectScene, projectTileCenter } from "./projection.js";
import {
  getUnitFootprintBounds,
  getUnitCenterTile,
  getUnitOccupiedCells
} from "../scale/scaleMath.js";
import {
  getPrimaryOccupantAt
} from "../scale/occupancy.js";

const DETAIL_OVERLAY_LIFT = 0.02;
const DETAIL_STROKE_WIDTH = 2;
const DIAMOND_STROKE_WIDTH = 2.5;
const OVERLAY_SORT_EPSILON = 0.05;

const DEFAULT_DRAW_OPTIONS = {
  drawShapes: true,
  drawLabels: true
};

export function buildTerrainOverlaySceneItemsForTile(state, item) {
  const sceneItems = [];
  let overlayOrder = 0;

  if (state.ui.mode === "move" && item.reachableData) {
    sceneItems.push(
      makeOverlaySceneItem(item, overlayOrder += 1, (parent) => {
        drawSceneMoveOverlay(state, item, parent, String(item.reachableCost ?? ""), {
          drawShapes: true,
          drawLabels: false
        });
      })
    );
  }

  sceneItems.push(
    makeOverlaySceneItem(item, overlayOrder += 1, (parent) => {
      drawScenePathOverlayForTile(state, item, parent, {
        drawShapes: true,
        drawLabels: false
      });
    })
  );

  sceneItems.push(
    makeOverlaySceneItem(item, overlayOrder += 1, (parent) => {
      drawSceneActionOverlayForTile(state, item, parent, {
        drawShapes: true,
        drawLabels: false
      });
    })
  );

  sceneItems.push(
    makeOverlaySceneItem(item, overlayOrder += 1, (parent) => {
      drawSceneFocusOverlayForTile(state, item, parent, {
        drawShapes: true,
        drawLabels: false
      });
    })
  );

  return sceneItems;
}

export function drawSceneUnitFootprintOverlays(state, parent) {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return;

  if (state.ui.mode !== "move" && state.ui.mode !== "face") {
    drawOverlayForUnitFootprint(
      state,
      activeUnit,
      "active-unit-footprint",
      "rgba(255, 255, 255, 0.06)",
      "rgba(255, 255, 255, 0.7)",
      parent
    );
  }

  const focusX = state.focus?.x;
  const focusY = state.focus?.y;

  if (typeof focusX !== "number" || typeof focusY !== "number") {
    return;
  }

  if (state.ui.mode === "move") {
    const previewUnit = { ...activeUnit, x: focusX, y: focusY };
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

  const occupantUnit = getUnitAtTile(state, focusX, focusY);
  if (!occupantUnit) return;

  if (state.ui.mode === "action-target") {
    const colors = getActionOverlayColorsForTile(state, focusX, focusY);
    if (!colors) return;

    drawOverlayForUnitFootprint(
      state,
      occupantUnit,
      "action-preview-unit",
      colors.fill,
      colors.stroke,
      parent
    );
    return;
  }

  drawOverlayForUnitFootprint(
    state,
    occupantUnit,
    "focus-unit",
    "rgba(240, 176, 0, 0.16)",
    "rgba(240, 176, 0, 1)",
    parent
  );
}

function makeOverlaySceneItem(item, overlayOrder, render) {
  return {
    kind: "terrain_overlay",
    sortDepth: item.sortDepth + OVERLAY_SORT_EPSILON,
    sortKey: (item.sortKey * 100) + overlayOrder,
    render
  };
}

export function drawSceneActionOverlayForTile(state, item, parent, options = DEFAULT_DRAW_OPTIONS) {
  const { drawShapes } = normalizeOptions(options);

  if (state.ui.mode !== "action-target") return;
  if (!drawShapes) return;

  const colors = getActionOverlayColorsForTile(state, item.x, item.y);
  if (!colors) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(item.screenX, item.screenY, colors.fill, colors.stroke, parent);
    return;
  }

  drawOverlayForTile(state, item, "action-preview-tile", colors.fill, colors.stroke, parent);
}

export function drawSceneFocusOverlayForTile(state, item, parent, options = DEFAULT_DRAW_OPTIONS) {
  const { drawShapes } = normalizeOptions(options);

  if (item.x !== state.focus.x || item.y !== state.focus.y) return;
  if (!drawShapes) return;

  if (state.ui.mode === "move") return;

  const occupantUnit = getUnitAtTile(state, item.x, item.y);
  if (occupantUnit) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
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

  if (drawShapes) {
    if (state.ui.viewMode === "top") {
      drawTopOverlayBox(
        item.screenX,
        item.screenY,
        "rgba(240, 176, 0, 0.24)",
        "rgba(240, 176, 0, 1)",
        parent
      );
    } else {
      drawOverlayForTile(
        state,
        item,
        "move-path-tile",
        "rgba(240, 176, 0, 0.24)",
        "rgba(240, 176, 0, 1)",
        parent
      );
    }
  }

  if (drawLabels) {
    const labelPoint = getTileLabelPoint(item);
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

  if (!item.reachableData) return;

  if (drawShapes) {
    if (state.ui.viewMode === "top") {
      drawTopOverlayBox(
        item.screenX,
        item.screenY,
        "rgba(80, 180, 255, 0.24)",
        "rgba(80, 180, 255, 0.92)",
        parent
      );
    } else {
      drawOverlayForTile(
        state,
        item,
        "move-range-tile",
        "rgba(80, 180, 255, 0.24)",
        "rgba(80, 180, 255, 0.92)",
        parent
      );
    }
  }

  if (drawLabels) {
    const labelPoint = getTileLabelPoint(item);
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

function getActionOverlayColorsForTile(state, x, y) {
  const key = `${x},${y}`;
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

  if (!fill || !stroke) return null;
  return { fill, stroke };
}

function drawOverlayForUnitFootprint(state, unit, className, fill, stroke, parent) {
  const bounds = getUnitFootprintBounds(unit);

  if (state.ui.viewMode === "top") {
    drawTopOverlayBounds(bounds, fill, stroke, parent);
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
    { x: center.x, y: center.y - halfH },
    { x: center.x + halfW, y: center.y },
    { x: center.x, y: center.y + halfH },
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

function getTileLabelPoint(item) {
  return {
    x: item.screenX,
    y: item.screenY + (RENDER_CONFIG.isoTileHeight / 2) + 6
  };
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

export function drawTopOverlayBox(screenX, screenY, fill, stroke, parent) {
  const rect = svgEl("rect");
  rect.setAttribute("x", screenX + 3);
  rect.setAttribute("y", screenY + 3);
  rect.setAttribute("width", TOPDOWN_CONFIG.cellSize - 6);
  rect.setAttribute("height", TOPDOWN_CONFIG.cellSize - 6);
  rect.setAttribute("rx", "8");
  rect.setAttribute("fill", fill);
  rect.setAttribute("stroke", stroke);
  rect.setAttribute("stroke-width", "2.5");
  rect.setAttribute("paint-order", "stroke fill");
  parent.appendChild(rect);
}

function drawTopOverlayBounds(bounds, fill, stroke, parent) {
  const size = TOPDOWN_CONFIG.cellSize;

  const width = bounds.width * size;
  const height = bounds.height * size;
  const x = bounds.minX * size;
  const y = bounds.minY * size;

  const rect = svgEl("rect");
  rect.setAttribute("x", x + 2);
  rect.setAttribute("y", y + 2);
  rect.setAttribute("width", Math.max(4, width - 4));
  rect.setAttribute("height", Math.max(4, height - 4));
  rect.setAttribute("rx", "10");
  rect.setAttribute("fill", fill);
  rect.setAttribute("stroke", stroke);
  rect.setAttribute("stroke-width", "2.5");
  rect.setAttribute("paint-order", "stroke fill");
  parent.appendChild(rect);
}

function getUnitSupportElevation(state, unit) {
  const occupiedCells = getUnitOccupiedCells(unit);
  let maxElevation = null;

  for (const cell of occupiedCells) {
    const tile = getTile(state.map, cell.x, cell.y);
    if (!tile) return null;

    const elevation = getTileFootElevation(tile);
    if (maxElevation === null || elevation > maxElevation) {
      maxElevation = elevation;
    }
  }

  return maxElevation;
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
  const activeId = state.turn?.activeUnitId ?? state.turn?.activeMechId ?? null;
  if (!activeId) return null;

  const units = state.units ?? state.mechs ?? [];
  return getUnitById(units, activeId);
}

function getUnitAtTile(state, x, y) {
  const occupant = getPrimaryOccupantAt(state, x, y);
  return occupant?.unit ?? null;
}
