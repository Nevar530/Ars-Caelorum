// Ars Caelorum — Runtime Map Access Helpers
// New module scaffold only. Not wired into runtime yet.

export function getRuntimeMap(state) {
  return state?.map ?? null;
}

export function getRuntimeMapWidth(state) {
  return getRuntimeMap(state)?.width ?? 0;
}

export function getRuntimeMapHeight(state) {
  return getRuntimeMap(state)?.height ?? 0;
}

export function getRuntimeTileByCoord(state, x, y) {
  const map = getRuntimeMap(state);
  if (!map) return null;
  return map.tiles.find((tile) => tile.x === x && tile.y === y) ?? null;
}
