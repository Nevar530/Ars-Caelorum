import { getMechById } from "../mechs.js";

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
    return dx > 0 ? 1 : 3; // source is east/west of target
  }

  return dy > 0 ? 2 : 0; // source is south/north of target
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

  const target = getMechById(state.mechs, hitResult.targetId);
  if (!target) {
    return {
      damageResolved: false,
      logs: ["Damage could not resolve: target unit not found."],
      result: null
    };
  }

  const { baseDamage, ring } = getBaseDamage(weapon, confirmed, target);
  const facingZone = getFacingZone(attacker.x, attacker.y, target);

  const statusBefore = target.status;
  const shieldBefore = target.shield;
  const coreBefore = target.core;

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

  let modifiedDamage = baseDamage;

  if (facingZone === "front") {
    logs.push("Facing: Front (0)");
  } else if (facingZone === "side") {
    modifiedDamage += SIDE_DAMAGE_BONUS;
    logs.push(`Facing: Side (+${SIDE_DAMAGE_BONUS})`);
  } else {
    logs.push("Facing: Rear (shield bypass)");
  }

  if (target.isBraced) {
    modifiedDamage -= BRACE_DAMAGE_REDUCTION;
    logs.push(`Brace: -${BRACE_DAMAGE_REDUCTION} damage`);
  }

  modifiedDamage = clampMinZero(modifiedDamage);
  logs.push(`Final damage: ${modifiedDamage}`);

  let shieldDamage = 0;
  let coreDamage = 0;

  if (modifiedDamage > 0) {
    if (facingZone === "rear") {
      coreDamage = modifiedDamage;
      target.core -= coreDamage;
    } else {
      shieldDamage = Math.min(target.shield, modifiedDamage);
      target.shield -= shieldDamage;

      const overflow = modifiedDamage - shieldDamage;
      if (overflow > 0) {
        coreDamage = overflow;
        target.core -= coreDamage;
      }
    }
  }

  const shieldAfter = target.shield;
  const coreAfter = clampMinZero(target.core);
  target.core = coreAfter;

  const statusAfter = updateUnitStatus(target);

  if (facingZone !== "rear") {
    logs.push(`Shield: ${shieldBefore} -> ${shieldAfter}`);
  } else {
    logs.push(`Shield: ${shieldBefore} -> ${shieldAfter} (bypassed)`);
  }

  logs.push(`Core: ${coreBefore} -> ${target.core}`);

  if (statusBefore !== statusAfter) {
    logs.push(`${target.name} status: ${statusBefore} -> ${statusAfter}`);
  }

  if (statusAfter === "disabled") {
    logs.push(`${target.name} disabled.`);
  }

  return {
    damageResolved: true,
    logs,
    result: {
      targetId: target.instanceId,
      targetName: target.name,
      baseDamage,
      finalDamage: modifiedDamage,
      shieldDamage,
      coreDamage,
      ring,
      facingZone,
      shieldBefore,
      shieldAfter,
      coreBefore,
      coreAfter: target.core,
      statusBefore,
      statusAfter
    }
  };
}
