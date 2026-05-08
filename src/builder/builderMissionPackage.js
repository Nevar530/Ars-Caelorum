// src/builder/builderMissionPackage.js
//
// Mission Package Core V1/V2 foundation.
// Mission is the wrapper. Maps are tactical phases. Objectives remain map-scoped
// by mirroring the active map's objective array into mission.objectives for the
// current runtime/export contract.

import { cloneMapDefinition } from "../map.js";
import { createBlankBuilderMap } from "./builderMapFactory.js";

const DEFAULT_BRIEFING_BODY = "Mission package created in the Mission Builder.";
const DEFAULT_GOAL_TEXT = "Complete all tactical phases.";

export const OBJECTIVE_PRESETS = [
  {
    id: "defeat_all",
    label: "Defeat All",
    objective: {
      id: "defeat_enemies",
      type: "defeat_all",
      targetTeam: "enemy",
      label: "Defeat all enemy units",
      briefingText: "Defeat all enemy units."
    },
    summary: "Defeat all enemy units."
  },
  {
    id: "reach_zone",
    label: "Reach Zone",
    objective: {
      id: "reach_zone",
      type: "reach_zone",
      team: "player",
      label: "Reach extraction zone",
      briefingText: "Move a player unit into the marked zone.",
      tiles: []
    },
    summary: "Reach the marked extraction zone."
  },
  {
    id: "hold_zone",
    label: "Hold Zone",
    objective: {
      id: "hold_zone",
      type: "hold_zone",
      team: "player",
      roundsRequired: 3,
      label: "Hold zone for 3 rounds",
      briefingText: "Hold the marked zone for 3 rounds.",
      tiles: []
    },
    summary: "Hold the marked zone for 3 rounds."
  },
  {
    id: "survive_rounds",
    label: "Survive Rounds",
    objective: {
      id: "survive_rounds",
      type: "survive_rounds",
      team: "player",
      roundsRequired: 3,
      label: "Survive 3 rounds",
      briefingText: "Survive for 3 rounds."
    },
    summary: "Survive for 3 rounds."
  }
];

export function ensureMissionPackageDraft(builderState) {
  if (!builderState) return null;
  if (!builderState.authoring) builderState.authoring = { map: null, mission: null, source: "none" };

  ensureMissionMapCollection(builderState);

  const activeMap = builderState.authoring.map ?? builderState.authoring.maps?.[0] ?? null;
  const mapId = sanitizeId(activeMap?.id, "new_map");
  const mapName = sanitizeName(activeMap?.name, "New Map");

  if (!builderState.authoring.mission) {
    builderState.authoring.mission = createDefaultMissionPackage({ mapId, mapName });
  }

  const mission = builderState.authoring.mission;
  mission.id = sanitizeId(mission.id, `${mapId}_mission`);
  mission.name = sanitizeName(mission.name, `${mapName} Mission`);
  mission.goalText = sanitizeName(mission.goalText, DEFAULT_GOAL_TEXT);
  mission.startMapId = sanitizeId(mission.startMapId, mapId);
  mission.mapId = sanitizeId(mission.mapId ?? mission.startMapId, mission.startMapId);
  mission.mapPath = mission.mapPath || `./data/maps/${mission.mapId}.json`;
  mission.briefing = mission.briefing ?? {};
  mission.briefing.title = sanitizeName(mission.briefing.title, mission.name);
  mission.briefing.text = sanitizeName(mission.briefing.text, DEFAULT_BRIEFING_BODY);
  mission.results = normalizeResults(mission.results);
  mission.dialogue = mission.dialogue ?? createDefaultDialogue();

  syncMissionMapMetadata(builderState);
  syncActiveMapObjectivesToMission(builderState);

  return mission;
}

export function createDefaultMissionPackage({ mapId = "new_map", mapName = "New Map" } = {}) {
  const cleanMapId = sanitizeId(mapId, "new_map");
  const cleanMapName = sanitizeName(mapName, "New Map");
  const missionName = `${cleanMapName} Mission`;
  const mission = {
    id: `${cleanMapId}_mission`,
    name: missionName,
    goalText: DEFAULT_GOAL_TEXT,
    mapId: cleanMapId,
    mapPath: `./data/maps/${cleanMapId}.json`,
    startMapId: cleanMapId,
    activeMapId: cleanMapId,
    maps: [createMapMeta(cleanMapId, cleanMapName, 1)],
    objectivePreset: "defeat_all",
    briefing: {
      title: missionName,
      text: DEFAULT_BRIEFING_BODY,
      objectives: []
    },
    objectives: [],
    dialogue: createDefaultDialogue(),
    results: normalizeResults(null)
  };
  applyObjectivePresetToMission(mission, "defeat_all");
  return mission;
}

