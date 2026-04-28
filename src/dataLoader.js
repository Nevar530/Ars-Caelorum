import { normalizeMapDefinition } from "./map.js";

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
    missionCatalog,
    terrainList,
    terrainDefinitions
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
    loadJson("./data/missions/missionList.json").catch(() => null),
    loadJson("./data/terrain/terrainList.json").catch(() => []),
    loadJson("./data/terrain/terrain.json").catch(() => ({}))
  ]);

  const defaultMap = await loadDefaultMap(mapCatalog, missionCatalog).catch(() => null);
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
    spawnPoints,
    mapCatalog,
    missionCatalog,
    terrainList,
    terrainDefinitions,
    defaultMap: normalizedDefaultMap
  };
}

export async function loadMapDefinitionByPath(path) {
  if (!path) return null;
  const map = await loadJson(path);
  return normalizeMapDefinition(map);
}

export async function loadMissionDefinitionByPath(path) {
  if (!path) return null;
  return loadJson(path);
}

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function loadDefaultMap(mapCatalog, missionCatalog) {
  const defaultMission = getDefaultMissionEntry(missionCatalog);
  if (defaultMission?.path) {
    const missionDefinition = await loadMissionDefinitionByPath(defaultMission.path).catch(() => null);
    if (missionDefinition?.mapPath) {
      return loadJson(missionDefinition.mapPath);
    }
  }

  const maps = Array.isArray(mapCatalog?.maps) ? mapCatalog.maps : [];
  if (!maps.length) return null;

  const defaultMapId = mapCatalog?.defaultMapId ?? maps[0]?.id ?? null;
  const defaultEntry = maps.find((entry) => entry?.id === defaultMapId) ?? maps[0] ?? null;
  if (!defaultEntry?.path) return null;

  return loadJson(defaultEntry.path);
}

function getDefaultMissionEntry(missionCatalog) {
  const missions = Array.isArray(missionCatalog?.missions) ? missionCatalog.missions : [];
  if (!missions.length) return null;

  const defaultMissionId = missionCatalog?.defaultMissionId ?? missions[0]?.id ?? null;
  return missions.find((entry) => entry?.id === defaultMissionId) ?? missions[0] ?? null;
}
