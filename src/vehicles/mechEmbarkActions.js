// src/vehicles/mechEmbarkActions.js
//
// Enter / Exit mech resolution helpers.

import { canPilotBoardMech, getValidRearExitTile } from "./mechEmbarkRules.js";

export function resolveEnterMech(state, pilot, mech) {
  if (!state || !pilot || !mech) return { ok: false, reason: "missing_state" };
  if (!canPilotBoardMech(state, pilot, mech)) {
    return { ok: false, reason: "invalid_boarding_state" };
  }

  pilot.embarked = true;
  pilot.currentMechId = mech.instanceId;
  mech.embarkedPilotId = pilot.instanceId;

  return {
    ok: true,
    pilotId: pilot.instanceId,
    mechId: mech.instanceId,
    pilotName: pilot.name,
    mechName: mech.name
  };
}

export function resolveExitMech(state, pilot, mech, exitTile = null) {
  if (!state || !pilot || !mech) {
    return { ok: false, reason: "missing_state" };
  }

  const chosenTile = getValidRearExitTile(state, pilot, mech);

  if (!chosenTile) {
    return { ok: false, reason: "invalid_exit_tile" };
  }

  if (exitTile && (Number(exitTile.x) !== Number(chosenTile.x) || Number(exitTile.y) !== Number(chosenTile.y))) {
    return { ok: false, reason: "invalid_exit_tile" };
  }

  pilot.embarked = false;
  pilot.currentMechId = null;
  pilot.x = Number(chosenTile.x);
  pilot.y = Number(chosenTile.y);
  pilot.facing = (Number(mech.facing ?? 0) + 2) % 4;

  mech.embarkedPilotId = null;

  return {
    ok: true,
    pilotId: pilot.instanceId,
    mechId: mech.instanceId,
    pilotName: pilot.name,
    mechName: mech.name,
    exitTile: { x: pilot.x, y: pilot.y }
  };
}
