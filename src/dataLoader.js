import { normalizeMapDefinition, getMapSpawns } from "./map.js";

export async function loadGameData() {
  const [
    mechs,
    weapons,
    sigils,
    attacks,
    pilots,
    pilotAbilities,
    mechAbilities,
    pilotItems,
    mechItems,
    spawnPoints,
    mapCatalog,
    terrainList,
    terrainDefinitions,
    missionCatalog
  ] = await Promise.all([
    loadJson("./data/mechs.json"),
    loadJson("./data/weapons.json"),
    loadJson("./data/sigils.json"),
    loadJson("./data/attacks.json"),
    loadJson("./data/pilots.json"),
    loadJson("./data/pilot_abilities.json").catch(() => []),
    loadJson("./data/mech_abilities.json").catch(() => []),
    loadJson("./data/pilot_items.json").catch(() => []),
    loadJson("./data/mech_items.json").catch(() => []),
    loadJson("./data/spawnPoints.json"),
    loadJson("./data/maps/mapList.json").catch(() => null),
    loadJson("./data/terrain/terrainList.json").catch(() => []),
    loadJson("./data/terrain/terrain.json").catch(() => ({})),
    loadJson("./data/missions.json").catch(() => ({ defaultMissionId: null, missions: [] }))
  ]);

  const hydratedMapCatalog = await hydrateMapCatalog(mapCatalog).catch(() => mapCatalog);
  const defaultMap = await loadDefaultMap(hydratedMapCatalog).catch(() => null);
  const normalizedDefaultMap = defaultMap ? normalizeMapDefinition(defaultMap) : null;

  return {
    mechs,
    weapons,
    sigils,
    attacks,
    pilots,
    pilotAbilities,
    mechAbilities,
    pilotItems,
    mechItems,
    spawnPoints: normalizedDefaultMap
      ? mapSpawnsToLegacySpawnPoints(getMapSpawns(normalizedDefaultMap))
      : spawnPoints,
    mapCatalog: hydratedMapCatalog,
    terrainList,
    terrainDefinitions,
    missionCatalog,
    defaultMap: normalizedDefaultMap
  };
}


async function hydrateMapCatalog(mapCatalog) {
  const maps = Array.isArray(mapCatalog?.maps) ? mapCatalog.maps : [];
  if (!maps.length) return mapCatalog;

  const hydratedMaps = await Promise.all(maps.map(async (entry) => ({
    ...entry,
    definition: entry?.path ? await loadJson(entry.path).catch(() => null) : null
  })));

  return {
    ...mapCatalog,
    maps: hydratedMaps
  };
}
async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function loadDefaultMap(mapCatalog) {
  const maps = Array.isArray(mapCatalog?.maps) ? mapCatalog.maps : [];
  if (!maps.length) return null;

  const defaultMapId = mapCatalog?.defaultMapId ?? maps[0]?.id ?? null;
  const defaultEntry = maps.find((entry) => entry?.id === defaultMapId) ?? maps[0] ?? null;
  if (!defaultEntry?.path) return null;

  return loadJson(defaultEntry.path);
}

function mapSpawnsToLegacySpawnPoints(spawns = {}) {
  const points = [];

  for (const team of ["player", "enemy"]) {
    const entries = Array.isArray(spawns?.[team]) ? spawns[team] : [];

    entries.forEach((spawn, index) => {
      if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) return;

      points.push({
        id: `${team}_${index + 1}`,
        label: `${capitalize(team)} ${index + 1}`,
        x: spawn.x,
        y: spawn.y,
        unitType: "mech"
      });
    });
  }

  return points;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}
