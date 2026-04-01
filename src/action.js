import { getMechById } from "./mechs.js";
import { filterTilesByLineOfSight } from "./los.js";

export function createActionUiState() {
  return {
    menuIndex: 0,
    selectedAction: null,
    fireArcTiles: [],
    validTargetTiles: [],
    effectTiles: [],
    lastConfirmed: null
  };
}

export function resetActionUiState(state) {
  state.ui.action.menuIndex = 0;
  state.ui.action.selectedAction = null;
  state.ui.action.fireArcTiles = [];
  state.ui.action.validTargetTiles = [];
  state.ui.action.effectTiles = [];
}

export function getCommandMenuItemsForPhase(phase) {
  if (phase === "move") {
    return ["move", "brace"];
  }

  if (phase === "action") {
    return ["attack", "ability", "item"];
  }

  return [];
}

export function getSelectedAttackMenuItems(state) {
  const activeMech = getActiveMech(state);
  if (!activeMech) return [];

  const ids = activeMech.attackProfileIds || [];
  const allAttacks = state.content.attacks || [];

  return ids
    .map((id) => allAttacks.find((attack) => attack.id === id))
    .filter(Boolean)
    .map((attack) => ({
      id: attack.id,
      label: attack.name,
      profile: attack
    }));
}

export function moveAttackSelection(state, delta) {
  const items = getSelectedAttackMenuItems(state);
  if (!items.length) return;

  const count = items.length;
  state.ui.action.menuIndex =
    (state.ui.action.menuIndex + delta + count) % count;
}

export function startAttackSelection(state) {
  if (state.turn.phase !== "action") return false;

  const items = getSelectedAttackMenuItems(state);
  if (!items.length) return false;

  state.ui.commandMenu.open = false;
  state.ui.commandMenu.index = 0;

  state.ui.mode = "action-attack-select";
  state.selection.action = "attack";
  state.ui.action.menuIndex = 0;
  state.ui.action.selectedAction = null;
  state.ui.action.fireArcTiles = [];
  state.ui.action.validTargetTiles = [];
  state.ui.action.effectTiles = [];

  return true;
}

export function confirmAttackSelection(state) {
  if (state.ui.mode !== "action-attack-select") return false;

  const items = getSelectedAttackMenuItems(state);
  if (!items.length) return false;

  const chosen = items[state.ui.action.menuIndex];
  if (!chosen) return false;

  state.ui.action.selectedAction = chosen.profile;
  state.ui.mode = "action-target";

  updateActionTargetPreview(state);
  snapFocusToFirstValidTarget(state);

  return true;
}

export function updateActionTargetPreview(state) {
  const activeMech = getActiveMech(state);
  const profile = state.ui.action.selectedAction;

  if (!activeMech || !profile) {
    state.ui.action.fireArcTiles = [];
    state.ui.action.validTargetTiles = [];
    state.ui.action.effectTiles = [];
    return;
  }

  const fireArcTiles = getFireArcTiles(activeMech, profile.fireArcRange ?? 10);
  const candidateTiles = getWeaponCandidateTiles(activeMech, profile);

  const fireArcSet = toTileKeySet(fireArcTiles);

  const inArcCandidates = candidateTiles.filter((tile) =>
    fireArcSet.has(tileKey(tile.x, tile.y))
  );

  const validTiles = applyLosFilter(state, activeMech, profile, inArcCandidates);

  state.ui.action.fireArcTiles = fireArcTiles;
  state.ui.action.validTargetTiles = validTiles;

  const focusedIsValid = validTiles.some(
    (tile) => tile.x === state.focus.x && tile.y === state.focus.y
  );

  if (focusedIsValid) {
    state.ui.action.effectTiles = getEffectTilesForTarget(
      activeMech,
      profile,
      state.focus.x,
      state.focus.y
    );
  } else {
    state.ui.action.effectTiles = [];
  }
}

export function confirmActionTarget(state) {
  if (state.ui.mode !== "action-target") return false;

  const profile = state.ui.action.selectedAction;
  if (!profile) return false;

  const isValid = state.ui.action.validTargetTiles.some(
    (tile) => tile.x === state.focus.x && tile.y === state.focus.y
  );

  if (!isValid) return false;

  state.ui.action.lastConfirmed = {
    attackId: profile.id,
    attackName: profile.name,
    target: { x: state.focus.x, y: state.focus.y },
    effectTiles: [...state.ui.action.effectTiles]
  };

  state.ui.mode = "idle";
  state.selection.action = null;
  state.ui.commandMenu.open = false;
  state.ui.commandMenu.index = 0;

  return true;
}

export function cancelActionState(state) {
  if (state.ui.mode === "action-target") {
    state.ui.mode = "action-attack-select";
    state.ui.action.selectedAction = null;
    state.ui.action.fireArcTiles = [];
    state.ui.action.validTargetTiles = [];
    state.ui.action.effectTiles = [];
    return true;
  }

  if (state.ui.mode === "action-attack-select") {
    resetActionUiState(state);
    state.ui.mode = "idle";
    state.selection.action = null;
    state.ui.commandMenu.open = true;
    state.ui.commandMenu.index = 0;
    return true;
  }

  return false;
}

