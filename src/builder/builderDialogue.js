// src/builder/builderDialogue.js
//
// Dialogue authoring V1.
// Keeps dialogue as mission-wrapper data and exposes simple blocks/lines for triggers/logic.

const DEFAULT_BLOCKS = ["intro", "victory", "defeat"];

export function createDefaultDialogueTool() {
  return {
    selectedKey: "intro",
    blockKey: "intro",
    blockName: "Intro",
    speakerId: "system",
    speakerName: "Mission Control",
    portrait: "",
    text: "Mission loaded."
  };
}

export function ensureDialogueToolSettings(builderState) {
  if (!builderState) return null;
  if (!builderState.dialogueTool) builderState.dialogueTool = createDefaultDialogueTool();
  const tool = builderState.dialogueTool;
  tool.selectedKey = sanitizeDialogueKey(tool.selectedKey || "intro") || "intro";
  tool.blockKey = sanitizeDialogueKey(tool.blockKey || tool.selectedKey || "intro") || "intro";
  tool.blockName = String(tool.blockName ?? "").trim() || labelFromKey(tool.blockKey);
  tool.speakerId = sanitizeDialogueKey(tool.speakerId || "system") || "system";
  tool.speakerName = String(tool.speakerName ?? "").trim() || "Mission Control";
  tool.portrait = String(tool.portrait ?? "").trim();
  tool.text = String(tool.text ?? "");
  ensureMissionDialogue(builderState);
  return tool;
}

export function updateDialogueToolFromFields(builderState, root) {
  const tool = ensureDialogueToolSettings(builderState);
  if (!tool || !root) return tool;

  const previousSelectedKey = tool.selectedKey;
  tool.selectedKey = sanitizeDialogueKey(readField(root, "dialogue-selected-key", tool.selectedKey)) || tool.selectedKey || "intro";
  const dialogue = ensureMissionDialogue(builderState);
  if (tool.selectedKey !== previousSelectedKey && dialogue[tool.selectedKey]) {
    tool.blockKey = tool.selectedKey;
    tool.blockName = String(dialogue[tool.selectedKey]?.name ?? labelFromKey(tool.selectedKey));
  } else {
    tool.blockKey = sanitizeDialogueKey(readField(root, "dialogue-block-key", tool.blockKey)) || tool.blockKey || tool.selectedKey || "intro";
    tool.blockName = readField(root, "dialogue-block-name", tool.blockName).trim() || labelFromKey(tool.blockKey);
  }
  tool.speakerId = sanitizeDialogueKey(readField(root, "dialogue-speaker-id", tool.speakerId)) || "system";
  tool.speakerName = readField(root, "dialogue-speaker-name", tool.speakerName).trim() || "Mission Control";
  tool.portrait = readField(root, "dialogue-portrait", tool.portrait).trim();
  tool.text = readField(root, "dialogue-text", tool.text);
  return tool;
}

export function getDialogueBlocks(builderState) {
  const dialogue = ensureMissionDialogue(builderState);
  return Object.entries(dialogue).map(([key, block]) => ({
    key,
    name: String(block?.name ?? labelFromKey(key)),
    lines: Array.isArray(block?.lines) ? block.lines : []
  }));
}

export function selectDialogueBlock(builderState, key) {
  const tool = ensureDialogueToolSettings(builderState);
  const dialogue = ensureMissionDialogue(builderState);
  const cleanKey = sanitizeDialogueKey(key);
  if (!cleanKey || !dialogue[cleanKey]) return { ok: false, message: "Dialogue block selection is invalid." };

  tool.selectedKey = cleanKey;
  tool.blockKey = cleanKey;
  tool.blockName = String(dialogue[cleanKey]?.name ?? labelFromKey(cleanKey));
  return { ok: true, message: `Selected dialogue block ${cleanKey}.` };
}

