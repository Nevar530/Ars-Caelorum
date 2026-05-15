// src/builder/builderValidation.js
//
// Mission Builder validation V1.
// This is the first safety rail: the builder may warn about unfinished authoring,
// but export/test must block when authored data would break runtime truth.

import { getMapHeight, getMapWidth, getTile } from "../map.js";
import { parseSpawnId, SPAWN_TEAMS } from "../maps/mapSpawns.js";

const VALID_EDGE_SIDES = new Set(["ne", "se", "sw", "nw"]);
const VALID_TEAMS = new Set(["player", "enemy", "neutral"]);
const VALID_CONTROL_TYPES = new Set(["PC", "CPU"]);
const DEFAULT_BRIEFING_TEXT = "Builder-authored mission package. Replace this briefing text in the Mission Builder when mission authoring comes online.";
const VALID_OBJECTIVE_TYPES = new Set(["defeat_all", "reach_zone", "hold_zone", "survive_rounds", "trigger_complete", "protect_unit"]);
const VALID_TRIGGER_TYPES = new Set(["onUnitEnterZone", "onMissionStart", "onRoundStart", "onRoundEnd", "onEnterMech", "onExitMech", "onInteract", "onHitTarget", "onStatChange"]);
const VALID_TRIGGER_PRESETS = new Set(["load_map", "change_unit_stat", "complete_objective", "end_mission", "start_dialogue", "run_logic"]);
const VALID_TRIGGER_STATS = new Set(["core", "shield"]);
const VALID_MISSION_RESULTS = new Set(["victory", "defeat"]);
const VALID_TRIGGER_TEAMS = new Set(["player", "enemy", "any"]);
const VALID_LOGIC_CONDITIONS = new Set(["objective_complete", "objective_incomplete", "flag_true", "flag_false", "round_at_least"]);
const VALID_LOGIC_ACTIONS = new Set(["complete_objective", "change_unit_stat", "load_map", "end_mission", "start_dialogue", "set_flag", "give_item", "remove_item"]);
const VALID_MAP_MODES = new Set(["combat", "story"]);

export function validateBuilderPackage(builderState, appState = null) {
  const result = createValidationResult();
  const activeMap = builderState?.authoring?.map ?? null;
  const maps = Array.isArray(builderState?.authoring?.maps) && builderState.authoring.maps.length
    ? builderState.authoring.maps
    : activeMap ? [activeMap] : [];
  const mission = builderState?.authoring?.mission ?? null;

  if (!maps.length) {
    addError(result, "MAP_MISSING", "No builder-owned map is active. Create or load a builder map before validating.");
    return commitValidation(builderState, result);
  }

  validateMissionPackageBasics(result, mission, maps);

  for (const map of maps) {
    const width = getMapWidth(map);
    const height = getMapHeight(map);
    const mapLabel = cleanString(map?.id) || cleanString(map?.name) || "unnamed map";

    const objectives = Array.isArray(map?.objectives) && map.objectives.length
      ? map.objectives
      : (map === activeMap && Array.isArray(mission?.objectives) ? mission.objectives : []);

    validateMapBasics(result, map, width, height);
    validateTiles(result, map, width, height);
    validateSpawns(result, map, width, height);
    validateDeployments(result, map, appState, objectives);
    validateDeploymentCells(result, map, width, height);
    validateStructures(result, map, width, height);
    validateProps(result, map, width, height);

    if (!objectives.length) {
      addError(result, "MAP_NO_OBJECTIVES", `${mapLabel} has no authored objectives.`);
    } else {
      validateObjectives(result, map, objectives);
    }

    validateDialogue(result, mission);
    validateLogic(result, map, mission, objectives, appState);
    validateTriggers(result, map, mission, objectives);
  }

  addSummaryInfo(result);

  return commitValidation(builderState, result);
}

export function hasBlockingValidationErrors(validation) {
  return (validation?.errors?.length ?? 0) > 0;
}

function validateMissionPackageBasics(result, mission, maps) {
  if (!cleanString(mission?.id)) addError(result, "MISSION_ID_MISSING", "Mission id is missing.");
  if (!cleanString(mission?.name)) addWarning(result, "MISSION_NAME_MISSING", "Mission name is missing.");
  if (!mission?.briefing?.text || mission?.briefing?.text === DEFAULT_BRIEFING_TEXT) {
    addWarning(result, "MISSION_PLACEHOLDER_BRIEFING", "Mission briefing text is still placeholder/default text.");
  }

  const mapIds = new Set();
  for (const map of maps) {
    const id = cleanString(map?.id);
    if (!id) continue;
    if (mapIds.has(id)) addError(result, "MISSION_DUPLICATE_MAP_ID", `Mission package has duplicate map id "${id}".`);
    mapIds.add(id);
  }

  const startMapId = cleanString(mission?.startMapId ?? mission?.mapId);
  if (!startMapId) {
    addError(result, "MISSION_START_MAP_MISSING", "Mission package has no startMapId.");
  } else if (!mapIds.has(startMapId)) {
    addError(result, "MISSION_START_MAP_BAD", `Mission startMapId "${startMapId}" does not match any map in the package.`);
  }
}

function validateMapBasics(result, map, width, height) {
  if (!cleanString(map?.id)) addError(result, "MAP_ID_MISSING", "Map id is missing.");
  if (!cleanString(map?.name)) addWarning(result, "MAP_NAME_MISSING", "Map name is missing. Export can still run, but the catalog label will be ugly.");
  if (!Number.isInteger(width) || width <= 0) addError(result, "MAP_WIDTH_BAD", "Map width is missing or invalid.");
  if (!Number.isInteger(height) || height <= 0) addError(result, "MAP_HEIGHT_BAD", "Map height is missing or invalid.");
  const mode = cleanString(map?.mode ?? "combat").toLowerCase();
  if (!VALID_MAP_MODES.has(mode)) addError(result, "MAP_MODE_BAD", `Map mode "${mode}" must be combat or story.`);
}

