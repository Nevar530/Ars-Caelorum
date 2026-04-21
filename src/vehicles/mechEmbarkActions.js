// src/vehicles/mechEmbarkActions.js
//
// Pass 7 resolves enter-mech only. Exit remains for the next pass.

import { canPilotBoardMech } from "./mechEmbarkRules.js";

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
