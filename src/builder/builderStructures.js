// src/builder/builderStructures.js
//
// Builder-owned structure cell / room authoring helpers.
// Structures stay on current engine track spec:
// - cells define structure/room footprint
// - roof is structure-level art truth
// - edges/edgeHeight come in the next structure pass

import { getMapHeight, getMapWidth, getTile } from "../map.js";
import { getCenteredBrushCells } from "./builderTerrain.js";

const DEFAULT_ROOF_SPRITES = ["roof_001.png"];
const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 9;

export function ensureStructureToolSettings(builderState, appState = null) {
  if (!builderState) return null;

  if (!builderState.structureTool) {
    builderState.structureTool = createDefaultStructureTool(appState, builderState);
  }

  const tool = builderState.structureTool;
  tool.structureId = sanitizeId(tool.structureId, "structure_01");
  tool.roomId = sanitizeId(tool.roomId, "room_01");
  tool.roofSprite = sanitizeSprite(tool.roofSprite, getBuilderRoofSpriteOptions(appState, builderState)[0] ?? "roof_001.png");
  tool.brushSize = clampWholeNumber(tool.brushSize, 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
  tool.eyedropper = Boolean(tool.eyedropper);
  tool.erase = Boolean(tool.erase);
  tool.showRoofs = tool.showRoofs !== false;

  return tool;
}

export function updateStructureToolFromFields(builderState, root, appState = null) {
  const tool = ensureStructureToolSettings(builderState, appState);
  if (!tool || !root) return tool;

  const structureId = root.querySelector('[data-builder-field="structure-id"]')?.value;
  const roomId = root.querySelector('[data-builder-field="structure-room-id"]')?.value;
  const roofSprite = root.querySelector('[data-builder-field="structure-roof-sprite"]')?.value;
  const brushSize = root.querySelector('[data-builder-field="structure-brush-size"]')?.value;

  if (structureId !== undefined) tool.structureId = sanitizeId(structureId, tool.structureId ?? "structure_01");
  if (roomId !== undefined) tool.roomId = sanitizeId(roomId, tool.roomId ?? "room_01");
  if (roofSprite !== undefined) tool.roofSprite = sanitizeSprite(roofSprite, tool.roofSprite ?? "roof_001.png");
  if (brushSize !== undefined) tool.brushSize = clampWholeNumber(brushSize, tool.brushSize ?? 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);

  return ensureStructureToolSettings(builderState, appState);
}

export function resetStructureToolToDefaults(builderState, appState = null) {
  if (!builderState) return null;
  builderState.structureTool = createDefaultStructureTool(appState, builderState);
  return ensureStructureToolSettings(builderState, appState);
}

export function setStructureEyedropper(builderState, enabled = true) {
  const tool = ensureStructureToolSettings(builderState);
  if (!tool) return null;
  tool.eyedropper = Boolean(enabled);
  if (tool.eyedropper) tool.erase = false;
  return tool;
}

export function isStructureEyedropperActive(builderState) {
  return Boolean(builderState?.structureTool?.eyedropper);
}

export function setStructureEraseMode(builderState, enabled = true) {
  const tool = ensureStructureToolSettings(builderState);
  if (!tool) return null;
  tool.erase = Boolean(enabled);
  if (tool.erase) tool.eyedropper = false;
  return tool;
}

export function isStructureEraseModeActive(builderState) {
  return Boolean(builderState?.structureTool?.erase);
}

export function toggleStructureRoofVisibility(builderState) {
  const tool = ensureStructureToolSettings(builderState);
  if (!tool) return null;
  tool.showRoofs = !tool.showRoofs;
  return tool;
}

export function areStructureRoofsVisible(builderState) {
  return builderState?.structureTool?.showRoofs !== false;
}

export function getBuilderRoofSpriteOptions(appState, builderState = null) {
  const ids = [];
  for (const id of DEFAULT_ROOF_SPRITES) addUnique(ids, id);

  const maps = [builderState?.authoring?.map, appState?.map].filter(Boolean);
  for (const map of maps) {
    for (const structure of Array.isArray(map?.structures) ? map.structures : []) {
      addUnique(ids, structure?.roof);
      addUnique(ids, structure?.roofSprite);
    }
  }

  return ids;
}

export function sampleStructureToolAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Structure eyedropper is only available on builder-owned maps." };

  const hit = findStructureCellAt(map, Number(x), Number(y));
  if (!hit) return { ok: false, message: `No structure cell at tile ${x}, ${y}.` };

  const current = ensureStructureToolSettings(builderState, appState);
  builderState.structureTool = {
    structureId: sanitizeId(hit.structure?.id, current?.structureId ?? "structure_01"),
    roomId: sanitizeId(hit.cell?.roomId, current?.roomId ?? "room_01"),
    roofSprite: sanitizeSprite(hit.structure?.roof ?? hit.structure?.roofSprite, current?.roofSprite ?? "roof_001.png"),
    brushSize: clampWholeNumber(current?.brushSize, 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX),
    eyedropper: false,
    erase: false,
    showRoofs: current?.showRoofs !== false
  };

  return {
    ok: true,
    message: `Sampled ${builderState.structureTool.structureId} / ${builderState.structureTool.roomId} from tile ${x}, ${y}.`
  };
}

