// src/initiative.js

export function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function isUnitEligible(unit) {
  if (!unit) return false;
  if (unit.status === "disabled") return false;
  return true;
}

function compareInstanceIds(a, b) {
  return String(a.instanceId ?? "").localeCompare(String(b.instanceId ?? ""));
}

function getStateUnits(state) {
  return Array.isArray(state?.units) ? state.units : [];
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
  const validUnits = Array.isArray(units) ? units.filter(isUnitEligible) : [];

  for (const unit of validUnits) {
    unit.hasMoved = false;
    unit.hasActed = false;
    unit.isBraced = false;
    rollInitiativeForUnit(unit);
  }

  return validUnits;
}

export function getMoveOrder(units) {
  return [...(Array.isArray(units) ? units.filter(isUnitEligible) : [])]
    .sort((a, b) => {
      const initDelta = (a.initiative ?? -999) - (b.initiative ?? -999);
      if (initDelta !== 0) return initDelta;

      const reactionDelta = (b.reaction ?? 0) - (a.reaction ?? 0);
      if (reactionDelta !== 0) return reactionDelta;

      return compareInstanceIds(a, b);
    })
    .map((unit) => unit.instanceId);
}

export function getActionOrder(units) {
  return [...(Array.isArray(units) ? units.filter(isUnitEligible) : [])]
    .sort((a, b) => {
      const initDelta = (b.initiative ?? -999) - (a.initiative ?? -999);
      if (initDelta !== 0) return initDelta;

      const reactionDelta = (b.reaction ?? 0) - (a.reaction ?? 0);
      if (reactionDelta !== 0) return reactionDelta;

      return compareInstanceIds(a, b);
    })
    .map((unit) => unit.instanceId);
}

export function rebuildRoundOrder(state) {
  const units = getStateUnits(state);
  const rolledUnits = rollInitiativeForAll(units);

  state.turn.lastInitiativeRolls = rolledUnits.map((unit) => ({
    instanceId: unit.instanceId,
    name: unit.name,
    pilotName: unit.pilotName ?? "",
    initiative: unit.initiative,
    dice: [...(unit.lastInitiativeRoll?.dice ?? [])],
    reaction: unit.lastInitiativeRoll?.reaction ?? (unit.reaction ?? 0)
  }));

  state.turn.moveOrder = getMoveOrder(rolledUnits);
  state.turn.actionOrder = getActionOrder(rolledUnits);
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

  return order[index] ?? null;
}
