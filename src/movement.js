// src/movement.js

import { MAP_CONFIG } from "./config.js";
import {
  getTile,
  getTileFootElevation,
  isTileMechEnterable
} from "./map.js";
import { getUnitById } from "./mechs.js";
import { getActiveBody } from "./actors/actorResolver.js";
import { canUnitOccupyCells } from "./scale/occupancy.js";
import {
  getResolutionBoardSize,
  getUnitFootprint,
  getUnitFootprintBounds,
  getUnitOccupiedCells,
  getUnitCenterPoint
} from "./scale/scaleMath.js";

const CARDINAL_DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 }
];

function getMovementBody(state) {
  const activeBody = getActiveBody(state);
  if (activeBody) return activeBody;

  const activeId = state.turn?.activeUnitId ?? null;
  const units = state.units ?? [];
  return getUnitById(units, activeId);
}

function makePreviewUnit(unit, x, y) {
  return {
    ...unit,
    x,
    y
  };
}

function getUnitStride(unit) {
  const footprint = getUnitFootprint(unit);

  if ((unit?.unitType ?? "mech") === "mech") {
    return {
      x: 1,
      y: 1,
      footprintWidth: footprint.width,
      footprintHeight: footprint.height
    };
  }

  return { x: 1, y: 1 };
}

function isFootprintInsideBoard(unit) {
  const board = getResolutionBoardSize("base", MAP_CONFIG);
  const bounds = getUnitFootprintBounds(unit);

  return (
    bounds.minX >= 0 &&
    bounds.minY >= 0 &&
    bounds.maxX < board.width &&
    bounds.maxY < board.height
  );
}

function getSupportElevationForUnit(state, unit) {
  const occupiedCells = getUnitOccupiedCells(unit);
  let maxElevation = null;

  for (const cell of occupiedCells) {
    const tile = getTile(state.map, cell.x, cell.y);
    if (!tile) return null;

    const elevation = getTileFootElevation(tile);
    if (maxElevation === null || elevation > maxElevation) {
      maxElevation = elevation;
    }
  }

  return maxElevation;
}

function isTileMovementBlocked(tile) {
  if (!tile) return true;
  if (!isTileMechEnterable(tile)) return true;
  return String(tile.movementClass ?? "clear") === "impassable";
}

function getTileTerrainPenalty(tile) {
  const movementClass = String(tile?.movementClass ?? "clear");

  switch (movementClass) {
    case "difficult":
    case "hazard":
      return 1;
    case "impassable":
      return Infinity;
    default:
      return 0;
  }
}

function getUnitTerrainPenalty(state, unit) {
  const occupiedCells = getUnitOccupiedCells(unit);
  let highestPenalty = 0;

  for (const cell of occupiedCells) {
    const tile = getTile(state.map, cell.x, cell.y);
    const penalty = getTileTerrainPenalty(tile);

    if (!Number.isFinite(penalty)) {
      return Infinity;
    }

    if (penalty > highestPenalty) {
      highestPenalty = penalty;
    }
  }

  return highestPenalty;
}

function areOccupiedCellsStandable(state, unit) {
  const occupiedCells = getUnitOccupiedCells(unit);

  for (const cell of occupiedCells) {
    const tile = getTile(state.map, cell.x, cell.y);
    if (isTileMovementBlocked(tile)) return false;
  }

  return true;
}

function canUnitOccupyOrigin(state, unit, x, y) {
  const previewUnit = makePreviewUnit(unit, x, y);

  if (!isFootprintInsideBoard(previewUnit)) {
    return false;
  }

  if (!areOccupiedCellsStandable(state, previewUnit)) {
    return false;
  }

  return canUnitOccupyCells(state, previewUnit, {
    ignoreUnitId: unit.instanceId
  });
}

function canTraverseBetweenOrigins(state, unit, fromX, fromY, toX, toY) {
  const fromUnit = makePreviewUnit(unit, fromX, fromY);
  const toUnit = makePreviewUnit(unit, toX, toY);

  const fromElevation = getSupportElevationForUnit(state, fromUnit);
  const toElevation = getSupportElevationForUnit(state, toUnit);

  if (fromElevation === null || toElevation === null) {
    return false;
  }

  if (Math.abs(toElevation - fromElevation) > 1) {
    return false;
  }

  return canUnitOccupyOrigin(state, unit, toX, toY);
}

function buildPath(previous, startKey, endKey) {
  const path = [];
  let current = endKey;

  while (current) {
    const pos = parseCoordKey(current);
    path.unshift(pos);

    if (current === startKey) {
      break;
    }

    current = previous.get(current) ?? null;
  }

  return path;
}

export function clampFocusToBoard(x, y, scale = "base") {
  const board = getResolutionBoardSize(scale, MAP_CONFIG);

  return {
    x: Math.max(0, Math.min(board.width - 1, Number(x ?? 0))),
    y: Math.max(0, Math.min(board.height - 1, Number(y ?? 0)))
  };
}

export function coordKey(x, y) {
  return `${Number(x)},${Number(y)}`;
}

export function parseCoordKey(key) {
  const [x, y] = String(key).split(",").map(Number);
  return { x, y };
}

export function isWithinBoard(x, y, scale = "base") {
  const board = getResolutionBoardSize(scale, MAP_CONFIG);

  return (
    x >= 0 &&
    y >= 0 &&
    x < board.width &&
    y < board.height
  );
}

