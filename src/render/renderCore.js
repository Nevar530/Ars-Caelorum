// src/render/renderCore.js

import { RENDER_CONFIG } from "../config.js";
import {
  getMapHeight,
  getMapWidth,
  getTile
} from "../map.js";
import { getUnitById } from "../mechs.js";
import { getReachableTiles } from "../movement.js";
import { getUnitOccupiedCells } from "../scale/scaleMath.js";
import { svgEl, makeText } from "../utils.js";
import { renderEditorTile } from "./renderTerrain.js";
import { drawIsoStatusPlate } from "./renderUnits.js";
import {
  drawSceneMoveOverlay,
  drawScenePathOverlayForTile,
  drawSceneActionOverlayForTile,
  drawSceneDeploymentOverlayForTile,
  drawSceneFocusOverlayForTile,
  drawSceneActiveUnitOverlay
} from "./renderOverlays.js";
import {
  ensureCameraState,
  updateCameraFraming
} from "./projection.js";
import { drawSceneLosPreview } from "./renderLosOverlay.js";
import { buildTerrainSceneItems, buildUnitSceneItems } from "./renderSceneBuilders.js";
import { buildTileOverlayStyleMap } from "./renderTileStyles.js";
import { compareSceneItems } from "./renderSceneMath.js";

export function renderAll(state, refs) {
  ensureCameraState(state);
  updateCameraFraming(state, refs);
  renderIso(state, refs);
  renderEditor(state, refs);
  renderEditorUi(state, refs);
}

export function renderIso(state, refs) {
  const { worldScene, worldUi } = refs;
  const { map } = state;

  worldScene.innerHTML = "";
  worldUi.innerHTML = "";

  const reachableMap = new Map();

  if (state.ui.mode === "move") {
    for (const tile of getReachableTiles(state)) {
      reachableMap.set(`${tile.x},${tile.y}`, tile);
    }
  }

  const tileOverlayStyleMap = buildTileOverlayStyleMap(state, reachableMap);
  const { terrainSceneItems, overlayTileItems } = buildTerrainSceneItems(state, reachableMap, tileOverlayStyleMap);
  const { unitSceneItems, unitStatusTagItems } = buildUnitSceneItems(state);

  const mainSceneItems = [...terrainSceneItems, ...unitSceneItems];
  mainSceneItems.sort(compareSceneItems);

  for (const item of mainSceneItems) {
    item.render(worldScene);
  }

  for (const item of overlayTileItems) {
    if (state.ui.mode === "move" && item.reachableCost !== null) {
      drawSceneMoveOverlay(state, item, worldScene, String(item.reachableCost), {
        drawShapes: true,
        drawLabels: false
      });
    }

    drawScenePathOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });

    drawSceneActionOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });

    drawSceneDeploymentOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });

    drawSceneFocusOverlayForTile(state, item, worldScene, {
      drawShapes: true,
      drawLabels: false
    });
  }

  drawSceneActiveUnitOverlay(state, worldUi);
  drawSceneLosPreview(state, worldUi);

  for (const item of unitStatusTagItems) {
    drawIsoStatusPlate(worldUi, item.unit, item.x, item.y);
  }
}

export function renderEditor(state, refs) {
  const { editor } = refs;
  const { map } = state;

  if (!editor) return;

  editor.innerHTML = "";
  editor.setAttribute("viewBox", `0 0 ${RENDER_CONFIG.editorSize} ${RENDER_CONFIG.editorSize}`);

  const mapWidth = Math.max(1, getMapWidth(map));
  const mapHeight = Math.max(1, getMapHeight(map));
  const layout = buildEditorLayout(state, mapWidth, mapHeight);

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      const isSelected =
        x === state.ui.editor.selectedTile.x &&
        y === state.ui.editor.selectedTile.y;

      const hoverTiles = state.ui?.mapEditor?.hoverTiles ?? [];
      const isPreview = hoverTiles.some((coord) => coord.x === x && coord.y === y);
      const cellRect = getEditorCellRect(layout, x, y);

      renderEditorTile(
        tile,
        x,
        y,
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
        editor,
        { selected: isSelected, preview: isPreview }
      );
    }
  }

  renderEditorDeploymentMarkers(state, editor, layout);
  renderEditorUnitMarkers(state, editor, layout);
  renderEditorFocusMarker(state, editor, layout);
}

