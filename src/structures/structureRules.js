// src/structures/structureRules.js
//
// Structure authority helpers.
// Structures are board geometry first:
// - cells define interior/roof footprint
// - edge parts define walls/doors/windows/etc. on real world tile edges
// - rendering/projection may rotate, but map truth never rotates

import { RENDER_CONFIG } from "../config.js";
import { getTile, getTileRenderElevation } from "../map.js";
import { normalizeWorldFace } from "../render/renderCompass.js";

const DEFAULT_STRUCTURE_HEIGHT_PX = 64;
const DEFAULT_STRUCTURE_ART_ROOT = "art/structures/";

export const STRUCTURE_EDGE_TYPES = Object.freeze({
  WALL: "wall",
  DOOR: "door",
  WINDOW: "window",
  OPEN: "open"
});

export function getMapStructures(map) {
  return Array.isArray(map?.structures) ? map.structures : [];
}

export function resolveStructureSpritePath(name) {
  const value = String(name ?? "").trim();
  if (!value) return null;
  if (value.startsWith("./") || value.startsWith("/") || value.startsWith("art/")) return value;
  return `${DEFAULT_STRUCTURE_ART_ROOT}${value}`;
}

export function normalizeStructureForMap(state, raw) {
  const cells = normalizeStructureCells(raw);
  if (cells.length === 0) return null;

  const firstCell = cells[0];
  const tile = getTile(state?.map, firstCell.x, firstCell.y);
  if (!tile) return null;

  const elevation = Number(raw?.elevation ?? getTileRenderElevation(tile) ?? 0);
  const heightPx = Math.max(1, Number(raw?.heightPx ?? DEFAULT_STRUCTURE_HEIGHT_PX));
  const heightLevels = heightPx / RENDER_CONFIG.elevationStepPx;
  const id = String(raw?.id ?? `structure_${firstCell.x}_${firstCell.y}`);

  return {
    id,
    x: firstCell.x,
    y: firstCell.y,
    cells,
    cellKeys: new Set(cells.map((cell) => makeCellKey(cell.x, cell.y))),
    edgeParts: normalizeStructureEdges(raw, cells, heightLevels),
    elevation,
    heightPx,
    heightLevels,
    blocksMove: raw?.blocksMove === true,
    blocksLOS: raw?.blocksLOS === true,
    drawFallbackFaces: raw?.drawFallbackFaces === true,
    roofSprite: resolveStructureSpritePath(raw?.roof ?? raw?.roofSprite),
    floorSprite: resolveStructureSpritePath(raw?.floor ?? raw?.floorSprite ?? raw?.interiorFloor),
    debug: raw?.debug === true,
    showInteriorFloor: raw?.showInteriorFloor === true
  };
}

export function getStructureEdgeParts(structure) {
  return Array.isArray(structure?.edgeParts) ? structure.edgeParts : [];
}

export function getStructureCells(structure) {
  return Array.isArray(structure?.cells) ? structure.cells : [];
}

export function getStructuresAtTile(map, x, y) {
  const key = makeCellKey(x, y);

  return getMapStructures(map).filter((raw) => {
    const cells = normalizeStructureCells(raw);
    return cells.some((cell) => makeCellKey(cell.x, cell.y) === key);
  });
}

export function isStructureMoveBlockedAt(map, x, y) {
  return getStructuresAtTile(map, x, y).some((structure) => structure?.blocksMove === true);
}

export function isStructureLosBlockedAt(map, x, y) {
  return getStructuresAtTile(map, x, y).some((structure) => structure?.blocksLOS === true);
}

export function getEdgeHeightBetween(map, fromX, fromY, toX, toY) {
  const edges = getEdgesBetweenCells(fromX, fromY, toX, toY);
  let maxHeight = 0;

  for (const edgeRef of edges) {
    const height = getAuthoredEdgeHeight(map, edgeRef.x, edgeRef.y, edgeRef.edge);
    if (height > maxHeight) maxHeight = height;
  }

  return maxHeight;
}

export function isEdgeMovementBlockedBetween(map, fromX, fromY, toX, toY, stepHeight = 1) {
  const edgeHeight = getEdgeHeightBetween(map, fromX, fromY, toX, toY);
  if (edgeHeight <= 0) return false;
  return edgeHeight > Number(stepHeight ?? 1);
}

