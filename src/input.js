import { changeElevation } from "./map.js";
import { getMechById } from "./mechs.js";
import {
  clampFocusToBoard,
  getPathToTile
} from "./movement.js";

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

    if (handleModeKeys(key, state, actions)) {
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

function handleModeKeys(key, state, actions) {
  if (key === "tab") {
    snapFocusToActiveMech(state);
    actions.render();
    return true;
  }

  if (key === "m") {
    actions.startMove();
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

  actions.render();
  return true;
}

function handleConfirmCancelKeys(key, state, actions) {
  const isConfirm = key === "enter" || key === " ";
  const isCancel = key === "escape" || key === "backspace";

  if (isConfirm) {
    actions.confirmAction();
    return true;
  }

  if (isCancel) {
    actions.cancelAction();
    return true;
  }

  return false;
}

function getScreenRelativeBoardDelta(state, direction) {
  const turns = ((Math.round(state.camera.angle / 90) % 4) + 4) % 4;

  switch (turns) {
    case 0:
      return deltaForRotation0(direction);
    case 1:
      return deltaForRotation90(direction);
    case 2:
      return deltaForRotation180(direction);
    case 3:
      return deltaForRotation270(direction);
    default:
      return { dx: 0, dy: 0 };
  }
}

function deltaForRotation0(direction) {
  switch (direction) {
    case "up":
      return { dx: 0, dy: -1 };
    case "right":
      return { dx: 1, dy: 0 };
    case "down":
      return { dx: 0, dy: 1 };
    case "left":
      return { dx: -1, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}

function deltaForRotation90(direction) {
  switch (direction) {
    case "up":
      return { dx: -1, dy: 0 };
    case "right":
      return { dx: 0, dy: -1 };
    case "down":
      return { dx: 1, dy: 0 };
    case "left":
      return { dx: 0, dy: 1 };
    default:
      return { dx: 0, dy: 0 };
  }
}

function deltaForRotation180(direction) {
  switch (direction) {
    case "up":
      return { dx: 0, dy: 1 };
    case "right":
      return { dx: -1, dy: 0 };
    case "down":
      return { dx: 0, dy: -1 };
    case "left":
      return { dx: 1, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}

function deltaForRotation270(direction) {
  switch (direction) {
    case "up":
      return { dx: 1, dy: 0 };
    case "right":
      return { dx: 0, dy: 1 };
    case "down":
      return { dx: -1, dy: 0 };
    case "left":
      return { dx: 0, dy: -1 };
    default:
      return { dx: 0, dy: 0 };
  }
}

function facingFromDelta(dx, dy) {
  if (dx === 0 && dy === -1) return 0;
  if (dx === 1 && dy === 0) return 1;
  if (dx === 0 && dy === 1) return 2;
  if (dx === -1 && dy === 0) return 3;
  return null;
}

function snapFocusToActiveMech(state) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  if (!activeMech) return;

  state.focus.x = activeMech.x;
  state.focus.y = activeMech.y;
}
