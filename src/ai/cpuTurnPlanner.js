import { getActiveActor, getActiveBody, getBoardUnits } from "../actors/actorResolver.js";
import { getReachableTiles } from "../movement.js";
import { getEquippedWeaponIds } from "../content/unitLoadout.js";
import { normalizeWeaponToActionProfile, updateActionTargetPreview } from "../targeting/targetingResolver.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getRangeModifier } from "../combat/hitResolver.js";

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

function withPreviewBodyPosition(state, body, x, y, fn) {
  const originalX = body.x;
  const originalY = body.y;
  body.x = Number(x);
  body.y = Number(y);
  try {
    return fn();
  } finally {
    body.x = originalX;
    body.y = originalY;
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

function chooseCpuAttackPlanAtPosition(state, body, previewX, previewY) {
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

    const plan = withPreviewBodyPosition(state, activeBody, previewX, previewY, () => {
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
        rangeModifier: bestCandidate.rangeModifier
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

    const attackPlan = chooseCpuAttackPlanAtPosition(state, activeBody, tile.x, tile.y);
    if (!attackPlan) continue;

    const score = attackPlan.score - ((tile.cost ?? 0) * 5);
    if (!bestAttackPosition || score > bestAttackPosition.score) {
      bestAttackPosition = {
        x: tile.x,
        y: tile.y,
        score,
        cost: tile.cost ?? 0,
        attackPlan
      };
    }
  }

  if (bestAttackPosition) {
    if (bestAttackPosition.x === activeBody.x && bestAttackPosition.y === activeBody.y) {
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
    const score = (distanceDelta * 1000) + ((tile.cost ?? 0) * 10) + nearestEnemyDistance;

    if (!bestApproach || score < bestApproach.score) {
      bestApproach = {
        x: tile.x,
        y: tile.y,
        score,
        nearestEnemyDistance,
        cost: tile.cost ?? 0,
        preferredDistance
      };
    }
  }

  if (!bestApproach) return null;
  if (bestApproach.x === activeBody.x && bestApproach.y === activeBody.y) return null;

  return bestApproach;
}

export function chooseCpuAttackPlan(state) {
  const activeBody = getActiveBody(state);
  if (!activeBody) return null;
  return chooseCpuAttackPlanAtPosition(state, activeBody, activeBody.x, activeBody.y);
}
