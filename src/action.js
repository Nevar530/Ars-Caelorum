// src/action.js

import { getMechById } from "./mechs.js";
import {
  getLineOfSightResult,
  getMissileLineOfSightResult
} from "./los.js";

const RANGE_BAND_THRESHOLDS = {
  pointBlank: { min: 1, max: 1 },
  close: { min: 2, max: 4 },
  mid: { min: 5, max: 10 },
  far: { min: 11, max: 20 },
  extreme: { min: 21, max: Infinity }
};

export function createActionUiState() {
  return {
    menuIndex: 0,
    selectedAction: null,
    fireArcTiles: [],
    evaluatedTargetTiles: [],
    validTargetTiles: [],
    effectTiles: [],
    lastConfirmed: null
  };
}

export function resetActionUiState(state) {
  state.ui.action.menuIndex = 0;
  state.ui.action.selectedAction = null;
  state.ui.action.fireArcTiles = [];
  state.ui.action.evaluatedTargetTiles = [];
  state.ui.action.validTargetTiles = [];
  state.ui.action.effectTiles = [];
}

export function getCommandMenuItemsForPhase(phase) {
  if (phase === "move") {
    return ["move", "brace"];
  }

  if (phase === "action") {
    return ["attack", "ability", "item", "end_turn"];
  }

  return [];
}

export function getSelectedAttackMenuItems(state) {
  const activeMech = getActiveMech(state);
  if (!activeMech) return [];

  const weaponIds = Array.isArray(activeMech.weapons) ? activeMech.weapons : [];
  const allWeapons = Array.isArray(state.content.weapons) ? state.content.weapons : [];

  return weaponIds
    .map((weaponId) => allWeapons.find((weapon) => weapon.id === weaponId))
    .filter(Boolean)
    .map((weapon) => {
      const profile = normalizeWeaponToActionProfile(weapon);

      return {
        id: profile.id,
        label: profile.name,
        profile
      };
    });
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
  state.ui.action.evaluatedTargetTiles = [];
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
    state.ui.action.evaluatedTargetTiles = [];
    state.ui.action.validTargetTiles = [];
    state.ui.action.effectTiles = [];
    return;
  }

  const fireArcRange = profile.fireArc?.range ?? 10;
  const fireArcTiles = getFireArcTiles(activeMech, fireArcRange);
  const candidateTiles = getWeaponCandidateTiles(activeMech, profile);
  const arcFilteredTiles = applyFireArcFilter(profile, fireArcTiles, candidateTiles);
  const evaluatedTiles = evaluateLosForTargets(state, activeMech, profile, arcFilteredTiles);
  const validTiles = evaluatedTiles.filter((tile) => tile.visible === true);

  state.ui.action.fireArcTiles = fireArcTiles;
  state.ui.action.evaluatedTargetTiles = evaluatedTiles;
  state.ui.action.validTargetTiles = validTiles;

  const focusedTile = evaluatedTiles.find(
    (tile) => tile.x === state.focus.x && tile.y === state.focus.y
  );

  if (focusedTile) {
    state.ui.action.effectTiles = getEffectTilesForTarget(
      activeMech,
      profile,
      focusedTile.x,
      focusedTile.y
    );
  } else {
    state.ui.action.effectTiles = [];
  }
}

