import { GAME_CONFIG, MAP_CONFIG } from "../config.js";
import { clamp } from "../utils.js";

export function createDetailGridForElevation(elevation) {
  const cells = [];
  const subdivisions = GAME_CONFIG.detailSubdivisionsPerMechTile;
  const fineElevation = elevation * GAME_CONFIG.detailElevationPerMechLevel;

  for (let sy = 0; sy < subdivisions; sy += 1) {
    const row = [];
    for (let sx = 0; sx < subdivisions; sx += 1) {
      row.push({ sx, sy, elevation: fineElevation });
    }
    cells.push(row);
  }

  return { subdivisions, cells };
}

export function buildTileSummary(tile) {
  const baseFineElevation =
    (tile?.elevation ?? 0) * GAME_CONFIG.detailElevationPerMechLevel;

  const detail = tile?.detail;
  const cells = detail?.cells ?? [];

  let minFineElevation = baseFineElevation;
  let maxFineElevation = baseFineElevation;

  for (const row of cells) {
    for (const cell of row) {
      const fineElevation = cell?.elevation ?? baseFineElevation;
      minFineElevation = Math.min(minFineElevation, fineElevation);
      maxFineElevation = Math.max(maxFineElevation, fineElevation);
    }
  }

  const heightRangeFine = maxFineElevation - minFineElevation;
  const mechLevelFine = GAME_CONFIG.detailElevationPerMechLevel;

  return {
    baseElevation: tile?.elevation ?? 0,
    baseFineElevation,
    minFineElevation,
    maxFineElevation,
    minElevation: minFineElevation / mechLevelFine,
    maxElevation: maxFineElevation / mechLevelFine,
    heightRangeFine,
    heightRange: heightRangeFine / mechLevelFine,
    hasDetailShape: minFineElevation !== maxFineElevation,
    mechEnterable: heightRangeFine <= mechLevelFine,
    mechFootFineElevation: maxFineElevation,
    mechFootElevation: maxFineElevation / mechLevelFine
  };
}

export function refreshTileSummary(tile) {
  if (!tile) return tile;
  tile.summary = buildTileSummary(tile);
  return tile;
}

export function createTile(x, y, elevation = 0, overrides = {}) {
  const hasDetail = overrides.detail && Array.isArray(overrides.detail.cells);
  const detail = hasDetail
    ? overrides.detail
    : createDetailGridForElevation(elevation);

  return refreshTileSummary({
    x,
    y,
    elevation,
    terrainTypeId: overrides.terrainTypeId ?? "grass",
    terrainSpriteId: overrides.terrainSpriteId ?? "grass_001",
    movementClass: overrides.movementClass ?? "clear",
    spawnId: overrides.spawnId ?? null,
    detail,
    summary: null
  });
}

export function setDetailCellFine(tile, subX, subY, fineElevation) {
  if (!tile?.detail?.cells?.[subY]?.[subX]) return;
  tile.detail.cells[subY][subX].elevation = fineElevation;
}

export function setDetailCell(tile, subX, subY, coarseElevation) {
  setDetailCellFine(
    tile,
    subX,
    subY,
    coarseElevation * GAME_CONFIG.detailElevationPerMechLevel
  );
}

export function applyDetailPattern(tile, pattern) {
  if (!tile || !Array.isArray(pattern)) return;

  for (let sy = 0; sy < pattern.length; sy += 1) {
    const row = pattern[sy];
    if (!Array.isArray(row)) continue;

    for (let sx = 0; sx < row.length; sx += 1) {
      const value = row[sx];
      if (value === null || value === undefined) continue;
      setDetailCell(tile, sx, sy, value);
    }
  }

  refreshTileSummary(tile);
}

export function refreshAllTileSummaries(map) {
  if (!Array.isArray(map)) return map;

  for (const row of map) {
    for (const tile of row) {
      refreshTileSummary(tile);
    }
  }

  if (Array.isArray(map)) {
    map.tiles = flattenMapTiles(map);
  }

  return map;
}

export function flattenMapTiles(map) {
  const tiles = [];
  if (!Array.isArray(map)) return tiles;

  for (const row of map) {
    if (!Array.isArray(row)) continue;
    for (const tile of row) {
      if (tile) tiles.push(tile);
    }
  }

  return tiles;
}

export function getTileSummary(tile) {
  if (!tile) return null;
  if (!tile.summary) refreshTileSummary(tile);
  return tile.summary;
}

export function getDetailGrid(tile) {
  return tile?.detail ?? null;
}

export function getDetailCell(map, mechX, mechY, subX, subY, getTile) {
  const tile = getTile(map, mechX, mechY);
  if (!tile?.detail?.cells) return null;

  const subdivisions = tile.detail.subdivisions ?? GAME_CONFIG.detailSubdivisionsPerMechTile;
  if (subX < 0 || subY < 0 || subX >= subdivisions || subY >= subdivisions) {
    return null;
  }

  return tile.detail.cells[subY]?.[subX] ?? null;
}

