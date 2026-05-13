// src/builder/builderExport.js
//
// Mission Builder export helpers.
// Builder export must create files that match the current game loader contract:
// - data/maps/[map_id].json
// - data/missions/[mission_id].json
// - data/maps/mapList.json
// - data/missions/missionList.json
// - package_manifest.json

import { getMapHeight, getMapWidth, getTile } from "../map.js";

const DEFAULT_TERRAIN_TYPES = ["grass", "rock", "sand", "water", "asphalt", "concrete"];

export function exportBuilderMissionPackage({ builderState, appState } = {}) {
  const mapDrafts = getExportMapDrafts(builderState);
  if (!mapDrafts.length) {
    return {
      ok: false,
      message: "No mission package maps are active. Create or load a mission before exporting."
    };
  }

  const mapDefinitions = mapDrafts.map(buildMapDefinitionForExport);
  const missionDraft = builderState?.authoring?.mission ?? null;
  const startMapId = sanitizeId(missionDraft?.startMapId ?? builderState?.authoring?.activeMapId ?? mapDefinitions[0]?.id, mapDefinitions[0]?.id);
  const startMapDefinition = mapDefinitions.find((map) => map.id === startMapId) ?? mapDefinitions[0];
  const missionDefinition = buildMissionDefinitionForExport(startMapDefinition, missionDraft, mapDefinitions);
  const packageDefinition = buildMissionPackageDefinition({ missionDefinition, mapDefinitions });
  const mapList = buildUpdatedMapList(appState?.content?.mapCatalog, mapDefinitions);
  const missionList = buildUpdatedMissionList(appState?.content?.missionCatalog, missionDefinition);
  const manifest = buildPackageManifest({ mapDefinitions, missionDefinition, packageDefinition, mapList, missionList });

  const files = [
    ...mapDefinitions.map((mapDefinition) => ({
      filename: `${mapDefinition.id}.json`,
      repoPath: `data/maps/${mapDefinition.id}.json`,
      data: mapDefinition
    })),
    {
      filename: `${missionDefinition.id}.json`,
      repoPath: `data/missions/${missionDefinition.id}.json`,
      data: missionDefinition
    },
    {
      filename: `${missionDefinition.id}.package.json`,
      repoPath: `data/packages/${missionDefinition.id}.package.json`,
      data: packageDefinition
    },
    {
      filename: "mapList.json",
      repoPath: "data/maps/mapList.json",
      data: mapList
    },
    {
      filename: "missionList.json",
      repoPath: "data/missions/missionList.json",
      data: missionList
    },
    {
      filename: `${missionDefinition.id}_package_manifest.json`,
      repoPath: "package_manifest.json",
      data: manifest
    }
  ];

  downloadMissionPackageZip({ missionDefinition, files });

  builderState.dirty = false;

  return {
    ok: true,
    message: `Exported mission package zip ${missionDefinition.id}.zip with ${mapDefinitions.length} map(s) and ${files.length} repo files.`,
    files
  };
}

export function buildMapDefinitionForExport(map) {
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const tiles = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      tiles.push({
        x,
        y,
        elevation: Number(tile.elevation ?? 0),
        terrainTypeId: tile.terrainTypeId ?? "grass",
        terrainSpriteId: tile.terrainSpriteId ?? null,
        movementClass: tile.movementClass ?? "clear",
        spawnId: tile.spawnId ?? null,
        detail: cloneJson(tile.detail ?? null)
      });
    }
  }

  return {
    id: sanitizeId(map?.id ?? "new_map", "new_map"),
    name: sanitizeName(map?.name ?? "New Map", "New Map"),
    width,
    height,
    mode: String(map?.mode ?? "combat").trim().toLowerCase() === "story" ? "story" : "combat",
    showPhaseBriefing: Boolean(map?.showPhaseBriefing),
    phaseBriefing: normalizePhaseBriefing(map),
    terrainTypes: normalizeTerrainTypes(map?.terrainTypes, tiles),
    defaults: normalizeMapDefaults(map),
    objectives: normalizeMissionObjectives(map?.objectives),
    triggers: normalizeTriggers(map?.triggers),
    logic: normalizeLogic(map?.logic),
    spawns: cloneJson(map?.spawns ?? { player: [], enemy: [], neutral: [] }),
    startState: normalizeStartState(map?.startState),
    structures: sanitizeStructuresForExport(map?.structures ?? []),
    tiles
  };
}

