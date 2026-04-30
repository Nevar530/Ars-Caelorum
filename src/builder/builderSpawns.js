// src/builder/builderSpawns.js
//
// Builder-owned spawn/deployment authoring helpers.
// These helpers write the same map.startState / map.spawns data shape that
// the runtime deployment and mission loader already consume.

import {
  buildSpawnId,
  clearSpawnIdFromTiles,
  ensureMapSpawns
} from "../maps/mapSpawns.js";
import {
  getMapHeight,
  getMapWidth,
  getTile
} from "../map.js";

const SPAWN_TEAMS = ["player", "enemy"];
const CONTROL_TYPES = ["PC", "CPU"];
const UNIT_TYPES = ["pilot", "mech"];
const TOOL_MODES = ["spawn", "deployment"];
const MAX_SPAWN_SLOTS = 8;

export function createDefaultSpawnTool() {
  return {
    mode: "spawn",
    team: "player",
    slot: 1,
    spawnErase: false,
    deploymentUnitType: "pilot",
    deploymentControlType: "PC",
    deploymentErase: false,
    playerDeploymentUnitType: "pilot",
    requiredCount: 2
  };
}

export function ensureSpawnToolSettings(builderState) {
  if (!builderState) return null;
  if (!builderState.spawnTool) builderState.spawnTool = createDefaultSpawnTool();

  const tool = builderState.spawnTool;
  tool.mode = TOOL_MODES.includes(tool.mode) ? tool.mode : "spawn";
  tool.team = SPAWN_TEAMS.includes(tool.team) ? tool.team : "player";
  tool.slot = clampWholeNumber(tool.slot, 1, 1, MAX_SPAWN_SLOTS);
  tool.spawnErase = Boolean(tool.spawnErase);
  tool.deploymentUnitType = UNIT_TYPES.includes(tool.deploymentUnitType) ? tool.deploymentUnitType : "pilot";
  tool.deploymentControlType = CONTROL_TYPES.includes(tool.deploymentControlType) ? tool.deploymentControlType : "PC";
  tool.deploymentErase = Boolean(tool.deploymentErase);
  tool.playerDeploymentUnitType = UNIT_TYPES.includes(tool.playerDeploymentUnitType) ? tool.playerDeploymentUnitType : tool.deploymentUnitType;
  tool.requiredCount = clampWholeNumber(tool.requiredCount, 2, 0, 12);
  return tool;
}

export function updateSpawnToolFromFields(builderState, root) {
  const tool = ensureSpawnToolSettings(builderState);
  if (!tool || !root) return tool;

  const mode = root.querySelector('[data-builder-field="spawn-tool-mode"]')?.value;
  const team = root.querySelector('[data-builder-field="spawn-team"]')?.value;
  const slot = root.querySelector('[data-builder-field="spawn-slot"]')?.value;
  const deploymentUnitType = root.querySelector('[data-builder-field="deployment-unit-type"]')?.value;
  const deploymentControlType = root.querySelector('[data-builder-field="deployment-control-type"]')?.value;
  const playerDeploymentUnitType = root.querySelector('[data-builder-field="player-deployment-unit-type"]')?.value;
  const requiredCount = root.querySelector('[data-builder-field="deployment-required-count"]')?.value;

  if (mode !== undefined) tool.mode = TOOL_MODES.includes(mode) ? mode : tool.mode;
  if (team !== undefined) tool.team = SPAWN_TEAMS.includes(team) ? team : tool.team;
  if (slot !== undefined) tool.slot = clampWholeNumber(slot, tool.slot, 1, MAX_SPAWN_SLOTS);
  if (deploymentUnitType !== undefined) tool.deploymentUnitType = UNIT_TYPES.includes(deploymentUnitType) ? deploymentUnitType : tool.deploymentUnitType;
  if (deploymentControlType !== undefined) tool.deploymentControlType = CONTROL_TYPES.includes(deploymentControlType) ? deploymentControlType : tool.deploymentControlType;
  if (playerDeploymentUnitType !== undefined) tool.playerDeploymentUnitType = UNIT_TYPES.includes(playerDeploymentUnitType) ? playerDeploymentUnitType : tool.playerDeploymentUnitType;
  if (requiredCount !== undefined) tool.requiredCount = clampWholeNumber(requiredCount, tool.requiredCount, 0, 12);

  return ensureSpawnToolSettings(builderState);
}

export function isSpawnAuthoringActive(builderState) {
  return builderState?.workspaceMode === "builder-map" && builderState?.activeTab === "spawns";
}

export function setSpawnEraseMode(builderState, enabled = true) {
  const tool = ensureSpawnToolSettings(builderState);
  if (!tool) return null;
  tool.spawnErase = Boolean(enabled);
  if (tool.spawnErase) tool.deploymentErase = false;
  return tool;
}

export function setDeploymentEraseMode(builderState, enabled = true) {
  const tool = ensureSpawnToolSettings(builderState);
  if (!tool) return null;
  tool.deploymentErase = Boolean(enabled);
  if (tool.deploymentErase) tool.spawnErase = false;
  return tool;
}

export function resetSpawnToolToDefaults(builderState) {
  if (!builderState) return null;
  builderState.spawnTool = createDefaultSpawnTool();
  return builderState.spawnTool;
}

