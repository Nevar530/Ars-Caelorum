// src/builder/builderObjectives.js
//
// Mission Builder Objectives V1.
// Keeps objective authoring lean and data-first. Runtime mission logic can grow later,
// but the builder now writes real mission objective definitions instead of relying on
// export-time placeholders.

import { getMapHeight, getMapWidth, getTile } from "../map.js";

const OBJECTIVE_TYPES = [
  { value: "defeat_all", label: "Defeat All Enemies", needsZone: false },
  { value: "reach_zone", label: "Reach Zone", needsZone: true },
  { value: "hold_zone", label: "Hold Zone for Rounds", needsZone: true },
  { value: "survive_rounds", label: "Survive Rounds", needsZone: false },
  { value: "trigger_complete", label: "Trigger Event", needsZone: false },
  { value: "protect_unit", label: "Protect Unit / Fail if Down", needsZone: false }
];

const OBJECTIVE_TYPE_SET = new Set(OBJECTIVE_TYPES.map((entry) => entry.value));

function createDefaultObjectiveTool() {
  return {
    type: "defeat_all",
    id: "",
    label: getDefaultObjectiveLabel("defeat_all", "enemy", 3),
    briefingText: getDefaultObjectiveBriefingText("defeat_all", "enemy", 3),
    team: "player",
    targetTeam: "enemy",
    targetUnitId: "",
    roundsRequired: 3,
    selectedIndex: -1,
    paintMode: "add"
  };
}

export function ensureObjectiveToolSettings(builderState) {
  if (!builderState) return null;

  if (!builderState.objectiveTool) {
    builderState.objectiveTool = createDefaultObjectiveTool();
  }

  const tool = builderState.objectiveTool;
  if (!OBJECTIVE_TYPE_SET.has(tool.type)) tool.type = "defeat_all";
  if (!tool.id) tool.id = "";
  if (!tool.label) tool.label = getDefaultObjectiveLabel(tool.type, tool.targetTeam, tool.roundsRequired);
  if (!tool.briefingText) tool.briefingText = getDefaultObjectiveBriefingText(tool.type, tool.targetTeam, tool.roundsRequired);
  if (!tool.team) tool.team = "player";
  if (!tool.targetTeam) tool.targetTeam = "enemy";
  tool.targetUnitId = String(tool.targetUnitId ?? "").trim();
  if (!Number.isInteger(Number(tool.roundsRequired)) || Number(tool.roundsRequired) < 1) tool.roundsRequired = 3;
  if (tool.paintMode !== "erase") tool.paintMode = "add";
  if (!Number.isInteger(Number(tool.selectedIndex))) tool.selectedIndex = -1;

  return tool;
}

export function updateObjectiveToolFromFields(builderState, root, options = {}) {
  const tool = ensureObjectiveToolSettings(builderState);
  if (!tool || !root) return tool;

  const previous = {
    type: tool.type ?? "defeat_all",
    targetTeam: tool.targetTeam ?? "enemy",
    team: tool.team ?? "player",
    targetUnitId: tool.targetUnitId ?? "",
    roundsRequired: Math.max(1, Math.floor(Number(tool.roundsRequired ?? 3) || 3)),
    label: tool.label ?? "",
    briefingText: tool.briefingText ?? ""
  };

  const changedField = options?.changedField ?? null;
  const incomingType = readField(root, "objective-type", tool.type);
  tool.type = OBJECTIVE_TYPE_SET.has(incomingType) ? incomingType : "defeat_all";
  tool.id = sanitizeId(readField(root, "objective-id", tool.id));
  tool.team = readField(root, "objective-team", tool.team).trim() || "player";
  tool.targetTeam = readField(root, "objective-target-team", tool.targetTeam).trim() || "enemy";
  tool.targetUnitId = readField(root, "objective-target-unit-id", tool.targetUnitId).trim();
  tool.roundsRequired = Math.max(1, Math.floor(Number(readField(root, "objective-rounds", tool.roundsRequired)) || 1));

  const incomingLabel = readField(root, "objective-label", tool.label).trim();
  const incomingBriefing = readField(root, "objective-briefing-text", tool.briefingText).trim();
  const previousDefaults = getObjectiveDefaults(previous.type, previous.targetTeam, previous.roundsRequired);
  const nextDefaults = getObjectiveDefaults(tool.type, tool.targetTeam, tool.roundsRequired);

  const defaultDrivingFieldChanged = [
    "objective-type",
    "objective-target-team",
    "objective-rounds",
    "objective-target-unit-id"
  ].includes(changedField);

  const labelWasDefault = !incomingLabel || incomingLabel === previousDefaults.label;
  const briefingWasDefault = !incomingBriefing || incomingBriefing === previousDefaults.briefingText;

  tool.label = defaultDrivingFieldChanged && labelWasDefault
    ? nextDefaults.label
    : incomingLabel || nextDefaults.label;

  tool.briefingText = defaultDrivingFieldChanged && briefingWasDefault
    ? nextDefaults.briefingText
    : incomingBriefing || nextDefaults.briefingText;

  return tool;
}