function renderEditorUi(state, refs) {
  if (!refs.editorModeLabel) return;

  const editorState = state.ui?.mapEditor ?? {};
  const hoverCount = Array.isArray(editorState.hoverTiles) ? editorState.hoverTiles.length : 0;
  refs.editorModeLabel.textContent =
    `Map Editor · Rot ${((state.rotation ?? 0) * 90) % 360}° · Tile ${state.ui.editor.selectedTile.x},${state.ui.editor.selectedTile.y} · Brush ${editorState.brushSize ?? 1}x${editorState.brushSize ?? 1} · Preview ${hoverCount}`;
}

function buildEditorLayout(state, mapWidth, mapHeight) {
  const pad = RENDER_CONFIG.editorPadding;
  const full = RENDER_CONFIG.editorSize;
  const inner = full - (pad * 2);
  const rotation = normalizeRotation(state.rotation ?? 0);
  const rotatedWidth = rotation % 2 === 0 ? mapWidth : mapHeight;
  const rotatedHeight = rotation % 2 === 0 ? mapHeight : mapWidth;
  const cellSize = inner / Math.max(rotatedWidth, rotatedHeight, 1);
  const boardPixelWidth = rotatedWidth * cellSize;
  const boardPixelHeight = rotatedHeight * cellSize;

  return {
    mapWidth,
    mapHeight,
    rotation,
    cellSize,
    originX: pad + ((inner - boardPixelWidth) / 2),
    originY: pad + ((inner - boardPixelHeight) / 2)
  };
}

function getEditorCellRect(layout, x, y) {
  const rotated = rotateEditorCell(x, y, layout.mapWidth, layout.mapHeight, layout.rotation);
  return {
    x: layout.originX + (rotated.x * layout.cellSize),
    y: layout.originY + (rotated.y * layout.cellSize),
    width: layout.cellSize,
    height: layout.cellSize
  };
}


function renderEditorDeploymentMarkers(state, parent, layout) {
  const cells = Array.isArray(state.map?.startState?.deploymentCells) ? state.map.startState.deploymentCells : [];
  for (const cell of cells) {
    const rect = getEditorCellRect(layout, Number(cell.x), Number(cell.y));
    const marker = svgEl("rect");
    marker.setAttribute("x", String(rect.x + (layout.cellSize * 0.24)));
    marker.setAttribute("y", String(rect.y + (layout.cellSize * 0.24)));
    marker.setAttribute("width", String(Math.max(0, rect.width - (layout.cellSize * 0.48))));
    marker.setAttribute("height", String(Math.max(0, rect.height - (layout.cellSize * 0.48))));
    marker.setAttribute("fill", "rgba(0,224,255,0.18)");
    marker.setAttribute("stroke", "rgba(0,224,255,0.9)");
    marker.setAttribute("stroke-width", "2");
    marker.setAttribute("pointer-events", "none");
    parent.appendChild(marker);
  }
}

