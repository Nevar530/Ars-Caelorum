import { getActiveActor, getActiveBody, getBoardUnits } from "../actors/actorResolver.js";
import { getReachableTiles } from "../movement.js";
import { getEquippedWeaponIds } from "../content/unitLoadout.js";
import { normalizeWeaponToActionProfile, updateActionTargetPreview } from "../targeting/targetingResolver.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";

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

export function chooseCpuMoveDestination(state) {
  const activeActor = getActiveActor(state);
  const activeBody = getActiveBody(state);
  if (!activeActor || !activeBody) return null;

  const enemies = getEnemyBoardUnits(state, activeActor.team);
  if (!enemies.length) return null;

  const reachable = getReachableTiles(state);
  if (!reachable.length) return null;

  const currentDistance = Math.min(...enemies.map((enemy) => manhattanDistance(activeBody.x, activeBody.y, enemy.x, enemy.y)));

  let best = null;

  for (const tile of reachable) {
    if (!tile) continue;

    const nearestEnemyDistance = Math.min(...enemies.map((enemy) => manhattanDistance(tile.x, tile.y, enemy.x, enemy.y)));
    const score = (nearestEnemyDistance * 1000) + (tile.cost ?? 0);

    if (!best || score < best.score) {
      best = {
        x: tile.x,
        y: tile.y,
        score,
        nearestEnemyDistance,
        cost: tile.cost ?? 0
      };
    }
  }

  if (!best) return null;
  if (best.x === activeBody.x && best.y === activeBody.y) return null;
  if (best.nearestEnemyDistance >= currentDistance) return null;

  return best;
}

export function chooseCpuAttackPlan(state) {
  const activeActor = getActiveActor(state);
  const activeBody = getActiveBody(state);
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

    const plan = withPreviewBodyPosition(state, activeBody, activeBody.x, activeBody.y, () => {
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

        const score =
          ((Number(weapon.damage) || 0) * 1000) -
          ((Number(tile.distance) || 0) * 10) -
          (targetUnit.unitType === "pilot" ? 0 : 1);

        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = {
            x: tile.x,
            y: tile.y,
            score,
            distance: Number(tile.distance) || 0,
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
        distance: bestCandidate.distance
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
