import {
  cancelActionState,
  confirmActionTarget,
  confirmAttackSelection,
  confirmAbilitySelection,
  confirmItemSelection,
  updateActionTargetPreview,
  startAttackSelection,
  startAbilitySelection,
  startItemSelection
} from "../action.js";
import { resolveHit } from "../combat/hitResolver.js";
import { resolveDamage } from "../combat/damageResolver.js";
import { addCombatTextMarker, clearCombatTextMarkers } from "../combat/combatTextOverlay.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getActiveActor, getActiveBody } from "../actors/actorResolver.js";
import { evaluateMissionResult } from "../mission/missionState.js";
import { resolveEnterMech, resolveExitMech } from "../vehicles/mechEmbarkActions.js";
import { resolveSelectedAbility, resolveSelectedItem } from "../actions/actionResolver.js";

export function createCombatController({
  state,
  getUnitById,
  render,
  logDev,
  clearTransientUi,
  advanceActionTurn,
  movementController,
  endMission,
  onMissionTriggerEvent = null
}) {
  let actionAdvanceTimer = null;
  let pendingActionAfterDialogue = null;

  function fireMissionTriggerEvent(eventType, context = {}) {
    if (typeof onMissionTriggerEvent !== "function") return null;
    const outcome = onMissionTriggerEvent(eventType, context);
    if (outcome === true) return { interrupt: true, consumeTurn: true };
    if (outcome && typeof outcome === "object") return outcome;
    return null;
  }

  function didTriggerInterrupt(outcome) {
    return outcome === true || outcome?.interrupt === true;
  }

  function shouldConsumeAction(outcome) {
    if (!didTriggerInterrupt(outcome)) return false;
    return outcome?.consumeTurn !== false;
  }

  function shouldPauseForDialogue(outcome) {
    return didTriggerInterrupt(outcome) && outcome?.result?.preset === "start_dialogue";
  }

  function resumePendingActionAfterDialogue() {
    if (!pendingActionAfterDialogue) return false;
    const pending = pendingActionAfterDialogue;
    pendingActionAfterDialogue = null;
    finishActionAfterTriggerInterrupt(pending.outcome, { allowDialoguePause: false });
    return true;
  }

  function finishActionAfterTriggerInterrupt(outcome, options = {}) {
    if (options.allowDialoguePause !== false && shouldPauseForDialogue(outcome)) {
      pendingActionAfterDialogue = { outcome };
      render();
      return true;
    }

    if (actionAdvanceTimer) {
      clearTimeout(actionAdvanceTimer);
      actionAdvanceTimer = null;
    }

    clearCombatTextMarkers(state);
    clearTransientUi();

    if (shouldConsumeAction(outcome) && state.turn.phase === "action" && !state.mission?.result) {
      advanceActionTurn();
    } else {
      render();
    }

    return true;
  }

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

  function startItem() {
    if (!state.turn.combatStarted || state.turn.phase !== "action") return;

    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit) return;

    if (!startItemSelection(state)) return;

    logDev(`${activeUnit.name} entered item selection.`);
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

      const hitTarget = getUnitById(state.units, dr.targetId ?? singleResult.targetId);
      const hitTriggerOutcome = fireMissionTriggerEvent("onHitTarget", {
        unit: activeUnit,
        sourceUnit: activeUnit,
        targetUnit: hitTarget,
        weapon,
        hitResult: singleResult,
        damageResult: dr
      });
      if (didTriggerInterrupt(hitTriggerOutcome)) {
        render();
        return finishActionAfterTriggerInterrupt(hitTriggerOutcome);
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

  function applyResolvedSupportAction(result) {
    if (!result?.ok) return false;

    logDev(result.log);

    if (result.changes?.shieldDelta > 0) {
      addCombatTextMarker(state, result.targetId, `+${result.changes.shieldDelta} SHD`, {
        tone: "shield"
      });
    } else if (result.changes?.shieldDelta < 0) {
      addCombatTextMarker(state, result.targetId, `${result.changes.shieldDelta} SHD`, {
        tone: "shield"
      });
    }

    if (result.changes?.coreDelta > 0) {
      addCombatTextMarker(state, result.targetId, `+${result.changes.coreDelta} CORE`, {
        tone: "core"
      });
    } else if (result.changes?.coreDelta < 0) {
      addCombatTextMarker(state, result.targetId, `${result.changes.coreDelta} CORE`, {
        tone: "core"
      });
    }

    if (result.changes?.statusBefore !== result.changes?.statusAfter && result.changes?.statusAfter === "disabled") {
      addCombatTextMarker(state, result.targetId, "DISABLED", {
        tone: "disabled"
      });
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

  function executeCpuAttack(attackPlan) {
    const activeUnit = getActiveBody(state) ?? getUnitById(state.units, state.turn.activeUnitId);
    if (!activeUnit || !attackPlan?.profile) return false;

    state.ui.mode = "action-target";
    state.selection.action = "attack";
    state.ui.action.selectedAction = attackPlan.profile;
    state.focus.x = Number(attackPlan.targetX);
    state.focus.y = Number(attackPlan.targetY);

    updateActionTargetPreview(state);

    return handleConfirmedTarget(activeUnit, attackPlan.profile);
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
          const targetMech = getUnitById(state.units, selectedAbility.mechId);
          const enterResult = resolveEnterMech(state, activeActor, targetMech);
          if (enterResult.ok) {
            logDev(`${enterResult.pilotName} entered ${enterResult.mechName}.`);
            const enterTriggerOutcome = fireMissionTriggerEvent("onEnterMech", { unit: activeActor, actor: activeActor, mech: targetMech, result: enterResult });
            if (didTriggerInterrupt(enterTriggerOutcome)) {
              return finishActionAfterTriggerInterrupt(enterTriggerOutcome);
            }
            clearTransientUi();
            advanceActionTurn();
            render();
            return;
          }
        }

        if (selectedAbility?.id === "exit_mech" && activeActor) {
          const targetMech = getUnitById(state.units, selectedAbility.mechId);
          const exitResult = resolveExitMech(state, activeActor, targetMech, selectedAbility.exitTile ?? null);
          if (exitResult.ok) {
            logDev(`${exitResult.pilotName} exited ${exitResult.mechName} at (${exitResult.exitTile.x},${exitResult.exitTile.y}).`);
            const exitTriggerOutcome = fireMissionTriggerEvent("onExitMech", { unit: activeActor, actor: activeActor, mech: targetMech, result: exitResult });
            if (didTriggerInterrupt(exitTriggerOutcome)) {
              return finishActionAfterTriggerInterrupt(exitTriggerOutcome);
            }
            clearTransientUi();
            advanceActionTurn();
            render();
            return;
          }
        }

        if (selectedAbility?.source === "content") {
          const resolved = resolveSelectedAbility(state, selectedAbility);
          if (applyResolvedSupportAction(resolved)) {
            return;
          }
          logDev(resolved?.log ?? "Ability could not resolve.");
        }
      }

      render();
      return;
    }

    if (state.ui.mode === "action-item-select") {
      if (confirmItemSelection(state)) {
        const selectedItem = state.ui.action.selectedItem;
        if (selectedItem?.source === "content") {
          const resolved = resolveSelectedItem(state, selectedItem);
          if (applyResolvedSupportAction(resolved)) {
            return;
          }
          logDev(resolved?.log ?? "Item could not resolve.");
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

    if (state.ui.mode === "idle" && state.ui.commandMenu.open) {
      state.ui.commandMenu.open = false;
      state.ui.commandMenu.index = 0;
      render();
    }
  }

  return {
    startAttack,
    startAbility,
    startItem,
    completeEndTurnForCurrentUnit,
    waitTurn,
    resumePendingActionAfterDialogue,
    handleConfirmedTarget,
    executeCpuAttack,
    confirmAction,
    cancelAction
  };
}
