// src/render/renderCore.js

import { RENDER_CONFIG } from "../config.js";
import {
  getMapHeight,
  getMapWidth,
  getTile
} from "../map.js";
import { getReachableTiles } from "../movement.js";
import { renderEditorTile } from "./renderTerrain.js";
import { drawIsoStatusPlate } from "./renderUnits.js";
import {
  drawSceneMoveOverlay,
  drawScenePathOverlayForTile,
  drawSceneActionOverlayForTile,
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

  const pad = RENDER_CONFIG.editorPadding;
  const full = RENDER_CONFIG.editorSize;
  const inner = full - (pad * 2);

  const mapWidth = Math.max(1, getMapWidth(map));
  const mapHeight = Math.max(1, getMapHeight(map));
  const cellWidth = inner / mapWidth;
  const cellHeight = inner / mapHeight;

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      const isSelected =
        x === state.ui.editor.selectedTile.x &&
        y === state.ui.editor.selectedTile.y;

      const hoverTiles = state.ui?.mapEditor?.hoverTiles ?? [];
      const isPreview = hoverTiles.some((coord) => coord.x === x && coord.y === y);

      renderEditorTile(
        tile,
        x,
        y,
        pad + (x * cellWidth),
        pad + (y * cellHeight),
        cellWidth,
        cellHeight,
        editor,
        { selected: isSelected, preview: isPreview }
      );
    }
  }
}

function renderEditorUi(state, refs) {
  if (!refs.editorModeLabel) return;

  const editorState = state.ui?.mapEditor ?? {};
  const hoverCount = Array.isArray(editorState.hoverTiles) ? editorState.hoverTiles.length : 0;
  refs.editorModeLabel.textContent =
    `Map Editor · Tile ${state.ui.editor.selectedTile.x},${state.ui.editor.selectedTile.y} · Brush ${editorState.brushSize ?? 1}x${editorState.brushSize ?? 1} · Preview ${hoverCount}`;
}
