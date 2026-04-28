export function getMissionState(state) {
  if (!state.mission) {
    state.mission = {
      sourceMap: null,
      definition: null,
      result: null
    };
  }

  return state.mission;
}

export function setActiveMissionDefinition(state, missionDefinition = null) {
  const mission = getMissionState(state);
  mission.definition = missionDefinition ?? null;
  mission.result = null;
}

export function clearMissionResult(state) {
  const mission = getMissionState(state);
  mission.result = null;
}

export function getMissionResultCopy(state, result) {
  const definition = getMissionState(state)?.definition ?? null;
  const resultDefinition = definition?.results?.[result] ?? null;

  if (resultDefinition) {
    return {
      title: resultDefinition.title || defaultResultTitle(result),
      text: resultDefinition.text || defaultResultText(result)
    };
  }

  return {
    title: defaultResultTitle(result),
    text: defaultResultText(result)
  };
}

export function startMissionDialogue(state, dialogueKey = "intro") {
  const mission = getMissionState(state);
  const lines = getDialogueLines(mission?.definition, dialogueKey);

  if (!lines.length) {
    clearDialogueState(state);
    return false;
  }

  state.ui.dialogue = {
    active: true,
    key: dialogueKey,
    index: 0,
    lines
  };

  return true;
}

export function advanceMissionDialogue(state) {
  const dialogue = state?.ui?.dialogue;
  if (!dialogue?.active) return false;

  const count = Array.isArray(dialogue.lines) ? dialogue.lines.length : 0;
  dialogue.index = Number(dialogue.index ?? 0) + 1;

  if (dialogue.index >= count) {
    clearDialogueState(state);
    return true;
  }

  return false;
}

export function clearDialogueState(state) {
  if (!state?.ui) return;

  state.ui.dialogue = {
    active: false,
    key: null,
    index: 0,
    lines: []
  };
}

export function getCurrentDialogueLine(state) {
  const dialogue = state?.ui?.dialogue;
  if (!dialogue?.active) return null;

  const lines = Array.isArray(dialogue.lines) ? dialogue.lines : [];
  const index = Math.max(0, Number(dialogue.index ?? 0));
  return lines[index] ?? null;
}

function getDialogueLines(missionDefinition, key) {
  const dialogueBlock = missionDefinition?.dialogue?.[key] ?? null;
  const lines = Array.isArray(dialogueBlock?.lines) ? dialogueBlock.lines : [];

  return lines
    .filter((line) => line && String(line.text ?? "").trim())
    .map((line) => ({
      speakerId: line.speakerId ?? null,
      name: line.name ?? line.speakerId ?? "Unknown",
      portrait: line.portrait ?? null,
      text: String(line.text ?? "")
    }));
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

function defaultResultTitle(result) {
  return result === "victory" ? "Victory" : "Defeat";
}

function defaultResultText(result) {
  return result === "victory"
    ? "Mission complete. Return to the title screen to choose another mission."
    : "Mission failed. Return to the title screen to try again.";
}
