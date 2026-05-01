// src/targeting/rangeRules.js

import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { isOccupiedTileBlockedForDirectTargeting, isUnitDirectlyTargetable } from "./targetLegality.js";
import { getBoardUnits } from "../actors/actorResolver.js";
import { getUnitOccupiedCells, getUnitFootprintBounds } from "../scale/scaleMath.js";
import {
  getCardinalAdjacentTilesForFacing,
  uniqueBoardTiles
} from "./fireArc.js";

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

export function manhattanDistance(x0, y0, x1, y1) {
  return Math.abs(x1 - x0) + Math.abs(y1 - y0);
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
      return getCardinalAdjacentTilesForFacing(mech.x, mech.y, mech.facing)
        .map((tile) => {
          const targetEntry = getPrimaryOccupantAt(state, tile.x, tile.y, "base", {
            excludeUnitId: mech.instanceId
          });
          const targetUnit = targetEntry?.unit ?? null;

          if (!targetUnit) return null;
          if (!isUnitDirectlyTargetable(targetUnit, state)) return null;
          if (targetUnit.team === mech.team) return null;

          return makeUnitTargetTile(mech.x, mech.y, targetUnit);
        })
        .filter(Boolean);

    case "direct_tile": {
      const units = getStateUnits(state);

      return units.flatMap((unit) => {
        if (!unit) return [];
        if (unit.instanceId === mech.instanceId) return [];
        if (!isUnitDirectlyTargetable(unit, state)) return [];
        if (unit.team === mech.team) return [];

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

        if (seenTargetUnits.has(targetUnit.instanceId)) continue;
        seenTargetUnits.add(targetUnit.instanceId);

        if (isOccupiedTileBlockedForDirectTargeting(occupant, state)) continue;

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
