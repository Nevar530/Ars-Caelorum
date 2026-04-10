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

  const sceneItems = [];
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

      sceneItems.push({
        kind: "tile",
        x,
        y,
        elevation: renderElevation,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: parentSort,
        parentSort,
        reachableCost: reachableMap.get(`${x},${y}`) ?? null,
        skipTerrain: hasDetailGeometry
      });

      if (!hasDetailGeometry) continue;

      const detailCells = getDetailRenderCells(map, x, y);

      for (const cell of detailCells) {
        const cellProjected = projectScene(state, cell.x, cell.y, cell.elevation);
        const cellSort = getSceneSortKey(state, cell.x, cell.y, cell.elevation);

        sceneItems.push({
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

    sceneItems.push({
      kind: "mech",
      mech,
      elevation: tileElevation,
      screenX: projected.x,
      screenY: projected.y,
      sortKey: parentSort + 0.92
    });
  }

  sceneItems.sort((a, b) => a.sortKey - b.sortKey);

  for (const item of sceneItems) {
    if (item.kind === "tile") {
      if (!item.skipTerrain) {
        renderTerrainTile(state, item, worldScene);
      }

      if (state.ui.mode === "move" && item.reachableCost !== null) {
        drawSceneMoveOverlay(state, item, worldScene, String(item.reachableCost));
      }

      drawScenePathOverlayForTile(state, item, worldScene);
      drawSceneActionOverlayForTile(state, item, worldScene);
      drawSceneFocusOverlayForTile(state, item, worldScene);
      continue;
    }

    if (item.kind === "detail") {
      renderTerrainTile(state, item, worldScene);
      continue;
    }

    const isActive = item.mech.instanceId === state.turn.activeMechId;
    drawMech(state, item.mech, item.screenX, item.screenY, worldScene, isActive);
  }

  drawSceneLosPreview(state, worldUi);
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

  if (!detail?.cells?.length) {
    return;
  }

  const subdivisions = detail.subdivisions ?? 4;
  const detailPadTop = 110;
  const detailSize = Math.min(inner - miniSize - 28, inner - detailPadTop);
  const detailCellW = detailSize / subdivisions;
  const detailCellH = detailSize / subdivisions;
  const detailX = miniX + miniSize + 16;
  const detailY = miniY + detailPadTop;

  for (let subY = 0; subY < subdivisions; subY++) {
    for (let subX = 0; subX < subdivisions; subX++) {
      const cell = detail.cells[subY]?.[subX];
      if (!cell) continue;

      renderEditorDetailCell(
        cell,
        selectedX,
        selectedY,
        subX,
        subY,
        detailX + (subX * detailCellW),
        detailY + (subY * detailCellH),
        detailCellW,
        detailCellH,
        parent,
        {
          large: true,
          selected:
            state.ui.editor.detailSelection &&
            state.ui.editor.detailSelection.sx === subX &&
            state.ui.editor.detailSelection.sy === subY
        }
      );
    }
  }
}

export function renderEditorUi(state, refs) {
  const { editorUi } = refs;

  editorUi.innerHTML = "";

  if (!state.ui.showDevMenu || state.ui.devTab !== "map") {
    return;
  }

  const title = makeText(14, 20, "MAP EDITOR", "editor-ui-title");
  editorUi.appendChild(title);

  const modeLabel = state.ui.editor.mode === "detail"
    ? "Mode: Detail 4x4"
    : "Mode: Mech Tile";

  editorUi.appendChild(
    makeText(14, 42, modeLabel, "editor-ui-subtitle")
  );

  editorUi.appendChild(
    makeText(14, 66, "E/Q: Raise/Lower · Tab: Toggle Detail Mode", "editor-ui-help")
  );

  if (state.ui.editor.mode === "detail") {
    editorUi.appendChild(
      makeText(14, 86, "Click a detail cell, then use E/Q to edit fine height", "editor-ui-help")
    );
  } else {
    editorUi.appendChild(
      makeText(14, 86, "Click a mech tile, then use E/Q to edit tile height", "editor-ui-help")
    );
  }
}
