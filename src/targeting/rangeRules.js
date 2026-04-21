// src/targeting/rangeRules.js

import { getPrimaryOccupantAt } from "../scale/occupancy.js";
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

function getTargetableCellsForUnit(unit) {
  const focus = getTargetFocusTile(unit);

  return getUnitOccupiedCells(unit)
    .map((cell) => ({
      ...cell,
      _sortDistance: Math.abs(cell.x - focus.x) + Math.abs(cell.y - focus.y)
    }))
    .sort((a, b) => {
      if (a._sortDistance !== b._sortDistance) {
        return a._sortDistance - b._sortDistance;
      }
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    })
    .map(({ x, y }) => ({ x, y }));
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
          if (targetUnit.team === mech.team) return null;

          return {
            x: tile.x,
            y: tile.y,
            targetUnitId: targetUnit.instanceId,
            targetScale: targetUnit.scale ?? targetUnit.unitType ?? "mech"
          };
        })
        .filter(Boolean);

    case "direct_tile": {
      const units = getStateUnits(state);

      return units.flatMap((unit) => {
        if (!unit) return [];
        if (unit.instanceId === mech.instanceId) return [];
        if (unit.team === mech.team) return [];

        const focusTile = getTargetFocusTile(unit);
        const distance = manhattanDistance(mech.x, mech.y, focusTile.x, focusTile.y);

        if (distance < minRange || distance > maxRange) {
          return [];
        }

        return getTargetableCellsForUnit(unit).map((cell) => ({
          x: cell.x,
          y: cell.y,
          targetUnitId: unit.instanceId,
          targetScale: unit.scale ?? unit.unitType ?? "mech",
          targetFocusX: focusTile.x,
          targetFocusY: focusTile.y
        }));
      });
    }

    case "fire_arc_tile":
      return getTilesInRangeBand(mech.x, mech.y, minRange, maxRange);

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
