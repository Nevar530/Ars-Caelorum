// src/builder/builderTerrain.js
//
// Builder-owned terrain authoring helpers.
// Terrain edits affect tile truth on builder-owned maps only.
// Structures/edges remain separate structure truth.

import {
  createDetailGridForElevation,
  getMapHeight,
  getMapWidth,
  getTile,
  refreshTileSummary
} from "../map.js";

const DEFAULT_TERRAIN_TYPES = ["grass", "rock", "sand", "water", "asphalt", "concrete"];
const DEFAULT_MOVEMENT_CLASSES = ["clear", "difficult", "impassable", "hazard"];

export function getBuilderTerrainOptions(appState, builderState = null) {
  const terrainList = Array.isArray(appState?.content?.terrainList) ? appState.content.terrainList : [];
  const terrainDefinitions = appState?.content?.terrainDefinitions ?? {};
  const mapTerrainTypes = Array.isArray(builderState?.authoring?.map?.terrainTypes)
    ? builderState.authoring.map.terrainTypes
    : Array.isArray(appState?.map?.terrainTypes)
      ? appState.map.terrainTypes
      : [];

  const ids = [];

  for (const entry of terrainList) {
    const id = sanitizeId(entry?.id ?? entry, null);
    if (id && !ids.includes(id)) ids.push(id);
  }

  for (const id of Object.keys(terrainDefinitions)) {
    const clean = sanitizeId(id, null);
    if (clean && !ids.includes(clean)) ids.push(clean);
  }

  for (const id of mapTerrainTypes) {
    const clean = sanitizeId(id, null);
    if (clean && !ids.includes(clean)) ids.push(clean);
  }

  for (const id of DEFAULT_TERRAIN_TYPES) {
    if (!ids.includes(id)) ids.push(id);
  }

  return ids.map((id) => {
    const definition = terrainDefinitions?.[id] ?? null;
    const listEntry = terrainList.find((entry) => (entry?.id ?? entry) === id) ?? null;
    return {
      id,
      label: definition?.label ?? listEntry?.label ?? titleFromId(id),
      movementClass: definition?.movementClass ?? "clear",
      spriteSetId: definition?.spriteSetId ?? `${id}_001`,
      topSprite: definition?.topSprite ?? null,
      faceSprite: definition?.faceSprite ?? null,
      definition
    };
  });
}

export function getBuilderMovementClassOptions() {
  return [...DEFAULT_MOVEMENT_CLASSES];
}

export function ensureTerrainToolSettings(builderState, appState = null) {
  if (!builderState) return null;

  const options = getBuilderTerrainOptions(appState, builderState);
  const firstTerrain = options[0]?.id ?? "grass";

  if (!builderState.terrainTool) {
    builderState.terrainTool = {
      mode: "terrain",
      terrainTypeId: firstTerrain,
      movementClass: options[0]?.movementClass ?? "clear",
      height: 0,
      brushSize: 1
    };
  }

  if (!options.some((option) => option.id === builderState.terrainTool.terrainTypeId)) {
    builderState.terrainTool.terrainTypeId = firstTerrain;
  }

  if (!DEFAULT_MOVEMENT_CLASSES.includes(builderState.terrainTool.movementClass)) {
    const selected = options.find((option) => option.id === builderState.terrainTool.terrainTypeId);
    builderState.terrainTool.movementClass = selected?.movementClass ?? "clear";
  }

  builderState.terrainTool.height = clampWholeNumber(builderState.terrainTool.height, 0, -8, 16);
  builderState.terrainTool.brushSize = clampWholeNumber(builderState.terrainTool.brushSize, 1, 1, 9);

  return builderState.terrainTool;
}

export function setTerrainToolMode(builderState, mode) {
  const tool = ensureTerrainToolSettings(builderState);
  if (!tool) return null;

  if (mode === "height") tool.mode = "height";
  else tool.mode = "terrain";

  return tool;
}

