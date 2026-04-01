import { MAP_CONFIG } from "./config.js";
import { getMechById } from "./mechs.js";

export function createActionUiState() {
  return {
    stage: null,
    selectedActionId: null,
    selectedAction: null,
    menuIndex: 0,
    validTargetTiles: [],
    effectTiles: [],
    fireArcTiles: [],
    targetTile: null,
    lastConfirmed: null
  };
}

export function resetActionUiState(state) {
  state.ui.action = createActionUiState();
  state.selection.targetTile = null;
  state.selection.targetMechId = null;
}

export function getCommandMenuItemsForPhase(phase) {
  if (phase === "action") {
    return ["attack", "ability", "item"];
  }

  return ["move", "brace"];
}

export function startAttackSelection(state) {
  const mech = getMechById(state.mechs, state.turn.activeMechId);
  if (!mech) return false;

  const attacks = getAvailableAttackProfiles(state, mech);
  if (!attacks.length) return false;

  state.ui.commandMenu.open = false;
  state.ui.mode = "action-attack-select";
  state.selection.action = "attack";
  state.ui.action.stage = "select";
  state.ui.action.menuIndex = 0;
  state.ui.action.selectedActionId = null;
  state.ui.action.selectedAction = null;
  state.ui.action.validTargetTiles = [];
  state.ui.action.effectTiles = [];
  state.ui.action.fireArcTiles = [];
  state.ui.action.targetTile = null;
  return true;
}

export function getAvailableAttackProfiles(state, mech) {
  const ids = mech.attackProfileIds ?? mech.weapons ?? [];
  const profiles = state.content.attacks ?? [];
  return ids
    .map((id) => profiles.find((entry) => entry.id === id))
    .filter(Boolean);
}

export function getSelectedAttackMenuItems(state) {
  const mech = getMechById(state.mechs, state.turn.activeMechId);
  if (!mech) return [];
  return getAvailableAttackProfiles(state, mech).map((profile) => ({
    id: profile.id,
    label: profile.name
  }));
}

export function moveAttackSelection(state, delta) {
  const items = getSelectedAttackMenuItems(state);
  if (!items.length) return false;
  const count = items.length;
  state.ui.action.menuIndex = (state.ui.action.menuIndex + delta + count) % count;
  return true;
}

export function confirmAttackSelection(state) {
  const mech = getMechById(state.mechs, state.turn.activeMechId);
  const items = getAvailableAttackProfiles(state, mech);
  if (!items.length) return false;

  const profile = items[state.ui.action.menuIndex] ?? null;
  if (!profile) return false;

  enterActionTargeting(state, profile);
  return true;
}

export function enterActionTargeting(state, profile) {
  const mech = getMechById(state.mechs, state.turn.activeMechId);
  if (!mech) return false;

  state.ui.mode = "action-target";
  state.ui.action.stage = "target";
  state.ui.action.selectedActionId = profile.id;
  state.ui.action.selectedAction = profile;
  state.ui.action.fireArcTiles = getFireArcTiles(mech, profile.fireArc);
  state.ui.action.validTargetTiles = getValidTargetTiles(state, mech, profile);

  if (state.ui.action.validTargetTiles.length) {
    const first = state.ui.action.validTargetTiles[0];
    state.focus.x = first.x;
    state.focus.y = first.y;
    updateActionTargetPreview(state);
  } else {
    state.ui.action.effectTiles = [];
    state.ui.action.targetTile = null;
  }

  return true;
}

export function updateActionTargetPreview(state) {
  const profile = state.ui.action.selectedAction;
  const mech = getMechById(state.mechs, state.turn.activeMechId);
  if (!profile || !mech) return;

  const match = state.ui.action.validTargetTiles.find(
    (tile) => tile.x === state.focus.x && tile.y === state.focus.y
  );

  if (!match) {
    state.ui.action.targetTile = null;
    state.ui.action.effectTiles = [];
    state.selection.targetTile = null;
    return;
  }

  state.ui.action.targetTile = { x: match.x, y: match.y };
  state.selection.targetTile = { x: match.x, y: match.y };
  state.ui.action.effectTiles = getEffectTiles(profile.effect, mech, match);
}

