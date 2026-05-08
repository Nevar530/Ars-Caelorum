// src/builder/builderLogic.js
//
// Mission Builder Logic V1.
// Small chain builder: optional condition + ordered actions.
// Triggers remain the WHEN. Logic chains are the multi-tool WHAT.

const CONDITION_TYPES = [
  { value: "none", label: "No Condition" },
  { value: "objective_complete", label: "Objective Complete" },
  { value: "objective_incomplete", label: "Objective Incomplete" },
  { value: "flag_true", label: "Flag True" },
  { value: "flag_false", label: "Flag False" },
  { value: "round_at_least", label: "Round At Least" }
];

const ACTION_TYPES = [
  { value: "complete_objective", label: "Complete Objective" },
  { value: "change_unit_stat", label: "Change Unit Stat" },
  { value: "load_map", label: "Load Map / Next Map" },
  { value: "end_mission", label: "End Mission" },
  { value: "start_dialogue", label: "Start Dialogue" },
  { value: "set_flag", label: "Set Flag" },
  { value: "give_item", label: "Give Item" },
  { value: "remove_item", label: "Remove Item" }
];

const CONDITION_SET = new Set(CONDITION_TYPES.map((entry) => entry.value));
const ACTION_SET = new Set(ACTION_TYPES.map((entry) => entry.value));
const STAT_FIELDS = ["core", "shield"];
const MISSION_RESULTS = ["victory", "defeat"];

function createDefaultLogicTool() {
  return {
    id: "",
    name: "Logic Chain",
    selectedIndex: -1,
    conditionType: "none",
    conditionObjectiveId: "",
    conditionFlagId: "",
    conditionRound: 1,
    actionType: "complete_objective",
    actionObjectiveId: "",
    actionNextMapId: "",
    actionStat: "core",
    actionValue: -1,
    actionMissionResult: "victory",
    actionDialogueKey: "intro",
    actionFlagId: "",
    actionFlagValue: true,
    actionItemId: ""
  };
}

export function ensureLogicToolSettings(builderState) {
  if (!builderState) return null;
  if (!builderState.logicTool) builderState.logicTool = createDefaultLogicTool();

  const tool = builderState.logicTool;
  tool.id = sanitizeId(tool.id ?? "");
  tool.name = String(tool.name ?? "").trim() || "Logic Chain";
  if (!Number.isInteger(Number(tool.selectedIndex))) tool.selectedIndex = -1;
  if (!CONDITION_SET.has(tool.conditionType)) tool.conditionType = "none";
  tool.conditionObjectiveId = sanitizeId(tool.conditionObjectiveId ?? "");
  tool.conditionFlagId = sanitizeId(tool.conditionFlagId ?? "");
  tool.conditionRound = Math.max(1, normalizeInteger(tool.conditionRound, 1));
  if (!ACTION_SET.has(tool.actionType)) tool.actionType = "complete_objective";
  tool.actionObjectiveId = sanitizeId(tool.actionObjectiveId ?? "");
  tool.actionNextMapId = sanitizeId(tool.actionNextMapId ?? "");
  if (!STAT_FIELDS.includes(tool.actionStat)) tool.actionStat = "core";
  tool.actionValue = normalizeInteger(tool.actionValue, -1);
  if (!MISSION_RESULTS.includes(tool.actionMissionResult)) tool.actionMissionResult = "victory";
  tool.actionDialogueKey = sanitizeId(tool.actionDialogueKey ?? "intro") || "intro";
  tool.actionFlagId = sanitizeId(tool.actionFlagId ?? "");
  tool.actionFlagValue = tool.actionFlagValue !== false;
  tool.actionItemId = sanitizeId(tool.actionItemId ?? "");

  return tool;
}

