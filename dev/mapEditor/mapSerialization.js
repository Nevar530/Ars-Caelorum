// Ars Caelorum — Map Serialization

import { getMapHeight, getMapWidth, getTile } from '../../src/map.js';

export function buildMapDefinitionFromRuntimeMap(map) {
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const tiles = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      tiles.push({
        x,
        y,
        elevation: Number(tile.elevation ?? 0),
        terrainTypeId: tile.terrainTypeId ?? 'clear',
        terrainSpriteId: tile.terrainSpriteId ?? null,
        flags: {
          impassable: Boolean(tile.flags?.impassable),
          difficult: Boolean(tile.flags?.difficult),
          hazard: Boolean(tile.flags?.hazard)
        },
        spawnId: tile.spawnId ?? null,
        detail: structuredClone(tile.detail ?? null)
      });
    }
  }

  return {
    id: map?.id ?? 'exported_map',
    name: map?.name ?? 'Exported Map',
    width,
    height,
    terrainTypes: Array.isArray(map?.terrainTypes) ? [...map.terrainTypes] : ['clear', 'rough', 'water', 'road', 'hazard'],
    spawns: structuredClone(map?.spawns ?? { player: [null, null, null, null], enemy: [null, null, null, null] }),
    tiles
  };
}

export function serializeMapDefinition(mapDefinition) {
  return JSON.stringify(mapDefinition, null, 2);
}

export function parseMapDefinition(text) {
  return JSON.parse(text);
}

export function downloadMapDefinition(filename, mapDefinition) {
  const blob = new Blob([serializeMapDefinition(mapDefinition)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
