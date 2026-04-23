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
    loadJson("./data/terrain/terrainList.json").catch(() => []),
    loadJson("./data/terrain/terrain.json").catch(() => ({}))
  ]);

  const defaultMap = await loadDefaultMap(mapCatalog).catch(() => null);
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