export function addOrUpdateDialogueBlock(builderState) {
  const tool = ensureDialogueToolSettings(builderState);
  const dialogue = ensureMissionDialogue(builderState);
  if (!tool) return { ok: false, message: "No dialogue tool is active." };

  const key = sanitizeDialogueKey(tool.blockKey || tool.selectedKey);
  if (!key) return { ok: false, message: "Dialogue block key is missing." };

  dialogue[key] = {
    ...(dialogue[key] ?? {}),
    name: tool.blockName || labelFromKey(key),
    lines: Array.isArray(dialogue[key]?.lines) ? dialogue[key].lines : []
  };
  tool.selectedKey = key;
  tool.blockKey = key;
  builderState.dirty = true;
  return { ok: true, message: `Saved dialogue block ${key}.` };
}

export function removeDialogueBlock(builderState, key) {
  const tool = ensureDialogueToolSettings(builderState);
  const dialogue = ensureMissionDialogue(builderState);
  const cleanKey = sanitizeDialogueKey(key);
  if (!cleanKey || !dialogue[cleanKey]) return { ok: false, message: "Dialogue block was not found." };
  if (DEFAULT_BLOCKS.includes(cleanKey)) return { ok: false, message: `${cleanKey} is a core dialogue block and cannot be removed.` };

  delete dialogue[cleanKey];
  const nextKey = Object.keys(dialogue)[0] || "intro";
  tool.selectedKey = nextKey;
  tool.blockKey = nextKey;
  tool.blockName = dialogue[nextKey]?.name ?? labelFromKey(nextKey);
  builderState.dirty = true;
  return { ok: true, message: `Removed dialogue block ${cleanKey}.` };
}

export function addDialogueLine(builderState) {
  const tool = ensureDialogueToolSettings(builderState);
  const dialogue = ensureMissionDialogue(builderState);
  if (!tool) return { ok: false, message: "No dialogue tool is active." };

  const key = sanitizeDialogueKey(tool.selectedKey || tool.blockKey);
  const text = String(tool.text ?? "").trim();
  if (!key) return { ok: false, message: "Select or create a dialogue block first." };
  if (!text) return { ok: false, message: "Dialogue line text is empty." };

  if (!dialogue[key]) dialogue[key] = { name: labelFromKey(key), lines: [] };
  if (!Array.isArray(dialogue[key].lines)) dialogue[key].lines = [];

  const line = {
    speakerId: sanitizeDialogueKey(tool.speakerId) || "system",
    name: tool.speakerName || "Mission Control",
    text
  };
  if (tool.portrait) line.portrait = tool.portrait;

  dialogue[key].lines.push(line);
  builderState.dirty = true;
  return { ok: true, message: `Added dialogue line to ${key}.` };
}

export function removeDialogueLine(builderState, key, lineIndex) {
  const dialogue = ensureMissionDialogue(builderState);
  const cleanKey = sanitizeDialogueKey(key);
  const index = Number(lineIndex);
  const lines = Array.isArray(dialogue?.[cleanKey]?.lines) ? dialogue[cleanKey].lines : [];
  if (!cleanKey || !Number.isInteger(index) || index < 0 || index >= lines.length) {
    return { ok: false, message: "Dialogue line was not found." };
  }

  lines.splice(index, 1);
  dialogue[cleanKey].lines = lines;
  builderState.dirty = true;
  return { ok: true, message: `Removed dialogue line ${index + 1} from ${cleanKey}.` };
}

export function getDialogueBlockOptions(builderState) {
  return getDialogueBlocks(builderState).map((block) => ({
    id: block.key,
    label: block.name ? `${block.name} · ${block.key}` : block.key
  }));
}

export function ensureMissionDialogue(builderState) {
  const mission = builderState?.authoring?.mission;
  if (!mission) return {};
  if (!mission.dialogue || typeof mission.dialogue !== "object" || Array.isArray(mission.dialogue)) {
    mission.dialogue = {};
  }
  for (const key of DEFAULT_BLOCKS) {
    if (!mission.dialogue[key]) mission.dialogue[key] = { name: labelFromKey(key), lines: [] };
    if (!Array.isArray(mission.dialogue[key].lines)) mission.dialogue[key].lines = [];
  }
  return mission.dialogue;
}

function readField(root, fieldName, fallback = "") {
  const el = root.querySelector(`[data-builder-field="${fieldName}"]`);
  if (!el) return fallback;
  return el.value ?? fallback;
}

export function sanitizeDialogueKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function labelFromKey(key) {
  return String(key ?? "dialogue")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