export function changeElevation(map, x, y, delta, getTile) {
  const tile = getTile(map, x, y);
  if (!tile) return;

  tile.elevation = clamp(
    tile.elevation + delta,
    MAP_CONFIG.minElevation,
    MAP_CONFIG.maxElevation
  );

  tile.detail = createDetailGridForElevation(tile.elevation);
  refreshTileSummary(tile);
}

export function changeDetailElevation(map, mechX, mechY, subX, subY, delta, getTile) {
  const tile = getTile(map, mechX, mechY);
  const detailCell = getDetailCell(map, mechX, mechY, subX, subY, getTile);
  if (!tile || !detailCell) return;

  const maxFineElevation = MAP_CONFIG.maxElevation * GAME_CONFIG.detailElevationPerMechLevel;

  detailCell.elevation = clamp(detailCell.elevation + delta, 0, maxFineElevation);
  refreshTileSummary(tile);
}

export function getTileBaseFineElevation(tile) {
  return getTileSummary(tile)?.baseFineElevation ?? 0;
}

export function getMinFineElevationForTile(tile) {
  return getTileSummary(tile)?.minFineElevation ?? 0;
}

export function getMaxFineElevationForTile(tile) {
  return getTileSummary(tile)?.maxFineElevation ?? 0;
}

export function getTileHeightRange(tile) {
  return getTileSummary(tile)?.heightRange ?? 0;
}

export function getTileFootElevation(tile) {
  return getTileSummary(tile)?.mechFootElevation ?? 0;
}

export function isTileMechEnterable(tile) {
  return getTileSummary(tile)?.mechEnterable ?? false;
}

export function getTileEffectiveElevation(tile) {
  return getTileFootElevation(tile);
}

export function isDetailTileUniform(tile) {
  return !(getTileSummary(tile)?.hasDetailShape ?? false);
}

export function getTileRenderElevation(tile) {
  return getTileFootElevation(tile);
}

export function getDetailCellSize(tile) {
  const subdivisions = tile?.detail?.subdivisions ?? GAME_CONFIG.detailSubdivisionsPerMechTile;
  return 1 / subdivisions;
}

export function getWorldDetailCellPosition(
  mechX,
  mechY,
  subX,
  subY,
  subdivisions = GAME_CONFIG.detailSubdivisionsPerMechTile
) {
  const cellSize = 1 / subdivisions;

  return {
    x: mechX + (subX * cellSize),
    y: mechY + (subY * cellSize),
    size: cellSize
  };
}

export function getFineElevationAtWorldDetailCell(map, detailX, detailY, getTile) {
  const subdivisions = GAME_CONFIG.detailSubdivisionsPerMechTile;
  const mechX = Math.floor(detailX / subdivisions);
  const mechY = Math.floor(detailY / subdivisions);
  const subX = detailX - (mechX * subdivisions);
  const subY = detailY - (mechY * subdivisions);

  const detailCell = getDetailCell(map, mechX, mechY, subX, subY, getTile);
  if (detailCell) return detailCell.elevation;

  const tile = getTile(map, mechX, mechY);
  if (!tile) return 0;

  return getTileBaseFineElevation(tile);
}

export function getDetailRenderCells(map, mechX, mechY, getTile) {
  const tile = getTile(map, mechX, mechY);
  const detail = getDetailGrid(tile);
  if (!tile || !detail?.cells?.length) return [];

  const cells = [];
  const subdivisions = detail.subdivisions ?? GAME_CONFIG.detailSubdivisionsPerMechTile;

  for (let subY = 0; subY < subdivisions; subY += 1) {
    for (let subX = 0; subX < subdivisions; subX += 1) {
      const detailCell = detail.cells[subY]?.[subX];
      if (!detailCell) continue;

      const world = getWorldDetailCellPosition(mechX, mechY, subX, subY, subdivisions);
      const currentFineElevation = detailCell.elevation;
      const coarseElevation = currentFineElevation / GAME_CONFIG.detailElevationPerMechLevel;

      cells.push({
        mechX,
        mechY,
        subX,
        subY,
        x: world.x,
        y: world.y,
        size: world.size,
        fineElevation: currentFineElevation,
        elevation: coarseElevation,
        leftFaceHeight: coarseElevation,
        rightFaceHeight: coarseElevation
      });
    }
  }

  return cells;
}

export function formatDetailElevation(fineElevation) {
  const coarseValue = fineElevation / GAME_CONFIG.detailElevationPerMechLevel;

  if (Number.isInteger(coarseValue)) {
    return String(coarseValue);
  }

  return coarseValue.toFixed(2).replace(/\.?0+$/, "");
}
