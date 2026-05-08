// src/mission/missionTriggers.js
//
// Runtime trigger resolver V1.
// Keeps triggers preset-based and small: onUnitEnterZone + load_map first.

import { markObjectiveCompleted } from "./missionObjectives.js";

const SUPPORTED_PRESETS = new Set(["load_map"]);

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

  for (const trigger of triggers) {
    if (!trigger?.id) continue;
    if (trigger.type !== "onUnitEnterZone") continue;
    if (!SUPPORTED_PRESETS.has(trigger.preset)) continue;
    if (!doesTeamMatch(trigger.team ?? "player", unit.team ?? "player")) continue;
    if (!triggerHasTile(trigger, unitX, unitY)) continue;

    const firedKey = `${mapId}:${trigger.id}`;
    if (trigger.once !== false && runtime.fired[firedKey]) continue;
    runtime.fired[firedKey] = true;

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
  }

  return null;
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
