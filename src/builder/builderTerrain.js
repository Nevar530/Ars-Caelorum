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
const DEFAULT_MOVEMENT_CLASSES = ["clear", "difficult", "impassable"];
const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 9;

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

export function getBuilderBrushSizeOptions() {
  const sizes = [];
  for (let size = BRUSH_SIZE_MIN; size <= BRUSH_SIZE_MAX; size += 1) {
    sizes.push(size);
  }
  return sizes;
}

export function ensureTerrainToolSettings(builderState, appState = null) {
  if (!builderState) return null;

  const options = getBuilderTerrainOptions(appState, builderState);
  const firstTerrain = options[0]?.id ?? "grass";

  if (!builderState.terrainTool) {
    builderState.terrainTool = createDefaultTerrainTool(options[0]);
  }

  if (!options.some((option) => option.id === builderState.terrainTool.terrainTypeId)) {
    builderState.terrainTool.terrainTypeId = firstTerrain;
    builderState.terrainTool.movementClass = options[0]?.movementClass ?? "clear";
  }

  if (!DEFAULT_MOVEMENT_CLASSES.includes(builderState.terrainTool.movementClass)) {
    const selected = options.find((option) => option.id === builderState.terrainTool.terrainTypeId);
    builderState.terrainTool.movementClass = selected?.movementClass ?? "clear";
  }

  builderState.terrainTool.height = clampWholeNumber(builderState.terrainTool.height, 0, -8, 16);
  builderState.terrainTool.brushSize = clampWholeNumber(builderState.terrainTool.brushSize, 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
  builderState.terrainTool.eyedropper = Boolean(builderState.terrainTool.eyedropper);

  return builderState.terrainTool;
}

export function updateTerrainToolFromFields(builderState, root, appState = null, options = {}) {
  const tool = ensureTerrainToolSettings(builderState, appState);
  if (!tool || !root) return tool;

  const terrainTypeId = root.querySelector('[data-builder-field="terrain-type"]')?.value;
  const movementClass = root.querySelector('[data-builder-field="terrain-movement-class"]')?.value;
  const height = root.querySelector('[data-builder-field="terrain-height"]')?.value;
  const brushSize = root.querySelector('[data-builder-field="terrain-brush-size"]')?.value;

  const previousTerrainTypeId = tool.terrainTypeId;

  if (terrainTypeId) tool.terrainTypeId = sanitizeId(terrainTypeId, tool.terrainTypeId ?? "grass");
  if (height !== undefined) tool.height = clampWholeNumber(height, tool.height ?? 0, -8, 16);
  if (brushSize !== undefined) tool.brushSize = clampWholeNumber(brushSize, tool.brushSize ?? 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);

  const terrainChanged = tool.terrainTypeId !== previousTerrainTypeId;
  if (terrainChanged && options.useTerrainDefaultMovement !== false) {
    const terrain = getTerrainOptionById(appState, builderState, tool.terrainTypeId);
    tool.movementClass = terrain?.movementClass ?? "clear";
  } else if (movementClass) {
    tool.movementClass = sanitizeId(movementClass, tool.movementClass ?? "clear");
  }

  return ensureTerrainToolSettings(builderState, appState);
}

export function resetTerrainToolToDefaults(builderState, appState = null) {
  if (!builderState) return null;

  const options = getBuilderTerrainOptions(appState, builderState);
  builderState.terrainTool = createDefaultTerrainTool(options[0]);
  return ensureTerrainToolSettings(builderState, appState);
}

export function setTerrainEyedropper(builderState, enabled = true) {
  const tool = ensureTerrainToolSettings(builderState);
  if (!tool) return null;
  tool.eyedropper = Boolean(enabled);
  return tool;
}

export function isTerrainEyedropperActive(builderState) {
  return Boolean(builderState?.terrainTool?.eyedropper);
}

export function sampleTerrainToolAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Eyedropper is only available on builder-owned maps." };

  const tile = getTile(map, Number(x), Number(y));
  if (!tile) return { ok: false, message: "No tile under eyedropper." };

  const options = getBuilderTerrainOptions(appState, builderState);
  const terrainTypeId = sanitizeId(tile.terrainTypeId, options[0]?.id ?? "grass");
  const terrain = options.find((option) => option.id === terrainTypeId) ?? options[0] ?? null;

  builderState.terrainTool = {
    terrainTypeId: terrain?.id ?? terrainTypeId,
    movementClass: sanitizeId(tile.movementClass, terrain?.movementClass ?? "clear"),
    height: clampWholeNumber(tile.elevation, 0, -8, 16),
    brushSize: clampWholeNumber(builderState?.terrainTool?.brushSize, 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX),
    eyedropper: false
  };

  return {
    ok: true,
    message: `Sampled ${terrain?.label ?? terrainTypeId} / h${builderState.terrainTool.height} / ${builderState.terrainTool.movementClass} from tile ${x}, ${y}.`
  };
}

export function applyTerrainToolAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) {
    return { ok: false, message: "Terrain editing is only available on builder-owned maps." };
  }

  const tool = ensureTerrainToolSettings(builderState, appState);
  const cells = getCenteredBrushCells(map, Number(x), Number(y), tool.brushSize);
  if (!cells.length) return { ok: false, message: "No valid map tiles under terrain brush." };

  const options = getBuilderTerrainOptions(appState, builderState);
  const selectedTerrain = options.find((option) => option.id === tool.terrainTypeId) ?? options[0] ?? null;

  for (const cell of cells) {
    const tile = getTile(map, cell.x, cell.y);
    if (!tile) continue;
    setTileTerrain(tile, selectedTerrain, tool.movementClass);
    setTileHeight(tile, tool.height);
  }

  map.tiles = flattenMapTiles(map);
  builderState.dirty = true;

  return {
    ok: true,
    message: `Painted ${selectedTerrain?.label ?? tool.terrainTypeId} / h${tool.height} / ${tool.movementClass} on ${cells.length} tile${cells.length === 1 ? "" : "s"}.`,
    cells
  };
}

export function getTerrainBrushPreviewCells(builderState, appState, x, y) {
  const map = builderState?.workspaceMode === "builder-map"
    ? builderState?.authoring?.map
    : appState?.map;
  if (!map || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return [];

  const tool = ensureTerrainToolSettings(builderState, appState);
  return getCenteredBrushCells(map, Number(x), Number(y), tool?.brushSize ?? 1);
}

export function getCenteredBrushCells(map, centerX, centerY, brushSize) {
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const size = clampWholeNumber(brushSize, 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
  const before = Math.floor((size - 1) / 2);
  const after = size - 1 - before;
  const cells = [];

  for (let y = centerY - before; y <= centerY + after; y += 1) {
    for (let x = centerX - before; x <= centerX + after; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      cells.push({ x, y });
    }
  }

  return cells;
}

function createDefaultTerrainTool(firstTerrain) {
  return {
    terrainTypeId: firstTerrain?.id ?? "grass",
    movementClass: firstTerrain?.movementClass ?? "clear",
    height: 0,
    brushSize: 1,
    eyedropper: false
  };
}

function getEditableBuilderMap(builderState) {
  if (builderState?.workspaceMode !== "builder-map") return null;
  return builderState?.authoring?.map ?? null;
}

function getTerrainOptionById(appState, builderState, terrainTypeId) {
  const id = sanitizeId(terrainTypeId, null);
  if (!id) return null;
  return getBuilderTerrainOptions(appState, builderState).find((option) => option.id === id) ?? null;
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