function validateTiles(result, map, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return;

  let missing = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!getTile(map, x, y)) missing += 1;
    }
  }

  if (missing > 0) {
    addError(result, "MAP_TILES_MISSING", `${missing} map tile record(s) are missing.`);
  }
}

function validateSpawns(result, map, width, height) {
  const spawns = map?.spawns ?? {};
  const seen = new Set();

  for (const team of SPAWN_TEAMS) {
    const list = Array.isArray(spawns[team]) ? spawns[team] : [];
    for (let index = 0; index < list.length; index += 1) {
      const spawn = list[index];
      if (!spawn) continue;

      const spawnId = `${team}_${index + 1}`;
      const x = Number(spawn.x);
      const y = Number(spawn.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
        addError(result, "SPAWN_OUT_OF_BOUNDS", `${spawnId} is outside map bounds.`);
      }

      const key = `${x},${y}`;
      if (seen.has(key)) addWarning(result, "SPAWN_STACKED", `${spawnId} shares a tile with another spawn at ${key}.`);
      seen.add(key);
    }
  }
}

function validateDeployments(result, map, appState, objectives = []) {
  const startState = map?.startState ?? {};
  const deployments = Array.isArray(startState.deployments) ? startState.deployments : [];
  const startMode = startState.startMode ?? "authored";
  const pilotIds = new Set(getContentIds(appState?.content?.pilots));
  const mechIds = new Set(getContentIds(appState?.content?.mechs));
  const instanceIds = new Set();
  let playerPilots = 0;
  let enemyPilots = 0;

  for (let index = 0; index < deployments.length; index += 1) {
    const entry = deployments[index] ?? {};
    const label = `deployment ${index + 1}`;
    const team = cleanString(entry.team) || inferTeamFromSpawnId(entry.pilotSpawnId || entry.mechSpawnId) || "player";
    const controlType = cleanString(entry.controlType) || (team === "enemy" ? "CPU" : "PC");
    const hasPilot = Boolean(cleanString(entry.pilotDefinitionId));
    const hasMech = Boolean(cleanString(entry.mechDefinitionId));
    const isEmptyMech = hasMech && !hasPilot;
    const fixedPilotStart = hasPilot && cleanString(entry.pilotSpawnId);
    const fixedMechStart = hasMech && cleanString(entry.mechSpawnId);
    const deploymentRosterEntry = startMode === "deployment" && team === "player" && controlType === "PC" && hasPilot && !fixedPilotStart;

    if (!VALID_TEAMS.has(team)) addError(result, "DEPLOYMENT_BAD_TEAM", `${label} has invalid team "${team}".`);
    if (!VALID_CONTROL_TYPES.has(controlType)) addError(result, "DEPLOYMENT_BAD_CONTROL", `${label} has invalid controlType "${controlType}".`);

    if (hasPilot) {
      if (pilotIds.size && !pilotIds.has(entry.pilotDefinitionId)) {
        addError(result, "DEPLOYMENT_BAD_PILOT_REF", `${label} references missing pilotDefinitionId "${entry.pilotDefinitionId}".`);
      }
      if (team === "player") playerPilots += 1;
      if (team === "enemy") enemyPilots += 1;
    }

    if (hasMech && mechIds.size && !mechIds.has(entry.mechDefinitionId)) {
      addError(result, "DEPLOYMENT_BAD_MECH_REF", `${label} references missing mechDefinitionId "${entry.mechDefinitionId}".`);
    }

    if (!hasPilot && !hasMech) {
      addError(result, "DEPLOYMENT_EMPTY", `${label} has no pilot or mech definition.`);
    }

    if (hasPilot && !deploymentRosterEntry && !fixedPilotStart) {
      addError(result, "DEPLOYMENT_PILOT_SPAWN_MISSING", `${label} is a fixed pilot start but has no pilotSpawnId.`);
    }

    if (isEmptyMech && !fixedMechStart) {
      addError(result, "DEPLOYMENT_MECH_SPAWN_MISSING", `${label} is an empty mech start but has no mechSpawnId.`);
    }

    if (entry.startEmbarked === true) {
      if (!hasPilot || !hasMech) addError(result, "DEPLOYMENT_EMBARK_BAD_COMBO", `${label} has startEmbarked true but is missing pilot or mech.`);
      if (!deploymentRosterEntry && !fixedMechStart) addError(result, "DEPLOYMENT_EMBARK_MECH_SPAWN_MISSING", `${label} starts embarked but has no mechSpawnId.`);
    }

    validateSpawnReference(result, map, entry.pilotSpawnId, `${label} pilotSpawnId`);
    validateSpawnReference(result, map, entry.mechSpawnId, `${label} mechSpawnId`);

    addUniqueInstance(result, instanceIds, entry.pilotInstanceId, `${label} pilotInstanceId`);
    addUniqueInstance(result, instanceIds, entry.mechInstanceId, `${label} mechInstanceId`);
  }

  validateDeploymentFootprints(result, map, appState, deployments, startMode);

  if (playerPilots <= 0) addError(result, "MISSION_NO_PLAYER_PILOT", "Mission has no player-side pilot start or deployment roster entry.");
  if (requiresEnemyPilotsForObjectives(objectives) && enemyPilots <= 0) {
    addError(result, "MISSION_NO_ENEMY_PILOT", "A defeat_all objective targets enemies, but this map has no enemy-side pilot start.");
  }
}

