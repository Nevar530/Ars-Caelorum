import { getTile } from "../map.js";
import { getMechById } from "../mechs.js";
import { getLineOfSightResult } from "../los.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";

const BASE_TN = 6;

const RANGE_MODIFIERS = {
  machinegun_01: { pointBlank: 0, close: 0, mid: 1, far: 2 },
  pistol_01: { pointBlank: 0, close: 1, mid: 3, far: 4 },
  rifle_01: { pointBlank: 2, close: 1, mid: 0, far: 1 },
  cannon_01: { pointBlank: 3, close: 2, mid: 1, far: 0 },
  srm_01: { pointBlank: 2, close: 0, mid: 0, far: 2 },
  lrm_01: { pointBlank: 3, close: 2, mid: 0, far: 0 },
  sniper_01: { pointBlank: 4, close: 3, mid: 2, far: 0 },
  melee_01: { pointBlank: 0, close: 0, mid: 0, far: 0 }
};

function rollDie(sides = 6) {
  return Math.floor(Math.random() * sides) + 1;
}

export function roll2d6() {
  const dice = [rollDie(6), rollDie(6)];
  return {
    dice,
    total: dice[0] + dice[1]
  };
}

export function getRangeBand(distance) {
  if (distance <= 1) return "pointBlank";
  if (distance <= 6) return "close";
  if (distance <= 14) return "mid";
  return "far";
}

function getRangeLabel(distance, band) {
  switch (band) {
    case "pointBlank":
      return `${distance} (Point Blank)`;
    case "close":
      return `${distance} (2-6)`;
    case "mid":
      return `${distance} (7-14)`;
    case "far":
      return `${distance} (15-20)`;
    default:
      return String(distance);
  }
}

export function getRangeModifier(weaponId, distance) {
  const band = getRangeBand(distance);
  const table = RANGE_MODIFIERS[weaponId] ?? RANGE_MODIFIERS.rifle_01;
  return {
    band,
    modifier: table[band] ?? 0
  };
}

export function getCoverModifier(cover) {
  if (cover === "half") return 1;
  return 0;
}

export function getHeightModifier(state, attacker, target) {
  const attackerTile = getTile(state.map, attacker.x, attacker.y);
  const targetTile = getTile(state.map, target.x, target.y);

  const attackerElevation = attackerTile?.elevation ?? 0;
  const targetElevation = targetTile?.elevation ?? 0;

  if (attackerElevation > targetElevation) {
    return {
      modifier: -1,
      label: "Advantage (-1)"
    };
  }

  if (attackerElevation < targetElevation) {
    return {
      modifier: 1,
      label: "Disadvantage (+1)"
    };
  }

  return {
    modifier: 0,
    label: "Even (0)"
  };
}

function getTargetingSource(attacker, confirmed, state) {
  if (confirmed.weaponType !== "missile") {
    return attacker;
  }

  if (confirmed.missileSource === "spotter" && confirmed.spotterId) {
    const spotter = getMechById(state.mechs, confirmed.spotterId);
    if (spotter) {
      return spotter;
    }
  }

  return attacker;
}

function getDirectTarget(state, confirmed) {
  if (confirmed.targetMechId) {
    return getMechById(state.mechs, confirmed.targetMechId);
  }

  return (
    getPrimaryOccupantAt(state, confirmed.target.x, confirmed.target.y, "mech")?.unit ?? null
  );
}

function getMissileTargets(state, confirmed) {
  const results = [];
  const seen = new Set();

  for (const tile of confirmed.effectTiles ?? []) {
    const target = getPrimaryOccupantAt(state, tile.x, tile.y, "mech")?.unit ?? null;
    if (!target) continue;
    if (seen.has(target.instanceId)) continue;
    seen.add(target.instanceId);
    results.push(target);
  }

  return results;
}

