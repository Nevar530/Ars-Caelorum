// src/scale/occupancy.js

import {
  makeScaleCellKey,
  mechTileToPilotCells,
  normalizeScale,
  getUnitPrimaryPosition
} from "./scaleMath.js";

function getUnitOccupiedCells(unit, resolution = "mech") {
  if (!unit) return [];

  const position = getUnitPrimaryPosition(unit);
  const queryScale = normalizeScale(resolution);

  if (queryScale === "pilot") {
    if (position.scale === "pilot") {
      return [{ x: position.x, y: position.y, scale: "pilot" }];
    }

    return mechTileToPilotCells(position.x, position.y).map((cell) => ({
      ...cell,
      scale: "pilot"
    }));
  }

  if (position.scale === "pilot") {
    return [];
  }

  return [{ x: position.x, y: position.y, scale: "mech" }];
}

export function getOccupancyEntries(state, resolution = "mech") {
  const units = Array.isArray(state?.mechs) ? state.mechs : [];
  const queryScale = normalizeScale(resolution);
  const entries = [];

  for (const unit of units) {
    const occupiedCells = getUnitOccupiedCells(unit, queryScale);

    for (const cell of occupiedCells) {
      entries.push({
        unit,
        unitId: unit.instanceId,
        unitType: unit.unitType ?? "mech",
        team: unit.team ?? null,
        x: cell.x,
        y: cell.y,
        scale: cell.scale
      });
    }
  }

  return entries;
}

export function getOccupancyMap(state, resolution = "mech") {
  const occupancy = new Map();

  for (const entry of getOccupancyEntries(state, resolution)) {
    const key = makeScaleCellKey(entry.scale, entry.x, entry.y);
    if (!occupancy.has(key)) {
      occupancy.set(key, []);
    }
    occupancy.get(key).push(entry);
  }

  return occupancy;
}

export function getOccupantsAt(state, x, y, resolution = "mech") {
  const queryScale = normalizeScale(resolution);
  const occupancy = getOccupancyMap(state, queryScale);
  return occupancy.get(makeScaleCellKey(queryScale, x, y)) ?? [];
}

export function getPrimaryOccupantAt(state, x, y, resolution = "mech", options = {}) {
  const { excludeUnitId = null } = options;
  const occupants = getOccupantsAt(state, x, y, resolution);

  return (
    occupants.find((entry) => {
      if (!entry?.unit) return false;
      if (excludeUnitId && entry.unit.instanceId === excludeUnitId) return false;
      return true;
    }) ?? null
  );
}

export function isPositionBlocked(state, x, y, resolution = "mech", options = {}) {
  const { ignoreUnitId = null } = options;
  const occupant = getPrimaryOccupantAt(state, x, y, resolution, {
    excludeUnitId: ignoreUnitId
  });

  return occupant !== null;
}

export function getOccupiedCellsForUnit(unit, resolution = "mech") {
  return getUnitOccupiedCells(unit, resolution);
}