function requiresEnemyPilotsForObjectives(objectives) {
  return (Array.isArray(objectives) ? objectives : []).some((objective) => {
    if (cleanString(objective?.type) !== "defeat_all") return false;
    return (cleanString(objective?.targetTeam) || "enemy") === "enemy";
  });
}


function validateDeploymentFootprints(result, map, appState, deployments, startMode) {
  if (startMode === "deployment") return;

  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const bodies = [];

  for (let index = 0; index < deployments.length; index += 1) {
    const entry = deployments[index] ?? {};
    const label = `deployment ${index + 1}`;
    const hasPilot = Boolean(cleanString(entry.pilotDefinitionId));
    const hasMech = Boolean(cleanString(entry.mechDefinitionId));
    const startsEmbarked = entry.startEmbarked === true;

    if (hasMech && cleanString(entry.mechSpawnId)) {
      const spawn = getSpawnForId(map, entry.mechSpawnId);
      const footprint = getDefinitionFootprint(appState?.content?.mechs, entry.mechDefinitionId, 3, 3);
      bodies.push(makeDeploymentBody(label, "mech", entry.mechInstanceId, spawn, footprint));
    }

    if (hasPilot && !startsEmbarked && cleanString(entry.pilotSpawnId)) {
      const spawn = getSpawnForId(map, entry.pilotSpawnId);
      const footprint = getDefinitionFootprint(appState?.content?.pilots, entry.pilotDefinitionId, 1, 1);
      bodies.push(makeDeploymentBody(label, "pilot", entry.pilotInstanceId, spawn, footprint));
    }
  }

  const occupied = new Map();

  for (const body of bodies) {
    if (!body.spawn) continue;

    for (const cell of getFootprintCells(body.spawn.x, body.spawn.y, body.footprint.width, body.footprint.height)) {
      const key = `${cell.x},${cell.y}`;
      if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
        addError(
          result,
          "DEPLOYMENT_FOOTPRINT_OUT_OF_BOUNDS",
          `${body.label} ${body.kind} footprint extends outside map bounds at ${key}.`
        );
        continue;
      }

      const previous = occupied.get(key);
      if (previous) {
        addError(
          result,
          "DEPLOYMENT_FOOTPRINT_OVERLAP",
          `${body.label} ${body.kind} footprint overlaps ${previous.label} ${previous.kind} at ${key}.`
        );
      } else {
        occupied.set(key, body);
      }
    }
  }
}

function makeDeploymentBody(label, kind, instanceId, spawn, footprint) {
  return {
    label: cleanString(instanceId) || label,
    kind,
    spawn,
    footprint
  };
}

function getDefinitionFootprint(values, id, defaultWidth, defaultHeight) {
  const cleanId = cleanString(id);
  const list = Array.isArray(values) ? values : [];
  const definition = list.find((value) => cleanString(value?.id) === cleanId) ?? null;

  return {
    width: Math.max(1, Number(definition?.footprintWidth ?? defaultWidth)),
    height: Math.max(1, Number(definition?.footprintHeight ?? defaultHeight))
  };
}

function getFootprintCells(centerX, centerY, width, height) {
  const cx = Number(centerX);
  const cy = Number(centerY);
  const w = Math.max(1, Number(width ?? 1));
  const h = Math.max(1, Number(height ?? 1));
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);
  const cells = [];

  for (let y = cy - halfH; y <= cy - halfH + h - 1; y += 1) {
    for (let x = cx - halfW; x <= cx - halfW + w - 1; x += 1) {
      cells.push({ x, y });
    }
  }

  return cells;
}

function getSpawnForId(map, spawnId) {
  const parsed = parseSpawnId(cleanString(spawnId));
  if (!parsed) return null;
  const list = map?.spawns?.[parsed.team];
  const spawn = Array.isArray(list) ? list[parsed.index] : null;
  if (!spawn) return null;

  return {
    x: Number(spawn.x),
    y: Number(spawn.y)
  };
}

function validateDeploymentCells(result, map, width, height) {
  const startState = map?.startState ?? {};
  const cells = Array.isArray(startState.deploymentCells) ? startState.deploymentCells : [];
  const playerDeployment = startState.playerDeployment ?? null;
  const requiredCount = Number(playerDeployment?.requiredCount ?? 0);
  const unitType = playerDeployment?.unitType ?? "pilot";

  if (startState.startMode !== "deployment") return;

  if (requiredCount > 0 && cells.length < requiredCount) {
    addError(result, "DEPLOYMENT_CELLS_TOO_FEW", `Player deployment requires ${requiredCount} unit(s), but only ${cells.length} deployment cell(s) exist.`);
  }

  if (unitType === "mech") {
    let fitCount = 0;
    for (const cell of cells) {
      if (canFitMechAt(map, cell?.x, cell?.y, width, height)) fitCount += 1;
    }
    if (requiredCount > 0 && fitCount < requiredCount) {
      addError(result, "DEPLOYMENT_MECH_ZONE_TOO_SMALL", `Player mech deployment requires ${requiredCount} valid 3x3 fit location(s), but only ${fitCount} fit.`);
    }
  }

  for (const cell of cells) {
    const x = Number(cell?.x);
    const y = Number(cell?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
      addError(result, "DEPLOYMENT_CELL_OUT_OF_BOUNDS", `Deployment cell ${x}, ${y} is outside map bounds.`);
    }
  }
}

