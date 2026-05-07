// src/builder/builderValidation.js
//
// Mission Builder validation V1.
// This is the first safety rail between authored builder data and runtime truth.
// Export/Test may run this module before handing data to the real loader.

import { getMapHeight, getMapWidth, getTile } from "../map.js";

const VALID_TEAMS = new Set(["player", "enemy", "neutral"]);
const VALID_CONTROL_TYPES = new Set(["PC", "CPU"]);
const VALID_EDGES = new Set(["ne", "se", "sw", "nw"]);
const PLACEHOLDER_BRIEFING_TEXT = "Builder-authored mission package. Replace this briefing text in the Mission Builder when mission authoring comes online.";

export function runBuilderValidation(builderState, appState = null, options = {}) {
  const issues = validateBuilderState(builderState, appState, options);
  if (builderState) {
    builderState.validation = issues;
    builderState.lastValidationAt = Date.now();
  }
  return issues;
}

export function hasValidationErrors(validation) {
  return (validation?.errors?.length ?? 0) > 0;
}

export function summarizeValidation(validation) {
  const errors = validation?.errors?.length ?? 0;
  const warnings = validation?.warnings?.length ?? 0;
  const info = validation?.info?.length ?? 0;
  if (errors > 0) return `${errors} error${errors === 1 ? "" : "s"} · ${warnings} warning${warnings === 1 ? "" : "s"}`;
  if (warnings > 0) return `0 errors · ${warnings} warning${warnings === 1 ? "" : "s"}`;
  return `0 errors · 0 warnings${info ? ` · ${info} info` : ""}`;
}

export function validateBuilderState(builderState, appState = null, options = {}) {
  const validation = createValidationResult();
  const map = builderState?.authoring?.map ?? null;
  const mission = builderState?.authoring?.mission ?? null;
  const requireMissionReady = options.requireMissionReady !== false;

  if (!map) {
    addError(validation, "NO_BUILDER_MAP", "No builder-owned map is active. Create or load a map before validating.");
    return validation;
  }

  validateMapIdentity(validation, map);
  validateMapTiles(validation, map);
  validateSpawns(validation, map);
  validateStartState(validation, map, appState, { requireMissionReady });
  validateStructures(validation, map);
  validateMissionShell(validation, map, mission, { requireMissionReady });

  if (!validation.errors.length && !validation.warnings.length) {
    addInfo(validation, "VALIDATION_CLEAN", "Builder package validation passed with no errors or warnings.");
  } else if (!validation.errors.length) {
    addInfo(validation, "VALIDATION_WARNINGS_ONLY", "Validation found warnings only. Export is allowed, but the warnings should be cleaned up before content lock.");
  }

  return validation;
}

function validateMapIdentity(validation, map) {
  const id = String(map?.id ?? "").trim();
  const name = String(map?.name ?? "").trim();
  const width = Number(getMapWidth(map));
  const height = Number(getMapHeight(map));

  if (!id) addError(validation, "MAP_ID_MISSING", "Map id is missing.");
  else if (!/^[a-z0-9_-]+$/i.test(id)) addError(validation, "MAP_ID_BAD_FORMAT", `Map id \"${id}\" should use only letters, numbers, underscores, or hyphens.`);

  if (!name) addWarning(validation, "MAP_NAME_MISSING", "Map name is missing. Export can still run, but Mission Select will look unfinished.");
  if (!Number.isFinite(width) || width <= 0) addError(validation, "MAP_WIDTH_INVALID", "Map width is missing or invalid.");
  if (!Number.isFinite(height) || height <= 0) addError(validation, "MAP_HEIGHT_INVALID", "Map height is missing or invalid.");
}

function validateMapTiles(validation, map) {
  const width = Number(getMapWidth(map));
  const height = Number(getMapHeight(map));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

  const missing = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!getTile(map, x, y)) missing.push(`${x},${y}`);
    }
  }

  if (missing.length) {
    const sample = missing.slice(0, 8).join("; ");
    addError(validation, "MAP_TILES_MISSING", `Map is missing ${missing.length} tile record${missing.length === 1 ? "" : "s"}. First: ${sample}.`);
  }
}

