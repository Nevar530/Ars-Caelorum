// src/mission/missionObjectives.js
//
// Runtime objective evaluation V1.
// Keeps mission goals data-driven without pulling triggers/logic chains in yet.

import { getControlledBodyForPilot, getPilotActors, isUnitPresentOnBoard } from "../actors/actorResolver.js";

const OBJECTIVE_TYPES = new Set(["defeat_all", "reach_zone", "hold_zone", "survive_rounds"]);

export function resetObjectiveRuntimeState(state) {
  const mission = getMissionStateObject(state);
  if (!mission) return null;

  mission.objectiveRuntime = {
    completed: {},
    holdProgress: {},
    lastRoundEvaluated: null
  };

  return mission.objectiveRuntime;
}

export function evaluateObjectiveMissionResult(state, options = {}) {
  const mission = getMissionStateObject(state);
  if (!mission) return null;
  if (mission.result) return mission.result;

  const defeatResult = evaluateForcedDefeat(state);
  if (defeatResult) {
    mission.result = defeatResult;
    return mission.result;
  }

  const objectives = getRuntimeObjectives(state);
  if (!objectives.length) {
    return evaluateFallbackPilotElimination(state, mission);
  }

  const runtime = ensureObjectiveRuntimeState(state);
  const timing = options?.timing ?? "any";

  for (const objective of objectives) {
    if (!objective?.id || !OBJECTIVE_TYPES.has(objective.type)) continue;
    if (runtime.completed[objective.id]) continue;

    if (evaluateSingleObjective(state, objective, runtime, timing)) {
      runtime.completed[objective.id] = true;
    }
  }

  const completeObjectives = objectives.filter((objective) => objective?.id && OBJECTIVE_TYPES.has(objective.type));
  if (completeObjectives.length && completeObjectives.every((objective) => runtime.completed[objective.id])) {
    mission.result = "victory";
    return mission.result;
  }

  return null;
}

export function getMissionObjectiveStatus(state) {
  const objectives = getRuntimeObjectives(state);
  if (!objectives.length) return [];

  const runtime = ensureObjectiveRuntimeState(state);
  return objectives.map((objective) => {
    const id = objective?.id ?? "objective";
    const type = objective?.type ?? "unknown";
    const required = getRoundsRequired(objective);
    const hold = runtime.holdProgress?.[id]?.heldRounds ?? 0;
    const completed = Boolean(runtime.completed?.[id]);

    return {
      id,
      type,
      label: objective?.label || objective?.briefingText || id,
      completed,
      progress: type === "hold_zone" || type === "survive_rounds" ? Math.min(required, hold) : completed ? 1 : 0,
      required: type === "hold_zone" || type === "survive_rounds" ? required : 1
    };
  });
}

function evaluateSingleObjective(state, objective, runtime, timing) {
  switch (objective.type) {
    case "defeat_all":
      return isTeamDefeated(state, objective.targetTeam || "enemy");

    case "reach_zone":
      return isTeamOccupyingAnyObjectiveTile(state, objective.team || "player", objective.tiles);

    case "hold_zone":
      if (timing !== "round_end") return false;
      return updateHoldProgress(state, objective, runtime);

    case "survive_rounds":
      if (timing !== "round_end") return false;
      return updateSurviveProgress(state, objective, runtime);

    default:
      return false;
  }
}

function updateHoldProgress(state, objective, runtime) {
  const id = objective.id;
  const currentRound = Number(state?.turn?.round ?? 1);
  const existing = runtime.holdProgress[id] ?? { heldRounds: 0, lastRound: null };

  if (existing.lastRound === currentRound) {
    return existing.heldRounds >= getRoundsRequired(objective);
  }

  const isHeld = isTeamOccupyingAnyObjectiveTile(state, objective.team || "player", objective.tiles);
  const heldRounds = isHeld ? Number(existing.heldRounds ?? 0) + 1 : 0;

  runtime.holdProgress[id] = {
    heldRounds,
    lastRound: currentRound
  };

  return heldRounds >= getRoundsRequired(objective);
}