function validateStructures(result, map, width, height) {
  const structures = Array.isArray(map?.structures) ? map.structures : [];
  const edgeKeys = new Set();
  const cellKeys = new Set();

  for (const structure of structures) {
    const structureId = cleanString(structure?.id) || "unnamed-structure";
    const cells = Array.isArray(structure?.cells) ? structure.cells : [];
    const edges = Array.isArray(structure?.edges) ? structure.edges : [];
    const structureVisualHeightPx = structure?.visualHeightPx == null ? null : Number(structure.visualHeightPx);
    if (structureVisualHeightPx != null && (!Number.isFinite(structureVisualHeightPx) || structureVisualHeightPx <= 0)) {
      addError(result, "STRUCTURE_BAD_VISUAL_HEIGHT", `${structureId} has invalid visualHeightPx.`);
    }

    for (const cell of cells) {
      const x = Number(cell?.x);
      const y = Number(cell?.y);
      const key = `${structureId}:${x},${y}`;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
        addError(result, "STRUCTURE_CELL_OUT_OF_BOUNDS", `${structureId} has a cell outside map bounds at ${x}, ${y}.`);
      }
      if (cellKeys.has(key)) addWarning(result, "STRUCTURE_DUPLICATE_CELL", `${structureId} has a duplicate cell at ${x}, ${y}.`);
      cellKeys.add(key);
      if (structure?.roof && !cleanString(cell?.roomId)) {
        addWarning(result, "STRUCTURE_ROOF_CELL_NO_ROOM", `${structureId} has a roofed cell at ${x}, ${y} without roomId.`);
      }
    }

    for (const edge of edges) {
      const x = Number(edge?.x);
      const y = Number(edge?.y);
      const side = cleanString(edge?.edge).toLowerCase();
      const edgeHeight = Number(edge?.edgeHeight ?? 0);
      const visualHeightPx = edge?.visualHeightPx == null ? null : Number(edge.visualHeightPx);
      const offsetX = edge?.offsetX == null ? null : Number(edge.offsetX);
      const offsetY = edge?.offsetY == null ? null : Number(edge.offsetY);
      const key = `${structureId}:${x},${y}:${side}`;

      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
        addError(result, "STRUCTURE_EDGE_OUT_OF_BOUNDS", `${structureId} has an edge outside map bounds at ${x}, ${y}.`);
      }
      if (!VALID_EDGE_SIDES.has(side)) addError(result, "STRUCTURE_EDGE_BAD_SIDE", `${structureId} has invalid edge side "${side}" at ${x}, ${y}.`);
      if (!Number.isFinite(edgeHeight) || edgeHeight < 0) addError(result, "STRUCTURE_EDGE_BAD_HEIGHT", `${structureId} has invalid edgeHeight at ${x}, ${y} ${side}.`);
      if (visualHeightPx != null && (!Number.isFinite(visualHeightPx) || visualHeightPx < 0)) addError(result, "STRUCTURE_EDGE_BAD_VISUAL_HEIGHT", `${structureId} has invalid visualHeightPx at ${x}, ${y} ${side}.`);
      if (offsetX != null && !Number.isFinite(offsetX)) addError(result, "STRUCTURE_EDGE_BAD_OFFSET", `${structureId} has invalid offsetX at ${x}, ${y} ${side}.`);
      if (offsetY != null && !Number.isFinite(offsetY)) addError(result, "STRUCTURE_EDGE_BAD_OFFSET", `${structureId} has invalid offsetY at ${x}, ${y} ${side}.`);
      if (edgeKeys.has(key)) addError(result, "STRUCTURE_DUPLICATE_EDGE", `${structureId} has duplicate edge at ${x}, ${y} ${side}.`);
      edgeKeys.add(key);

      const type = cleanString(edge?.type).toLowerCase();
      const spriteId = cleanString(edge?.spriteId);
      if (edgeHeight > 0 && !spriteId) addWarning(result, "STRUCTURE_EDGE_NO_SPRITE", `${structureId} edge ${x}, ${y} ${side} blocks movement/LOS but has no sprite.`);
      if (type === "wall" && edgeHeight <= 0) addWarning(result, "STRUCTURE_WALL_OPEN_HEIGHT", `${structureId} wall edge ${x}, ${y} ${side} has edgeHeight 0.`);
      if (type === "door" && edgeHeight > 0) addWarning(result, "STRUCTURE_DOOR_BLOCKING", `${structureId} door edge ${x}, ${y} ${side} has positive edgeHeight.`);
    }
  }
}

function validateProps(result, map, width, height) {
  const props = Array.isArray(map?.props) ? map.props : [];
  const bounds = getEffectiveMapBounds(map, width, height);
  const propWidth = bounds.width;
  const propHeight = bounds.height;
  const ids = new Set();

  for (const prop of props) {
    const id = cleanString(prop?.id) || "unnamed-prop";
    const x = Number(prop?.x);
    const y = Number(prop?.y);
    const footprintW = Number(prop?.footprintW ?? prop?.w ?? prop?.width ?? 1);
    const footprintH = Number(prop?.footprintH ?? prop?.h ?? prop?.heightTiles ?? 1);
    const height = Number(prop?.height ?? prop?.losHeight ?? prop?.heightLevels ?? 0);
    const visualHeight = Number(prop?.visualHeight ?? prop?.visualHeightLevels ?? height);
    const scale = Number(prop?.scale ?? 1);
    const layer = cleanString(prop?.layer || "samePlane");

    if (ids.has(id)) addWarning(result, "PROP_DUPLICATE_ID", `Duplicate prop id ${id}.`);
    ids.add(id);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= propWidth || y >= propHeight) {
      addError(result, "PROP_OUT_OF_BOUNDS", `${id} starts outside map bounds at ${x}, ${y}.`);
    }
    if (!Number.isInteger(footprintW) || footprintW < 1) addError(result, "PROP_BAD_FOOTPRINT", `${id} has invalid footprintW.`);
    if (!Number.isInteger(footprintH) || footprintH < 1) addError(result, "PROP_BAD_FOOTPRINT", `${id} has invalid footprintH.`);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(footprintW) && Number.isFinite(footprintH) && (x + footprintW > propWidth || y + footprintH > propHeight)) {
      addWarning(result, "PROP_FOOTPRINT_CROPS", `${id} footprint extends beyond map bounds.`);
    }
    if (!Number.isFinite(height) || height < 0) addError(result, "PROP_BAD_HEIGHT", `${id} has invalid height.`);
    if (!Number.isFinite(visualHeight) || visualHeight < 0) addError(result, "PROP_BAD_VISUAL_HEIGHT", `${id} has invalid visualHeight.`);
    if (!Number.isFinite(scale) || scale <= 0) addError(result, "PROP_BAD_SCALE", `${id} has invalid scale.`);
    if (!["belowUnits", "samePlane", "aboveUnits", "roofOverlay"].includes(layer)) addWarning(result, "PROP_BAD_LAYER", `${id} has unknown layer ${layer}.`);
    if (!cleanString(prop?.spriteId ?? prop?.sprite ?? prop?.image)) addWarning(result, "PROP_NO_SPRITE", `${id} has no spriteId.`);
  }
}

