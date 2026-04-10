// src/render/renderOverlays.js

import { RENDER_CONFIG } from "../config.js";
import {
  getTile,
  getDetailRenderCells,
  getTileRenderElevation,
  getTileSummary,
  isDetailTileUniform
} from "../map.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { TOPDOWN_CONFIG, projectScene } from "./projection.js";

export function drawSceneActionOverlayForTile(state, item, parent) {
  if (state.ui.mode !== "action-target") return;

  const key = `${item.x},${item.y}`;
  const fireArc = tileSetFromList(state.ui.action.fireArcTiles || []);
  const evaluatedTargetTiles = state.ui.action.evaluatedTargetTiles || [];
  const targetMap = new Map(
    evaluatedTargetTiles.map((tile) => [`${tile.x},${tile.y}`, tile])
  );
  const effectTiles = tileSetFromList(state.ui.action.effectTiles || []);

  let fill = null;
  let stroke = null;
  let center = null;

  if (fireArc.has(key)) {
    fill = "rgba(255, 176, 0, 0.035)";
    stroke = "rgba(255, 176, 0, 0.30)";
    center = "rgba(255, 176, 0, 0.90)";
  }

  const evaluatedTarget = targetMap.get(key);
  if (evaluatedTarget) {
    const cover = evaluatedTarget.cover ?? "none";
    const visible = evaluatedTarget.visible ?? evaluatedTarget.los?.visible ?? false;

    if (visible && cover === "none") {
      fill = "rgba(82, 208, 146, 0.085)";
      stroke = "rgba(82, 208, 146, 0.65)";
      center = "rgba(82, 208, 146, 0.95)";
    } else if (visible && cover === "half") {
      fill = "rgba(240, 176, 0, 0.095)";
      stroke = "rgba(240, 176, 0, 0.82)";
      center = "rgba(240, 176, 0, 0.95)";
    } else {
      fill = "rgba(255, 74, 74, 0.095)";
      stroke = "rgba(255, 74, 74, 0.82)";
      center = "rgba(255, 74, 74, 0.95)";
    }
  }

  if (effectTiles.has(key)) {
    fill = "rgba(255, 74, 74, 0.075)";
    stroke = "rgba(255, 74, 74, 0.92)";
    center = "rgba(255, 74, 74, 1)";
  }

  if (!fill || !stroke) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(item.screenX, item.screenY, fill, stroke, parent);
    return;
  }

  drawIsoTileOverlay(state, item, fill, stroke, parent, {
    showCenterMarker: true,
    centerColor: center ?? stroke,
    detailFillMode: "highest"
  });
}

export function drawSceneFocusOverlayForTile(state, item, parent) {
  if (item.x !== state.focus.x || item.y !== state.focus.y) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      item.screenX,
      item.screenY,
      "rgba(240, 176, 0, 0.035)",
      "rgba(240, 176, 0, 0.95)",
      parent
    );
    return;
  }

  drawIsoTileOverlay(
    state,
    item,
    "rgba(240, 176, 0, 0.03)",
    "rgba(240, 176, 0, 0.95)",
    parent,
    {
      showCenterMarker: true,
      centerColor: "rgba(240, 176, 0, 1)",
      detailFillMode: "highest"
    }
  );
}

export function drawScenePathOverlayForTile(state, item, parent) {
  if (state.ui.mode !== "move") return;

  const path = state.ui.previewPath || [];
  if (!path.length) return;

  const step = path.find((p) => p.x === item.x && p.y === item.y);
  if (!step) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      item.screenX,
      item.screenY,
      "rgba(240, 176, 0, 0.08)",
      "rgba(240, 176, 0, 0.90)",
      parent
    );

    if (step.cost !== undefined && step.cost !== null) {
      const label = makeText(
        item.screenX + (TOPDOWN_CONFIG.cellSize / 2),
        item.screenY + (TOPDOWN_CONFIG.cellSize / 2),
        String(step.cost),
        "move-cost-label"
      );
      styleMoveCostLabel(label);
      parent.appendChild(label);
    }

    return;
  }

  drawIsoTileOverlay(
    state,
    item,
    "rgba(240, 176, 0, 0.06)",
    "rgba(240, 176, 0, 0.88)",
    parent,
    {
      showCenterMarker: true,
      centerColor: "rgba(240, 176, 0, 0.98)",
      detailFillMode: "highest"
    }
  );

  if (step.cost !== undefined && step.cost !== null) {
    const label = makeText(
      item.screenX,
      item.screenY + (RENDER_CONFIG.isoTileHeight * 0.62),
      String(step.cost),
      "move-cost-label"
    );
    styleMoveCostLabel(label);
    parent.appendChild(label);
  }
}

