// src/targeting/missileTargeting.js

import { getMissileLineOfSightResult } from "../los.js";
import { manhattanDistance, DEFAULT_MISSILE_MAX_RANGE } from "./rangeRules.js";

export function evaluateMissileTargetWithSpotter(state, mech, profile, targetX, targetY) {
  const shooterLos = getMissileLineOfSightResult(
    state,
    mech.x,
    mech.y,
    targetX,
    targetY,
    {
      attackerScale: mech.scale ?? "mech",
      targetScale: profile.scale ?? "mech"
    }
  );

  if (shooterLos.visible === true) {
    return {
      visible: true,
      los: shooterLos,
      missileSource: "shooter",
      spotterId: null,
      spotterPosition: null,
      validationReason: "shooter_los"
    };
  }

  const minRange = profile.targeting?.minRange ?? 1;
  const maxRange = profile.targeting?.maxRange ?? DEFAULT_MISSILE_MAX_RANGE;

  const spotters = (Array.isArray(state.units) ? state.units : [])
    .filter((unit) => {
      if (!unit) return false;
      if (unit.instanceId === mech.instanceId) return false;
      if (unit.team !== mech.team) return false;
      if (unit.status === "disabled") return false;

      const distToTarget = manhattanDistance(unit.x, unit.y, targetX, targetY);
      return distToTarget >= minRange && distToTarget <= maxRange;
    })
    .sort((a, b) => {
      const aDist = manhattanDistance(a.x, a.y, targetX, targetY);
      const bDist = manhattanDistance(b.x, b.y, targetX, targetY);
      return aDist - bDist;
    });

  for (const spotter of spotters) {
    const spotterLos = getMissileLineOfSightResult(
      state,
      spotter.x,
      spotter.y,
      targetX,
      targetY,
      {
        attackerScale: spotter.scale ?? "mech",
        targetScale: profile.scale ?? "mech"
      }
    );

    if (spotterLos.visible === true) {
      return {
        visible: true,
        los: spotterLos,
        missileSource: "spotter",
        spotterId: spotter.instanceId,
        spotterPosition: { x: spotter.x, y: spotter.y },
        validationReason: "spotter_los"
      };
    }
  }

  return {
    visible: false,
    los: shooterLos,
    missileSource: "shooter",
    spotterId: null,
    spotterPosition: null,
    validationReason: "blocked_no_spotter"
  };
}
