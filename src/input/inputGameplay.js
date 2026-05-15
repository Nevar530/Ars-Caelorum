import { clampFocusToBoard, getPathToTile } from "../movement.js";
import { closeDeploymentList, confirmDeploymentPlacement, getDeploymentPlacedUnitAt, getDeploymentReady, isDeploymentActive, isDeploymentMenuFocused, moveDeploymentListSelection, openDeploymentListAtFocus, removeDeploymentPlacementAtFocus } from "../deployment/deploymentState.js";
import {
  getSelectedAbilityMenuItems,
  getSelectedAttackMenuItems,
  getSelectedItemMenuItems,
  moveAbilitySelection,
  moveAttackSelection,
  moveItemSelection,
  updateActionTargetPreview
} from "../action.js";
import { isStoryMode } from "../mode/mapMode.js";
import {
  getActiveUnit,
  getBoardDeltaFromScreenDirection,
  getFocusStep,
  getWorldFacingFromScreenDirection
} from "./inputFocus.js";

export function bindGameplayInput(state, refs, actions) {
  const { toggleViewButton, resetMapButton } = refs;

  toggleViewButton.addEventListener("click", () => actions.toggleView());
  resetMapButton.addEventListener("click", () => actions.resetMap());

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (handleGameMenuKeys(event, key, state, actions)) {
      event.preventDefault();
      return;
    }

    if (state?.ui?.shell?.screen && state.ui.shell.screen !== "game") {
      if (handleShellKeys(event, state, actions)) {
        event.preventDefault();
      }
      return;
    }

    if (state?.ui?.dialogue?.active) {
      if (key === "enter" || key === " " || key === "spacebar") {
        actions.advanceDialogue?.();
        event.preventDefault();
      }
      return;
    }

    if (state?.mission?.result) {
      return;
    }

    if (handleHelpKeys(event, actions)) {
      event.preventDefault();
      return;
    }


    if (handleZoomKeys(event, key, actions)) {
      event.preventDefault();
      return;
    }

    if (handleViewKeys(key, actions)) {
      event.preventDefault();
      return;
    }

    if (handleDeploymentKeys(key, state, actions)) {
      event.preventDefault();
      return;
    }

    if (handleMenuNavigationKeys(key, state, actions)) {
      event.preventDefault();
      return;
    }

    if (handleStoryModeKeys(key, state, actions)) {
      event.preventDefault();
      return;
    }

    if (handleIdleKeys(key, state, actions)) {
      event.preventDefault();
      return;
    }

    if (handleFacingKeys(key, state, actions)) {
      event.preventDefault();
      return;
    }

    if (handleFocusKeys(key, state, actions)) {
      event.preventDefault();
      return;
    }

    if (handleConfirmCancelKeys(key, state, actions)) {
      event.preventDefault();
    }
  });
}

function handleGameMenuKeys(event, key, state, actions) {
  const screen = state?.ui?.shell?.screen ?? "game";
  const canOpenInScreen = screen === "game" || screen === "phase-briefing";

  if (key === "i" && canOpenInScreen) {
    actions.toggleGameMenu?.();
    return true;
  }

  if (!state?.ui?.gameMenu?.open) return false;

  if (key === "q") {
    actions.moveGameMenuTab?.(-1);
    return true;
  }

  if (key === "e") {
    actions.moveGameMenuTab?.(1);
    return true;
  }

  if (key === "arrowup" || key === "w") {
    actions.moveGameMenuSelection?.(-1);
    return true;
  }

  if (key === "arrowdown" || key === "s") {
    actions.moveGameMenuSelection?.(1);
    return true;
  }

  if (key === "arrowleft" || key === "a") {
    actions.moveGameMenuStat?.(-1);
    return true;
  }

  if (key === "arrowright" || key === "d") {
    actions.moveGameMenuStat?.(1);
    return true;
  }

  if (key === "enter" || key === " " || key === "spacebar") {
    actions.confirmGameMenuSelection?.();
    return true;
  }

  // While the menu is open, gameplay is paused and all other controls are swallowed.
  return true;
}

function handleHelpKeys(event, actions) {
  const key = event.key.toLowerCase();

  if (key === "f1") {
    actions.toggleHelpDrawer?.();
    return true;
  }

  if (key === "escape") {
    actions.closeHelpDrawer?.();
  }

  return false;
}


function handleZoomKeys(event, key, actions) {
  if (key === "+" || key === "=" || (event.shiftKey && key === "+")) {
    actions.zoomIn?.();
    return true;
  }

  if (key === "-" || key === "_") {
    actions.zoomOut?.();
    return true;
  }

  return false;
}

function handleViewKeys(key, actions) {
  if (key === "r") {
    actions.toggleView();
    return true;
  }

  return false;
}


