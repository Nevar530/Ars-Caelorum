// src/controllers/movementController.js

import { canMoveActiveMechTo as canMoveActiveUnitTo, getPathToTile } from "../movement.js";
import { getActiveBody } from "../actors/actorResolver.js";

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

const CPU_MOVE_STEP_DELAY_MS = 85;

export function createMovementController({
  state,
  getUnitById,
  moveUnitTo,
  setUnitFacing,
  snapFocusToActiveUnit,
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

    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;
    if (activeUnit.status === "disabled") return;

    state.ui.commandMenu.open = false;

    state.ui.preMove = {
      unitId: activeUnit.instanceId,
      x: activeUnit.x,
      y: activeUnit.y,
      facing: activeUnit.facing
    };

    state.ui.mode = "move";
    state.selection.action = "move";
    state.ui.facingPreview = null;
    state.ui.previewPath = [];
    snapFocusToActiveUnit();

    logDev(
      `${activeUnit.name} started movement from (${activeUnit.x},${activeUnit.y}).`
    );

    render();
  }

  function completeBraceForCurrentUnit() {
    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;
    if (activeUnit.status === "disabled") {
      skipMoveForCurrentUnit();
      return;
    }

    activeUnit.isBraced = true;
    logDev(`${activeUnit.name} braced.`);

    clearTransientUi();

    if (state.turn.phase === "move") {
      advanceMoveTurn();
      return;
    }

    if (state.turn.phase === "action") {
      advanceActionTurn();
    }
  }

  function skipMoveForCurrentUnit() {
    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;

    logDev(`${activeUnit.name} skipped movement.`);
    clearTransientUi();
    advanceMoveTurn();
  }

  function confirmMoveOrFacing() {
    if (state.ui.mode === "move") {
      const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
      if (!activeUnit) return true;

      if (canMoveActiveUnitTo(state, state.focus.x, state.focus.y)) {
        const fromX = activeUnit.x;
        const fromY = activeUnit.y;

        const defaultFacing = getDefaultFacingFromPath(
          state.ui.previewPath,
          activeUnit.facing
        );

        moveUnitTo(
          state.units,
          activeUnit.instanceId,
          state.focus.x,
          state.focus.y
        );

        logDev(
          `${activeUnit.name} moved from (${fromX},${fromY}) to (${state.focus.x},${state.focus.y}).`
        );

        state.ui.mode = "face";
        state.selection.action = "face";
        state.ui.previewPath = [];
        state.ui.facingPreview = defaultFacing;
        snapFocusToActiveUnit();
        render();
      }

      return true;
    }

    if (state.ui.mode === "face") {
      const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
      if (!activeUnit) return true;

      if (state.ui.facingPreview !== null) {
        setUnitFacing(
          state.units,
          activeUnit.instanceId,
          state.ui.facingPreview
        );

        logDev(
          `${activeUnit.name} facing set to ${facingToLabel(state.ui.facingPreview)}.`
        );
      }

      clearTransientUi();
      advanceMoveTurn();
      return true;
    }

    return false;
  }

  function executeCpuMove(targetX, targetY) {
    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return false;
    if (activeUnit.status === "disabled") return false;
    if (!canMoveActiveUnitTo(state, targetX, targetY)) return false;

    const fromX = activeUnit.x;
    const fromY = activeUnit.y;
    const path = getPathToTile(state, targetX, targetY);
    const nextFacing = getDefaultFacingFromPath(path, activeUnit.facing);
    const steps = Array.isArray(path) ? path.slice(1) : [];

    function finishCpuMove() {
      setUnitFacing(state.units, activeUnit.instanceId, nextFacing);
      logDev(
        `${activeUnit.name} moved from (${fromX},${fromY}) to (${targetX},${targetY}).`
      );
      clearTransientUi();
      advanceMoveTurn();
      render();
    }

    if (!steps.length) {
      finishCpuMove();
      return true;
    }

    let stepIndex = 0;
    function advanceCpuStep() {
      const step = steps[stepIndex];
      if (!step) {
        finishCpuMove();
        return;
      }

      moveUnitTo(state.units, activeUnit.instanceId, step.x, step.y);
      render();
      stepIndex += 1;

      if (stepIndex >= steps.length) {
        window.setTimeout(finishCpuMove, CPU_MOVE_STEP_DELAY_MS);
        return;
      }

      window.setTimeout(advanceCpuStep, CPU_MOVE_STEP_DELAY_MS);
    }

    advanceCpuStep();
    return true;
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
      snapFocusToActiveUnit();
      render();
      return true;
    }

    if (state.ui.mode === "face") {
      const snap = state.ui.preMove;

      if (snap) {
        moveUnitTo(state.units, snap.unitId, snap.x, snap.y);
        setUnitFacing(state.units, snap.unitId, snap.facing);
      }

      state.ui.mode = "move";
      state.selection.action = "move";
      state.ui.facingPreview = null;
      snapFocusToActiveUnit();
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
    skipMoveForCurrentUnit,
    confirmMoveOrFacing,
    cancelMoveOrFacing,
    executeCpuMove
  };
}
