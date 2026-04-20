// Ars Caelorum — Map Editor Actions

import { changeElevation, getMapHeight, getMapWidth, getTile, normalizeMapDefinition } from '../../src/map.js';
import { createMapEditorState, MAP_EDITOR_MODES } from './mapEditorState.js';
import { getBrushedTileCoords } from './mapBrush.js';
import { buildMapDefinitionFromRuntimeMap } from './mapSerialization.js';
import { createBlankMapDefinition } from '../../src/maps/mapSchema.js';
import {
  buildSpawnId,
  ensureMapSpawns,
  parseSpawnId,
  syncContentSpawnPointsFromMap,
  clearSpawnIdFromTiles
} from '../../src/maps/mapSpawns.js';

export function ensureMapEditorState(state) {
  if (!state.ui.mapEditor) {
    state.ui.mapEditor = createMapEditorState({
      activeMapId: state.map?.id ?? 'default',
      pendingResize: {
        width: getMapWidth(state.map) || 32,
        height: getMapHeight(state.map) || 32,
        anchor: 'topLeft'
      }
    });
  }

  return state.ui.mapEditor;
}

export function setMapEditorEnabled(state, value) {
  ensureMapEditorState(state).isEnabled = Boolean(value);
}

export function setMapEditorMode(state, mode) {
  ensureMapEditorState(state).mode = String(mode || MAP_EDITOR_MODES.HEIGHT);
}

export function setMapEditorBrushSize(state, brushSize) {
  ensureMapEditorState(state).brushSize = Math.max(1, Number(brushSize) || 1);
}

export function setMapEditorHeight(state, height) {
  ensureMapEditorState(state).selectedHeight = Math.max(0, Number(height) || 0);
}

export function setMapEditorTerrainPreset(state, presetId) {
  const editor = ensureMapEditorState(state);
  editor.selectedTerrainPresetId = String(presetId || 'grass');

  const definition = getTerrainDefinition(state, editor.selectedTerrainPresetId);
  if (definition?.movementClass) {
    editor.selectedMovementClass = definition.movementClass;
  }
}

export function setMapEditorMovementClass(state, movementClass) {
  ensureMapEditorState(state).selectedMovementClass = String(movementClass || 'clear');
}

export function setMapEditorSpawnBrush(state, team, index) {
  const editor = ensureMapEditorState(state);
  editor.selectedSpawnTeam = team === 'enemy' ? 'enemy' : 'player';
  editor.selectedSpawnIndex = Math.max(0, Math.min(3, Number(index) || 0));
}

export function setMapEditorPendingResize(state, width, height, anchor = 'topLeft') {
  const editor = ensureMapEditorState(state);
  editor.pendingResize = {
    width: Math.max(1, Number(width) || 1),
    height: Math.max(1, Number(height) || 1),
    anchor: anchor || 'topLeft'
  };
}


export function setMapEditorStatus(state, message = '', tone = 'info') {
  const editor = ensureMapEditorState(state);
  editor.statusMessage = String(message || '');
  editor.statusTone = tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'info';
}

function getTerrainDefinition(state, presetId) {
  return state?.content?.terrainDefinitions?.[presetId] ?? null;
}

function getTerrainDefaults(state, presetId) {
  const definition = getTerrainDefinition(state, presetId) ?? {};
  return {
    terrainTypeId: presetId || 'grass',
    terrainSpriteId: definition.spriteSetId ?? null,
    movementClass: definition.movementClass ?? 'clear'
  };
}

function applyHeightBrush(state, tile, editor) {
  const current = Number(tile.elevation ?? 0);
  const target = Number(editor.selectedHeight ?? 0);
  if (current !== target) {
    changeElevation(state.map, tile.x, tile.y, target - current);
  }
}

function applyTerrainPresetBrush(state, tile, editor) {
  const defaults = getTerrainDefaults(state, editor.selectedTerrainPresetId);
  tile.terrainTypeId = defaults.terrainTypeId;
  tile.terrainSpriteId = defaults.terrainSpriteId;
  tile.movementClass = editor.selectedMovementClass || defaults.movementClass;
}

function applyMovementClassBrush(tile, editor) {
  tile.movementClass = editor.selectedMovementClass ?? 'clear';
}

function applySpawnBrush(state, tile, editor) {
  ensureMapSpawns(state.map);
  const team = editor.selectedSpawnTeam === 'enemy' ? 'enemy' : 'player';
  const index = Math.max(0, Math.min(3, Number(editor.selectedSpawnIndex) || 0));
  const spawnId = buildSpawnId(team, index);
  clearSpawnIdFromTiles(state.map, spawnId, getMapWidth, getMapHeight, getTile);
  state.map.spawns[team][index] = { x: tile.x, y: tile.y };
  tile.spawnId = spawnId;
  syncContentSpawnPointsFromMap(state);
}

