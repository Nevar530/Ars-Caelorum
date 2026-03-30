import { MAP_CONFIG } from "./config.js";
import { getTile } from "./map.js";
import { getMechById, getMechAt } from "./mechs.js";

export function clampFocusToBoard(x, y) {
  return {
    x: Math.max(0, Math.min(MAP_CONFIG.mechWidth - 1, x)),
    y: Math.max(0, Math.min(MAP_CONFIG.mechHeight - 1, y))
  };
}

export function getManhattanDistance(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function canMoveActiveMechTo(state, x, y) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  if (!activeMech) return false;

  const tile = getTile(state.map, x, y);
  if (!tile) return false;

  const occupant = getMechAt(state.mechs, x, y);
  if (occupant && occupant.instanceId !== activeMech.instanceId) {
    return false;
  }

  const distance = getManhattanDistance(activeMech.x, activeMech.y, x, y);
  if (distance > activeMech.move) {
    return false;
  }

  return true;
}

export function getReachableTiles(state) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  if (!activeMech) return [];

  const reachable = [];

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      if (canMoveActiveMechTo(state, x, y)) {
        reachable.push({ x, y });
      }
    }
  }

  return reachable;
}
