// src/targeting/fireArc.js

export const DEFAULT_FIRE_ARC_RANGE = 20;

export function getFireArcTiles(mech, range = DEFAULT_FIRE_ARC_RANGE) {
  const results = [];
  const facing = mech.facing;

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      if (dx === 0 && dy === 0) continue;

      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > range) continue;

      if (isInForwardFan(dx, dy, facing)) {
        results.push({ x: mech.x + dx, y: mech.y + dy });
      }
    }
  }

  return uniqueBoardTiles(results);
}

export function isInForwardFan(dx, dy, facing) {
  switch (facing) {
    case 0:
      return dy < 0 && Math.abs(dx) <= Math.abs(dy);
    case 1:
      return dx > 0 && Math.abs(dy) <= Math.abs(dx);
    case 2:
      return dy > 0 && Math.abs(dx) <= Math.abs(dy);
    case 3:
      return dx < 0 && Math.abs(dy) <= Math.abs(dx);
    default:
      return false;
  }
}

export function getCardinalAdjacentTilesForFacing(x, y, facing) {
  switch (facing) {
    case 0:
      return uniqueBoardTiles([
        { x, y: y - 1 },
        { x: x - 1, y },
        { x: x + 1, y }
      ]);
    case 1:
      return uniqueBoardTiles([
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ]);
    case 2:
      return uniqueBoardTiles([
        { x, y: y + 1 },
        { x: x - 1, y },
        { x: x + 1, y }
      ]);
    case 3:
      return uniqueBoardTiles([
        { x: x - 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ]);
    default:
      return uniqueBoardTiles([
        { x, y: y - 1 },
        { x: x - 1, y },
        { x: x + 1, y }
      ]);
  }
}

export function uniqueBoardTiles(tiles) {
  const seen = new Set();
  const results = [];

  for (const tile of tiles) {
    if (tile.x < 0 || tile.y < 0) continue;
    const key = tileKey(tile.x, tile.y);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(tile);
  }

  return results;
}

export function toTileKeySet(tiles) {
  const set = new Set();
  for (const tile of tiles) {
    set.add(tileKey(tile.x, tile.y));
  }
  return set;
}

export function tileKey(x, y) {
  return `${x},${y}`;
}