function getEffectiveMapBounds(map, width, height) {
  let effectiveWidth = Number.isFinite(width) ? width : 0;
  let effectiveHeight = Number.isFinite(height) ? height : 0;

  if (Array.isArray(map)) {
    effectiveHeight = Math.max(effectiveHeight, map.length);
    for (const row of map) {
      if (Array.isArray(row)) effectiveWidth = Math.max(effectiveWidth, row.length);
    }
  }

  if (Array.isArray(map?.tiles)) {
    for (const tile of map.tiles) {
      const x = Number(tile?.x);
      const y = Number(tile?.y);
      if (Number.isFinite(x)) effectiveWidth = Math.max(effectiveWidth, Math.floor(x) + 1);
      if (Number.isFinite(y)) effectiveHeight = Math.max(effectiveHeight, Math.floor(y) + 1);
    }
  }

  return { width: effectiveWidth, height: effectiveHeight };
}

function validateMissionShell(result, map, mission) {
  if (!mission?.id) addWarning(result, "MISSION_ID_DEFAULT", "Mission id is currently generated from the map id. Mission Package authoring should set it later.");
  if (!mission?.briefing?.text || mission?.briefing?.text === DEFAULT_BRIEFING_TEXT) {
    addWarning(result, "MISSION_PLACEHOLDER_BRIEFING", "Mission briefing text is still placeholder/default text.");
  }

  const objectives = Array.isArray(mission?.objectives) ? mission.objectives : [];
  if (!objectives.length) {
    addError(result, "MISSION_NO_OBJECTIVES", "No authored objectives exist. Add an objective before Test Mission or Export.");
    return;
  }

  validateObjectives(result, map, objectives);
}


function validateObjectives(result, map, objectives) {
  const ids = new Set();
  const deployedUnitIds = getDeploymentInstanceIds(map);
  const width = getMapWidth(map);
  const height = getMapHeight(map);

  for (let index = 0; index < objectives.length; index += 1) {
    const objective = objectives[index] ?? {};
    const label = `objective ${index + 1}`;
    const id = cleanString(objective.id);
    const type = cleanString(objective.type);

    if (!id) addError(result, "OBJECTIVE_ID_MISSING", `${label} is missing an id.`);
    else if (ids.has(id)) addError(result, "OBJECTIVE_ID_DUPLICATE", `${label} duplicates objective id "${id}".`);
    ids.add(id);

    if (!VALID_OBJECTIVE_TYPES.has(type)) {
      addError(result, "OBJECTIVE_TYPE_BAD", `${label} has unsupported type "${type}".`);
      continue;
    }

    if (!cleanString(objective.label)) addWarning(result, "OBJECTIVE_LABEL_MISSING", `${label} has no HUD label.`);
    if (!cleanString(objective.briefingText)) addWarning(result, "OBJECTIVE_BRIEFING_MISSING", `${label} has no briefing text.`);

    if (type === "defeat_all") {
      const targetTeam = cleanString(objective.targetTeam) || "enemy";
      if (!VALID_TEAMS.has(targetTeam)) addError(result, "OBJECTIVE_TARGET_TEAM_BAD", `${label} has invalid targetTeam "${targetTeam}".`);
    }

    if (type === "reach_zone" || type === "hold_zone") {
      const team = cleanString(objective.team) || "player";
      if (!VALID_TEAMS.has(team)) addError(result, "OBJECTIVE_TEAM_BAD", `${label} has invalid team "${team}".`);
      const tiles = Array.isArray(objective.tiles) ? objective.tiles : [];
      if (!tiles.length) addError(result, "OBJECTIVE_ZONE_EMPTY", `${label} needs at least one painted zone tile.`);
      for (const tile of tiles) {
        const x = Number(tile?.x);
        const y = Number(tile?.y);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
          addError(result, "OBJECTIVE_ZONE_OUT_OF_BOUNDS", `${label} has zone tile outside map bounds at ${x}, ${y}.`);
        }
      }
    }

    if (type === "protect_unit") {
      const targetUnitId = cleanString(objective.targetUnitId ?? objective.unitId ?? objective.targetPilotInstanceId);
      if (!targetUnitId) addError(result, "OBJECTIVE_PROTECT_UNIT_MISSING", `${label} needs a protected unit instance id.`);
      else if (!deployedUnitIds.has(targetUnitId)) addError(result, "OBJECTIVE_PROTECT_UNIT_BAD", `${label} protects missing unit instance "${targetUnitId}".`);
    }

    if (type === "hold_zone" || type === "survive_rounds") {
      const rounds = Number(objective.roundsRequired ?? objective.rounds ?? 0);
      if (!Number.isInteger(rounds) || rounds < 1) addError(result, "OBJECTIVE_ROUNDS_BAD", `${label} needs roundsRequired of 1 or more.`);
    }
  }
}