export function updateTerrainToolFromFields(builderState, root, appState = null) {
  const tool = ensureTerrainToolSettings(builderState, appState);
  if (!tool || !root) return tool;

  const terrainTypeId = root.querySelector('[data-builder-field="terrain-type"]')?.value;
  const movementClass = root.querySelector('[data-builder-field="terrain-movement-class"]')?.value;
  const height = root.querySelector('[data-builder-field="terrain-height"]')?.value;
  const brushSize = root.querySelector('[data-builder-field="terrain-brush-size"]')?.value;

  if (terrainTypeId) tool.terrainTypeId = sanitizeId(terrainTypeId, tool.terrainTypeId ?? "grass");
  if (movementClass) tool.movementClass = sanitizeId(movementClass, tool.movementClass ?? "clear");
  if (height !== undefined) tool.height = clampWholeNumber(height, tool.height ?? 0, -8, 16);
  if (brushSize !== undefined) tool.brushSize = clampWholeNumber(brushSize, tool.brushSize ?? 1, 1, 9);

  return ensureTerrainToolSettings(builderState, appState);
}

export function applyTerrainToolAtSelection(builderState, appState = null) {
  const selected = builderState?.selected ?? null;
  if (!selected || (selected.type !== "tile" && selected.type !== "edge")) {
    return { ok: false, message: "Select a tile before applying terrain." };
  }

  return applyTerrainToolAtTile(builderState, appState, selected.x, selected.y);
}

export function applyTerrainToolAtTile(builderState, appState, x, y) {
  if (builderState?.workspaceMode !== "builder-map") {
    return { ok: false, message: "Terrain editing is only available on builder-owned maps." };
  }

  const map = builderState?.authoring?.map ?? null;
  if (!map) return { ok: false, message: "No builder-owned map is active." };

  const tool = ensureTerrainToolSettings(builderState, appState);
  const cells = getBrushCells(map, Number(x), Number(y), tool.brushSize);
  if (!cells.length) return { ok: false, message: "No valid map tiles under terrain brush." };

  const options = getBuilderTerrainOptions(appState, builderState);
  const selectedTerrain = options.find((option) => option.id === tool.terrainTypeId) ?? options[0] ?? null;

  for (const cell of cells) {
    const tile = getTile(map, cell.x, cell.y);
    if (!tile) continue;

    if (tool.mode === "height") {
      setTileHeight(tile, tool.height);
    } else {
      setTileTerrain(tile, selectedTerrain, tool.movementClass);
    }
  }

  map.tiles = flattenMapTiles(map);
  builderState.dirty = true;

  return {
    ok: true,
    message: tool.mode === "height"
      ? `Painted height ${tool.height} on ${cells.length} tile${cells.length === 1 ? "" : "s"}.`
      : `Painted ${selectedTerrain?.label ?? tool.terrainTypeId} on ${cells.length} tile${cells.length === 1 ? "" : "s"}.`,
    cells
  };
}

function setTileTerrain(tile, terrainOption, movementClassOverride) {
  if (!tile || !terrainOption) return;

  tile.terrainTypeId = terrainOption.id;
  tile.terrainSpriteId = terrainOption.spriteSetId ?? `${terrainOption.id}_001`;
  tile.movementClass = movementClassOverride ?? terrainOption.movementClass ?? "clear";
  refreshTileSummary(tile);
}

function setTileHeight(tile, height) {
  if (!tile) return;

  const cleanHeight = clampWholeNumber(height, 0, -8, 16);
  tile.elevation = cleanHeight;
  tile.detail = createDetailGridForElevation(cleanHeight);
  refreshTileSummary(tile);
}

function getBrushCells(map, centerX, centerY, brushSize) {
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const size = clampWholeNumber(brushSize, 1, 1, 9);
  const radius = Math.floor(size / 2);
  const cells = [];

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      cells.push({ x, y });
    }
  }

  return cells;
}

function flattenMapTiles(map) {
  const tiles = [];
  if (!Array.isArray(map)) return tiles;

  for (const row of map) {
    if (!Array.isArray(row)) continue;
    for (const tile of row) {
      if (tile) tiles.push(tile);
    }
  }

  return tiles;
}

function clampWholeNumber(value, fallback, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function sanitizeId(value, fallback) {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || fallback;
}

function titleFromId(id) {
  return String(id ?? "terrain")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
