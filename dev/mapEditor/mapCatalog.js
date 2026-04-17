// Ars Caelorum — Map Catalog Loader

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
