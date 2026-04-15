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
  projectTileCenter,
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
  const mechUnits = units.filter((unit) => (unit?.unitType ?? "mech") === "mech");
  const { map } = state;

  worldScene.innerHTML = "";
  worldUi.innerHTML = "";

  const behindTerrainItems = [];
  const frontOccluderTerrainItems = [];
  const unitItems = [];
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

      bucketTerrainItem(
        state,
        tileItem,
        mechUnits,
        behindTerrainItems,
        frontOccluderTerrainItems
      );
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

          bucketTerrainItem(
            state,
            detailItem,
            mechUnits,
            behindTerrainItems,
            frontOccluderTerrainItems
          );
        }
      }
    }
  }

  behindTerrainItems.sort(compareSceneItems);
  for (const item of behindTerrainItems) {
    item.render(worldScene);
  }

  for (const unit of units) {
    const centerTile = getUnitCenterPoint(unit);
    const supportElevation = getUnitSupportElevation(state, unit);

    if (supportElevation === null) continue;

    const projectedAnchor = projectTileCenter(
      state,
      centerTile.x,
      centerTile.y,
      supportElevation
    );

    const footprintSortDepth = getUnitFootprintSortDepth(state, unit);

    const renderModel =
      state.ui?.viewMode === "top"
        ? {
            top: {
              center: {
                x: projectedAnchor.x,
                y: projectedAnchor.y
              }
            }
          }
        : {
            iso: {
              center: {
                x: projectedAnchor.x,
                y: projectedAnchor.y
              }
            }
          };

    const activeUnitId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
    const isActive = unit.instanceId === activeUnitId;

    const parts = getUnitRenderSceneItems(state, unit, renderModel, isActive);

    for (const part of parts) {
      unitItems.push({
        kind: "unit_part",
        sortDepth: footprintSortDepth + (part.sortDepth - projectedAnchor.y),
        sortKey:
          (getSceneSortKey(
            state,
            centerTile.x,
            centerTile.y,
            supportElevation,
            1
          ) * 1000) +
          part.sortKey +
          UNIT_SORT_EPSILON,
        render: part.render
      });
    }
  }

  unitItems.sort(compareSceneItems);
  for (const item of unitItems) {
    item.render(worldScene);
  }

  frontOccluderTerrainItems.sort(compareSceneItems);
  for (const item of frontOccluderTerrainItems) {
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

function bucketTerrainItem(state, item, mechUnits, behindTerrainItems, frontOccluderTerrainItems) {
  if (isTerrainInsideAnyMechFootprint(item, mechUnits)) {
    behindTerrainItems.push(item);
    return;
  }

  if (isTerrainFrontOccluderForAnyMech(state, item, mechUnits)) {
    frontOccluderTerrainItems.push(item);
    return;
  }

  behindTerrainItems.push(item);
}

function isTerrainInsideAnyMechFootprint(item, mechUnits) {
  return mechUnits.some((unit) => isTerrainInsideFootprint(item, unit));
}

function isTerrainInsideFootprint(item, unit) {
  const bounds = getUnitFootprintBounds(unit);
  const ix = Math.floor(item.x);
  const iy = Math.floor(item.y);

  return ix >= bounds.minX && ix <= bounds.maxX && iy >= bounds.minY && iy <= bounds.maxY;
}

function isTerrainFrontOccluderForAnyMech(state, item, mechUnits) {
  return mechUnits.some((unit) => isTerrainFrontOccluderForMech(state, item, unit));
}

function isTerrainFrontOccluderForMech(state, item, unit) {
  const bounds = getUnitFootprintBounds(unit);
  const ix = Math.floor(item.x);
  const iy = Math.floor(item.y);
  const rotation = normalizeRotation(state?.camera?.rotation ?? state?.rotation ?? 0);

  // Never let terrain inside the mech footprint occlude the mech.
  if (ix >= bounds.minX && ix <= bounds.maxX && iy >= bounds.minY && iy <= bounds.maxY) {
    return false;
  }

  const centerTileX = Number(unit?.x ?? 0);
  const centerTileY = Number(unit?.y ?? 0);

  const supportTile = getTile(state.map, centerTileX, centerTileY);
  const terrainTile = getTile(state.map, ix, iy);

  if (!supportTile || !terrainTile) return false;

  const supportElevation = getTileFootElevation(supportTile);
  const terrainElevation = getTileFootElevation(terrainTile);

  // Same-height floor stays behind. Front occluders must be higher.
  if (terrainElevation <= supportElevation) {
    return false;
  }

  // Camera-front edges by rotation:
  // 0 = south + west
  // 1 = south + east
  // 2 = north + east
  // 3 = north + west
  switch (rotation) {
    case 0:
      return (
        touchesSouthEdge(ix, iy, bounds) ||
        touchesWestEdge(ix, iy, bounds) ||
        touchesSouthWestCorner(ix, iy, bounds)
      );
    case 1:
      return (
        touchesSouthEdge(ix, iy, bounds) ||
        touchesEastEdge(ix, iy, bounds) ||
        touchesSouthEastCorner(ix, iy, bounds)
      );
    case 2:
      return (
        touchesNorthEdge(ix, iy, bounds) ||
        touchesEastEdge(ix, iy, bounds) ||
        touchesNorthEastCorner(ix, iy, bounds)
      );
    case 3:
    default:
      return (
        touchesNorthEdge(ix, iy, bounds) ||
        touchesWestEdge(ix, iy, bounds) ||
        touchesNorthWestCorner(ix, iy, bounds)
      );
  }
}

function touchesSouthEdge(x, y, bounds) {
  return y === bounds.maxY + 1 && x >= bounds.minX && x <= bounds.maxX;
}

function touchesNorthEdge(x, y, bounds) {
  return y === bounds.minY - 1 && x >= bounds.minX && x <= bounds.maxX;
}

function touchesWestEdge(x, y, bounds) {
  return x === bounds.minX - 1 && y >= bounds.minY && y <= bounds.maxY;
}

function touchesEastEdge(x, y, bounds) {
  return x === bounds.maxX + 1 && y >= bounds.minY && y <= bounds.maxY;
}

function touchesSouthWestCorner(x, y, bounds) {
  return x === bounds.minX - 1 && y === bounds.maxY + 1;
}

function touchesSouthEastCorner(x, y, bounds) {
  return x === bounds.maxX + 1 && y === bounds.maxY + 1;
}

function touchesNorthWestCorner(x, y, bounds) {
  return x === bounds.minX - 1 && y === bounds.minY - 1;
}

function touchesNorthEastCorner(x, y, bounds) {
  return x === bounds.maxX + 1 && y === bounds.minY - 1;
}

function getUnitSupportElevation(state, unit) {
  const centerTileX = Number(unit?.x ?? 0);
  const centerTileY = Number(unit?.y ?? 0);

  const tile = getTile(state.map, centerTileX, centerTileY);
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

function normalizeRotation(value) {
  const n = Number.isFinite(value) ? value : 0;
  return ((n % 4) + 4) % 4;
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
