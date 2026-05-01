import { MAP_CONFIG } from "../config.js";
import {
  applyDetailPattern,
  createTile,
  flattenMapTiles,
  refreshAllTileSummaries
} from "./mapTiles.js";

export function attachMapMetadata(map, metadata = {}) {
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
      value: structuredClone(metadata.spawns ?? map.spawns ?? { player: [], enemy: [], neutral: [] }),
      writable: true,
      configurable: true
    },
    startState: {
      value: structuredClone(metadata.startState ?? map.startState ?? { deployments: [] }),
      writable: true,
      configurable: true
    },
    structures: {
      value: structuredClone(metadata.structures ?? map.structures ?? []),
      writable: true,
      configurable: true
    },
    terrainTypes: {
      value: Array.isArray(metadata.terrainTypes)
        ? [...metadata.terrainTypes]
        : Array.isArray(map.terrainTypes)
          ? [...map.terrainTypes]
          : ["grass", "rock", "sand", "water", "asphalt", "concrete"],
      writable: true,
      configurable: true
    }
  });

  return map;
}

export function buildMapFromFlatTiles(definition = {}) {
  const width = Number(definition.width ?? MAP_CONFIG.width);
  const height = Number(definition.height ?? MAP_CONFIG.height);
  const byCoord = new Map();

  for (const rawTile of Array.isArray(definition.tiles) ? definition.tiles : []) {
    if (!rawTile) continue;
    byCoord.set(`${rawTile.x},${rawTile.y}`, rawTile);
  }

  const map = [];

  for (let y = 0; y < height; y += 1) {
    const row = [];

    for (let x = 0; x < width; x += 1) {
      const rawTile = byCoord.get(`${x},${y}`) ?? {};
      row.push(
        createTile(x, y, Number(rawTile.elevation ?? 0), {
          terrainTypeId: rawTile.terrainTypeId,
          terrainSpriteId: rawTile.terrainSpriteId,
          movementClass: rawTile.movementClass,
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
  return structuredClone(map?.spawns ?? { player: [], enemy: [], neutral: [] });
}

export function getMapStartState(map) {
  return structuredClone(map?.startState ?? { deployments: [] });
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

export function normalizeMapDefinition(definition) {
  if (Array.isArray(definition)) {
    return attachMapMetadata(refreshAllTileSummaries(definition), {
      id: definition.id,
      structures: definition.structures,
      name: definition.name,
      width: definition.width,
      height: definition.height,
      spawns: definition.spawns,
      startState: definition.startState,
      terrainTypes: definition.terrainTypes
    });
  }

  return refreshAllTileSummaries(buildMapFromFlatTiles(definition ?? {}));
}

export function cloneMapDefinition(sourceMap = null) {
  if (!sourceMap) return null;

  if (Array.isArray(sourceMap)) {
    const clonedRows = structuredClone(sourceMap);
    return attachMapMetadata(clonedRows, {
      structures: sourceMap.structures,
      id: sourceMap.id,
      name: sourceMap.name,
      width: sourceMap.width,
      height: sourceMap.height,
      spawns: sourceMap.spawns,
      startState: sourceMap.startState,
      terrainTypes: sourceMap.terrainTypes
    });
  }

  return structuredClone(sourceMap);
}

export function createInitialMap() {
  const map = [];

  for (let y = 0; y < MAP_CONFIG.height; y += 1) {
    const row = [];

    for (let x = 0; x < MAP_CONFIG.width; x += 1) {
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
    spawns: { player: [], enemy: [], neutral: [] },
    startState: { deployments: [] }
  });

  return refreshAllTileSummaries(map);
}

export function resetMap(sourceMap = null) {
  if (sourceMap) {
    return normalizeMapDefinition(cloneMapDefinition(sourceMap));
  }

  return createInitialMap();
}
