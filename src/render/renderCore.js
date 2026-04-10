// src/render/renderCore.js

import { GAME_CONFIG, MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import { getTile, getDetailGrid } from "../map.js";
import { getReachableTiles } from "../movement.js";
import {
  renderTerrainTile,
  renderEditorTile,
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
      const projected = projectScene(state, x, y, tile.elevation);

      sceneItems.push({
        kind: "tile",
        x,
        y,
        elevation: tile.elevation,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: getSceneSortKey(state, x, y, tile.elevation),
        reachableCost: reachableMap.get(`${x},${y}`) ?? null
      });
    }
  }

  for (const mech of mechs) {
    const tile = getTile(map, mech.x, mech.y);
    if (!tile) continue;

    const projected = projectScene(state, mech.x, mech.y, tile.elevation);

    sceneItems.push({
      kind: "mech",
      mech,
      elevation: tile.elevation,
      screenX: projected.x,
      screenY: projected.y,
      sortKey: getSceneSortKey(state, mech.x, mech.y, tile.elevation) + 0.25
    });
  }

  sceneItems.sort((a, b) => a.sortKey - b.sortKey);

  for (const item of sceneItems) {
    if (item.kind === "tile") {
      renderTerrainTile(state, item, worldScene);

      if (state.ui.mode === "move" && item.reachableCost !== null) {
        drawSceneMoveOverlay(state, item, worldScene, String(item.reachableCost));
      }

      drawScenePathOverlayForTile(state, item, worldScene);
      drawSceneActionOverlayForTile(state, item, worldScene);
      drawSceneFocusOverlayForTile(state, item, worldScene);
    } else {
      const isActive = item.mech.instanceId === state.turn.activeMechId;
      drawMech(state, item.mech, item.screenX, item.screenY, worldScene, isActive);
    }
  }

  drawSceneLosPreview(state, worldUi);
}

export function renderEditor(state, refs) {
  const { editor } = refs;
  const { map } = state;

  editor.innerHTML = "";

  const usable = RENDER_CONFIG.editorSize - (RENDER_CONFIG.editorPadding * 2);

  if (state.ui.editor.mode === "detail") {
    const detailWidth = MAP_CONFIG.mechWidth * GAME_CONFIG.detailSubdivisionsPerMechTile;
    const detailHeight = MAP_CONFIG.mechHeight * GAME_CONFIG.detailSubdivisionsPerMechTile;
    const cellWidth = usable / detailWidth;
    const cellHeight = usable / detailHeight;

    for (let my = 0; my < MAP_CONFIG.mechHeight; my++) {
      for (let mx = 0; mx < MAP_CONFIG.mechWidth; mx++) {
        const tile = getTile(map, mx, my);
        const detail = getDetailGrid(tile);
        if (!detail?.cells) continue;

        for (let sy = 0; sy < detail.subdivisions; sy++) {
          for (let sx = 0; sx < detail.subdivisions; sx++) {
            const detailCell = detail.cells[sy][sx];

            const globalX = (mx * detail.subdivisions) + sx;
            const globalY = (my * detail.subdivisions) + sy;

            renderEditorDetailCell(
              detailCell,
              mx,
              my,
              sx,
              sy,
              px(globalX, cellWidth),
              py(globalY, cellHeight),
              cellWidth,
              cellHeight,
              editor,
              {
                drawParentOutline:
                  sx === detail.subdivisions - 1 || sy === detail.subdivisions - 1
              }
            );
          }
        }
      }
    }

    return;
  }

  const cellWidth = usable / MAP_CONFIG.mechWidth;
  const cellHeight = usable / MAP_CONFIG.mechHeight;

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      renderEditorTile(
        tile,
        x,
        y,
        px(x, cellWidth),
        py(y, cellHeight),
        cellWidth,
        cellHeight,
        editor
      );
    }
  }

  function px(x, cellWidthValue) {
    return RENDER_CONFIG.editorPadding + (x * cellWidthValue);
  }

  function py(y, cellHeightValue) {
    return RENDER_CONFIG.editorPadding + (y * cellHeightValue);
  }
}

function renderEditorUi(state, refs) {
  if (!refs.editorModeLabel) return;

  refs.editorModeLabel.textContent =
    state.ui.editor.mode === "detail"
      ? "Editor Mode: Detail Cells"
      : "Editor Mode: Mech Tiles";
}
