import {
  cancelActionState,
  confirmActionTarget,
  confirmAttackSelection,
  confirmAbilitySelection,
  startAttackSelection,
  startAbilitySelection
} from "../action.js";
import { resolveHit } from "../combat/hitResolver.js";
import { resolveDamage } from "../combat/damageResolver.js";
import { addCombatTextMarker, clearCombatTextMarkers } from "../combat/combatTextOverlay.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getActiveActor, getActiveBody } from "../actors/actorResolver.js";
import { evaluateMissionResult } from "../mission/missionState.js";
import { resolveEnterMech, resolveExitMech } from "../vehicles/mechEmbarkActions.js";

export function createCombatController({
  state,
  getUnitById,
  render,
  logDev,
  clearTransientUi,
  advanceActionTurn,
  movementController,
  endMission
}) {
  let actionAdvanceTimer = null;
  function startAttack() {
    if (!state.turn.combatStarted || state.turn.phase !== "action") return;

    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;
    if (activeUnit.status === "disabled") return;

    if (!startAttackSelection(state)) return;

    logDev(`${activeUnit.name} entered attack selection.`);
    render();
  }


  function startAbility() {
    if (!state.turn.combatStarted || state.turn.phase !== "action") return;

    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;

    if (!startAbilitySelection(state)) return;

    logDev(`${activeUnit.name} entered ability selection.`);
    render();
  }

  function completeEndTurnForCurrentUnit() {
    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
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

      const dr = damageResult.result;
      if (!dr) continue;

      for (const event of dr.damageEvents ?? []) {
        if (event.shieldDamage > 0) {
          addCombatTextMarker(state, event.targetId, `-${event.shieldDamage} SHD`, {
            tone: "shield"
          });
        }

        if (event.coreDamage > 0) {
          addCombatTextMarker(state, event.targetId, `-${event.coreDamage} CORE`, {
            tone: "core"
          });
        }

        if (event.statusAfter === "disabled") {
          addCombatTextMarker(state, event.targetId, "DISABLED", {
            tone: "disabled"
          });
        }
      }
    }

    const missionResult = evaluateMissionResult(state);

    render();

    if (missionResult) {
      if (actionAdvanceTimer) {
        clearTimeout(actionAdvanceTimer);
        actionAdvanceTimer = null;
      }
      clearCombatTextMarkers(state);
      endMission(missionResult);
      return true;
    }

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

    if (state.ui.mode === "action-ability-select") {
      const activeActor = getActiveActor(state);

      if (confirmAbilitySelection(state)) {
        const selectedAbility = state.ui.action.selectedAbility;
        if (selectedAbility?.id === "enter_mech" && activeActor) {
          const enterResult = resolveEnterMech(state, activeActor, selectedAbility.mechId);
          if (enterResult.ok) {
            for (const line of enterResult.logs) {
              logDev(line);
            }
            clearTransientUi();
            advanceActionTurn();
            render();
            return;
          }
        }

        if (selectedAbility?.id === "exit_mech" && activeActor) {
          const exitResult = resolveExitMech(state, activeActor, selectedAbility.exitTile);
          if (exitResult.ok) {
            for (const line of exitResult.logs) {
              logDev(line);
            }
            clearTransientUi();
            advanceActionTurn();
            render();
            return;
          }
        }
      }

      render();
      return;
    }

    if (state.ui.mode === "action-attack-select") {
      const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
      if (!activeUnit) return;

      if (confirmAttackSelection(state)) {
        const selectedAttack = state.ui.action.selectedAction;
        if (selectedAttack) {
          logDev(`${activeUnit.name} selected ${selectedAttack.name}.`);
        }
      }

      render();
      return;
    }

    if (state.ui.mode === "action-target") {
      const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
      const selectedAttack = state.ui.action.selectedAction;
      if (!activeUnit || !selectedAttack) return;

      handleConfirmedTarget(activeUnit, selectedAttack);
      return;
    }

    if (state.ui.mode === "idle" && state.ui.commandMenu.open) {
      state.ui.commandMenu.open = false;
      state.ui.commandMenu.index = 0;
      render();
    }
  }

  function cancelAction() {
    if (movementController.cancelMoveOrFacing()) {
      return;
    }

    if (cancelActionState(state)) {
      render();
      return;
    }

    if (state.ui.commandMenu.open && state.ui.mode === "idle") {
      state.ui.commandMenu.open = false;
      state.ui.commandMenu.index = 0;
      render();
    }
  }

  return {
    startAttack,
    startAbility,
    completeEndTurnForCurrentUnit,
    waitTurn,
    handleConfirmedTarget,
    confirmAction,
    cancelAction
  };
}
