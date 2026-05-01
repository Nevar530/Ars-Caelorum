import { getActiveActor, getActiveBody, getBoardUnits } from "../actors/actorResolver.js";
import { getReachableTiles } from "../movement.js";
import { getEquippedWeaponIds } from "../content/unitLoadout.js";
import { normalizeWeaponToActionProfile, updateActionTargetPreview } from "../targeting/targetingResolver.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getRangeModifier } from "../combat/hitResolver.js";
import { isUnitDirectlyTargetable } from "../targeting/targetLegality.js";

const FACINGS = [0, 1, 2, 3];
const RECENT_POSITION_PENALTY = 260;
const SAME_TILE_HOLD_BONUS = 80;
const SAME_TARGET_BONUS = 70;
const ROLE_TARGET_BONUS = 180;
const FINISHABLE_TARGET_BONUS = 320;
const DAMAGED_TARGET_BONUS = 90;
const CLEAN_SHOT_BONUS = 120;
const HALF_COVER_PENALTY = 115;
const MOVE_COST_PENALTY = 8;
const THREAT_PENALTY = 55;
const EXPOSURE_PENALTY = 18;

function manhattanDistance(ax, ay, bx, by) {
  return Math.abs(Number(ax) - Number(bx)) + Math.abs(Number(ay) - Number(by));
}

function getCpuMemory(body) {
  if (!body) return {};
  if (!body.aiMemory || typeof body.aiMemory !== "object") {
    body.aiMemory = {};
  }
  return body.aiMemory;
}

function getEnemyBoardUnits(state, team) {
  return getBoardUnits(state).filter((unit) => {
    if (!unit) return false;
    if (unit.team === team) return false;
    return isUnitDirectlyTargetable(unit, state);
  });
}

function getRemainingDurability(unit) {
  return Math.max(0, Number(unit?.shield ?? 0)) + Math.max(0, Number(unit?.core ?? 0));
}