function validateSpawns(validation, map) {
  const width = Number(getMapWidth(map));
  const height = Number(getMapHeight(map));
  const seen = new Set();
  const spawns = map?.spawns ?? {};

  for (const team of ["player", "enemy", "neutral"]) {
    const list = Array.isArray(spawns?.[team]) ? spawns[team] : [];
    list.forEach((spawn, index) => {
      if (!spawn) return;
      const id = `${team}_${index + 1}`;
      const x = Number(spawn.x);
      const y = Number(spawn.y);
      if (seen.has(id)) addError(validation, "SPAWN_ID_DUPLICATE", `Duplicate spawn id ${id}.`);
      seen.add(id);
      if (!isInsideMap(map, x, y)) addError(validation, "SPAWN_OUT_OF_BOUNDS", `Spawn ${id} is outside map bounds at ${spawn.x}, ${spawn.y}.`);
      if (!VALID_TEAMS.has(spawn.team ?? team)) addError(validation, "SPAWN_TEAM_INVALID", `Spawn ${id} has invalid team ${spawn.team}.`);
      if (spawn.controlType && !VALID_CONTROL_TYPES.has(spawn.controlType)) addError(validation, "SPAWN_CONTROL_INVALID", `Spawn ${id} has invalid controlType ${spawn.controlType}.`);
    });
  }

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && !seen.size) {
    addWarning(validation, "NO_FIXED_SPAWNS", "No fixed spawns are authored. That is okay for pure deployment missions, but fixed starts will fail without spawn ids.");
  }
}

