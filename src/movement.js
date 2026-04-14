// src/movement.js

import { getTile, getTileRenderElevation } from "./map.js";
import { canUnitOccupyCells } from "./scale/occupancy.js";
import { getUnitById } from "./mechs.js";
import {
  getUnitFootprint,
  getUnitFootprintBounds,
  getUnitOccupiedCells,
  getUnitCenterPoint
} from "./scale/scaleMath.js";

const CARDINAL_STEPS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 }
];

export function getReachableTiles(state) {
  const unit = getActiveUnit(state);
  if (!unit) return [];

  const maxMove = Math.max(0, Number(unit.move ?? 0));
  const startKey = makeKey(unit.x, unit.y);

  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  const visited = new Map();
  const previous = new Map();

  visited.set(startKey, 0);

  while (queue.length > 0) {
    const current = queue.shift();

    for (const step of CARDINAL_STEPS) {
      const nx = current.x + step.dx;
      const ny = current.y + step.dy;
      const nextCost = current.cost + 1;
      const nextKey = makeKey(nx, ny);

      if (nextCost > maxMove) continue;
      if (visited.has(nextKey) && visited.get(nextKey) <= nextCost) continue;
      if (!canUnitAnchorOccupy(state, unit, nx, ny)) continue;
      if (!canTraverseBetweenAnchors(state, unit, current.x, current.y, nx, ny)) continue;

      visited.set(nextKey, nextCost);
      previous.set(nextKey, makeKey(current.x, current.y));
      queue.push({ x: nx, y: ny, cost: nextCost });
    }
  }

  const results = [];

  for (const [key, cost] of visited.entries()) {
    const [x, y] = parseKey(key);
    const previewUnit = { ...unit, x, y };

    results.push({
      x,
      y,
      cost,
      unitId: unit.instanceId,
      footprintWidth: previewUnit.footprintWidth,
      footprintHeight: previewUnit.footprintHeight,
      occupiedCells: getUnitOccupiedCells(previewUnit),
      footprintBounds: getUnitFootprintBounds(previewUnit),
      centerPoint: getUnitCenterPoint(previewUnit),
      path: buildPathFromPrevious(previous, startKey, key)
    });
  }

  return results;
}

export function getReachableTileMap(state) {
  const map = new Map();

  for (const tile of getReachableTiles(state)) {
    map.set(makeKey(tile.x, tile.y), tile);
  }

  return map;
}

export function isTileReachable(state, x, y) {
  return getReachableTileMap(state).has(makeKey(x, y));
}

export function getPreviewPath(state, x, y) {
  const reachable = getReachableTileMap(state).get(makeKey(x, y));
  return reachable?.path ?? [];
}

export function canUnitAnchorOccupy(state, unit, x, y) {
  const testUnit = {
    ...unit,
    x,
    y
  };

  return canUnitOccupyCells(state, testUnit, {
    ignoreUnitId: unit.instanceId
  });
}

export function canTraverseBetweenAnchors(state, unit, fromX, fromY, toX, toY) {
  const fromTile = getTile(state.map, fromX, fromY);
  const toTile = getTile(state.map, toX, toY);

  if (!toTile) return false;
  if (!fromTile) return true;

  const fromElevation = getTileRenderElevation(fromTile);
  const toElevation = getTileRenderElevation(toTile);

  // Keep it simple for now:
  // one anchor step can climb / descend 1 terrain level.
  return Math.abs(toElevation - fromElevation) <= 1;
}

export function moveActiveUnitTo(state, x, y) {
  const unit = getActiveUnit(state);
  if (!unit) return false;

  if (!isTileReachable(state, x, y)) {
    return false;
  }

  unit.x = x;
  unit.y = y;
  unit.hasMoved = true;

  state.focus = {
    x,
    y,
    scale: unit.scale ?? unit.unitType ?? "pilot"
  };

  return true;
}

export function getUnitMovementFootprint(state, unit, x, y) {
  const testUnit = {
    ...unit,
    x,
    y
  };

  return {
    occupiedCells: getUnitOccupiedCells(testUnit),
    footprintBounds: getUnitFootprintBounds(testUnit),
    centerPoint: getUnitCenterPoint(testUnit)
  };
}

function getActiveUnit(state) {
  const activeUnitId = state.turn?.activeUnitId ?? state.turn?.activeMechId ?? null;

  return getUnitById(state.units ?? state.mechs ?? [], activeUnitId);
}

function buildPathFromPrevious(previous, startKey, endKey) {
  const path = [];
  let current = endKey;

  while (current) {
    const [x, y] = parseKey(current);
    path.unshift({ x, y });

    if (current === startKey) {
      break;
    }

    current = previous.get(current) ?? null;
  }

  return path;
}

function makeKey(x, y) {
  return `${x},${y}`;
}

function parseKey(key) {
  const [x, y] = key.split(",").map(Number);
  return [x, y];
}
