import { GAME_CONFIG } from "./config.js";
import {
  attachMapMetadata,
  buildMapFromFlatTiles,
  createInitialMap,
  getMapHeight,
  getMapSpawns,
  getMapWidth,
  getTile,
  normalizeMapDefinition,
  resetMap
} from "./maps/mapDefinition.js";
import {
  applyDetailPattern,
  buildTileSummary,
  changeDetailElevation as changeDetailElevationImpl,
  changeElevation as changeElevationImpl,
  createDetailGridForElevation,
  createTile,
  flattenMapTiles,
  formatDetailElevation,
  getDetailCell as getDetailCellImpl,
  getDetailCellSize,
  getDetailGrid,
  getDetailRenderCells as getDetailRenderCellsImpl,
  getFineElevationAtWorldDetailCell as getFineElevationAtWorldDetailCellImpl,
  getMaxFineElevationForTile,
  getMinFineElevationForTile,
  getTileBaseFineElevation,
  getTileEffectiveElevation,
  getTileFootElevation,
  getTileHeightRange,
  getTileRenderElevation,
  getTileSummary,
  getWorldDetailCellPosition,
  isDetailTileUniform,
  isTileMechEnterable,
  refreshAllTileSummaries,
  refreshTileSummary,
  setDetailCell,
  setDetailCellFine
} from "./maps/mapTiles.js";

export {
  applyDetailPattern,
  attachMapMetadata,
  buildMapFromFlatTiles,
  buildTileSummary,
  createDetailGridForElevation,
  createInitialMap,
  createTile,
  flattenMapTiles,
  formatDetailElevation,
  getDetailCellSize,
  getDetailGrid,
  getMapHeight,
  getMapSpawns,
  getMapWidth,
  getMaxFineElevationForTile,
  getMinFineElevationForTile,
  getTile,
  getTileBaseFineElevation,
  getTileEffectiveElevation,
  getTileFootElevation,
  getTileHeightRange,
  getTileRenderElevation,
  getTileSummary,
  getWorldDetailCellPosition,
  isDetailTileUniform,
  isTileMechEnterable,
  normalizeMapDefinition,
  refreshAllTileSummaries,
  refreshTileSummary,
  resetMap,
  setDetailCell,
  setDetailCellFine
};

export function getDetailCellAt(map, mechX, mechY, subX, subY) {
  return getDetailCellImpl(map, mechX, mechY, subX, subY, getTile);
}

export function changeTileElevation(map, x, y, delta) {
  return changeElevationImpl(map, x, y, delta, getTile);
}

export function changeTileDetailElevation(map, mechX, mechY, subX, subY, delta) {
  return changeDetailElevationImpl(map, mechX, mechY, subX, subY, delta, getTile);
}

export function getFineElevationAtDetailCell(map, detailX, detailY) {
  return getFineElevationAtWorldDetailCellImpl(map, detailX, detailY, getTile);
}

export function getDetailCellsForRender(map, mechX, mechY) {
  return getDetailRenderCellsImpl(map, mechX, mechY, getTile);
}

export function detailTypeFromFineElevation(fineElevation) {
  const coarse = Math.floor(fineElevation / GAME_CONFIG.detailElevationPerMechLevel);
  return tileTypeFromElevation(coarse);
}

export function tileTypeFromElevation(elevation) {
  if (elevation >= 3) return "peak";
  if (elevation >= 1) return "high";
  return "ground";
}

export function rotateCoord(x, y, width, height, rotation) {
  switch (rotation % 4) {
    case 0:
      return { x, y };
    case 1:
      return { x: height - 1 - y, y: x };
    case 2:
      return { x: width - 1 - x, y: height - 1 - y };
    case 3:
      return { x: y, y: width - 1 - x };
    default:
      return { x, y };
  }
}

export function getDetailCell(map, mechX, mechY, subX, subY) {
  return getDetailCellAt(map, mechX, mechY, subX, subY);
}

export function changeElevation(map, x, y, delta) {
  return changeTileElevation(map, x, y, delta);
}

export function changeDetailElevation(map, mechX, mechY, subX, subY, delta) {
  return changeTileDetailElevation(map, mechX, mechY, subX, subY, delta);
}

export function getFineElevationAtWorldDetailCell(map, detailX, detailY) {
  return getFineElevationAtDetailCell(map, detailX, detailY);
}

export function getDetailRenderCells(map, mechX, mechY) {
  return getDetailCellsForRender(map, mechX, mechY);
}