export function updateLogicToolFromFields(builderState, root) {
  const tool = ensureLogicToolSettings(builderState);
  if (!tool || !root) return tool;

  tool.id = sanitizeId(readField(root, "logic-id", tool.id));
  tool.name = readField(root, "logic-name", tool.name).trim() || "Logic Chain";

  const conditionType = readField(root, "logic-condition-type", tool.conditionType);
  tool.conditionType = CONDITION_SET.has(conditionType) ? conditionType : "none";
  tool.conditionObjectiveId = sanitizeId(readField(root, "logic-condition-objective-id", tool.conditionObjectiveId));
  tool.conditionFlagId = sanitizeId(readField(root, "logic-condition-flag-id", tool.conditionFlagId));
  tool.conditionRound = Math.max(1, normalizeInteger(readField(root, "logic-condition-round", tool.conditionRound), tool.conditionRound));

  const actionType = readField(root, "logic-action-type", tool.actionType);
  tool.actionType = ACTION_SET.has(actionType) ? actionType : "complete_objective";
  tool.actionObjectiveId = sanitizeId(readField(root, "logic-action-objective-id", tool.actionObjectiveId));
  tool.actionNextMapId = sanitizeId(readField(root, "logic-action-next-map-id", tool.actionNextMapId));
  const stat = readField(root, "logic-action-stat", tool.actionStat);
  tool.actionStat = STAT_FIELDS.includes(stat) ? stat : "core";
  tool.actionValue = normalizeInteger(readField(root, "logic-action-value", tool.actionValue), tool.actionValue);
  const missionResult = readField(root, "logic-action-mission-result", tool.actionMissionResult);
  tool.actionMissionResult = MISSION_RESULTS.includes(missionResult) ? missionResult : "victory";
  tool.actionDialogueKey = sanitizeId(readField(root, "logic-action-dialogue-key", tool.actionDialogueKey)) || "intro";
  tool.actionFlagId = sanitizeId(readField(root, "logic-action-flag-id", tool.actionFlagId));
  tool.actionFlagValue = readField(root, "logic-action-flag-value", tool.actionFlagValue ? "true" : "false") !== "false";
  tool.actionItemId = sanitizeId(readField(root, "logic-action-item-id", tool.actionItemId));

  return tool;
}

export function getLogicConditionOptions() {
  return CONDITION_TYPES.map((entry) => ({ ...entry }));
}

export function getLogicActionOptions() {
  return ACTION_TYPES.map((entry) => ({ ...entry }));
}

export function getLogicStatOptions() {
  return [...STAT_FIELDS];
}

export function getLogicMissionResultOptions() {
  return [...MISSION_RESULTS];
}

export function getLogicDefinitions(builderState) {
  const map = ensureMapDraft(builderState);
  return Array.isArray(map?.logic) ? map.logic : [];
}

export function addLogicDefinition(builderState) {
  const tool = ensureLogicToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  if (!tool || !map) return { ok: false, message: "No builder map is active." };

  const logic = Array.isArray(map.logic) ? map.logic : [];
  const baseId = sanitizeId(tool.id) || createUniqueLogicId("logic_chain", logic);
  const chain = {
    id: createUniqueLogicId(baseId, logic),
    name: tool.name || baseId,
    conditions: buildConditionsFromTool(tool),
    actions: []
  };

  map.logic = [...logic, chain];
  tool.selectedIndex = map.logic.length - 1;
  builderState.dirty = true;
  return { ok: true, message: `Added logic chain ${chain.id}.` };
}

export function updateSelectedLogicDefinition(builderState) {
  const tool = ensureLogicToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  const logic = Array.isArray(map?.logic) ? map.logic : [];
  const index = Number(tool?.selectedIndex ?? -1);
  if (!Number.isInteger(index) || index < 0 || index >= logic.length) {
    return { ok: false, message: "No logic chain selected to update." };
  }

  const existing = logic[index] ?? {};
  const otherChains = logic.filter((_, otherIndex) => otherIndex !== index);
  const baseId = sanitizeId(tool.id) || existing.id || "logic_chain";
  const id = createUniqueLogicId(baseId, otherChains);
  logic[index] = {
    ...existing,
    id,
    name: tool.name || id,
    conditions: buildConditionsFromTool(tool),
    actions: Array.isArray(existing.actions) ? existing.actions : []
  };
  map.logic = logic;
  builderState.dirty = true;
  return { ok: true, message: `Updated logic chain ${id}.` };
}

export function selectLogicDefinition(builderState, index) {
  const tool = ensureLogicToolSettings(builderState);
  const logic = getLogicDefinitions(builderState);
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= logic.length) {
    return { ok: false, message: "Logic selection is out of range." };
  }

  const chain = logic[cleanIndex] ?? {};
  const condition = Array.isArray(chain.conditions) && chain.conditions.length ? chain.conditions[0] : { type: "none" };
  tool.selectedIndex = cleanIndex;
  tool.id = chain.id ?? "";
  tool.name = chain.name ?? chain.id ?? "Logic Chain";
  tool.conditionType = condition.type ?? "none";
  tool.conditionObjectiveId = condition.objectiveId ?? "";
  tool.conditionFlagId = condition.flagId ?? "";
  tool.conditionRound = normalizeInteger(condition.round ?? 1, 1);
  ensureLogicToolSettings(builderState);
  return { ok: true, message: `Selected logic chain ${chain.id ?? cleanIndex + 1}.` };
}