function getDeploymentInstanceIds(map) {
  const ids = new Set();
  const deployments = Array.isArray(map?.startState?.deployments) ? map.startState.deployments : [];
  for (const entry of deployments) {
    if (entry?.pilotInstanceId) ids.add(String(entry.pilotInstanceId));
    if (entry?.mechInstanceId) ids.add(String(entry.mechInstanceId));
  }
  return ids;
}

function validateTriggers(result, map, mission, objectives) {
  const triggers = Array.isArray(map?.triggers) ? map.triggers : [];
  if (!triggers.length) return;

  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const activeMapId = cleanString(map?.id);
  const missionMapIds = new Set((Array.isArray(mission?.maps) ? mission.maps : [])
    .map((entry) => cleanString(entry?.id ?? entry?.mapId))
    .filter(Boolean));
  if (activeMapId) missionMapIds.add(activeMapId);

  const objectiveIds = new Set((Array.isArray(objectives) ? objectives : [])
    .map((objective) => cleanString(objective?.id))
    .filter(Boolean));
  const logicIds = new Set((Array.isArray(map?.logic) ? map.logic : [])
    .map((chain) => cleanString(chain?.id))
    .filter(Boolean));
  const dialogueIds = getDialogueIds(mission);
  const ids = new Set();

  for (let index = 0; index < triggers.length; index += 1) {
    const trigger = triggers[index] ?? {};
    const label = `trigger ${index + 1}`;
    const id = cleanString(trigger.id);
    const type = cleanString(trigger.type);
    const preset = cleanString(trigger.preset);
    const team = cleanString(trigger.team) || "player";

    if (!id) addError(result, "TRIGGER_ID_MISSING", `${label} is missing an id.`);
    else if (ids.has(id)) addError(result, "TRIGGER_ID_DUPLICATE", `${label} duplicates trigger id "${id}".`);
    ids.add(id);

    if (!VALID_TRIGGER_TYPES.has(type)) addError(result, "TRIGGER_TYPE_BAD", `${label} has unsupported type "${type}".`);
    if (!VALID_TRIGGER_PRESETS.has(preset)) addError(result, "TRIGGER_PRESET_BAD", `${label} has unsupported preset "${preset}".`);
    if (!VALID_TRIGGER_TEAMS.has(team)) addError(result, "TRIGGER_TEAM_BAD", `${label} has invalid team filter "${team}".`);

    if (type === "onUnitEnterZone" || type === "onInteract") {
      const tiles = Array.isArray(trigger.tiles) ? trigger.tiles : [];
      if (!tiles.length) addError(result, "TRIGGER_ZONE_EMPTY", `${label} needs at least one painted zone tile.`);
      for (const tile of tiles) {
        const x = Number(tile?.x);
        const y = Number(tile?.y);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
          addError(result, "TRIGGER_ZONE_OUT_OF_BOUNDS", `${label} has zone tile outside map bounds at ${x}, ${y}.`);
        }
      }
    }

    if (preset === "load_map") {
      const nextMapId = cleanString(trigger.nextMapId);
      if (!nextMapId) {
        addError(result, "TRIGGER_LOAD_MAP_MISSING", `${label} load_map preset needs nextMapId.`);
      } else if (!missionMapIds.has(nextMapId)) {
        addError(result, "TRIGGER_LOAD_MAP_BAD", `${label} nextMapId "${nextMapId}" is not in this mission package.`);
      } else if (nextMapId === activeMapId) {
        addError(result, "TRIGGER_LOAD_MAP_SELF", `${label} loads the current map. V1 blocks self-load to avoid reload loops.`);
      }

      validateTriggerObjectiveReference(result, trigger, objectiveIds, label, false);
    }

    if (preset === "complete_objective") {
      validateTriggerObjectiveReference(result, trigger, objectiveIds, label, true);
    }

    if (preset === "change_unit_stat") {
      const stat = cleanString(trigger.stat) || "core";
      const value = Number(trigger.value);
      if (!VALID_TRIGGER_STATS.has(stat)) addError(result, "TRIGGER_STAT_BAD", `${label} change_unit_stat has invalid stat "${stat}".`);
      if (!Number.isInteger(value) || value === 0) addError(result, "TRIGGER_VALUE_BAD", `${label} change_unit_stat needs a non-zero whole-number value.`);
    }

    if (preset === "end_mission") {
      const missionResult = cleanString(trigger.missionResult) || "victory";
      if (!VALID_MISSION_RESULTS.has(missionResult)) addError(result, "TRIGGER_RESULT_BAD", `${label} end_mission has invalid missionResult "${missionResult}".`);
    }

    if (preset === "start_dialogue") {
      const dialogueKey = cleanString(trigger.dialogueKey);
      if (!dialogueKey) addError(result, "TRIGGER_DIALOGUE_MISSING", `${label} start_dialogue preset needs dialogueKey.`);
      else if (!dialogueIds.has(dialogueKey)) addError(result, "TRIGGER_DIALOGUE_BAD", `${label} references missing dialogue block "${dialogueKey}".`);
    }

    if (preset === "run_logic") {
      const logicChainId = cleanString(trigger.logicChainId);
      if (!logicChainId) addError(result, "TRIGGER_LOGIC_MISSING", `${label} run_logic preset needs logicChainId.`);
      else if (!logicIds.has(logicChainId)) addError(result, "TRIGGER_LOGIC_BAD", `${label} references missing logic chain "${logicChainId}".`);
    }
  }
}