export function buildMissionDefinitionForExport(mapDefinition, mission = null, mapDefinitions = []) {
  const maps = Array.isArray(mapDefinitions) && mapDefinitions.length ? mapDefinitions : [mapDefinition].filter(Boolean);
  const startMapId = sanitizeId(mission?.startMapId ?? mission?.mapId ?? mapDefinition?.id, mapDefinition?.id ?? maps[0]?.id ?? "new_map");
  const startMap = maps.find((map) => map?.id === startMapId) ?? mapDefinition ?? maps[0];
  const missionId = sanitizeId(mission?.id ?? `${startMap.id}_mission`, `${startMap.id}_mission`);
  const missionName = sanitizeName(mission?.name ?? `${startMap.name} Mission`, `${startMap.name} Mission`);
  const startObjectives = getMapObjectivesForMission(startMap, mission);

  return {
    id: missionId,
    name: missionName,
    goalText: sanitizeName(mission?.goalText ?? "Complete all tactical phases.", "Complete all tactical phases."),
    mapId: startMap.id,
    mapPath: `./data/maps/${startMap.id}.json`,
    startMapId: startMap.id,
    maps: buildMissionMapEntries(maps, mission),
    objectivePreset: mission?.objectivePreset ?? startObjectives?.[0]?.type ?? "defeat_all",
    briefing: {
      title: sanitizeName(mission?.briefing?.title ?? missionName, missionName),
      text: mission?.briefing?.text ?? "Mission package created in the Mission Builder.",
      objectives: normalizeBriefingObjectives(mission?.briefing?.objectives, startObjectives)
    },
    objectives: normalizeMissionObjectives(startObjectives),
    triggers: normalizeTriggers(startMap?.triggers),
    logic: normalizeLogic(startMap?.logic ?? mission?.logic),
    dialogue: normalizeDialogue(mission?.dialogue ?? createDefaultDialogue()),
    results: mission?.results ?? {
      victory: { title: "Victory", text: "Mission complete." },
      defeat: { title: "Defeat", text: "Mission failed." }
    }
  };
}

export function buildMissionPackageDefinition({ missionDefinition, mapDefinitions } = {}) {
  const maps = Array.isArray(mapDefinitions) ? mapDefinitions : [];
  return {
    packageType: "ars-caelorum-mission-package",
    packageVersion: 1,
    id: missionDefinition?.id ?? "mission_package",
    name: missionDefinition?.name ?? "Mission Package",
    startMapId: missionDefinition?.startMapId ?? missionDefinition?.mapId ?? maps[0]?.id ?? null,
    mission: cloneJson(missionDefinition ?? null),
    maps: cloneJson(maps),
    triggers: cloneJson(missionDefinition?.triggers ?? []),
    logic: cloneJson(missionDefinition?.logic ?? []),
    dialogue: cloneJson(missionDefinition?.dialogue ?? {}),
    results: cloneJson(missionDefinition?.results ?? {})
  };
}

export function buildUpdatedMapList(existingCatalog, mapDefinitions) {
  const catalog = cloneJson(existingCatalog ?? {});
  const existingMaps = Array.isArray(catalog.maps) ? catalog.maps : [];
  const definitions = Array.isArray(mapDefinitions) ? mapDefinitions : [mapDefinitions].filter(Boolean);
  const nextMaps = definitions.reduce((entries, mapDefinition) => {
    return upsertCatalogEntry(entries, {
      id: mapDefinition.id,
      name: mapDefinition.name,
      path: `./data/maps/${mapDefinition.id}.json`
    });
  }, existingMaps);

  return {
    defaultMapId: catalog.defaultMapId ?? existingMaps[0]?.id ?? definitions[0]?.id ?? null,
    maps: nextMaps
  };
}

export function buildUpdatedMissionList(existingCatalog, missionDefinition) {
  const catalog = cloneJson(existingCatalog ?? {});
  const missions = Array.isArray(catalog.missions) ? catalog.missions : [];
  const entry = {
    id: missionDefinition.id,
    name: missionDefinition.name,
    path: `./data/missions/${missionDefinition.id}.json`
  };

  return {
    defaultMissionId: catalog.defaultMissionId ?? missions[0]?.id ?? missionDefinition.id,
    missions: upsertCatalogEntry(missions, entry)
  };
}

function getExportMapDrafts(builderState) {
  const authoring = builderState?.authoring ?? {};
  const maps = Array.isArray(authoring.maps) && authoring.maps.length
    ? [...authoring.maps]
    : authoring.map ? [authoring.map] : [];

  if (authoring.map?.id) {
    const activeId = sanitizeId(authoring.map.id, "");
    const index = maps.findIndex((map) => sanitizeId(map?.id, "") === activeId);
    if (index >= 0) maps[index] = authoring.map;
    else maps.push(authoring.map);
  }

  return maps.filter(Boolean);
}