export function getObjectiveTypeOptions() {
  return OBJECTIVE_TYPES.map((entry) => ({ ...entry }));
}

export function objectiveTypeNeedsZone(type) {
  return OBJECTIVE_TYPES.find((entry) => entry.value === type)?.needsZone === true;
}

export function getObjectiveDefinitions(builderState) {
  const mission = ensureMissionDraft(builderState);
  return Array.isArray(mission.objectives) ? mission.objectives : [];
}

export function addObjectiveDefinition(builderState) {
  const tool = ensureObjectiveToolSettings(builderState);
  const mission = ensureMissionDraft(builderState);
  if (!tool || !mission) return { ok: false, message: "No builder mission draft is active." };

  const objectives = Array.isArray(mission.objectives) ? mission.objectives : [];
  const baseId = sanitizeId(tool.id) || createObjectiveId(tool.type, objectives);
  const objective = buildObjectiveFromTool(tool, createUniqueObjectiveId(baseId, objectives));

  mission.objectives = [...objectives, objective];
  mission.briefing = mission.briefing ?? {};
  mission.briefing.objectives = buildBriefingObjectiveLines(mission.objectives);
  tool.selectedIndex = mission.objectives.length - 1;
  builderState.dirty = true;

  return { ok: true, message: `Added objective ${objective.id}.` };
}

export function updateSelectedObjectiveDefinition(builderState) {
  const tool = ensureObjectiveToolSettings(builderState);
  const mission = ensureMissionDraft(builderState);
  const objectives = Array.isArray(mission?.objectives) ? mission.objectives : [];
  const index = Number(tool?.selectedIndex ?? -1);
  if (!Number.isInteger(index) || index < 0 || index >= objectives.length) {
    return { ok: false, message: "No objective selected to update." };
  }

  const existing = objectives[index] ?? {};
  const baseId = sanitizeId(tool.id) || existing.id || createObjectiveId(tool.type, objectives);
  const otherObjectives = objectives.filter((_, otherIndex) => otherIndex !== index);
  const updated = {
    ...buildObjectiveFromTool(tool, createUniqueObjectiveId(baseId, otherObjectives)),
    tiles: objectiveTypeNeedsZone(tool.type) ? normalizeTiles(existing.tiles) : undefined
  };

  if (!objectiveTypeNeedsZone(tool.type)) delete updated.tiles;

  objectives[index] = updated;
  mission.objectives = objectives;
  mission.briefing = mission.briefing ?? {};
  mission.briefing.objectives = buildBriefingObjectiveLines(mission.objectives);
  builderState.dirty = true;

  return { ok: true, message: `Updated objective ${updated.id}.` };
}

export function selectObjectiveDefinition(builderState, index) {
  const tool = ensureObjectiveToolSettings(builderState);
  const objectives = getObjectiveDefinitions(builderState);
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= objectives.length) {
    return { ok: false, message: "Objective selection is out of range." };
  }

  const objective = objectives[cleanIndex] ?? {};
  tool.selectedIndex = cleanIndex;
  tool.type = objective.type ?? "defeat_all";
  tool.id = objective.id ?? "";
  tool.label = objective.label ?? getDefaultObjectiveLabel(tool.type, objective.targetTeam);
  tool.briefingText = objective.briefingText ?? objective.label ?? tool.label;
  tool.team = objective.team ?? "player";
  tool.targetTeam = objective.targetTeam ?? "enemy";
  tool.targetUnitId = objective.targetUnitId ?? objective.unitId ?? objective.targetPilotInstanceId ?? "";
  tool.roundsRequired = objective.roundsRequired ?? objective.rounds ?? 3;

  return { ok: true, message: `Selected objective ${objective.id ?? cleanIndex + 1}.` };
}