export function confirmActionTarget(state) {
  if (state.ui.mode !== "action-target") return false;

  const profile = state.ui.action.selectedAction;
  if (!profile) return false;

  const chosenTarget = state.ui.action.validTargetTiles.find(
    (tile) => tile.x === state.focus.x && tile.y === state.focus.y
  );

  if (!chosenTarget) return false;

  state.ui.action.lastConfirmed = {
    attackId: profile.id,
    attackName: profile.name,
    weaponType: profile.weaponType,
    target: { x: chosenTarget.x, y: chosenTarget.y },
    targetCover: chosenTarget.cover ?? "none",
    targetLos: chosenTarget.los ?? null,
    targetDistance: chosenTarget.distance ?? null,
    targetRangeBand: chosenTarget.rangeBand ?? null,
    targetRangeModifier: chosenTarget.rangeModifier ?? null,
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
    state.ui.action.evaluatedTargetTiles = [];
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

export function getRangeBandForDistance(distance) {
  if (!Number.isFinite(distance) || distance < 1) return null;

  for (const [band, rule] of Object.entries(RANGE_BAND_THRESHOLDS)) {
    if (distance >= rule.min && distance <= rule.max) {
      return band;
    }
  }

  return "extreme";
}

function getActiveMech(state) {
  return getMechById(state.mechs, state.turn.activeMechId);
}

function normalizeWeaponToActionProfile(weapon) {
  const type = weapon.type ?? "direct";
  const scale = weapon.scale ?? "mech";
  const range = weapon.range ?? { min: 1, max: 1 };

  if (type === "melee") {
    return {
      id: weapon.id,
      name: weapon.name,
      scale,
      weaponType: "melee",
      fireArc: weapon.fireArc ?? { kind: "fan", range: 10 },
      targeting: {
        kind: "cardinal_adjacent",
        minRange: 1,
        maxRange: 1
      },
      effect: weapon.effect ?? { kind: "single" },
      losType: "direct",
      rangeBands: weapon.rangeBands ?? {
        pointBlank: 0,
        close: 0,
        mid: 0,
        far: 0,
        extreme: 0
      },
      damage: weapon.damage ?? 0
    };
  }

  if (type === "missile") {
    return {
      id: weapon.id,
      name: weapon.name,
      scale,
      weaponType: "missile",
      fireArc: weapon.fireArc ?? { kind: "fan", range: 10 },
      targeting: {
        kind: "fire_arc_tile",
        minRange: range.min ?? 1,
        maxRange: range.max ?? 6
      },
      effect: weapon.effect ?? { kind: "circle", radius: 3 },
      losType: weapon.losType ?? "missile",
      rangeBands: weapon.rangeBands ?? {},
      splashTn: weapon.splashTn ?? {},
      damage: weapon.damage ?? 0
    };
  }

  return {
    id: weapon.id,
    name: weapon.name,
    scale,
    weaponType: "direct",
    fireArc: weapon.fireArc ?? { kind: "fan", range: 10 },
    targeting: {
      kind: "range_band",
      minRange: range.min ?? 1,
      maxRange: range.max ?? 20
    },
    effect: weapon.effect ?? { kind: "single" },
    losType: weapon.losType ?? "direct",
    rangeBands: weapon.rangeBands ?? {},
    damage: weapon.damage ?? 0
  };
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

function applyFireArcFilter(profile, fireArcTiles, candidateTiles) {
  const targetingKind = profile.targeting?.kind;

  if (targetingKind === "cardinal_adjacent") {
    return candidateTiles;
  }

  const fireArcSet = toTileKeySet(fireArcTiles);

  return candidateTiles.filter((tile) =>
    fireArcSet.has(tileKey(tile.x, tile.y))
  );
}

function evaluateLosForTargets(state, mech, profile, candidateTiles) {
  const targetingKind = profile.targeting?.kind;
  const isMissile = profile.weaponType === "missile";

  if (targetingKind === "cardinal_adjacent") {
    return candidateTiles.map((tile) => ({
      ...tile,
      visible: true,
      cover: "none",
      los: null,
      distance: manhattanDistance(mech.x, mech.y, tile.x, tile.y),
      rangeBand: "pointBlank",
      rangeModifier: profile.rangeBands?.pointBlank ?? 0
    }));
  }

  return candidateTiles.map((tile) => {
    const distance = manhattanDistance(mech.x, mech.y, tile.x, tile.y);
    const rangeBand = getRangeBandForDistance(distance);
    const rangeModifier = getRangeModifier(profile, rangeBand);

    const los = isMissile
      ? getMissileLineOfSightResult(
          state,
          mech.x,
          mech.y,
          tile.x,
          tile.y,
          {
            attackerScale: mech.scale ?? "mech",
            targetScale: profile.scale ?? "mech"
          }
        )
      : getLineOfSightResult(
          state,
          mech.x,
          mech.y,
          tile.x,
          tile.y,
          {
            attackerScale: mech.scale ?? "mech",
            targetScale: profile.scale ?? "mech"
          }
        );

    return {
      ...tile,
      visible: los.visible === true,
      cover: isMissile ? "none" : los.cover,
      los,
      distance,
      rangeBand,
      rangeModifier
    };
  });
}

function getRangeModifier(profile, rangeBand) {
  if (!rangeBand) return 0;
  return profile.rangeBands?.[rangeBand] ?? 0;
}

function getWeaponCandidateTiles(mech, profile) {
  const targetingKind = profile.targeting?.kind;
  const minRange = profile.targeting?.minRange ?? 1;
  const maxRange = profile.targeting?.maxRange ?? 1;

  switch (targetingKind) {
    case "cardinal_adjacent":
      return getCardinalAdjacentTilesForFacing(mech.x, mech.y, mech.facing);

    case "range_band":
      return getTilesInRangeBand(mech.x, mech.y, minRange, maxRange);

    case "fire_arc_tile":
      return getTilesInRangeBand(mech.x, mech.y, minRange, maxRange);

    default:
      return [];
  }
}

function getEffectTilesForTarget(mech, profile, targetX, targetY) {
  const effectKind = profile.effect?.kind;

  switch (effectKind) {
    case "single":
      return [{ x: targetX, y: targetY }];

    case "circle":
      return getCircleTiles(targetX, targetY, profile.effect?.radius ?? 3);

    default:
      return [{ x: targetX, y: targetY }];
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

function getCardinalAdjacentTilesForFacing(x, y, facing) {
  switch (facing) {
    case 0:
      return uniqueBoardTiles([
        { x, y: y - 1 },
        { x: x - 1, y },
        { x: x + 1, y }
      ]);
    case 1:
      return uniqueBoardTiles([
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ]);
    case 2:
      return uniqueBoardTiles([
        { x, y: y + 1 },
        { x: x - 1, y },
        { x: x + 1, y }
      ]);
    case 3:
      return uniqueBoardTiles([
        { x: x - 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ]);
    default:
      return uniqueBoardTiles([
        { x, y: y - 1 },
        { x: x - 1, y },
        { x: x + 1, y }
      ]);
  }
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

function manhattanDistance(x0, y0, x1, y1) {
  return Math.abs(x1 - x0) + Math.abs(y1 - y0);
}
