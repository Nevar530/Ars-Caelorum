export function getMissionState(state) {
  if (!state.mission) {
    state.mission = {
      sourceMap: null,
      result: null
    };
  }

  return state.mission;
}

export function clearMissionResult(state) {
  const mission = getMissionState(state);
  mission.result = null;
}

function getPilotActors(state) {
  return Array.isArray(state?.units)
    ? state.units.filter((unit) => unit?.unitType === "pilot")
    : [];
}

function isPilotOutOfPlay(pilot) {
  if (!pilot) return true;
  if (pilot.status === "disabled" || pilot.status === "destroyed") return true;
  return Number(pilot.core ?? 0) <= 0;
}

export function evaluateMissionResult(state) {
  const mission = getMissionState(state);
  if (mission.result) return mission.result;

  const pilots = getPilotActors(state);
  const playerPilots = pilots.filter((pilot) => pilot.team !== "enemy");
  const enemyPilots = pilots.filter((pilot) => pilot.team === "enemy");

  if (playerPilots.length > 0 && playerPilots.every(isPilotOutOfPlay)) {
    mission.result = "defeat";
    return mission.result;
  }

  if (enemyPilots.length > 0 && enemyPilots.every(isPilotOutOfPlay)) {
    mission.result = "victory";
    return mission.result;
  }

  return null;
}
