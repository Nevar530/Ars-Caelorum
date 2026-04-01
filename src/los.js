import { MAP_CONFIG } from "./config.js";
import { getTile } from "./map.js";

export function isTileOnBoard(x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < MAP_CONFIG.mechWidth &&
    y < MAP_CONFIG.mechHeight
  );
}

export function getLineTiles(x0, y0, x1, y1) {
  const tiles = [];

  let x = x0;
  let y = y0;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    tiles.push({ x, y });

    if (x === x1 && y === y1) {
      break;
    }

    const e2 = err * 2;

    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }

    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return tiles;
}

export function hasLineOfSight(state, fromX, fromY, toX, toY) {
  if (!isTileOnBoard(fromX, fromY) || !isTileOnBoard(toX, toY)) {
    return false;
  }

  const line = getLineTiles(fromX, fromY, toX, toY);

  if (line.length <= 1) return true;

  // Skip origin tile. Walk toward target.
  // First raised / LOS-blocking tile is visible itself,
  // but blocks anything beyond it.
  let firstBlockerIndex = -1;

  for (let i = 1; i < line.length; i++) {
    const step = line[i];
    const tile = getTile(state.map, step.x, step.y);

    if (!tile) return false;

    const blocks =
      tile.blocksLOS === true ||
      tile.elevation > 0;

    if (blocks) {
      firstBlockerIndex = i;
      break;
    }
  }

  // No blocker found, target is visible.
  if (firstBlockerIndex === -1) {
    return true;
  }

  const blocker = line[firstBlockerIndex];

  // You may target the blocking hill/wall tile itself,
  // but nothing beyond it.
  return blocker.x === toX && blocker.y === toY;
}

export function filterTilesByLineOfSight(state, origin, tiles) {
  return tiles.filter((tile) =>
    hasLineOfSight(state, origin.x, origin.y, tile.x, tile.y)
  );
}
