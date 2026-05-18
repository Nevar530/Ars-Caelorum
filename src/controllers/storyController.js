// src/controllers/storyController.js
//
// Free-walk / interact controller for story maps.
// This deliberately stays small: story mode keeps normal mission/map/trigger data
// but skips initiative, rounds, turn phases, and combat menus.

import { canStepToTile, canUnitStepToTile, clampFocusToBoard } from "../movement.js";
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


const WANDER_DIRECTIONS = [
  { facing: 0, dx: 0, dy: -1 },
  { facing: 1, dx: 1, dy: 0 },
  { facing: 2, dx: 0, dy: 1 },
  { facing: 3, dx: -1, dy: 0 }
];

function getStoryNpcBehaviors(state) {
  const behaviors = Array.isArray(state?.map?.npcBehaviors) ? state.map.npcBehaviors : [];
  return behaviors.filter((behavior) => behavior?.enabled !== false && behavior?.type === "wander");
}

function normalizeBehaviorTiles(tiles) {
  const clean = [];
  const seen = new Set();
  for (const tile of Array.isArray(tiles) ? tiles : []) {
    const x = Number(tile?.x);
    const y = Number(tile?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ x, y });
  }
  return clean;
}

function ensureWanderHome(behavior, unit) {
  if (!Number.isFinite(Number(behavior.homeX))) behavior.homeX = Number(unit.x ?? 0);
  if (!Number.isFinite(Number(behavior.homeY))) behavior.homeY = Number(unit.y ?? 0);
  return { x: Number(behavior.homeX), y: Number(behavior.homeY) };
}

function isTileInsideWanderArea(behavior, unit, x, y) {
  const mode = String(behavior?.areaMode ?? "box");
  if (mode === "zone") {
    const tiles = normalizeBehaviorTiles(behavior.tiles);
    if (tiles.length) return tiles.some((tile) => tile.x === x && tile.y === y);
  }

  const home = ensureWanderHome(behavior, unit);
  const width = Math.max(1, Math.trunc(Number(behavior.areaW ?? behavior.size ?? 3) || 3));
  const height = Math.max(1, Math.trunc(Number(behavior.areaH ?? behavior.size ?? width) || width));
  const left = home.x - Math.floor((width - 1) / 2);
  const right = home.x + Math.ceil((width - 1) / 2);
  const top = home.y - Math.floor((height - 1) / 2);
  const bottom = home.y + Math.ceil((height - 1) / 2);

  return x >= left && x <= right && y >= top && y <= bottom;
}

function shouldWanderThisTick(behavior) {
  const interval = Math.max(1, Math.trunc(Number(behavior.stepInterval ?? 1) || 1));
  const runtime = behavior.runtime && typeof behavior.runtime === "object" ? behavior.runtime : {};
  const tick = Math.max(0, Math.trunc(Number(runtime.tick ?? 0) || 0)) + 1;
  behavior.runtime = { ...runtime, tick };
  return tick % interval === 0;
}

function shuffleCopy(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function tickStoryNpcWander(state, { setUnitFacing, logDev } = {}) {
  if (!isStoryMode(state)) return false;
  if (state?.ui?.dialogue?.active || state?.mission?.result) return false;

  let movedAny = false;
  const activeBodyId = state?.turn?.activeBodyId ?? state?.turn?.activeUnitId ?? null;

  for (const behavior of getStoryNpcBehaviors(state)) {
    if (!shouldWanderThisTick(behavior)) continue;

    const unitId = String(behavior.unitId ?? behavior.targetUnitId ?? "").trim();
    if (!unitId || unitId === activeBodyId) continue;

    const unit = getUnitById(state.units, unitId);
    if (!unit || unit.status === "disabled" || unit.status === "destroyed") continue;
    if (unit.embarked) continue;

    ensureWanderHome(behavior, unit);
    const candidates = shuffleCopy(WANDER_DIRECTIONS)
      .map((step) => ({
        facing: step.facing,
        x: Number(unit.x ?? 0) + step.dx,
        y: Number(unit.y ?? 0) + step.dy
      }))
      .filter((candidate) => isTileInsideWanderArea(behavior, unit, candidate.x, candidate.y))
      .filter((candidate) => canUnitStepToTile(state, unit, Number(unit.x ?? 0), Number(unit.y ?? 0), candidate.x, candidate.y));

    if (!candidates.length) continue;

    const next = candidates[0];
    setUnitFacing?.(state.units, unit.instanceId, next.facing);
    moveUnitTo(state.units, unit.instanceId, next.x, next.y);
    movedAny = true;
  }

  return movedAny;
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
  let npcWanderTimer = null;

  function stopStoryNpcWanderTimer() {
    if (npcWanderTimer) {
      window.clearInterval(npcWanderTimer);
      npcWanderTimer = null;
    }
  }

  function shouldRunStoryNpcWanderTimer() {
    if (!isStoryMode(state)) return false;
    if (state?.ui?.shell?.screen && state.ui.shell.screen !== "game") return false;
    if (state?.ui?.dialogue?.active || state?.mission?.result) return false;
    return getStoryNpcBehaviors(state).length > 0;
  }

  function startStoryNpcWanderTimer() {
    stopStoryNpcWanderTimer();
    if (!isStoryMode(state) || !getStoryNpcBehaviors(state).length) return false;

    npcWanderTimer = window.setInterval(() => {
      if (!shouldRunStoryNpcWanderTimer()) return;
      if (tickStoryNpcWander(state, { setUnitFacing })) {
        syncActiveSelection();
        render();
      }
    }, 800);

    return true;
  }

  function refreshStoryNpcWanderTimer() {
    if (!isStoryMode(state) || !getStoryNpcBehaviors(state).length) {
      stopStoryNpcWanderTimer();
      return false;
    }
    return startStoryNpcWanderTimer();
  }

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

    const facing = getWorldFacingFromScreenDirection(direction);
    if (facing !== null && facing !== undefined) {
      setUnitFacing(state.units, unit.instanceId, facing);
    }

    if (target.x === unit.x && target.y === unit.y) {
      render();
      return true;
    }

    if (!canStepToTile(state, unit.x, unit.y, target.x, target.y)) {
      render();
      return true;
    }

    moveUnitTo(state.units, unit.instanceId, target.x, target.y);
    logDev(`${unit.name} moved to (${target.x},${target.y}) in story mode.`);

    continueStoryMove({ unitId: unit.instanceId, facing });
    render();
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
    resumePendingStoryMoveAfterDialogue,
    refreshStoryNpcWanderTimer,
    stopStoryNpcWanderTimer
  };
}