export function getNeighbors(x, y, unitOrScale = "base") {
  if (typeof unitOrScale === "string") {
    return CARDINAL_DIRECTIONS
      .map((step) => ({ x: x + step.dx, y: y + step.dy }))
      .filter((pos) => isWithinBoard(pos.x, pos.y, "base"));
  }

  const stride = getUnitStride(unitOrScale);

  return CARDINAL_DIRECTIONS
    .map((step) => ({
      x: x + (step.dx * stride.x),
      y: y + (step.dy * stride.y)
    }))
    .filter((pos) => isWithinBoard(pos.x, pos.y, "base"));
}

export function isTileBlocked(state, x, y, activeUnit = null, _resolution = "base") {
  if (!activeUnit) {
    const tile = getTile(state.map, x, y);
    if (!tile) return true;
    if (!isTileMechEnterable(tile)) return true;
    return false;
  }

  return !canUnitOccupyOrigin(state, activeUnit, x, y);
}

export function canStepToTile(state, fromX, fromY, toX, toY, _resolution = "base") {
  const activeUnit = getMovementBody(state);
  if (!activeUnit) return false;

  return canTraverseBetweenOrigins(state, activeUnit, fromX, fromY, toX, toY);
}

export function getTileMoveCost(state, fromX, fromY, toX, toY, _resolution = "base") {
  const activeUnit = getMovementBody(state);
  if (!activeUnit) return Infinity;

  const fromUnit = makePreviewUnit(activeUnit, fromX, fromY);
  const toUnit = makePreviewUnit(activeUnit, toX, toY);

  const fromElevation = getSupportElevationForUnit(state, fromUnit);
  const toElevation = getSupportElevationForUnit(state, toUnit);

  if (fromElevation === null || toElevation === null) {
    return Infinity;
  }

  if (Math.abs(toElevation - fromElevation) > 1) {
    return Infinity;
  }

  const terrainPenalty = getUnitTerrainPenalty(state, toUnit);
  if (!Number.isFinite(terrainPenalty)) {
    return Infinity;
  }

  return 1 + Math.abs(toElevation - fromElevation) + terrainPenalty;
}

export function getReachableTileMap(state) {
  const activeUnit = getMovementBody(state);
  if (!activeUnit) return new Map();

  const startKey = coordKey(activeUnit.x, activeUnit.y);
  const maxMove = Math.max(0, Number(activeUnit.move ?? 0));

  const costs = new Map();
  const previous = new Map();
  const queue = [{ x: activeUnit.x, y: activeUnit.y }];

  costs.set(startKey, 0);
  previous.set(startKey, null);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = coordKey(current.x, current.y);
    const currentCost = costs.get(currentKey) ?? 0;

    for (const next of getNeighbors(current.x, current.y, activeUnit)) {
      if (!canTraverseBetweenOrigins(state, activeUnit, current.x, current.y, next.x, next.y)) {
        continue;
      }

      const stepCost = getTileMoveCost(state, current.x, current.y, next.x, next.y, "base");
      if (!Number.isFinite(stepCost)) continue;

      const nextCost = currentCost + stepCost;
      if (nextCost > maxMove) continue;

      const nextKey = coordKey(next.x, next.y);
      const existing = costs.get(nextKey);

      if (existing === undefined || nextCost < existing) {
        costs.set(nextKey, nextCost);
        previous.set(nextKey, currentKey);
        queue.push(next);
      }
    }
  }

  const result = new Map();

  for (const [key, cost] of costs.entries()) {
    const pos = parseCoordKey(key);
    const previewUnit = makePreviewUnit(activeUnit, pos.x, pos.y);

    result.set(key, {
      x: pos.x,
      y: pos.y,
      cost,
      path: buildPath(previous, startKey, key),
      occupiedCells: getUnitOccupiedCells(previewUnit),
      footprintBounds: getUnitFootprintBounds(previewUnit),
      centerPoint: getUnitCenterPoint(previewUnit),
      supportElevation: getSupportElevationForUnit(state, previewUnit)
    });
  }

  return result;
}

export function getReachableTiles(state) {
  return Array.from(getReachableTileMap(state).values());
}

export function canMoveActiveMechTo(state, x, y) {
  return getReachableTileMap(state).has(coordKey(x, y));
}

export function canMoveActiveUnitTo(state, x, y) {
  return canMoveActiveMechTo(state, x, y);
}

export function getPathToTile(state, targetX, targetY) {
  const reachable = getReachableTileMap(state).get(coordKey(targetX, targetY));
  return reachable?.path ?? [];
}

export function moveActiveUnitTo(state, x, y) {
  const activeUnit = getMovementBody(state);
  if (!activeUnit) return false;

  const reachable = getReachableTileMap(state).get(coordKey(x, y));
  if (!reachable) return false;

  activeUnit.x = Number(x);
  activeUnit.y = Number(y);
  activeUnit.hasMoved = true;

  state.focus = {
    x: activeUnit.x,
    y: activeUnit.y,
    scale: activeUnit.scale ?? activeUnit.unitType ?? "base"
  };

  return true;
}

export function moveActiveMechTo(state, x, y) {
  return moveActiveUnitTo(state, x, y);
}
