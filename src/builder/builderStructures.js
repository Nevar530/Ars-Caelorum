// src/builder/builderStructures.js
//
// Builder-owned structure cell / room / edge authoring helpers.
// Structures stay on current engine track spec:
// - cells define structure/room footprint
// - roof is structure-level art truth
// - edges + edgeHeight define wall/door/opening crossing/LOS truth

import { getMapHeight, getMapWidth } from "../map.js";
import { getCenteredBrushCells } from "./builderTerrain.js";

const DEFAULT_ROOF_SPRITES = ["roof_001.png"];
const DEFAULT_EDGE_SPRITES = ["wall_001.png", "door_001.png"];
const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 9;

const EDGE_TYPE_DEFAULTS = {
  wall: {
    type: "wall",
    spriteId: "wall_001.png",
    edgeHeight: 2
  },
  door: {
    type: "door",
    spriteId: "door_001.png",
    edgeHeight: 0
  },
  opening: {
    type: "open",
    spriteId: "",
    edgeHeight: 0
  }
};

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

  const cleanEdgeType = normalizeEdgeType(tool.edgeType ?? "wall");
  tool.edgeType = cleanEdgeType;
  const defaults = getStructureEdgeTypeDefaults(cleanEdgeType);
  tool.edgeSpriteId = sanitizeSprite(tool.edgeSpriteId, defaults.spriteId);
  tool.edgeHeight = clampWholeNumber(tool.edgeHeight, defaults.edgeHeight, 0, 99);
  tool.edgeEyedropper = Boolean(tool.edgeEyedropper);
  tool.edgeErase = Boolean(tool.edgeErase);

  return tool;
}

export function updateStructureToolFromFields(builderState, root, appState = null, options = {}) {
  const tool = ensureStructureToolSettings(builderState, appState);
  if (!tool || !root) return tool;

  const structureId = root.querySelector('[data-builder-field="structure-id"]')?.value;
  const roomId = root.querySelector('[data-builder-field="structure-room-id"]')?.value;
  const roofSprite = root.querySelector('[data-builder-field="structure-roof-sprite"]')?.value;
  const brushSize = root.querySelector('[data-builder-field="structure-brush-size"]')?.value;
  const edgeType = root.querySelector('[data-builder-field="structure-edge-type"]')?.value;
  const edgeSpriteId = root.querySelector('[data-builder-field="structure-edge-sprite"]')?.value;
  const edgeHeight = root.querySelector('[data-builder-field="structure-edge-height"]')?.value;

  if (structureId !== undefined) tool.structureId = sanitizeId(structureId, tool.structureId ?? "structure_01");
  if (roomId !== undefined) tool.roomId = sanitizeId(roomId, tool.roomId ?? "room_01");
  if (roofSprite !== undefined) tool.roofSprite = sanitizeSprite(roofSprite, tool.roofSprite ?? "roof_001.png");
  if (brushSize !== undefined) tool.brushSize = clampWholeNumber(brushSize, tool.brushSize ?? 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);

  if (edgeType !== undefined) {
    const nextType = normalizeEdgeType(edgeType);
    const previousType = tool.edgeType;
    tool.edgeType = nextType;

    const defaults = getStructureEdgeTypeDefaults(nextType);
    if (options.changedField === "structure-edge-type" && nextType !== previousType) {
      tool.edgeSpriteId = defaults.spriteId;
      tool.edgeHeight = defaults.edgeHeight;
    }
  }

  if (edgeSpriteId !== undefined && options.changedField !== "structure-edge-type") {
    tool.edgeSpriteId = sanitizeSprite(edgeSpriteId, tool.edgeSpriteId ?? getStructureEdgeTypeDefaults(tool.edgeType).spriteId);
  }

  if (edgeHeight !== undefined && options.changedField !== "structure-edge-type") {
    tool.edgeHeight = clampWholeNumber(edgeHeight, tool.edgeHeight ?? getStructureEdgeTypeDefaults(tool.edgeType).edgeHeight, 0, 99);
  }

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
  if (tool.eyedropper) {
    tool.erase = false;
    tool.edgeEyedropper = false;
    tool.edgeErase = false;
  }
  return tool;
}

export function isStructureEyedropperActive(builderState) {
  return Boolean(builderState?.structureTool?.eyedropper);
}

export function setStructureEraseMode(builderState, enabled = true) {
  const tool = ensureStructureToolSettings(builderState);
  if (!tool) return null;
  tool.erase = Boolean(enabled);
  if (tool.erase) {
    tool.eyedropper = false;
    tool.edgeEyedropper = false;
    tool.edgeErase = false;
  }
  return tool;
}

export function isStructureEraseModeActive(builderState) {
  return Boolean(builderState?.structureTool?.erase);
}

export function setStructureEdgeEyedropper(builderState, enabled = true) {
  const tool = ensureStructureToolSettings(builderState);
  if (!tool) return null;
  tool.edgeEyedropper = Boolean(enabled);
  if (tool.edgeEyedropper) {
    tool.eyedropper = false;
    tool.erase = false;
    tool.edgeErase = false;
  }
  return tool;
}

