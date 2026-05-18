// src/builder/builderTriggers.js
//
// Mission Builder Triggers V1.
// Preset-first trigger authoring. V1 supports simple repeated tile-trigger effects.

import { getTile } from "../map.js";

const TRIGGER_PRESETS = [
  { value: "load_map", label: "Load Map / Next Map" },
  { value: "change_unit_stat", label: "Change Unit Stat" },
  { value: "complete_objective", label: "Complete Objective" },
  { value: "end_mission", label: "End Mission" },
  { value: "start_dialogue", label: "Start Dialogue" },
  { value: "run_logic", label: "Run Logic Chain" }
];

const TRIGGER_TYPES = [
  { value: "onUnitEnterZone", label: "Unit Enters Zone" },
  { value: "onMissionStart", label: "Mission Start" },
  { value: "onRoundStart", label: "Round Start" },
  { value: "onRoundEnd", label: "Round End" },
  { value: "onEnterMech", label: "Enter Mech" },
  { value: "onExitMech", label: "Exit Mech" },
  { value: "onInteract", label: "Interact / Action Button" },
  { value: "onUnitInteract", label: "Unit Interact" },
  { value: "onHitTarget", label: "Hit Target" },
  { value: "onStatChange", label: "Stat Changed" }
];

const TEAM_FILTERS = ["player", "enemy", "any"];
const STAT_FIELDS = ["core", "shield"];
const MISSION_RESULTS = ["victory", "defeat"];
const PRESET_SET = new Set(TRIGGER_PRESETS.map((entry) => entry.value));
const TYPE_SET = new Set(TRIGGER_TYPES.map((entry) => entry.value));

function createDefaultTriggerTool() {
  return {
    id: "",
    name: "Hangar Exit",
    preset: "load_map",
    type: "onUnitEnterZone",
    team: "player",
    once: true,
    nextMapId: "",
    completeObjectiveId: "",
    logicChainId: "",
    stat: "core",
    value: -1,
    missionResult: "victory",
    dialogueKey: "intro",
    targetUnitId: "",
    interactionRange: 1,
    selectedIndex: -1,
    paintMode: "add"
  };
}

export function ensureTriggerToolSettings(builderState) {
  if (!builderState) return null;
  if (!builderState.triggerTool) builderState.triggerTool = createDefaultTriggerTool();

  const tool = builderState.triggerTool;
  tool.id = sanitizeId(tool.id ?? "");
  tool.name = String(tool.name ?? "").trim() || "Trigger";
  if (!PRESET_SET.has(tool.preset)) tool.preset = "load_map";
  if (!TYPE_SET.has(tool.type)) tool.type = "onUnitEnterZone";
  if (!TEAM_FILTERS.includes(tool.team)) tool.team = "player";
  tool.once = tool.once !== false;
  tool.nextMapId = sanitizeId(tool.nextMapId ?? "");
  tool.completeObjectiveId = sanitizeId(tool.completeObjectiveId ?? "");
  tool.logicChainId = sanitizeId(tool.logicChainId ?? "");
  if (!STAT_FIELDS.includes(tool.stat)) tool.stat = "core";
  tool.value = normalizeInteger(tool.value, -1);
  if (!MISSION_RESULTS.includes(tool.missionResult)) tool.missionResult = "victory";
  tool.dialogueKey = sanitizeId(tool.dialogueKey ?? "intro") || "intro";
  tool.targetUnitId = sanitizeLooseId(tool.targetUnitId ?? "");
  tool.interactionRange = Math.max(1, normalizeInteger(tool.interactionRange, 1));
  if (!Number.isInteger(Number(tool.selectedIndex))) tool.selectedIndex = -1;
  if (tool.paintMode !== "erase") tool.paintMode = "add";

  return tool;
}