export function readMissionPackageFields(builderState, root) {
  const mission = ensureMissionPackageDraft(builderState);
  if (!mission || !root) return { ok: false, message: "No mission package draft is active." };

  const requestedActiveMapId = sanitizeId(readField(root, "package-active-map-id", builderState.authoring?.activeMapId ?? mission.activeMapId ?? mission.startMapId), builderState.authoring?.activeMapId ?? mission.startMapId);
  const previousActiveMapId = builderState.authoring?.activeMapId ?? mission.activeMapId;
  if (requestedActiveMapId && requestedActiveMapId !== previousActiveMapId) {
    setActiveMissionPackageMap(builderState, requestedActiveMapId);
  }

  const activeMap = builderState.authoring?.map ?? null;
  const activeMapId = sanitizeId(activeMap?.id, requestedActiveMapId || "new_map");
  const missionId = sanitizeId(readField(root, "package-mission-id", mission.id), mission.id || `${activeMapId}_mission`);
  const missionName = sanitizeName(readField(root, "package-mission-name", mission.name), mission.name || "New Mission");
  const goalText = sanitizeName(readField(root, "package-goal-text", mission.goalText), mission.goalText || DEFAULT_GOAL_TEXT);
  const briefingTitle = sanitizeName(readField(root, "package-briefing-title", mission.briefing?.title), missionName);
  const briefingBody = sanitizeName(readField(root, "package-briefing-body", mission.briefing?.text), DEFAULT_BRIEFING_BODY);
  const victoryTitle = sanitizeName(readField(root, "package-victory-title", mission.results?.victory?.title), "Victory");
  const victoryText = sanitizeName(readField(root, "package-victory-text", mission.results?.victory?.text), "Mission complete.");
  const defeatTitle = sanitizeName(readField(root, "package-defeat-title", mission.results?.defeat?.title), "Defeat");
  const defeatText = sanitizeName(readField(root, "package-defeat-text", mission.results?.defeat?.text), "Mission failed.");
  const preset = sanitizeId(readField(root, "package-objective-preset", mission.objectivePreset), mission.objectivePreset || "defeat_all");
  const startMapId = sanitizeId(readField(root, "package-start-map-id", mission.startMapId), mission.startMapId || activeMapId);

  mission.id = missionId;
  mission.name = missionName;
  mission.goalText = goalText;
  mission.startMapId = startMapId;
  mission.activeMapId = activeMapId;
  mission.mapId = startMapId;
  mission.mapPath = `./data/maps/${startMapId}.json`;
  mission.objectivePreset = preset;
  mission.briefing = {
    ...(mission.briefing ?? {}),
    title: briefingTitle,
    text: briefingBody,
    objectives: normalizeBriefingLines(mission.briefing?.objectives, mission.objectives)
  };
  mission.results = {
    victory: { title: victoryTitle, text: victoryText },
    defeat: { title: defeatTitle, text: defeatText }
  };

  syncMissionMapMetadata(builderState);
  syncActiveMapObjectivesToMission(builderState);
  builderState.dirty = true;

  return {
    ok: true,
    activeMapChanged: requestedActiveMapId !== previousActiveMapId,
    message: `Mission package updated: ${mission.id}.`
  };
}

