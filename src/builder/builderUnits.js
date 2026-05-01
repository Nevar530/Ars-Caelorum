// src/builder/builderUnits.js
//
// Builder-owned unit/start assignment helpers.
// This writes map.startState.deployments in the same shape the current
// deployment/start-state runtime already consumes. It does not spawn units
// and does not touch combat rules.

import { parseSpawnId, SPAWN_TEAMS } from "../maps/mapSpawns.js";
import { getDefaultControlTypeForSpawnTeam } from "./builderSpawns.js";

const START_TYPES = ["pilot", "emptyMech"];

export function createDefaultUnitTool() {
  return {
    team: "player",
    controlType: "PC",
    startType: "pilot",
    pilotDefinitionId: "",
    mechDefinitionId: "",
    pilotSpawnId: "",
    mechSpawnId: "",
    instancePrefix: ""
  };
}

export function ensureUnitToolSettings(builderState, appState = null) {
  if (!builderState) return null;
  if (!builderState.unitTool) builderState.unitTool = createDefaultUnitTool();

  const tool = builderState.unitTool;
  const pilots = getPilotOptions(appState);
  const mechs = getMechOptions(appState);

  tool.startType = START_TYPES.includes(tool.startType) ? tool.startType : "pilot";

  if (tool.startType === "emptyMech") {
    tool.pilotDefinitionId = "";
    tool.pilotSpawnId = "";
    tool.mechDefinitionId = pickValidId(tool.mechDefinitionId, mechs);
  } else {
    tool.pilotDefinitionId = pickValidId(tool.pilotDefinitionId, pilots);
    tool.mechDefinitionId = pickOptionalValidId(tool.mechDefinitionId, mechs);
    tool.mechSpawnId = "";
  }

  tool.pilotSpawnId = String(tool.pilotSpawnId ?? "").trim();
  tool.mechSpawnId = String(tool.mechSpawnId ?? "").trim();
  tool.startEmbarked = tool.startType === "pilot" && Boolean(tool.mechDefinitionId);
  tool.instancePrefix = sanitizeInstancePrefix(tool.instancePrefix);

  const inferred = inferTeamControlFromTool(builderState, tool);
  tool.team = inferred.team;
  tool.controlType = inferred.controlType;

  return tool;
}

export function updateUnitToolFromFields(builderState, root, appState = null) {
  const tool = ensureUnitToolSettings(builderState, appState);
  if (!tool || !root) return tool;

  const startType = readField(root, "unit-start-type");
  const pilotDefinitionId = readField(root, "unit-pilot-id");
  const mechDefinitionId = readField(root, "unit-mech-id");
  const pilotSpawnId = readField(root, "unit-pilot-spawn-id");
  const mechSpawnId = readField(root, "unit-mech-spawn-id");
  const instancePrefix = readField(root, "unit-instance-prefix");

  if (startType !== undefined) tool.startType = START_TYPES.includes(startType) ? startType : tool.startType;
  if (pilotDefinitionId !== undefined) tool.pilotDefinitionId = pilotDefinitionId;
  if (mechDefinitionId !== undefined) tool.mechDefinitionId = mechDefinitionId;
  if (pilotSpawnId !== undefined) tool.pilotSpawnId = pilotSpawnId;
  if (mechSpawnId !== undefined) tool.mechSpawnId = mechSpawnId;
  if (instancePrefix !== undefined) tool.instancePrefix = instancePrefix;

  return ensureUnitToolSettings(builderState, appState);
}

export function resetUnitToolToDefaults(builderState, appState = null) {
  if (!builderState) return null;
  builderState.unitTool = createDefaultUnitTool();
  return ensureUnitToolSettings(builderState, appState);
}

export function addUnitStartAssignment(builderState, appState = null) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Unit start assignments require a builder-owned map." };

  const tool = ensureUnitToolSettings(builderState, appState);
  const startState = ensureStartState(map);
  const deployments = Array.isArray(startState.deployments) ? startState.deployments : [];
  const index = deployments.length + 1;
  const isEmptyMech = tool.startType === "emptyMech";
  const hasMech = Boolean(tool.mechDefinitionId);
  const inferred = inferTeamControlFromTool(builderState, tool);
  const team = inferred.team;
  const controlType = inferred.controlType;
  const prefix = tool.instancePrefix || `${team}-${index}`;
  const deploymentMode = startState.startMode === "deployment";
  const isPlayerDeploymentRoster = deploymentMode && team === "player" && controlType === "PC" && !isEmptyMech;

  if (isEmptyMech) {
    if (!tool.mechDefinitionId) {
      return { ok: false, message: "Choose a mech before adding an empty mech start." };
    }
    if (!tool.mechSpawnId) {
      return { ok: false, message: "Empty mech starts need a Mech Spawn ID." };
    }

    const next = {
      pilotDefinitionId: "",
      pilotInstanceId: "",
      pilotSpawnId: "",
      mechDefinitionId: tool.mechDefinitionId,
      mechInstanceId: `${prefix}-mech`,
      mechSpawnId: tool.mechSpawnId,
      team,
      controlType,
      startEmbarked: false,
      boardable: true,
      locked: false
    };

    deployments.push(next);
    startState.deployments = deployments;
    builderState.dirty = true;

    return {
      ok: true,
      message: `Added empty ${controlType} ${team} mech start for ${tool.mechDefinitionId}.`
    };
  }

  if (!tool.pilotDefinitionId) {
    return { ok: false, message: "Choose a pilot before adding a pilot start." };
  }

  // Pilot / Pilot + Mech authoring is pilot-first.
  // If a pilot has a mech selected, both start from the pilot spawn/deployment slot.
  // Separate parked vehicles belong to Empty Mech starts.
  const pilotSpawnId = tool.pilotSpawnId || "";
  const mechSpawnId = hasMech ? pilotSpawnId : "";

  if (!isPlayerDeploymentRoster && !pilotSpawnId) {
    return { ok: false, message: "Fixed pilot starts need a Pilot Spawn ID. Player deployment roster entries may leave spawn blank." };
  }

  const next = {
    pilotDefinitionId: tool.pilotDefinitionId,
    pilotInstanceId: `${prefix}-pilot`,
    pilotSpawnId,
    mechDefinitionId: hasMech ? tool.mechDefinitionId : "",
    mechInstanceId: hasMech ? `${prefix}-mech` : "",
    mechSpawnId,
    team,
    controlType,
    startEmbarked: hasMech
  };

  deployments.push(next);
  startState.deployments = deployments;
  builderState.dirty = true;

  return {
    ok: true,
    message: `Added ${controlType} ${team} ${hasMech ? "pilot + mech" : "pilot"} start for ${tool.pilotDefinitionId}.`
  };
}

