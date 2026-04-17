// Ars Caelorum — Map Editor Actions
// New module scaffold only. Not wired into runtime yet.

import { createMapEditorState } from './mapEditorState.js';

export function ensureMapEditorState(state) {
  if (!state.mapEditor) {
    state.mapEditor = createMapEditorState();
  }
  return state.mapEditor;
}

export function setMapEditorMode(state, mode) {
  ensureMapEditorState(state).mode = mode;
}

export function setMapEditorBrushSize(state, brushSize) {
  ensureMapEditorState(state).brushSize = brushSize;
}

export function setMapEditorHeight(state, selectedHeight) {
  ensureMapEditorState(state).selectedHeight = selectedHeight;
}

export function setMapEditorTerrainType(state, terrainTypeId) {
  ensureMapEditorState(state).selectedTerrainTypeId = terrainTypeId;
}

export function setMapEditorTerrainSprite(state, terrainSpriteId) {
  ensureMapEditorState(state).selectedTerrainSpriteId = terrainSpriteId;
}

export function setMapEditorFlag(state, selectedFlagKey, selectedFlagValue = true) {
  const editor = ensureMapEditorState(state);
  editor.selectedFlagKey = selectedFlagKey;
  editor.selectedFlagValue = selectedFlagValue;
}

export function setMapEditorSpawnBrush(state, team, index) {
  const editor = ensureMapEditorState(state);
  editor.selectedSpawnTeam = team;
  editor.selectedSpawnIndex = index;
}

export function setMapEditorPendingResize(state, width, height, anchor = 'topLeft') {
  const editor = ensureMapEditorState(state);
  editor.pendingResize = { width, height, anchor };
}
