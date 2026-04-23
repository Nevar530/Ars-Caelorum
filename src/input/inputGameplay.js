import { clampFocusToBoard, getPathToTile } from "../movement.js";
import { moveAbilitySelection, moveAttackSelection, moveItemSelection, updateActionTargetPreview } from "../action.js";
import {
  getActiveUnit,
  getBoardDeltaFromScreenDirection,
  getFocusStep,
  getWorldFacingFromScreenDirection
} from "./inputFocus.js";

export function bindGameplayInput(state, refs, actions) {
  const { rotateLeftButton, rotateRightButton, toggleViewButton, resetMapButton } = refs;

  rotateLeftButton.addEventListener("click", () => actions.rotateLeft());
  rotateRightButton.addEventListener("click", () => actions.rotateRight());
  toggleViewButton.addEventListener("click", () => actions.toggleView());
  resetMapButton.addEventListener("click", () => actions.resetMap());

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (handleHelpKeys(event, actions)) {
      event.preventDefault();
      return;
    }

    if (handleRotationKeys(key, actions)) {
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

    if (handleMenuNavigationKeys(key, state, actions)) {
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

function handleRotationKeys(key, actions) {
  if (key === "q") {
    actions.rotateLeft();
    return true;
  }

  if (key === "e") {
    actions.rotateRight();
    return true;
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

function handleMenuNavigationKeys(key, state, actions) {
  if (state.ui.mode === "action-exit-select") return false;

  if (state.ui.mode === "action-ability-select") {
    if (key === "arrowup" || key === "w") {
      moveAbilitySelection(state, -1);
      actions.render();
      return true;
    }

    if (key === "arrowdown" || key === "s") {
      moveAbilitySelection(state, 1);
      actions.render();
      return true;
    }

    return false;
  }

  if (state.ui.mode === "action-attack-select") {
    if (key === "arrowup" || key === "w") {
      moveAttackSelection(state, -1);
      actions.render();
      return true;
    }

    if (key === "arrowdown" || key === "s") {
      moveAttackSelection(state, 1);
      actions.render();
      return true;
    }

    return false;
  }

  if (state.ui.mode === "action-item-select") {
    if (key === "arrowup" || key === "w") {
      moveItemSelection(state, -1);
      actions.render();
      return true;
    }

    if (key === "arrowdown" || key === "s") {
      moveItemSelection(state, 1);
      actions.render();
      return true;
    }

    return false;
  }

  if (!state.ui.commandMenu.open || state.ui.mode !== "idle") return false;

  if (key === "arrowup" || key === "w") {
    actions.moveMenuSelection(-1);
    return true;
  }

  if (key === "arrowdown" || key === "s") {
    actions.moveMenuSelection(1);
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
      actions.startCombat();
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

  const facing = getWorldFacingFromScreenDirection(state.rotation, direction);

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
  const delta = getBoardDeltaFromScreenDirection(state.rotation, direction, step);
  const activeUnit = state.ui.mode === "move" ? getActiveUnit(state) : null;

  const next = clampFocusToBoard(
    state.focus.x + delta.dx,
    state.focus.y + delta.dy,
    state.focus.scale ?? activeUnit?.scale ?? "mech",
    activeUnit
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
