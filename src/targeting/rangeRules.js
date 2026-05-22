// src/targeting/rangeRules.js

import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { isOccupiedTileBlockedForDirectTargeting, isUnitDirectlyTargetable } from "./targetLegality.js";
import { getBoardUnits } from "../actors/actorResolver.js";
import { getUnitOccupiedCells, getUnitFootprintBounds } from "../scale/scaleMath.js";
import { uniqueBoardTiles } from "./fireArc.js";

export const DEFAULT_DIRECT_MAX_RANGE = 20;
export const DEFAULT_MISSILE_MAX_RANGE = 20;

function getStateUnits(state) {
  return getBoardUnits(state);
}

function getTargetFocusTile(unit) {
  const bounds = getUnitFootprintBounds(unit);

  return {
    x: bounds.minX + Math.floor(bounds.width / 2),
    y: bounds.minY + Math.floor(bounds.height / 2)
  };
}

function getTargetFootprintCells(unit) {
  return getUnitOccupiedCells(unit).map(({ x, y }) => ({ x, y }));
}

function getClosestFootprintDistance(attackerX, attackerY, unit) {
  const cells = getTargetFootprintCells(unit);
  if (!cells.length) {
    const focus = getTargetFocusTile(unit);
    return manhattanDistance(attackerX, attackerY, focus.x, focus.y);
  }

  return cells.reduce((best, cell) => {
    const distance = manhattanDistance(attackerX, attackerY, cell.x, cell.y);
    return Math.min(best, distance);
  }, Infinity);
}

function makeUnitTargetTile(attackerX, attackerY, unit) {
  const focus = getTargetFocusTile(unit);
  const distance = getClosestFootprintDistance(attackerX, attackerY, unit);

  return {
    x: focus.x,
    y: focus.y,
    targetUnitId: unit.instanceId,
    targetScale: unit.scale ?? unit.unitType ?? "mech",
    targetFocusX: focus.x,
    targetFocusY: focus.y,
    targetDistance: Number.isFinite(distance)
      ? distance
      : manhattanDistance(attackerX, attackerY, focus.x, focus.y),
    arcCheckTiles: getTargetFootprintCells(unit)
  };
}

function makeMissileTileTarget(attackerX, attackerY, unit, tileX, tileY) {
  const focus = getTargetFocusTile(unit);

  return {
    x: Number(tileX),
    y: Number(tileY),
    targetUnitId: unit.instanceId,
    targetScale: unit.scale ?? unit.unitType ?? "mech",
    targetFocusX: focus.x,
    targetFocusY: focus.y,
    losTargetX: focus.x,
    losTargetY: focus.y,
    targetDistance: manhattanDistance(attackerX, attackerY, tileX, tileY),
    arcCheckTiles: [{ x: Number(tileX), y: Number(tileY) }]
  };
}

export function manhattanDistance(x0, y0, x1, y1) {
  return Math.abs(x1 - x0) + Math.abs(y1 - y0);
}

function unitMatchesTargetTeam(attacker, unit, targetTeam = "enemy") {
  if (!unit || !attacker) return false;
  switch (targetTeam) {
    case "ally":
      return unit.team === attacker.team && unit.instanceId !== attacker.instanceId;
    case "any":
      return unit.instanceId !== attacker.instanceId;
    case "self":
      return unit.instanceId === attacker.instanceId;
    case "tile":
      return true;
    case "enemy":
    default:
      return unit.team !== attacker.team;
  }
}

function getAdjacentTilesOutsideFootprint(unit) {
  const cells = getTargetFootprintCells(unit);
  const occupied = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const results = [];

  for (const cell of cells) {
    for (const delta of [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 }
    ]) {
      const x = cell.x + delta.x;
      const y = cell.y + delta.y;
      if (x < 0 || y < 0) continue;
      if (occupied.has(`${x},${y}`)) continue;
      results.push({ x, y });
    }
  }

  return uniqueBoardTiles(results);
}

export function getTilesInRangeBand(x, y, minRange, maxRange) {
  const results = [];

  for (let dx = -maxRange; dx <= maxRange; dx++) {
    for (let dy = -maxRange; dy <= maxRange; dy++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < minRange || dist > maxRange) continue;
      results.push({ x: x + dx, y: y + dy });
    }
  }

  return uniqueBoardTiles(results);
}

export function getCircleTiles(cx, cy, radius) {
  const results = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) {
        results.push({ x: cx + dx, y: cy + dy });
      }
    }
  }

  return uniqueBoardTiles(results);
}

export function getWeaponCandidateTiles(state, mech, profile) {
  const targetingKind = profile.targeting?.kind;
  const minRange = profile.targeting?.minRange ?? 1;
  const maxRange = profile.targeting?.maxRange ?? 1;

  switch (targetingKind) {
    case "cardinal_adjacent":
      return getAdjacentTilesOutsideFootprint(mech)
        .map((tile) => {
          const targetEntry = getPrimaryOccupantAt(state, tile.x, tile.y, "base", {
            excludeUnitId: mech.instanceId
          });
          const targetUnit = targetEntry?.unit ?? null;

          if (!targetUnit) return null;
          if (!isUnitDirectlyTargetable(targetUnit, state)) return null;
          if (!unitMatchesTargetTeam(mech, targetUnit, profile.targetTeam ?? "enemy")) return null;

          return makeUnitTargetTile(mech.x, mech.y, targetUnit);
        })
        .filter(Boolean);

    case "direct_tile": {
      const units = getStateUnits(state);

      return units.flatMap((unit) => {
        if (!unit) return [];
        if (unit.instanceId === mech.instanceId) return [];
        if (!isUnitDirectlyTargetable(unit, state)) return [];
        if (!unitMatchesTargetTeam(mech, unit, profile.targetTeam ?? "enemy")) return [];

        const targetTile = makeUnitTargetTile(mech.x, mech.y, unit);
        const distance = Number(targetTile.targetDistance ?? 0);

        if (distance < minRange || distance > maxRange) {
          return [];
        }

        return [targetTile];
      });
    }

    case "fire_arc_tile": {
      const seenTargetUnits = new Set();
      const candidates = [];

      for (const tile of getTilesInRangeBand(mech.x, mech.y, minRange, maxRange)) {
        const occupant = getPrimaryOccupantAt(state, tile.x, tile.y, "base", {
          excludeUnitId: mech.instanceId
        });
        const targetUnit = occupant?.unit ?? null;

        if (!targetUnit) {
          candidates.push(tile);
          continue;
        }

        if (isOccupiedTileBlockedForDirectTargeting(occupant, state)) continue;

        if (profile.weaponType === "missile") {
          candidates.push(makeMissileTileTarget(mech.x, mech.y, targetUnit, tile.x, tile.y));
          continue;
        }

        if (!unitMatchesTargetTeam(mech, targetUnit, profile.targetTeam ?? "enemy")) continue;
        if (seenTargetUnits.has(targetUnit.instanceId)) continue;
        seenTargetUnits.add(targetUnit.instanceId);

        candidates.push(makeUnitTargetTile(mech.x, mech.y, targetUnit));
      }

      return candidates;
    }

    default:
      return [];
  }
}

export function getEffectTilesForTarget(mech, profile, targetX, targetY) {
  const effectKind = profile.effect?.kind;

  switch (effectKind) {
    case "single":
      return [{ x: targetX, y: targetY }];

    case "circle":
      return getCircleTiles(targetX, targetY, profile.effect?.radius ?? 3);

    default:
      return [{ x: targetX, y: targetY }];
  }
}