function buildSingleHitResult({
  state,
  attacker,
  weapon,
  confirmed,
  target,
  distance,
  targetingSource
}) {
  const range = getRangeModifier(weapon.id, distance);
  const coverLos = getLineOfSightResult(state, attacker.x, attacker.y, target.x, target.y, {
    attackerScale: attacker.scale ?? "mech",
    targetScale: target.scale ?? "mech"
  });

  const cover =
    confirmed.weaponType === "missile"
      ? coverLos.cover ?? "none"
      : target.x === confirmed.target.x && target.y === confirmed.target.y
        ? confirmed.targetCover ?? "none"
        : coverLos.cover ?? "none";

  const coverModifier = getCoverModifier(cover);
  const height = getHeightModifier(state, attacker, target);
  const attackerTargeting = Number(targetingSource?.targeting ?? 0);
  const targetReaction = Number(target.reaction ?? 0);
  const attackerBraceModifier = attacker.isBraced ? -1 : 0;
  const targetBraceModifier = target.isBraced ? 1 : 0;

  const finalTN =
    BASE_TN +
    range.modifier +
    coverModifier +
    height.modifier +
    targetReaction -
    attackerTargeting +
    attackerBraceModifier +
    targetBraceModifier;

  const roll = roll2d6();
  const hit = roll.total >= finalTN;

  const logs = [
    `${attacker.name} attacks ${target.name} with ${weapon.name}.`,
    `Range: ${getRangeLabel(distance, range.band)} (${range.modifier >= 0 ? "+" : ""}${range.modifier})`,
    `Cover: ${cover === "half" ? "Half (+1)" : "None (0)"}`,
    `Height: ${height.label}`,
    `${target.name} Reaction: +${targetReaction}`,
    `${targetingSource.name} Targeting: -${attackerTargeting}`
  ];

  if (attacker.isBraced) {
    logs.push(`${attacker.name} Braced: -1`);
  }

  if (target.isBraced) {
    logs.push(`${target.name} Braced: +1`);
  }

  if (
    confirmed.weaponType === "missile" &&
    confirmed.missileSource === "spotter" &&
    targetingSource.instanceId !== attacker.instanceId
  ) {
    logs.push(`Spotter: ${targetingSource.name} provided targeting.`);
  }

  logs.push(`Final TN: ${finalTN}`);
  logs.push(`Roll: ${roll.dice[0]} + ${roll.dice[1]} = ${roll.total} → ${hit ? "HIT" : "MISS"}`);

  return {
    targetId: target.instanceId,
    targetName: target.name,
    finalTN,
    roll,
    hit,
    breakdown: {
      base: BASE_TN,
      range: range.modifier,
      cover: coverModifier,
      height: height.modifier,
      reaction: targetReaction,
      targeting: attackerTargeting,
      attackerBrace: attackerBraceModifier,
      targetBrace: targetBraceModifier
    },
    logs
  };
}

export function resolveHit(state, attacker, weapon, confirmed) {
  if (!state || !attacker || !weapon || !confirmed) {
    return {
      attackResolved: false,
      logs: ["To-hit could not resolve: missing attack context."],
      results: []
    };
  }

  const targetingSource = getTargetingSource(attacker, confirmed, state);

  if (confirmed.weaponType === "missile") {
    const targets = getMissileTargets(state, confirmed);

    if (!targets.length) {
      return {
        attackResolved: true,
        logs: [
          `${attacker.name} fires ${weapon.name} at (${confirmed.target.x},${confirmed.target.y}).`,
          "No units were inside the blast radius."
        ],
        results: []
      };
    }

    const distance = Number(confirmed.targetDistance ?? 0);
    const results = targets.map((target) =>
      buildSingleHitResult({
        state,
        attacker,
        weapon,
        confirmed,
        target,
        distance,
        targetingSource
      })
    );

    return {
      attackResolved: true,
      logs: [`${attacker.name} fires ${weapon.name} at tile (${confirmed.target.x},${confirmed.target.y}).`],
      results
    };
  }

  const target = getDirectTarget(state, confirmed);
  if (!target) {
    return {
      attackResolved: false,
      logs: ["To-hit could not resolve: direct target not found."],
      results: []
    };
  }

  const distance = Number(
    confirmed.targetDistance ?? Math.abs(target.x - attacker.x) + Math.abs(target.y - attacker.y)
  );

  return {
    attackResolved: true,
    logs: [],
    results: [
      buildSingleHitResult({
        state,
        attacker,
        weapon,
        confirmed,
        target,
        distance,
        targetingSource
      })
    ]
  };
}
