// src/render/renderCore.js

import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import {
  getTile,
  getDetailGrid,
  getDetailRenderCells,
  isDetailTileUniform,
  getTileRenderElevation,
  getTileSummary,
  formatDetailElevation
} from "../map.js";
import { getReachableTiles } from "../movement.js";
import {
  renderTerrainTile,
  renderEditorTile,
  renderEditorMiniTile,
  renderEditorDetailCell
} from "./renderTerrain.js";
import { drawMech } from "./renderUnits.js";
import {
  drawSceneMoveOverlay,
  drawScenePathOverlayForTile,
  drawSceneActionOverlayForTile,
  drawSceneFocusOverlayForTile
} from "./renderOverlays.js";
import {
  ensureCameraState,
  updateCameraFraming,
  projectScene,
  getSceneSortKey
} from "./projection.js";
import { drawSceneLosPreview } from "./renderLosOverlay.js";
import { makeText } from "../utils.js";

export function renderAll(state, refs) {
  ensureCameraState(state);
  updateCameraFraming(state, refs);
  renderIso(state, refs);
  renderEditor(state, refs);
  renderEditorUi(state, refs);
}

export function renderIso(state, refs) {
  const { worldScene, worldUi } = refs;
  const { map, mechs } = state;

  worldScene.innerHTML = "";
  worldUi.innerHTML = "";

  const terrainItems = [];
  const mechItems = [];
  const overlayTileItems = [];
  const reachableMap = new Map();

  if (state.ui.mode === "move") {
    for (const tile of getReachableTiles(state)) {
      reachableMap.set(`${tile.x},${tile.y}`, tile.cost);
    }
  }

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      const renderElevation = getTileRenderElevation(tile);
      const projected = projectScene(state, x, y, renderElevation);
      const hasDetailGeometry = !isDetailTileUniform(tile);
      const parentSort = getSceneSortKey(state, x, y, renderElevation);

      const tileItem = {
        kind: "tile",
        x,
        y,
        elevation: renderElevation,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: parentSort,
        reachableCost: reachableMap.get(`${x},${y}`) ?? null,
        skipTerrain: hasDetailGeometry,
        size: 1
      };

      terrainItems.push(tileItem);
      overlayTileItems.push(tileItem);

      if (!hasDetailGeometry) continue;

      const detailCells = getDetailRenderCells(map, x, y);

      for (const cell of detailCells) {
        const cellProjected = projectScene(
          state,
          cell.x,
          cell.y,
          cell.elevation,
          cell.size
        );
        const cellSort = getSceneSortKey(
          state,
          cell.x,
          cell.y,
          cell.elevation,
          cell.size
        );

        terrainItems.push({
          kind: "detail",
          x: cell.x,
          y: cell.y,
          elevation: cell.elevation,
          fineElevation: cell.fineElevation,
          size: cell.size,
          leftFaceHeight: cell.leftFaceHeight,
          rightFaceHeight: cell.rightFaceHeight,
          screenX: cellProjected.x,
          screenY: cellProjected.y,
          sortKey: cellSort
        });
      }
    }
  }

  for (const mech of mechs) {
    const tile = getTile(map, mech.x, mech.y);
    if (!tile) continue;

    const tileElevation = getTileRenderElevation(tile);
    const projected = projectScene(state, mech.x, mech.y, tileElevation);
    const parentSort = getSceneSortKey(state, mech.x, mech.y, tileElevation);

    mechItems.push({
      kind: "mech",
      mech,
      elevation: tileElevation,
      screenX: projected.x,
      screenY: projected.y,
      sortKey: parentSort + 0.92
    });
  }

  terrainItems.sort(compareTerrainItems);
  mechItems.sort((a, b) => a.sortKey - b.sortKey);

  for (const item of terrainItems) {
    if (item.kind === "tile" && item.skipTerrain) continue;
    renderTerrainTile(state, item, worldScene);
  }

  for (const item of mechItems) {
    const isActive = item.mech.instanceId === state.turn.activeMechId;
    drawMech(state, item.mech, item.screenX, item.screenY, worldScene, isActive);
  }

  for (const item of overlayTileItems) {
    if (state.ui.mode === "move" && item.reachableCost !== null) {
      drawSceneMoveOverlay(state, item, worldUi, String(item.reachableCost));
    }

    drawScenePathOverlayForTile(state, item, worldUi);
    drawSceneActionOverlayForTile(state, item, worldUi);
    drawSceneFocusOverlayForTile(state, item, worldUi);
  }

  drawSceneLosPreview(state, worldUi);
}