function buildMissionMapEntries(mapDefinitions, mission) {
  const missionMaps = Array.isArray(mission?.maps) ? mission.maps : [];
  return mapDefinitions.map((mapDefinition, index) => {
    const existing = missionMaps.find((entry) => sanitizeId(entry?.id ?? entry?.mapId, "") === mapDefinition.id) ?? {};
    const objectives = normalizeMissionObjectives(mapDefinition.objectives);
    return {
      id: mapDefinition.id,
      name: mapDefinition.name,
      path: `./data/maps/${mapDefinition.id}.json`,
      mapPath: `./data/maps/${mapDefinition.id}.json`,
      phaseIndex: index + 1,
      objectiveSummary: existing.objectiveSummary ?? objectives.map((objective) => objective?.briefingText || objective?.label || objective?.id).filter(Boolean).join("; "),
      objectiveCount: objectives.length
    };
  });
}

function getMapObjectivesForMission(mapDefinition, mission) {
  if (Array.isArray(mapDefinition?.objectives) && mapDefinition.objectives.length) return mapDefinition.objectives;
  if (Array.isArray(mission?.objectives) && mission.objectives.length) return mission.objectives;
  return null;
}

function createDefaultDialogue() {
  return {
    intro: { lines: [{ speakerId: "system", name: "Mission Control", text: "Mission loaded." }] },
    victory: { lines: [{ speakerId: "system", name: "Mission Control", text: "Victory confirmed." }] },
    defeat: { lines: [{ speakerId: "system", name: "Mission Control", text: "Mission failed." }] }
  };
}

function normalizePhaseBriefing(map) {
  const phase = map?.phaseBriefing ?? {};
  const objectives = Array.isArray(phase.objectives) && phase.objectives.length
    ? phase.objectives.map((item) => String(item ?? "").trim()).filter(Boolean)
    : normalizeMissionObjectives(map?.objectives).map((objective) => String(objective?.briefingText ?? objective?.label ?? objective?.id ?? "").trim()).filter(Boolean);

  return {
    title: sanitizeName(phase.title ?? map?.name ?? "Mission Update", map?.name ?? "Mission Update"),
    subtitle: sanitizeName(phase.subtitle ?? phase.location ?? map?.id ?? "", map?.id ?? ""),
    text: sanitizeName(phase.text ?? "Review the current phase objectives, then continue.", "Review the current phase objectives, then continue."),
    objectives
  };
}

function normalizeMapDefaults(map) {
  return {
    ...(cloneJson(map?.defaults ?? {})),
    terrainTypeId: map?.defaults?.terrainTypeId ?? map?.defaultTerrainTypeId ?? map?.terrainTypes?.[0] ?? "grass",
    elevation: Number(map?.defaults?.elevation ?? 0),
    movementClass: map?.defaults?.movementClass ?? "clear"
  };
}

function normalizeBriefingObjectives(lines, objectives) {
  const clean = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  if (clean.length) return clean;

  const fromObjectives = (Array.isArray(objectives) ? objectives : [])
    .map((objective) => String(objective?.briefingText ?? objective?.label ?? objective?.id ?? "").trim())
    .filter(Boolean);
  return fromObjectives.length ? fromObjectives : ["Defeat all enemy units."];
}

function normalizeMissionObjectives(objectives) {
  if (Array.isArray(objectives) && objectives.length) return cloneJson(objectives);

  return [
    {
      id: "defeat_enemies",
      type: "defeat_all",
      targetTeam: "enemy",
      label: "Defeat all enemy units",
      briefingText: "Defeat all enemy units."
    }
  ];
}

function buildPackageManifest({ mapDefinitions, missionDefinition, packageDefinition, mapList, missionList }) {
  const maps = Array.isArray(mapDefinitions) ? mapDefinitions : [];
  return {
    packageType: "ars-caelorum-mission-package-export",
    packageVersion: 2,
    source: "Mission Builder",
    generatedAt: new Date().toISOString(),
    missionId: missionDefinition.id,
    startMapId: missionDefinition.startMapId ?? missionDefinition.mapId,
    mapIds: maps.map((map) => map.id),
    files: [
      ...maps.map((map) => `data/maps/${map.id}.json`),
      `data/missions/${missionDefinition.id}.json`,
      `data/packages/${packageDefinition.id}.package.json`,
      "data/maps/mapList.json",
      "data/missions/missionList.json"
    ],
    catalog: {
      mapListUpdated: maps.every((map) => Boolean(mapList?.maps?.some((entry) => entry?.id === map.id))),
      missionListUpdated: Boolean(missionList?.missions?.some((entry) => entry?.id === missionDefinition.id))
    },
    notes: [
      "Mission is the loadable unit. Maps are mission phases or reusable imports.",
      "Copy all data/maps/*.json files into data/maps/.",
      "Copy the mission file into data/missions/.",
      "Copy the package JSON into data/packages/ for builder archive/future package loading.",
      "Replace data/maps/mapList.json and data/missions/missionList.json, or manually merge the exported entries.",
      "Mission Select uses missionList.json. The mission file points at the start map and lists all package maps."
    ]
  };
}

