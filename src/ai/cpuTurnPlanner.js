import { getActiveActor, getActiveBody, getBoardUnits } from "../actors/actorResolver.js";
import { getReachableTiles } from "../movement.js";
import { getEquippedWeaponIds } from "../content/unitLoadout.js";
import { normalizeWeaponToActionProfile, updateActionTargetPreview } from "../targeting/targetingResolver.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getRangeModifier } from "../combat/hitResolver.js";
import { isUnitDirectlyTargetable } from "../targeting/targetLegality.js";

const FACINGS = [0, 1, 2, 3];

function manhattanDistance(ax, ay, bx, by) {
  return Math.abs(Number(ax) - Number(bx)) + Math.abs(Number(ay) - Number(by));
}

function getEnemyBoardUnits(state, team) {
  return getBoardUnits(state).filter((unit) => {
    if (!unit) return false;
    if (unit.team === team) return false;
    return isUnitDirectlyTargetable(unit, state);
  });
}

function getFacingToward(fromX, fromY, toX, toY, fallbackFacing = 0) {
  const dx = Number(toX) - Number(fromX);
  const dy = Number(toY) - Number(fromY);

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 1 : 3;
  }

  if (Math.abs(dy) > 0) {
    return dy >= 0 ? 2 : 0;
  }

  return fallbackFacing;
}

function withPreviewBodyPose(state, body, x, y, facing, fn) {
  const originalX = body.x;
  const originalY = body.y;
  const originalFacing = body.facing;

  body.x = Number(x);
  body.y = Number(y);

  if (FACINGS.includes(Number(facing))) {
    body.facing = Number(facing);
  }

  try {
    return fn();
  } finally {
    body.x = originalX;
    body.y = originalY;
    body.facing = originalFacing;
  }
}

function snapshotActionState(state) {
  return {
    mode: state.ui.mode,
    selectionAction: state.selection.action,
    action: structuredClone(state.ui.action),
    focus: { ...state.focus }
  };
}

function restoreActionState(state, snapshot) {
  state.ui.mode = snapshot.mode;
  state.selection.action = snapshot.selectionAction;
  state.ui.action = snapshot.action;
  state.focus.x = snapshot.focus.x;
  state.focus.y = snapshot.focus.y;
  state.focus.scale = snapshot.focus.scale;
}

function getRoleTargetScore(activeBody, targetUnit) {
  const attackerType = activeBody?.unitType ?? "mech";
  const targetType = targetUnit?.unitType ?? "mech";

  if (attackerType === "pilot" && targetType === "pilot") return 120;
  if (attackerType === "pilot" && targetType === "mech") return -80;
  if (attackerType === "mech" && targetType === "mech") return 120;
  if (attackerType === "mech" && targetType === "pilot") return 30;

  return 0;
}

function getTargetConditionScore(targetUnit, damage) {
  const shield = Number(targetUnit?.shield ?? 0);
  const core = Number(targetUnit?.core ?? 0);
  const maxCore = Math.max(1, Number(targetUnit?.maxCore ?? core ?? 1));
  const effectiveHealth = shield + core;
  const coreRatio = core / maxCore;

  let score = 0;

  if (damage >= effectiveHealth) {
    score += 180;
  } else if (coreRatio <= 0.5) {
    score += 70;
  }

  if (targetUnit?.status === "damaged") {
    score += 45;
  }

  return score;
}

function scoreAttackCandidate(weapon, tile, targetUnit, activeBody) {
  const distance = Number(tile.distance) || 0;
  const range = getRangeModifier(weapon.id, distance);
  const damage = Number(weapon.damage) || 0;
  const coverPenalty = tile.cover === "half" ? 1 : 0;
  const roleScore = getRoleTargetScore(activeBody, targetUnit);
  const conditionScore = getTargetConditionScore(targetUnit, damage);
  const score =
    (damage * 1000) -
    (range.modifier * 120) -
    (coverPenalty * 80) -
    (distance * 2) +
    roleScore +
    conditionScore;

  return {
    score,
    distance,
    rangeBand: range.band,
    rangeModifier: range.modifier,
    coverPenalty,
    roleScore,
    conditionScore
  };
}

function chooseCpuAttackPlanAtPose(state, body, previewX, previewY, previewFacing) {
  const activeActor = getActiveActor(state);
  const activeBody = body ?? getActiveBody(state);
  if (!activeActor || !activeBody) return null;
  if (activeBody.status === "disabled") return null;

  const weaponCatalog = Array.isArray(state.content?.weapons) ? state.content.weapons : [];
  const weaponIds = getEquippedWeaponIds(activeBody);
  if (!weaponIds.length) return null;

  let bestPlan = null;

  for (const weaponId of weaponIds) {
    const weapon = weaponCatalog.find((entry) => entry?.id === weaponId);
    if (!weapon) continue;

    const profile = normalizeWeaponToActionProfile(weapon);
    const snapshot = snapshotActionState(state);

    const plan = withPreviewBodyPose(state, activeBody, previewX, previewY, previewFacing, () => {
      state.ui.mode = "action-target";
      state.selection.action = "attack";
      state.ui.action.selectedAction = profile;
      updateActionTargetPreview(state);

      const candidates = Array.isArray(state.ui.action.validTargetTiles)
        ? state.ui.action.validTargetTiles
        : [];

      let bestCandidate = null;

      for (const tile of candidates) {
        const occupant = getPrimaryOccupantAt(state, tile.x, tile.y, "base", {
          excludeUnitId: activeBody.instanceId
        });
        const targetUnit = occupant?.unit ?? null;
        if (!targetUnit) continue;
        if (targetUnit.team === activeActor.team) continue;

        const scored = scoreAttackCandidate(weapon, tile, targetUnit, activeBody);

        if (!bestCandidate || scored.score > bestCandidate.score) {
          bestCandidate = {
            x: tile.x,
            y: tile.y,
            score: scored.score,
            distance: scored.distance,
            rangeBand: scored.rangeBand,
            rangeModifier: scored.rangeModifier,
            targetUnitId: targetUnit.instanceId,
            targetName: targetUnit.name
          };
        }
      }

      if (!bestCandidate) return null;

      return {
        attackId: weapon.id,
        attackName: profile.name,
        profile,
        weapon,
        targetX: bestCandidate.x,
        targetY: bestCandidate.y,
        targetUnitId: bestCandidate.targetUnitId,
        targetName: bestCandidate.targetName,
        score: bestCandidate.score,
        distance: bestCandidate.distance,
        rangeBand: bestCandidate.rangeBand,
        rangeModifier: bestCandidate.rangeModifier,
        facing: Number(previewFacing)
      };
    });

    restoreActionState(state, snapshot);

    if (!plan) continue;
    if (!bestPlan || plan.score > bestPlan.score) {
      bestPlan = plan;
    }
  }

  return bestPlan;
}

