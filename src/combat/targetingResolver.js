import { getTileDistance } from "../utils.js";

export function validateMissileTarget(state, attacker, targetX, targetY, weapon) {
  const inRange = isInRange(attacker, targetX, targetY, weapon);
  const inArc = isInArc(attacker, targetX, targetY);

  if (!inRange || !inArc) {
    return {
      valid: false,
      reason: "range_or_arc",
      source: "attacker"
    };
  }

  // 1. Check attacker LOS (HEAD ONLY)
  const attackerLos = getLosAtTile(state, attacker, targetX, targetY);

  if (attackerLos?.rays?.head && !attackerLos.rays.head.blocked) {
    return {
      valid: true,
      source: "attacker",
      los: attackerLos
    };
  }

  // 2. Try spotters (closest first)
  const allies = getAlliedUnits(state, attacker)
    .filter(unit => unit.instanceId !== attacker.instanceId)
    .sort((a, b) =>
      getTileDistance(a.x, a.y, targetX, targetY) -
      getTileDistance(b.x, b.y, targetX, targetY)
    );

  for (const ally of allies) {
    const allyLos = getLosAtTile(state, ally, targetX, targetY);

    if (allyLos?.rays?.head && !allyLos.rays.head.blocked) {
      return {
        valid: true,
        source: "spotter",
        spotter: ally,
        los: allyLos
      };
    }
  }

  // 3. No valid LOS
  return {
    valid: false,
    reason: "no_los",
    source: "attacker"
  };
}


// ---------------------
// HELPERS (hook into your existing code)
// ---------------------

function getLosAtTile(state, unit, x, y) {
  return state.ui.action.evaluatedTargetTiles?.find(
    t => t.x === x && t.y === y && t.sourceId === unit.instanceId
  )?.los;
}

function isInRange(attacker, x, y, weapon) {
  const dist = getTileDistance(attacker.x, attacker.y, x, y);
  return dist >= weapon.minRange && dist <= weapon.maxRange;
}

function isInArc(attacker, x, y) {
  // reuse your existing arc logic
  return true; // placeholder → call your real function
}

function getAlliedUnits(state, attacker) {
  return state.mechs.filter(m => m.team === attacker.team);
}
