// src/targeting/rangeRules.js

import { getMechAt } from "../mechs.js";
import {
  getCardinalAdjacentTilesForFacing,
  uniqueBoardTiles
} from "./fireArc.js";

export const DEFAULT_DIRECT_MAX_RANGE = 20;
export const DEFAULT_MISSILE_MAX_RANGE = 20;

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
      const distSq = (dx * dx) + (dy * dy);
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
          const targetMech = getMechAt(state.mechs, tile.x, tile.y);
          if (!targetMech || targetMech.instanceId === mech.instanceId) return null;
          if (targetMech.team === mech.team) return null;

          return {
            ...tile,
            targetMechId: targetMech.instanceId
          };
        })
        .filter(Boolean);

    case "direct_tile":
      return state.mechs
        .filter((unit) => {
          if (!unit) return false;
          if (unit.instanceId === mech.instanceId) return false;
          if (unit.team === mech.team) return false;

          const distance = manhattanDistance(mech.x, mech.y, unit.x, unit.y);
          return distance >= minRange && distance <= maxRange;
        })
        .map((unit) => ({
          x: unit.x,
          y: unit.y,
          targetMechId: unit.instanceId
        }));

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
