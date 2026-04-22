// src/action.js

import {
  createActionUiState,
  resetActionUiState,
  getCommandMenuItemsForPhase,
  isCommandMenuItemDisabled,
  isCommandMenuItemDisabled,
  getSelectedAttackMenuItems,
  getSelectedAbilityMenuItems,
  moveAttackSelection,
  moveAbilitySelection,
  startAttackSelection,
  startAbilitySelection,
  confirmAttackSelection,
  confirmAbilitySelection,
  confirmActionTarget,
  cancelActionState
} from "./actions/actionMenu.js";

import {
  updateActionTargetPreview
} from "./targeting/targetingResolver.js";

export {
  createActionUiState,
  resetActionUiState,
  getCommandMenuItemsForPhase,
  isCommandMenuItemDisabled,
  getSelectedAttackMenuItems,
  getSelectedAbilityMenuItems,
  moveAttackSelection,
  moveAbilitySelection,
  startAttackSelection,
  startAbilitySelection,
  confirmAttackSelection,
  confirmAbilitySelection,
  updateActionTargetPreview,
  confirmActionTarget,
  cancelActionState
};
