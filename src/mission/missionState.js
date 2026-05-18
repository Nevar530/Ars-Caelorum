import { evaluateObjectiveMissionResult, resetObjectiveRuntimeState } from "./missionObjectives.js";

export function getMissionState(state) {
  if (!state.mission) {
    state.mission = {
      sourceMap: null,
      definition: null,
      result: null,
      resultReceipt: null,
      campaignReward: null
    };
  }

  return state.mission;
}

export function setActiveMissionDefinition(state, missionDefinition = null) {
  const mission = getMissionState(state);
  mission.definition = missionDefinition ?? null;
  mission.result = null;
  mission.resultReceipt = null;
  mission.campaignReward = null;
  resetObjectiveRuntimeState(state);
}

export function clearMissionResult(state) {
  const mission = getMissionState(state);
  mission.result = null;
  mission.resultReceipt = null;
  mission.campaignReward = null;
  resetObjectiveRuntimeState(state);
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
    optionIndex: 0,
    lines
  };

  return true;
}

export function advanceMissionDialogue(state) {
  const dialogue = state?.ui?.dialogue;
  if (!dialogue?.active) return false;

  const currentLine = getCurrentDialogueLine(state);
  if (Array.isArray(currentLine?.options) && currentLine.options.length) return false;

  const count = Array.isArray(dialogue.lines) ? dialogue.lines.length : 0;
  dialogue.index = Number(dialogue.index ?? 0) + 1;
  dialogue.optionIndex = 0;

  if (dialogue.index >= count) {
    clearDialogueState(state);
    return true;
  }

  return false;
}

export function moveMissionDialogueOption(state, delta = 0) {
  const dialogue = state?.ui?.dialogue;
  if (!dialogue?.active) return false;

  const line = getCurrentDialogueLine(state);
  const options = Array.isArray(line?.options) ? line.options : [];
  if (!options.length) return false;

  const current = Math.max(0, Math.min(Number(dialogue.optionIndex ?? 0), options.length - 1));
  dialogue.optionIndex = (current + Number(delta || 0) + options.length) % options.length;
  return true;
}

export function selectMissionDialogueOption(state) {
  const dialogue = state?.ui?.dialogue;
  if (!dialogue?.active) return null;

  const line = getCurrentDialogueLine(state);
  const options = Array.isArray(line?.options) ? line.options : [];
  if (!options.length) return null;

  const index = Math.max(0, Math.min(Number(dialogue.optionIndex ?? 0), options.length - 1));
  const option = options[index] ?? null;
  if (!option) return null;

  const nextDialogueKey = String(option.nextDialogueKey ?? option.dialogueKey ?? "").trim();
  if (nextDialogueKey) {
    startMissionDialogue(state, nextDialogueKey);
    return { selected: true, action: "startDialogue", dialogueKey: nextDialogueKey, option };
  }

  clearDialogueState(state);
  return {
    selected: true,
    action: String(option.action ?? "closeDialogue").trim() || "closeDialogue",
    loadMissionId: String(option.loadMissionId ?? "").trim(),
    option
  };
}

export function clearDialogueState(state) {
  if (!state?.ui) return;

  state.ui.dialogue = {
    active: false,
    key: null,
    index: 0,
    optionIndex: 0,
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
      text: String(line.text ?? ""),
      options: normalizeDialogueOptions(line.options)
    }));
}

function normalizeDialogueOptions(options) {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => ({
      label: String(option?.label ?? "").trim(),
      nextDialogueKey: String(option?.nextDialogueKey ?? option?.dialogueKey ?? "").trim(),
      action: String(option?.action ?? "").trim(),
      loadMissionId: String(option?.loadMissionId ?? "").trim()
    }))
    .filter((option) => option.label);
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

export function evaluateMissionResult(state, options = {}) {
  return evaluateObjectiveMissionResult(state, options);
}

function defaultResultTitle(result) {
  return result === "victory" ? "Victory" : "Defeat";
}

function defaultResultText(result) {
  return result === "victory"
    ? "Mission complete. Return to the title screen to continue."
    : "Mission failed. Return to the title screen to try again.";
}