function validateLogic(result, map, mission, objectives, appState = null) {
  const logic = Array.isArray(map?.logic) ? map.logic : [];
  if (!logic.length) return;

  const activeMapId = cleanString(map?.id);
  const missionMapIds = new Set((Array.isArray(mission?.maps) ? mission.maps : [])
    .map((entry) => cleanString(entry?.id ?? entry?.mapId))
    .filter(Boolean));
  if (activeMapId) missionMapIds.add(activeMapId);

  const objectiveIds = new Set((Array.isArray(objectives) ? objectives : [])
    .map((objective) => cleanString(objective?.id))
    .filter(Boolean));
  const dialogueIds = getDialogueIds(mission);
  const itemIds = new Set([
    ...getContentIds(appState?.content?.pilotItems),
    ...getContentIds(appState?.content?.mechItems)
  ]);
  const ids = new Set();

  for (let index = 0; index < logic.length; index += 1) {
    const chain = logic[index] ?? {};
    const label = `logic chain ${index + 1}`;
    const id = cleanString(chain.id);
    if (!id) addError(result, "LOGIC_ID_MISSING", `${label} is missing an id.`);
    else if (ids.has(id)) addError(result, "LOGIC_ID_DUPLICATE", `${label} duplicates logic id "${id}".`);
    ids.add(id);

    const conditions = Array.isArray(chain.conditions) ? chain.conditions : [];
    for (let c = 0; c < conditions.length; c += 1) {
      const condition = conditions[c] ?? {};
      const conditionLabel = `${label} condition ${c + 1}`;
      const type = cleanString(condition.type);
      if (!VALID_LOGIC_CONDITIONS.has(type)) addError(result, "LOGIC_CONDITION_BAD", `${conditionLabel} has unsupported condition "${type}".`);
      if ((type === "objective_complete" || type === "objective_incomplete") && !objectiveIds.has(cleanString(condition.objectiveId))) {
        addError(result, "LOGIC_CONDITION_OBJECTIVE_BAD", `${conditionLabel} references missing objective "${cleanString(condition.objectiveId)}".`);
      }
      if ((type === "flag_true" || type === "flag_false") && !cleanString(condition.flagId)) {
        addError(result, "LOGIC_CONDITION_FLAG_MISSING", `${conditionLabel} needs flagId.`);
      }
      if (type === "round_at_least") {
        const round = Number(condition.round);
        if (!Number.isInteger(round) || round < 1) addError(result, "LOGIC_CONDITION_ROUND_BAD", `${conditionLabel} needs round of 1 or more.`);
      }
    }

    const actions = Array.isArray(chain.actions) ? chain.actions : [];
    if (!actions.length) addError(result, "LOGIC_ACTIONS_EMPTY", `${label} needs at least one action.`);

    for (let a = 0; a < actions.length; a += 1) {
      const action = actions[a] ?? {};
      const actionLabel = `${label} action ${a + 1}`;
      const type = cleanString(action.type);
      if (!VALID_LOGIC_ACTIONS.has(type)) addError(result, "LOGIC_ACTION_BAD", `${actionLabel} has unsupported action "${type}".`);

      if (type === "complete_objective" && !objectiveIds.has(cleanString(action.objectiveId))) {
        addError(result, "LOGIC_ACTION_OBJECTIVE_BAD", `${actionLabel} references missing objective "${cleanString(action.objectiveId)}".`);
      }
      if (type === "change_unit_stat") {
        const stat = cleanString(action.stat) || "core";
        const value = Number(action.value);
        if (!VALID_TRIGGER_STATS.has(stat)) addError(result, "LOGIC_ACTION_STAT_BAD", `${actionLabel} has invalid stat "${stat}".`);
        if (!Number.isInteger(value) || value === 0) addError(result, "LOGIC_ACTION_VALUE_BAD", `${actionLabel} needs a non-zero whole-number value.`);
      }
      if (type === "load_map") {
        const nextMapId = cleanString(action.nextMapId);
        if (!nextMapId) addError(result, "LOGIC_ACTION_LOAD_MAP_MISSING", `${actionLabel} needs nextMapId.`);
        else if (!missionMapIds.has(nextMapId)) addError(result, "LOGIC_ACTION_LOAD_MAP_BAD", `${actionLabel} nextMapId "${nextMapId}" is not in this mission package.`);
        else if (nextMapId === activeMapId) addError(result, "LOGIC_ACTION_LOAD_MAP_SELF", `${actionLabel} loads the current map. V1 blocks self-load to avoid reload loops.`);
      }
      if (type === "end_mission") {
        const missionResult = cleanString(action.missionResult) || "victory";
        if (!VALID_MISSION_RESULTS.has(missionResult)) addError(result, "LOGIC_ACTION_RESULT_BAD", `${actionLabel} has invalid missionResult "${missionResult}".`);
      }
      if (type === "start_dialogue") {
        const dialogueKey = cleanString(action.dialogueKey);
        if (!dialogueKey) addError(result, "LOGIC_ACTION_DIALOGUE_MISSING", `${actionLabel} needs dialogueKey.`);
        else if (!dialogueIds.has(dialogueKey)) addError(result, "LOGIC_ACTION_DIALOGUE_BAD", `${actionLabel} references missing dialogue block "${dialogueKey}".`);
      }
      if (type === "set_flag" && !cleanString(action.flagId)) {
        addError(result, "LOGIC_ACTION_FLAG_MISSING", `${actionLabel} needs flagId.`);
      }
      if (type === "give_item" || type === "remove_item") {
        const itemId = cleanString(action.itemId);
        if (!itemId) addError(result, "LOGIC_ACTION_ITEM_MISSING", `${actionLabel} needs itemId.`);
        else if (itemIds.size && !itemIds.has(itemId)) addWarning(result, "LOGIC_ACTION_ITEM_UNKNOWN", `${actionLabel} itemId "${itemId}" is not in pilot/mech item content.`);
      }
    }
  }
}

