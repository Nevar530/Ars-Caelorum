// Ars Caelorum — Map Editor State

export const MAP_EDITOR_BRUSH_SIZES = [1, 2, 3, 4];

export const MAP_EDITOR_MODES = Object.freeze({
  HEIGHT: 'height',
  TERRAIN_PRESET: 'terrainPreset',
  MOVEMENT_CLASS: 'movementClass',
  SPAWN: 'spawn',
  ERASE: 'erase'
});

export const DEFAULT_MOVEMENT_CLASSES = Object.freeze([
  { id: 'clear', label: 'Clear' },
  { id: 'difficult', label: 'Difficult' },
  { id: 'impassable', label: 'Impassable' },
  { id: 'hazard', label: 'Hazard' }
]);

export const DEFAULT_TERRAIN_PRESETS = Object.freeze([
  { id: 'grass', label: 'Grass', baseColor: '#5f8f4f', spriteSetId: 'grass_001', movementClass: 'clear' },
  { id: 'rock', label: 'Rock', baseColor: '#7a7a72', spriteSetId: 'rock_001', movementClass: 'difficult' },
  { id: 'sand', label: 'Sand', baseColor: '#c8b27a', spriteSetId: 'sand_001', movementClass: 'difficult' },
  { id: 'water', label: 'Water', baseColor: '#4c7ea8', spriteSetId: 'water_001', movementClass: 'impassable' },
  { id: 'asphalt', label: 'Asphalt', baseColor: '#4c4f55', spriteSetId: 'asphalt_001', movementClass: 'clear' },
  { id: 'concrete', label: 'Concrete', baseColor: '#9a9a94', spriteSetId: 'concrete_001', movementClass: 'clear' }
]);

export const DEFAULT_MAP_EDITOR_STATE = Object.freeze({
  isEnabled: false,
  activeMapId: 'default',
  mode: MAP_EDITOR_MODES.HEIGHT,
  brushSize: 1,
  selectedHeight: 0,
  selectedTerrainPresetId: 'grass',
  selectedMovementClass: 'clear',
  selectedSpawnTeam: 'player',
  selectedSpawnIndex: 0,
  hoverTiles: [],
  statusMessage: '',
  statusTone: 'info',
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