export function drawSceneMoveOverlay(state, item, parent, text) {
  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      item.screenX,
      item.screenY,
      "rgba(80, 180, 255, 0.06)",
      "rgba(80, 180, 255, 0.32)",
      parent
    );

    const label = makeText(
      item.screenX + (TOPDOWN_CONFIG.cellSize / 2),
      item.screenY + (TOPDOWN_CONFIG.cellSize / 2),
      text,
      "move-cost-label"
    );
    styleMoveCostLabel(label);
    parent.appendChild(label);
    return;
  }

  drawIsoTileOverlay(
    state,
    item,
    "rgba(80, 180, 255, 0.045)",
    "rgba(80, 180, 255, 0.30)",
    parent,
    {
      showCenterMarker: false,
      detailFillMode: "none"
    }
  );

  const label = makeText(
    item.screenX,
    item.screenY + (RENDER_CONFIG.isoTileHeight * 0.62),
    text,
    "move-cost-label"
  );
  styleMoveCostLabel(label);
  parent.appendChild(label);
}

export function tileSetFromList(tiles) {
  const set = new Set();
  for (const tile of tiles) {
    set.add(`${tile.x},${tile.y}`);
  }
  return set;
}

function drawIsoTileOverlay(state, item, fill, stroke, parent, options = {}) {
  const tile = getTile(state.map, item.x, item.y);
  if (!tile) return;

  if (isDetailTileUniform(tile)) {
    drawOverlayDiamond(item.screenX, item.screenY, "tile-overlay", fill, stroke, parent);

    if (options.showCenterMarker) {
      drawCenterMarker(
        item.screenX,
        item.screenY + (RENDER_CONFIG.isoTileHeight / 2),
        options.centerColor ?? stroke,
        parent
      );
    }

    return;
  }

  const detailFillMode = options.detailFillMode ?? "highest";
  const detailCells = getDetailRenderCells(state.map, item.x, item.y);
  const summary = getTileSummary(tile);
  const highestFineElevation = summary?.maxFineElevation ?? null;

  if (detailFillMode !== "none" && highestFineElevation !== null) {
    const targetCells = detailCells.filter(
      (cell) => cell.fineElevation === highestFineElevation
    );

    for (const cell of targetCells) {
      const projected = projectScene(state, cell.x, cell.y, cell.elevation);
      drawOverlayCellTop(projected.x, projected.y, cell.size, fill, parent);
    }
  }

  if (options.showCenterMarker) {
    const centerProjected = projectScene(
      state,
      item.x,
      item.y,
      getTileRenderElevation(tile)
    );

    drawCenterMarker(
      centerProjected.x,
      centerProjected.y + (RENDER_CONFIG.isoTileHeight / 2),
      options.centerColor ?? stroke,
      parent
    );
  }

  drawOverlayDiamond(
    item.screenX,
    item.screenY,
    "tile-overlay-outline",
    "none",
    stroke,
    parent,
    1.4
  );
}

function drawOverlayCellTop(screenX, screenY, size, fill, parent) {
  const halfW = (RENDER_CONFIG.isoTileWidth * size) / 2;
  const halfH = (RENDER_CONFIG.isoTileHeight * size) / 2;

  const points = [
    { x: screenX, y: screenY },
    { x: screenX + halfW, y: screenY + halfH },
    { x: screenX, y: screenY + (halfH * 2) },
    { x: screenX - halfW, y: screenY + halfH }
  ];

  const poly = makePolygon(points, "tile-overlay-cell", fill);
  poly.setAttribute("stroke", "none");
  parent.appendChild(poly);
}

export function drawOverlayDiamond(
  screenX,
  screenY,
  className,
  fill,
  stroke,
  parent,
  strokeWidth = 1.5
) {
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
  poly.setAttribute("stroke-width", String(strokeWidth));
  parent.appendChild(poly);
}

function drawCenterMarker(screenX, screenY, color, parent) {
  const outer = svgEl("circle");
  outer.setAttribute("cx", screenX);
  outer.setAttribute("cy", screenY);
  outer.setAttribute("r", "8");
  outer.setAttribute("fill", "none");
  outer.setAttribute("stroke", color);
  outer.setAttribute("stroke-width", "1.6");
  outer.setAttribute("opacity", "0.95");

  const inner = svgEl("circle");
  inner.setAttribute("cx", screenX);
  inner.setAttribute("cy", screenY);
  inner.setAttribute("r", "2.4");
  inner.setAttribute("fill", color);
  inner.setAttribute("stroke", "rgba(0,0,0,0.55)");
  inner.setAttribute("stroke-width", "0.8");

  parent.appendChild(outer);
  parent.appendChild(inner);
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
  rect.setAttribute("stroke-width", "1.5");
  parent.appendChild(rect);
}

export function styleMoveCostLabel(label) {
  label.setAttribute("fill", "#dceeff");
  label.setAttribute("font-size", "13");
  label.setAttribute("font-weight", "700");
  label.setAttribute("stroke", "rgba(0,0,0,0.65)");
  label.setAttribute("stroke-width", "3");
  label.setAttribute("paint-order", "stroke fill");
}
