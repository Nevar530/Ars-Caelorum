// Ars Caelorum — Map Editor Actions

import { MAP_CONFIG } from '../../src/config.js';
import { changeElevation, getMapHeight, getMapWidth, getTile, normalizeMapDefinition } from '../../src/map.js';
import { createBlankMapDefinition } from '../../src/maps/mapSchema.js';
import { getBrushedTileCoords } from './mapBrush.js';
import { createMapEditorState, MAP_EDITOR_MODES } from './mapEditorState.js';
import { buildSpawnId } from '../../src/maps/mapSpawns.js';
import { buildMapDefinitionFromRuntimeMap } from './mapSerialization.js';

export function ensureMapEditorState(state) {
  if (!state.mapEditor) {
    state.mapEditor = createMapEditorState({
      pendingResize: {
        width: getMapWidth(state.map) || 32,
        height: getMapHeight(state.map) || 32,
        anchor: 'topLeft'
      }
    });
  }
  return state.mapEditor;
}

export function setMapEditorEnabled(state, isEnabled) {
  ensureMapEditorState(state).isEnabled = Boolean(isEnabled);
}

export function setMapEditorMode(state, mode) {
  ensureMapEditorState(state).mode = mode;
}

export function setMapEditorBrushSize(state, brushSize) {
  ensureMapEditorState(state).brushSize = Math.max(1, Number(brushSize) || 1);
}

export function setMapEditorHeight(state, selectedHeight) {
  const clamped = Math.max(MAP_CONFIG.minElevation, Math.min(MAP_CONFIG.maxElevation, Number(selectedHeight) || 0));
  ensureMapEditorState(state).selectedHeight = clamped;
}

export function setMapEditorTerrainType(state, terrainTypeId) {
  ensureMapEditorState(state).selectedTerrainTypeId = String(terrainTypeId || 'clear');
}

export function setMapEditorTerrainSprite(state, terrainSpriteId) {
  ensureMapEditorState(state).selectedTerrainSpriteId = terrainSpriteId == null ? '' : String(terrainSpriteId);
}

export function setMapEditorFlag(state, selectedFlagKey, selectedFlagValue = true) {
  const editor = ensureMapEditorState(state);
  editor.selectedFlagKey = String(selectedFlagKey || 'impassable');
  editor.selectedFlagValue = Boolean(selectedFlagValue);
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

function ensureMapSpawns(map) {
  if (!map.spawns) {
    map.spawns = { player: [null, null, null, null], enemy: [null, null, null, null] };
  }
  if (!Array.isArray(map.spawns.player)) map.spawns.player = [null, null, null, null];
  if (!Array.isArray(map.spawns.enemy)) map.spawns.enemy = [null, null, null, null];
  while (map.spawns.player.length < 4) map.spawns.player.push(null);
  while (map.spawns.enemy.length < 4) map.spawns.enemy.push(null);
}

function syncLegacySpawnPoints(state) {
  ensureMapSpawns(state.map);
  const points = [];
  for (const team of ['player', 'enemy']) {
    state.map.spawns[team].forEach((spawn, index) => {
      if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) return;
      points.push({
        id: buildSpawnId(team, index),
        label: `${team.charAt(0).toUpperCase()}${team.slice(1)} ${index + 1}`,
        x: spawn.x,
        y: spawn.y,
        unitType: 'mech'
      });
    });
  }
  state.content.spawnPoints = points;
}

function clearSpawnIdFromTiles(map, spawnId) {
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = getTile(map, x, y);
      if (tile?.spawnId === spawnId) tile.spawnId = null;
    }
  }
}

function applyHeightBrush(state, tile, editor) {
  const current = Number(tile.elevation ?? 0);
  const target = Number(editor.selectedHeight ?? 0);
  if (current !== target) {
    changeElevation(state.map, tile.x, tile.y, target - current);
  }
}

function applyTerrainTypeBrush(tile, editor) {
  tile.terrainTypeId = editor.selectedTerrainTypeId ?? 'clear';
}

function applyTerrainSpriteBrush(tile, editor) {
  const nextValue = String(editor.selectedTerrainSpriteId ?? '').trim();
  tile.terrainSpriteId = nextValue || null;
}

function applyFlagBrush(tile, editor) {
  tile.flags = tile.flags ?? { impassable: false, difficult: false, hazard: false };
  tile.flags[editor.selectedFlagKey] = Boolean(editor.selectedFlagValue);
}

function applySpawnBrush(state, tile, editor) {
  ensureMapSpawns(state.map);
  const team = editor.selectedSpawnTeam === 'enemy' ? 'enemy' : 'player';
  const index = Math.max(0, Math.min(3, Number(editor.selectedSpawnIndex) || 0));
  const spawnId = buildSpawnId(team, index);
  clearSpawnIdFromTiles(state.map, spawnId);
  state.map.spawns[team][index] = { x: tile.x, y: tile.y };
  tile.spawnId = spawnId;
  syncLegacySpawnPoints(state);
}

function applyEraseBrush(state, tile) {
  tile.terrainSpriteId = null;
  tile.flags = { impassable: false, difficult: false, hazard: false };
  if (tile.spawnId) {
    const [team, rawIndex] = String(tile.spawnId).split('_');
    const index = Number(rawIndex) - 1;
    if (state.map?.spawns?.[team]?.[index]) state.map.spawns[team][index] = null;
  }
  tile.spawnId = null;
  syncLegacySpawnPoints(state);
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
      case MAP_EDITOR_MODES.TERRAIN_TYPE:
        applyTerrainTypeBrush(tile, editor);
        break;
      case MAP_EDITOR_MODES.TERRAIN_SPRITE:
        applyTerrainSpriteBrush(tile, editor);
        break;
      case MAP_EDITOR_MODES.FLAG:
        applyFlagBrush(tile, editor);
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
  syncLegacySpawnPoints(state);
}

export function sampleMapEditorFromTile(state, x, y) {
  const editor = ensureMapEditorState(state);
  const tile = getTile(state.map, x, y);
  if (!tile) return editor;

  editor.selectedHeight = Number(tile.elevation ?? 0);
  editor.selectedTerrainTypeId = tile.terrainTypeId ?? 'clear';
  editor.selectedTerrainSpriteId = tile.terrainSpriteId ?? '';

  const activeFlag = Object.entries(tile.flags ?? {}).find(([, value]) => value === true) ?? ['impassable', false];
  editor.selectedFlagKey = activeFlag[0];
  editor.selectedFlagValue = Boolean(activeFlag[1]);

  if (tile.spawnId) {
    const [team, rawIndex] = String(tile.spawnId).split('_');
    editor.selectedSpawnTeam = team === 'enemy' ? 'enemy' : 'player';
    editor.selectedSpawnIndex = Math.max(0, (Number(rawIndex) || 1) - 1);
  }

  return editor;
}

export function replaceRuntimeMapFromDefinition(state, mapDefinition) {
  const normalized = normalizeMapDefinition(structuredClone(mapDefinition));
  state.map = normalized;
  state.content.defaultMap = buildMapDefinitionFromRuntimeMap(normalized);
  syncLegacySpawnPoints(state);
  const editor = ensureMapEditorState(state);
  editor.activeMapId = normalized.id ?? editor.activeMapId;
  editor.pendingResize.width = getMapWidth(normalized);
  editor.pendingResize.height = getMapHeight(normalized);
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
