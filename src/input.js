import { changeElevation } from "./map.js";
import { getMechById, moveMechTo } from "./mechs.js";
import { clampFocusToBoard, canMoveActiveMechTo } from "./movement.js";

export function bindInput(state, refs, actions) {
  bindEditorInput(state, refs, actions);
  bindGameplayInput(state, refs, actions);
}

function bindEditorInput(state, refs, actions) {
  const { editor } = refs;

  editor.addEventListener("click", (event) => {
    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    changeElevation(state.map, x, y, 1);
    actions.render();
  });

  editor.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    changeElevation(state.map, x, y, -1);
    actions.render();
  });
}

function bindGameplayInput(state, refs, actions) {
  const {
    rotateLeftButton,
    rotateRightButton,
    resetMapButton
  } = refs;

  rotateLeftButton.addEventListener("click", () => {
    actions.rotateLeft();
  });

  rotateRightButton.addEventListener("click", () => {
    actions.rotateRight();
  });

  resetMapButton.addEventListener("click", () => {
    actions.resetMap();
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (handleRotationKeys(key, actions)) {
      event.preventDefault();
      return;
    }

    if (handleModeKeys(key, state, actions)) {
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

function handleModeKeys(key, state, actions) {
  if (key === "tab") {
    snapFocusToActiveMech(state);
    actions.render();
    return true;
  }

  if (key === "m") {
    if (state.turn.activeMechId) {
      state.ui.mode = "move";
      state.selection.action = "move";
      snapFocusToActiveMech(state);
      actions.render();
      return true;
    }
  }

  return false;
}

function handleFocusKeys(key, state, actions) {
  let dx = 0;
  let dy = 0;

  if (key === "arrowup" || key === "w") dy = -1;
  else if (key === "arrowdown" || key === "s") dy = 1;
  else if (key === "arrowleft" || key === "a") dx = -1;
  else if (key === "arrowright" || key === "d") dx = 1;
  else return false;

  const next = clampFocusToBoard(state.focus.x + dx, state.focus.y + dy);
  state.focus.x = next.x;
  state.focus.y = next.y;
  actions.render();
  return true;
}

function handleConfirmCancelKeys(key, state, actions) {
  const isConfirm = key === "enter" || key === " ";
  const isCancel = key === "escape" || key === "backspace";

  if (isConfirm) {
    if (state.ui.mode === "move") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      if (!activeMech) return true;

      if (canMoveActiveMechTo(state, state.focus.x, state.focus.y)) {
        moveMechTo(
          state.mechs,
          activeMech.instanceId,
          state.focus.x,
          state.focus.y
        );

        state.ui.mode = "idle";
        state.selection.action = null;
        snapFocusToActiveMech(state);
        actions.render();
      }

      return true;
    }

    return true;
  }

  if (isCancel) {
    if (state.ui.mode === "move") {
      state.ui.mode = "idle";
      state.selection.action = null;
      snapFocusToActiveMech(state);
      actions.render();
      return true;
    }

    return true;
  }

  return false;
}

function snapFocusToActiveMech(state) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  if (!activeMech) return;

  state.focus.x = activeMech.x;
  state.focus.y = activeMech.y;
}