function chooseCpuAttackPlanAtPosition(state, body, previewX, previewY) {
  const activeBody = body ?? getActiveBody(state);
  if (!activeBody) return null;

  let bestPlan = null;

  for (const facing of FACINGS) {
    const plan = chooseCpuAttackPlanAtPose(state, activeBody, previewX, previewY, facing);
    if (!plan) continue;

    const facingChangePenalty = facing === activeBody.facing ? 0 : 2;
    const scoredPlan = {
      ...plan,
      score: plan.score - facingChangePenalty,
      facing
    };

    if (!bestPlan || scoredPlan.score > bestPlan.score) {
      bestPlan = scoredPlan;
    }
  }

  return bestPlan;
}

function getPreferredRangeDistanceForBody(state, body) {
  const weaponCatalog = Array.isArray(state.content?.weapons) ? state.content.weapons : [];
  const weaponIds = getEquippedWeaponIds(body);

  let best = null;

  for (const weaponId of weaponIds) {
    const weapon = weaponCatalog.find((entry) => entry?.id === weaponId);
    if (!weapon) continue;

    const samples = [1, 4, 10, 17];
    let weaponBest = null;

    for (const distance of samples) {
      const range = getRangeModifier(weapon.id, distance);
      const score = ((Number(weapon.damage) || 0) * 1000) - (range.modifier * 120) - distance;
      if (!weaponBest || score > weaponBest.score) {
        weaponBest = { preferredDistance: distance, score };
      }
    }

    if (weaponBest && (!best || weaponBest.score > best.score)) {
      best = weaponBest;
    }
  }

  return best?.preferredDistance ?? 6;
}

export function chooseCpuMoveDestination(state) {
  const activeActor = getActiveActor(state);
  const activeBody = getActiveBody(state);
  if (!activeActor || !activeBody) return null;

  const enemies = getEnemyBoardUnits(state, activeActor.team);
  if (!enemies.length) return null;

  const reachable = getReachableTiles(state);
  if (!reachable.length) return null;

  let bestAttackPosition = null;

  for (const tile of reachable) {
    if (!tile) continue;

    const attackPlan = chooseCpuAttackPlanAtPosition(state, activeBody, tile.x, tile.y);
    if (!attackPlan) continue;

    const score = attackPlan.score - ((tile.cost ?? 0) * 5);
    if (!bestAttackPosition || score > bestAttackPosition.score) {
      bestAttackPosition = {
        x: tile.x,
        y: tile.y,
        facing: attackPlan.facing,
        score,
        cost: tile.cost ?? 0,
        attackPlan
      };
    }
  }

  if (bestAttackPosition) {
    if (
      bestAttackPosition.x === activeBody.x &&
      bestAttackPosition.y === activeBody.y &&
      bestAttackPosition.facing === activeBody.facing
    ) {
      return null;
    }
    return bestAttackPosition;
  }

  const preferredDistance = getPreferredRangeDistanceForBody(state, activeBody);
  let bestApproach = null;

  for (const tile of reachable) {
    if (!tile) continue;

    const nearestEnemy = enemies.reduce((best, enemy) => {
      const distance = manhattanDistance(tile.x, tile.y, enemy.x, enemy.y);
      if (!best || distance < best.distance) {
        return { enemy, distance };
      }
      return best;
    }, null);

    if (!nearestEnemy) continue;

    const distanceDelta = Math.abs(nearestEnemy.distance - preferredDistance);
    const score = (distanceDelta * 1000) + ((tile.cost ?? 0) * 10) + nearestEnemy.distance;
    const facing = getFacingToward(tile.x, tile.y, nearestEnemy.enemy.x, nearestEnemy.enemy.y, activeBody.facing);

    if (!bestApproach || score < bestApproach.score) {
      bestApproach = {
        x: tile.x,
        y: tile.y,
        facing,
        score,
        nearestEnemyDistance: nearestEnemy.distance,
        cost: tile.cost ?? 0,
        preferredDistance
      };
    }
  }

  if (!bestApproach) return null;
  if (
    bestApproach.x === activeBody.x &&
    bestApproach.y === activeBody.y &&
    bestApproach.facing === activeBody.facing
  ) {
    return null;
  }

  return bestApproach;
}

export function chooseCpuAttackPlan(state) {
  const activeBody = getActiveBody(state);
  if (!activeBody) return null;
  return chooseCpuAttackPlanAtPose(state, activeBody, activeBody.x, activeBody.y, activeBody.facing);
}
