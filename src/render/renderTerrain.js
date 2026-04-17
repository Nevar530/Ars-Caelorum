// src/render/renderTerrain.js

import { GAME_CONFIG, RENDER_CONFIG } from "../config.js";
import {
  tileTypeFromElevation,
  detailTypeFromFineElevation,
  formatDetailElevation
} from "../map.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { getTopdownCellSize } from "./projection.js";

export function renderTerrainTile(state, item, parent) {
  if (state.ui.viewMode === "top") {
    drawTopTerrainCell(state, item, parent);
    return;
  }

  drawIsoTerrainCell(item, parent);
}

export function renderEditorTile(tile, x, y, px, py, cellWidth, cellHeight, parent, options = {}) {
  const group = svgEl("g");
  const isSelected = options.selected === true;

  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorCellColor(tile.elevation));
  rect.setAttribute("class", isSelected ? "editor-cell editor-cell-selected" : "editor-cell");
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);

  const label = makeText(
    px + (cellWidth / 2),
    py + (cellHeight / 2),
    String(tile.elevation),
    "editor-text"
  );

  group.appendChild(rect);
  group.appendChild(label);
  parent.appendChild(group);
}

export function renderEditorMiniTile(tile, x, y, px, py, cellWidth, cellHeight, parent, options = {}) {
  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorCellColor(tile.elevation));
  rect.setAttribute(
    "class",
    options.selected ? "editor-cell-mini editor-cell-mini-selected" : "editor-cell-mini"
  );
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);
  parent.appendChild(rect);
}

export function renderEditorDetailCell(
  detailCell,
  mechX,
  mechY,
  subX,
  subY,
  px,
  py,
  cellWidth,
  cellHeight,
  parent,
  options = {}
) {
  const group = svgEl("g");

  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorDetailCellColor(detailCell.elevation));
  rect.setAttribute(
    "class",
    options.large ? "editor-cell-detail editor-cell-detail-large" : "editor-cell-detail"
  );
  rect.dataset.mx = String(mechX);
  rect.dataset.my = String(mechY);
  rect.dataset.sx = String(subX);
  rect.dataset.sy = String(subY);

  group.appendChild(rect);

  const showLabel = options.large ? cellWidth >= 28 : cellWidth >= 10;

  if (showLabel) {
    const label = makeText(
      px + (cellWidth / 2),
      py + (cellHeight / 2),
      formatDetailElevation(detailCell.elevation),
      options.large ? "editor-detail-text-large" : "editor-text"
    );
    group.appendChild(label);
  }

  parent.appendChild(group);
}

function drawIsoTerrainCell(item, parent) {
  const {
    x,
    y,
    elevation,
    size = 1,
    screenX,
    screenY,
    leftFaceHeight = elevation,
    rightFaceHeight = elevation,
    fineElevation = null
  } = item;

  const type = fineElevation === null
    ? tileTypeFromElevation(elevation)
    : detailTypeFromFineElevation(fineElevation);
  const colors = tileColors(type);

  const halfW = (RENDER_CONFIG.isoTileWidth * size) / 2;
  const halfH = (RENDER_CONFIG.isoTileHeight * size) / 2;
  const leftHeightPx = leftFaceHeight * RENDER_CONFIG.elevationStepPx;
  const rightHeightPx = rightFaceHeight * RENDER_CONFIG.elevationStepPx;

  const top = {
    top: { x: screenX, y: screenY },
    right: { x: screenX + halfW, y: screenY + halfH },
    bottom: { x: screenX, y: screenY + (halfH * 2) },
    left: { x: screenX - halfW, y: screenY + halfH }
  };

  const group = svgEl("g");
  group.dataset.x = String(x);
  group.dataset.y = String(y);

  if (leftHeightPx > 0) {
    const leftFace = [
      top.left,
      top.bottom,
      { x: top.bottom.x, y: top.bottom.y + leftHeightPx },
      { x: top.left.x, y: top.left.y + leftHeightPx }
    ];

    group.appendChild(makePolygon(leftFace, "tile-left", colors.left));
  }

  if (rightHeightPx > 0) {
    const rightFace = [
      top.right,
      top.bottom,
      { x: top.bottom.x, y: top.bottom.y + rightHeightPx },
      { x: top.right.x, y: top.right.y + rightHeightPx }
    ];

    group.appendChild(makePolygon(rightFace, "tile-right", colors.right));
  }

  const topFace = [top.top, top.right, top.bottom, top.left];
  group.appendChild(makePolygon(topFace, "tile-top", colors.top));
  group.appendChild(makePolygon(topFace, "tile-outline", "none"));

  parent.appendChild(group);
}

function drawTopTerrainCell(state, item, parent) {
  const {
    x,
    y,
    elevation,
    screenX,
    screenY,
    size = 1,
    fineElevation = null
  } = item;

  const type = fineElevation === null
    ? tileTypeFromElevation(elevation)
    : detailTypeFromFineElevation(fineElevation);
  const colors = tileColors(type);
  const cellSize = getTopdownCellSize(state);
  const sizePx = cellSize * size;

  const rect = svgEl("rect");
  rect.setAttribute("x", screenX);
  rect.setAttribute("y", screenY);
  rect.setAttribute("width", sizePx);
  rect.setAttribute("height", sizePx);
  rect.setAttribute("fill", colors.top);
  rect.setAttribute("stroke", "rgba(255,255,255,0.08)");
  rect.setAttribute("stroke-width", size < 1 ? "0.5" : "1");
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);

  parent.appendChild(rect);

  if (size >= 1 && elevation > 0) {
    const label = makeText(
      screenX + sizePx - 6,
      screenY + 13,
      Number.isInteger(elevation) ? String(elevation) : elevation.toFixed(2).replace(/\.?0+$/, ""),
      "top-elevation-label"
    );
    label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "rgba(255,255,255,0.9)");
    label.setAttribute("font-size", "12");
    parent.appendChild(label);
  }
}

export function tileColors(type) {
  switch (type) {
    case "peak":
      return {
        top: "#a08f72",
        left: "#6d5f49",
        right: "#85755c"
      };
    case "high":
      return {
        top: "#6f8b5e",
        left: "#506546",
        right: "#5e7751"
      };
    default:
      return {
        top: "#4e6b86",
        left: "#34495d",
        right: "#3e566d"
      };
  }
}

export function editorCellColor(elevation) {
  if (elevation >= 5) return "#d97706";
  if (elevation >= 4) return "#b45309";
  if (elevation >= 3) return "#8b6b4a";
  if (elevation >= 2) return "#5e7751";
  if (elevation >= 1) return "#4e6b86";
  return "#243241";
}

export function editorDetailCellColor(fineElevation) {
  const type = detailTypeFromFineElevation(fineElevation);

  switch (type) {
    case "peak":
      return "#8b6b4a";
    case "high":
      return "#4e6b86";
    default:
      return "#243241";
  }
}