export function applyStructureToolAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) {
    return { ok: false, message: "Structure editing is only available on builder-owned maps." };
  }

  const tool = ensureStructureToolSettings(builderState, appState);
  const cells = getStructureBrushPreviewCells(builderState, appState, Number(x), Number(y));
  if (!cells.length) return { ok: false, message: "No valid map tiles under structure brush." };

  ensureStructuresArray(map);

  if (tool.erase) {
    const removed = eraseStructureCells(map, cells);
    builderState.dirty = removed > 0 || builderState.dirty;
    return {
      ok: true,
      message: removed > 0
        ? `Erased ${removed} structure cell${removed === 1 ? "" : "s"}.`
        : "No structure cells under erase brush.",
      cells
    };
  }

  const structure = ensureStructure(map, tool.structureId, tool.roofSprite);
  structure.roof = tool.roofSprite;
  if (!Array.isArray(structure.cells)) structure.cells = [];
  if (!Array.isArray(structure.edges)) structure.edges = [];
  if (structure.heightPx == null) structure.heightPx = 64;

  // A tile should not belong to two structure cells at once.
  eraseStructureCells(map, cells);

  for (const cell of cells) {
    structure.cells.push({
      x: cell.x,
      y: cell.y,
      roomId: tool.roomId
    });
  }

  sortStructureCells(structure);
  removeEmptyStructures(map);
  builderState.dirty = true;

  return {
    ok: true,
    message: `Painted ${tool.structureId} / ${tool.roomId} on ${cells.length} structure cell${cells.length === 1 ? "" : "s"}.`,
    cells
  };
}

export function getStructureBrushPreviewCells(builderState, appState, x, y) {
  const map = builderState?.workspaceMode === "builder-map"
    ? builderState?.authoring?.map
    : appState?.map;
  if (!map || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return [];

  const tool = ensureStructureToolSettings(builderState, appState);
  return getCenteredBrushCells(map, Number(x), Number(y), tool?.brushSize ?? 1);
}

function createDefaultStructureTool(appState, builderState) {
  return {
    structureId: "structure_01",
    roomId: "room_01",
    roofSprite: getBuilderRoofSpriteOptions(appState, builderState)[0] ?? "roof_001.png",
    brushSize: 1,
    eyedropper: false,
    erase: false,
    showRoofs: true
  };
}

function getEditableBuilderMap(builderState) {
  if (builderState?.workspaceMode !== "builder-map") return null;
  return builderState?.authoring?.map ?? null;
}

function ensureStructuresArray(map) {
  if (!Array.isArray(map.structures)) map.structures = [];
  return map.structures;
}

function ensureStructure(map, structureId, roofSprite) {
  const structures = ensureStructuresArray(map);
  const id = sanitizeId(structureId, "structure_01");
  let structure = structures.find((candidate) => sanitizeId(candidate?.id, "") === id);

  if (!structure) {
    structure = {
      id,
      cells: [],
      heightPx: 64,
      roof: sanitizeSprite(roofSprite, "roof_001.png"),
      floor: null,
      showInteriorFloor: false,
      edges: []
    };
    structures.push(structure);
  }

  return structure;
}

function eraseStructureCells(map, cells) {
  const keys = new Set(cells.map((cell) => makeCellKey(cell.x, cell.y)));
  let removed = 0;

  for (const structure of ensureStructuresArray(map)) {
    if (!Array.isArray(structure.cells)) continue;
    const before = structure.cells.length;
    structure.cells = structure.cells.filter((cell) => !keys.has(makeCellKey(cell.x, cell.y)));
    removed += before - structure.cells.length;
  }

  removeEmptyStructures(map);
  return removed;
}

function removeEmptyStructures(map) {
  if (!Array.isArray(map?.structures)) return;
  map.structures = map.structures.filter((structure) => Array.isArray(structure?.cells) && structure.cells.length > 0);
}

function sortStructureCells(structure) {
  if (!Array.isArray(structure?.cells)) return;
  structure.cells.sort((a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x));
}

function findStructureCellAt(map, x, y) {
  for (const structure of ensureStructuresArray(map)) {
    for (const cell of Array.isArray(structure?.cells) ? structure.cells : []) {
      if (Number(cell?.x) === Number(x) && Number(cell?.y) === Number(y)) {
        return { structure, cell };
      }
    }
  }
  return null;
}

function makeCellKey(x, y) {
  return `${Number(x)},${Number(y)}`;
}

function addUnique(values, value) {
  const clean = sanitizeSprite(value, null);
  if (clean && !values.includes(clean)) values.push(clean);
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

function sanitizeSprite(value, fallback) {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}
