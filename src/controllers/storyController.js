// src/controllers/storyController.js
//
// Free-walk / interact controller for story maps.
// This deliberately stays small: story mode keeps normal mission/map/trigger data
// but skips initiative, rounds, turn phases, and combat menus.

import { canStepToTile, clampFocusToBoard } from "../movement.js";
import { getUnitById, moveUnitTo } from "../mechs.js";
import { getActiveActor, getActiveBody, getControlledBodyForPilot } from "../actors/actorResolver.js";
import { getBoardDeltaFromScreenDirection, getWorldFacingFromScreenDirection } from "../input/inputFocus.js";
import { isStoryMode } from "../mode/mapMode.js";
import { resolveEnterMech, resolveExitMech } from "../vehicles/mechEmbarkActions.js";
import { evaluateMissionResult } from "../mission/missionState.js";
import { canPilotBoardMech, getMechForEmbarkedPilot } from "../vehicles/mechEmbarkRules.js";

function firstPlayablePilot(state) {
  return (state?.units ?? []).find((unit) => {
    if (unit?.unitType !== "pilot") return false;
    if (unit?.controlType !== "PC") return false;
    return String(unit?.status ?? "operational") !== "disabled";
  }) ?? null;
}

function didTriggerInterrupt(outcome) {
  return outcome === true || outcome?.interrupt === true;
}

function shouldPauseForDialogue(outcome) {
  return didTriggerInterrupt(outcome) && outcome?.result?.preset === "start_dialogue";
}

export function initializeStoryModeState(state) {
  if (!isStoryMode(state)) return false;

  const actor = getActiveActor(state) ?? firstPlayablePilot(state);
  const body = actor ? getControlledBodyForPilot(state, actor) : null;
  const active = body ?? actor ?? (state?.units ?? []).find((unit) => unit?.controlType === "PC") ?? null;

  state.turn.combatStarted = false;
  state.turn.phase = "story";
  state.turn.round = 0;
  state.turn.moveOrder = [];
  state.turn.actionOrder = [];
  state.turn.moveIndex = -1;
  state.turn.actionIndex = -1;
  state.turn.activeActorId = actor?.instanceId ?? active?.instanceId ?? null;
  state.turn.activeBodyId = body?.instanceId ?? active?.instanceId ?? null;
  state.turn.activeUnitId = active?.instanceId ?? null;

  if (active) {
    state.selection.unitId = active.instanceId;
    state.focus.x = Number(active.x ?? 0);
    state.focus.y = Number(active.y ?? 0);
    state.focus.scale = active.scale ?? active.unitType ?? "pilot";
    state.camera.zoomMode = active.scale ?? active.unitType ?? "pilot";
    state.camera.zoomScale = state.camera.zoomMode;
  }

  return true;
}

