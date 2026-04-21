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



function ensureMapStartState(map) {
  if (!map.startState || typeof map.startState !== 'object') {
    map.startState = { deployments: [] };
  }
  if (!Array.isArray(map.startState.deployments)) {
    map.startState.deployments = [];
  }
  return map.startState;
}

function normalizeDeploymentEntry(entry = {}, index = 0) {
  const team = entry?.team === 'enemy' ? 'enemy' : 'player';
  const controlType = entry?.controlType === 'CPU' ? 'CPU' : 'PC';

  return {
    pilotDefinitionId: String(entry?.pilotDefinitionId ?? entry?.pilotId ?? ''),
    pilotInstanceId: String(entry?.pilotInstanceId ?? `${team}-pilot-${index + 1}`),
    pilotSpawnId: String(entry?.pilotSpawnId ?? ''),
    mechDefinitionId: String(entry?.mechDefinitionId ?? entry?.mechId ?? ''),
    mechInstanceId: String(entry?.mechInstanceId ?? `${team}-mech-${index + 1}`),
    mechSpawnId: String(entry?.mechSpawnId ?? ''),
    team,
    controlType,
    startEmbarked: Boolean(entry?.startEmbarked)
  };
}

function syncEditorMapDefinition(state) {
  syncEditorMapDefinition(state);
}

export function getMapEditorDeployments(state) {
  const startState = ensureMapStartState(state.map);
  startState.deployments = startState.deployments.map((entry, index) => normalizeDeploymentEntry(entry, index));
  return startState.deployments;
}

export function addMapEditorDeployment(state) {
  const deployments = getMapEditorDeployments(state);
  const nextIndex = deployments.length;
  const nextTeam = nextIndex % 2 === 1 ? 'enemy' : 'player';

  deployments.push(normalizeDeploymentEntry({
    team: nextTeam,
    controlType: nextTeam === 'enemy' ? 'CPU' : 'PC',
    startEmbarked: false
  }, nextIndex));

  syncEditorMapDefinition(state);
  return deployments;
}

export function removeMapEditorDeployment(state, index) {
  const deployments = getMapEditorDeployments(state);
  if (index < 0 || index >= deployments.length) return deployments;
  deployments.splice(index, 1);
  state.map.startState.deployments = deployments.map((entry, rowIndex) => normalizeDeploymentEntry(entry, rowIndex));
  syncEditorMapDefinition(state);
  return state.map.startState.deployments;
}

export function updateMapEditorDeploymentField(state, index, field, value) {
  const deployments = getMapEditorDeployments(state);
  if (index < 0 || index >= deployments.length) return null;

  const entry = { ...deployments[index] };

  switch (field) {
    case 'pilotDefinitionId':
    case 'pilotInstanceId':
    case 'pilotSpawnId':
    case 'mechDefinitionId':
    case 'mechInstanceId':
    case 'mechSpawnId':
      entry[field] = String(value ?? '');
      break;
    case 'team':
      entry.team = value === 'enemy' ? 'enemy' : 'player';
      break;
    case 'controlType':
      entry.controlType = value === 'CPU' ? 'CPU' : 'PC';
      break;
    case 'startEmbarked':
      entry.startEmbarked = Boolean(value);
      break;
    default:
      return null;
  }

  deployments[index] = normalizeDeploymentEntry(entry, index);
  state.map.startState.deployments = deployments;
  syncEditorMapDefinition(state);
  return deployments[index];
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

  syncEditorMapDefinition(state);
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
  syncEditorMapDefinition(state);
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
