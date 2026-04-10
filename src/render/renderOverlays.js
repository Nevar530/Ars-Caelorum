// src/render/renderOverlays.js

import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { TOPDOWN_CONFIG } from "./projection.js";

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

  if (fireArc.has(key)) {
    fill = "rgba(255, 176, 0, 0.05)";
    stroke = "rgba(255, 176, 0, 0.18)";
  }

  const evaluatedTarget = targetMap.get(key);
  if (evaluatedTarget) {
    const cover = evaluatedTarget.cover ?? "none";
    const visible = evaluatedTarget.visible ?? evaluatedTarget.los?.visible ?? false;

    if (visible && cover === "none") {
      fill = "rgba(82, 208, 146, 0.12)";
      stroke = "rgba(82, 208, 146, 0.60)";
    } else if (visible && cover === "half") {
      fill = "rgba(240, 176, 0, 0.14)";
      stroke = "rgba(240, 176, 0, 0.75)";
    } else {
      fill = "rgba(255, 74, 74, 0.14)";
      stroke = "rgba(255, 74, 74, 0.72)";
    }
  }

  if (effectTiles.has(key)) {
    fill = "rgba(255, 74, 74, 0.14)";
    stroke = "rgba(255, 74, 74, 0.82)";
  }

  if (!fill || !stroke) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(item.screenX, item.screenY, fill, stroke, parent);
    return;
  }

  drawOverlayDiamond(item.screenX, item.screenY, "action-preview-tile", fill, stroke, parent);
}

export function drawSceneFocusOverlayForTile(state, item, parent) {
  if (item.x !== state.focus.x || item.y !== state.focus.y) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      item.screenX,
      item.screenY,
      "rgba(240, 176, 0, 0.04)",
      "rgba(240, 176, 0, 0.95)",
      parent
    );
    return;
  }

  drawOverlayDiamond(
    item.screenX,
    item.screenY,
    "focus-tile",
    "rgba(240, 176, 0, 0.04)",
    "rgba(240, 176, 0, 0.95)",
    parent
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
      "rgba(240, 176, 0, 0.10)",
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

  drawOverlayDiamond(
    item.screenX,
    item.screenY,
    "move-path-tile",
    "rgba(240, 176, 0, 0.10)",
    "rgba(240, 176, 0, 0.85)",
    parent
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
      "rgba(80, 180, 255, 0.10)",
      "rgba(80, 180, 255, 0.35)",
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

  drawOverlayDiamond(
    item.screenX,
    item.screenY,
    "move-range-tile",
    "rgba(80, 180, 255, 0.10)",
    "rgba(80, 180, 255, 0.35)",
    parent
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
  poly.setAttribute("stroke-width", "1.5");
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