function handleDeploymentKeys(key, state, actions) {
  if (!isDeploymentActive(state)) return false;

  if (state.ui.deployment.listOpen) {
    if (key === "arrowup" || key === "w") {
      moveDeploymentListSelection(state, -1);
      actions.render();
      return true;
    }

    if (key === "arrowdown" || key === "s") {
      moveDeploymentListSelection(state, 1);
      actions.render();
      return true;
    }

    if (key === "arrowleft" || key === "a" || key === "arrowright" || key === "d") {
      return true;
    }

    if (key === "enter" || key === " ") {
      actions.confirmDeploymentPlacement?.();
      return true;
    }

    if (key === "escape" || key === "backspace") {
      closeDeploymentList(state);
      actions.render();
      return true;
    }

    return false;
  }

  if (isDeploymentMenuFocused(state)) {
    if (key === "enter" || key === " ") {
      if (getDeploymentReady(state)) {
        actions.startCombat?.();
      }
      return true;
    }

    if (key === "escape" || key === "backspace" || key === "arrowleft" || key === "a" || key === "arrowright" || key === "d" || key === "arrowup" || key === "w" || key === "arrowdown" || key === "s") {
      state.ui.deployment.menuFocus = "map";
      actions.render();
      return true;
    }
  }

  if (key === "enter" || key === " ") {
    const placedUnit = getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y);
    if (placedUnit) {
      actions.removeDeploymentPlacement?.();
      return true;
    }

    actions.openDeploymentList?.();
    return true;
  }

  if (key === "escape" || key === "backspace") {
    const removed = removeDeploymentPlacementAtFocus(state);
    if (removed) {
      actions.render();
      return true;
    }
  }

  return false;
}

function handleMenuNavigationKeys(key, state, actions) {
  if (state.ui.mode === "action-exit-select") return false;

  if (state.ui.mode === "action-ability-select") {
    return moveActionGridSelection(key, state, actions, getSelectedAbilityMenuItems(state), moveAbilitySelection);
  }

  if (state.ui.mode === "action-attack-select") {
    return moveActionGridSelection(key, state, actions, getSelectedAttackMenuItems(state), moveAttackSelection);
  }

  if (state.ui.mode === "action-item-select") {
    return moveActionGridSelection(key, state, actions, getSelectedItemMenuItems(state), moveItemSelection);
  }

  if (!state.ui.commandMenu.open || state.ui.mode !== "idle") return false;

  if (key === "arrowup" || key === "w") {
    if (actions.moveMenuSelectionGrid) actions.moveMenuSelectionGrid("up"); else actions.moveMenuSelection(-2);
    return true;
  }

  if (key === "arrowdown" || key === "s") {
    if (actions.moveMenuSelectionGrid) actions.moveMenuSelectionGrid("down"); else actions.moveMenuSelection(2);
    return true;
  }

  if (key === "arrowleft" || key === "a") {
    if (actions.moveMenuSelectionGrid) actions.moveMenuSelectionGrid("left"); else actions.moveMenuSelection(-1);
    return true;
  }

  if (key === "arrowright" || key === "d") {
    if (actions.moveMenuSelectionGrid) actions.moveMenuSelectionGrid("right"); else actions.moveMenuSelection(1);
    return true;
  }

  return false;
}


function moveActionGridSelection(key, state, actions, items, fallbackMover) {
  const count = Array.isArray(items) ? items.length : 0;
  if (!count) return false;

  let direction = null;
  if (key === "arrowup" || key === "w") direction = "up";
  else if (key === "arrowdown" || key === "s") direction = "down";
  else if (key === "arrowleft" || key === "a") direction = "left";
  else if (key === "arrowright" || key === "d") direction = "right";
  else return false;

  const columns = 2;
  const current = Math.max(0, Math.min(Number(state.ui.action.menuIndex ?? 0), count - 1));
  let next = current;

  if (direction === "left") next = current % columns === 0 ? Math.min(count - 1, current + columns - 1) : current - 1;
  else if (direction === "right") next = current % columns === columns - 1 || current + 1 >= count ? current - (current % columns) : current + 1;
  else if (direction === "up") next = current - columns >= 0 ? current - columns : current;
  else if (direction === "down") next = current + columns < count ? current + columns : current;

  if (next === current) {
    // Preserve old wrap behavior for single-column or short lists at edges.
    const delta = direction === "up" || direction === "left" ? -1 : 1;
    fallbackMover(state, delta);
  } else {
    state.ui.action.menuIndex = next;
  }

  actions.render();
  return true;
}

function handleStoryModeKeys(key, state, actions) {
  if (!isStoryMode(state)) return false;
  if (state.ui.mode !== "idle") return false;
  if (state.turn.combatStarted) return false;
  if (state.ui.commandMenu.open) return false;

  if (key === "tab") {
    actions.snapFocusToActiveUnit?.({ resetZoom: true });
    actions.render();
    return true;
  }

  let direction = null;
  if (key === "arrowup" || key === "w") direction = "up";
  else if (key === "arrowdown" || key === "s") direction = "down";
  else if (key === "arrowleft" || key === "a") direction = "left";
  else if (key === "arrowright" || key === "d") direction = "right";

  if (direction) {
    actions.storyMove?.(direction);
    return true;
  }

  if (key === "enter" || key === " ") {
    actions.storyInteract?.();
    return true;
  }

  return false;
}

