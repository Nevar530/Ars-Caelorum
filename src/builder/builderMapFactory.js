// src/builder/builderMapFactory.js
//
// Builder-owned map creation helpers.
// These create exportable map truth for the Mission Builder without mutating
// the currently loaded runtime mission/map.

import {
  attachMapMetadata,
  createTile
} from "../map.js";

export const BUILDER_DEFAULT_TERRAIN_TYPES = [
  "grass",
  "rock",
  "sand",
  "water",
  "asphalt",
  "concrete"
];

export function createBlankBuilderMap(options = {}) {
  const width = clampWholeNumber(options.width, 16, 4, 96);
  const height = clampWholeNumber(options.height, 16, 4, 96);
  const elevation = clampWholeNumber(options.elevation, 0, -8, 16);
  const terrainTypeId = sanitizeId(options.terrainTypeId || "grass", "grass");
  const terrainDefinition = options.terrainDefinitions?.[terrainTypeId] ?? null;
  const id = sanitizeId(options.id || "new_map", "new_map");
  const name = sanitizeName(options.name || titleFromId(id), "New Map");
  const terrainTypes = normalizeTerrainTypes(options.terrainTypes, terrainTypeId);

  const map = [];

  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      row.push(createTile(x, y, elevation, {
        terrainTypeId,
        terrainSpriteId: terrainDefinition?.spriteSetId ?? `${terrainTypeId}_001`,
        movementClass: terrainDefinition?.movementClass ?? "clear"
      }));
    }
    map.push(row);
  }

  return attachMapMetadata(map, {
    id,
    name,
    width,
    height,
    terrainTypes,
    spawns: { player: [], enemy: [], neutral: [] },
    startState: { deployments: [], deploymentCells: [] },
    structures: []
  });
}

export function readBlankMapForm(root) {
  const getValue = (name) => root?.querySelector(`[data-builder-field="${name}"]`)?.value;

  return {
    id: getValue("map-id"),
    name: getValue("map-name"),
    width: getValue("map-width"),
    height: getValue("map-height"),
    terrainTypeId: getValue("base-terrain"),
    elevation: getValue("base-elevation")
  };
}

function normalizeTerrainTypes(values, requiredType) {
  const base = Array.isArray(values) && values.length ? values : BUILDER_DEFAULT_TERRAIN_TYPES;
  const set = new Set(base.map((value) => sanitizeId(value, null)).filter(Boolean));
  set.add(sanitizeId(requiredType, "grass"));
  return [...set];
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

function sanitizeName(value, fallback) {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function titleFromId(id) {
  return String(id ?? "new_map")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
