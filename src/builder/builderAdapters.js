// src/builder/builderAdapters.js
//
// Read-only adapter layer for the new Mission Builder.
// Builder UI should ask this layer for runtime/map truth instead of reaching
// randomly into old editor internals. These helpers do not mutate engine state.

import {
  getMapHeight,
  getMapWidth,
  getTile,
  getTileRenderElevation
} from "../map.js";
import {
  getMapStructures,
  getStructureCells,
  getStructureEdgeParts,
  getStructuresAtTile,
  makeCellKey
} from "../structures/structureRules.js";

export function getRuntimeMap(appState) {
  return appState?.map ?? null;
}

export function getRuntimeMissionDefinition(appState) {
  return appState?.mission?.definition ?? null;
}

export function getRuntimeUnits(appState) {
  return Array.isArray(appState?.units) ? appState.units : [];
}

export function getMapSummary(appState) {
  const map = getRuntimeMap(appState);
  return {
    id: map?.id ?? "runtime-map",
    name: map?.name ?? map?.id ?? "Runtime Map",
    width: getMapWidth(map),
    height: getMapHeight(map),
    structureCount: getMapStructures(map).length,
    deploymentCellCount: getDeploymentCellTruth(map).length,
    spawnCount: getSpawnTruth(map).length
  };
}

export function getTileTruth(appState, x, y) {
  const map = getRuntimeMap(appState);
  const tileX = Number(x);
  const tileY = Number(y);
  const tile = getTile(map, tileX, tileY);
  if (!tile) return null;

  return {
    x: tileX,
    y: tileY,
    tile,
    terrainTypeId: tile.terrainTypeId ?? tile.type ?? "unknown",
    elevation: tile.elevation ?? 0,
    renderElevation: getTileRenderElevation(tile),
    movementClass: tile.movementClass ?? "clear",
    structureCells: getStructureCellsAt(map, tileX, tileY),
    authoredEdges: getAuthoredEdgesAt(map, tileX, tileY),
    spawn: getSpawnAt(map, tileX, tileY),
    deploymentCell: getDeploymentCellAt(map, tileX, tileY),
    unit: getUnitAt(appState, tileX, tileY)
  };
}

export function getStructureCellsAt(map, x, y) {
  const key = makeCellKey(x, y);
  return getStructuresAtTile(map, x, y).flatMap((structure) => {
    const id = structure?.id ?? "structure";
    return getStructureCells(structure)
      .filter((cell) => makeCellKey(cell.x, cell.y) === key)
      .map((cell) => ({ ...cell, structureId: id }));
  });
}

export function getAuthoredEdgesAt(map, x, y) {
  return getMapStructures(map).flatMap((structure) => {
    const id = structure?.id ?? "structure";
    return getStructureEdgeParts(structure)
      .filter((edge) => Number(edge.x) === Number(x) && Number(edge.y) === Number(y))
      .map((edge) => ({ ...edge, structureId: id }));
  });
}

export function getStructureCellTruth(map) {
  return getMapStructures(map).flatMap((structure) => {
    const id = structure?.id ?? "structure";
    return getStructureCells(structure).map((cell) => ({ ...cell, structureId: id }));
  });
}

export function getStructureEdgeTruth(map) {
  return getMapStructures(map).flatMap((structure) => {
    const id = structure?.id ?? "structure";
    return getStructureEdgeParts(structure).map((edge) => ({ ...edge, structureId: id }));
  });
}

export function getSpawnAt(map, x, y) {
  const spawns = map?.spawns && typeof map.spawns === "object" ? map.spawns : {};
  for (const [team, points] of Object.entries(spawns)) {
    if (!Array.isArray(points)) continue;
    const index = points.findIndex((point) => Number(point?.x) === Number(x) && Number(point?.y) === Number(y));
    if (index >= 0) {
      return {
        id: `${team}_${index + 1}`,
        team,
        index,
        x: Number(x),
        y: Number(y)
      };
    }
  }

  const tile = getTile(map, x, y);
  if (tile?.spawnId) {
    return {
      id: tile.spawnId,
      team: tile.spawnTeam ?? "tile",
      index: 0,
      x: Number(x),
      y: Number(y)
    };
  }

  return null;
}

export function getSpawnTruth(map) {
  const spawns = map?.spawns && typeof map.spawns === "object" ? map.spawns : {};
  const results = [];

  for (const [team, points] of Object.entries(spawns)) {
    if (!Array.isArray(points)) continue;
    points.forEach((point, index) => {
      if (point?.x == null || point?.y == null) return;
      results.push({
        id: `${team}_${index + 1}`,
        team,
        index,
        x: Number(point.x),
        y: Number(point.y),
        source: "map.spawns"
      });
    });
  }

  return results;
}

export function getDeploymentCellAt(map, x, y) {
  const cells = getDeploymentCellTruth(map);
  return cells.find((cell) => Number(cell?.x) === Number(x) && Number(cell?.y) === Number(y)) ?? null;
}

export function getDeploymentCellTruth(map) {
  const cells = Array.isArray(map?.startState?.deploymentCells) ? map.startState.deploymentCells : [];
  return cells.map((cell, index) => ({
    ...cell,
    id: cell.id ?? `deployment_${index + 1}`,
    index,
    x: Number(cell.x),
    y: Number(cell.y)
  }));
}

export function getUnitAt(appState, x, y) {
  return getRuntimeUnits(appState)
    .find((unit) => Number(unit?.x) === Number(x) && Number(unit?.y) === Number(y)) ?? null;
}

export function formatStructureCells(cells) {
  return cells.map((cell) => {
    const room = cell.roomId ? ` / room ${cell.roomId}` : "";
    return `${cell.structureId}${room}`;
  }).join("; ");
}

export function formatEdges(edges) {
  return edges.map((edge) => `${edge.edge}:${edge.edgeHeight ?? 0} ${edge.type ?? "wall"}`).join("; ");
}

export function formatDeploymentCell(cell) {
  const unitType = cell?.unitType ?? "pilot";
  const controlType = cell?.controlType ?? "PC";
  return `${unitType} / ${controlType}`;
}
