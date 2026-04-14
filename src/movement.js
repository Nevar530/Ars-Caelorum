// src/movement.js

import { MAP_CONFIG } from "./config.js";
import {
  getTile,
  getTileFootElevation,
  isTileMechEnterable
} from "./map.js";
import { getUnitById } from "./mechs.js";
import { canUnitOccupyCells } from "./scale/occupancy.js";
import {
  getResolutionBoardSize,
  getUnitFootprintBounds,
  getUnitOccupiedCells,
  getUnitCenterPoint
} from "./scale/scaleMath.js";

const CARDINAL_STEPS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 }
];

function getActiveUnit(state) {
  const activeId = state.turn?.activeUnitId ?? state.turn?.activeMechId ?? null;
  const units = state.units ?? state.mechs ?? [];
  return getUnitById(units, activeId);
}

function makePreviewUnit(unit, x, y) {
  return {
    ...unit,
    x,
    y
  };
}

function getUnitAnchorTile(unit) {
  return getTile(unit._movementMapRef, unit.x, unit.y);
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

function areOccupiedCellsStandable(state, unit) {
  const occupiedCells = getUnitOccupiedCells(unit);

  for (const cell of occupiedCells) {
    const tile = getTile(state.map, cell.x, cell.y);
    if (!tile) return false;
    if (!isTileMechEnterable(tile)) return false;
  }

  return true;
}

function canUnitOccupyAnchor(state, unit, x, y) {
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

function getAnchorElevation(state, x, y) {
  const tile = getTile(state.map, x, y);
  if (!tile) return null;
  return getTileFootElevation(tile);
}

function canTraverseBetweenAnchors(state, unit, fromX, fromY, toX, toY) {
  const fromElevation = getAnchorElevation(state, fromX, fromY);
  const toElevation = getAnchorElevation(state, toX, toY);

  if (fromElevation === null || toElevation === null) {
    return false;
  }

  // Keep the climb rule simple and stable for now.
  // Destination footprint validity is the important truth pass.
  if (Math.abs(toElevation - fromElevation) > 1) {
    return false;
  }

  return canUnitOccupyAnchor(state, unit, toX, toY);
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

export function getNeighbors(x, y, _scale = "base") {
  return CARDINAL_STEPS
    .map((step) => ({ x: x + step.dx, y: y + step.dy }))
    .filter((pos) => isWithinBoard(pos.x, pos.y, "base"));
}

export function isTileBlocked(state, x, y, activeUnit = null, _resolution = "base") {
  if (!activeUnit) {
    const tile = getTile(state.map, x, y);
    if (!tile) return true;
    if (!isTileMechEnterable(tile)) return true;
    return false;
  }

  return !canUnitOccupyAnchor(state, activeUnit, x, y);
}

export function canStepToTile(state, fromX, fromY, toX, toY, _resolution = "base") {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return false;

  return canTraverseBetweenAnchors(state, activeUnit, fromX, fromY, toX, toY);
}

export function getTileMoveCost(state, fromX, fromY, toX, toY, _resolution = "base") {
  const fromElevation = getAnchorElevation(state, fromX, fromY);
  const toElevation = getAnchorElevation(state, toX, toY);

  if (fromElevation === null || toElevation === null) {
    return Infinity;
  }

  if (Math.abs(toElevation - fromElevation) > 1) {
    return Infinity;
  }

  return 1 + Math.abs(toElevation - fromElevation);
}

export function getReachableTileMap(state) {
  const activeUnit = getActiveUnit(state);
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

    for (const next of getNeighbors(current.x, current.y, "base")) {
      if (!canTraverseBetweenAnchors(state, activeUnit, current.x, current.y, next.x, next.y)) {
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

  // Attach path data directly to the reachable map entries for stability.
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
      centerPoint: getUnitCenterPoint(previewUnit)
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
  const activeUnit = getActiveUnit(state);
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
