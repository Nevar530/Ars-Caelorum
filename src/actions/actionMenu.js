// src/actions/actionMenu.js

import { getUnitById } from "../mechs.js";
import { getActiveActor, getActiveBody } from "../actors/actorResolver.js";
import { canEmbarkedPilotExitMech, canPilotBoardMech, getMechForEmbarkedPilot, getValidRearExitTile } from "../vehicles/mechEmbarkRules.js";
import { normalizeWeaponToActionProfile, snapFocusToFirstValidTarget, updateActionTargetPreview } from "../targeting/targetingResolver.js";
import { getEquippedAbilityIds, getEquippedItemIds, getEquippedWeaponIds } from "../content/unitLoadout.js";

function getActiveUnit(state) {
  return getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
}

function isDisabledEmbarkedMechBody(state) {
  const activeActor = getActiveActor(state);
  const activeBody = getActiveUnit(state);
  return Boolean(
    activeActor?.unitType === "pilot" &&
    activeActor?.embarked === true &&
    activeBody?.unitType === "mech" &&
    activeBody?.status === "disabled"
  );
}

function getAbilityCatalogForUnit(state, unit) {
  return unit?.unitType === "mech"
    ? (Array.isArray(state.content.mechAbilities) ? state.content.mechAbilities : [])
    : (Array.isArray(state.content.pilotAbilities) ? state.content.pilotAbilities : []);
}

function getItemCatalogForUnit(state, unit) {
  return unit?.unitType === "mech"
    ? (Array.isArray(state.content.mechItems) ? state.content.mechItems : [])
    : (Array.isArray(state.content.pilotItems) ? state.content.pilotItems : []);
}

function mapDefinitionToMenuEntry(definition, kind = "ability") {
  return {
    id: definition.id,
    label: definition.name,
    description: definition.description ?? "",
    kind,
    source: "content",
    target: definition.target ?? "self",
    effect: definition.effect ?? null,
    enabled: true,
    definition
  };
}

export function createActionUiState() {
  return {
    menuIndex: 0,
    selectedAction: null,
    fireArcTiles: [],
    evaluatedTargetTiles: [],
    validTargetTiles: [],
    effectTiles: [],
    lastConfirmed: null,
    selectedAbility: null,
    selectedItem: null
  };
}

export function resetActionUiState(state) {
  state.ui.action.menuIndex = 0;
  state.ui.action.selectedAction = null;
  state.ui.action.fireArcTiles = [];
  state.ui.action.evaluatedTargetTiles = [];
  state.ui.action.validTargetTiles = [];
  state.ui.action.effectTiles = [];
  state.ui.action.selectedAbility = null;
  state.ui.action.selectedItem = null;
}

export function getCommandMenuItemsForPhase(phase, state = null) {
  if (phase === "move") {
    if (state && isDisabledEmbarkedMechBody(state)) {
      return ["move", "end_turn"];
    }
    return ["move", "brace"];
  }

  if (phase === "action") {
    return ["attack", "ability", "item", "end_turn"];
  }

  return [];
}

export function isCommandMenuItemDisabled(state, item) {
  if (!state || !item) return false;
  if (!isDisabledEmbarkedMechBody(state)) return false;

  if (state.turn.phase === "move") {
    return item === "move";
  }

  if (state.turn.phase === "action") {
    return item === "attack";
  }

  return false;
}

export function getSelectedAbilityMenuItems(state) {
  if (state.turn.phase !== "action") return [];

  const activeActor = getActiveActor(state);
  const activeBody = getActiveUnit(state);
  if (!activeActor || !activeBody) return [];

  const items = [];

  if (activeActor.unitType === "pilot") {
    if (!activeActor.embarked && activeBody.instanceId === activeActor.instanceId) {
      const boardableMech = (state.units ?? []).find((unit) => canPilotBoardMech(state, activeActor, unit));
      items.push({
        id: "enter_mech",
        label: "Enter Mech",
        kind: "ability",
        source: "contextual",
        mechId: boardableMech?.instanceId ?? null,
        enabled: Boolean(boardableMech)
      });
    }

    if (activeActor.embarked) {
      const embarkedMech = getMechForEmbarkedPilot(state, activeActor);
      const validExitTile = embarkedMech
        ? getValidRearExitTile(state, activeActor, embarkedMech)
        : null;

      items.push({
        id: "exit_mech",
        label: "Exit Mech",
        kind: "ability",
        source: "contextual",
        mechId: embarkedMech?.instanceId ?? null,
        exitTile: validExitTile,
        enabled: Boolean(validExitTile) && canEmbarkedPilotExitMech(state, activeActor, embarkedMech)
      });
    }
  }

  const abilityIds = getEquippedAbilityIds(activeBody);
  const catalog = getAbilityCatalogForUnit(state, activeBody);
  const isDisabledMech = activeBody.unitType === "mech" && activeBody.status === "disabled";

  for (const abilityId of abilityIds) {
    const definition = catalog.find((entry) => entry.id === abilityId);
    if (!definition) continue;

    const item = mapDefinitionToMenuEntry(definition, "ability");
    if (isDisabledMech) {
      item.enabled = false;
      item.disabledReason = "disabled_mech";
    }
    items.push(item);
  }

  return items;
}