function validateStartState(validation, map, appState, { requireMissionReady }) {
  const startState = map?.startState ?? {};
  const deployments = Array.isArray(startState.deployments) ? startState.deployments : [];
  const deploymentCells = Array.isArray(startState.deploymentCells) ? startState.deploymentCells : [];
  const startMode = startState.startMode ?? "authored";
  const pilotIds = new Set((Array.isArray(appState?.content?.pilots) ? appState.content.pilots : []).map((pilot) => pilot?.id).filter(Boolean));
  const mechIds = new Set((Array.isArray(appState?.content?.mechs) ? appState.content.mechs : []).map((mech) => mech?.id).filter(Boolean));
  const seenInstanceIds = new Map();
  let playerPilotCount = 0;
  let enemyPilotCount = 0;

  if (!Array.isArray(startState.deployments)) {
    addError(validation, "DEPLOYMENTS_MISSING", "map.startState.deployments must be an array.");
  }

  deployments.forEach((entry, index) => {
    const label = `deployment ${index + 1}`;
    const team = entry?.team ?? "";
    const controlType = entry?.controlType ?? "";
    const hasPilot = Boolean(entry?.pilotDefinitionId);
    const hasMech = Boolean(entry?.mechDefinitionId);
    const isEmptyMech = hasMech && !hasPilot;
    const isPlayerDeploymentRoster = startMode === "deployment" && team === "player" && controlType === "PC" && hasPilot;

    if (!VALID_TEAMS.has(team)) addError(validation, "DEPLOYMENT_TEAM_INVALID", `${label} has invalid team ${team || "blank"}.`);
    if (!VALID_CONTROL_TYPES.has(controlType)) addError(validation, "DEPLOYMENT_CONTROL_INVALID", `${label} has invalid controlType ${controlType || "blank"}.`);

    if (!hasPilot && !hasMech) addError(validation, "DEPLOYMENT_EMPTY", `${label} has neither a pilot nor a mech.`);

    if (hasPilot) {
      if (pilotIds.size && !pilotIds.has(entry.pilotDefinitionId)) addError(validation, "PILOT_ID_INVALID", `${label} references missing pilot ${entry.pilotDefinitionId}.`);
      if (!entry.pilotInstanceId) addError(validation, "PILOT_INSTANCE_ID_MISSING", `${label} is missing pilotInstanceId.`);
      else trackInstanceId(validation, seenInstanceIds, entry.pilotInstanceId, label);
      if (!isPlayerDeploymentRoster && !entry.pilotSpawnId) addError(validation, "PILOT_SPAWN_MISSING", `${label} is a fixed pilot start but has no pilotSpawnId.`);
      if (entry.pilotSpawnId && !getSpawnById(map, entry.pilotSpawnId)) addError(validation, "PILOT_SPAWN_INVALID", `${label} references missing spawn ${entry.pilotSpawnId}.`);
      if (team === "player") playerPilotCount += 1;
      if (team === "enemy") enemyPilotCount += 1;
    }

    if (hasMech) {
      if (mechIds.size && !mechIds.has(entry.mechDefinitionId)) addError(validation, "MECH_ID_INVALID", `${label} references missing mech ${entry.mechDefinitionId}.`);
      if (!entry.mechInstanceId) addError(validation, "MECH_INSTANCE_ID_MISSING", `${label} is missing mechInstanceId.`);
      else trackInstanceId(validation, seenInstanceIds, entry.mechInstanceId, label);

      if (isEmptyMech && !entry.mechSpawnId) addError(validation, "EMPTY_MECH_SPAWN_MISSING", `${label} is an empty mech start but has no mechSpawnId.`);
      if (entry.startEmbarked && !hasPilot) addError(validation, "START_EMBARKED_WITHOUT_PILOT", `${label} has startEmbarked true without a pilot.`);
      if (entry.startEmbarked && !hasMech) addError(validation, "START_EMBARKED_WITHOUT_MECH", `${label} has startEmbarked true without a mech.`);
      if (entry.startEmbarked && hasPilot && hasMech && !entry.mechSpawnId) addError(validation, "EMBARKED_MECH_SPAWN_MISSING", `${label} starts embarked but has no mechSpawnId.`);
      if (entry.mechSpawnId && !isPlayerDeploymentRoster && !getSpawnById(map, entry.mechSpawnId)) addError(validation, "MECH_SPAWN_INVALID", `${label} references missing mech spawn ${entry.mechSpawnId}.`);
    }

    if (!hasMech && entry.startEmbarked) addError(validation, "PILOT_EMBARKED_NO_MECH", `${label} starts embarked but has no mechDefinitionId.`);
  });

  validateDeploymentCells(validation, map, deploymentCells, startState);

  if (requireMissionReady) {
    if (!deployments.length) addError(validation, "NO_UNIT_STARTS", "No unit starts are authored. Add at least one player and one enemy pilot start before exporting a playable mission.");
    if (deployments.length && playerPilotCount <= 0) addError(validation, "NO_PLAYER_PILOT", "No player pilot start is authored. Mission result logic needs at least one player-side pilot.");
    if (deployments.length && enemyPilotCount <= 0) addError(validation, "NO_ENEMY_PILOT", "No enemy pilot start is authored. Current victory logic needs at least one enemy-side pilot.");
  }
}

