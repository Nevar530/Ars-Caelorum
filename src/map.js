import { GAME_CONFIG, MAP_CONFIG } from "./config.js";
import { clamp } from "./utils.js";

function createDetailGridForElevation(elevation) {
  const cells = [];
  const subdivisions = GAME_CONFIG.detailSubdivisionsPerMechTile;
  const fineElevation = elevation * GAME_CONFIG.detailElevationPerMechLevel;

  for (let sy = 0; sy < subdivisions; sy++) {
    const row = [];

    for (let sx = 0; sx < subdivisions; sx++) {
      row.push({
        sx,
        sy,
        elevation: fineElevation
      });
    }

    cells.push(row);
  }

  return {
    subdivisions,
    cells
  };
}

function buildTileSummary(tile) {
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

function refreshTileSummary(tile) {
  if (!tile) return tile;
  tile.summary = buildTileSummary(tile);
  return tile;
}

function createTile(x, y, elevation = 0) {
  return refreshTileSummary({
    x,
    y,
    elevation,
    detail: createDetailGridForElevation(elevation),
    summary: null
  });
}

function setDetailCellFine(tile, subX, subY, fineElevation) {
  if (!tile?.detail?.cells?.[subY]?.[subX]) return;
  tile.detail.cells[subY][subX].elevation = fineElevation;
}

function setDetailCell(tile, subX, subY, coarseElevation) {
  setDetailCellFine(
    tile,
    subX,
    subY,
    coarseElevation * GAME_CONFIG.detailElevationPerMechLevel
  );
}

function applyDetailPattern(tile, pattern) {
  if (!tile || !Array.isArray(pattern)) return;

  for (let sy = 0; sy < pattern.length; sy++) {
    const row = pattern[sy];
    if (!Array.isArray(row)) continue;

    for (let sx = 0; sx < row.length; sx++) {
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

  return map;
}

export function createInitialMap() {
  const map = [];

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    const row = [];

    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      let elevation = 0;

      if (x >= 3 && x <= 6 && y >= 3 && y <= 5) elevation = 1;
      if (x >= 4 && x <= 5 && y === 4) elevation = 2;
      if (x >= 8 && x <= 10 && y >= 2 && y <= 4) elevation = 1;
      if (x === 9 && y === 3) elevation = 2;
      if (x >= 1 && x <= 2 && y >= 8 && y <= 10) elevation = 1;

      row.push(createTile(x, y, elevation));
    }

    map.push(row);
  }

  // --------------------------------------------------
  // DETAIL TERRAIN TEST SET
  // --------------------------------------------------
  // Intent:
  // - give the default map a few real detail-shape tests
  // - keep them spread out so they are easy to inspect
  // - include both mech-enterable and mech-blocked examples
  // --------------------------------------------------

  // Gentle broken tile: should remain mech-enterable
  // Range = 1.0 total
  applyDetailPattern(getTile(map, 14, 14), [
    [0, 0.25, 0.25, 0.5],
    [0, 0.25, 0.5, 0.5],
    [0.25, 0.5, 0.75, 0.75],
    [0.5, 0.5, 0.75, 1]
  ]);

  // Hard jagged tile: should be mech-blocked
  // Range > 1.0 total
  applyDetailPattern(getTile(map, 15, 14), [
    [0, 0, 0, 0],
    [0, 0.5, 0.5, 0],
    [0, 1.5, 1.5, 0],
    [0, 2, 2, 0]
  ]);

  // Small stepped corner / wedge test
  applyDetailPattern(getTile(map, 16, 14), [
    [0, 0, 0.25, 0.5],
    [0, 0.25, 0.5, 0.75],
    [0.25, 0.5, 0.75, 1],
    [0.5, 0.75, 1, 1]
  ]);

  // Thin wall-like strip inside a flat tile
  applyDetailPattern(getTile(map, 14, 15), [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0]
  ]);

  // Platform corner / raised pad test
  applyDetailPattern(getTile(map, 15, 15), [
    [0, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0]
  ]);

  // Quarter-step single tile test
  applyDetailPattern(getTile(map, 16, 15), [
    [0, 0.25, 0.5, 0.75],
    [0.25, 0.5, 0.75, 1],
    [0.5, 0.75, 1, 1.25],
    [0.75, 1, 1.25, 1.5]
  ]);

  return refreshAllTileSummaries(map);
}