function renderEditorUnitMarkers(state, parent, layout) {
  const units = Array.isArray(state.units) ? state.units : [];
  const activeUnit = getUnitById(units, state.turn?.activeUnitId ?? null);
  const selectedUnit = getUnitById(units, state.selection?.unitId ?? null);

  for (const unit of units) {
    const occupied = getUnitOccupiedCells(unit);
    if (!occupied.length) continue;

    const rects = occupied.map((cell) => getEditorCellRect(layout, cell.x, cell.y));
    const minX = Math.min(...rects.map((rect) => rect.x));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const isActive = activeUnit?.instanceId === unit.instanceId;
    const isSelected = selectedUnit?.instanceId === unit.instanceId;
    const teamColor = unit.team === "enemy" ? "rgba(193,82,82,0.22)" : "rgba(72,126,212,0.22)";
    const strokeColor = isActive ? "#ffd65a" : isSelected ? "#f5f7ff" : (unit.team === "enemy" ? "#d86c6c" : "#70a7ff");

    const outline = svgEl("rect");
    outline.setAttribute("x", String(minX + 1.5));
    outline.setAttribute("y", String(minY + 1.5));
    outline.setAttribute("width", String(Math.max(0, (maxX - minX) - 3)));
    outline.setAttribute("height", String(Math.max(0, (maxY - minY) - 3)));
    outline.setAttribute("rx", String(Math.max(3, layout.cellSize * 0.08)));
    outline.setAttribute("ry", String(Math.max(3, layout.cellSize * 0.08)));
    outline.setAttribute("fill", teamColor);
    outline.setAttribute("stroke", strokeColor);
    outline.setAttribute("stroke-width", String(isActive ? 3 : isSelected ? 2.5 : 2));
    if (isSelected && !isActive) {
      outline.setAttribute("stroke-dasharray", "6 4");
    }
    outline.setAttribute("pointer-events", "none");
    parent.appendChild(outline);

    const marker = svgEl("circle");
    marker.setAttribute("cx", String(centerX));
    marker.setAttribute("cy", String(centerY));
    marker.setAttribute("r", String(Math.max(6, layout.cellSize * 0.16)));
    marker.setAttribute("fill", unit.unitType === "pilot" ? "rgba(246,246,246,0.92)" : strokeColor);
    marker.setAttribute("stroke", unit.unitType === "pilot" ? strokeColor : "rgba(0,0,0,0.35)");
    marker.setAttribute("stroke-width", "1.5");
    marker.setAttribute("pointer-events", "none");
    parent.appendChild(marker);

    const badge = makeText(
      centerX,
      centerY,
      unit.unitType === "pilot" ? "P" : "M",
      layout.cellSize >= 18 ? "editor-detail-text-large" : "editor-text"
    );
    badge.setAttribute("fill", unit.unitType === "pilot" ? strokeColor : "#0d1017");
    badge.setAttribute("pointer-events", "none");
    parent.appendChild(badge);
  }
}

function renderEditorFocusMarker(state, parent, layout) {
  const { x, y } = state.focus ?? { x: 0, y: 0 };
  const rect = getEditorCellRect(layout, Number(x), Number(y));
  const marker = svgEl("rect");
  marker.setAttribute("x", String(rect.x + (layout.cellSize * 0.18)));
  marker.setAttribute("y", String(rect.y + (layout.cellSize * 0.18)));
  marker.setAttribute("width", String(Math.max(0, rect.width - (layout.cellSize * 0.36))));
  marker.setAttribute("height", String(Math.max(0, rect.height - (layout.cellSize * 0.36))));
  marker.setAttribute("fill", "none");
  marker.setAttribute("stroke", "rgba(255, 214, 90, 0.95)");
  marker.setAttribute("stroke-width", "2");
  marker.setAttribute("stroke-dasharray", "4 3");
  marker.setAttribute("pointer-events", "none");
  parent.appendChild(marker);
}

function rotateEditorCell(x, y, mapWidth, mapHeight, rotation) {
  const rot = normalizeRotation(rotation);

  switch (rot) {
    case 1:
      return { x: mapHeight - 1 - y, y: x };
    case 2:
      return { x: mapWidth - 1 - x, y: mapHeight - 1 - y };
    case 3:
      return { x: y, y: mapWidth - 1 - x };
    case 0:
    default:
      return { x, y };
  }
}

function normalizeRotation(value) {
  const n = Number.isFinite(value) ? value : 0;
  return ((n % 4) + 4) % 4;
}
