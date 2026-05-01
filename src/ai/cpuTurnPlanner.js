import { getActiveActor, getActiveBody, getBoardUnits } from "../actors/actorResolver.js";
import { getReachableTiles } from "../movement.js";
import { getEquippedWeaponIds } from "../content/unitLoadout.js";
import { normalizeWeaponToActionProfile, updateActionTargetPreview } from "../targeting/targetingResolver.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getRangeModifier } from "../combat/hitResolver.js";

const CARDINAL_FACINGS = [0, 1, 2, 3];

function manhattanDistance(ax, ay, bx, by) {
  return Math.abs(Number(ax) - Number(bx)) + Math.abs(Number(ay) - Number(by));
}

function getEnemyBoardUnits(state, team) {
  return getBoardUnits(state).filter((unit) => {
    if (!unit) return false;
    if (unit.team === team) return false;
    if (unit.status === "disabled") return false;
    return true;
  });
}

function normalizeFacing(value, fallback = 2) {
  const facing = Number(value);
  if ([0, 1, 2, 3].includes(facing)) return facing;
  return fallback;
}

function getFacingTowardTile(fromX, fromY, toX, toY, fallbackFacing = 2) {
  const dx = Number(toX) - Number(fromX);
  const dy = Number(toY) - Number(fromY);

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    return dx > 0 ? 1 : 3;
  }

  if (dy !== 0) {
    return dy > 0 ? 2 : 0;
  }

  return normalizeFacing(fallbackFacing);
}

function withPreviewBodyPose(state, body, x, y, facing, fn) {
  const originalX = body.x;
  const originalY = body.y;
  const originalFacing = body.facing;
  body.x = Number(x);
  body.y = Number(y);
  body.facing = normalizeFacing(facing, body.facing);
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

function scoreAttackCandidate(weapon, tile, targetUnit) {
  const distance = Number(tile.distance) || 0;
  const range = getRangeModifier(weapon.id, distance);
  const damage = Number(weapon.damage) || 0;
  const coverPenalty = tile.cover === "half" ? 1 : 0;
  const targetTypePenalty = targetUnit.unitType === "pilot" ? 0 : 1;
  const score =
    (damage * 1000) -
    (range.modifier * 100) -
    (coverPenalty * 25) -
    (distance * 2) -
    targetTypePenalty;

  return {
    score,
    distance,
    rangeBand: range.band,
    rangeModifier: range.modifier,
    coverPenalty
  };
}

function chooseCpuAttackPlanAtPosition(state, body, previewX, previewY, previewFacing = body?.facing) {
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

        const scored = scoreAttackCandidate(weapon, tile, targetUnit);

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
        facing: normalizeFacing(previewFacing, activeBody.facing)
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

function chooseBestAttackPlanForPosition(state, body, x, y) {
  let bestPlan = null;

  for (const facing of CARDINAL_FACINGS) {
    const plan = chooseCpuAttackPlanAtPosition(state, body, x, y, facing);
    if (!plan) continue;

    const facingPenalty = normalizeFacing(body.facing) === facing ? 0 : 1;
    const score = plan.score - facingPenalty;

    if (!bestPlan || score > bestPlan.score) {
      bestPlan = {
        ...plan,
        score,
        facing
      };
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
      const score = ((Number(weapon.damage) || 0) * 1000) - (range.modifier * 100) - distance;
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

    const attackPlan = chooseBestAttackPlanForPosition(state, activeBody, tile.x, tile.y);
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
    const sameTile = bestAttackPosition.x === activeBody.x && bestAttackPosition.y === activeBody.y;
    const sameFacing = normalizeFacing(bestAttackPosition.facing, activeBody.facing) === normalizeFacing(activeBody.facing);
    if (sameTile && sameFacing) {
      return null;
    }
    return bestAttackPosition;
  }

  const preferredDistance = getPreferredRangeDistanceForBody(state, activeBody);
  let bestApproach = null;

  for (const tile of reachable) {
    if (!tile) continue;

    let nearestEnemy = null;
    let nearestEnemyDistance = Infinity;

    for (const enemy of enemies) {
      const distance = manhattanDistance(tile.x, tile.y, enemy.x, enemy.y);
      if (distance < nearestEnemyDistance) {
        nearestEnemy = enemy;
        nearestEnemyDistance = distance;
      }
    }

    const distanceDelta = Math.abs(nearestEnemyDistance - preferredDistance);
    const score = (distanceDelta * 1000) + ((tile.cost ?? 0) * 10) + nearestEnemyDistance;

    if (!bestApproach || score < bestApproach.score) {
      bestApproach = {
        x: tile.x,
        y: tile.y,
        facing: nearestEnemy
          ? getFacingTowardTile(tile.x, tile.y, nearestEnemy.x, nearestEnemy.y, activeBody.facing)
          : activeBody.facing,
        score,
        nearestEnemyDistance,
        cost: tile.cost ?? 0,
        preferredDistance
      };
    }
  }

  if (!bestApproach) return null;

  const sameTile = bestApproach.x === activeBody.x && bestApproach.y === activeBody.y;
  const sameFacing = normalizeFacing(bestApproach.facing, activeBody.facing) === normalizeFacing(activeBody.facing);
  if (sameTile && sameFacing) return null;

  return bestApproach;
}

export function chooseCpuAttackPlan(state) {
  const activeBody = getActiveBody(state);
  if (!activeBody) return null;
  return chooseCpuAttackPlanAtPosition(state, activeBody, activeBody.x, activeBody.y, activeBody.facing);
}