export function moveAbilitySelection(state, delta) {
  const items = getSelectedAbilityMenuItems(state);
  if (!items.length) return;

  const count = items.length;
  state.ui.action.menuIndex =
    (state.ui.action.menuIndex + delta + count) % count;
}

export function startAbilitySelection(state) {
  if (state.turn.phase !== "action") return false;

  const items = getSelectedAbilityMenuItems(state);
  if (!items.length) return false;

  state.ui.commandMenu.open = false;
  state.ui.commandMenu.index = 0;

  state.ui.mode = "action-ability-select";
  state.selection.action = "ability";
  state.ui.action.menuIndex = 0;
  state.ui.action.selectedAbility = null;
  state.ui.action.selectedItem = null;

  return true;
}

export function confirmAbilitySelection(state) {
  if (state.ui.mode !== "action-ability-select") return false;

  const items = getSelectedAbilityMenuItems(state);
  if (!items.length) return false;

  const chosen = items[state.ui.action.menuIndex];
  if (!chosen || chosen.enabled === false) return false;

  state.ui.action.selectedAbility = chosen;
  state.ui.action.selectedItem = null;
  state.ui.mode = "idle";
  state.selection.action = null;
  state.ui.commandMenu.open = false;
  state.ui.commandMenu.index = 0;

  return true;
}

export function getSelectedItemMenuItems(state) {
  if (state.turn.phase !== "action") return [];

  const activeBody = getActiveUnit(state);
  if (!activeBody) return [];

  const itemIds = getEquippedItemIds(activeBody);
  const catalog = getItemCatalogForUnit(state, activeBody);

  return itemIds
    .map((itemId) => catalog.find((item) => item.id === itemId))
    .filter(Boolean)
    .map((definition) => mapDefinitionToMenuEntry(definition, "item"));
}

export function moveItemSelection(state, delta) {
  const items = getSelectedItemMenuItems(state);
  if (!items.length) return;

  const count = items.length;
  state.ui.action.menuIndex =
    (state.ui.action.menuIndex + delta + count) % count;
}

export function startItemSelection(state) {
  if (state.turn.phase !== "action") return false;

  const items = getSelectedItemMenuItems(state);
  if (!items.length) return false;

  state.ui.commandMenu.open = false;
  state.ui.commandMenu.index = 0;

  state.ui.mode = "action-item-select";
  state.selection.action = "item";
  state.ui.action.menuIndex = 0;
  state.ui.action.selectedAbility = null;
  state.ui.action.selectedItem = null;

  return true;
}

export function confirmItemSelection(state) {
  if (state.ui.mode !== "action-item-select") return false;

  const items = getSelectedItemMenuItems(state);
  if (!items.length) return false;

  const chosen = items[state.ui.action.menuIndex];
  if (!chosen || chosen.enabled === false) return false;

  state.ui.action.selectedItem = chosen;
  state.ui.action.selectedAbility = null;
  state.ui.mode = "idle";
  state.selection.action = null;
  state.ui.commandMenu.open = false;
  state.ui.commandMenu.index = 0;

  return true;
}

export function getSelectedAttackMenuItems(state) {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return [];

  const weaponIds = getEquippedWeaponIds(activeUnit);
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
  state.ui.action.selectedAbility = null;
  state.ui.action.selectedItem = null;

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
    state.ui.action.selectedAbility = null;
    state.ui.action.selectedItem = null;
    return true;
  }

  if (state.ui.mode === "action-exit-select") {
    state.ui.mode = "action-ability-select";
    state.selection.action = "ability";
    state.ui.action.validTargetTiles = [];
    state.ui.action.evaluatedTargetTiles = [];
    state.ui.action.fireArcTiles = [];
    state.ui.action.effectTiles = [];
    state.ui.action.selectedItem = null;
    return true;
  }

  if (state.ui.mode === "action-ability-select" || state.ui.mode === "action-item-select") {
    resetActionUiState(state);
    state.ui.mode = "idle";
    state.selection.action = null;
    state.ui.commandMenu.open = true;
    state.ui.commandMenu.index = 0;
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
