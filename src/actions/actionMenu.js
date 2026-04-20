// src/actions/actionMenu.js

import { getUnitById } from "../mechs.js";
import { normalizeWeaponToActionProfile, snapFocusToFirstValidTarget, updateActionTargetPreview } from "../targeting/targetingResolver.js";

function getActiveUnit(state) {
  return getUnitById(state.units, state.turn.activeUnitId);
}

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
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return [];

  const weaponIds = Array.isArray(activeUnit.weapons) ? activeUnit.weapons : [];
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
    targetUnitId: chosenTarget.targetUnitId ?? null,
    targetCover: chosenTarget.cover ?? "none",
    targetLos: chosenTarget.los ?? null,
    targetDistance: chosenTarget.distance ?? null,
    missileSource: chosenTarget.missileSource ?? "shooter",
    spotterId: chosenTarget.spotterId ?? null,
    spotterPosition: chosenTarget.spotterPosition ?? null,
    validationReason: chosenTarget.validationReason ?? null,
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
