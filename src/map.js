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

function createTile(x, y, elevation = 0, overrides = {}) {
  const hasDetail = overrides.detail && Array.isArray(overrides.detail.cells);
  const detail = hasDetail
    ? overrides.detail
    : createDetailGridForElevation(elevation);

  return refreshTileSummary({
    x,
    y,
    elevation,
    terrainTypeId: overrides.terrainTypeId ?? "clear",
    terrainSpriteId: overrides.terrainSpriteId ?? null,
    flags: {
      impassable: Boolean(overrides.flags?.impassable),
      difficult: Boolean(overrides.flags?.difficult),
      hazard: Boolean(overrides.flags?.hazard)
    },
    spawnId: overrides.spawnId ?? null,
    detail,
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

function flattenMapTiles(map) {
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

function attachMapMetadata(map, metadata = {}) {
  if (!Array.isArray(map)) return map;

  const width = Number(metadata.width ?? map.width ?? map[0]?.length ?? 0);
  const height = Number(metadata.height ?? map.height ?? map.length ?? 0);

  Object.defineProperties(map, {
    id: { value: metadata.id ?? map.id ?? "runtime_map", writable: true, configurable: true },
    name: { value: metadata.name ?? map.name ?? "Runtime Map", writable: true, configurable: true },
    width: { value: width, writable: true, configurable: true },
    height: { value: height, writable: true, configurable: true },
    tiles: { value: flattenMapTiles(map), writable: true, configurable: true },
    spawns: {
      value: structuredClone(metadata.spawns ?? map.spawns ?? { player: [], enemy: [] }),
      writable: true,
      configurable: true
    },
    terrainTypes: {
      value: Array.isArray(metadata.terrainTypes)
        ? [...metadata.terrainTypes]
        : Array.isArray(map.terrainTypes)
          ? [...map.terrainTypes]
          : ["clear", "rough", "water", "road", "hazard"],
      writable: true,
      configurable: true
    }
  });

  return map;
}

function buildMapFromFlatTiles(definition = {}) {
  const width = Number(definition.width ?? MAP_CONFIG.width);
  const height = Number(definition.height ?? MAP_CONFIG.height);
  const byCoord = new Map();

  for (const rawTile of Array.isArray(definition.tiles) ? definition.tiles : []) {
    if (!rawTile) continue;
    byCoord.set(`${rawTile.x},${rawTile.y}`, rawTile);
  }

  const map = [];

  for (let y = 0; y < height; y++) {
    const row = [];

    for (let x = 0; x < width; x++) {
      const rawTile = byCoord.get(`${x},${y}`) ?? {};
      row.push(
        createTile(x, y, Number(rawTile.elevation ?? 0), {
          terrainTypeId: rawTile.terrainTypeId,
          terrainSpriteId: rawTile.terrainSpriteId,
          flags: rawTile.flags,
          spawnId: rawTile.spawnId,
          detail: rawTile.detail
        })
      );
    }

    map.push(row);
  }

  return attachMapMetadata(map, definition);
}

export function getMapWidth(map) {
  if (Array.isArray(map?.tiles) && Number.isFinite(map?.width)) {
    return map.width;
  }

  if (Array.isArray(map)) {
    return Number(map.width ?? map[0]?.length ?? 0);
  }

  return 0;
}

export function getMapHeight(map) {
  if (Array.isArray(map?.tiles) && Number.isFinite(map?.height)) {
    return map.height;
  }

  if (Array.isArray(map)) {
    return Number(map.height ?? map.length ?? 0);
  }

  return 0;
}

export function getMapSpawns(map) {
  return structuredClone(map?.spawns ?? { player: [], enemy: [] });
}

export function normalizeMapDefinition(definition) {
  if (Array.isArray(definition)) {
    return attachMapMetadata(refreshAllTileSummaries(definition));
  }

  return refreshAllTileSummaries(buildMapFromFlatTiles(definition ?? {}));
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

export function createInitialMap() {
  const map = [];

  for (let y = 0; y < MAP_CONFIG.height; y++) {
    const row = [];

    for (let x = 0; x < MAP_CONFIG.width; x++) {
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

  applyDetailPattern(getTile(map, 14, 14), [
    [0, 0.25, 0.25, 0.5],
    [0, 0.25, 0.5, 0.5],
    [0.25, 0.5, 0.75, 0.75],
    [0.5, 0.5, 0.75, 1]
  ]);

  applyDetailPattern(getTile(map, 15, 14), [
    [0, 0, 0, 0],
    [0, 0.5, 0.5, 0],
    [0, 1.5, 1.5, 0],
    [0, 2, 2, 0]
  ]);

  applyDetailPattern(getTile(map, 16, 14), [
    [0, 0, 0.25, 0.5],
    [0, 0.25, 0.5, 0.75],
    [0.25, 0.5, 0.75, 1],
    [0.5, 0.75, 1, 1]
  ]);

  applyDetailPattern(getTile(map, 14, 15), [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0]
  ]);

  applyDetailPattern(getTile(map, 15, 15), [
    [0, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0]
  ]);

  applyDetailPattern(getTile(map, 16, 15), [
    [0, 0.25, 0.5, 0.75],
    [0.25, 0.5, 0.75, 1],
    [0.5, 0.75, 1, 1.25],
    [0.75, 1, 1.25, 1.5]
  ]);

  attachMapMetadata(map, {
    id: "legacy_default",
    name: "Legacy Default Map",
    width: MAP_CONFIG.width,
    height: MAP_CONFIG.height,
    spawns: { player: [], enemy: [] }
  });

  return refreshAllTileSummaries(map);
}

export function resetMap(sourceMap = null) {
  if (sourceMap) {
    return normalizeMapDefinition(structuredClone(sourceMap));
  }

  return createInitialMap();
}

export function getTile(map, x, y) {
  const mapWidth = getMapWidth(map);
  const mapHeight = getMapHeight(map);

  if (y < 0 || y >= mapHeight || x < 0 || x >= mapWidth) {
    return null;
  }

  if (Array.isArray(map)) {
    return map[y]?.[x] ?? null;
  }

  if (Array.isArray(map?.tiles)) {
    return map.tiles.find((tile) => tile.x === x && tile.y === y) ?? null;
  }

  return null;
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
