// src/builder/builderLoadExisting.js
//
// Catalog-backed map loading for the Mission Builder.
// Loading clones map data into builder draft memory; it does not mutate the
// original source map until/unless an exported file is intentionally copied over.

import {
  loadMapDefinitionByPath,
  loadMissionDefinitionByPath
} from "../dataLoader.js";
import { cloneMapDefinition } from "../map.js";
import {
  pushBuilderLog,
  setBuilderAuthoredMap,
  syncBuilderAuthoredMap
} from "./builderState.js";
import {
  addExistingMapToMissionPackage,
  ensureMissionPackageDraft,
  setActiveMissionPackageMap
} from "./builderMissionPackage.js";

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


export function getBuilderMissionCatalogOptions(appState) {
  const missions = Array.isArray(appState?.content?.missionCatalog?.missions)
    ? appState.content.missionCatalog.missions
    : [];

  return missions
    .map((entry) => ({
      id: cleanString(entry?.id),
      name: cleanString(entry?.name) || cleanString(entry?.id),
      path: cleanString(entry?.path)
    }))
    .filter((entry) => entry.id && entry.path);
}

export async function loadExistingMapAsStandalone({ builderState, appState, root } = {}) {
  const entry = getSelectedMapCatalogEntry({ builderState, appState, root, fieldName: "existing-map-id", stateKey: "standaloneMapId" });
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
  ensureMissionPackageDraft(builderState);

  return { ok: true, message: `Loaded ${entry.name || entry.id} as editable copy ${map.id}.` };
}

export async function loadExistingMapIntoMission({ builderState, appState, root } = {}) {
  const entry = getSelectedMapCatalogEntry({ builderState, appState, root, fieldName: "package-load-map-id", stateKey: "packageMapId" });
  if (!entry) return { ok: false, message: "No existing map selected to add to mission." };

  const sourceMap = await loadCatalogMap(entry);
  if (!sourceMap) return { ok: false, message: `Could not load map ${entry.id}.` };

  return addExistingMapToMissionPackage(builderState, sourceMap, entry);
}


export async function loadExistingMissionPackageAsDraft({ builderState, appState, root } = {}) {
  const entry = getSelectedMissionCatalogEntry({ builderState, appState, root, fieldName: "existing-mission-id", stateKey: "standaloneMissionId" });
  if (!entry) return { ok: false, message: "No existing mission selected to load." };

  const mission = await loadCatalogMission(entry);
  if (!mission) return { ok: false, message: `Could not load mission ${entry.id}.` };

  const mapEntries = getMissionMapLoadEntries(mission, appState);
  if (!mapEntries.length) return { ok: false, message: `Mission ${entry.id} has no map references to load.` };

  const loadedMaps = [];
  for (const mapEntry of mapEntries) {
    const map = await loadCatalogMap(mapEntry);
    if (!map) {
      return { ok: false, message: `Could not load map ${mapEntry.id || mapEntry.path} for mission ${entry.id}.` };
    }
    loadedMaps.push(cloneMapForMissionDraft(map, mapEntry));
  }

  const startMapId = sanitizeId(mission.startMapId ?? mission.mapId ?? loadedMaps[0]?.id, loadedMaps[0]?.id ?? "new_map");
  const activeMap = loadedMaps.find((map) => sanitizeId(map?.id, "") === startMapId) ?? loadedMaps[0];

  const missionDraft = cloneJson(mission);
  missionDraft.id = sanitizeId(missionDraft.id ?? entry.id, entry.id);
  missionDraft.name = cleanString(missionDraft.name ?? entry.name) || titleFromId(missionDraft.id);
  missionDraft.startMapId = activeMap?.id ?? startMapId;
  missionDraft.mapId = missionDraft.startMapId;
  missionDraft.mapPath = `./data/maps/${missionDraft.startMapId}.json`;

  // Older missions keep objectives on the mission wrapper. Preserve that truth by
  // attaching it to the start map only when the map itself has no objective data.
  if (Array.isArray(missionDraft.objectives) && missionDraft.objectives.length && activeMap && (!Array.isArray(activeMap.objectives) || !activeMap.objectives.length)) {
    activeMap.objectives = cloneJson(missionDraft.objectives);
  }

  builderState.authoring = {
    map: activeMap,
    maps: loadedMaps,
    activeMapId: activeMap?.id ?? null,
    mission: missionDraft,
    source: "loaded-mission-package"
  };
  builderState.workspaceMode = "builder-map";
  builderState.activeTab = "project";
  builderState.status = "BUILDER MAP";
  builderState.dirty = false;
  ensureMissionPackageDraft(builderState);
  setActiveMissionPackageMap(builderState, activeMap?.id);
  syncBuilderAuthoredMap(builderState);
  pushBuilderLog(builderState, `Loaded mission ${missionDraft.name} with ${loadedMaps.length} map draft(s).`);

  return { ok: true, message: `Loaded mission ${missionDraft.name} for editing.` };
}

