// src/render/renderCore.js

import { RENDER_CONFIG } from "../config.js";
import {
  getMapHeight,
  getMapWidth,
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
import { getUnitRenderSceneItems, drawIsoStatusPlate } from "./renderUnits.js";
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
  projectTileCenter,
  getSceneSortKey
} from "./projection.js";
import { drawSceneLosPreview } from "./renderLosOverlay.js";
import {
  getUnitCenterPoint,
  getUnitOccupiedCells
} from "../scale/scaleMath.js";

const UNIT_SORT_EPSILON = 0.25;

function getBottomVisibleFootprintTile(state, unit, supportElevation) {
  const cells = getUnitOccupiedCells(unit);
  if (!cells || cells.length === 0) {
    return getUnitCenterPoint(unit);
  }

  let bestCell = cells[0];
  let bestProjected = projectTileCenter(state, bestCell.x, bestCell.y, supportElevation);

  for (let i = 1; i < cells.length; i += 1) {
    const cell = cells[i];
    const projected = projectTileCenter(state, cell.x, cell.y, supportElevation);

    if (
      projected.y > bestProjected.y ||
      (projected.y === bestProjected.y && projected.x > bestProjected.x)
    ) {
      bestCell = cell;
      bestProjected = projected;
    }
  }

  return bestCell;
}

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

  const terrainSceneItems = [];
  const unitSceneItems = [];
  const overlayTileItems = [];
  const reachableMap = new Map();
  const unitStatusTagItems = [];

  if (state.ui.mode === "move") {
    for (const tile of getReachableTiles(state)) {
      reachableMap.set(`${tile.x},${tile.y}`, tile);
    }
  }

  const mapWidth = getMapWidth(map);
  const mapHeight = getMapHeight(map);

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
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
        terrainTypeId: tile.terrainTypeId,
        terrainSpriteId: tile.terrainSpriteId,
        movementClass: tile.movementClass,
        spawnId: tile.spawnId,
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

      terrainSceneItems.push(tileItem);
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

          const detailItem = {
            kind: "terrain",
            sourceKind: "detail",
            x: cell.x,
            y: cell.y,
            elevation: cell.elevation,
            fineElevation: cell.fineElevation,
            terrainTypeId: tile.terrainTypeId,
            terrainSpriteId: tile.terrainSpriteId,
            movementClass: tile.movementClass,
            spawnId: tile.spawnId,
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
          };

          terrainSceneItems.push(detailItem);
        }
      }
    }
  }

  for (const unit of units) {
    const centerTile = getUnitCenterPoint(unit);
    const supportElevation = getUnitSupportElevation(state, unit);

    if (supportElevation === null) continue;

    const anchorTile =
      unit.unitType === "mech"
        ? getBottomVisibleFootprintTile(state, unit, supportElevation)
        : centerTile;

    const projectedAnchor = projectTileCenter(
      state,
      anchorTile.x,
      anchorTile.y,
      supportElevation
    );

    const projectedCenter = projectTileCenter(
      state,
      centerTile.x,
      centerTile.y,
      supportElevation
    );

    const renderAnchor =
      state.ui?.viewMode === "top"
        ? projectedCenter
        : projectedAnchor;

    const sortTile =
      state.ui?.viewMode === "top"
        ? centerTile
        : anchorTile;

    const footprintSortDepth = getUnitFootprintSortDepth(state, unit);

    const selectedUnitId = state.selection?.unitId ?? state.selection?.mechId ?? null;
    const activeUnitId = state.turn?.activeUnitId ?? state.turn?.activeMechId ?? null;
    const shouldShowStatusTag =
      state.ui?.viewMode !== "top" &&
      (unit.instanceId === selectedUnitId || unit.instanceId === activeUnitId);

    if (shouldShowStatusTag) {
      unitStatusTagItems.push({
        x: projectedAnchor.x,
        y: projectedAnchor.y,
        unit
      });
    }

    const renderModel =
      state.ui?.viewMode === "top"
        ? {
            top: {
              center: {
                x: renderAnchor.x,
                y: renderAnchor.y
              },
              logicCenter: {
                x: projectedCenter.x,
                y: projectedCenter.y
              }
            }
          }
        : {
            iso: {
              center: {
                x: projectedAnchor.x,
                y: projectedAnchor.y
              },
              logicCenter: {
                x: projectedCenter.x,
                y: projectedCenter.y
              }
            }
          };

    const isActive = unit.instanceId === activeUnitId;
    const parts = getUnitRenderSceneItems(state, unit, renderModel, isActive);

    for (const part of parts) {
      unitSceneItems.push({
        kind: "unit_part",
        sortDepth: footprintSortDepth + (part.sortDepth - renderAnchor.y),
        sortKey:
          (getSceneSortKey(
            state,
            sortTile.x,
            sortTile.y,
            supportElevation,
            1
          ) * 1000) +
          part.sortKey +
          UNIT_SORT_EPSILON,
        render: part.render
      });
    }
  }

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

function getUnitSupportElevation(state, unit) {
  const occupiedCells = getUnitOccupiedCells(unit);
  let maxElevation = null;

  for (const cell of occupiedCells) {
    const tile = getTile(state.map, cell.x, cell.y);
    if (!tile) return null;

    const elevation = getTileFootElevation(tile);
    if (maxElevation === null || elevation > maxElevation) {
      maxElevation = elevation;
    }
  }

  return maxElevation;
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
    const centerTile = getUnitCenterPoint(unit);
    const supportElevation = getUnitSupportElevation(state, unit) ?? 0;
    const projected = projectTileCenter(state, centerTile.x, centerTile.y, supportElevation);

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
