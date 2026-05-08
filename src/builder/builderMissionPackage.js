// src/builder/builderMissionPackage.js
//
// Mission Package Core V1.
// This owns the mission wrapper authoring layer: mission id/name, map reference,
// briefing text, objective preset starter data, result text, and catalog preview.

const DEFAULT_BRIEFING_BODY = "Mission package created in the Mission Builder.";

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

  const map = builderState.authoring.map ?? null;
  const mapId = sanitizeId(map?.id, "new_map");
  const mapName = sanitizeName(map?.name, "New Map");

  if (!builderState.authoring.mission) {
    builderState.authoring.mission = createDefaultMissionPackage({ mapId, mapName });
  }

  const mission = builderState.authoring.mission;
  mission.id = sanitizeId(mission.id, `${mapId}_mission`);
  mission.name = sanitizeName(mission.name, `${mapName} Mission`);
  mission.mapId = sanitizeId(mission.mapId, mapId);
  mission.mapPath = mission.mapPath || `./data/maps/${mission.mapId}.json`;
  mission.briefing = mission.briefing ?? {};
  mission.briefing.title = sanitizeName(mission.briefing.title, mission.name);
  mission.briefing.text = sanitizeName(mission.briefing.text, DEFAULT_BRIEFING_BODY);
  if (!Array.isArray(mission.objectives)) mission.objectives = [];
  if (!mission.objectives.length) applyObjectivePresetToMission(mission, "defeat_all");
  mission.briefing.objectives = normalizeBriefingLines(mission.briefing.objectives, mission.objectives);
  mission.results = normalizeResults(mission.results);
  mission.dialogue = mission.dialogue ?? createDefaultDialogue();

  return mission;
}

export function createDefaultMissionPackage({ mapId = "new_map", mapName = "New Map" } = {}) {
  const cleanMapId = sanitizeId(mapId, "new_map");
  const missionName = `${sanitizeName(mapName, "New Map")} Mission`;
  const mission = {
    id: `${cleanMapId}_mission`,
    name: missionName,
    mapId: cleanMapId,
    mapPath: `./data/maps/${cleanMapId}.json`,
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

  const previousMapId = mission.mapId;
  const map = builderState.authoring?.map ?? null;
  const mapId = sanitizeId(readField(root, "package-map-id", mission.mapId), mission.mapId || map?.id || "new_map");
  const missionId = sanitizeId(readField(root, "package-mission-id", mission.id), mission.id || `${mapId}_mission`);
  const missionName = sanitizeName(readField(root, "package-mission-name", mission.name), mission.name || "New Mission");
  const briefingTitle = sanitizeName(readField(root, "package-briefing-title", mission.briefing?.title), missionName);
  const briefingBody = sanitizeName(readField(root, "package-briefing-body", mission.briefing?.text), DEFAULT_BRIEFING_BODY);
  const objectiveSummary = sanitizeName(readField(root, "package-objective-summary", mission.briefing?.objectives?.[0]), "Defeat all enemy units.");
  const victoryTitle = sanitizeName(readField(root, "package-victory-title", mission.results?.victory?.title), "Victory");
  const victoryText = sanitizeName(readField(root, "package-victory-text", mission.results?.victory?.text), "Mission complete.");
  const defeatTitle = sanitizeName(readField(root, "package-defeat-title", mission.results?.defeat?.title), "Defeat");
  const defeatText = sanitizeName(readField(root, "package-defeat-text", mission.results?.defeat?.text), "Mission failed.");
  const preset = sanitizeId(readField(root, "package-objective-preset", mission.objectivePreset), mission.objectivePreset || "defeat_all");

  mission.id = missionId;
  mission.name = missionName;
  mission.mapId = mapId;
  mission.mapPath = `./data/maps/${mapId}.json`;
  mission.objectivePreset = preset;
  mission.briefing = {
    ...(mission.briefing ?? {}),
    title: briefingTitle,
    text: briefingBody,
    objectives: [objectiveSummary]
  };
  mission.results = {
    victory: { title: victoryTitle, text: victoryText },
    defeat: { title: defeatTitle, text: defeatText }
  };

  if (map && mapId && map.id !== mapId) {
    map.id = mapId;
  }

  builderState.dirty = true;
  return {
    ok: true,
    mapIdChanged: previousMapId !== mapId,
    message: `Mission package updated: ${mission.id}.`
  };
}

export function applyMissionPackagePreset(builderState, root = null) {
  const fieldResult = root ? readMissionPackageFields(builderState, root) : { ok: true };
  if (!fieldResult.ok) return fieldResult;

  const mission = ensureMissionPackageDraft(builderState);
  const presetId = sanitizeId(readField(root, "package-objective-preset", mission.objectivePreset), mission.objectivePreset || "defeat_all");
  applyObjectivePresetToMission(mission, presetId);
  builderState.dirty = true;

  return {
    ok: true,
    message: `Applied ${getObjectivePresetLabel(presetId)} objective preset.`
  };
}

export function getMissionPackageSummary(builderState) {
  const mission = ensureMissionPackageDraft(builderState);
  const map = builderState?.authoring?.map ?? null;
  const mapId = sanitizeId(mission?.mapId, map?.id ?? "new_map");

  return {
    missionId: mission?.id ?? `${mapId}_mission`,
    missionName: mission?.name ?? "New Mission",
    mapId,
    mapPath: `./data/maps/${mapId}.json`,
    missionPath: `./data/missions/${mission?.id ?? `${mapId}_mission`}.json`,
    catalogMissionEntry: {
      id: mission?.id ?? `${mapId}_mission`,
      name: mission?.name ?? "New Mission",
      path: `./data/missions/${mission?.id ?? `${mapId}_mission`}.json`
    },
    catalogMapEntry: {
      id: mapId,
      name: map?.name ?? mapId,
      path: `./data/maps/${mapId}.json`
    }
  };
}

export function getObjectivePresetOptions() {
  return OBJECTIVE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }));
}

export function getObjectivePresetLabel(presetId) {
  return OBJECTIVE_PRESETS.find((preset) => preset.id === presetId)?.label ?? "Defeat All";
}

function applyObjectivePresetToMission(mission, presetId) {
  const preset = OBJECTIVE_PRESETS.find((entry) => entry.id === presetId) ?? OBJECTIVE_PRESETS[0];
  const objective = cloneJson(preset.objective);
  mission.objectivePreset = preset.id;
  mission.objectives = [objective];
  mission.briefing = mission.briefing ?? {};
  mission.briefing.objectives = [objective.briefingText ?? preset.summary];
  return mission;
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
  return (Array.isArray(objectives) ? objectives : [])
    .map((objective) => String(objective?.briefingText ?? objective?.label ?? objective?.id ?? "Objective").trim())
    .filter(Boolean);
}

function createDefaultDialogue() {
  return {
    intro: { lines: [{ speakerId: "system", name: "Mission Control", text: "Mission loaded." }] },
    victory: { lines: [{ speakerId: "system", name: "Mission Control", text: "Victory confirmed." }] },
    defeat: { lines: [{ speakerId: "system", name: "Mission Control", text: "Mission failed." }] }
  };
}

function readField(root, fieldName, fallback = "") {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? String(node.value ?? "") : String(fallback ?? "");
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
