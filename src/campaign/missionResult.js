// src/campaign/missionResult.js
//
// Mission result receipt V2.
// Captures a small summary at mission end so campaign rewards do not read half-reset runtime state.

export function buildMissionResultReceipt(state, result) {
  const mission = state?.mission ?? {};
  const definition = mission.definition ?? {};
  const objectiveRuntime = mission.objectiveRuntime ?? {};
  const completedMap = objectiveRuntime.completed ?? {};
  const objectives = Array.isArray(state?.map?.objectives)
    ? state.map.objectives
    : Array.isArray(definition.objectives)
      ? definition.objectives
      : [];

  const objectivesCompleted = [];
  const objectivesFailed = [];

  for (const objective of objectives) {
    const id = String(objective?.id ?? "").trim();
    if (!id) continue;
    if (completedMap[id]) objectivesCompleted.push(id);
    if (result === "defeat" && objective?.type === "protect_unit") objectivesFailed.push(id);
  }

  return {
    missionId: definition.id ?? mission.id ?? "unknown_mission",
    activeMapId: state?.map?.id ?? definition.activeMapId ?? definition.mapId ?? null,
    result: result === "defeat" ? "defeat" : "victory",
    roundsTaken: Math.max(0, Math.trunc(Number(state?.turn?.round ?? 0) || 0)),
    objectivesCompleted,
    objectivesFailed,
    survivingUnits: getUnitsByStatus(state, false),
    disabledUnits: getUnitsByStatus(state, true),
    deployedPlayerPilotIds: getDeployedPlayerPilotIds(state),
    flagsSet: { ...(mission.triggerRuntime?.flags ?? {}) }
  };
}

function getDeployedPlayerPilotIds(state) {
  return [...new Set((Array.isArray(state?.units) ? state.units : [])
    .filter((unit) => unit?.unitType === "pilot" && unit?.team === "player")
    .map((unit) => unit?.definitionId ?? unit?.pilotId ?? null)
    .filter(Boolean))];
}

function getUnitsByStatus(state, disabled) {
  return (Array.isArray(state?.units) ? state.units : [])
    .filter((unit) => {
      const out = unit?.status === "disabled" || unit?.status === "destroyed" || Number(unit?.core ?? 1) <= 0;
      return disabled ? out : !out;
    })
    .map((unit) => unit?.instanceId ?? unit?.id ?? unit?.name)
    .filter(Boolean);
}