function getPreferredTargetType(activeActor, activeBody) {
  if (activeBody?.unitType === "mech") return "mech";
  if (activeActor?.unitType === "pilot") return "pilot";
  if (activeBody?.unitType === "pilot") return "pilot";
  return null;
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

function scoreTargetRole(activeActor, activeBody, targetUnit) {
  const preferredType = getPreferredTargetType(activeActor, activeBody);
  if (!preferredType || !targetUnit?.unitType) return 0;
  return targetUnit.unitType === preferredType ? ROLE_TARGET_BONUS : 0;
}

function scoreTargetCondition(weapon, targetUnit) {
  const damage = Number(weapon?.damage) || 0;
  const remaining = getRemainingDurability(targetUnit);
  const maxTotal = Math.max(1, Number(targetUnit?.maxShield ?? 0) + Number(targetUnit?.maxCore ?? 0));
  const currentTotal = Math.max(0, Number(targetUnit?.shield ?? 0) + Number(targetUnit?.core ?? 0));
  const damagedRatio = currentTotal / maxTotal;

  let score = 0;
  if (remaining > 0 && damage >= remaining) {
    score += FINISHABLE_TARGET_BONUS;
  } else if (targetUnit?.status === "damaged" || damagedRatio <= 0.55) {
    score += DAMAGED_TARGET_BONUS;
  }

  return score;
}

function scoreAttackCandidate({ activeActor, activeBody, weapon, tile, targetUnit, memory }) {
  const distance = Number(tile.distance) || 0;
  const range = getRangeModifier(weapon.id, distance);
  const damage = Number(weapon.damage) || 0;
  const coverPenalty = tile.cover === "half" ? HALF_COVER_PENALTY : 0;
  const cleanShotBonus = tile.cover === "half" ? 0 : CLEAN_SHOT_BONUS;
  const sameTargetBonus = memory?.lastTargetId && memory.lastTargetId === targetUnit.instanceId
    ? SAME_TARGET_BONUS
    : 0;

  const score =
    (damage * 1000) -
    (range.modifier * 115) -
    coverPenalty -
    (distance * 2) +
    cleanShotBonus +
    sameTargetBonus +
    scoreTargetRole(activeActor, activeBody, targetUnit) +
    scoreTargetCondition(weapon, targetUnit);

  return {
    score,
    distance,
    rangeBand: range.band,
    rangeModifier: range.modifier,
    coverPenalty
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

  const memory = getCpuMemory(activeBody);
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

        const scored = scoreAttackCandidate({
          activeActor,
          activeBody,
          weapon,
          tile,
          targetUnit,
          memory
        });

        if (!bestCandidate || scored.score > bestCandidate.score) {
          bestCandidate = {
            x: tile.x,
            y: tile.y,
            score: scored.score,
            distance: scored.distance,
            rangeBand: scored.rangeBand,
            rangeModifier: scored.rangeModifier,
            coverPenalty: scored.coverPenalty,
            targetUnitId: targetUnit.instanceId,
            targetName: targetUnit.name,
            targetType: targetUnit.unitType
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
        targetType: bestCandidate.targetType,
        score: bestCandidate.score,
        distance: bestCandidate.distance,
        rangeBand: bestCandidate.rangeBand,
        rangeModifier: bestCandidate.rangeModifier,
        coverPenalty: bestCandidate.coverPenalty
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

function chooseBestAttackPlanForTile(state, body, x, y) {
  let best = null;

  for (const facing of FACINGS) {
    const attackPlan = chooseCpuAttackPlanAtPose(state, body, x, y, facing);
    if (!attackPlan) continue;

    const facingChangePenalty = Number(body?.facing) === facing ? 0 : 8;
    const score = attackPlan.score - facingChangePenalty;

    if (!best || score > best.score) {
      best = {
        facing,
        score,
        attackPlan
      };
    }
  }

  return best;
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

function estimateEnemyThreatAtPosition(state, activeBody, tileX, tileY, enemies) {
  if (!Array.isArray(enemies) || !enemies.length) return 0;

  let threat = 0;

  for (const enemy of enemies) {
    const distance = manhattanDistance(tileX, tileY, enemy.x, enemy.y);
    const enemyWeaponIds = getEquippedWeaponIds(enemy);
    const maxThreatRange = enemyWeaponIds.length ? 20 : 1;

    if (distance <= maxThreatRange) {
      threat += Math.max(0, maxThreatRange - distance + 1);
    }

    if (distance <= 1 && activeBody.unitType === "pilot") {
      threat += 8;
    }
  }

  return threat;
}

function getReversalPenalty(body, tileX, tileY) {
  const memory = getCpuMemory(body);
  if (Number(memory.lastX) === Number(tileX) && Number(memory.lastY) === Number(tileY)) {
    return RECENT_POSITION_PENALTY;
  }
  return 0;
}

function getHoldBonus(body, tileX, tileY) {
  if (Number(body?.x) === Number(tileX) && Number(body?.y) === Number(tileY)) {
    return SAME_TILE_HOLD_BONUS;
  }
  return 0;
}

function chooseFacingTowardNearestEnemy(body, enemies) {
  if (!body || !Array.isArray(enemies) || !enemies.length) return body?.facing ?? 0;

  const nearest = enemies.reduce((best, enemy) => {
    const distance = manhattanDistance(body.x, body.y, enemy.x, enemy.y);
    return !best || distance < best.distance ? { enemy, distance } : best;
  }, null)?.enemy;

  if (!nearest) return body.facing ?? 0;

  const dx = Number(nearest.x) - Number(body.x);
  const dy = Number(nearest.y) - Number(body.y);

  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  if (dy !== 0) return dy > 0 ? 2 : 0;
  return body.facing ?? 0;
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

    const bestTileAttack = chooseBestAttackPlanForTile(state, activeBody, tile.x, tile.y);
    if (!bestTileAttack) continue;

    const moveCost = Number(tile.cost ?? 0);
    const threat = estimateEnemyThreatAtPosition(state, activeBody, tile.x, tile.y, enemies);
    const exposure = Math.min(...enemies.map((enemy) => manhattanDistance(tile.x, tile.y, enemy.x, enemy.y)));
    const reversalPenalty = getReversalPenalty(activeBody, tile.x, tile.y);
    const holdBonus = getHoldBonus(activeBody, tile.x, tile.y);

    const score =
      bestTileAttack.score -
      (moveCost * MOVE_COST_PENALTY) -
      (threat * THREAT_PENALTY) -
      (Number.isFinite(exposure) ? Math.max(0, 4 - exposure) * EXPOSURE_PENALTY : 0) -
      reversalPenalty +
      holdBonus;

    if (!bestAttackPosition || score > bestAttackPosition.score) {
      bestAttackPosition = {
        x: tile.x,
        y: tile.y,
        facing: bestTileAttack.facing,
        score,
        cost: moveCost,
        threat,
        attackPlan: bestTileAttack.attackPlan
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

    const nearestEnemyDistance = Math.min(...enemies.map((enemy) => manhattanDistance(tile.x, tile.y, enemy.x, enemy.y)));
    const distanceDelta = Math.abs(nearestEnemyDistance - preferredDistance);
    const threat = estimateEnemyThreatAtPosition(state, activeBody, tile.x, tile.y, enemies);
    const reversalPenalty = getReversalPenalty(activeBody, tile.x, tile.y);
    const holdBonus = getHoldBonus(activeBody, tile.x, tile.y);
    const score =
      (distanceDelta * 1000) +
      ((tile.cost ?? 0) * 10) +
      nearestEnemyDistance +
      (threat * 120) +
      reversalPenalty -
      holdBonus;

    if (!bestApproach || score < bestApproach.score) {
      bestApproach = {
        x: tile.x,
        y: tile.y,
        facing: chooseFacingTowardNearestEnemy({ ...activeBody, x: tile.x, y: tile.y }, enemies),
        score,
        nearestEnemyDistance,
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

  const currentFacingPlan = chooseCpuAttackPlanAtPose(
    state,
    activeBody,
    activeBody.x,
    activeBody.y,
    activeBody.facing
  );

  if (currentFacingPlan) {
    const memory = getCpuMemory(activeBody);
    memory.lastTargetId = currentFacingPlan.targetUnitId;
  }

  return currentFacingPlan;
}