export function readMapSettingsFields(builderState, root, appState = null) {
  const mission = ensureMissionPackageDraft(builderState);
  const map = builderState?.authoring?.map ?? null;
  if (!mission || !map || !root) return { ok: false, message: "No active builder map to update." };

  const previousMapId = sanitizeId(map.id, "new_map");
  const nextMapId = sanitizeId(readField(root, "active-map-id", map.id), previousMapId);
  const nextMapName = sanitizeName(readField(root, "active-map-name", map.name), map.name || titleFromId(nextMapId));
  const defaultTerrainTypeId = sanitizeId(readField(root, "map-default-terrain", map.defaults?.terrainTypeId ?? map.defaultTerrainTypeId ?? inferFirstTerrainType(map, appState)), "grass");
  const defaultElevation = clampWholeNumber(readField(root, "map-default-elevation", map.defaults?.elevation ?? 0), 0, -8, 16);
  const defaultMovementClass = sanitizeName(readField(root, "map-default-movement", map.defaults?.movementClass ?? "clear"), "clear");

  map.id = nextMapId;
  map.name = nextMapName;
  map.defaults = {
    ...(map.defaults ?? {}),
    terrainTypeId: defaultTerrainTypeId,
    elevation: defaultElevation,
    movementClass: defaultMovementClass
  };

  if (!Array.isArray(map.terrainTypes)) map.terrainTypes = [];
  if (!map.terrainTypes.includes(defaultTerrainTypeId)) map.terrainTypes.push(defaultTerrainTypeId);

  builderState.authoring.activeMapId = nextMapId;
  mission.activeMapId = nextMapId;
  if (mission.startMapId === previousMapId) mission.startMapId = nextMapId;
  if (mission.mapId === previousMapId) mission.mapId = nextMapId;
  mission.mapPath = `./data/maps/${mission.startMapId || nextMapId}.json`;

  syncMissionMapMetadata(builderState);
  syncActiveMapObjectivesToMission(builderState);
  builderState.dirty = true;

  return {
    ok: true,
    mapIdChanged: previousMapId !== nextMapId,
    message: `Updated map settings for ${nextMapId}.`
  };
}

export function applyMissionPackagePreset(builderState, root = null) {
  const fieldResult = root ? readMissionPackageFields(builderState, root) : { ok: true };
  if (!fieldResult.ok) return fieldResult;

  const mission = ensureMissionPackageDraft(builderState);
  const presetId = sanitizeId(readField(root, "package-objective-preset", mission.objectivePreset), mission.objectivePreset || "defeat_all");
  applyObjectivePresetToMission(mission, presetId, builderState);
  builderState.dirty = true;

  return {
    ok: true,
    message: `Applied ${getObjectivePresetLabel(presetId)} objective preset to active map.`
  };
}

export function addNewMapToMissionPackage(builderState, appState = null) {
  const mission = ensureMissionPackageDraft(builderState);
  if (!mission) return { ok: false, message: "No mission package is active." };

  const maps = getMissionMapDrafts(builderState);
  const base = sanitizeId(mission.id, "mission");
  const index = maps.length + 1;
  const id = createUniqueMapId(`${base}_map_${String(index).padStart(2, "0")}`, maps);
  const name = `Map ${index}`;
  const terrainTypes = Array.isArray(appState?.content?.terrainList)
    ? appState.content.terrainList.map((entry) => entry?.id ?? entry).filter(Boolean)
    : undefined;
  const map = createBlankBuilderMap({
    id,
    name,
    terrainTypes,
    terrainDefinitions: appState?.content?.terrainDefinitions ?? {}
  });

  map.objectives = [cloneJson(OBJECTIVE_PRESETS[0].objective)];
  builderState.authoring.maps = [...maps, map];
  setActiveMissionPackageMap(builderState, id);
  builderState.dirty = true;
  return { ok: true, message: `Added map ${id} to mission package.` };
}

export function addExistingMapToMissionPackage(builderState, sourceMap, sourceEntry = null) {
  const mission = ensureMissionPackageDraft(builderState);
  if (!mission || !sourceMap) return { ok: false, message: "No mission package or source map available to load." };

  const maps = getMissionMapDrafts(builderState);
  const sourceId = sanitizeId(sourceMap.id ?? sourceEntry?.id, "loaded_map");
  const sourceName = sanitizeName(sourceMap.name ?? sourceEntry?.name, titleFromId(sourceId));
  const id = createUniqueMapId(`${sourceId}_copy`, maps);
  const map = cloneBuilderMap(sourceMap);
  map.id = id;
  map.name = `${sourceName} Copy`;
  if (!Array.isArray(map.objectives)) map.objectives = [cloneJson(OBJECTIVE_PRESETS[0].objective)];

  builderState.authoring.maps = [...maps, map];
  setActiveMissionPackageMap(builderState, id);
  builderState.dirty = true;
  return { ok: true, message: `Loaded existing map ${sourceName} as ${id}.` };
}