function applyEraseBrush(state, tile) {
  const defaults = getTerrainDefaults(state, 'grass');
  tile.terrainTypeId = defaults.terrainTypeId;
  tile.terrainSpriteId = defaults.terrainSpriteId;
  tile.movementClass = defaults.movementClass;
  if (tile.spawnId) {
    const parsed = parseSpawnId(tile.spawnId);
    if (parsed && state.map?.spawns?.[parsed.team]?.[parsed.index]) {
      state.map.spawns[parsed.team][parsed.index] = null;
    }
  }
  tile.spawnId = null;
  syncContentSpawnPointsFromMap(state);
}

export function applyMapEditorAtTile(state, originX, originY) {
  const editor = ensureMapEditorState(state);
  const width = getMapWidth(state.map);
  const height = getMapHeight(state.map);
  const coords = getBrushedTileCoords(originX, originY, editor.brushSize, width, height);

  for (const { x, y } of coords) {
    const tile = getTile(state.map, x, y);
    if (!tile) continue;

    switch (editor.mode) {
      case MAP_EDITOR_MODES.HEIGHT:
        applyHeightBrush(state, tile, editor);
        break;
      case MAP_EDITOR_MODES.TERRAIN_PRESET:
        applyTerrainPresetBrush(state, tile, editor);
        break;
      case MAP_EDITOR_MODES.MOVEMENT_CLASS:
        applyMovementClassBrush(tile, editor);
        break;
      case MAP_EDITOR_MODES.SPAWN:
        applySpawnBrush(state, tile, editor);
        break;
      case MAP_EDITOR_MODES.ERASE:
        applyEraseBrush(state, tile);
        break;
      default:
        break;
    }
  }

  state.content.defaultMap = buildMapDefinitionFromRuntimeMap(state.map);
  syncContentSpawnPointsFromMap(state);
  setMapEditorStatus(state, '');
}

export function sampleMapEditorFromTile(state, x, y) {
  const editor = ensureMapEditorState(state);
  const tile = getTile(state.map, x, y);
  if (!tile) return editor;

  editor.selectedHeight = Number(tile.elevation ?? 0);
  editor.selectedTerrainPresetId = tile.terrainTypeId ?? 'grass';
  editor.selectedMovementClass = tile.movementClass ?? 'clear';

  if (tile.spawnId) {
    const parsed = parseSpawnId(tile.spawnId);
    if (parsed) {
      editor.selectedSpawnTeam = parsed.team === 'enemy' ? 'enemy' : 'player';
      editor.selectedSpawnIndex = Math.max(0, parsed.index);
    }
  }

  return editor;
}

export function replaceRuntimeMapFromDefinition(state, mapDefinition) {
  const normalized = normalizeMapDefinition(structuredClone(mapDefinition));
  state.map = normalized;
  state.content.defaultMap = buildMapDefinitionFromRuntimeMap(normalized);
  syncContentSpawnPointsFromMap(state);
  const editor = ensureMapEditorState(state);
  editor.activeMapId = normalized.id ?? editor.activeMapId;
  editor.pendingResize.width = getMapWidth(normalized);
  editor.pendingResize.height = getMapHeight(normalized);
  setMapEditorStatus(state, '');
  return normalized;
}

export function resizeRuntimeMap(state, width, height) {
  const nextWidth = Math.max(1, Number(width) || 1);
  const nextHeight = Math.max(1, Number(height) || 1);
  const currentDefinition = buildMapDefinitionFromRuntimeMap(state.map);
  const blank = createBlankMapDefinition({
    id: currentDefinition.id,
    name: currentDefinition.name,
    width: nextWidth,
    height: nextHeight
  });

  const byCoord = new Map(currentDefinition.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      const existing = byCoord.get(`${x},${y}`);
      if (!existing) continue;
      const target = blank.tiles.find((tile) => tile.x === x && tile.y === y);
      if (!target) continue;
      Object.assign(target, structuredClone(existing));
    }
  }

  for (const team of ['player', 'enemy']) {
    blank.spawns[team] = (currentDefinition.spawns?.[team] ?? [null, null, null, null]).map((spawn) => {
      if (!spawn) return null;
      if (spawn.x < 0 || spawn.y < 0 || spawn.x >= nextWidth || spawn.y >= nextHeight) return null;
      return { x: spawn.x, y: spawn.y };
    });
  }

  return replaceRuntimeMapFromDefinition(state, blank);
}