function validateDialogue(result, mission) {
  const dialogue = mission?.dialogue;
  if (!dialogue || typeof dialogue !== "object" || Array.isArray(dialogue)) {
    addWarning(result, "DIALOGUE_MISSING", "Mission has no dialogue object. Intro/victory/defeat dialogue will be empty.");
    return;
  }

  for (const key of ["intro", "victory", "defeat"]) {
    if (!dialogue[key]) addWarning(result, "DIALOGUE_CORE_BLOCK_MISSING", `Mission dialogue is missing core block "${key}".`);
  }

  const ids = new Set();
  for (const [key, block] of Object.entries(dialogue)) {
    const cleanKey = cleanString(key);
    if (!cleanKey) addError(result, "DIALOGUE_KEY_MISSING", "A dialogue block has a blank key.");
    else if (ids.has(cleanKey)) addError(result, "DIALOGUE_KEY_DUPLICATE", `Dialogue block key "${cleanKey}" is duplicated.`);
    ids.add(cleanKey);

    const lines = Array.isArray(block?.lines) ? block.lines : [];
    if (!lines.length) addWarning(result, "DIALOGUE_BLOCK_EMPTY", `Dialogue block "${cleanKey}" has no lines.`);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? {};
      if (!cleanString(line.text)) addError(result, "DIALOGUE_LINE_TEXT_MISSING", `Dialogue block "${cleanKey}" line ${index + 1} has no text.`);
      if (!cleanString(line.name) && !cleanString(line.speakerId)) addWarning(result, "DIALOGUE_LINE_SPEAKER_MISSING", `Dialogue block "${cleanKey}" line ${index + 1} has no speaker.`);
    }
  }
}

function getDialogueIds(mission) {
  const dialogue = mission?.dialogue;
  if (!dialogue || typeof dialogue !== "object" || Array.isArray(dialogue)) return new Set();
  return new Set(Object.keys(dialogue).map(cleanString).filter(Boolean));
}

function validateTriggerObjectiveReference(result, trigger, objectiveIds, label, required) {
  const completeObjectiveId = cleanString(trigger.completeObjectiveId);
  if (!completeObjectiveId) {
    if (required) addError(result, "TRIGGER_COMPLETE_OBJECTIVE_MISSING", `${label} needs completeObjectiveId.`);
    return;
  }
  if (!objectiveIds.has(completeObjectiveId)) {
    addError(result, "TRIGGER_COMPLETE_OBJECTIVE_BAD", `${label} completeObjectiveId "${completeObjectiveId}" does not match an objective on this map.`);
  }
}


function validateSpawnReference(result, map, spawnId, label) {
  const cleanId = cleanString(spawnId);
  if (!cleanId) return;
  const parsed = parseSpawnId(cleanId);
  if (!parsed || !SPAWN_TEAMS.includes(parsed.team) || !Number.isInteger(parsed.index)) {
    addError(result, "SPAWN_REF_BAD_FORMAT", `${label} "${cleanId}" is not a valid spawn id.`);
    return;
  }
  const list = map?.spawns?.[parsed.team];
  const spawn = Array.isArray(list) ? list[parsed.index] : null;
  if (!spawn) addError(result, "SPAWN_REF_MISSING", `${label} references missing spawn "${cleanId}".`);
}

function addUniqueInstance(result, instanceIds, value, label) {
  const clean = cleanString(value);
  if (!clean) return;
  if (instanceIds.has(clean)) addError(result, "DEPLOYMENT_DUPLICATE_INSTANCE_ID", `${label} duplicates instance id "${clean}".`);
  instanceIds.add(clean);
}

function canFitMechAt(map, centerX, centerY, width, height) {
  const cx = Number(centerX);
  const cy = Number(centerY);
  if (!Number.isInteger(cx) || !Number.isInteger(cy)) return false;
  for (let y = cy - 1; y <= cy + 1; y += 1) {
    for (let x = cx - 1; x <= cx + 1; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      if (!getTile(map, x, y)) return false;
    }
  }
  return true;
}

function getContentIds(values) {
  return Array.isArray(values) ? values.map((value) => cleanString(value?.id ?? value)).filter(Boolean) : [];
}

function inferTeamFromSpawnId(spawnId) {
  const parsed = parseSpawnId(cleanString(spawnId));
  return parsed?.team ?? null;
}

function addSummaryInfo(result) {
  if (result.errors.length > 0) {
    addInfo(result, "VALIDATION_BLOCKING_ERRORS", "Export and Test Mission are blocked until errors are fixed. Warnings can wait.");
  } else if (result.warnings.length > 0) {
    addInfo(result, "VALIDATION_WARNINGS_ONLY", "Validation found warnings only. Export is allowed, but warnings should be cleaned up before content lock.");
  } else {
    addInfo(result, "VALIDATION_CLEAN", "Validation found no errors or warnings.");
  }
}

function createValidationResult() {
  return {
    errors: [],
    warnings: [],
    info: [],
    checkedAt: new Date().toISOString()
  };
}

function commitValidation(builderState, result) {
  if (builderState) builderState.validation = result;
  return result;
}

function addError(result, code, message) {
  result.errors.push({ level: "error", code, message });
}

function addWarning(result, code, message) {
  result.warnings.push({ level: "warning", code, message });
}

function addInfo(result, code, message) {
  result.info.push({ level: "info", code, message });
}

function cleanString(value) {
  return String(value ?? "").trim();
}
