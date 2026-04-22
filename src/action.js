// src/action.js

import {
  createActionUiState,
  resetActionUiState,
  getCommandMenuItemsForPhase,
  isCommandMenuItemDisabled,
  getSelectedAttackMenuItems,
  getSelectedAbilityMenuItems,
  getSelectedItemMenuItems,
  moveAttackSelection,
  moveAbilitySelection,
  moveItemSelection,
  startAttackSelection,
  startAbilitySelection,
  startItemSelection,
  confirmAttackSelection,
  confirmAbilitySelection,
  confirmItemSelection,
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
  getSelectedItemMenuItems,
  moveAttackSelection,
  moveAbilitySelection,
  moveItemSelection,
  startAttackSelection,
  startAbilitySelection,
  startItemSelection,
  confirmAttackSelection,
  confirmAbilitySelection,
  confirmItemSelection,
  updateActionTargetPreview,
  confirmActionTarget,
  cancelActionState
};
