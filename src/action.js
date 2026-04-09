// src/action.js

import {
  createActionUiState,
  resetActionUiState,
  getCommandMenuItemsForPhase,
  getSelectedAttackMenuItems,
  moveAttackSelection,
  startAttackSelection,
  confirmAttackSelection,
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
  moveAttackSelection,
  startAttackSelection,
  confirmAttackSelection,
  updateActionTargetPreview,
  confirmActionTarget,
  cancelActionState
};