function handleIdleKeys(key, state, actions) {
  if (state.ui.mode !== "idle") return false;

  if (key === "tab") {
    actions.snapFocusToActiveUnit?.({ resetZoom: true });
    actions.render();
    return true;
  }

  if (key === "enter" || key === " ") {
    if (!state.turn.combatStarted) {
      if (isStoryMode(state)) {
        actions.storyInteract?.();
      } else {
        actions.startCombat();
      }
      return true;
    }

    if (state.ui.commandMenu.open) {
      actions.confirmMenuSelection();
    } else {
      actions.openCommandMenu();
    }

    return true;
  }

  return false;
}

function handleFacingKeys(key, state, actions) {
  if (state.ui.mode !== "face") return false;

  let direction = null;

  if (key === "arrowup" || key === "w") direction = "up";
  else if (key === "arrowdown" || key === "s") direction = "down";
  else if (key === "arrowleft" || key === "a") direction = "left";
  else if (key === "arrowright" || key === "d") direction = "right";
  else return false;

  const facing = getWorldFacingFromScreenDirection(direction);

  if (facing === null) return true;

  state.ui.facingPreview = facing;
  actions.render();
  return true;
}

function handleFocusKeys(key, state, actions) {
  if (state.ui.commandMenu.open && state.ui.mode === "idle") return false;
  if (state.ui.mode === "action-attack-select") return false;
  if (state.ui.mode === "action-ability-select") return false;
  if (state.ui.mode === "action-item-select") return false;
  if (state.ui.mode === "action-exit-select") return false;

  let direction = null;

  if (key === "arrowup" || key === "w") direction = "up";
  else if (key === "arrowdown" || key === "s") direction = "down";
  else if (key === "arrowleft" || key === "a") direction = "left";
  else if (key === "arrowright" || key === "d") direction = "right";
  else return false;

  const step = getFocusStep(state);
  const delta = getBoardDeltaFromScreenDirection(direction, step);
  const activeUnit = state.ui.mode === "move" ? getActiveUnit(state) : null;

  const next = clampFocusToBoard(
    state.focus.x + delta.dx,
    state.focus.y + delta.dy,
    state.focus.scale ?? activeUnit?.scale ?? "mech",
    state
  );

  state.focus.x = next.x;
  state.focus.y = next.y;

  if (state.ui.mode === "move") {
    state.ui.previewPath = getPathToTile(state, state.focus.x, state.focus.y);
  } else {
    state.ui.previewPath = [];
  }

  if (state.ui.mode === "action-target") {
    updateActionTargetPreview(state);
  }

  if (!state.turn.combatStarted && state.ui.mode === "idle") {
    actions.selectFocusedUnitIfPresent?.();
    actions.selectFocusedMechIfPresent?.();
  }

  actions.render();
  return true;
}

function handleConfirmCancelKeys(key, state, actions) {
  const isConfirm = key === "enter" || key === " ";
  const isCancel = key === "escape" || key === "backspace";

if (
  state.ui.mode === "move" ||
  state.ui.mode === "face" ||
  state.ui.mode === "action-attack-select" ||
  state.ui.mode === "action-ability-select" ||
  state.ui.mode === "action-item-select" ||
  state.ui.mode === "action-exit-select" ||
  state.ui.mode === "action-target"
) {
    if (isConfirm) {
      actions.confirmAction();
      return true;
    }

    if (isCancel) {
      actions.cancelAction();
      return true;
    }
  }

  return false;
}


function handleShellKeys(event, state, actions) {
  const screen = state?.ui?.shell?.screen ?? "game";
  if (screen === "game") return false;

  const key = event.key.toLowerCase();

  if (screen === "title") {
    if (key === "arrowup" || key === "w" || key === "arrowleft" || key === "a") {
      actions.moveTitleSelection?.(-1);
      return true;
    }

    if (key === "arrowdown" || key === "s" || key === "arrowright" || key === "d") {
      actions.moveTitleSelection?.(1);
      return true;
    }

    if (key === "enter" || key === " ") {
      actions.confirmTitleSelection?.();
      return true;
    }

    return false;
  }

  if (screen === "mission-select") {
    if (key === "arrowup" || key === "w") {
      actions.moveMissionSelection?.(-1);
      return true;
    }

    if (key === "arrowdown" || key === "s") {
      actions.moveMissionSelection?.(1);
      return true;
    }

    if (key === "escape" || key === "backspace") {
      actions.showTitleScreen?.();
      return true;
    }

    if (key === "enter" || key === " ") {
      actions.openSelectedMissionBriefing?.();
      return true;
    }
  }

  if (screen === "mission-briefing") {
    if (key === "escape" || key === "backspace") {
      actions.openMissionSelect?.();
      return true;
    }

    if (key === "enter" || key === " ") {
      actions.startSelectedMission?.();
      return true;
    }
  }

  if (screen === "phase-briefing") {
    if (key === "enter" || key === " ") {
      actions.continuePhaseBriefing?.();
      return true;
    }
  }

  return false;
}
