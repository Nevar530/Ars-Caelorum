// src/scale/scaleMath.js

import { GAME_CONFIG, MAP_CONFIG } from "../config.js";

export const SCALE_CLASS = {
  PILOT: "pilot",
  MECH: "mech",
  STRUCTURE: "structure"
};

export const ANCHOR_TYPE = {
  CENTER: "center",
  FOOTPRINT_ORIGIN: "footprint_origin"
};

export function normalizeScale(scale) {
  if (scale === SCALE_CLASS.PILOT) return SCALE_CLASS.PILOT;
  if (scale === SCALE_CLASS.STRUCTURE) return SCALE_CLASS.STRUCTURE;
  return SCALE_CLASS.MECH;
}

export function normalizeAnchorType(anchorType) {
  if (anchorType === ANCHOR_TYPE.FOOTPRINT_ORIGIN) return ANCHOR_TYPE.FOOTPRINT_ORIGIN;
  return ANCHOR_TYPE.CENTER;
}

export function makePositionKey(x, y) {
  return `${Number(x)},${Number(y)}`;
}

export function makeScaleCellKey(_scale = "base", x = 0, y = 0) {
  return makePositionKey(x, y);
}

export function getResolutionBoardSize(_scale = "base", mapConfig = MAP_CONFIG) {
  return {
    width: Number(mapConfig?.width ?? mapConfig?.mechWidth ?? 40),
    height: Number(mapConfig?.height ?? mapConfig?.mechHeight ?? 40)
  };
}

export function getDefaultFootprintByUnitType(unitType = "mech") {
  return (
    GAME_CONFIG.footprintByUnitType?.[unitType] ??
    GAME_CONFIG.footprintByUnitType.mech
  );
}

export function getUnitScaleClass(unit) {
  if (unit?.unitType === SCALE_CLASS.PILOT) return SCALE_CLASS.PILOT;
  if (unit?.unitType === SCALE_CLASS.STRUCTURE) return SCALE_CLASS.STRUCTURE;
  return SCALE_CLASS.MECH;
}

export function getUnitAnchor(unit) {
  return {
    x: Number(unit?.x ?? 0),
    y: Number(unit?.y ?? 0),
    anchorType: ANCHOR_TYPE.CENTER,
    scale: getUnitScaleClass(unit)
  };
}

export function getUnitFootprint(unit) {
  const defaults = getDefaultFootprintByUnitType(getUnitScaleClass(unit));

  return {
    width: Math.max(1, Number(unit?.footprintWidth ?? defaults.width)),
    height: Math.max(1, Number(unit?.footprintHeight ?? defaults.height))
  };
}

// Runtime x/y is the CENTER TILE for all units.
// For odd footprints this is clean and exact:
// 1x1 -> occupied tile
// 3x3 -> middle tile
// 5x5 -> middle tile
export function getFootprintBoundsFromOrigin(centerTileX, centerTileY, footprintWidth, footprintHeight) {
  const width = Math.max(1, Number(footprintWidth ?? 1));
  const height = Math.max(1, Number(footprintHeight ?? 1));

  const cx = Number(centerTileX ?? 0);
  const cy = Number(centerTileY ?? 0);

  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  const minX = cx - halfW;
  const minY = cy - halfH;
  const maxX = minX + width - 1;
  const maxY = minY + height - 1;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height
  };
}

export function getUnitFootprintBounds(unit) {
  const anchor = getUnitAnchor(unit);
  const footprint = getUnitFootprint(unit);

  return getFootprintBoundsFromOrigin(anchor.x, anchor.y, footprint.width, footprint.height);
}

export function getOccupiedCellsFromOrigin(centerTileX, centerTileY, footprintWidth, footprintHeight) {
  const bounds = getFootprintBoundsFromOrigin(
    centerTileX,
    centerTileY,
    footprintWidth,
    footprintHeight
  );

  const cells = [];

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      cells.push({ x, y });
    }
  }

  return cells;
}

export function getUnitOccupiedCells(unit) {
  const anchor = getUnitAnchor(unit);
  const footprint = getUnitFootprint(unit);

  return getOccupiedCellsFromOrigin(anchor.x, anchor.y, footprint.width, footprint.height);
}

export function getUnitCenterTile(unit) {
  return {
    x: Number(unit?.x ?? 0),
    y: Number(unit?.y ?? 0)
  };
}

export function getUnitCenterPoint(unit) {
  const centerTile = getUnitCenterTile(unit);

  return {
    x: centerTile.x + 0.5,
    y: centerTile.y + 0.5
  };
}

export function getUnitPrimaryPosition(unit) {
  const centerTile = getUnitCenterTile(unit);

  return {
    x: centerTile.x,
    y: centerTile.y,
    scale: getUnitScaleClass(unit)
  };
}

export function isCellWithinBoard(x, y, mapConfig = MAP_CONFIG) {
  const board = getResolutionBoardSize("base", mapConfig);

  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function areCellsWithinBoard(cells, mapConfig = MAP_CONFIG) {
  return cells.every((cell) => isCellWithinBoard(cell.x, cell.y, mapConfig));
}

export function isUnitWithinBoard(unit, mapConfig = MAP_CONFIG) {
  return areCellsWithinBoard(getUnitOccupiedCells(unit), mapConfig);
}

export function getResolutionCenterPoint(x, y, _scale = "base") {
  return {
    x: Number(x) + 0.5,
    y: Number(y) + 0.5,
    scale: "base"
  };
}

export function getParentMechTileForPosition(x, y, _scale = "base") {
  return {
    x: Number(x),
    y: Number(y)
  };
}

// Legacy dead bridge wrappers.
export function mechTileToPilotCells(x, y) {
  return [{ x: Number(x), y: Number(y) }];
}

export function pilotCellToMechTile(x, y) {
  return {
    x: Number(x),
    y: Number(y)
  };
}