export function removeLogicDefinition(builderState, index) {
  const map = ensureMapDraft(builderState);
  const logic = Array.isArray(map?.logic) ? map.logic : [];
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= logic.length) {
    return { ok: false, message: "No logic chain removed; index was invalid." };
  }

  const [removed] = logic.splice(cleanIndex, 1);
  map.logic = logic;
  const tool = ensureLogicToolSettings(builderState);
  tool.selectedIndex = logic.length ? Math.min(cleanIndex, logic.length - 1) : -1;
  builderState.dirty = true;
  return { ok: true, message: `Removed logic chain ${removed?.id ?? cleanIndex + 1}.` };
}

export function addLogicAction(builderState) {
  const tool = ensureLogicToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  const logic = Array.isArray(map?.logic) ? map.logic : [];
  const index = Number(tool?.selectedIndex ?? -1);
  if (!Number.isInteger(index) || index < 0 || index >= logic.length) {
    return { ok: false, message: "Select or add a logic chain before adding actions." };
  }

  const action = buildActionFromTool(tool);
  logic[index].actions = [...(Array.isArray(logic[index].actions) ? logic[index].actions : []), action];
  builderState.dirty = true;
  return { ok: true, message: `Added ${action.type} action to ${logic[index].id}.` };
}

export function removeLogicAction(builderState, chainIndex, actionIndex) {
  const map = ensureMapDraft(builderState);
  const logic = Array.isArray(map?.logic) ? map.logic : [];
  const cleanChainIndex = Number(chainIndex);
  const cleanActionIndex = Number(actionIndex);
  const chain = logic[cleanChainIndex];
  const actions = Array.isArray(chain?.actions) ? chain.actions : [];
  if (!chain || !Number.isInteger(cleanActionIndex) || cleanActionIndex < 0 || cleanActionIndex >= actions.length) {
    return { ok: false, message: "No logic action removed; index was invalid." };
  }

  const [removed] = actions.splice(cleanActionIndex, 1);
  chain.actions = actions;
  builderState.dirty = true;
  return { ok: true, message: `Removed ${removed?.type ?? "logic"} action from ${chain.id}.` };
}

function buildConditionsFromTool(tool) {
  if (!tool || tool.conditionType === "none") return [];
  if (tool.conditionType === "objective_complete" || tool.conditionType === "objective_incomplete") {
    return [{ type: tool.conditionType, objectiveId: sanitizeId(tool.conditionObjectiveId) }];
  }
  if (tool.conditionType === "flag_true" || tool.conditionType === "flag_false") {
    return [{ type: tool.conditionType, flagId: sanitizeId(tool.conditionFlagId) }];
  }
  if (tool.conditionType === "round_at_least") {
    return [{ type: "round_at_least", round: Math.max(1, normalizeInteger(tool.conditionRound, 1)) }];
  }
  return [];
}

function buildActionFromTool(tool) {
  const type = ACTION_SET.has(tool?.actionType) ? tool.actionType : "complete_objective";
  if (type === "complete_objective") return { type, objectiveId: sanitizeId(tool.actionObjectiveId) };
  if (type === "change_unit_stat") return { type, target: "triggering_unit", stat: STAT_FIELDS.includes(tool.actionStat) ? tool.actionStat : "core", value: normalizeInteger(tool.actionValue, -1) };
  if (type === "load_map") return { type, nextMapId: sanitizeId(tool.actionNextMapId) };
  if (type === "end_mission") return { type, missionResult: MISSION_RESULTS.includes(tool.actionMissionResult) ? tool.actionMissionResult : "victory" };
  if (type === "start_dialogue") return { type, dialogueKey: sanitizeId(tool.actionDialogueKey) || "intro" };
  if (type === "set_flag") return { type, flagId: sanitizeId(tool.actionFlagId), value: tool.actionFlagValue !== false };
  if (type === "give_item" || type === "remove_item") return { type, target: "triggering_unit", itemId: sanitizeId(tool.actionItemId) };
  return { type: "complete_objective", objectiveId: sanitizeId(tool.actionObjectiveId) };
}

function ensureMapDraft(builderState) {
  if (!builderState?.authoring?.map) return null;
  const map = builderState.authoring.map;
  if (!Array.isArray(map.logic)) map.logic = [];
  return map;
}

function createUniqueLogicId(baseId, logic) {
  const base = sanitizeId(baseId) || "logic_chain";
  const used = new Set((Array.isArray(logic) ? logic : []).map((chain) => chain?.id).filter(Boolean));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function readField(root, fieldName, fallback = "") {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? String(node.value ?? "") : String(fallback ?? "");
}

function normalizeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number(fallback) || 0;
  return Math.trunc(number);
}

function sanitizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