function upsertCatalogEntry(entries, newEntry) {
  const cleanEntries = Array.isArray(entries) ? entries.filter(Boolean).map((entry) => ({ ...entry })) : [];
  const index = cleanEntries.findIndex((entry) => entry?.id === newEntry.id);

  if (index >= 0) {
    cleanEntries[index] = { ...cleanEntries[index], ...newEntry };
    return cleanEntries;
  }

  return [...cleanEntries, newEntry];
}

function normalizeTerrainTypes(values, tiles) {
  const set = new Set();
  const base = Array.isArray(values) && values.length ? values : DEFAULT_TERRAIN_TYPES;

  for (const value of base) {
    const clean = sanitizeId(value, null);
    if (clean) set.add(clean);
  }

  for (const tile of tiles) {
    const clean = sanitizeId(tile?.terrainTypeId, null);
    if (clean) set.add(clean);
  }

  return [...set];
}

function normalizeStartState(startState) {
  const clean = cloneJson(startState ?? {});

  return {
    ...clean,
    startMode: clean.startMode ?? "authored",
    deployments: Array.isArray(clean.deployments) ? clean.deployments : [],
    deploymentCells: Array.isArray(clean.deploymentCells) ? clean.deploymentCells : []
  };
}

function sanitizeStructuresForExport(structures) {
  if (!Array.isArray(structures)) return [];

  return structures.map((structure) => {
    const clean = cloneJson(structure ?? {});
    delete clean.blocksMove;
    delete clean.blocksLOS;

    if (Array.isArray(clean.edges)) {
      clean.edges = clean.edges.map((edge) => {
        const cleanEdge = cloneJson(edge ?? {});
        delete cleanEdge.blocksMove;
        delete cleanEdge.blocksLOS;
        cleanEdge.edgeHeight = Math.max(0, Number(cleanEdge.edgeHeight ?? cleanEdge.height ?? cleanEdge.heightLevels ?? 0));
        return cleanEdge;
      });
    }

    return clean;
  });
}


function normalizeDialogue(dialogue) {
  const source = dialogue && typeof dialogue === "object" && !Array.isArray(dialogue) ? dialogue : createDefaultDialogue();
  const clean = {};
  for (const [key, block] of Object.entries(source)) {
    const dialogueKey = sanitizeId(key, "");
    if (!dialogueKey) continue;
    const lines = Array.isArray(block?.lines) ? block.lines : [];
    clean[dialogueKey] = {
      ...(block?.name ? { name: sanitizeName(block.name, dialogueKey) } : {}),
      lines: lines
        .map((line) => {
          const text = String(line?.text ?? "").trim();
          if (!text) return null;
          const next = {
            speakerId: sanitizeId(line?.speakerId ?? "system", "system"),
            name: sanitizeName(line?.name ?? line?.speakerId ?? "Unknown", "Unknown"),
            text
          };
          if (line?.portrait) next.portrait = String(line.portrait).trim();
          return next;
        })
        .filter(Boolean)
    };
  }
  return Object.keys(clean).length ? clean : createDefaultDialogue();
}

function normalizeTriggers(triggers) {
  if (!Array.isArray(triggers)) return [];

  return triggers.map((trigger) => {
    const clean = cloneJson(trigger ?? {});
    clean.id = sanitizeId(clean.id, "trigger");
    clean.name = sanitizeName(clean.name, clean.id);
    clean.preset = sanitizeId(clean.preset, "load_map");
    clean.type = sanitizeName(clean.type, "onUnitEnterZone");
    clean.team = sanitizeId(clean.team, "player");
    clean.once = clean.once !== false;
    clean.tiles = Array.isArray(clean.tiles)
      ? clean.tiles
          .map((tile) => ({ x: Number(tile?.x), y: Number(tile?.y) }))
          .filter((tile) => Number.isInteger(tile.x) && Number.isInteger(tile.y))
      : [];
    if (clean.completeObjectiveId) clean.completeObjectiveId = sanitizeId(clean.completeObjectiveId, "");
    if (clean.nextMapId) clean.nextMapId = sanitizeId(clean.nextMapId, "");
    if (clean.stat) clean.stat = sanitizeId(clean.stat, "core");
    if (clean.value !== undefined) clean.value = Math.trunc(Number(clean.value) || 0);
    if (clean.missionResult) clean.missionResult = sanitizeId(clean.missionResult, "victory");
    if (clean.dialogueKey) clean.dialogueKey = sanitizeId(clean.dialogueKey, "intro");
    if (clean.logicChainId) clean.logicChainId = sanitizeId(clean.logicChainId, "");
    return clean;
  });
}