export function getEdgeLosBlockBetween(map, fromX, fromY, toX, toY, rayHeight) {
  const edges = getEdgesBetweenCells(fromX, fromY, toX, toY);

  for (const edgeRef of edges) {
    const height = getAuthoredEdgeHeight(map, edgeRef.x, edgeRef.y, edgeRef.edge);
    if (height <= 0) continue;

    if (height >= rayHeight) {
      return {
        blocked: true,
        blockingTile: { x: edgeRef.x, y: edgeRef.y },
        edge: edgeRef.edge,
        edgeHeight: height
      };
    }
  }

  return { blocked: false, blockingTile: null, edge: null, edgeHeight: 0 };
}

export function getEdgesBetweenCells(fromX, fromY, toX, toY) {
  const fx = Number(fromX);
  const fy = Number(fromY);
  const tx = Number(toX);
  const ty = Number(toY);
  const dx = tx - fx;
  const dy = ty - fy;

  if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(tx) || !Number.isFinite(ty)) {
    return [];
  }

  if (dx === 1 && dy === 0) return [{ x: fx, y: fy, edge: "se" }, { x: tx, y: ty, edge: "nw" }];
  if (dx === -1 && dy === 0) return [{ x: fx, y: fy, edge: "nw" }, { x: tx, y: ty, edge: "se" }];
  if (dx === 0 && dy === 1) return [{ x: fx, y: fy, edge: "sw" }, { x: tx, y: ty, edge: "ne" }];
  if (dx === 0 && dy === -1) return [{ x: fx, y: fy, edge: "ne" }, { x: tx, y: ty, edge: "sw" }];

  // LOS rays can step diagonally through a corner. Treat that as crossing both
  // cardinal edge pairs so a corner wall still blocks honestly.
  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
    return [
      ...getEdgesBetweenCells(fx, fy, tx, fy),
      ...getEdgesBetweenCells(fx, fy, fx, ty),
      ...getEdgesBetweenCells(tx, fy, tx, ty),
      ...getEdgesBetweenCells(fx, ty, tx, ty)
    ];
  }

  return [];
}

export function makeCellKey(x, y) {
  return `${Number(x)},${Number(y)}`;
}

export function makeEdgeKey(x, y, edge) {
  return `${Number(x)},${Number(y)},${String(edge ?? "").toLowerCase()}`;
}

function getAuthoredEdgeHeight(map, x, y, edge) {
  const worldEdge = normalizeWorldFace(edge);
  if (!worldEdge) return 0;

  let maxHeight = 0;

  for (const raw of getMapStructures(map)) {
    const cells = normalizeStructureCells(raw);
    const heightPx = Math.max(1, Number(raw?.heightPx ?? DEFAULT_STRUCTURE_HEIGHT_PX));
    const defaultHeightLevels = Number(raw?.heightLevels ?? (heightPx / RENDER_CONFIG.elevationStepPx));
    const edgeParts = normalizeStructureEdges(raw, cells, defaultHeightLevels);

    for (const part of edgeParts) {
      if (Number(part.x) !== Number(x) || Number(part.y) !== Number(y) || part.edge !== worldEdge) continue;
      const height = Number(part.edgeHeight ?? 0);
      if (height > maxHeight) maxHeight = height;
    }
  }

  return maxHeight;
}

function normalizeStructureCells(raw) {
  if (Array.isArray(raw?.cells)) {
    return raw.cells
      .map((cell) => ({
        x: Number(cell?.x ?? cell?.tileX),
        y: Number(cell?.y ?? cell?.tileY)
      }))
      .filter((cell) => Number.isFinite(cell.x) && Number.isFinite(cell.y));
  }

  const x = Number(raw?.x ?? raw?.tileX);
  const y = Number(raw?.y ?? raw?.tileY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];

  const w = Math.max(1, Number(raw?.w ?? raw?.width ?? 1));
  const h = Math.max(1, Number(raw?.h ?? raw?.height ?? 1));
  const cells = [];

  for (let cy = y; cy < y + h; cy += 1) {
    for (let cx = x; cx < x + w; cx += 1) {
      cells.push({ x: cx, y: cy });
    }
  }

  return cells;
}

function normalizeStructureEdges(raw, cells, defaultHeightLevels = 0) {
  const authored = [];

  if (Array.isArray(raw?.edges)) {
    for (const edge of raw.edges) {
      const normalized = normalizeEdgePart(edge, defaultHeightLevels);
      if (normalized) authored.push(normalized);
    }
  } else if (raw?.edges && typeof raw.edges === "object") {
    for (const [key, value] of Object.entries(raw.edges)) {
      const fromKey = normalizeEdgeFromKey(key, value, defaultHeightLevels);
      if (fromKey) authored.push(fromKey);
    }
  }

  if (authored.length > 0) return authored;

  return normalizeLegacyFaceSprites(raw, cells, defaultHeightLevels);
}

