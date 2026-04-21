// src/initiative.js

import { getPilotActors, getPilotActorById } from "./actors/actorResolver.js";

export function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function isActorEligible(actor) {
  if (!actor) return false;
  if (actor.unitType !== "pilot") return false;
  if (actor.status === "disabled") return false;
  return true;
}

function compareInstanceIds(a, b) {
  return String(a.instanceId ?? "").localeCompare(String(b.instanceId ?? ""));
}

export function rollInitiativeForUnit(unit) {
  const dieOne = rollD6();
  const dieTwo = rollD6();
  const reaction = Number(unit?.reaction ?? 0);
  const total = dieOne + dieTwo + reaction;

  unit.initiative = total;
  unit.lastInitiativeRoll = {
    dice: [dieOne, dieTwo],
    reaction,
    total
  };

  return total;
}

export function rollInitiativeForAll(units) {
  const validActors = Array.isArray(units) ? units.filter(isActorEligible) : [];

  for (const actor of validActors) {
    actor.hasMoved = false;
    actor.hasActed = false;
    rollInitiativeForUnit(actor);
  }

  return validActors;
}

export function getMoveOrder(actors) {
  return [...(Array.isArray(actors) ? actors.filter(isActorEligible) : [])]
    .sort((a, b) => {
      const initDelta = (a.initiative ?? -999) - (b.initiative ?? -999);
      if (initDelta !== 0) return initDelta;

      const reactionDelta = (b.reaction ?? 0) - (a.reaction ?? 0);
      if (reactionDelta !== 0) return reactionDelta;

      return compareInstanceIds(a, b);
    })
    .map((actor) => actor.instanceId);
}

export function getActionOrder(actors) {
  return [...(Array.isArray(actors) ? actors.filter(isActorEligible) : [])]
    .sort((a, b) => {
      const initDelta = (b.initiative ?? -999) - (a.initiative ?? -999);
      if (initDelta !== 0) return initDelta;

      const reactionDelta = (b.reaction ?? 0) - (a.reaction ?? 0);
      if (reactionDelta !== 0) return reactionDelta;

      return compareInstanceIds(a, b);
    })
    .map((actor) => actor.instanceId);
}

export function rebuildRoundOrder(state) {
  const pilotActors = getPilotActors(state);
  const rolledActors = rollInitiativeForAll(pilotActors);

  state.turn.lastInitiativeRolls = rolledActors.map((actor) => ({
    instanceId: actor.instanceId,
    name: actor.name,
    pilotName: actor.pilotName ?? "",
    initiative: actor.initiative,
    dice: [...(actor.lastInitiativeRoll?.dice ?? [])],
    reaction: actor.lastInitiativeRoll?.reaction ?? (actor.reaction ?? 0)
  }));

  state.turn.moveOrder = getMoveOrder(rolledActors);
  state.turn.actionOrder = getActionOrder(rolledActors);
  state.turn.moveIndex = -1;
  state.turn.actionIndex = -1;

  return {
    moveOrder: [...state.turn.moveOrder],
    actionOrder: [...state.turn.actionOrder]
  };
}

export function getCurrentPhaseOrder(state) {
  if (state.turn.phase === "move") return state.turn.moveOrder;
  if (state.turn.phase === "action") return state.turn.actionOrder;
  return [];
}

export function getCurrentPhaseIndex(state) {
  if (state.turn.phase === "move") return state.turn.moveIndex;
  if (state.turn.phase === "action") return state.turn.actionIndex;
  return -1;
}

export function getActiveUnitFromPhaseOrder(state) {
  const order = getCurrentPhaseOrder(state);
  const index = getCurrentPhaseIndex(state);

  if (!Array.isArray(order) || index < 0 || index >= order.length) {
    return null;
  }

  const actorId = order[index] ?? null;
  if (!actorId) return null;

  const actor = getPilotActorById(state, actorId);
  return actor?.instanceId ?? actorId;
}
