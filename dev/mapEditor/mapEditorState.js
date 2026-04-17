// Ars Caelorum — Map Editor State
// New module scaffold only. Not wired into runtime yet.

export const MAP_EDITOR_BRUSH_SIZES = [1, 2, 3, 4];

export const MAP_EDITOR_MODES = Object.freeze({
  HEIGHT: 'height',
  TERRAIN_TYPE: 'terrainType',
  TERRAIN_SPRITE: 'terrainSprite',
  FLAG: 'flag',
  SPAWN: 'spawn',
  ERASE: 'erase'
});

export const MAP_EDITOR_FLAG_KEYS = Object.freeze([
  'impassable',
  'difficult',
  'hazard'
]);

export const DEFAULT_TERRAIN_TYPES = Object.freeze([
  {
    id: 'clear',
    label: 'Clear',
    baseColor: '#4f8a3c'
  },
  {
    id: 'rough',
    label: 'Rough',
    baseColor: '#6f6a45'
  },
  {
    id: 'water',
    label: 'Water',
    baseColor: '#3d6ea8'
  },
  {
    id: 'road',
    label: 'Road',
    baseColor: '#666666'
  },
  {
    id: 'hazard',
    label: 'Hazard',
    baseColor: '#a85a2d'
  }
]);

export const DEFAULT_MAP_EDITOR_STATE = Object.freeze({
  isEnabled: false,
  activeMapId: 'default',
  mode: MAP_EDITOR_MODES.HEIGHT,
  brushSize: 1,
  selectedHeight: 0,
  selectedTerrainTypeId: 'clear',
  selectedTerrainSpriteId: null,
  selectedFlagKey: 'impassable',
  selectedFlagValue: true,
  selectedSpawnTeam: 'player',
  selectedSpawnIndex: 0,
  hoverTiles: [],
  pendingResize: {
    width: 32,
    height: 32,
    anchor: 'topLeft'
  }
});

export function createMapEditorState(overrides = {}) {
  return {
    ...structuredClone(DEFAULT_MAP_EDITOR_STATE),
    ...overrides,
    pendingResize: {
      ...DEFAULT_MAP_EDITOR_STATE.pendingResize,
      ...(overrides.pendingResize || {})
    }
  };
}