function validateDeploymentCells(validation, map, cells, startState) {
  if (!Array.isArray(cells)) {
    addError(validation, "DEPLOYMENT_CELLS_INVALID", "map.startState.deploymentCells must be an array.");
    return;
  }

  const seen = new Set();
  for (const cell of cells) {
    const x = Number(cell?.x);
    const y = Number(cell?.y);
    const key = `${x},${y}`;
    if (seen.has(key)) addWarning(validation, "DEPLOYMENT_CELL_DUPLICATE", `Deployment cell ${key} is duplicated.`);
    seen.add(key);
    if (!isInsideMap(map, x, y)) addError(validation, "DEPLOYMENT_CELL_OUT_OF_BOUNDS", `Deployment cell ${key} is outside map bounds.`);
    if (cell?.controlType && !VALID_CONTROL_TYPES.has(cell.controlType)) addError(validation, "DEPLOYMENT_CELL_CONTROL_INVALID", `Deployment cell ${key} has invalid controlType ${cell.controlType}.`);
  }

  const requiredCount = Number(startState?.playerDeployment?.requiredCount ?? 0);
  const unitType = startState?.playerDeployment?.unitType ?? "pilot";
  if (startState?.startMode === "deployment" && requiredCount > 0) {
    const playerCells = cells.filter((cell) => (cell?.controlType ?? "PC") === "PC");
    if (unitType === "mech") {
      const fitCenters = countValidMechDeploymentCenters(map, playerCells);
      if (fitCenters < requiredCount) {
        addError(validation, "MECH_DEPLOYMENT_ZONE_TOO_SMALL", `Player mech deployment requires ${requiredCount} 3x3 fit center${requiredCount === 1 ? "" : "s"}, but only ${fitCenters} fit.`);
      }
    } else if (playerCells.length < requiredCount) {
      addError(validation, "PILOT_DEPLOYMENT_ZONE_TOO_SMALL", `Player pilot deployment requires ${requiredCount} cell${requiredCount === 1 ? "" : "s"}, but only ${playerCells.length} player deployment cell${playerCells.length === 1 ? "" : "s"} exist.`);
    }
  }
}

function validateStructures(validation, map) {
  const structures = Array.isArray(map?.structures) ? map.structures : [];
  const globalEdges = new Set();

  structures.forEach((structure, structureIndex) => {
    const structureId = structure?.id || `structure ${structureIndex + 1}`;
    const cellKeys = new Set();
    const cells = Array.isArray(structure?.cells) ? structure.cells : [];
    const edges = Array.isArray(structure?.edges) ? structure.edges : [];

    cells.forEach((cell) => {
      const x = Number(cell?.x);
      const y = Number(cell?.y);
      const key = `${x},${y}`;
      if (cellKeys.has(key)) addWarning(validation, "STRUCTURE_CELL_DUPLICATE", `${structureId} has duplicate cell ${key}.`);
      cellKeys.add(key);
      if (!isInsideMap(map, x, y)) addError(validation, "STRUCTURE_CELL_OUT_OF_BOUNDS", `${structureId} cell ${key} is outside map bounds.`);
      if ((structure?.roof || structure?.roofSprite || structure?.roofSpriteId) && !cell?.roomId) {
        addWarning(validation, "ROOFED_CELL_MISSING_ROOM", `${structureId} cell ${key} has roofed structure data but no roomId.`);
      }
    });

    edges.forEach((edge) => {
      const x = Number(edge?.x);
      const y = Number(edge?.y);
      const side = String(edge?.edge ?? "").trim().toLowerCase();
      const key = `${x},${y},${side}`;
      const globalKey = `${structureId}:${key}`;
      const edgeHeight = Number(edge?.edgeHeight ?? edge?.height ?? edge?.heightLevels ?? 0);
      const type = String(edge?.type ?? "").trim().toLowerCase();
      const spriteId = String(edge?.spriteId ?? edge?.edgeSpriteId ?? "").trim();

      if (globalEdges.has(globalKey)) addError(validation, "STRUCTURE_EDGE_DUPLICATE", `${structureId} has duplicate edge ${key}.`);
      globalEdges.add(globalKey);
      if (!isInsideMap(map, x, y)) addError(validation, "STRUCTURE_EDGE_OUT_OF_BOUNDS", `${structureId} edge ${key} is outside map bounds.`);
      if (!VALID_EDGES.has(side)) addError(validation, "STRUCTURE_EDGE_SIDE_INVALID", `${structureId} edge ${key} uses invalid edge side ${side || "blank"}.`);
      if (!Number.isFinite(edgeHeight) || edgeHeight < 0) addError(validation, "STRUCTURE_EDGE_HEIGHT_INVALID", `${structureId} edge ${key} has invalid edgeHeight ${edge?.edgeHeight}.`);
      if (edgeHeight > 0 && !spriteId) addWarning(validation, "EDGE_HEIGHT_WITHOUT_ART", `${structureId} edge ${key} blocks movement/LOS but has no sprite art.`);
      if ((type === "door" || spriteId.toLowerCase().includes("door")) && edgeHeight > 0) addWarning(validation, "DOOR_ART_BLOCKS", `${structureId} edge ${key} looks like a door but edgeHeight is ${edgeHeight}; it will block movement/LOS.`);
      if ((type === "wall" || spriteId.toLowerCase().includes("wall")) && edgeHeight === 0) addWarning(validation, "WALL_ART_OPEN", `${structureId} edge ${key} looks like a wall but edgeHeight is 0; it is open.`);
    });
  });
}

