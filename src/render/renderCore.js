// src/render/renderCore.js

import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import {
  getTile,
  getTileFootElevation,
  getDetailRenderCells,
  isDetailTileUniform,
  getTileRenderElevation
} from "../map.js";
import { getReachableTiles } from "../movement.js";
import {
  renderTerrainTile,
  renderEditorTile
} from "./renderTerrain.js";
import { getUnitRenderSceneItems } from "./renderUnits.js";
import {
  drawSceneMoveOverlay,
  drawScenePathOverlayForTile,
  drawSceneActionOverlayForTile,
  drawSceneFocusOverlayForTile,
  drawSceneActiveUnitOverlay
} from "./renderOverlays.js";
import {
  ensureCameraState,
  updateCameraFraming,
  projectScene,
  getSceneSortKey
} from "./projection.js";
import { drawSceneLosPreview } from "./renderLosOverlay.js";
import {
  getUnitCenterPoint,
  getUnitFootprintBounds,
  getUnitOccupiedCells
} from "../scale/scaleMath.js";

const UNIT_SORT_EPSILON = 0.25;

export function renderAll(state, refs) {
  ensureCameraState(state);
  updateCameraFraming(state, refs);
  renderIso(state, refs);
  renderEditor(state, refs);
  renderEditorUi(state, refs);
}

