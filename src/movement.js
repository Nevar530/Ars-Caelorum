// src/movement.js

import { MAP_CONFIG } from "./config.js";
import {
  getTile,
  getTileFootElevation,
  isTileMechEnterable
} from "./map.js";
import { getUnitById } from "./mechs.js";
import { isPositionBlocked } from "./scale/occupancy.js";
import {
  normalizeScale,
  getResolutionBoardSize,
  getParentMechTileForPosition
} from "./scale/scaleMath.js";

function getActiveUnit(state) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const units = state.units ?? state.mechs ?? [];
  return getUnitById(units, activeId);
}

export function clampFocusToBoard(x, y, scale = "mech") {
  const board = getResolutionBoardSize(scale, MAP_CONFIG);

  return {
    x: Math.max(0, Math.min(board.width - 1, x)),
    y: Math.max(0, Math.min(board.height - 1, y))
  };
}

export function coordKey(x, y) {
  return `${x},${y}`;
}

export function parseCoordKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function isWithinBoard(x, y, scale = "mech") {
  const board = getResolutionBoardSize(scale, MAP_CONFIG);
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function getNeighbors(x, y, scale = "mech") {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ].filter((pos) => isWithinBoard(pos.x, pos.y, scale));
}

function getParentTileForScalePosition(x, y, scale = "mech") {
  return getParentMechTileForPosition(x, y, scale);
}

export function isTileBlocked(state, x, y, activeUnit = null, resolution = "mech") {
  const scale = normalizeScale(resolution);
  const parentTile = getParentTileForScalePosition(x, y, scale);
  const tile = getTile(state.map, parentTile.x, parentTile.y);

  if (!tile) return true;
  if (!isTileMechEnterable(tile)) return true;

  return isPositionBlocked(state, x, y, scale, {
    ignoreUnitId: activeUnit?.instanceId ?? null
  });
}

export function canStepToTile(state, fromX, fromY, toX, toY, resolution = "mech") {
  const scale = normalizeScale(resolution);

  const fromParent = getParentTileForScalePosition(fromX, fromY, scale);
  const toParent = getParentTileForScalePosition(toX, toY, scale);

  const fromTile = getTile(state.map, fromParent.x, fromParent.y);
  const toTile = getTile(state.map, toParent.x, toParent.y);

  if (!fromTile || !toTile) return false;
  if (!isTileMechEnterable(fromTile) || !isTileMechEnterable(toTile)) return false;

  const elevationRise = getTileFootElevation(toTile) - getTileFootElevation(fromTile);
  if (elevationRise > 1) return false;

  return true;
}

export function getTileMoveCost(state, fromX, fromY, toX, toY, resolution = "mech") {
  const scale = normalizeScale(resolution);

  const fromParent = getParentTileForScalePosition(fromX, fromY, scale);
  const toParent = getParentTileForScalePosition(toX, toY, scale);

  const fromTile = getTile(state.map, fromParent.x, fromParent.y);
  const toTile = getTile(state.map, toParent.x, toParent.y);

  if (!fromTile || !toTile) return Infinity;
  if (!isTileMechEnterable(fromTile) || !isTileMechEnterable(toTile)) return Infinity;

  const heightDiff = getTileFootElevation(toTile) - getTileFootElevation(fromTile);
  if (heightDiff > 1) return Infinity;

  return 1 + Math.abs(heightDiff);
}

export function getReachableTileMap(state) {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return new Map();

  const scale = normalizeScale(activeUnit.scale ?? "mech");
  const maxMove = activeUnit.move;
  const startKey = coordKey(activeUnit.x, activeUnit.y);

  const costs = new Map();
  const queue = [{ x: activeUnit.x, y: activeUnit.y }];

  costs.set(startKey, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = coordKey(current.x, current.y);
    const currentCost = costs.get(currentKey);

    for (const next of getNeighbors(current.x, current.y, scale)) {
      if (!canStepToTile(state, current.x, current.y, next.x, next.y, scale)) continue;
      if (isTileBlocked(state, next.x, next.y, activeUnit, scale)) continue;

      const stepCost = getTileMoveCost(state, current.x, current.y, next.x, next.y, scale);
      if (!Number.isFinite(stepCost)) continue;

      const newCost = currentCost + stepCost;
      if (newCost > maxMove) continue;

      const nextKey = coordKey(next.x, next.y);
      const existingCost = costs.get(nextKey);

      if (existingCost === undefined || newCost < existingCost) {
        costs.set(nextKey, newCost);
        queue.push(next);
      }
    }
  }

  return costs;
}

export function getReachableTiles(state) {
  return Array.from(getReachableTileMap(state).entries()).map(([key, cost]) => {
    const pos = parseCoordKey(key);
    return {
      x: pos.x,
      y: pos.y,
      cost
    };
  });
}

export function canMoveActiveMechTo(state, x, y) {
  const reachable = getReachableTileMap(state);
  return reachable.has(coordKey(x, y));
}

export function getPathToTile(state, targetX, targetY) {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return [];

  const scale = normalizeScale(activeUnit.scale ?? "mech");
  const targetKey = coordKey(targetX, targetY);
  const reachable = getReachableTileMap(state);

  if (!reachable.has(targetKey)) return [];

  const startKey = coordKey(activeUnit.x, activeUnit.y);
  const cameFrom = new Map();
  const costSoFar = new Map();
  const queue = [{ x: activeUnit.x, y: activeUnit.y }];

  cameFrom.set(startKey, null);
  costSoFar.set(startKey, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = coordKey(current.x, current.y);

    if (current.x === targetX && current.y === targetY) {
      break;
    }

    for (const next of getNeighbors(current.x, current.y, scale)) {
      if (!canStepToTile(state, current.x, current.y, next.x, next.y, scale)) continue;
      if (isTileBlocked(state, next.x, next.y, activeUnit, scale)) continue;

      const stepCost = getTileMoveCost(state, current.x, current.y, next.x, next.y, scale);
      if (!Number.isFinite(stepCost)) continue;

      const newCost = costSoFar.get(currentKey) + stepCost;
      const nextKey = coordKey(next.x, next.y);

      if (!reachable.has(nextKey)) continue;

      const existingCost = costSoFar.get(nextKey);
      if (existingCost === undefined || newCost < existingCost) {
        costSoFar.set(nextKey, newCost);
        cameFrom.set(nextKey, currentKey);
        queue.push(next);
      }
    }
  }

  if (!cameFrom.has(targetKey)) return [];

  const path = [];
  let currentKey = targetKey;

  while (currentKey !== null) {
    const pos = parseCoordKey(currentKey);
    path.push(pos);
    currentKey = cameFrom.get(currentKey) ?? null;
  }

  path.reverse();
  return path;
}