export function duplicateActiveMissionPackageMap(builderState) {
  const mission = ensureMissionPackageDraft(builderState);
  const active = builderState?.authoring?.map ?? null;
  if (!mission || !active) return { ok: false, message: "No active map to duplicate." };

  const maps = getMissionMapDrafts(builderState);
  const id = createUniqueMapId(`${sanitizeId(active.id, "map")}_copy`, maps);
  const copy = cloneBuilderMap(active);
  copy.id = id;
  copy.name = `${sanitizeName(active.name, titleFromId(active.id))} Copy`;
  builderState.authoring.maps = [...maps, copy];
  setActiveMissionPackageMap(builderState, id);
  builderState.dirty = true;
  return { ok: true, message: `Duplicated active map as ${id}.` };
}

export function deleteActiveMissionPackageMap(builderState) {
  const mission = ensureMissionPackageDraft(builderState);
  const activeId = builderState?.authoring?.activeMapId ?? builderState?.authoring?.map?.id;
  const maps = getMissionMapDrafts(builderState);
  if (!mission || maps.length <= 1) return { ok: false, message: "Mission package must keep at least one map." };

  const nextMaps = maps.filter((map) => sanitizeId(map?.id, "") !== activeId);
  const nextActive = nextMaps[0] ?? null;
  builderState.authoring.maps = nextMaps;
  setActiveMissionPackageMap(builderState, nextActive?.id);
  builderState.dirty = true;
  return { ok: true, message: `Removed map ${activeId} from mission package.` };
}

export function setActiveMissionPackageMap(builderState, mapId) {
  if (!builderState) return { ok: false, message: "No builder state." };
  ensureMissionMapCollection(builderState);
  const cleanId = sanitizeId(mapId, "");
  const maps = getMissionMapDrafts(builderState);
  const map = maps.find((entry) => sanitizeId(entry?.id, "") === cleanId) ?? maps[0] ?? null;
  if (!map) return { ok: false, message: `Map ${cleanId || "unknown"} was not found.` };

  // Save current active map back into the collection before switching.
  if (builderState.authoring.map) {
    const currentId = sanitizeId(builderState.authoring.map.id, "");
    const currentIndex = maps.findIndex((entry) => sanitizeId(entry?.id, "") === currentId);
    if (currentIndex >= 0) maps[currentIndex] = builderState.authoring.map;
  }

  builderState.authoring.map = map;
  builderState.authoring.activeMapId = map.id;
  if (builderState.authoring.mission) builderState.authoring.mission.activeMapId = map.id;
  syncMissionMapMetadata(builderState);
  syncActiveMapObjectivesToMission(builderState);

  builderState.runtimeMapId = null;
  builderState.hover = null;
  builderState.selected = {
    type: "map",
    id: map.id,
    label: map.name ?? map.id,
    mapId: map.id
  };

  return { ok: true, message: `Active map set to ${map.name ?? map.id}.` };
}

export function getMissionMapDrafts(builderState) {
  ensureMissionMapCollection(builderState);
  return Array.isArray(builderState?.authoring?.maps) ? builderState.authoring.maps : [];
}

export function getMissionPackageSummary(builderState) {
  const mission = ensureMissionPackageDraft(builderState);
  const maps = getMissionMapDrafts(builderState);
  const activeMap = builderState?.authoring?.map ?? maps[0] ?? null;
  const activeMapId = sanitizeId(activeMap?.id, mission?.activeMapId ?? "new_map");
  const startMapId = sanitizeId(mission?.startMapId, activeMapId);

  return {
    missionId: mission?.id ?? `${activeMapId}_mission`,
    missionName: mission?.name ?? "New Mission",
    goalText: mission?.goalText ?? DEFAULT_GOAL_TEXT,
    mapId: activeMapId,
    activeMapId,
    startMapId,
    mapPath: `./data/maps/${activeMapId}.json`,
    missionPath: `./data/missions/${mission?.id ?? `${activeMapId}_mission`}.json`,
    packagePath: `data/packages/${mission?.id ?? `${activeMapId}_mission`}.package.json`,
    maps: maps.map((map, index) => ({
      id: sanitizeId(map?.id, `map_${index + 1}`),
      name: sanitizeName(map?.name, `Map ${index + 1}`),
      path: `data/maps/${sanitizeId(map?.id, `map_${index + 1}`)}.json`,
      objectiveCount: Array.isArray(map?.objectives) ? map.objectives.length : 0
    })),
    catalogMissionEntry: {
      id: mission?.id ?? `${activeMapId}_mission`,
      name: mission?.name ?? "New Mission",
      path: `./data/missions/${mission?.id ?? `${activeMapId}_mission`}.json`
    },
    catalogMapEntries: maps.map((map, index) => ({
      id: sanitizeId(map?.id, `map_${index + 1}`),
      name: sanitizeName(map?.name, `Map ${index + 1}`),
      path: `./data/maps/${sanitizeId(map?.id, `map_${index + 1}`)}.json`
    }))
  };
}

