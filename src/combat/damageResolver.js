import { getUnitById } from "../mechs.js";
import { getEmbarkedPilotForMech } from "../actors/actorResolver.js";

const SIDE_DAMAGE_BONUS = 2;
const BRACE_DAMAGE_REDUCTION = 2;

function clampMinZero(value) {
  return Math.max(0, value);
}

function getOppositeFacing(facing) {
  return (facing + 2) % 4;
}

function getAttackDirectionFromSourceToTarget(sourceX, sourceY, targetX, targetY) {
  const dx = sourceX - targetX;
  const dy = sourceY - targetY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 1 : 3;
  }

  return dy > 0 ? 2 : 0;
}

function getFacingZone(sourceX, sourceY, target) {
  const attackDirection = getAttackDirectionFromSourceToTarget(
    sourceX,
    sourceY,
    target.x,
    target.y
  );

  if (attackDirection === target.facing) {
    return "front";
  }

  if (attackDirection === getOppositeFacing(target.facing)) {
    return "rear";
  }

  return "side";
}

function getMissileRingDistance(centerX, centerY, targetX, targetY) {
  const dx = targetX - centerX;
  const dy = targetY - centerY;
  return Math.floor(Math.hypot(dx, dy));
}

function getMissileBaseDamage(weapon, confirmed, target) {
  const splash = weapon?.splashDamage ?? {};
  const ring = getMissileRingDistance(
    confirmed.target.x,
    confirmed.target.y,
    target.x,
    target.y
  );

  if (ring <= 0) {
    return {
      ring: 0,
      baseDamage: Number(splash.center ?? weapon.damage ?? 0)
    };
  }

  return {
    ring,
    baseDamage: Number(splash[`ring${ring}`] ?? 0)
  };
}

function getBaseDamage(weapon, confirmed, target) {
  if (confirmed.weaponType === "missile") {
    return getMissileBaseDamage(weapon, confirmed, target);
  }

  return {
    ring: null,
    baseDamage: Number(weapon?.damage ?? 0)
  };
}

function updateUnitStatus(target) {
  if (target.core <= 0) {
    target.core = 0;
    target.status = "disabled";
    return "disabled";
  }

  if (target.core <= Math.floor(target.maxCore / 2)) {
    target.status = "damaged";
    return "damaged";
  }

  target.status = "operational";
  return "operational";
}

function createDamageEvent(target) {
  return {
    targetId: target.instanceId,
    targetName: target.name,
    targetType: target.unitType,
    shieldBefore: Number(target.shield ?? 0),
    coreBefore: Number(target.core ?? 0),
    shieldAfter: Number(target.shield ?? 0),
    coreAfter: Number(target.core ?? 0),
    shieldDamage: 0,
    coreDamage: 0,
    statusBefore: target.status,
    statusAfter: target.status
  };
}

function finalizeDamageEvent(target, event) {
  target.shield = clampMinZero(target.shield);
  target.core = clampMinZero(target.core);
  event.shieldAfter = target.shield;
  event.coreAfter = target.core;
  event.statusAfter = updateUnitStatus(target);
  return event;
}

function applyDamageToUnit(target, damage, options = {}) {
  const event = createDamageEvent(target);
  let remainingDamage = clampMinZero(damage);

  if (remainingDamage <= 0) {
    finalizeDamageEvent(target, event);
    return { event, remainingDamage: 0 };
  }

  if (options.bypassShield !== true) {
    const shieldDamage = Math.min(Number(target.shield ?? 0), remainingDamage);
    target.shield -= shieldDamage;
    event.shieldDamage = shieldDamage;
    remainingDamage -= shieldDamage;
  }

  if (remainingDamage > 0) {
    const coreDamage = Math.min(Number(target.core ?? 0), remainingDamage);
    target.core -= coreDamage;
    event.coreDamage = coreDamage;
    remainingDamage -= coreDamage;
  }

  finalizeDamageEvent(target, event);
  return { event, remainingDamage };
}