export function confirmActionTarget(state) {
  const mech = getMechById(state.mechs, state.turn.activeMechId);
  const profile = state.ui.action.selectedAction;
  const target = state.ui.action.targetTile;
  if (!mech || !profile || !target) return false;

  state.ui.action.lastConfirmed = {
    attackerId: mech.instanceId,
    attackId: profile.id,
    targetTile: { ...target },
    effectTiles: state.ui.action.effectTiles.map((tile) => ({ ...tile }))
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
    state.ui.action.stage = "select";
    state.ui.action.selectedActionId = null;
    state.ui.action.selectedAction = null;
    state.ui.action.validTargetTiles = [];
    state.ui.action.effectTiles = [];
    state.ui.action.fireArcTiles = [];
    state.ui.action.targetTile = null;
    state.selection.targetTile = null;
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

export function getValidTargetTiles(state, mech, profile) {
  const candidates = profile.targeting?.kind === "cardinal_adjacent"
    ? getCardinalAdjacentTiles(mech)
    : state.ui.action.fireArcTiles.slice();

  return dedupeTiles(candidates.filter((tile) => {
    if (!isInBounds(tile.x, tile.y)) return false;
    const distance = manhattanDistance(mech.x, mech.y, tile.x, tile.y);
    const min = profile.targeting?.minRange ?? 0;
    const max = profile.targeting?.maxRange ?? 0;

    if (distance < min || distance > max) return false;

    if (profile.targeting?.kind === "range_band") {
      return distance >= min && distance <= max;
    }

    if (profile.targeting?.kind === "fire_arc_tile") {
      return true;
    }

    if (profile.targeting?.kind === "cardinal_adjacent") {
      return true;
    }

    return false;
  }));
}

export function getFireArcTiles(mech, fireArc = { kind: "fan", range: 10 }) {
  if (!fireArc || fireArc.kind !== "fan") return [];

  const results = [];
  const range = fireArc.range ?? 10;

  for (let depth = 1; depth <= range; depth += 1) {
    for (let lateral = -(depth - 1); lateral <= (depth - 1); lateral += 1) {
      const tile = projectFacingOffset(mech, depth, lateral);
      if (!isInBounds(tile.x, tile.y)) continue;
      results.push(tile);
    }
  }

  return dedupeTiles(results);
}

export function getEffectTiles(effect, mech, targetTile) {
  if (!effect) return [{ x: targetTile.x, y: targetTile.y }];

  switch (effect.kind) {
    case "single":
      return [{ x: targetTile.x, y: targetTile.y }];
    case "circle":
      return getCircleTiles(targetTile.x, targetTile.y, effect.radius ?? 0);
    case "cone":
      return getConeTiles(mech, effect.length ?? 1, effect.width ?? 1);
    default:
      return [{ x: targetTile.x, y: targetTile.y }];
  }
}

function getConeTiles(mech, length, width) {
  const halfSpan = Math.floor(width / 2);
  const results = [];

  for (let depth = 1; depth <= length; depth += 1) {
    const spread = Math.min(halfSpan, depth - 1 + halfSpan);
    for (let lateral = -spread; lateral <= spread; lateral += 1) {
      const tile = projectFacingOffset(mech, depth, lateral);
      if (!isInBounds(tile.x, tile.y)) continue;
      results.push(tile);
    }
  }

  return dedupeTiles(results);
}

function getCircleTiles(centerX, centerY, radius) {
  const results = [];
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (!isInBounds(x, y)) continue;
      const dx = x - centerX;
      const dy = y - centerY;
      if ((dx * dx) + (dy * dy) <= radius * radius) {
        results.push({ x, y });
      }
    }
  }
  return dedupeTiles(results);
}

function getCardinalAdjacentTiles(mech) {
  return [
    { x: mech.x, y: mech.y - 1 },
    { x: mech.x + 1, y: mech.y },
    { x: mech.x, y: mech.y + 1 },
    { x: mech.x - 1, y: mech.y }
  ].filter((tile) => isInBounds(tile.x, tile.y));
}

function projectFacingOffset(mech, forward, lateral) {
  switch (mech.facing) {
    case 0:
      return { x: mech.x + lateral, y: mech.y - forward };
    case 1:
      return { x: mech.x + forward, y: mech.y + lateral };
    case 2:
      return { x: mech.x - lateral, y: mech.y + forward };
    case 3:
      return { x: mech.x - forward, y: mech.y - lateral };
    default:
      return { x: mech.x, y: mech.y };
  }
}

function dedupeTiles(tiles) {
  const seen = new Set();
  const results = [];
  for (const tile of tiles) {
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ x: tile.x, y: tile.y });
  }
  return results;
}

function isInBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_CONFIG.mechWidth && y < MAP_CONFIG.mechHeight;
}

function manhattanDistance(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}