function compareTerrainItems(a, b) {
  if (a.sortKey !== b.sortKey) {
    return a.sortKey - b.sortKey;
  }

  const aSize = a.size ?? 1;
  const bSize = b.size ?? 1;
  if (aSize !== bSize) {
    return bSize - aSize;
  }

  if (a.screenY !== b.screenY) {
    return a.screenY - b.screenY;
  }

  if (a.screenX !== b.screenX) {
    return a.screenX - b.screenX;
  }

  return 0;
}

export function renderEditor(state, refs) {
  const { editor } = refs;
  const { map } = state;

  editor.innerHTML = "";

  const pad = RENDER_CONFIG.editorPadding;
  const full = RENDER_CONFIG.editorSize;
  const inner = full - (pad * 2);

  if (state.ui.editor.mode === "detail") {
    renderDetailEditor(state, editor, map, pad, inner);
    return;
  }

  const cellWidth = inner / MAP_CONFIG.mechWidth;
  const cellHeight = inner / MAP_CONFIG.mechHeight;

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      const isSelected =
        x === state.ui.editor.selectedTile.x &&
        y === state.ui.editor.selectedTile.y;

      renderEditorTile(
        tile,
        x,
        y,
        pad + (x * cellWidth),
        pad + (y * cellHeight),
        cellWidth,
        cellHeight,
        editor,
        { selected: isSelected }
      );
    }
  }
}

function renderDetailEditor(state, parent, map, pad, inner) {
  const selectedX = state.ui.editor.selectedTile.x;
  const selectedY = state.ui.editor.selectedTile.y;
  const selectedTile = getTile(map, selectedX, selectedY);
  const detail = getDetailGrid(selectedTile);
  const summary = getTileSummary(selectedTile);

  const miniSize = 126;
  const miniCellW = miniSize / MAP_CONFIG.mechWidth;
  const miniCellH = miniSize / MAP_CONFIG.mechHeight;

  const miniX = pad;
  const miniY = pad;

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      const isSelected = x === selectedX && y === selectedY;

      renderEditorMiniTile(
        tile,
        x,
        y,
        miniX + (x * miniCellW),
        miniY + (y * miniCellH),
        miniCellW,
        miniCellH,
        parent,
        { selected: isSelected }
      );
    }
  }

  const infoX = miniX + miniSize + 16;
  const infoY = miniY + 20;

  parent.appendChild(
    makeText(infoX, infoY, `Tile ${selectedX},${selectedY}`, "editor-mode-title")
  );

  parent.appendChild(
    makeText(
      infoX,
      infoY + 22,
      `Base ${selectedTile?.elevation ?? 0} · Foot ${formatDetailElevation(summary?.mechFootFineElevation ?? 0)}`,
      "editor-mode-sub"
    )
  );

  parent.appendChild(
    makeText(
      infoX,
      infoY + 44,
      `Range ${formatDetailElevation(summary?.heightRangeFine ?? 0)} · ${summary?.mechEnterable ? "Mech Enterable" : "Mech Blocked"}`,
      "editor-mode-sub"
    )
  );

  parent.appendChild(
    makeText(
      infoX,
      infoY + 66,
      "Click map to change tile · Click big cells to edit detail",
      "editor-mode-sub"
    )
  );

  const detailBoxY = miniY + miniSize + 18;
  const detailBoxSize = inner - miniSize - 18;
  const gridSize = Math.min(detailBoxSize, inner);
  const cellSize = gridSize / detail.subdivisions;

  for (let sy = 0; sy < detail.subdivisions; sy++) {
    for (let sx = 0; sx < detail.subdivisions; sx++) {
      const detailCell = detail.cells[sy][sx];

      renderEditorDetailCell(
        detailCell,
        selectedX,
        selectedY,
        sx,
        sy,
        pad + (sx * cellSize),
        detailBoxY + (sy * cellSize),
        cellSize,
        cellSize,
        parent,
        {
          large: true
        }
      );
    }
  }
}

function renderEditorUi(state, refs) {
  if (!refs.editorModeLabel) return;

  if (state.ui.editor.mode === "detail") {
    refs.editorModeLabel.textContent =
      `Editor Mode: Detail Cells · Tile ${state.ui.editor.selectedTile.x},${state.ui.editor.selectedTile.y}`;
    return;
  }

  refs.editorModeLabel.textContent = "Editor Mode: Mech Tiles";
}