export function renderIso(state, refs) {
  const { worldScene, worldUi } = refs;
  const units = state.units ?? state.mechs ?? [];
  const { map } = state;

  worldScene.innerHTML = "";
  worldUi.innerHTML = "";

  const sceneItems = [];
  const overlayTileItems = [];
  const reachableMap = new Map();

  if (state.ui.mode === "move") {
    for (const tile of getReachableTiles(state)) {
      reachableMap.set(`${tile.x},${tile.y}`, tile);
    }
  }

  for (let y = 0; y < MAP_CONFIG.height; y += 1) {
    for (let x = 0; x < MAP_CONFIG.width; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      const renderElevation = getTileRenderElevation(tile);
      const projected = projectScene(state, x, y, renderElevation, 1);
      const hasDetailGeometry = !isDetailTileUniform(tile);
      const reachableData = reachableMap.get(`${x},${y}`) ?? null;

      const tileItem = {
        kind: "terrain",
        sourceKind: "tile",
        x,
        y,
        elevation: renderElevation,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: getSceneSortKey(state, x, y, renderElevation, 1),
        reachableCost: reachableData?.cost ?? null,
        reachableData,
        skipTerrain: hasDetailGeometry,
        size: 1,
        leftFaceHeight: renderElevation,
        rightFaceHeight: renderElevation,
        sortDepth: getTerrainDepth({
          size: 1,
          screenY: projected.y,
          leftFaceHeight: renderElevation,
          rightFaceHeight: renderElevation
        }),
        render(parent) {
          if (this.skipTerrain) return;
          renderTerrainTile(state, this, parent);
        }
      };

      sceneItems.push(tileItem);
      overlayTileItems.push(tileItem);

      if (hasDetailGeometry) {
        const detailCells = getDetailRenderCells(map, x, y);

        for (const cell of detailCells) {
          const cellProjected = projectScene(
            state,
            cell.x,
            cell.y,
            cell.elevation,
            cell.size
          );

          sceneItems.push({
            kind: "terrain",
            sourceKind: "detail",
            x: cell.x,
            y: cell.y,
            elevation: cell.elevation,
            fineElevation: cell.fineElevation,
            size: cell.size,
            leftFaceHeight: cell.leftFaceHeight,
            rightFaceHeight: cell.rightFaceHeight,
            screenX: cellProjected.x,
            screenY: cellProjected.y,
            sortKey: getSceneSortKey(state, cell.x, cell.y, cell.elevation, cell.size),
            sortDepth: getTerrainDepth({
              size: cell.size,
              screenY: cellProjected.y,
              leftFaceHeight: cell.leftFaceHeight,
              rightFaceHeight: cell.rightFaceHeight
            }),
            render(parent) {
              renderTerrainTile(state, this, parent);
            }
          });
        }
      }
    }
  }

  for (const unit of units) {
    const centerPoint = getUnitCenterPoint(unit);
    const supportElevation = getUnitSupportElevation(state, unit);

    if (supportElevation === null) continue;

    const projectedCenter = projectScene(
      state,
      centerPoint.x,
      centerPoint.y,
      supportElevation,
      1
    );

    const footprintSortDepth = getUnitFootprintSortDepth(state, unit);

    const renderModel =
      state.ui?.viewMode === "top"
        ? {
            top: {
              center: {
                x: projectedCenter.x,
                y: projectedCenter.y
              }
            }
          }
        : {
            iso: {
              center: {
                x: projectedCenter.x,
                y: projectedCenter.y
              }
            }
          };

    const activeUnitId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
    const isActive = unit.instanceId === activeUnitId;

    const parts = getUnitRenderSceneItems(state, unit, renderModel, isActive);

    for (const part of parts) {
      sceneItems.push({
        kind: "unit_part",
        sortDepth: footprintSortDepth + (part.sortDepth - projectedCenter.y),
        sortKey:
          (getSceneSortKey(
            state,
            centerPoint.x,
            centerPoint.y,
            supportElevation,
            1
          ) * 1000) +
          part.sortKey +
          UNIT_SORT_EPSILON,
        render: part.render
      });
    }
  }

  sceneItems.sort(compareSceneItems);

  for (const item of sceneItems) {
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
}

function getUnitSupportElevation(state, unit) {
  const bounds = getUnitFootprintBounds(unit);

  const supportX = bounds.minX + Math.floor(bounds.width / 2);
  const supportY = bounds.minY + Math.floor(bounds.height / 2);

  const tile = getTile(state.map, supportX, supportY);
  if (!tile) return null;

  return getTileFootElevation(tile);
}

function getUnitFootprintSortDepth(state, unit) {
  const occupiedCells = getUnitOccupiedCells(unit);
  let maxDepth = null;

  for (const cell of occupiedCells) {
    const tile = getTile(state.map, cell.x, cell.y);
    if (!tile) continue;

    const renderElevation = getTileRenderElevation(tile);
    const projected = projectScene(state, cell.x, cell.y, renderElevation, 1);

    const depth = getTerrainDepth({
      size: 1,
      screenY: projected.y,
      leftFaceHeight: renderElevation,
      rightFaceHeight: renderElevation
    });

    if (maxDepth === null || depth > maxDepth) {
      maxDepth = depth;
    }
  }

  if (maxDepth === null) {
    const centerPoint = getUnitCenterPoint(unit);
    const supportElevation = getUnitSupportElevation(state, unit) ?? 0;
    const projected = projectScene(state, centerPoint.x, centerPoint.y, supportElevation, 1);

    return projected.y;
  }

  return maxDepth + UNIT_SORT_EPSILON;
}

function getTerrainDepth(item) {
  const size = item.size ?? 1;
  const faceHeight = Math.max(item.leftFaceHeight ?? 0, item.rightFaceHeight ?? 0);

  return (
    item.screenY +
    (RENDER_CONFIG.isoTileHeight * size) +
    (faceHeight * RENDER_CONFIG.elevationStepPx)
  );
}

function compareSceneItems(a, b) {
  if (a.sortDepth !== b.sortDepth) {
    return a.sortDepth - b.sortDepth;
  }

  if (a.sortKey !== b.sortKey) {
    return a.sortKey - b.sortKey;
  }

  return 0;
}

export function renderEditor(state, refs) {
  const { editor } = refs;
  const { map } = state;

  if (!editor) return;

  editor.innerHTML = "";

  const pad = RENDER_CONFIG.editorPadding;
  const full = RENDER_CONFIG.editorSize;
  const inner = full - (pad * 2);

  const cellWidth = inner / MAP_CONFIG.width;
  const cellHeight = inner / MAP_CONFIG.height;

  for (let y = 0; y < MAP_CONFIG.height; y += 1) {
    for (let x = 0; x < MAP_CONFIG.width; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

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

function renderEditorUi(state, refs) {
  if (!refs.editorModeLabel) return;

  refs.editorModeLabel.textContent =
    `Editor Mode: Base Grid · Tile ${state.ui.editor.selectedTile.x},${state.ui.editor.selectedTile.y} · Left click raise · Right click lower`;
}