function normalizeLogic(logic) {
  if (!Array.isArray(logic)) return [];
  return logic.map((chain) => {
    const clean = cloneJson(chain ?? {});
    clean.id = sanitizeId(clean.id, "logic_chain");
    clean.name = sanitizeName(clean.name, clean.id);
    clean.conditions = normalizeLogicConditions(clean.conditions);
    clean.actions = normalizeLogicActions(clean.actions);
    return clean;
  });
}

function normalizeLogicConditions(conditions) {
  if (!Array.isArray(conditions)) return [];
  return conditions.map((condition) => {
    const clean = cloneJson(condition ?? {});
    clean.type = sanitizeId(clean.type, "none");
    if (clean.objectiveId) clean.objectiveId = sanitizeId(clean.objectiveId, "");
    if (clean.flagId) clean.flagId = sanitizeId(clean.flagId, "");
    if (clean.round !== undefined) clean.round = Math.max(1, Math.trunc(Number(clean.round) || 1));
    return clean;
  }).filter((condition) => condition.type && condition.type !== "none");
}

function normalizeLogicActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action) => {
    const clean = cloneJson(action ?? {});
    clean.type = sanitizeId(clean.type, "complete_objective");
    if (clean.objectiveId) clean.objectiveId = sanitizeId(clean.objectiveId, "");
    if (clean.nextMapId) clean.nextMapId = sanitizeId(clean.nextMapId, "");
    if (clean.stat) clean.stat = sanitizeId(clean.stat, "core");
    if (clean.value !== undefined) clean.value = Math.trunc(Number(clean.value) || 0);
    if (clean.missionResult) clean.missionResult = sanitizeId(clean.missionResult, "victory");
    if (clean.dialogueKey) clean.dialogueKey = sanitizeId(clean.dialogueKey, "intro");
    if (clean.flagId) clean.flagId = sanitizeId(clean.flagId, "");
    if (clean.itemId) clean.itemId = sanitizeId(clean.itemId, "");
    if (clean.target) clean.target = sanitizeId(clean.target, "triggering_unit");
    return clean;
  });
}

function downloadMissionPackageZip({ missionDefinition, files }) {
  const zipEntries = files.map((file) => ({
    path: file.repoPath || file.filename,
    text: JSON.stringify(file.data, null, 2)
  }));

  const zipBlob = buildStoredZip(zipEntries);
  const url = URL.createObjectURL(zipBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${missionDefinition.id}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildStoredZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBytes = encoder.encode(String(entry.path).replace(/^\/+/, ""));
    const dataBytes = encoder.encode(entry.text ?? "");
    const crc = crc32(dataBytes);
    const localHeader = makeLocalFileHeader({ pathBytes, dataBytes, crc });

    localParts.push(localHeader, dataBytes);
    centralParts.push(makeCentralDirectoryHeader({ pathBytes, dataBytes, crc, localHeaderOffset: offset }));
    offset += localHeader.length + dataBytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = makeEndOfCentralDirectoryRecord({
    entryCount: entries.length,
    centralSize,
    centralOffset
  });

  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}

function makeLocalFileHeader({ pathBytes, dataBytes, crc }) {
  const header = new Uint8Array(30 + pathBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, dataBytes.length, true);
  view.setUint32(22, dataBytes.length, true);
  view.setUint16(26, pathBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(pathBytes, 30);
  return header;
}

function makeCentralDirectoryHeader({ pathBytes, dataBytes, crc, localHeaderOffset }) {
  const header = new Uint8Array(46 + pathBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, dataBytes.length, true);
  view.setUint32(24, dataBytes.length, true);
  view.setUint16(28, pathBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  header.set(pathBytes, 46);
  return header;
}

function makeEndOfCentralDirectoryRecord({ entryCount, centralSize, centralOffset }) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return record;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
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
