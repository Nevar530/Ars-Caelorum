import { getActiveUnitFromPhaseOrder, rebuildRoundOrder } from "../initiative.js";
import { getActiveActor, getActiveBody } from "../actors/actorResolver.js";

export function createTurnController({
  state,
  getUnitById,
  clearTransientUi,
  snapFocusToActiveUnit,
  render,
  logDev,
  showSplash,
  clearCombatTextMarkers
}) {
  function getNextEligiblePhaseIndex(order, startIndex) {
    if (!Array.isArray(order)) return -1;

    for (let i = Math.max(0, startIndex); i < order.length; i += 1) {
      const unit = getUnitById(state.units, order[i]);
      if (!unit) continue;
      if (unit.status === "disabled") continue;
      return i;
    }

    return -1;
  }

  function setActiveUnitByCurrentTurnIndex() {
    const activeActorId = getActiveUnitFromPhaseOrder(state);

    state.turn.activeActorId = activeActorId ?? null;

    const activeActor = getActiveActor(state);
    const activeBody = getActiveBody(state);
    const activeBodyId = activeBody?.instanceId ?? activeActor?.instanceId ?? null;

    state.turn.activeBodyId = activeBodyId;
    state.turn.activeUnitId = activeBodyId;
    state.selection.unitId = activeBodyId;

    if (activeBodyId) {
      snapFocusToActiveUnit();
    }
  }

  function logRoundInitiative() {
    for (const roll of state.turn.lastInitiativeRolls) {
      logDev(
        `${roll.name} / ${roll.pilotName || "No Pilot"} initiative = ${roll.initiative} (${roll.dice[0]}+${roll.dice[1]}+${roll.reaction})`
      );
    }
  }

  function rebuildOrdersAndLog() {
    rebuildRoundOrder(state);
    logDev(`Initiative rerolled for Round ${state.turn.round}.`);
    logRoundInitiative();
  }

  function beginActionPhase() {
    state.turn.phase = "action";
    state.turn.moveIndex = state.turn.moveOrder.length;
    state.turn.actionIndex = getNextEligiblePhaseIndex(state.turn.actionOrder, 0);

    if (state.turn.actionIndex < 0) {
      endRoundAndBeginNext();
      return;
    }

    clearTransientUi();
    setActiveUnitByCurrentTurnIndex();

    logDev("Phase changed to ACTION.");
    showSplash(`ROUND ${state.turn.round} — ACTION PHASE`);

    render();
  }

  function endRoundAndBeginNext() {
    clearCombatTextMarkers(state);
    state.turn.round += 1;
    state.turn.phase = "move";

    clearTransientUi();
    rebuildOrdersAndLog();

    state.turn.moveIndex = getNextEligiblePhaseIndex(state.turn.moveOrder, 0);
    state.turn.actionIndex = -1;
    setActiveUnitByCurrentTurnIndex();

    logDev(`Round advanced to ${state.turn.round}.`);
    logDev("Phase changed to MOVE.");
    showSplash(`ROUND ${state.turn.round} — MOVEMENT PHASE`);

    render();
  }

  function advanceMoveTurn() {
    const activeActor = getActiveActor(state) ?? getUnitById(state.units, state.turn.activeActorId);
    if (activeActor) {
      activeActor.hasMoved = true;
    }

    state.turn.moveIndex = getNextEligiblePhaseIndex(
      state.turn.moveOrder,
      state.turn.moveIndex + 1
    );

    if (state.turn.moveIndex >= 0) {
      clearTransientUi();
      setActiveUnitByCurrentTurnIndex();
      render();
      return;
    }

    beginActionPhase();
  }

  function advanceActionTurn() {
    const activeActor = getActiveActor(state) ?? getUnitById(state.units, state.turn.activeActorId);
    if (activeActor) {
      activeActor.hasActed = true;
    }

    state.turn.actionIndex = getNextEligiblePhaseIndex(
      state.turn.actionOrder,
      state.turn.actionIndex + 1
    );

    if (state.turn.actionIndex >= 0) {
      clearTransientUi();
      setActiveUnitByCurrentTurnIndex();
      render();
      return;
    }

    endRoundAndBeginNext();
  }

  function startCombat() {
    if (state.turn.combatStarted) return;
    if (!state.units.length) return;

    clearTransientUi();
    clearCombatTextMarkers(state);
    state.turn.combatStarted = true;
    state.turn.round = 1;
    state.turn.phase = "move";

    rebuildOrdersAndLog();

    state.turn.moveIndex = getNextEligiblePhaseIndex(state.turn.moveOrder, 0);
    state.turn.actionIndex = -1;
    setActiveUnitByCurrentTurnIndex();

    logDev("Combat started.");
    logDev("Phase changed to MOVE.");
    showSplash(`ROUND ${state.turn.round} — MOVEMENT PHASE`);

    render();
  }

  return {
    getNextEligiblePhaseIndex,
    setActiveUnitByCurrentTurnIndex,
    rebuildOrdersAndLog,
    beginActionPhase,
    endRoundAndBeginNext,
    advanceMoveTurn,
    advanceActionTurn,
    startCombat
  };
}
