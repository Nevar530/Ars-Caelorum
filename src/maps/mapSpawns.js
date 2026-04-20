export function buildSpawnId(team, index) {
  return `${team}_${index + 1}`;
}

export function parseSpawnId(spawnId) {
  if (!spawnId) return null;
  const [team, rawIndex] = String(spawnId).split('_');
  const index = Number(rawIndex) - 1;
  if (!team || Number.isNaN(index)) return null;
  return { team, index };
}

export function ensureMapSpawns(map) {
  if (!map.spawns) {
    map.spawns = { player: [null, null, null, null], enemy: [null, null, null, null] };
  }
  if (!Array.isArray(map.spawns.player)) map.spawns.player = [null, null, null, null];
  if (!Array.isArray(map.spawns.enemy)) map.spawns.enemy = [null, null, null, null];
  while (map.spawns.player.length < 4) map.spawns.player.push(null);
  while (map.spawns.enemy.length < 4) map.spawns.enemy.push(null);
  return map.spawns;
}

export function clearSpawnIdFromTiles(map, spawnId, getMapWidth, getMapHeight, getTile) {
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = getTile(map, x, y);
      if (tile?.spawnId === spawnId) tile.spawnId = null;
    }
  }
}

export function buildLegacySpawnPoints(map) {
  ensureMapSpawns(map);
  const points = [];

  for (const team of ['player', 'enemy']) {
    map.spawns[team].forEach((spawn, index) => {
      if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) return;
      points.push({
        id: buildSpawnId(team, index),
        label: `${team.charAt(0).toUpperCase()}${team.slice(1)} ${index + 1}`,
        x: spawn.x,
        y: spawn.y,
        unitType: 'mech'
      });
    });
  }

  return points;
}

export function syncContentSpawnPointsFromMap(state) {
  state.content.spawnPoints = buildLegacySpawnPoints(state.map);
  return state.content.spawnPoints;
}

// Temporary compatibility export while callers finish moving off the old name.
export const syncLegacySpawnPoints = syncContentSpawnPointsFromMap;
