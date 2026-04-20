import {
  cancelActionState,
  confirmActionTarget,
  confirmAttackSelection,
  startAttackSelection
} from "../action.js";
import { resolveHit } from "../combat/hitResolver.js";
import { resolveDamage } from "../combat/damageResolver.js";
import { addCombatTextMarker, clearCombatTextMarkers } from "../combat/combatTextOverlay.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";

export function createCombatController({
  state,
  getUnitById,
  render,
  logDev,
  clearTransientUi,
  advanceActionTurn,
  movementController
}) {
  let actionAdvanceTimer = null;
  function startAttack() {
    if (!state.turn.combatStarted || state.turn.phase !== "action") return;

    const activeUnit = getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;

    if (!startAttackSelection(state)) return;

    logDev(`${activeUnit.name} entered attack selection.`);
    render();
  }

  function completeEndTurnForCurrentUnit() {
    const activeUnit = getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;

    logDev(`${activeUnit.name} ended action turn.`);
    clearTransientUi();
    advanceActionTurn();
  }

  function waitTurn() {
    if (state.turn.phase === "move") {
      movementController.completeBraceForCurrentUnit();
      return;
    }

    if (state.turn.phase === "action") {
      completeEndTurnForCurrentUnit();
    }
  }

  function handleConfirmedTarget(activeUnit, selectedAttack) {
    const targetX = state.focus.x;
    const targetY = state.focus.y;
    const targetEntry = getPrimaryOccupantAt(state, targetX, targetY, "mech", {
      excludeUnitId: activeUnit.instanceId
    });
    const targetUnit = targetEntry?.unit ?? null;

    if (!confirmActionTarget(state)) {
      return false;
    }

    if (targetUnit) {
      logDev(
        `${activeUnit.name} targeted ${targetUnit.name} with ${selectedAttack.name}.`
      );
    } else {
      logDev(
        `${activeUnit.name} targeted tile (${targetX},${targetY}) with ${selectedAttack.name}.`
      );
    }

    const weapon = state.content.weapons.find(
      (entry) => entry.id === state.ui.action.lastConfirmed?.attackId
    );

    const hitResult = resolveHit(
      state,
      activeUnit,
      weapon,
      state.ui.action.lastConfirmed
    );

    for (const singleResult of hitResult.results) {
      addCombatTextMarker(
        state,
        singleResult.targetId,
        singleResult.hit ? "HIT" : "MISS",
        { tone: singleResult.hit ? "hit" : "miss" }
      );

      for (const line of singleResult.logs) {
        logDev(line);
      }

      if (!singleResult.hit) continue;

      const damageResult = resolveDamage(
        state,
        activeUnit,
        weapon,
        state.ui.action.lastConfirmed,
        singleResult
      );

      for (const line of damageResult.logs) {
        logDev(line);
      }

      if (!damageResult.result) continue;

      const dr = damageResult.result;

      if (dr.shieldDamage > 0) {
        addCombatTextMarker(state, dr.targetId, `-${dr.shieldDamage} SHD`, {
          tone: "shield"
        });
      }

      if (dr.coreDamage > 0) {
        addCombatTextMarker(state, dr.targetId, `-${dr.coreDamage} CORE`, {
          tone: "core"
        });
      }

      if (dr.statusAfter === "disabled") {
        addCombatTextMarker(state, dr.targetId, "DISABLED", {
          tone: "disabled"
        });
      }
    }

    render();

    if (actionAdvanceTimer) {
      clearTimeout(actionAdvanceTimer);
    }

    actionAdvanceTimer = window.setTimeout(() => {
      actionAdvanceTimer = null;
      clearCombatTextMarkers(state);
      clearTransientUi();
      advanceActionTurn();
      render();
    }, 950);

    return true;
  }

  function confirmAction() {
    if (movementController.confirmMoveOrFacing()) {
      return;
    }

    if (state.ui.mode === "action-attack-select") {
      const activeUnit = getUnitById(state.units, state.turn.activeUnitId);

      if (confirmAttackSelection(state)) {
        const selectedAttack = state.ui.action.selectedAction;
        if (activeUnit && selectedAttack) {
          logDev(`${activeUnit.name} selected attack ${selectedAttack.name}.`);
        }
        render();
      }
      return;
    }

    if (state.ui.mode === "action-target") {
      const activeUnit = getUnitById(state.units, state.turn.activeUnitId);
      const selectedAttack = state.ui.action.selectedAction;

      if (activeUnit && selectedAttack) {
        handleConfirmedTarget(activeUnit, selectedAttack);
      }
    }
  }

  function cancelAction() {
    if (cancelActionState(state)) {
      render();
      return;
    }

    if (movementController.cancelMoveOrFacing()) {
      return;
    }

    if (state.ui.mode === "idle" && state.ui.commandMenu.open) {
      state.ui.commandMenu.open = false;
      state.ui.commandMenu.index = 0;
      render();
    }
  }

  return {
    startAttack,
    completeEndTurnForCurrentUnit,
    waitTurn,
    confirmAction,
    cancelAction
  };
}
