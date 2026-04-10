import { changeElevation, changeDetailElevation } from "./map.js";
import { getMechById } from "./mechs.js";
import { clampFocusToBoard, getPathToTile } from "./movement.js";
import { moveAttackSelection, updateActionTargetPreview } from "./action.js";

export function bindInput(state, refs, actions) {
  bindEditorInput(state, refs, actions);
  bindGameplayInput(state, refs, actions);
}

export function snapFocusToActiveMech(state) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  if (!activeMech) return;

  state.focus.x = activeMech.x;
  state.focus.y = activeMech.y;
}

function bindEditorInput(state, refs, actions) {
  const {
    editor,
    editorModeMechButton,
    editorModeDetailButton
  } = refs;

  if (editorModeMechButton) {
    editorModeMechButton.addEventListener("click", () => {
      actions.setEditorMode("mech");
    });
  }

  if (editorModeDetailButton) {
    editorModeDetailButton.addEventListener("click", () => {
      actions.setEditorMode("detail");
    });
  }

  editor.addEventListener("click", (event) => {
    if (state.ui.editor.mode === "detail") {
      const detailRect = event.target.closest(".editor-cell-detail");
      if (!detailRect) return;

      const mechX = Number(detailRect.dataset.mx);
      const mechY = Number(detailRect.dataset.my);
      const subX = Number(detailRect.dataset.sx);
      const subY = Number(detailRect.dataset.sy);

      changeDetailElevation(state.map, mechX, mechY, subX, subY, 1);
      actions.render();
      return;
    }

    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    changeElevation(state.map, x, y, 1);
    actions.render();
  });

  editor.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    if (state.ui.editor.mode === "detail") {
      const detailRect = event.target.closest(".editor-cell-detail");
      if (!detailRect) return;

      const mechX = Number(detailRect.dataset.mx);
      const mechY = Number(detailRect.dataset.my);
      const subX = Number(detailRect.dataset.sx);
      const subY = Number(detailRect.dataset.sy);

      changeDetailElevation(state.map, mechX, mechY, subX, subY, -1);
      actions.render();
      return;
    }

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
    toggleViewButton,
    resetMapButton
  } = refs;

  rotateLeftButton.addEventListener("click", () => {
    actions.rotateLeft();
  });

  rotateRightButton.addEventListener("click", () => {
    actions.rotateRight();
  });

  toggleViewButton.addEventListener("click", () => {
    actions.toggleView();
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

function handleViewKeys(key, actions) {
  if (key === "r") {
    actions.toggleView();
    return true;
  }

  return false;
}

function handleMenuNavigationKeys(key, state, actions) {
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
    actions.snapFocusToActiveMech();
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

  const delta = getScreenRelativeBoardDelta(state, direction);
  const facing = facingFromDelta(delta.dx, delta.dy);

  if (facing === null) return true;

  state.ui.facingPreview = facing;
  actions.render();
  return true;
}

function handleFocusKeys(key, state, actions) {
  if (state.ui.commandMenu.open && state.ui.mode === "idle") {
    return false;
  }

  if (state.ui.mode === "action-attack-select") {
    return false;
  }

  let direction = null;

  if (key === "arrowup" || key === "w") direction = "up";
  else if (key === "arrowdown" || key === "s") direction = "down";
  else if (key === "arrowleft" || key === "a") direction = "left";
  else if (key === "arrowright" || key === "d") direction = "right";
  else return false;

  const delta = getScreenRelativeBoardDelta(state, direction);
  const next = clampFocusToBoard(
    state.focus.x + delta.dx,
    state.focus.y + delta.dy
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
    actions.selectFocusedMechIfPresent();
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

function getScreenRelativeBoardDelta(state, direction) {
  const rotation = ((Math.round(state.camera.angle / 90) % 4) + 4) % 4;

  const directionMaps = {
    up: [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ],
    right: [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 }
    ],
    down: [
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 }
    ],
    left: [
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 }
    ]
  };

  return directionMaps[direction][rotation];
}

function facingFromDelta(dx, dy) {
  if (dx === 0 && dy === -1) return 0;
  if (dx === 1 && dy === 0) return 1;
  if (dx === 0 && dy === 1) return 2;
  if (dx === -1 && dy === 0) return 3;
  return null;
}
