// src/builder/builderExport.js
//
// Builder-owned export helpers.
// These produce data that matches the current map JSON contract the engine already loads.
// They do not mutate runtime state and do not change engine behavior.

import {
  getMapHeight,
  getMapWidth,
  getTile
} from "../map.js";

export function buildBuilderMapDefinition(map) {
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
        detail: cloneJsonSafe(tile.detail ?? null)
      });
    }
  }

  return {
    id: map?.id ?? "exported_map",
    name: map?.name ?? "Exported Map",
    width,
    height,
    terrainTypes: Array.isArray(map?.terrainTypes)
      ? [...map.terrainTypes]
      : ["grass", "rock", "sand", "water", "asphalt", "concrete"],
    spawns: cloneJsonSafe(map?.spawns ?? { player: [], enemy: [] }),
    startState: cloneJsonSafe(map?.startState ?? { deployments: [], deploymentCells: [] }),
    structures: sanitizeStructuresForExport(map?.structures ?? []),
    tiles
  };
}

export function buildBuilderMapListPatch(mapDefinition) {
  const id = mapDefinition?.id ?? "exported_map";
  const name = mapDefinition?.name ?? id;

  return {
    instructions: "Add this entry to data/maps/mapList.json maps[]. Keep commas valid in the final JSON file.",
    entry: {
      id,
      name,
      path: `./data/maps/${id}.json`
    }
  };
}

export function exportBuilderMapFiles(map) {
  if (!map) {
    return {
      ok: false,
      message: "No map is available to export. Create a blank map or open a current map first."
    };
  }

  const mapDefinition = buildBuilderMapDefinition(map);
  const catalogPatch = buildBuilderMapListPatch(mapDefinition);
  const mapFileName = `${mapDefinition.id}.json`;
  const patchFileName = `${mapDefinition.id}_mapList_entry.json`;

  downloadJsonFile(mapFileName, mapDefinition);
  window.setTimeout(() => downloadJsonFile(patchFileName, catalogPatch), 75);

  return {
    ok: true,
    mapDefinition,
    files: [mapFileName, patchFileName],
    message: `Exported ${mapFileName} and ${patchFileName}.`
  };
}

function sanitizeStructuresForExport(structures) {
  if (!Array.isArray(structures)) return [];

  return structures.map((structure) => {
    const clean = cloneJsonSafe(structure ?? {});

    // Runtime structure truth must come from edgeHeight, not legacy blocking booleans.
    delete clean.blocksMove;
    delete clean.blocksLOS;

    if (Array.isArray(clean.edges)) {
      clean.edges = clean.edges.map((edge) => {
        const cleanEdge = cloneJsonSafe(edge ?? {});
        delete cleanEdge.blocksMove;
        delete cleanEdge.blocksLOS;
        cleanEdge.edgeHeight = Math.max(0, Number(cleanEdge.edgeHeight ?? cleanEdge.height ?? cleanEdge.heightLevels ?? 0));
        return cleanEdge;
      });
    }

    return clean;
  });
}

function downloadJsonFile(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function cloneJsonSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
