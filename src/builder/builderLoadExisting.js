// src/builder/builderLoadExisting.js
//
// Catalog-backed map loading for the Mission Builder.
// Loading clones map data into builder draft memory; it does not mutate the
// original source map until/unless an exported file is intentionally copied over.

import { loadMapDefinitionByPath } from "../dataLoader.js";
import { setBuilderAuthoredMap } from "./builderState.js";
import { addExistingMapToMissionPackage } from "./builderMissionPackage.js";

export function getBuilderMapCatalogOptions(appState) {
  const maps = Array.isArray(appState?.content?.mapCatalog?.maps)
    ? appState.content.mapCatalog.maps
    : [];

  return maps
    .map((entry) => ({
      id: cleanString(entry?.id),
      name: cleanString(entry?.name) || cleanString(entry?.id),
      path: cleanString(entry?.path)
    }))
    .filter((entry) => entry.id && entry.path);
}

export async function loadExistingMapAsStandalone({ builderState, appState, root } = {}) {
  const entry = getSelectedMapCatalogEntry({ appState, root, fieldName: "existing-map-id" });
  if (!entry) return { ok: false, message: "No existing map selected to load." };

  const sourceMap = await loadCatalogMap(entry);
  if (!sourceMap) return { ok: false, message: `Could not load map ${entry.id}.` };

  const map = cloneMapForBuilder(sourceMap, entry, []);

  // A standalone loaded map starts a clean builder draft. The source map remains untouched.
  builderState.authoring = {
    map: null,
    maps: [],
    activeMapId: null,
    mission: null,
    source: "loaded-map-copy"
  };
  setBuilderAuthoredMap(builderState, map, "loaded-map-copy");

  return { ok: true, message: `Loaded ${entry.name || entry.id} as editable copy ${map.id}.` };
}

export async function loadExistingMapIntoMission({ builderState, appState, root } = {}) {
  const entry = getSelectedMapCatalogEntry({ appState, root, fieldName: "package-load-map-id" });
  if (!entry) return { ok: false, message: "No existing map selected to add to mission." };

  const sourceMap = await loadCatalogMap(entry);
  if (!sourceMap) return { ok: false, message: `Could not load map ${entry.id}.` };

  return addExistingMapToMissionPackage(builderState, sourceMap, entry);
}

function getSelectedMapCatalogEntry({ appState, root, fieldName }) {
  const options = getBuilderMapCatalogOptions(appState);
  if (!options.length) return null;

  const requestedId = readField(root, fieldName, options[0].id);
  return options.find((entry) => entry.id === requestedId) ?? options[0] ?? null;
}

async function loadCatalogMap(entry) {
  try {
    return await loadMapDefinitionByPath(entry.path);
  } catch (error) {
    console.error("Mission Builder failed to load existing map", entry, error);
    return null;
  }
}

function cloneMapForBuilder(sourceMap, sourceEntry, existingMaps) {
  const sourceId = sanitizeId(sourceMap?.id ?? sourceEntry?.id, "loaded_map");
  const sourceName = cleanString(sourceMap?.name ?? sourceEntry?.name) || titleFromId(sourceId);
  const id = createUniqueMapId(`${sourceId}_copy`, existingMaps);
  const map = cloneJson(sourceMap);
  map.id = id;
  map.name = `${sourceName} Copy`;
  return map;
}

function readField(root, fieldName, fallback = "") {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? String(node.value ?? "") : String(fallback ?? "");
}

function createUniqueMapId(baseId, maps) {
  const base = sanitizeId(baseId, "map");
  const used = new Set((Array.isArray(maps) ? maps : []).map((map) => sanitizeId(map?.id, "")).filter(Boolean));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function sanitizeId(value, fallback = "") {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || fallback;
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function titleFromId(id) {
  return String(id ?? "map")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