function normalizeEdgePart(edge, defaultHeightLevels = 0) {
  const x = Number(edge?.x ?? edge?.tileX);
  const y = Number(edge?.y ?? edge?.tileY);
  const worldEdge = normalizeWorldFace(edge?.edge ?? edge?.face ?? edge?.side);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !worldEdge) return null;

  const type = normalizeEdgeType(edge?.type ?? edge?.kind);
  const spriteId =
    edge?.spriteId ??
    edge?.sprite ??
    edge?.image ??
    edge?.faceSprite ??
    inferSpriteForType(type);

  const blocksMove = edge?.blocksMove ?? (type === STRUCTURE_EDGE_TYPES.WALL || type === STRUCTURE_EDGE_TYPES.WINDOW);
  const blocksLOS = edge?.blocksLOS ?? (type === STRUCTURE_EDGE_TYPES.WALL);
  const authoredHeight = edge?.edgeHeight ?? edge?.heightLevels ?? edge?.height ?? edge?.losHeight;
  const edgeHeight = normalizeEdgeHeight(authoredHeight, defaultHeightLevels, blocksMove, blocksLOS);

  return {
    x,
    y,
    edge: worldEdge,
    type,
    blocksMove,
    blocksLOS,
    edgeHeight,
    sprite: resolveStructureSpritePath(spriteId)
  };
}

function normalizeEdgeFromKey(key, value, defaultHeightLevels = 0) {
  const parts = String(key ?? "").split(/[,:|]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const [x, y, edge] = parts;
  const payload = value && typeof value === "object"
    ? value
    : { spriteId: value };

  return normalizeEdgePart({
    ...payload,
    x,
    y,
    edge
  }, defaultHeightLevels);
}

function normalizeLegacyFaceSprites(raw, cells, defaultHeightLevels = 0) {
  const src = raw?.faceSprites && typeof raw.faceSprites === "object"
    ? raw.faceSprites
    : raw?.faces && typeof raw.faces === "object"
      ? raw.faces
      : {};

  const legacyFace = raw?.face ?? raw?.faceSprite;
  const legacyLeft = raw?.leftFace;
  const legacyRight = raw?.rightFace;

  const faceSprites = {
    ne: src.ne ?? legacyFace,
    se: src.se ?? legacyRight ?? legacyFace,
    sw: src.sw ?? legacyLeft ?? legacyFace,
    nw: src.nw ?? legacyFace
  };

  const edgeParts = [];

  for (const cell of cells) {
    for (const edge of ["ne", "se", "sw", "nw"]) {
      const spriteId = faceSprites[edge];
      if (!spriteId) continue;
      const isDoor = looksLikeDoorSprite(spriteId);

      edgeParts.push({
        x: cell.x,
        y: cell.y,
        edge,
        type: isDoor ? STRUCTURE_EDGE_TYPES.DOOR : STRUCTURE_EDGE_TYPES.WALL,
        blocksMove: !isDoor,
        blocksLOS: !isDoor,
        edgeHeight: isDoor ? 0 : defaultHeightLevels,
        sprite: resolveStructureSpritePath(spriteId)
      });
    }
  }

  return edgeParts;
}

function normalizeEdgeType(type) {
  const value = String(type ?? "").trim().toLowerCase();
  if (value === STRUCTURE_EDGE_TYPES.DOOR) return STRUCTURE_EDGE_TYPES.DOOR;
  if (value === STRUCTURE_EDGE_TYPES.WINDOW) return STRUCTURE_EDGE_TYPES.WINDOW;
  if (value === STRUCTURE_EDGE_TYPES.OPEN || value === "none") return STRUCTURE_EDGE_TYPES.OPEN;
  return STRUCTURE_EDGE_TYPES.WALL;
}

function normalizeEdgeHeight(value, defaultHeightLevels, blocksMove, blocksLOS) {
  const explicit = Number(value);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  if (blocksMove === true || blocksLOS === true) return Math.max(0, Number(defaultHeightLevels ?? 0));
  return 0;
}

function inferSpriteForType(type) {
  switch (type) {
    case STRUCTURE_EDGE_TYPES.DOOR:
      return "door_001.png";
    case STRUCTURE_EDGE_TYPES.WINDOW:
      return "window_001.png";
    case STRUCTURE_EDGE_TYPES.OPEN:
      return null;
    case STRUCTURE_EDGE_TYPES.WALL:
    default:
      return "wall_001.png";
  }
}

function looksLikeDoorSprite(spriteId) {
  return /(^|[/_-])door([_-]|\d|\.|$)/i.test(String(spriteId ?? "").trim());
}
