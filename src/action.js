// src/action.js

import {
  createActionUiState,
  resetActionUiState,
  getCommandMenuItemsForPhase,
  getSelectedAttackMenuItems,
  getSelectedAbilityMenuItems,
  moveAttackSelection,
  moveAbilitySelection,
  startAttackSelection,
  startAbilitySelection,
  confirmAttackSelection,
  confirmAbilitySelection,
  startExitSelection,
  confirmExitSelection,
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
  getSelectedAttackMenuItems,
  getSelectedAbilityMenuItems,
  moveAttackSelection,
  moveAbilitySelection,
  startAttackSelection,
  startAbilitySelection,
  confirmAttackSelection,
  confirmAbilitySelection,
  startExitSelection,
  confirmExitSelection,
  updateActionTargetPreview,
  confirmActionTarget,
  cancelActionState
};