export function updateTriggerToolFromFields(builderState, root) {
  const tool = ensureTriggerToolSettings(builderState);
  if (!tool || !root) return tool;

  tool.id = sanitizeId(readField(root, "trigger-id", tool.id));
  tool.name = readField(root, "trigger-name", tool.name).trim() || "Trigger";

  const preset = readField(root, "trigger-preset", tool.preset);
  tool.preset = PRESET_SET.has(preset) ? preset : "load_map";

  const type = readField(root, "trigger-type", tool.type);
  tool.type = TYPE_SET.has(type) ? type : "onUnitEnterZone";

  const team = readField(root, "trigger-team", tool.team);
  tool.team = TEAM_FILTERS.includes(team) ? team : "player";
  tool.once = readCheckbox(root, "trigger-once", tool.once !== false);
  tool.nextMapId = sanitizeId(readField(root, "trigger-next-map-id", tool.nextMapId));
  tool.completeObjectiveId = sanitizeId(readField(root, "trigger-complete-objective-id", tool.completeObjectiveId));
  tool.logicChainId = sanitizeId(readField(root, "trigger-logic-chain-id", tool.logicChainId));

  const stat = readField(root, "trigger-stat", tool.stat);
  tool.stat = STAT_FIELDS.includes(stat) ? stat : "core";
  tool.value = normalizeInteger(readField(root, "trigger-value", tool.value), tool.value);

  const missionResult = readField(root, "trigger-mission-result", tool.missionResult);
  tool.missionResult = MISSION_RESULTS.includes(missionResult) ? missionResult : "victory";
  tool.dialogueKey = sanitizeId(readField(root, "trigger-dialogue-key", tool.dialogueKey)) || "intro";
  tool.targetUnitId = sanitizeLooseId(readField(root, "trigger-target-unit-id", tool.targetUnitId));
  tool.interactionRange = Math.max(1, normalizeInteger(readField(root, "trigger-interaction-range", tool.interactionRange), tool.interactionRange));

  return tool;
}

export function getTriggerPresetOptions() {
  return TRIGGER_PRESETS.map((entry) => ({ ...entry }));
}

export function getTriggerTypeOptions() {
  return TRIGGER_TYPES.map((entry) => ({ ...entry }));
}

export function getTriggerTeamOptions() {
  return [...TEAM_FILTERS];
}

export function getTriggerStatOptions() {
  return [...STAT_FIELDS];
}

export function getTriggerMissionResultOptions() {
  return [...MISSION_RESULTS];
}

export function getTriggerDefinitions(builderState) {
  const map = ensureMapDraft(builderState);
  return Array.isArray(map?.triggers) ? map.triggers : [];
}

export function addTriggerDefinition(builderState) {
  const tool = ensureTriggerToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  if (!tool || !map) return { ok: false, message: "No builder map is active." };

  const triggers = Array.isArray(map.triggers) ? map.triggers : [];
  const baseId = sanitizeId(tool.id) || createTriggerId(tool.preset, triggers);
  const trigger = buildTriggerFromTool(tool, createUniqueTriggerId(baseId, triggers));

  map.triggers = [...triggers, trigger];
  tool.selectedIndex = map.triggers.length - 1;
  builderState.dirty = true;

  return { ok: true, message: `Added trigger ${trigger.id}.` };
}

export function updateSelectedTriggerDefinition(builderState) {
  const tool = ensureTriggerToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  const triggers = Array.isArray(map?.triggers) ? map.triggers : [];
  const index = Number(tool?.selectedIndex ?? -1);
  if (!Number.isInteger(index) || index < 0 || index >= triggers.length) {
    return { ok: false, message: "No trigger selected to update." };
  }

  const existing = triggers[index] ?? {};
  const baseId = sanitizeId(tool.id) || existing.id || createTriggerId(tool.preset, triggers);
  const otherTriggers = triggers.filter((_, otherIndex) => otherIndex !== index);
  const updated = {
    ...buildTriggerFromTool(tool, createUniqueTriggerId(baseId, otherTriggers)),
    tiles: normalizeTiles(existing.tiles)
  };

  triggers[index] = updated;
  map.triggers = triggers;
  builderState.dirty = true;

  return { ok: true, message: `Updated trigger ${updated.id}.` };
}

