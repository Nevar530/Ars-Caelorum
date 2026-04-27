// src/structures/structureRules.js
// Structure authority helpers.
// V2 starts here: map structures are board data first, render skin second.

import { RENDER_CONFIG } from "../config.js";
import { getTile, getTileRenderElevation } from "../map.js";
import { normalizeWorldFace } from "../render/renderCompass.js";

const DEFAULT_STRUCTURE_HEIGHT_PX = 64;
const DEFAULT_STRUCTURE_ART_ROOT = "art/structures/";

export function getMapStructures(map) {
  return Array.isArray(map?.structures) ? map.structures : [];
}

export function normalizeStructureForMap(state, raw) {
  const x = Number(raw?.x ?? raw?.tileX);
  const y = Number(raw?.y ?? raw?.tileY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const tile = getTile(state.map, x, y);
  if (!tile) return null;

  const elevation = Number(raw?.elevation ?? getTileRenderElevation(tile) ?? 0);
  const heightPx = Math.max(1, Number(raw?.heightPx ?? DEFAULT_STRUCTURE_HEIGHT_PX));

  return {
    id: String(raw?.id ?? `structure_${x}_${y}`),
    x,
    y,
    w: Math.max(1, Number(raw?.w ?? raw?.width ?? 1)),
    h: Math.max(1, Number(raw?.h ?? raw?.height ?? 1)),
    elevation,
    heightPx,
    heightLevels: heightPx / RENDER_CONFIG.elevationStepPx,
    blocksMove: raw?.blocksMove === true,
    blocksLOS: raw?.blocksLOS === true,
    drawFallbackFaces: raw?.drawFallbackFaces === true,
    faceSprites: normalizeFaceSprites(raw),
    interiorSprites: normalizeInteriorSprites(raw),
    roofSprite: resolveStructureSpritePath(raw?.roof ?? raw?.roofSprite)
  };
}

export function resolveStructureSpritePath(name) {
  const value = String(name ?? "").trim();
  if (!value) return null;
  if (value.startsWith("./") || value.startsWith("/") || value.startsWith("art/")) return value;
  return `${DEFAULT_STRUCTURE_ART_ROOT}${value}`;
}

export function getStructureFaceSprite(structure, worldFace) {
  const face = normalizeWorldFace(worldFace);
  return face ? (structure?.faceSprites?.[face] ?? null) : null;
}

export function getStructureInteriorSprite(structure, worldFace) {
  const face = normalizeWorldFace(worldFace);
  return face ? (structure?.interiorSprites?.[face] ?? null) : null;
}

export function getStructuresAtTile(map, x, y) {
  return getMapStructures(map).filter((raw) => {
    const sx = Number(raw?.x ?? raw?.tileX);
    const sy = Number(raw?.y ?? raw?.tileY);
    const w = Math.max(1, Number(raw?.w ?? raw?.width ?? 1));
    const h = Math.max(1, Number(raw?.h ?? raw?.height ?? 1));
    return x >= sx && x < sx + w && y >= sy && y < sy + h;
  });
}

export function isStructureMoveBlockedAt(map, x, y) {
  return getStructuresAtTile(map, x, y).some((structure) => structure?.blocksMove === true);
}

export function isStructureLosBlockedAt(map, x, y) {
  return getStructuresAtTile(map, x, y).some((structure) => structure?.blocksLOS === true);
}

function normalizeFaceSprites(raw) {
  const src = raw?.faceSprites && typeof raw.faceSprites === "object"
    ? raw.faceSprites
    : raw?.faces && typeof raw.faces === "object"
      ? raw.faces
      : {};

  const legacyFace = resolveStructureSpritePath(raw?.face ?? raw?.faceSprite);
  const legacyLeft = resolveStructureSpritePath(raw?.leftFace);
  const legacyRight = resolveStructureSpritePath(raw?.rightFace);

  return {
    ne: resolveStructureSpritePath(src.ne) ?? legacyFace,
    se: resolveStructureSpritePath(src.se) ?? legacyRight ?? legacyFace,
    sw: resolveStructureSpritePath(src.sw) ?? legacyLeft ?? legacyFace,
    nw: resolveStructureSpritePath(src.nw) ?? legacyFace
  };
}

function normalizeInteriorSprites(raw) {
  const src = raw?.interiorSprites && typeof raw.interiorSprites === "object"
    ? raw.interiorSprites
    : raw?.interiors && typeof raw.interiors === "object"
      ? raw.interiors
      : {};

  const defaultInterior = resolveStructureSpritePath(
    raw?.interiorSprite ?? raw?.interiorFace ?? raw?.interior
  );

  return {
    ne: resolveStructureSpritePath(src.ne) ?? defaultInterior,
    se: resolveStructureSpritePath(src.se) ?? defaultInterior,
    sw: resolveStructureSpritePath(src.sw) ?? defaultInterior,
    nw: resolveStructureSpritePath(src.nw) ?? defaultInterior
  };
}
