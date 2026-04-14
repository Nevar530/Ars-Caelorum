// src/controllers/movementController.js

import { canMoveActiveMechTo, getPathToTile } from "../movement.js";

function facingToLabel(facing) {
  switch (facing) {
    case 0:
      return "N";
    case 1:
      return "E";
    case 2:
      return "S";
    case 3:
      return "W";
    default:
      return "?";
  }
}

function sign(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

export function createMovementController({
  state,
  getMechById,
  moveMechTo,
  setMechFacing,
  snapFocusToActiveMech,
  clearTransientUi,
  render,
  logDev,
  advanceMoveTurn,
  advanceActionTurn
}) {
  function getDefaultFacingFromPath(path, fallbackFacing) {
    if (!path || path.length < 2) return fallbackFacing;

    const last = path[path.length - 1];
    const prev = path[path.length - 2];
    const dx = sign(last.x - prev.x);
    const dy = sign(last.y - prev.y);

    if (dx === 0 && dy === -1) return 0;
    if (dx === 1 && dy === 0) return 1;
    if (dx === 0 && dy === 1) return 2;
    if (dx === -1 && dy === 0) return 3;

    return fallbackFacing;
  }

  function startMove() {
    if (!state.turn.combatStarted || state.turn.phase !== "move") return;

    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    state.ui.commandMenu.open = false;

    state.ui.preMove = {
      mechId: activeMech.instanceId,
      x: activeMech.x,
      y: activeMech.y,
      facing: activeMech.facing
    };

    state.ui.mode = "move";
    state.selection.action = "move";
    state.ui.facingPreview = null;
    state.ui.previewPath = [];
    snapFocusToActiveMech();

    logDev(
      `${activeMech.name} started movement from (${activeMech.x},${activeMech.y}).`
    );

    render();
  }

  function completeBraceForCurrentUnit() {
    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    activeMech.isBraced = true;
    logDev(`${activeMech.name} braced.`);

    clearTransientUi();

    if (state.turn.phase === "move") {
      advanceMoveTurn();
      return;
    }

    if (state.turn.phase === "action") {
      advanceActionTurn();
    }
  }

  function confirmMoveOrFacing() {
    if (state.ui.mode === "move") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      if (!activeMech) return true;

      if (canMoveActiveMechTo(state, state.focus.x, state.focus.y)) {
        const fromX = activeMech.x;
        const fromY = activeMech.y;

        const defaultFacing = getDefaultFacingFromPath(
          state.ui.previewPath,
          activeMech.facing
        );

        moveMechTo(
          state.mechs,
          activeMech.instanceId,
          state.focus.x,
          state.focus.y
        );

        logDev(
          `${activeMech.name} moved from (${fromX},${fromY}) to (${state.focus.x},${state.focus.y}).`
        );

        state.ui.mode = "face";
        state.selection.action = "face";
        state.ui.previewPath = [];
        state.ui.facingPreview = defaultFacing;
        snapFocusToActiveMech();
        render();
      }

      return true;
    }

    if (state.ui.mode === "face") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      if (!activeMech) return true;

      if (state.ui.facingPreview !== null) {
        setMechFacing(
          state.mechs,
          activeMech.instanceId,
          state.ui.facingPreview
        );

        logDev(
          `${activeMech.name} facing set to ${facingToLabel(state.ui.facingPreview)}.`
        );
      }

      clearTransientUi();
      advanceMoveTurn();
      return true;
    }

    return false;
  }

  function cancelMoveOrFacing() {
    if (state.ui.mode === "move") {
      state.ui.mode = "idle";
      state.selection.action = null;
      state.ui.previewPath = [];
      state.ui.facingPreview = null;
      state.ui.preMove = null;
      state.ui.commandMenu.open = true;
      state.ui.commandMenu.index = 0;
      snapFocusToActiveMech();
      render();
      return true;
    }

    if (state.ui.mode === "face") {
      const snap = state.ui.preMove;

      if (snap) {
        moveMechTo(state.mechs, snap.mechId, snap.x, snap.y);
        setMechFacing(state.mechs, snap.mechId, snap.facing);
      }

      state.ui.mode = "move";
      state.selection.action = "move";
      state.ui.facingPreview = null;
      snapFocusToActiveMech();
      state.ui.previewPath = getPathToTile(state, state.focus.x, state.focus.y);
      render();
      return true;
    }

    return false;
  }

  return {
    getDefaultFacingFromPath,
    startMove,
    completeBraceForCurrentUnit,
    confirmMoveOrFacing,
    cancelMoveOrFacing
  };
}