export function resetMap() {
  return createInitialMap();
}

export function getTile(map, x, y) {
  if (y < 0 || y >= MAP_CONFIG.mechHeight || x < 0 || x >= MAP_CONFIG.mechWidth) {
    return null;
  }

  return map[y][x];
}

export function getTileSummary(tile) {
  if (!tile) return null;
  if (!tile.summary) {
    refreshTileSummary(tile);
  }
  return tile.summary;
}

export function getDetailGrid(tile) {
  return tile?.detail ?? null;
}

export function getDetailCell(map, mechX, mechY, subX, subY) {
  const tile = getTile(map, mechX, mechY);
  if (!tile?.detail?.cells) return null;

  const subdivisions = tile.detail.subdivisions ?? GAME_CONFIG.detailSubdivisionsPerMechTile;
  if (subX < 0 || subY < 0 || subX >= subdivisions || subY >= subdivisions) {
    return null;
  }

  return tile.detail.cells[subY]?.[subX] ?? null;
}

export function changeElevation(map, x, y, delta) {
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

export function changeDetailElevation(map, mechX, mechY, subX, subY, delta) {
  const tile = getTile(map, mechX, mechY);
  const detailCell = getDetailCell(map, mechX, mechY, subX, subY);
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

export function getFineElevationAtWorldDetailCell(map, detailX, detailY) {
  const subdivisions = GAME_CONFIG.detailSubdivisionsPerMechTile;
  const mechX = Math.floor(detailX / subdivisions);
  const mechY = Math.floor(detailY / subdivisions);
  const subX = detailX - (mechX * subdivisions);
  const subY = detailY - (mechY * subdivisions);

  const detailCell = getDetailCell(map, mechX, mechY, subX, subY);
  if (detailCell) {
    return detailCell.elevation;
  }

  const tile = getTile(map, mechX, mechY);
  if (!tile) return 0;

  return getTileBaseFineElevation(tile);
}

export function getDetailRenderCells(map, mechX, mechY) {
  const tile = getTile(map, mechX, mechY);
  const detail = getDetailGrid(tile);
  if (!tile || !detail?.cells?.length) return [];

  const cells = [];
  const subdivisions = detail.subdivisions ?? GAME_CONFIG.detailSubdivisionsPerMechTile;

  for (let subY = 0; subY < subdivisions; subY++) {
    for (let subX = 0; subX < subdivisions; subX++) {
      const detailCell = detail.cells[subY]?.[subX];
      if (!detailCell) continue;

      const world = getWorldDetailCellPosition(mechX, mechY, subX, subY, subdivisions);
      const currentFineElevation = detailCell.elevation;
      const southFineElevation = getFineElevationAtWorldDetailCell(
        map,
        mechX * subdivisions + subX,
        mechY * subdivisions + subY + 1
      );
      const eastFineElevation = getFineElevationAtWorldDetailCell(
        map,
        mechX * subdivisions + subX + 1,
        mechY * subdivisions + subY
      );

      cells.push({
        mechX,
        mechY,
        subX,
        subY,
        x: world.x,
        y: world.y,
        size: world.size,
        fineElevation: currentFineElevation,
        elevation: currentFineElevation / GAME_CONFIG.detailElevationPerMechLevel,
        leftFaceHeight:
          Math.max(0, currentFineElevation - southFineElevation) /
          GAME_CONFIG.detailElevationPerMechLevel,
        rightFaceHeight:
          Math.max(0, currentFineElevation - eastFineElevation) /
          GAME_CONFIG.detailElevationPerMechLevel
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

export function tileTypeFromElevation(elevation) {
  if (elevation >= 3) return "peak";
  if (elevation >= 1) return "high";
  return "ground";
}

export function detailTypeFromFineElevation(fineElevation) {
  const coarse = Math.floor(fineElevation / GAME_CONFIG.detailElevationPerMechLevel);
  return tileTypeFromElevation(coarse);
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
