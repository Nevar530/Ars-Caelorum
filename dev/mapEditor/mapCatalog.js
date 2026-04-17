// Ars Caelorum — Map and Terrain Catalog Loaders

export async function loadMapCatalog(path = './data/maps/mapList.json') {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load map catalog: ${response.status}`);
  }
  return response.json();
}

export async function loadMapDefinition(mapPath) {
  const response = await fetch(mapPath);
  if (!response.ok) {
    throw new Error(`Failed to load map definition: ${response.status}`);
  }
  return response.json();
}

export async function loadTerrainList(path = './data/terrain/terrainList.json') {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load terrain list: ${response.status}`);
  }
  return response.json();
}

export async function loadTerrainDefinitions(path = './data/terrain/terrain.json') {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load terrain definitions: ${response.status}`);
  }
  return response.json();
}
