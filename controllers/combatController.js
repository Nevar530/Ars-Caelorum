import {
  cancelActionState,
  confirmActionTarget,
  confirmAttackSelection,
  startAttackSelection
} from "../action.js";
import { resolveHit } from "../combat/hitResolver.js";
import { resolveDamage } from "../combat/damageResolver.js";
import { addCombatTextMarker } from "../combat/combatTextOverlay.js";

export function createCombatController({
  state,
  getMechById,
  getMechAt,
  render,
  logDev,
  clearTransientUi,
  advanceActionTurn,
  movementController
}) {
  function startAttack() {
    if (!state.turn.combatStarted || state.turn.phase !== "action") return;

    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    if (!startAttackSelection(state)) return;

    logDev(`${activeMech.name} entered attack selection.`);
    render();
  }

  function completeEndTurnForCurrentUnit() {
    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    logDev(`${activeMech.name} ended action turn.`);
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

  function handleConfirmedTarget(activeMech, selectedAttack) {
    const targetX = state.focus.x;
    const targetY = state.focus.y;
    const targetMech = getMechAt(state.mechs, targetX, targetY);

    if (!confirmActionTarget(state)) {
      return false;
    }

    if (targetMech) {
      logDev(
        `${activeMech.name} targeted ${targetMech.name} with ${selectedAttack.name}.`
      );
    } else {
      logDev(
        `${activeMech.name} targeted tile (${targetX},${targetY}) with ${selectedAttack.name}.`
      );
    }

    const weapon = state.content.weapons.find(
      (entry) => entry.id === state.ui.action.lastConfirmed?.attackId
    );

    const hitResult = resolveHit(
      state,
      activeMech,
      weapon,
      state.ui.action.lastConfirmed
    );

    for (const line of hitResult.logs) {
      logDev(line);
    }

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
        activeMech,
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

    clearTransientUi();
    advanceActionTurn();
    return true;
  }

  function confirmAction() {
    if (movementController.confirmMoveOrFacing()) {
      return;
    }

    if (state.ui.mode === "action-attack-select") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);

      if (confirmAttackSelection(state)) {
        const selectedAttack = state.ui.action.selectedAction;
        if (activeMech && selectedAttack) {
          logDev(`${activeMech.name} selected attack ${selectedAttack.name}.`);
        }
        render();
      }
      return;
    }

    if (state.ui.mode === "action-target") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      const selectedAttack = state.ui.action.selectedAction;

      if (activeMech && selectedAttack) {
        handleConfirmedTarget(activeMech, selectedAttack);
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
