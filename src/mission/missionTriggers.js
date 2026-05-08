// src/mission/missionTriggers.js
//
// Runtime trigger resolver V1.
// Preset-based tile triggers. Keeps mission scripting simple and data-driven.

import { markObjectiveCompleted } from "./missionObjectives.js";

const SUPPORTED_PRESETS = new Set([
  "load_map",
  "change_unit_stat",
  "complete_objective",
  "end_mission"
]);

export function resetTriggerRuntimeState(state) {
  const mission = ensureMissionState(state);
  mission.triggerRuntime = {
    fired: {}
  };
  return mission.triggerRuntime;
}

export function resolveOnUnitEnterZoneTriggers(state, unit) {
  if (!state || !unit || state?.mission?.result) return null;

  const triggers = Array.isArray(state?.map?.triggers) ? state.map.triggers : [];
  if (!triggers.length) return null;

  const runtime = ensureTriggerRuntimeState(state);
  const mapId = String(state?.map?.id ?? state?.mission?.definition?.activeMapId ?? "map");
  const unitX = Number(unit.x);
  const unitY = Number(unit.y);

  const results = [];

  for (const trigger of triggers) {
    if (!trigger?.id) continue;
    if (trigger.type !== "onUnitEnterZone") continue;
    if (!SUPPORTED_PRESETS.has(trigger.preset)) continue;
    if (!doesTeamMatch(trigger.team ?? "player", unit.team ?? "player")) continue;
    if (!triggerHasTile(trigger, unitX, unitY)) continue;

    const firedKey = `${mapId}:${trigger.id}`;
    if (trigger.once !== false && runtime.fired[firedKey]) continue;
    runtime.fired[firedKey] = true;

    const result = applyTriggerPreset(state, trigger, unit);
    if (result?.ok) results.push(result);
  }

  return results.length ? { ok: true, results } : null;
}

function applyTriggerPreset(state, trigger, unit) {
  if (trigger.completeObjectiveId) {
    markObjectiveCompleted(state, trigger.completeObjectiveId);
  }

  if (trigger.preset === "load_map") {
    return {
      ok: true,
      preset: "load_map",
      triggerId: trigger.id,
      nextMapId: trigger.nextMapId ?? "",
      completeObjectiveId: trigger.completeObjectiveId ?? ""
    };
  }

  if (trigger.preset === "complete_objective") {
    const completed = markObjectiveCompleted(state, trigger.completeObjectiveId);
    return {
      ok: completed,
      preset: "complete_objective",
      triggerId: trigger.id,
      completeObjectiveId: trigger.completeObjectiveId ?? ""
    };
  }

  if (trigger.preset === "change_unit_stat") {
    const stat = trigger.stat === "shield" ? "shield" : "core";
    const value = Math.trunc(Number(trigger.value ?? 0));
    const changed = applyUnitStatChange(unit, stat, value);
    return {
      ok: changed,
      preset: "change_unit_stat",
      triggerId: trigger.id,
      unitId: unit.id ?? null,
      stat,
      value
    };
  }

  if (trigger.preset === "end_mission") {
    const result = trigger.missionResult === "defeat" ? "defeat" : "victory";
    ensureMissionState(state).result = result;
    return {
      ok: true,
      preset: "end_mission",
      triggerId: trigger.id,
      missionResult: result
    };
  }

  return null;
}

function applyUnitStatChange(unit, stat, value) {
  if (!unit || !Number.isFinite(value) || value === 0) return false;

  const current = Number(unit[stat] ?? 0);
  const maxField = stat === "shield" ? "maxShield" : "maxCore";
  const max = Number(unit[maxField] ?? current);
  const upper = Number.isFinite(max) && max > 0 ? max : Math.max(current, current + value, 0);
  const next = clamp(current + value, 0, upper);

  unit[stat] = next;

  if (stat === "core" && next <= 0) {
    unit.status = "disabled";
  }

  return true;
}

function ensureTriggerRuntimeState(state) {
  const mission = ensureMissionState(state);
  if (!mission.triggerRuntime) resetTriggerRuntimeState(state);
  if (!mission.triggerRuntime.fired) mission.triggerRuntime.fired = {};
  return mission.triggerRuntime;
}

function ensureMissionState(state) {
  if (!state.mission) state.mission = { sourceMap: null, definition: null, result: null };
  return state.mission;
}

function doesTeamMatch(filter, team) {
  const cleanFilter = String(filter ?? "player").toLowerCase();
  if (cleanFilter === "any") return true;
  return cleanFilter === String(team ?? "player").toLowerCase();
}

function triggerHasTile(trigger, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  for (const tile of Array.isArray(trigger?.tiles) ? trigger.tiles : []) {
    if (Number(tile?.x) === x && Number(tile?.y) === y) return true;
  }
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