export function resolveDamage(state, attacker, weapon, confirmed, hitResult) {
  if (!state || !attacker || !weapon || !confirmed || !hitResult?.targetId) {
    return {
      damageResolved: false,
      logs: ["Damage could not resolve: missing damage context."],
      result: null
    };
  }

  if (!hitResult.hit) {
    return {
      damageResolved: true,
      logs: [],
      result: null
    };
  }

  const target = getUnitById(state.units, hitResult.targetId);
  if (!target) {
    return {
      damageResolved: false,
      logs: ["Damage could not resolve: target unit not found."],
      result: null
    };
  }

  const { baseDamage, ring } = getBaseDamage(weapon, confirmed, target);
  const facingZone = getFacingZone(attacker.x, attacker.y, target);
  const logs = [];

  if (confirmed.weaponType === "missile") {
    const ringLabel = ring === 0 ? "center" : `ring ${ring}`;
    logs.push(
      `${attacker.name} damages ${target.name} with ${weapon.name} (${ringLabel}) for ${baseDamage} base damage.`
    );
  } else {
    logs.push(
      `${attacker.name} damages ${target.name} with ${weapon.name} for ${baseDamage} base damage.`
    );
  }

  let finalDamage = baseDamage;

  if (facingZone === "front") {
    logs.push("Facing: Front (0)");
  } else if (facingZone === "side") {
    finalDamage += SIDE_DAMAGE_BONUS;
    logs.push(`Facing: Side (+${SIDE_DAMAGE_BONUS})`);
  } else {
    logs.push("Facing: Rear (shield bypass)");
  }

  if (target.isBraced) {
    finalDamage -= BRACE_DAMAGE_REDUCTION;
    logs.push(`Brace: -${BRACE_DAMAGE_REDUCTION} damage`);
  }

  finalDamage = clampMinZero(finalDamage);
  logs.push(`Final damage: ${finalDamage}`);

  const damageEvents = [];
  let remainingDamage = finalDamage;

  const primary = applyDamageToUnit(target, remainingDamage, {
    bypassShield: facingZone === "rear"
  });
  remainingDamage = primary.remainingDamage;
  damageEvents.push(primary.event);

  if (target.unitType === "mech") {
    const embarkedPilot = getEmbarkedPilotForMech(state, target);
    if (embarkedPilot && remainingDamage > 0) {
      logs.push(`${target.name} overflow reaches embarked pilot ${embarkedPilot.name}.`);
      const pilotResult = applyDamageToUnit(embarkedPilot, remainingDamage, {
        bypassShield: false
      });
      remainingDamage = pilotResult.remainingDamage;
      damageEvents.push(pilotResult.event);
    }
  }

  for (const event of damageEvents) {
    if (event.targetType === "mech") {
      if (facingZone !== "rear") {
        logs.push(`Shield: ${event.shieldBefore} -> ${event.shieldAfter}`);
      } else {
        logs.push(`Shield: ${event.shieldBefore} -> ${event.shieldAfter} (bypassed)`);
      }
    } else {
      logs.push(`${event.targetName} shield: ${event.shieldBefore} -> ${event.shieldAfter}`);
    }

    logs.push(`${event.targetName} core: ${event.coreBefore} -> ${event.coreAfter}`);

    if (event.statusBefore !== event.statusAfter) {
      logs.push(`${event.targetName} status: ${event.statusBefore} -> ${event.statusAfter}`);
    }

    if (event.statusAfter === "disabled") {
      logs.push(`${event.targetName} disabled.`);
    }
  }

  return {
    damageResolved: true,
    logs,
    result: {
      targetId: target.instanceId,
      targetName: target.name,
      baseDamage,
      finalDamage,
      ring,
      facingZone,
      damageEvents,
      statusAfter: primary.event.statusAfter,
      overflowRemaining: remainingDamage
    }
  };
}