export function getObjectivePresetOptions() {
  return OBJECTIVE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }));
}

export function getObjectivePresetLabel(presetId) {
  return OBJECTIVE_PRESETS.find((preset) => preset.id === presetId)?.label ?? "Defeat All";
}

function ensureMissionMapCollection(builderState) {
  if (!builderState.authoring) builderState.authoring = { map: null, mission: null, source: "none" };
  const authoring = builderState.authoring;
  if (!Array.isArray(authoring.maps)) authoring.maps = [];

  if (authoring.map) {
    const mapId = sanitizeId(authoring.map.id, "new_map");
    authoring.map.id = mapId;
    const index = authoring.maps.findIndex((map) => sanitizeId(map?.id, "") === mapId);
    if (index >= 0) authoring.maps[index] = authoring.map;
    else authoring.maps.push(authoring.map);
    authoring.activeMapId = authoring.activeMapId || mapId;
  }

  if (!authoring.map && authoring.maps.length) {
    const active = authoring.maps.find((map) => sanitizeId(map?.id, "") === authoring.activeMapId) ?? authoring.maps[0];
    authoring.map = active;
    authoring.activeMapId = active?.id;
  }

  if (authoring.map && !Array.isArray(authoring.map.objectives)) {
    const missionObjectives = Array.isArray(authoring.mission?.objectives) ? authoring.mission.objectives : [];
    authoring.map.objectives = missionObjectives.length ? missionObjectives : [cloneJson(OBJECTIVE_PRESETS[0].objective)];
  }
}

function syncMissionMapMetadata(builderState) {
  const mission = builderState?.authoring?.mission;
  const maps = getMissionMapDrafts(builderState);
  if (!mission) return;

  const existing = new Map((Array.isArray(mission.maps) ? mission.maps : []).map((entry) => [sanitizeId(entry?.id, ""), entry]));
  mission.maps = maps.map((map, index) => {
    const id = sanitizeId(map?.id, `map_${index + 1}`);
    const previous = existing.get(id) ?? {};
    return {
      ...previous,
      id,
      name: sanitizeName(map?.name, `Map ${index + 1}`),
      mapPath: `./data/maps/${id}.json`,
      objectiveSummary: getMapObjectiveSummary(map),
      phaseIndex: index + 1
    };
  });

  const activeId = sanitizeId(builderState.authoring?.activeMapId ?? builderState.authoring?.map?.id, mission.maps[0]?.id ?? "new_map");
  mission.activeMapId = activeId;
  if (!mission.startMapId || !mission.maps.some((entry) => entry.id === mission.startMapId)) {
    mission.startMapId = mission.maps[0]?.id ?? activeId;
  }
  mission.mapId = mission.startMapId;
  mission.mapPath = `./data/maps/${mission.startMapId}.json`;
}

export function syncActiveMapObjectivesToMission(builderState) {
  const mission = builderState?.authoring?.mission;
  const map = builderState?.authoring?.map;
  if (!mission || !map) return;

  if (!Array.isArray(map.objectives)) {
    map.objectives = Array.isArray(mission.objectives) && mission.objectives.length
      ? mission.objectives
      : [cloneJson(OBJECTIVE_PRESETS[0].objective)];
  }

  mission.objectives = map.objectives;
  mission.briefing = mission.briefing ?? {};
  mission.briefing.objectives = buildBriefingObjectiveLines(map.objectives);
  mission.objectivePreset = map.objectivePreset ?? mission.objectivePreset ?? map.objectives?.[0]?.type ?? "defeat_all";
}

