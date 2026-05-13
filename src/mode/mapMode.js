// src/mode/mapMode.js
//
// Lightweight runtime helpers for map-level pacing.
// Combat maps use initiative/rounds/action economy.
// Story maps use free movement + interact while preserving the same mission data,
// objectives, triggers, logic, dialogue, and map loading paths.

export const MAP_MODE_COMBAT = "combat";
export const MAP_MODE_STORY = "story";

export function normalizeMapMode(value) {
  const mode = String(value ?? MAP_MODE_COMBAT).trim().toLowerCase();
  return mode === MAP_MODE_STORY ? MAP_MODE_STORY : MAP_MODE_COMBAT;
}

export function getMapMode(map) {
  return normalizeMapMode(map?.mode);
}

export function isStoryMode(state) {
  return getMapMode(state?.map) === MAP_MODE_STORY;
}

export function isCombatMode(state) {
  return !isStoryMode(state);
}