export function createStoryController({
  state,
  setUnitFacing,
  render,
  logDev,
  onUnitEnteredZone = null,
  onMissionTriggerEvent = null,
  onMissionResult = null
}) {
  let pendingStoryMoveAfterDialogue = null;

  function getStoryActor() {
    return getActiveActor(state) ?? firstPlayablePilot(state);
  }

  function getStoryBody() {
    const actor = getStoryActor();
    const body = getActiveBody(state) ?? (actor ? getControlledBodyForPilot(state, actor) : null);
    return body ?? actor ?? null;
  }

  function syncActiveSelection(unit = null) {
    const actor = getStoryActor();
    const body = unit ?? getStoryBody();

    state.turn.activeActorId = actor?.instanceId ?? body?.instanceId ?? null;
    state.turn.activeBodyId = body?.instanceId ?? null;
    state.turn.activeUnitId = body?.instanceId ?? actor?.instanceId ?? null;

    if (body) {
      state.selection.unitId = body.instanceId;
      state.focus.x = Number(body.x ?? 0);
      state.focus.y = Number(body.y ?? 0);
      state.focus.scale = body.scale ?? body.unitType ?? "pilot";
    }
  }

  function handleUnitEnteredZone(unit) {
    if (!unit || typeof onUnitEnteredZone !== "function") return null;
    const outcome = onUnitEnteredZone(unit);
    if (outcome === true) return { interrupt: true, consumeTurn: false };
    if (outcome && typeof outcome === "object") return { ...outcome, consumeTurn: false };
    return null;
  }

  function fireMissionTriggerEvent(eventType, context = {}) {
    if (typeof onMissionTriggerEvent !== "function") return null;
    const outcome = onMissionTriggerEvent(eventType, context);
    if (outcome === true) return { interrupt: true, consumeTurn: false };
    if (outcome && typeof outcome === "object") return { ...outcome, consumeTurn: false };
    return null;
  }

  function resolveStoryMissionResult(options = {}) {
    const result = evaluateMissionResult(state, options);
    if (!result) return false;
    if (typeof onMissionResult === "function") {
      onMissionResult(result);
      return true;
    }
    state.mission.result = result;
    return true;
  }

  function resumePendingStoryMoveAfterDialogue() {
    if (!pendingStoryMoveAfterDialogue) return false;
    const pending = pendingStoryMoveAfterDialogue;
    pendingStoryMoveAfterDialogue = null;
    continueStoryMove(pending);
    return true;
  }

  function continueStoryMove(pending) {
    const unit = getUnitById(state.units, pending.unitId);
    if (!unit || unit.status === "disabled") {
      syncActiveSelection();
      render();
      return;
    }

    if (pending.facing !== null && pending.facing !== undefined) {
      setUnitFacing(state.units, unit.instanceId, pending.facing);
    }

    const triggerOutcome = handleUnitEnteredZone(unit);
    syncActiveSelection(unit);

    if (shouldPauseForDialogue(triggerOutcome)) {
      pendingStoryMoveAfterDialogue = pending;
      render();
      return;
    }

    if (didTriggerInterrupt(triggerOutcome)) {
      logDev(`${unit.name} triggered a story event at (${unit.x},${unit.y}).`);
      render();
      return;
    }

    if (resolveStoryMissionResult({ timing: "after_move" })) return;

    render();
  }

  function moveStoryUnit(direction) {
    if (!isStoryMode(state)) return false;
    if (state?.ui?.dialogue?.active) return false;
    if (state?.mission?.result) return false;

    const unit = getStoryBody();
    if (!unit || unit.status === "disabled") return false;

    syncActiveSelection(unit);

    const delta = getBoardDeltaFromScreenDirection(direction, { dx: 1, dy: 1 });
    const target = clampFocusToBoard(
      Number(unit.x ?? 0) + Number(delta.dx ?? 0),
      Number(unit.y ?? 0) + Number(delta.dy ?? 0),
      unit.scale ?? unit.unitType ?? "pilot",
      state
    );

    if (target.x === unit.x && target.y === unit.y) return true;
    if (!canStepToTile(state, unit.x, unit.y, target.x, target.y)) return true;

    const facing = getWorldFacingFromScreenDirection(direction);
    moveUnitTo(state.units, unit.instanceId, target.x, target.y);
    logDev(`${unit.name} moved to (${target.x},${target.y}) in story mode.`);

    continueStoryMove({ unitId: unit.instanceId, facing });
    return true;
  }


  function storyInteract() {
    if (!isStoryMode(state)) return false;
    if (state?.ui?.dialogue?.active) return false;
    if (state?.mission?.result) return false;

    const actor = getStoryActor();
    const body = getStoryBody();
    if (!actor || !body) return false;

    const unitInteractOutcome = fireMissionTriggerEvent("onUnitInteract", { unit: body, actor, body });
    if (unitInteractOutcome?.handled || unitInteractOutcome?.interrupt) {
      syncActiveSelection(body);
      if (shouldPauseForDialogue(unitInteractOutcome)) {
        render();
        return true;
      }
      if (resolveStoryMissionResult({ timing: "after_interact" })) return true;
      render();
      return true;
    }

    const interactOutcome = fireMissionTriggerEvent("onInteract", { unit: body, actor, body });
    if (interactOutcome?.handled || interactOutcome?.interrupt) {
      syncActiveSelection(body);
      if (shouldPauseForDialogue(interactOutcome)) {
        render();
        return true;
      }
      if (resolveStoryMissionResult({ timing: "after_interact" })) return true;
      render();
      return true;
    }

    if (actor.unitType === "pilot" && !actor.embarked) {
      const boardableMech = (state.units ?? []).find((unit) => canPilotBoardMech(state, actor, unit));
      if (boardableMech) {
        const result = resolveEnterMech(state, actor, boardableMech);
        if (result.ok) {
          const enteredBody = getUnitById(state.units, result.mechId) ?? boardableMech;
          syncActiveSelection(enteredBody);
          logDev(`${result.pilotName} entered ${result.mechName} in story mode.`);
          const outcome = fireMissionTriggerEvent("onEnterMech", { unit: actor, actor, mech: enteredBody, result });
          if (shouldPauseForDialogue(outcome)) {
            render();
            return true;
          }
          if (resolveStoryMissionResult({ timing: "after_enter_mech" })) return true;
          render();
          return true;
        }

        logDev(`Story interact: ${actor.name ?? "pilot"} could not enter ${boardableMech.name ?? "mech"} (${result.reason}).`);
      }
    }

    if (actor.unitType === "pilot" && actor.embarked) {
      const mech = getMechForEmbarkedPilot(state, actor);
      const result = resolveExitMech(state, actor, mech);
      if (result.ok) {
        syncActiveSelection(actor);
        logDev(`${result.pilotName} exited ${result.mechName} at (${result.exitTile.x},${result.exitTile.y}) in story mode.`);
        const outcome = fireMissionTriggerEvent("onExitMech", { unit: actor, actor, mech, result });
        if (shouldPauseForDialogue(outcome)) {
          render();
          return true;
        }
        if (resolveStoryMissionResult({ timing: "after_exit_mech" })) return true;
        render();
        return true;
      }

      logDev(`Story interact: ${actor.name ?? "pilot"} could not exit ${mech?.name ?? "mech"} (${result.reason}).`);
    }

    logDev("Story interact: no contextual action available.");
    render();
    return true;
  }

  return {
    initializeStoryModeState: () => initializeStoryModeState(state),
    moveStoryUnit,
    storyInteract,
    resumePendingStoryMoveAfterDialogue
  };
}