export function removeUnitStartAssignment(builderState, index) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Unit start assignments require a builder-owned map." };

  const startState = ensureStartState(map);
  const deployments = Array.isArray(startState.deployments) ? startState.deployments : [];
  const cleanIndex = Math.trunc(Number(index));

  if (!Number.isFinite(cleanIndex) || cleanIndex < 0 || cleanIndex >= deployments.length) {
    return { ok: false, message: "No unit start assignment found to remove." };
  }

  const [removed] = deployments.splice(cleanIndex, 1);
  startState.deployments = deployments;
  builderState.dirty = true;
  return {
    ok: true,
    message: `Removed unit start ${removed?.pilotInstanceId || removed?.mechInstanceId || cleanIndex + 1}.`
  };
}

export function getUnitStartAssignments(builderState) {
  const map = builderState?.authoring?.map ?? null;
  const deployments = map?.startState?.deployments;
  return Array.isArray(deployments) ? deployments : [];
}

export function getSpawnIdOptions(builderState) {
  const map = builderState?.authoring?.map ?? null;
  const spawns = map?.spawns ?? {};
  const options = [];

  for (const team of SPAWN_TEAMS) {
    const list = Array.isArray(spawns[team]) ? spawns[team] : [];
    for (let index = 0; index < list.length; index += 1) {
      const point = list[index];
      if (!point) continue;
      const spawnId = `${team}_${index + 1}`;
      const controlType = point?.controlType ?? getDefaultControlTypeForSpawnTeam(team);
      options.push({
        id: spawnId,
        label: `${spawnId} (${point.x}, ${point.y}) · ${team}/${controlType}`,
        team: point?.team ?? team,
        controlType
      });
    }
  }

  return options;
}

export function getPilotOptions(appState = null) {
  const pilots = Array.isArray(appState?.content?.pilots) ? appState.content.pilots : [];
  return pilots.map((pilot) => ({
    id: String(pilot?.id ?? "").trim(),
    label: String(pilot?.name ?? pilot?.id ?? "Pilot").trim()
  })).filter((pilot) => pilot.id);
}

export function getMechOptions(appState = null) {
  const mechs = Array.isArray(appState?.content?.mechs) ? appState.content.mechs : [];
  return mechs.map((mech) => ({
    id: String(mech?.id ?? "").trim(),
    label: String(mech?.name ?? mech?.id ?? "Mech").trim()
  })).filter((mech) => mech.id);
}

function inferTeamControlFromTool(builderState, tool) {
  const spawnId = tool?.startType === "emptyMech" ? tool?.mechSpawnId : tool?.pilotSpawnId;
  return getSpawnTeamControl(builderState, spawnId, "player");
}

function getSpawnTeamControl(builderState, spawnId, fallbackTeam = "player") {
  const cleanId = String(spawnId ?? "").trim();
  if (!cleanId) {
    return {
      team: fallbackTeam,
      controlType: getDefaultControlTypeForSpawnTeam(fallbackTeam)
    };
  }

  const parsed = parseSpawnId(cleanId);
  const teamFromId = SPAWN_TEAMS.includes(parsed?.team) ? parsed.team : fallbackTeam;
  const list = builderState?.authoring?.map?.spawns?.[teamFromId];
  const point = Array.isArray(list) && Number.isInteger(parsed?.index) ? list[parsed.index] : null;
  const team = SPAWN_TEAMS.includes(point?.team) ? point.team : teamFromId;
  const controlType = point?.controlType === "PC" || point?.controlType === "CPU"
    ? point.controlType
    : getDefaultControlTypeForSpawnTeam(team);

  return { team, controlType };
}

function pickValidId(currentId, options) {
  const clean = String(currentId ?? "").trim();
  if (options.some((option) => option.id === clean)) return clean;
  return options[0]?.id ?? "";
}

function pickOptionalValidId(currentId, options) {
  const clean = String(currentId ?? "").trim();
  if (!clean) return "";
  return options.some((option) => option.id === clean) ? clean : "";
}

function readField(root, name) {
  const node = root.querySelector(`[data-builder-field="${name}"]`);
  return node ? node.value : undefined;
}

function ensureStartState(map) {
  if (!map.startState || typeof map.startState !== "object") map.startState = {};
  if (!Array.isArray(map.startState.deployments)) map.startState.deployments = [];
  if (!Array.isArray(map.startState.deploymentCells)) map.startState.deploymentCells = [];
  return map.startState;
}

function getEditableBuilderMap(builderState) {
  if (builderState?.workspaceMode !== "builder-map") return null;
  return builderState?.authoring?.map ?? null;
}

function sanitizeInstancePrefix(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