function validateMissionShell(validation, map, mission, { requireMissionReady }) {
  const missionId = String(mission?.id ?? `${map?.id ?? "new_map"}_mission`).trim();
  const missionName = String(mission?.name ?? `${map?.name ?? "New Map"} Mission`).trim();
  if (!missionId) addError(validation, "MISSION_ID_MISSING", "Mission id is missing.");
  if (!missionName) addWarning(validation, "MISSION_NAME_MISSING", "Mission name is missing.");

  const objectives = Array.isArray(mission?.objectives) ? mission.objectives : [];
  if (!objectives.length) {
    if (requireMissionReady) addWarning(validation, "MISSION_DEFAULT_OBJECTIVE", "No authored objectives yet. Export will use default defeat_all until Objectives V1 is built.");
  }

  const briefingText = String(mission?.briefing?.text ?? "").trim();
  if (!briefingText || briefingText === PLACEHOLDER_BRIEFING_TEXT) {
    addWarning(validation, "MISSION_PLACEHOLDER_BRIEFING", "Mission briefing text is still placeholder/default text.");
  }
}

function trackInstanceId(validation, seen, id, label) {
  const clean = String(id ?? "").trim();
  if (!clean) return;
  if (seen.has(clean)) {
    addError(validation, "INSTANCE_ID_DUPLICATE", `${label} duplicates instance id ${clean}; first used by ${seen.get(clean)}.`);
    return;
  }
  seen.set(clean, label);
}

function getSpawnById(map, spawnId) {
  const parsed = parseSpawnId(spawnId);
  if (!parsed) return null;
  const list = map?.spawns?.[parsed.team];
  return Array.isArray(list) ? list[parsed.index] ?? null : null;
}

function parseSpawnId(spawnId) {
  const match = String(spawnId ?? "").trim().match(/^(player|enemy|neutral)_(\d+)$/i);
  if (!match) return null;
  return {
    team: match[1].toLowerCase(),
    index: Number(match[2]) - 1
  };
}

function countValidMechDeploymentCenters(map, cells) {
  const set = new Set(cells.map((cell) => `${Number(cell?.x)},${Number(cell?.y)}`));
  let count = 0;

  for (const cell of cells) {
    const cx = Number(cell?.x);
    const cy = Number(cell?.y);
    let fits = true;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (!isInsideMap(map, x, y) || !set.has(`${x},${y}`)) fits = false;
      }
    }
    if (fits) count += 1;
  }

  return count;
}

function isInsideMap(map, x, y) {
  const width = Number(getMapWidth(map));
  const height = Number(getMapHeight(map));
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
}

function createValidationResult() {
  return { errors: [], warnings: [], info: [] };
}

function addError(validation, code, message) {
  validation.errors.push({ severity: "error", code, message });
}

function addWarning(validation, code, message) {
  validation.warnings.push({ severity: "warning", code, message });
}

function addInfo(validation, code, message) {
  validation.info.push({ severity: "info", code, message });
}