export function selectTriggerDefinition(builderState, index) {
  const tool = ensureTriggerToolSettings(builderState);
  const triggers = getTriggerDefinitions(builderState);
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= triggers.length) {
    return { ok: false, message: "Trigger selection is out of range." };
  }

  const trigger = triggers[cleanIndex] ?? {};
  tool.selectedIndex = cleanIndex;
  tool.id = trigger.id ?? "";
  tool.name = trigger.name ?? trigger.id ?? "Trigger";
  tool.preset = trigger.preset ?? "load_map";
  tool.type = trigger.type ?? "onUnitEnterZone";
  tool.team = trigger.team ?? "player";
  tool.once = trigger.once !== false;
  tool.nextMapId = trigger.nextMapId ?? "";
  tool.completeObjectiveId = trigger.completeObjectiveId ?? "";
  tool.logicChainId = trigger.logicChainId ?? "";
  tool.stat = trigger.stat ?? "core";
  tool.value = normalizeInteger(trigger.value, -1);
  tool.missionResult = trigger.missionResult ?? "victory";
  tool.dialogueKey = trigger.dialogueKey ?? "intro";
  tool.targetUnitId = trigger.targetUnitId ?? "";
  tool.interactionRange = normalizeInteger(trigger.interactionRange, 1);

  ensureTriggerToolSettings(builderState);
  return { ok: true, message: `Selected trigger ${trigger.id ?? cleanIndex + 1}.` };
}

export function removeTriggerDefinition(builderState, index) {
  const map = ensureMapDraft(builderState);
  const triggers = Array.isArray(map?.triggers) ? map.triggers : [];
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= triggers.length) {
    return { ok: false, message: "No trigger removed; index was invalid." };
  }

  const [removed] = triggers.splice(cleanIndex, 1);
  map.triggers = triggers;

  const tool = ensureTriggerToolSettings(builderState);
  tool.selectedIndex = triggers.length ? Math.min(cleanIndex, triggers.length - 1) : -1;
  builderState.dirty = true;

  return { ok: true, message: `Removed trigger ${removed?.id ?? cleanIndex + 1}.` };
}

export function setTriggerPaintMode(builderState, mode) {
  const tool = ensureTriggerToolSettings(builderState);
  tool.paintMode = mode === "erase" ? "erase" : "add";
  return tool;
}

export function triggerTypeNeedsZone(type) {
  const cleanType = String(type ?? "onUnitEnterZone");
  return cleanType === "onUnitEnterZone" || cleanType === "onInteract";
}

export function triggerTypeNeedsTargetUnit(type) {
  return String(type ?? "") === "onUnitInteract";
}

export function getTriggerTargetUnitOptions(builderState) {
  const deployments = Array.isArray(builderState?.authoring?.map?.startState?.deployments)
    ? builderState.authoring.map.startState.deployments
    : [];

  return deployments
    .map((entry, index) => {
      const id = sanitizeLooseId(entry?.pilotInstanceId ?? entry?.mechInstanceId ?? "");
      if (!id) return null;
      const definitionId = entry?.pilotDefinitionId ?? entry?.mechDefinitionId ?? "unit";
      const label = `${id} (${definitionId})`;
      return { id, label, index };
    })
    .filter(Boolean);
}

export function isTriggerAuthoringActive(builderState) {
  const type = builderState?.triggerTool?.type ?? "onUnitEnterZone";
  return builderState?.workspaceMode === "builder-map" && builderState?.activeTab === "triggers" && triggerTypeNeedsZone(type);
}

export function applyTriggerToolAtTile(builderState, appState, x, y) {
  const tool = ensureTriggerToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  const triggers = Array.isArray(map?.triggers) ? map.triggers : [];
  const index = Number(tool?.selectedIndex ?? -1);

  if (!Number.isInteger(index) || index < 0 || index >= triggers.length) {
    return { ok: false, message: "Select or add a trigger before painting trigger tiles." };
  }

  const activeMap = appState?.map ?? map;
  const tx = Number(x);
  const ty = Number(y);
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || !getTile(activeMap, tx, ty)) {
    return { ok: false, message: "Trigger zone tile is outside the map." };
  }

  const trigger = triggers[index];
  const tiles = normalizeTiles(trigger.tiles);
  const key = `${tx},${ty}`;
  const exists = tiles.some((tile) => `${tile.x},${tile.y}` === key);

  if (tool.paintMode === "erase") {
    trigger.tiles = tiles.filter((tile) => `${tile.x},${tile.y}` !== key);
    builderState.dirty = true;
    return { ok: true, message: `Removed ${tx}, ${ty} from trigger ${trigger.id}.` };
  }

  trigger.tiles = exists ? tiles : [...tiles, { x: tx, y: ty }];
  builderState.dirty = true;
  return { ok: true, message: exists ? `${tx}, ${ty} is already in trigger ${trigger.id}.` : `Added ${tx}, ${ty} to trigger ${trigger.id}.` };
}

