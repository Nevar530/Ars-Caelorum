// src/actors/actorResolver.js
//
// Pass 1 scaffold for pilot-actor / body resolution.
// This file adds the helper contract without changing current gameplay flow yet.

import { getUnitById } from "../mechs.js";

function getUnitsFromState(state) {
  return Array.isArray(state?.units) ? state.units : [];
}

export function getPilotActors(state) {
  return getUnitsFromState(state).filter((unit) => unit?.unitType === "pilot");
}

export function getPilotActorById(state, pilotInstanceId) {
  if (!pilotInstanceId) return null;
  return getPilotActors(state).find((pilot) => pilot.instanceId === pilotInstanceId) ?? null;
}

export function getLinkedMechForPilot(state, pilot) {
  if (!pilot) return null;

  const units = getUnitsFromState(state);

  if (pilot.currentMechId) {
    return getUnitById(units, pilot.currentMechId);
  }

  return units.find((unit) => {
    if (!unit || unit.unitType !== "mech") return false;
    if (unit.team !== pilot.team) return false;
    return unit.pilotId === pilot.definitionId;
  }) ?? null;
}

export function getEmbarkedPilotForMech(state, mech) {
  if (!mech) return null;

  const units = getUnitsFromState(state);

  if (mech.embarkedPilotId) {
    return getUnitById(units, mech.embarkedPilotId);
  }

  return units.find((unit) => {
    if (!unit || unit.unitType !== "pilot") return false;
    if (unit.team !== mech.team) return false;
    if (!unit.embarked) return false;
    return unit.currentMechId === mech.instanceId || unit.definitionId === mech.pilotId;
  }) ?? null;
}

export function getControlledBodyForPilot(state, pilot) {
  if (!pilot) return null;
  if (!pilot.embarked) return pilot;
  return getLinkedMechForPilot(state, pilot) ?? pilot;
}

export function getActiveActor(state) {
  const explicitActorId = state?.turn?.activeActorId ?? null;
  if (explicitActorId) {
    return getPilotActorById(state, explicitActorId);
  }

  const activeUnitId = state?.turn?.activeUnitId ?? null;
  if (!activeUnitId) return null;

  const units = getUnitsFromState(state);
  const activeUnit = getUnitById(units, activeUnitId);
  if (!activeUnit) return null;

  if (activeUnit.unitType === "pilot") {
    return activeUnit;
  }

  if (activeUnit.unitType === "mech") {
    return getEmbarkedPilotForMech(state, activeUnit);
  }

  return null;
}

export function getActiveBody(state) {
  const explicitBodyId = state?.turn?.activeBodyId ?? null;
  if (explicitBodyId) {
    return getUnitById(getUnitsFromState(state), explicitBodyId);
  }

  const activeActor = getActiveActor(state);
  if (activeActor) {
    return getControlledBodyForPilot(state, activeActor);
  }

  const activeUnitId = state?.turn?.activeUnitId ?? null;
  if (!activeUnitId) return null;
  return getUnitById(getUnitsFromState(state), activeUnitId);
}