export function removeObjectiveDefinition(builderState, index) {
  const mission = ensureMissionDraft(builderState);
  const objectives = Array.isArray(mission?.objectives) ? mission.objectives : [];
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= objectives.length) {
    return { ok: false, message: "No objective removed; index was invalid." };
  }

  const [removed] = objectives.splice(cleanIndex, 1);
  mission.objectives = objectives;
  mission.briefing = mission.briefing ?? {};
  mission.briefing.objectives = buildBriefingObjectiveLines(mission.objectives);

  const tool = ensureObjectiveToolSettings(builderState);
  tool.selectedIndex = objectives.length ? Math.min(cleanIndex, objectives.length - 1) : -1;
  builderState.dirty = true;

  return { ok: true, message: `Removed objective ${removed?.id ?? cleanIndex + 1}.` };
}

export function setObjectivePaintMode(builderState, mode) {
  const tool = ensureObjectiveToolSettings(builderState);
  tool.paintMode = mode === "erase" ? "erase" : "add";
  return tool;
}

export function isObjectiveAuthoringActive(builderState) {
  return builderState?.workspaceMode === "builder-map" && builderState?.activeTab === "objectives";
}

export function applyObjectiveToolAtTile(builderState, appState, x, y) {
  const tool = ensureObjectiveToolSettings(builderState);
  const mission = ensureMissionDraft(builderState);
  const objectives = Array.isArray(mission?.objectives) ? mission.objectives : [];
  const index = Number(tool?.selectedIndex ?? -1);

  if (!Number.isInteger(index) || index < 0 || index >= objectives.length) {
    return { ok: false, message: "Select or add a zone/hold objective before painting objective tiles." };
  }

  const objective = objectives[index];
  if (!objectiveTypeNeedsZone(objective?.type)) {
    return { ok: false, message: `${objective?.type ?? "Objective"} does not use a painted zone.` };
  }

  const map = appState?.map ?? builderState?.authoring?.map ?? null;
  const tx = Number(x);
  const ty = Number(y);
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || !getTile(map, tx, ty)) {
    return { ok: false, message: "Objective zone tile is outside the map." };
  }

  const tiles = normalizeTiles(objective.tiles);
  const key = `${tx},${ty}`;
  const exists = tiles.some((tile) => `${tile.x},${tile.y}` === key);

  if (tool.paintMode === "erase") {
    objective.tiles = tiles.filter((tile) => `${tile.x},${tile.y}` !== key);
    builderState.dirty = true;
    return { ok: true, message: `Removed ${tx}, ${ty} from ${objective.id}.` };
  }

  if (!exists) objective.tiles = [...tiles, { x: tx, y: ty }];
  else objective.tiles = tiles;
  builderState.dirty = true;
  return { ok: true, message: exists ? `${tx}, ${ty} is already in ${objective.id}.` : `Added ${tx}, ${ty} to ${objective.id}.` };
}

export function getObjectiveZoneCells(mapOrBuilderState) {
  const mission = mapOrBuilderState?.authoring?.mission ?? mapOrBuilderState?.mission ?? null;
  const objectives = Array.isArray(mission?.objectives) ? mission.objectives : [];
  const cells = [];

  for (const objective of objectives) {
    if (!objectiveTypeNeedsZone(objective?.type)) continue;
    for (const tile of normalizeTiles(objective.tiles)) {
      cells.push({
        x: tile.x,
        y: tile.y,
        objectiveId: objective.id ?? "objective",
        type: objective.type ?? "objective"
      });
    }
  }

  return cells;
}