function getSelectedMapCatalogEntry({ builderState, appState, root, fieldName, stateKey }) {
  const options = getBuilderMapCatalogOptions(appState);
  if (!options.length) return null;

  const stateId = stateKey ? builderState?.loadExistingTool?.[stateKey] : "";
  const requestedId = readField(root, fieldName, stateId || options[0].id);
  const selected = options.find((entry) => entry.id === requestedId) ?? options[0] ?? null;

  if (selected && stateKey) {
    ensureLoadExistingTool(builderState);
    builderState.loadExistingTool[stateKey] = selected.id;
  }

  return selected;
}


function getSelectedMissionCatalogEntry({ builderState, appState, root, fieldName, stateKey }) {
  const options = getBuilderMissionCatalogOptions(appState);
  if (!options.length) return null;

  const stateId = stateKey ? builderState?.loadExistingTool?.[stateKey] : "";
  const requestedId = readField(root, fieldName, stateId || options[0].id);
  const selected = options.find((entry) => entry.id === requestedId) ?? options[0] ?? null;

  if (selected && stateKey) {
    ensureLoadExistingTool(builderState);
    builderState.loadExistingTool[stateKey] = selected.id;
  }

  return selected;
}

async function loadCatalogMap(entry) {
  try {
    return await loadMapDefinitionByPath(entry.path);
  } catch (error) {
    console.error("Mission Builder failed to load existing map", entry, error);
    return null;
  }
}

async function loadCatalogMission(entry) {
  try {
    return await loadMissionDefinitionByPath(entry.path);
  } catch (error) {
    console.error("Mission Builder failed to load existing mission", entry, error);
    return null;
  }
}

function getMissionMapLoadEntries(mission, appState) {
  const catalogMaps = getBuilderMapCatalogOptions(appState);
  const byId = new Map(catalogMaps.map((entry) => [entry.id, entry]));
  const entries = [];

  const pushEntry = (raw) => {
    const id = cleanString(raw?.id ?? raw?.mapId);
    const path = cleanString(raw?.path ?? raw?.mapPath);
    const catalog = id ? byId.get(id) : null;
    const entry = {
      id: id || cleanString(catalog?.id),
      name: cleanString(raw?.name ?? catalog?.name ?? id),
      path: path || cleanString(catalog?.path)
    };
    if (!entry.path && entry.id) entry.path = `./data/maps/${entry.id}.json`;
    if (entry.path && !entries.some((candidate) => candidate.path === entry.path || (entry.id && candidate.id === entry.id))) {
      entries.push(entry);
    }
  };

  if (Array.isArray(mission?.maps) && mission.maps.length) {
    mission.maps.forEach(pushEntry);
  } else {
    pushEntry({ id: mission?.mapId ?? mission?.startMapId, name: mission?.mapName, path: mission?.mapPath });
  }

  return entries.filter((entry) => entry.path);
}

function cloneMapForBuilder(sourceMap, sourceEntry, existingMaps) {
  const sourceId = sanitizeId(sourceMap?.id ?? sourceEntry?.id, "loaded_map");
  const sourceName = cleanString(sourceMap?.name ?? sourceEntry?.name) || titleFromId(sourceId);
  const id = createUniqueMapId(`${sourceId}_copy`, existingMaps);
  const map = cloneMapWithMetadata(sourceMap);
  map.id = id;
  map.name = `${sourceName} Copy`;
  normalizeBuilderMapMetadata(map);
  return map;
}

function cloneMapForMissionDraft(sourceMap, sourceEntry) {
  const map = cloneMapWithMetadata(sourceMap);
  map.id = sanitizeId(map?.id ?? sourceEntry?.id, sourceEntry?.id || "loaded_map");
  map.name = cleanString(map?.name ?? sourceEntry?.name) || titleFromId(map.id);
  normalizeBuilderMapMetadata(map);
  return map;
}

function cloneMapWithMetadata(sourceMap) {
  const map = cloneMapDefinition(sourceMap);
  normalizeBuilderMapMetadata(map);
  return map;
}

function normalizeBuilderMapMetadata(map) {
  if (!map) return map;
  if (!map.spawns || typeof map.spawns !== "object") map.spawns = { player: [], enemy: [], neutral: [] };
  if (!map.startState || typeof map.startState !== "object") map.startState = { deployments: [], deploymentCells: [] };
  if (!Array.isArray(map.startState.deployments)) map.startState.deployments = [];
  if (!Array.isArray(map.startState.deploymentCells)) map.startState.deploymentCells = [];
  if (!Array.isArray(map.structures)) map.structures = [];
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

function ensureLoadExistingTool(builderState) {
  if (!builderState.loadExistingTool) {
    builderState.loadExistingTool = { standaloneMapId: "", packageMapId: "", standaloneMissionId: "" };
  }
  if (typeof builderState.loadExistingTool.standaloneMapId !== "string") builderState.loadExistingTool.standaloneMapId = "";
  if (typeof builderState.loadExistingTool.packageMapId !== "string") builderState.loadExistingTool.packageMapId = "";
  if (typeof builderState.loadExistingTool.standaloneMissionId !== "string") builderState.loadExistingTool.standaloneMissionId = "";
  return builderState.loadExistingTool;
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
