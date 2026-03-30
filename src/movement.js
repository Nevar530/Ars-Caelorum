import { MAP_CONFIG } from "./config.js";
import { getTile } from "./map.js";
import { getMechById, getMechAt } from "./mechs.js";

export function clampFocusToBoard(x, y) {
  return {
    x: Math.max(0, Math.min(MAP_CONFIG.mechWidth - 1, x)),
    y: Math.max(0, Math.min(MAP_CONFIG.mechHeight - 1, y))
  };
}

export function coordKey(x, y) {
  return `${x},${y}`;
}

export function parseCoordKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function isWithinBoard(x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < MAP_CONFIG.mechWidth &&
    y < MAP_CONFIG.mechHeight
  );
}

export function getNeighbors(x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ].filter((pos) => isWithinBoard(pos.x, pos.y));
}

export function isTileBlocked(state, x, y, activeMech = null) {
  const tile = getTile(state.map, x, y);
  if (!tile) return true;

  const occupant = getMechAt(state.mechs, x, y);
  if (!occupant) return false;

  if (activeMech && occupant.instanceId === activeMech.instanceId) {
    return false;
  }

  return true;
}

export function canStepToTile(state, fromX, fromY, toX, toY) {
  const fromTile = getTile(state.map, fromX, fromY);
  const toTile = getTile(state.map, toX, toY);

  if (!fromTile || !toTile) return false;

  const elevationRise = toTile.elevation - fromTile.elevation;

  // Can climb up at most 1 elevation step per move step.
  // Going down any amount is allowed for now.
  if (elevationRise > 1) return false;

  return true;
}

export function getTileMoveCost(state, fromX, fromY, toX, toY) {
  const fromTile = getTile(state.map, fromX, fromY);
  const toTile = getTile(state.map, toX, toY);

  if (!fromTile || !toTile) return Infinity;

  const heightDiff = toTile.elevation - fromTile.elevation;

  // Can't climb more than 1
  if (heightDiff > 1) return Infinity;

  // Movement cost = base 1 + elevation change
  return 1 + Math.abs(heightDiff);
}

export function getReachableTileMap(state) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  if (!activeMech) return new Map();

  const maxMove = activeMech.move;
  const startKey = coordKey(activeMech.x, activeMech.y);

  const costs = new Map();
  const queue = [{ x: activeMech.x, y: activeMech.y }];

  costs.set(startKey, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = coordKey(current.x, current.y);
    const currentCost = costs.get(currentKey);

    for (const next of getNeighbors(current.x, current.y)) {
      if (isTileBlocked(state, next.x, next.y, activeMech)) continue;

      const stepCost = getTileMoveCost(
        state,
        current.x,
        current.y,
        next.x,
        next.y
      );

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
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  if (!activeMech) return [];

  const targetKey = coordKey(targetX, targetY);
  const reachable = getReachableTileMap(state);

  if (!reachable.has(targetKey)) return [];

  const startKey = coordKey(activeMech.x, activeMech.y);
  const cameFrom = new Map();
  const costSoFar = new Map();
  const queue = [{ x: activeMech.x, y: activeMech.y }];

  cameFrom.set(startKey, null);
  costSoFar.set(startKey, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = coordKey(current.x, current.y);

    if (current.x === targetX && current.y === targetY) {
      break;
    }

    for (const next of getNeighbors(current.x, current.y)) {
      if (isTileBlocked(state, next.x, next.y, activeMech)) continue;

      const stepCost = getTileMoveCost(
        state,
        current.x,
        current.y,
        next.x,
        next.y
      );

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