export function isStructureEdgeEyedropperActive(builderState) {
  return Boolean(builderState?.structureTool?.edgeEyedropper);
}

export function setStructureEdgeEraseMode(builderState, enabled = true) {
  const tool = ensureStructureToolSettings(builderState);
  if (!tool) return null;
  tool.edgeErase = Boolean(enabled);
  if (tool.edgeErase) {
    tool.eyedropper = false;
    tool.erase = false;
    tool.edgeEyedropper = false;
  }
  return tool;
}

export function isStructureEdgeEraseModeActive(builderState) {
  return Boolean(builderState?.structureTool?.edgeErase);
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

export function getStructureEdgeTypeOptions() {
  return Object.keys(EDGE_TYPE_DEFAULTS);
}

export function getStructureEdgeTypeDefaults(edgeType) {
  const type = normalizeEdgeType(edgeType);
  return { ...(EDGE_TYPE_DEFAULTS[type] ?? EDGE_TYPE_DEFAULTS.wall) };
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

export function getBuilderStructureEdgeSpriteOptions(appState, builderState = null) {
  const ids = [];
  for (const id of DEFAULT_EDGE_SPRITES) addUnique(ids, id);

  const maps = [builderState?.authoring?.map, appState?.map].filter(Boolean);
  for (const map of maps) {
    for (const structure of Array.isArray(map?.structures) ? map.structures : []) {
      for (const edge of Array.isArray(structure?.edges) ? structure.edges : []) {
        addUnique(ids, edge?.spriteId ?? edge?.sprite ?? edge?.image ?? edge?.faceSprite);
      }
    }
  }

  return ids;
}

export function getStructureSpritePreviewPath(spriteId) {
  const clean = sanitizeSprite(spriteId, "");
  if (!clean) return "";
  if (/^(https?:|data:|\/)/i.test(clean)) return clean;
  if (clean.includes("/")) return clean;
  return `art/structures/${clean}`;
}

export function sampleStructureToolAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Structure eyedropper is only available on builder-owned maps." };

  const hit = findStructureCellAt(map, Number(x), Number(y));
  if (!hit) return { ok: false, message: `No structure cell at tile ${x}, ${y}.` };

  const current = ensureStructureToolSettings(builderState, appState);
  builderState.structureTool = {
    ...current,
    structureId: sanitizeId(hit.structure?.id, current?.structureId ?? "structure_01"),
    roomId: sanitizeId(hit.cell?.roomId, current?.roomId ?? "room_01"),
    roofSprite: sanitizeSprite(hit.structure?.roof ?? hit.structure?.roofSprite, current?.roofSprite ?? "roof_001.png"),
    brushSize: clampWholeNumber(current?.brushSize, 1, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX),
    eyedropper: false,
    erase: false,
    edgeEyedropper: false,
    edgeErase: false,
    showRoofs: current?.showRoofs !== false
  };

  return {
    ok: true,
    message: `Sampled ${builderState.structureTool.structureId} / ${builderState.structureTool.roomId} from tile ${x}, ${y}.`
  };
}

export function sampleStructureEdgeToolAtEdge(builderState, appState, x, y, edge) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Structure edge eyedropper is only available on builder-owned maps." };

  const hit = findStructureEdgeAt(map, Number(x), Number(y), edge);
  if (!hit) return { ok: false, message: `No authored structure edge at ${x}, ${y} ${String(edge ?? "").toUpperCase()}.` };

  const current = ensureStructureToolSettings(builderState, appState);
  const type = normalizeEdgeType(hit.edgePart?.type ?? "wall");
  builderState.structureTool = {
    ...current,
    structureId: sanitizeId(hit.structure?.id, current?.structureId ?? "structure_01"),
    edgeType: type,
    edgeSpriteId: sanitizeSprite(hit.edgePart?.spriteId ?? hit.edgePart?.sprite ?? hit.edgePart?.image ?? "", getStructureEdgeTypeDefaults(type).spriteId),
    edgeHeight: clampWholeNumber(hit.edgePart?.edgeHeight, getStructureEdgeTypeDefaults(type).edgeHeight, 0, 99),
    eyedropper: false,
    erase: false,
    edgeEyedropper: false,
    edgeErase: false
  };

  return {
    ok: true,
    message: `Sampled ${builderState.structureTool.edgeType}:${builderState.structureTool.edgeHeight} from ${x}, ${y} ${String(edge ?? "").toUpperCase()}.`
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

  // A tile should not belong to two structure cells at once.
  // Erase first, then create/find the target structure. If we create the
  // structure before erasing, the empty new structure can be removed by
  // removeEmptyStructures(), leaving the painted cells attached to an object
  // that is no longer in map.structures.
  eraseStructureCells(map, cells);

  const structure = ensureStructure(map, tool.structureId, tool.roofSprite);
  structure.roof = tool.roofSprite;
  if (!Array.isArray(structure.cells)) structure.cells = [];
  if (!Array.isArray(structure.edges)) structure.edges = [];
  if (structure.heightPx == null) structure.heightPx = 64;

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

export function applyStructureEdgeToolAtEdge(builderState, appState, x, y, edge) {
  const map = getEditableBuilderMap(builderState);
  if (!map) {
    return { ok: false, message: "Structure edge editing is only available on builder-owned maps." };
  }

  const tool = ensureStructureToolSettings(builderState, appState);
  const tileX = Number(x);
  const tileY = Number(y);
  const worldEdge = normalizeWorldEdge(edge);
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY) || !worldEdge) {
    return { ok: false, message: "No valid selected structure edge." };
  }

  if (tool.edgeErase) {
    const removed = eraseStructureEdges(map, tileX, tileY, worldEdge);
    builderState.dirty = removed > 0 || builderState.dirty;
    return {
      ok: true,
      message: removed > 0
        ? `Erased ${removed} structure edge${removed === 1 ? "" : "s"} at ${tileX}, ${tileY} ${worldEdge.toUpperCase()}.`
        : `No structure edge to erase at ${tileX}, ${tileY} ${worldEdge.toUpperCase()}.`
    };
  }

  const structure = findStructureById(map, tool.structureId);
  if (!structure) {
    return { ok: false, message: `Paint room cells for ${tool.structureId} before adding edges.` };
  }

  if (!Array.isArray(structure.edges)) structure.edges = [];

  // A world edge should only have one authored structure part. Remove any
  // existing edge at this tile/side across structures before writing the new one.
  eraseStructureEdges(map, tileX, tileY, worldEdge);

  const cleanType = normalizeEdgeType(tool.edgeType);
  const cleanSprite = sanitizeSprite(tool.edgeSpriteId, getStructureEdgeTypeDefaults(cleanType).spriteId);
  const cleanHeight = clampWholeNumber(tool.edgeHeight, getStructureEdgeTypeDefaults(cleanType).edgeHeight, 0, 99);
  const edgePart = {
    x: tileX,
    y: tileY,
    edge: worldEdge,
    type: cleanType,
    edgeHeight: cleanHeight
  };

  if (cleanSprite) edgePart.spriteId = cleanSprite;

  structure.edges.push(edgePart);
  sortStructureEdges(structure);
  builderState.dirty = true;

  return {
    ok: true,
    message: `Painted ${cleanType}:${cleanHeight} edge at ${tileX}, ${tileY} ${worldEdge.toUpperCase()}.`,
    edge: edgePart
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
    showRoofs: true,
    edgeType: "wall",
    edgeSpriteId: EDGE_TYPE_DEFAULTS.wall.spriteId,
    edgeHeight: EDGE_TYPE_DEFAULTS.wall.edgeHeight,
    edgeEyedropper: false,
    edgeErase: false
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

function findStructureById(map, structureId) {
  const id = sanitizeId(structureId, "structure_01");
  return ensureStructuresArray(map).find((candidate) => sanitizeId(candidate?.id, "") === id) ?? null;
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

function eraseStructureEdges(map, x, y, edge) {
  const worldEdge = normalizeWorldEdge(edge);
  let removed = 0;

  for (const structure of ensureStructuresArray(map)) {
    if (!Array.isArray(structure.edges)) continue;
    const before = structure.edges.length;
    structure.edges = structure.edges.filter((candidate) => !isSameEdge(candidate, x, y, worldEdge));
    removed += before - structure.edges.length;
  }

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

function sortStructureEdges(structure) {
  if (!Array.isArray(structure?.edges)) return;
  structure.edges.sort((a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x) || String(a.edge ?? "").localeCompare(String(b.edge ?? "")));
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

function findStructureEdgeAt(map, x, y, edge) {
  const worldEdge = normalizeWorldEdge(edge);
  if (!worldEdge) return null;

  for (const structure of ensureStructuresArray(map)) {
    for (const edgePart of Array.isArray(structure?.edges) ? structure.edges : []) {
      if (isSameEdge(edgePart, x, y, worldEdge)) {
        return { structure, edgePart };
      }
    }
  }
  return null;
}

function isSameEdge(edgePart, x, y, edge) {
  return Number(edgePart?.x) === Number(x) &&
    Number(edgePart?.y) === Number(y) &&
    normalizeWorldEdge(edgePart?.edge ?? edgePart?.face ?? edgePart?.side) === normalizeWorldEdge(edge);
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

function normalizeEdgeType(value) {
  const clean = String(value ?? "wall").trim().toLowerCase();
  if (clean === "open" || clean === "opening") return "open";
  if (clean === "door") return "door";
  if (clean === "wall") return "wall";
  return "wall";
}

function normalizeWorldEdge(value) {
  const clean = String(value ?? "").trim().toLowerCase();
  return clean === "sw" || clean === "se" || clean === "ne" || clean === "nw" ? clean : null;
}
