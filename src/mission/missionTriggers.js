// src/mission/missionTriggers.js
//
// Runtime trigger resolver V1.
// Preset-based tile triggers. Keeps mission scripting simple and data-driven.

import { markObjectiveCompleted } from "./missionObjectives.js";

const SUPPORTED_PRESETS = new Set([
  "load_map",
  "change_unit_stat",
  "complete_objective",
  "end_mission",
  "run_logic"
]);

export function resetTriggerRuntimeState(state) {
  const mission = ensureMissionState(state);
  mission.triggerRuntime = {
    fired: {},
    flags: {}
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

    const result = applyTriggerPreset(state, trigger, unit);
    if (result?.ok) {
      if (trigger.once !== false && !result.skipped) runtime.fired[firedKey] = true;
      results.push(result);
      if (Array.isArray(result.results)) results.push(...result.results.filter((entry) => entry?.ok));
    }
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

  if (trigger.preset === "run_logic") {
    return applyLogicChain(state, trigger, unit);
  }

  return null;
}


function applyLogicChain(state, trigger, unit) {
  const chainId = String(trigger?.logicChainId ?? "").trim();
  if (!chainId) return null;

  const chain = getRuntimeLogicChains(state).find((entry) => entry?.id === chainId);
  if (!chain) return null;
  if (!logicConditionsPass(state, chain.conditions)) {
    return {
      ok: true,
      preset: "run_logic",
      triggerId: trigger.id,
      logicChainId: chainId,
      skipped: true
    };
  }

  const actionResults = [];
  for (const action of Array.isArray(chain.actions) ? chain.actions : []) {
    const result = applyLogicAction(state, trigger, unit, action);
    if (result?.ok) actionResults.push(result);
  }

  return {
    ok: true,
    preset: "run_logic",
    triggerId: trigger.id,
    logicChainId: chainId,
    results: actionResults
  };
}

function logicConditionsPass(state, conditions) {
  for (const condition of Array.isArray(conditions) ? conditions : []) {
    if (!singleLogicConditionPasses(state, condition)) return false;
  }
  return true;
}

function singleLogicConditionPasses(state, condition) {
  const type = String(condition?.type ?? "none");
  if (!type || type === "none") return true;

  if (type === "objective_complete" || type === "objective_incomplete") {
    const id = String(condition?.objectiveId ?? "").trim();
    const completed = Boolean(state?.mission?.objectiveRuntime?.completed?.[id]);
    return type === "objective_complete" ? completed : !completed;
  }

  if (type === "flag_true" || type === "flag_false") {
    const id = String(condition?.flagId ?? "").trim();
    const flags = ensureTriggerRuntimeState(state).flags;
    const value = Boolean(flags?.[id]);
    return type === "flag_true" ? value : !value;
  }

  if (type === "round_at_least") {
    const round = Math.max(1, Math.trunc(Number(condition?.round ?? 1) || 1));
    return Number(state?.turn?.round ?? 1) >= round;
  }

  return false;
}

function applyLogicAction(state, trigger, unit, action) {
  const type = String(action?.type ?? "");

  if (type === "complete_objective") {
    const objectiveId = String(action?.objectiveId ?? "").trim();
    const completed = markObjectiveCompleted(state, objectiveId);
    return { ok: completed, preset: "complete_objective", triggerId: trigger.id, logicAction: true, completeObjectiveId: objectiveId };
  }

  if (type === "change_unit_stat") {
    const stat = action?.stat === "shield" ? "shield" : "core";
    const value = Math.trunc(Number(action?.value ?? 0));
    const changed = applyUnitStatChange(unit, stat, value);
    return { ok: changed, preset: "change_unit_stat", triggerId: trigger.id, logicAction: true, unitId: unit?.id ?? unit?.instanceId ?? null, stat, value };
  }

  if (type === "load_map") {
    return { ok: true, preset: "load_map", triggerId: trigger.id, logicAction: true, nextMapId: action?.nextMapId ?? "" };
  }

  if (type === "end_mission") {
    const result = action?.missionResult === "defeat" ? "defeat" : "victory";
    ensureMissionState(state).result = result;
    return { ok: true, preset: "end_mission", triggerId: trigger.id, logicAction: true, missionResult: result };
  }

  if (type === "set_flag") {
    const flagId = String(action?.flagId ?? "").trim();
    if (!flagId) return null;
    ensureTriggerRuntimeState(state).flags[flagId] = action?.value !== false;
    return { ok: true, preset: "set_flag", triggerId: trigger.id, logicAction: true, flagId, value: action?.value !== false };
  }

  if (type === "give_item" || type === "remove_item") {
    const itemId = String(action?.itemId ?? "").trim();
    if (!itemId || !unit) return null;
    const changed = type === "give_item" ? addUnitItem(unit, itemId) : removeUnitItem(unit, itemId);
    return { ok: changed, preset: type, triggerId: trigger.id, logicAction: true, unitId: unit.id ?? unit.instanceId ?? null, itemId };
  }

  return null;
}

function getRuntimeLogicChains(state) {
  if (Array.isArray(state?.map?.logic) && state.map.logic.length) return state.map.logic;
  if (Array.isArray(state?.mission?.definition?.logic)) return state.mission.definition.logic;
  return [];
}

function addUnitItem(unit, itemId) {
  if (!unit.inventory) unit.inventory = {};
  if (!Array.isArray(unit.inventory.items)) unit.inventory.items = [];
  unit.inventory.items.push(itemId);
  return true;
}

function removeUnitItem(unit, itemId) {
  const collections = [unit?.inventory?.items, unit?.loadout?.items, unit?.items];
  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    const index = collection.findIndex((entry) => entry === itemId);
    if (index >= 0) {
      collection.splice(index, 1);
      return true;
    }
  }
  return false;
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
  if (!mission.triggerRuntime.flags) mission.triggerRuntime.flags = {};
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