function applyObjectivePresetToMission(mission, presetId, builderState = null) {
  const preset = OBJECTIVE_PRESETS.find((entry) => entry.id === presetId) ?? OBJECTIVE_PRESETS[0];
  const objective = cloneJson(preset.objective);
  mission.objectivePreset = preset.id;
  mission.objectives = [objective];
  mission.briefing = mission.briefing ?? {};
  mission.briefing.objectives = [objective.briefingText ?? preset.summary];

  const map = builderState?.authoring?.map ?? null;
  if (map) {
    map.objectives = mission.objectives;
    map.objectivePreset = preset.id;
    syncMissionMapMetadata(builderState);
  }

  return mission;
}

function createMapMeta(id, name, phaseIndex = 1) {
  const cleanId = sanitizeId(id, `map_${phaseIndex}`);
  return {
    id: cleanId,
    name: sanitizeName(name, `Map ${phaseIndex}`),
    mapPath: `./data/maps/${cleanId}.json`,
    objectiveSummary: "Defeat all enemy units.",
    phaseIndex
  };
}

function getMapObjectiveSummary(map) {
  const objectives = Array.isArray(map?.objectives) ? map.objectives : [];
  const lines = buildBriefingObjectiveLines(objectives);
  return lines[0] ?? "No map objectives authored yet.";
}

function buildBriefingObjectiveLines(objectives) {
  return (Array.isArray(objectives) ? objectives : [])
    .map((objective) => String(objective?.briefingText ?? objective?.label ?? objective?.id ?? "Objective").trim())
    .filter(Boolean);
}

function normalizeResults(results) {
  return {
    victory: {
      title: sanitizeName(results?.victory?.title, "Victory"),
      text: sanitizeName(results?.victory?.text, "Mission complete.")
    },
    defeat: {
      title: sanitizeName(results?.defeat?.title, "Defeat"),
      text: sanitizeName(results?.defeat?.text, "Mission failed.")
    }
  };
}

function normalizeBriefingLines(lines, objectives) {
  const clean = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  if (clean.length) return clean;
  return buildBriefingObjectiveLines(objectives);
}

function createDefaultDialogue() {
  return {
    intro: { lines: [{ speakerId: "system", name: "Mission Control", text: "Mission loaded." }] },
    victory: { lines: [{ speakerId: "system", name: "Mission Control", text: "Victory confirmed." }] },
    defeat: { lines: [{ speakerId: "system", name: "Mission Control", text: "Mission failed." }] }
  };
}

function inferFirstTerrainType(map, appState) {
  if (Array.isArray(map?.terrainTypes) && map.terrainTypes.length) return map.terrainTypes[0];
  const list = appState?.content?.terrainList;
  if (Array.isArray(list) && list.length) return list[0]?.id ?? list[0];
  return "grass";
}

function createUniqueMapId(baseId, maps) {
  const base = sanitizeId(baseId, "map");
  const used = new Set((Array.isArray(maps) ? maps : []).map((map) => sanitizeId(map?.id, "")).filter(Boolean));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function readField(root, fieldName, fallback = "") {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? String(node.value ?? "") : String(fallback ?? "");
}

function clampWholeNumber(value, fallback, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function cloneBuilderMap(map) {
  const clone = cloneMapDefinition(map);
  if (!clone.spawns || typeof clone.spawns !== "object") clone.spawns = { player: [], enemy: [], neutral: [] };
  if (!clone.startState || typeof clone.startState !== "object") clone.startState = { deployments: [], deploymentCells: [] };
  if (!Array.isArray(clone.startState.deployments)) clone.startState.deployments = [];
  if (!Array.isArray(clone.startState.deploymentCells)) clone.startState.deploymentCells = [];
  if (!Array.isArray(clone.structures)) clone.structures = [];
  if (!Array.isArray(clone.objectives)) clone.objectives = [];
  return clone;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function sanitizeId(value, fallback = "") {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || fallback;
}

function sanitizeName(value, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function titleFromId(id) {
  return String(id ?? "map")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
