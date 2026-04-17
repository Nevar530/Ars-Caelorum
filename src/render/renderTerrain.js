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
  const isPreview = options.preview === true;

  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorCellColor(tile));
  rect.setAttribute("class", isSelected ? "editor-cell editor-cell-selected" : "editor-cell");
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);
  group.appendChild(rect);

  if (isPreview) {
    const preview = svgEl("rect");
    preview.setAttribute("x", px + 1.5);
    preview.setAttribute("y", py + 1.5);
    preview.setAttribute("width", Math.max(0, cellWidth - 3));
    preview.setAttribute("height", Math.max(0, cellHeight - 3));
    preview.setAttribute("class", "editor-brush-preview");
    preview.dataset.x = String(x);
    preview.dataset.y = String(y);
    group.appendChild(preview);
  }

  const showLabel = cellWidth >= 18 && cellHeight >= 18;
  if (showLabel) {
    const label = makeText(
      px + (cellWidth / 2),
      py + (cellHeight / 2),
      String(tile.elevation),
      cellWidth >= 26 ? "editor-detail-text-large" : "editor-text"
    );
    group.appendChild(label);
  }

  if (tile.spawnId) {
    const marker = svgEl("circle");
    marker.setAttribute("cx", px + (cellWidth * 0.18));
    marker.setAttribute("cy", py + (cellHeight * 0.18));
    marker.setAttribute("r", Math.max(5, Math.min(cellWidth, cellHeight) * 0.13));
    marker.setAttribute("class", tile.spawnId.startsWith("enemy_") ? "editor-spawn-marker editor-spawn-marker-enemy" : "editor-spawn-marker editor-spawn-marker-player");
    group.appendChild(marker);

    const spawnLabel = makeText(
      px + (cellWidth * 0.18),
      py + (cellHeight * 0.18),
      String(tile.spawnId).split("_")[1] ?? "",
      "editor-spawn-text"
    );
    group.appendChild(spawnLabel);
  }

  if (tile.movementClass && tile.movementClass !== "clear") {
    const badgeWidth = Math.max(12, cellWidth * 0.28);
    const badgeHeight = Math.max(10, cellHeight * 0.2);
    const badge = svgEl("rect");
    badge.setAttribute("x", px + cellWidth - badgeWidth - 2);
    badge.setAttribute("y", py + 2);
    badge.setAttribute("rx", 3);
    badge.setAttribute("ry", 3);
    badge.setAttribute("width", badgeWidth);
    badge.setAttribute("height", badgeHeight);
    badge.setAttribute("class", `editor-movement-badge editor-movement-badge-${tile.movementClass}`);
    group.appendChild(badge);

    if (cellWidth >= 24) {
      const badgeText = makeText(
        px + cellWidth - (badgeWidth / 2) - 2,
        py + 2 + (badgeHeight / 2),
        movementClassLabel(tile.movementClass),
        "editor-badge-text"
      );
      group.appendChild(badgeText);
    }
  }

  parent.appendChild(group);
}

export function renderEditorMiniTile(tile, x, y, px, py, cellWidth, cellHeight, parent, options = {}) {
  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorCellColor(tile));
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
  const colors = resolveTerrainColors(item, type, fineElevation);

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
  const colors = resolveTerrainColors(item, type, fineElevation);
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


function resolveTerrainColors(tileLike, fallbackType, fineElevation = null) {
  if (fineElevation !== null) {
    return tileColors(fallbackType);
  }

  const top = editorCellColor(tileLike);
  return {
    top,
    left: shiftHexBrightness(top, -28),
    right: shiftHexBrightness(top, -16)
  };
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

export function editorCellColor(tileOrElevation) {
  const tile = typeof tileOrElevation === 'object' && tileOrElevation !== null
    ? tileOrElevation
    : { elevation: Number(tileOrElevation) || 0, terrainTypeId: 'grass', movementClass: 'clear', spawnId: null };

  const baseColor = terrainBaseColor(tile.terrainTypeId);
  const elevation = Number(tile.elevation ?? 0);
  let color = shiftHexBrightness(baseColor, Math.max(-35, Math.min(35, elevation * 8)));

  switch (tile.movementClass) {
    case 'hazard':
      color = mixHex(color, '#b94d2f', 0.45);
      break;
    case 'impassable':
      color = mixHex(color, '#2b2b2b', 0.42);
      break;
    case 'difficult':
      color = mixHex(color, '#8f7d2f', 0.28);
      break;
    default:
      break;
  }

  if (tile.spawnId) color = mixHex(color, tile.spawnId.startsWith('enemy_') ? '#8c2b2b' : '#2b5f9b', 0.25);

  return color;
}

function movementClassLabel(movementClass) {
  switch (movementClass) {
    case 'difficult': return 'D';
    case 'hazard': return 'H';
    case 'impassable': return 'X';
    default: return '';
  }
}

export function editorDetailCellColor(fineElevation) {
  const type = detailTypeFromFineElevation(fineElevation);
  const colors = tileColors(type);
  return colors.top;
}

function terrainBaseColor(terrainTypeId) {
  switch (terrainTypeId) {
    case 'rock': return '#7a7a72';
    case 'sand': return '#c8b27a';
    case 'water': return '#4c7ea8';
    case 'asphalt': return '#4c4f55';
    case 'concrete': return '#9a9a94';
    case 'grass':
    default:
      return '#5f8f4f';
  }
}

function shiftHexBrightness(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(clamp255(r + amount), clamp255(g + amount), clamp255(b + amount));
}

function mixHex(a, b, ratio = 0.5) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    Math.round(ca.r + ((cb.r - ca.r) * t)),
    Math.round(ca.g + ((cb.g - ca.g) * t)),
    Math.round(ca.b + ((cb.b - ca.b) * t))
  );
}

function hexToRgb(hex) {
  const normalized = String(hex).replace('#', '').trim();
  const value = normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized.padStart(6, '0').slice(0, 6);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp255(value).toString(16).padStart(2, '0')).join('')}`;
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