function updateSurviveProgress(state, objective, runtime) {
  const id = objective.id;
  const currentRound = Number(state?.turn?.round ?? 1);
  const required = getRoundsRequired(objective);

  runtime.holdProgress[id] = {
    heldRounds: Math.min(required, currentRound),
    lastRound: currentRound
  };

  return currentRound >= required;
}

function evaluateForcedDefeat(state) {
  const playerPilots = getActivePilotsForTeam(state, "player");
  if (playerPilots.length > 0 && playerPilots.every(isUnitOutOfPlay)) return "defeat";
  return null;
}

function evaluateFallbackPilotElimination(state, mission) {
  const playerPilots = getActivePilotsForTeam(state, "player");
  const enemyPilots = getActivePilotsForTeam(state, "enemy");

  if (playerPilots.length > 0 && playerPilots.every(isUnitOutOfPlay)) {
    mission.result = "defeat";
    return mission.result;
  }

  if (enemyPilots.length > 0 && enemyPilots.every(isUnitOutOfPlay)) {
    mission.result = "victory";
    return mission.result;
  }

  return null;
}

function isTeamDefeated(state, team) {
  const pilots = getActivePilotsForTeam(state, team);
  if (!pilots.length) return false;
  return pilots.every(isUnitOutOfPlay);
}

function isTeamOccupyingAnyObjectiveTile(state, team, tiles) {
  const zoneKeys = buildTileKeySet(tiles);
  if (!zoneKeys.size) return false;

  for (const unit of getBoardObjectiveUnits(state)) {
    if ((unit.team ?? "player") !== team) continue;
    if (isUnitOutOfPlay(unit)) continue;
    if (zoneKeys.has(`${Number(unit.x)},${Number(unit.y)}`)) return true;
  }

  return false;
}

function getBoardObjectiveUnits(state) {
  const units = Array.isArray(state?.units) ? state.units : [];
  const boardUnits = [];

  for (const unit of units) {
    if (!unit) continue;
    if (unit.unitType === "pilot" && unit.embarked) {
      const body = getControlledBodyForPilot(state, unit);
      if (body && !boardUnits.includes(body)) boardUnits.push(body);
      continue;
    }

    if (isUnitPresentOnBoard(state, unit)) boardUnits.push(unit);
  }

  return boardUnits;
}

function getActivePilotsForTeam(state, team) {
  return getPilotActors(state).filter((pilot) => {
    const pilotTeam = pilot?.team ?? "player";
    if (team === "player") return pilotTeam !== "enemy";
    return pilotTeam === team;
  });
}

function isUnitOutOfPlay(unit) {
  if (!unit) return true;
  if (unit.status === "disabled" || unit.status === "destroyed") return true;
  return Number(unit.core ?? 0) <= 0;
}

function getRuntimeObjectives(state) {
  const objectives = state?.mission?.definition?.objectives;
  return Array.isArray(objectives) ? objectives : [];
}

function ensureObjectiveRuntimeState(state) {
  const mission = getMissionStateObject(state);
  if (!mission.objectiveRuntime) resetObjectiveRuntimeState(state);
  if (!mission.objectiveRuntime.completed) mission.objectiveRuntime.completed = {};
  if (!mission.objectiveRuntime.holdProgress) mission.objectiveRuntime.holdProgress = {};
  return mission.objectiveRuntime;
}

function getMissionStateObject(state) {
  if (!state) return null;
  if (!state.mission) state.mission = { sourceMap: null, definition: null, result: null };
  return state.mission;
}

function buildTileKeySet(tiles) {
  const set = new Set();
  for (const tile of Array.isArray(tiles) ? tiles : []) {
    const x = Number(tile?.x);
    const y = Number(tile?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    set.add(`${x},${y}`);
  }
  return set;
}

function getRoundsRequired(objective) {
  return Math.max(1, Math.floor(Number(objective?.roundsRequired ?? objective?.rounds ?? 1) || 1));
}
