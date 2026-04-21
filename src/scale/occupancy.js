// src/scale/occupancy.js

import {
  makeScaleCellKey,
  getUnitAnchor,
  getUnitCenterPoint,
  getUnitFootprint,
  getUnitFootprintBounds,
  getUnitOccupiedCells,
  isUnitWithinBoard
} from "./scaleMath.js";
import { getBoardUnits } from "../actors/actorResolver.js";

function getStateUnits(state) {
  return getBoardUnits(state);
}

function getUnitId(unit) {
  return unit?.instanceId ?? unit?.runtimeUnitId ?? null;
}

function buildOccupancyEntry(unit, cell) {
  const anchor = getUnitAnchor(unit);
  const footprint = getUnitFootprint(unit);
  const footprintBounds = getUnitFootprintBounds(unit);
  const centerPoint = getUnitCenterPoint(unit);

  return {
    unit,
    unitId: getUnitId(unit),
    unitType: unit?.unitType ?? "mech",
    team: unit?.team ?? null,

    x: cell.x,
    y: cell.y,

    anchorX: anchor.x,
    anchorY: anchor.y,
    anchorType: anchor.anchorType,

    footprintWidth: footprint.width,
    footprintHeight: footprint.height,
    footprintBounds,
    centerPoint
  };
}

export function getOccupiedCellsForUnit(unit) {
  return getUnitOccupiedCells(unit);
}

export function getOccupancyEntries(state) {
  const units = getStateUnits(state);
  const entries = [];

  for (const unit of units) {
    const cells = getUnitOccupiedCells(unit);

    for (const cell of cells) {
      entries.push(buildOccupancyEntry(unit, cell));
    }
  }

  return entries;
}

export function getOccupancyMap(state) {
  const occupancy = new Map();

  for (const entry of getOccupancyEntries(state)) {
    const key = makeScaleCellKey("base", entry.x, entry.y);

    if (!occupancy.has(key)) {
      occupancy.set(key, []);
    }

    occupancy.get(key).push(entry);
  }

  return occupancy;
}

export function getOccupantsAt(state, x, y) {
  const occupancy = getOccupancyMap(state);
  return occupancy.get(makeScaleCellKey("base", x, y)) ?? [];
}

export function getPrimaryOccupantAt(state, x, y, _resolution = "base", options = {}) {
  const { excludeUnitId = null } = options;
  const occupants = getOccupantsAt(state, x, y);

  return (
    occupants.find((entry) => {
      if (!entry?.unit) return false;
      if (excludeUnitId && entry.unitId === excludeUnitId) return false;
      return true;
    }) ?? null
  );
}

export function isPositionBlocked(state, x, y, _resolution = "base", options = {}) {
  const { ignoreUnitId = null } = options;

  return (
    getPrimaryOccupantAt(state, x, y, "base", {
      excludeUnitId: ignoreUnitId
    }) !== null
  );
}

export function canUnitOccupyCells(state, unit, options = {}) {
  const { ignoreUnitId = getUnitId(unit) } = options;

  if (!isUnitWithinBoard(unit)) return false;

  const occupied = getUnitOccupiedCells(unit);

  return occupied.every((cell) => {
    const occupant = getPrimaryOccupantAt(state, cell.x, cell.y, "base", {
      excludeUnitId: ignoreUnitId
    });

    return occupant === null;
  });
}