function getActiveMech(state) {
  return getMechById(state.mechs, state.turn.activeMechId);
}

function snapFocusToFirstValidTarget(state) {
  const first = state.ui.action.validTargetTiles[0];
  if (!first) return;

  state.focus.x = first.x;
  state.focus.y = first.y;

  const activeMech = getActiveMech(state);
  const profile = state.ui.action.selectedAction;

  state.ui.action.effectTiles = getEffectTilesForTarget(
    activeMech,
    profile,
    first.x,
    first.y
  );
}

function applyLosFilter(state, mech, profile, candidateTiles) {
  if (profile.kind === "melee") {
    return candidateTiles;
  }

  return filterTilesByLineOfSight(
    state,
    { x: mech.x, y: mech.y },
    candidateTiles
  );
}

function getWeaponCandidateTiles(mech, profile) {
  switch (profile.kind) {
    case "melee":
      return getCardinalAdjacentTiles(mech.x, mech.y);

    case "missile":
      return getTilesInRangeBand(mech.x, mech.y, 1, profile.rangeMax ?? 6);

    case "rifle":
      return getTilesInRangeBand(
        mech.x,
        mech.y,
        profile.rangeMin ?? 6,
        profile.rangeMax ?? 8
      );

    case "machine_gun":
      return getConeTargetTiles(
        mech.x,
        mech.y,
        mech.facing,
        profile.rangeMax ?? 5,
        profile.coneWidth ?? 3
      );

    default:
      return [];
  }
}

function getEffectTilesForTarget(mech, profile, targetX, targetY) {
  switch (profile.kind) {
    case "melee":
      return [{ x: targetX, y: targetY }];

    case "rifle":
      return [{ x: targetX, y: targetY }];

    case "missile":
      return getCircleTiles(targetX, targetY, profile.aoeRadius ?? 3);

    case "machine_gun":
      return getConeTargetTiles(
        mech.x,
        mech.y,
        mech.facing,
        profile.rangeMax ?? 5,
        profile.coneWidth ?? 3
      );

    default:
      return [];
  }
}

function getFireArcTiles(mech, range) {
  const results = [];
  const facing = mech.facing;

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      if (dx === 0 && dy === 0) continue;

      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > range) continue;

      if (isInForwardFan(dx, dy, facing)) {
        results.push({ x: mech.x + dx, y: mech.y + dy });
      }
    }
  }

  return uniqueBoardTiles(results);
}

function isInForwardFan(dx, dy, facing) {
  switch (facing) {
    case 0:
      return dy < 0 && Math.abs(dx) <= Math.abs(dy);
    case 1:
      return dx > 0 && Math.abs(dy) <= Math.abs(dx);
    case 2:
      return dy > 0 && Math.abs(dx) <= Math.abs(dy);
    case 3:
      return dx < 0 && Math.abs(dy) <= Math.abs(dx);
    default:
      return false;
  }
}

function getCardinalAdjacentTiles(x, y) {
  return uniqueBoardTiles([
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y }
  ]);
}

function getTilesInRangeBand(x, y, minRange, maxRange) {
  const results = [];

  for (let dx = -maxRange; dx <= maxRange; dx++) {
    for (let dy = -maxRange; dy <= maxRange; dy++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < minRange || dist > maxRange) continue;
      results.push({ x: x + dx, y: y + dy });
    }
  }

  return uniqueBoardTiles(results);
}

function getCircleTiles(cx, cy, radius) {
  const results = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const distSq = (dx * dx) + (dy * dy);
      if (distSq <= radius * radius) {
        results.push({ x: cx + dx, y: cy + dy });
      }
    }
  }

  return uniqueBoardTiles(results);
}

function getConeTargetTiles(x, y, facing, range, width) {
  const results = [];
  const half = Math.floor(width / 2);

  for (let step = 1; step <= range; step++) {
    for (let lateral = -half; lateral <= half; lateral++) {
      let tx = x;
      let ty = y;

      switch (facing) {
        case 0:
          tx = x + lateral;
          ty = y - step;
          break;
        case 1:
          tx = x + step;
          ty = y + lateral;
          break;
        case 2:
          tx = x + lateral;
          ty = y + step;
          break;
        case 3:
          tx = x - step;
          ty = y + lateral;
          break;
      }

      results.push({ x: tx, y: ty });
    }
  }

  return uniqueBoardTiles(results);
}

function uniqueBoardTiles(tiles) {
  const seen = new Set();
  const results = [];

  for (const tile of tiles) {
    if (tile.x < 0 || tile.y < 0) continue;
    const key = tileKey(tile.x, tile.y);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(tile);
  }

  return results;
}

function toTileKeySet(tiles) {
  const set = new Set();
  for (const tile of tiles) {
    set.add(tileKey(tile.x, tile.y));
  }
  return set;
}

function tileKey(x, y) {
  return `${x},${y}`;
}
