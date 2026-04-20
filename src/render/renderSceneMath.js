// src/render/renderSceneMath.js

import { RENDER_CONFIG } from "../config.js";
import { getTile, getTileFootElevation, getTileRenderElevation } from "../map.js";
import { projectScene, projectTileCenter, getSceneSortKey } from "./projection.js";
import { getUnitCenterPoint, getUnitOccupiedCells } from "../scale/scaleMath.js";

export const UNIT_SORT_EPSILON = 0.25;

export function getTerrainDepth(item) {
  const size = item.size ?? 1;
  const faceHeight = Math.max(item.leftFaceHeight ?? 0, item.rightFaceHeight ?? 0);

  return (
    item.screenY +
    (RENDER_CONFIG.isoTileHeight * size) +
    (faceHeight * RENDER_CONFIG.elevationStepPx)
  );
}

export function compareSceneItems(a, b) {
  if (a.sortDepth !== b.sortDepth) {
    return a.sortDepth - b.sortDepth;
  }

  if (a.sortKey !== b.sortKey) {
    return a.sortKey - b.sortKey;
  }

  return 0;
}

export function getUnitSupportElevation(state, unit) {
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

export function getBottomVisibleFootprintTile(state, unit, supportElevation) {
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

export function getUnitFootprintSortDepth(state, unit) {
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

export function getUnitRenderContext(state, unit) {
  const centerTile = getUnitCenterPoint(unit);
  const supportElevation = getUnitSupportElevation(state, unit);

  if (supportElevation === null) return null;

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

  const isTopView = state.ui?.viewMode === "top";

  return {
    centerTile,
    supportElevation,
    anchorTile,
    projectedAnchor,
    projectedCenter,
    renderAnchor: isTopView ? projectedCenter : projectedAnchor,
    sortTile: isTopView ? centerTile : anchorTile,
    footprintSortDepth: getUnitFootprintSortDepth(state, unit),
    sortKey:
      getSceneSortKey(
        state,
        (isTopView ? centerTile : anchorTile).x,
        (isTopView ? centerTile : anchorTile).y,
        supportElevation,
        1
      )
  };
}
