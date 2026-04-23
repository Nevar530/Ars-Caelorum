import { getActiveActor, getActiveBody } from "../actors/actorResolver.js";
import { chooseCpuAttackPlan, chooseCpuMoveDestination } from "./cpuTurnPlanner.js";

const DEFAULT_AI_DELAY_MS = 260;

export function createCpuTurnController({
  state,
  render,
  logDev,
  movementController,
  combatController,
  delayMs = DEFAULT_AI_DELAY_MS
}) {
  let pendingTimer = null;
  let pendingActorId = null;
  let pendingPhase = null;

  function clearPendingTurn() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    pendingActorId = null;
    pendingPhase = null;
  }

  function isCpuTurnReady() {
    if (!state.turn?.combatStarted) return false;
    if (state.ui?.deployment?.active) return false;
    if (state.mission?.result) return false;
    if (state.ui?.shell?.screen !== "game") return false;

    const activeActor = getActiveActor(state);
    if (!activeActor) return false;
    if (activeActor.controlType !== "CPU") return false;

    return true;
  }

  function executeCpuMoveTurn() {
    const activeBody = getActiveBody(state);
    if (!activeBody || activeBody.status === "disabled") {
      movementController.skipMoveForCurrentUnit();
      return;
    }

    const destination = chooseCpuMoveDestination(state);
    if (!destination) {
      logDev(`${activeBody.name} (CPU) holds position.`);
      movementController.skipMoveForCurrentUnit();
      return;
    }

    const moved = movementController.executeCpuMove(destination.x, destination.y);
    if (!moved) {
      logDev(`${activeBody.name} (CPU) could not complete planned move.`);
      movementController.skipMoveForCurrentUnit();
    }
  }

  function executeCpuActionTurn() {
    const activeBody = getActiveBody(state);
    if (!activeBody) {
      combatController.completeEndTurnForCurrentUnit();
      return;
    }

    const attackPlan = chooseCpuAttackPlan(state);
    if (!attackPlan) {
      logDev(`${activeBody.name} (CPU) found no legal attack.`);
      combatController.completeEndTurnForCurrentUnit();
      return;
    }

    logDev(`${activeBody.name} (CPU) attacks ${attackPlan.targetName} with ${attackPlan.attackName}.`);
    const fired = combatController.executeCpuAttack(attackPlan);
    if (!fired) {
      logDev(`${activeBody.name} (CPU) failed to resolve attack and ends turn.`);
      combatController.completeEndTurnForCurrentUnit();
    }
  }

  function executePendingTurn() {
    clearPendingTurn();

    if (!isCpuTurnReady()) {
      render();
      return;
    }

    if (state.turn.phase === "move") {
      executeCpuMoveTurn();
      return;
    }

    if (state.turn.phase === "action") {
      executeCpuActionTurn();
      return;
    }
  }

  function scheduleForCurrentTurn() {
    clearPendingTurn();
    if (!isCpuTurnReady()) return;

    const activeActor = getActiveActor(state);
    pendingActorId = activeActor?.instanceId ?? null;
    pendingPhase = state.turn.phase;

    pendingTimer = window.setTimeout(() => {
      if (pendingActorId !== state.turn.activeActorId || pendingPhase !== state.turn.phase) {
        clearPendingTurn();
        return;
      }
      executePendingTurn();
    }, delayMs);
  }

  return {
    clearPendingTurn,
    scheduleForCurrentTurn
  };
}
