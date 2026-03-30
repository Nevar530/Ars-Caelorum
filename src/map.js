import { MAP_CONFIG } from "./config.js";
import { clamp } from "./utils.js";

export function createInitialMap() {
  const map = [];

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    const row = [];

    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      let elevation = 0;

      if (x >= 3 && x <= 6 && y >= 3 && y <= 5) elevation = 1;
      if (x >= 4 && x <= 5 && y === 4) elevation = 2;
      if (x >= 8 && x <= 10 && y >= 2 && y <= 4) elevation = 1;
      if (x === 9 && y === 3) elevation = 2;
      if (x >= 1 && x <= 2 && y >= 8 && y <= 10) elevation = 1;

      row.push({
        x,
        y,
        elevation
      });
    }

    map.push(row);
  }

  return map;
}

export function resetMap() {
  return createInitialMap();
}

export function getTile(map, x, y) {
  if (y < 0 || y >= MAP_CONFIG.mechHeight || x < 0 || x >= MAP_CONFIG.mechWidth) {
    return null;
  }

  return map[y][x];
}

export function changeElevation(map, x, y, delta) {
  const tile = getTile(map, x, y);
  if (!tile) return;

  tile.elevation = clamp(
    tile.elevation + delta,
    MAP_CONFIG.minElevation,
    MAP_CONFIG.maxElevation
  );
}

export function tileTypeFromElevation(elevation) {
  if (elevation >= 3) return "peak";
  if (elevation >= 1) return "high";
  return "ground";
}

export function rotateCoord(x, y, width, height, rotation) {
  switch (rotation % 4) {
    case 0:
      return { x, y };
    case 1:
      return { x: height - 1 - y, y: x };
    case 2:
      return { x: width - 1 - x, y: height - 1 - y };
    case 3:
      return { x: y, y: width - 1 - x };
    default:
      return { x, y };
  }
}
