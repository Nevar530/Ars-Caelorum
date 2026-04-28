// Ars Caelorum — Runtime Map Schema Helpers

export function createDefaultTile(x, y, elevation = 0) {
  return {
    x,
    y,
    elevation,
    terrainTypeId: 'grass',
    terrainSpriteId: 'grass_001',
    movementClass: 'clear',
    spawnId: null,
    detail: null,
    summary: null
  };
}

export function createBlankMapDefinition({ id = 'new_map', name = 'New Map', width = 32, height = 32 } = {}) {
  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push(createDefaultTile(x, y));
    }
  }

  return {
    id,
    name,
    width,
    height,
    terrainTypes: ['grass', 'rock', 'sand', 'water', 'asphalt', 'concrete'],
    spawns: {
      player: [null, null, null, null],
      enemy: [null, null, null, null]
    },
    startState: {
      startMode: 'authored',
      playerDeployment: { unitType: 'pilot', requiredCount: 2 },
      deploymentCells: [],
      deployments: []
    },
    structures: [],
    tiles
  };
}
