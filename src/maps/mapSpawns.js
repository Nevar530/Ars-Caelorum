// Ars Caelorum — Map Spawn Helpers
// New module scaffold only. Not wired into runtime yet.

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
