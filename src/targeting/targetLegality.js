// src/targeting/targetLegality.js
//
// Central attack-target legality helpers.
// This only answers direct target selection legality. Splash/effect resolution
// still resolves from the confirmed target tile and is intentionally separate.
//
// Targeting truth:
// - Active pilots are target truth.
// - If a pilot is embarked, the mech body/location is targetable for that pilot.
// - Active empty mechs are targetable as vehicles.
// - Disabled empty mechs and disabled pilots are not valid direct targets.

import { getEmbarkedPilotForMech } from "../actors/actorResolver.js";

const NON_TARGETABLE_STATUSES = new Set(["disabled", "destroyed"]);

export function isUnitDisabledForTargeting(unit) {
  if (!unit) return true;
  if (NON_TARGETABLE_STATUSES.has(unit.status)) return true;
  return Number(unit.core ?? 1) <= 0;
}

export function isPilotActiveForTargeting(pilot) {
  if (!pilot || pilot.unitType !== "pilot") return false;
  return !isUnitDisabledForTargeting(pilot);
}

export function getActivePilotTargetForUnit(state, unit) {
  if (!unit) return null;

  if (unit.unitType === "pilot") {
    return isPilotActiveForTargeting(unit) ? unit : null;
  }

  if (unit.unitType === "mech") {
    const embarkedPilot = getEmbarkedPilotForMech(state, unit);
    return isPilotActiveForTargeting(embarkedPilot) ? embarkedPilot : null;
  }

  return null;
}

export function isActiveEmptyMechTarget(unit) {
  if (!unit || unit.unitType !== "mech") return false;
  if (unit.embarkedPilotId) return false;
  return !isUnitDisabledForTargeting(unit);
}

export function isUnitDirectlyTargetable(unit, state = null) {
  if (!unit) return false;

  if (state && getActivePilotTargetForUnit(state, unit)) {
    return true;
  }

  if (isActiveEmptyMechTarget(unit)) {
    return true;
  }

  return unit.unitType === "pilot" && !isUnitDisabledForTargeting(unit);
}

export function isOccupiedTileBlockedForDirectTargeting(occupantEntry, state = null) {
  const unit = occupantEntry?.unit ?? null;
  if (!unit) return false;
  return !isUnitDirectlyTargetable(unit, state);
}
