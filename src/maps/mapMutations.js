// Ars Caelorum — Runtime Map Mutations
// New module scaffold only. Not wired into runtime yet.

import { createBlankMapDefinition } from './mapSchema.js';

export function replaceRuntimeMap(state, mapDefinition) {
  state.map = structuredClone(mapDefinition);
  return state.map;
}

export function resetRuntimeMap(state, options = {}) {
  state.map = createBlankMapDefinition(options);
  return state.map;
}

export function updateTile(state, x, y, partialTile) {
  const tile = state?.map?.tiles?.find((entry) => entry.x === x && entry.y === y);
  if (!tile) return null;
  Object.assign(tile, partialTile);
  return tile;
}