export function getTriggerZoneCells(mapOrBuilderState) {
  const map = mapOrBuilderState?.authoring?.map ?? mapOrBuilderState?.map ?? mapOrBuilderState ?? null;
  const triggers = Array.isArray(map?.triggers) ? map.triggers : [];
  const cells = [];

  for (const trigger of triggers) {
    if (!triggerTypeNeedsZone(trigger?.type)) continue;
    for (const tile of normalizeTiles(trigger.tiles)) {
      cells.push({
        x: tile.x,
        y: tile.y,
        triggerId: trigger.id ?? "trigger",
        preset: trigger.preset ?? "trigger",
        team: trigger.team ?? "player"
      });
    }
  }

  return cells;
}

function ensureMapDraft(builderState) {
  if (!builderState?.authoring?.map) return null;
  const map = builderState.authoring.map;
  if (!Array.isArray(map.triggers)) map.triggers = [];
  return map;
}

function buildTriggerFromTool(tool, id) {
  const trigger = {
    id,
    name: tool.name || id,
    preset: tool.preset || "load_map",
    type: tool.type || "onUnitEnterZone",
    team: tool.team || "player",
    once: tool.once !== false,
    tiles: []
  };

  if (trigger.preset === "load_map") {
    trigger.nextMapId = tool.nextMapId || "";
    if (tool.completeObjectiveId) trigger.completeObjectiveId = tool.completeObjectiveId;
  }

  if (trigger.preset === "change_unit_stat") {
    trigger.stat = STAT_FIELDS.includes(tool.stat) ? tool.stat : "core";
    trigger.value = normalizeInteger(tool.value, -1);
  }

  if (trigger.preset === "complete_objective") {
    trigger.completeObjectiveId = tool.completeObjectiveId || "";
  }

  if (trigger.preset === "end_mission") {
    trigger.missionResult = MISSION_RESULTS.includes(tool.missionResult) ? tool.missionResult : "victory";
  }

  if (trigger.preset === "start_dialogue") {
    trigger.dialogueKey = tool.dialogueKey || "intro";
  }

  if (trigger.preset === "run_logic") {
    trigger.logicChainId = tool.logicChainId || "";
  }

  if (trigger.type === "onUnitInteract") {
    trigger.targetUnitId = tool.targetUnitId || "";
    trigger.interactionRange = Math.max(1, normalizeInteger(tool.interactionRange, 1));
  }

  return trigger;
}

function createTriggerId(preset, triggers) {
  const base = sanitizeId(preset) || "trigger";
  return createUniqueTriggerId(base, triggers);
}

function createUniqueTriggerId(baseId, triggers) {
  const base = sanitizeId(baseId) || "trigger";
  const used = new Set((Array.isArray(triggers) ? triggers : []).map((trigger) => trigger?.id).filter(Boolean));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function normalizeTiles(tiles) {
  if (!Array.isArray(tiles)) return [];
  const seen = new Set();
  const clean = [];
  for (const tile of tiles) {
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

function readField(root, fieldName, fallback = "") {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? String(node.value ?? "") : String(fallback ?? "");
}

function readCheckbox(root, fieldName, fallback = true) {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? Boolean(node.checked) : Boolean(fallback);
}

function normalizeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number(fallback) || 0;
  return Math.trunc(number);
}

function sanitizeLooseId(value) {
  return String(value ?? "").trim();
}

function sanitizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