function ensureMissionDraft(builderState) {
  if (!builderState) return null;
  if (!builderState.authoring) builderState.authoring = { map: null, mission: null, source: "none" };
  if (!builderState.authoring.mission) {
    const map = builderState.authoring.map;
    const mapId = sanitizeId(map?.id) || "builder_map";
    const mapName = String(map?.name ?? "Builder Map").trim() || "Builder Map";
    builderState.authoring.mission = {
      id: `${mapId}_mission`,
      name: `${mapName} Mission`,
      briefing: {
        title: `${mapName} Mission`,
        text: "Builder-authored mission package. Replace this briefing text in the Mission Builder when mission authoring comes online.",
        objectives: []
      },
      objectives: []
    };
  }
  if (!Array.isArray(builderState.authoring.mission.objectives)) builderState.authoring.mission.objectives = [];
  return builderState.authoring.mission;
}

function buildObjectiveFromTool(tool, id) {
  const type = tool.type ?? "defeat_all";
  const objective = {
    id,
    type,
    label: tool.label || getDefaultObjectiveLabel(type, tool.targetTeam),
    briefingText: tool.briefingText || tool.label || getDefaultObjectiveLabel(type, tool.targetTeam)
  };

  if (type === "defeat_all") {
    objective.targetTeam = tool.targetTeam || "enemy";
  } else if (type === "reach_zone") {
    objective.team = tool.team || "player";
    objective.tiles = [];
  } else if (type === "hold_zone") {
    objective.team = tool.team || "player";
    objective.roundsRequired = Math.max(1, Math.floor(Number(tool.roundsRequired) || 1));
    objective.tiles = [];
  } else if (type === "survive_rounds") {
    objective.team = tool.team || "player";
    objective.roundsRequired = Math.max(1, Math.floor(Number(tool.roundsRequired) || 1));
  } else if (type === "trigger_complete") {
    objective.team = tool.team || "player";
  } else if (type === "protect_unit") {
    objective.targetUnitId = tool.targetUnitId || "";
  }

  return objective;
}

function buildBriefingObjectiveLines(objectives) {
  return (Array.isArray(objectives) ? objectives : [])
    .map((objective) => String(objective?.briefingText ?? objective?.label ?? objective?.id ?? "Objective").trim())
    .filter(Boolean);
}

function createObjectiveId(type, objectives) {
  const base = sanitizeId(type) || "objective";
  return createUniqueObjectiveId(base, objectives);
}

function createUniqueObjectiveId(baseId, objectives) {
  const base = sanitizeId(baseId) || "objective";
  const used = new Set((Array.isArray(objectives) ? objectives : []).map((objective) => objective?.id).filter(Boolean));
  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function getObjectiveDefaults(type, targetTeam = "enemy", roundsRequired = 3) {
  return {
    label: getDefaultObjectiveLabel(type, targetTeam, roundsRequired),
    briefingText: getDefaultObjectiveBriefingText(type, targetTeam, roundsRequired)
  };
}

function getDefaultObjectiveLabel(type, targetTeam = "enemy", roundsRequired = 3) {
  const rounds = Math.max(1, Math.floor(Number(roundsRequired) || 3));
  switch (type) {
    case "reach_zone": return "Reach extraction zone";
    case "hold_zone": return `Hold zone for ${rounds} rounds`;
    case "survive_rounds": return `Survive ${rounds} rounds`;
    case "trigger_complete": return "Reach trigger zone";
    case "protect_unit": return "Protect selected unit";
    case "defeat_all":
    default:
      return `Defeat all ${targetTeam || "enemy"} units`;
  }
}

function getDefaultObjectiveBriefingText(type, targetTeam = "enemy", roundsRequired = 3) {
  const rounds = Math.max(1, Math.floor(Number(roundsRequired) || 3));
  switch (type) {
    case "reach_zone": return "Move a player unit into the marked zone.";
    case "hold_zone": return `Hold the marked zone for ${rounds} rounds.`;
    case "survive_rounds": return `Survive for ${rounds} rounds.`;
    case "trigger_complete": return "Move a player unit into the trigger zone.";
    case "protect_unit": return "If the selected unit is disabled or destroyed, the mission fails.";
    case "defeat_all":
    default:
      return `Defeat all ${targetTeam || "enemy"} units.`;
  }
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
  const node = root.querySelector(`[data-builder-field="${fieldName}"]`);
  return node ? String(node.value ?? "") : String(fallback ?? "");
}

function sanitizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