export function applySpawnAuthoringAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Spawn/deployment editing is only available on builder-owned maps." };

  const tool = ensureSpawnToolSettings(builderState);
  const tileX = Number(x);
  const tileY = Number(y);
  const tile = getTile(map, tileX, tileY);
  if (!tile) return { ok: false, message: "No valid tile under spawn/deployment brush." };

  if (tool.mode === "deployment") {
    return tool.deploymentErase
      ? eraseDeploymentCellAt(builderState, map, tileX, tileY)
      : paintDeploymentCellAt(builderState, map, tileX, tileY, tool);
  }

  return tool.spawnErase
    ? eraseSpawnAt(builderState, map, tileX, tileY)
    : paintSpawnAt(builderState, map, tileX, tileY, tool);
}

export function applyDeploymentSettings(builderState) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Deployment settings require a builder-owned map." };
  const tool = ensureSpawnToolSettings(builderState);
  const startState = ensureStartState(map);
  startState.startMode = "deployment";
  startState.playerDeployment = {
    unitType: tool.playerDeploymentUnitType,
    requiredCount: tool.requiredCount
  };
  builderState.dirty = true;
  return {
    ok: true,
    message: `Deployment start set to ${tool.playerDeploymentUnitType}, required ${tool.requiredCount}.`
  };
}

function paintSpawnAt(builderState, map, x, y, tool) {
  const spawns = ensureSizedMapSpawns(map);
  const team = tool.team;
  const index = tool.slot - 1;
  const spawnId = buildSpawnId(team, index);
  const tile = getTile(map, x, y);

  clearSpawnIdFromTiles(map, spawnId, getMapWidth, getMapHeight, getTile);
  clearAnySpawnAtTile(map, x, y);

  spawns[team][index] = { x, y };
  tile.spawnId = spawnId;
  tile.spawnTeam = team;
  map.tiles = flattenMapTiles(map);
  builderState.dirty = true;

  return {
    ok: true,
    message: `Placed ${team} spawn ${index + 1} at ${x}, ${y}.`
  };
}

function eraseSpawnAt(builderState, map, x, y) {
  const removed = clearAnySpawnAtTile(map, x, y);
  const tile = getTile(map, x, y);
  if (tile) {
    tile.spawnId = null;
    delete tile.spawnTeam;
  }
  map.tiles = flattenMapTiles(map);
  if (removed) builderState.dirty = true;

  return {
    ok: true,
    message: removed ? `Removed spawn at ${x}, ${y}.` : `No spawn at ${x}, ${y}.`
  };
}

function paintDeploymentCellAt(builderState, map, x, y, tool) {
  const startState = ensureStartState(map);
  const cells = Array.isArray(startState.deploymentCells) ? startState.deploymentCells : [];
  const existingIndex = cells.findIndex((cell) => Number(cell?.x) === x && Number(cell?.y) === y);
  const nextCell = {
    x,
    y,
    unitType: tool.deploymentUnitType,
    controlType: tool.deploymentControlType
  };

  if (existingIndex >= 0) cells[existingIndex] = { ...cells[existingIndex], ...nextCell };
  else cells.push(nextCell);

  startState.deploymentCells = cells;
  startState.startMode = "deployment";
  startState.playerDeployment = {
    unitType: tool.playerDeploymentUnitType,
    requiredCount: tool.requiredCount
  };
  builderState.dirty = true;

  return {
    ok: true,
    message: `Painted ${tool.deploymentControlType} ${tool.deploymentUnitType} deployment cell at ${x}, ${y}.`
  };
}

function eraseDeploymentCellAt(builderState, map, x, y) {
  const startState = ensureStartState(map);
  const before = startState.deploymentCells.length;
  startState.deploymentCells = startState.deploymentCells.filter((cell) => Number(cell?.x) !== x || Number(cell?.y) !== y);
  const removed = before - startState.deploymentCells.length;
  if (removed > 0) builderState.dirty = true;
  return {
    ok: true,
    message: removed > 0 ? `Removed deployment cell at ${x}, ${y}.` : `No deployment cell at ${x}, ${y}.`
  };
}

function clearAnySpawnAtTile(map, x, y) {
  const spawns = ensureSizedMapSpawns(map);
  let removed = false;

  for (const team of SPAWN_TEAMS) {
    for (let index = 0; index < spawns[team].length; index += 1) {
      const point = spawns[team][index];
      if (Number(point?.x) === x && Number(point?.y) === y) {
        const spawnId = buildSpawnId(team, index);
        clearSpawnIdFromTiles(map, spawnId, getMapWidth, getMapHeight, getTile);
        spawns[team][index] = null;
        removed = true;
      }
    }
  }

  return removed;
}

function ensureSizedMapSpawns(map) {
  const spawns = ensureMapSpawns(map);
  for (const team of SPAWN_TEAMS) {
    if (!Array.isArray(spawns[team])) spawns[team] = [];
    while (spawns[team].length < MAX_SPAWN_SLOTS) spawns[team].push(null);
  }
  return spawns;
}

function ensureStartState(map) {
  if (!map.startState || typeof map.startState !== "object") {
    map.startState = {};
  }
  if (!Array.isArray(map.startState.deployments)) map.startState.deployments = [];
  if (!Array.isArray(map.startState.deploymentCells)) map.startState.deploymentCells = [];
  return map.startState;
}

function flattenMapTiles(map) {
  if (!Array.isArray(map)) return Array.isArray(map?.tiles) ? map.tiles : [];
  return map.flatMap((row) => Array.isArray(row) ? row : []);
}

function getEditableBuilderMap(builderState) {
  if (builderState?.workspaceMode !== "builder-map") return null;
  return builderState?.authoring?.map ?? null;
}

function clampWholeNumber(value, fallback, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
