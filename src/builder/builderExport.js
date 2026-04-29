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
  const map = builderState?.authoring?.map ?? null;
  if (!map) {
    return {
      ok: false,
      message: "No builder-owned map is active. Create a New Blank Map before exporting."
    };
  }

  const mapDefinition = buildMapDefinitionForExport(map);
  const missionDefinition = buildMissionDefinitionForExport(mapDefinition, builderState?.authoring?.mission);
  const mapList = buildUpdatedMapList(appState?.content?.mapCatalog, mapDefinition);
  const missionList = buildUpdatedMissionList(appState?.content?.missionCatalog, missionDefinition);
  const manifest = buildPackageManifest({ mapDefinition, missionDefinition, mapList, missionList });

  const files = [
    {
      filename: `${mapDefinition.id}.json`,
      repoPath: `data/maps/${mapDefinition.id}.json`,
      data: mapDefinition
    },
    {
      filename: `${missionDefinition.id}.json`,
      repoPath: `data/missions/${missionDefinition.id}.json`,
      data: missionDefinition
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
    message: `Exported mission package zip ${missionDefinition.id}.zip with ${files.length} repo files.`,
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
    terrainTypes: normalizeTerrainTypes(map?.terrainTypes, tiles),
    spawns: cloneJson(map?.spawns ?? { player: [], enemy: [] }),
    startState: normalizeStartState(map?.startState),
    structures: sanitizeStructuresForExport(map?.structures ?? []),
    tiles
  };
}

export function buildMissionDefinitionForExport(mapDefinition, mission = null) {
  const missionId = sanitizeId(mission?.id ?? `${mapDefinition.id}_mission`, `${mapDefinition.id}_mission`);
  const missionName = sanitizeName(mission?.name ?? `${mapDefinition.name} Mission`, `${mapDefinition.name} Mission`);

  return {
    id: missionId,
    name: missionName,
    mapId: mapDefinition.id,
    mapPath: `./data/maps/${mapDefinition.id}.json`,
    briefing: {
      title: missionName,
      text: mission?.briefing?.text ?? "Builder-authored mission package. Replace this briefing text in the Mission Builder when mission authoring comes online.",
      objectives: mission?.briefing?.objectives ?? ["Defeat all enemy pilots."]
    },
    objectives: mission?.objectives ?? [
      {
        id: "defeat_enemies",
        type: "defeat_all",
        targetTeam: "enemy",
        label: "Defeat all enemy pilots"
      }
    ],
    dialogue: mission?.dialogue ?? {
      intro: {
        lines: [
          {
            speakerId: "system",
            name: "Mission Control",
            text: "Mission package loaded through builder export."
          }
        ]
      },
      victory: {
        lines: [
          {
            speakerId: "system",
            name: "Mission Control",
            text: "Victory confirmed."
          }
        ]
      },
      defeat: {
        lines: [
          {
            speakerId: "system",
            name: "Mission Control",
            text: "Mission failed."
          }
        ]
      }
    },
    results: mission?.results ?? {
      victory: { title: "Victory", text: "Mission complete." },
      defeat: { title: "Defeat", text: "Mission failed." }
    }
  };
}

export function buildUpdatedMapList(existingCatalog, mapDefinition) {
  const catalog = cloneJson(existingCatalog ?? {});
  const maps = Array.isArray(catalog.maps) ? catalog.maps : [];
  const entry = {
    id: mapDefinition.id,
    name: mapDefinition.name,
    path: `./data/maps/${mapDefinition.id}.json`
  };

  return {
    defaultMapId: catalog.defaultMapId ?? maps[0]?.id ?? mapDefinition.id,
    maps: upsertCatalogEntry(maps, entry)
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

function buildPackageManifest({ mapDefinition, missionDefinition, mapList, missionList }) {
  return {
    packageType: "ars-caelorum-mission-package",
    packageVersion: 1,
    source: "Mission Builder",
    generatedAt: new Date().toISOString(),
    missionId: missionDefinition.id,
    mapId: mapDefinition.id,
    files: [
      `data/maps/${mapDefinition.id}.json`,
      `data/missions/${missionDefinition.id}.json`,
      "data/maps/mapList.json",
      "data/missions/missionList.json"
    ],
    catalog: {
      mapListUpdated: Boolean(mapList?.maps?.some((entry) => entry?.id === mapDefinition.id)),
      missionListUpdated: Boolean(missionList?.missions?.some((entry) => entry?.id === missionDefinition.id))
    },
    notes: [
      "Copy the map file into data/maps/.",
      "Copy the mission file into data/missions/.",
      "Replace data/maps/mapList.json with the exported mapList.json, or manually add the new map entry.",
      "Replace data/missions/missionList.json with the exported missionList.json, or manually add the new mission entry.",
      "Mission Select uses missionList.json. The mission file points at the exported map file."
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
