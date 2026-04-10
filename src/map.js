import { GAME_CONFIG, MAP_CONFIG } from "./config.js";
import { clamp } from "./utils.js";

function createDetailGridForElevation(elevation) {
  const cells = [];
  const subdivisions = GAME_CONFIG.detailSubdivisionsPerMechTile;
  const fineElevation = elevation * GAME_CONFIG.detailElevationPerMechLevel;

  for (let sy = 0; sy < subdivisions; sy++) {
    const row = [];

    for (let sx = 0; sx < subdivisions; sx++) {
      row.push({
        sx,
        sy,
        elevation: fineElevation
      });
    }

    cells.push(row);
  }

  return {
    subdivisions,
    cells
  };
}

function createTile(x, y, elevation = 0) {
  return {
    x,
    y,
    elevation,
    detail: createDetailGridForElevation(elevation)
  };
}

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

      row.push(createTile(x, y, elevation));
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

export function getDetailGrid(tile) {
  return tile?.detail ?? null;
}

export function getDetailCell(map, mechX, mechY, subX, subY) {
  const tile = getTile(map, mechX, mechY);
  if (!tile?.detail?.cells) return null;

  const subdivisions = tile.detail.subdivisions ?? GAME_CONFIG.detailSubdivisionsPerMechTile;
  if (subX < 0 || subY < 0 || subX >= subdivisions || subY >= subdivisions) {
    return null;
  }

  return tile.detail.cells[subY]?.[subX] ?? null;
}

export function changeElevation(map, x, y, delta) {
  const tile = getTile(map, x, y);
  if (!tile) return;

  tile.elevation = clamp(
    tile.elevation + delta,
    MAP_CONFIG.minElevation,
    MAP_CONFIG.maxElevation
  );

  tile.detail = createDetailGridForElevation(tile.elevation);
}

export function changeDetailElevation(map, mechX, mechY, subX, subY, delta) {
  const detailCell = getDetailCell(map, mechX, mechY, subX, subY);
  if (!detailCell) return;

  const maxFineElevation = MAP_CONFIG.maxElevation * GAME_CONFIG.detailElevationPerMechLevel;

  detailCell.elevation = clamp(detailCell.elevation + delta, 0, maxFineElevation);
}

export function tileTypeFromElevation(elevation) {
  if (elevation >= 3) return "peak";
  if (elevation >= 1) return "high";
  return "ground";
}

export function detailTypeFromFineElevation(fineElevation) {
  const coarse = Math.floor(fineElevation / GAME_CONFIG.detailElevationPerMechLevel);
  return tileTypeFromElevation(coarse);
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
