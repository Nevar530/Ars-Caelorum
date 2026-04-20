// src/input.js

import { getUnitById } from "./mechs.js";
import { clampFocusToBoard, getPathToTile } from "./movement.js";
import { moveAttackSelection, updateActionTargetPreview } from "./action.js";
import { getUnitFootprint } from "./scale/scaleMath.js";
import { applyMapEditorAtTile, ensureMapEditorState, sampleMapEditorFromTile } from "../dev/mapEditor/mapEditorActions.js";
import { getBrushedTileCoords } from "../dev/mapEditor/mapBrush.js";

function getActiveUnit(state) {
  const activeId = state.turn.activeUnitId ?? null;
  const units = state.units ?? [];
  return getUnitById(units, activeId);
}

function getFocusStep(state) {
  const activeUnit = getActiveUnit(state);

  if (state.ui.mode === "move" && activeUnit) {
    const footprint = getUnitFootprint(activeUnit);

    if ((activeUnit.scale ?? activeUnit.unitType ?? "mech") === "mech") {
      return {
        dx: Math.max(1, footprint.width),
        dy: Math.max(1, footprint.height)
      };
    }
  }

  return { dx: 1, dy: 1 };
}

export function bindInput(state, refs, actions) {
  bindEditorInput(state, refs, actions);
  bindGameplayInput(state, refs, actions);
}

export function snapFocusToActiveMech(state) {
  snapFocusToActiveUnit(state);
}

export function snapFocusToActiveUnit(state) {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return;

  state.focus.x = activeUnit.x;
  state.focus.y = activeUnit.y;
  state.focus.scale = activeUnit.scale ?? activeUnit.unitType ?? "mech";
  state.camera.zoomScale = activeUnit.scale ?? activeUnit.unitType ?? "mech";
}


function updateEditorHover(state, x, y) {
  const editorState = ensureMapEditorState(state);
  const mapWidth = state.map?.width ?? state.map?.mechWidth ?? 0;
  const mapHeight = state.map?.height ?? state.map?.mechHeight ?? 0;
  editorState.hoverTiles = getBrushedTileCoords(x, y, editorState.brushSize, mapWidth, mapHeight);
}

function bindEditorInput(state, refs, actions) {
  const { editor, editorModeMechButton, editorModeDetailButton } = refs;

  if (editorModeMechButton) {
    editorModeMechButton.addEventListener("click", () => {
      actions.setEditorMode("mech");
      actions.render();
    });
  }

  if (editorModeDetailButton) {
    editorModeDetailButton.style.display = "none";
    editorModeDetailButton.disabled = true;
  }

  if (!editor) return;


  editor.addEventListener("mousemove", (event) => {
    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;
    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);
    updateEditorHover(state, x, y);
    window.dispatchEvent(new CustomEvent("ac:map-editor-updated", {
      detail: { x, y, source: "hover" }
    }));
    actions.render();
  });

  editor.addEventListener("mouseleave", () => {
    const editorState = ensureMapEditorState(state);
    editorState.hoverTiles = [];
    window.dispatchEvent(new CustomEvent("ac:map-editor-updated", {
      detail: { source: "hover-clear" }
    }));
    actions.render();
  });

  editor.addEventListener("click", (event) => {
    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    state.ui.editor.selectedTile.x = x;
    state.ui.editor.selectedTile.y = y;
    state.ui.editor.mode = "mech";

    const editorState = ensureMapEditorState(state);
    updateEditorHover(state, x, y);
    if (editorState.isEnabled) {
      applyMapEditorAtTile(state, x, y);
    }

    window.dispatchEvent(new CustomEvent("ac:map-editor-updated", {
      detail: { x, y, source: "paint" }
    }));
    actions.render();
  });

  editor.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    state.ui.editor.selectedTile.x = x;
    state.ui.editor.selectedTile.y = y;
    state.ui.editor.mode = "mech";

    const editorState = ensureMapEditorState(state);
    updateEditorHover(state, x, y);
    if (editorState.isEnabled) {
      sampleMapEditorFromTile(state, x, y);
    }

    window.dispatchEvent(new CustomEvent("ac:map-editor-updated", {
      detail: { x, y, source: "sample" }
    }));
    actions.render();
  });
}

function bindGameplayInput(state, refs, actions) {
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
    actions.snapFocusToActiveUnit?.();
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

function getBoardDeltaFromScreenDirection(rotation, direction, step = { dx: 1, dy: 1 }) {
  const facing = getWorldFacingFromScreenDirection(rotation, direction);

  switch (facing) {
    case 0:
      return { dx: 0, dy: -step.dy }; // north
    case 1:
      return { dx: step.dx, dy: 0 }; // east
    case 2:
      return { dx: 0, dy: step.dy }; // south
    case 3:
      return { dx: -step.dx, dy: 0 }; // west
    default:
      return { dx: 0, dy: 0 };
  }
}

function getWorldFacingFromScreenDirection(rotation, direction) {
  const baseFacing = screenDirectionToBaseFacing(direction);
  if (baseFacing === null) return null;

  const rot = normalizeRotation(rotation);

  return ((baseFacing - rot) + 4) % 4;
}

function screenDirectionToBaseFacing(direction) {
  switch (direction) {
    case "up":
      return 0;
    case "right":
      return 1;
    case "down":
      return 2;
    case "left":
      return 3;
    default:
      return null;
  }
}

function normalizeRotation(value) {
  const n = Number.isFinite(value) ? value : 0;
  return ((n % 4) + 4) % 4;
}
