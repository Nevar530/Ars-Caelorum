// src/losUtils.js

import { getTile, getTileEffectiveElevation } from "./map.js";

const HEIGHT_PROFILES = {
  mech: {
    fire: 3,
    chest: 3,
    head: 6
  },
  pilot: {
    fire: 1,
    chest: 1,
    head: 2
  }
};

export function getScaleProfile(scale = "mech") {
  return HEIGHT_PROFILES[scale] ?? HEIGHT_PROFILES.mech;
}

export function getHeightsForScale(tile, scale = "mech") {
  const base = getTileEffectiveElevation(tile);
  const profile = getScaleProfile(scale);

  return {
    fire: base + profile.fire,
    chest: base + profile.chest,
    head: base + profile.head
  };
}

export function traceRay(z1, z2, sampledTiles, state) {
  const totalSteps = sampledTiles.length;

  for (let i = 0; i < totalSteps; i++) {
    const pos = sampledTiles[i];

    // Sample the ray at the CENTER of each crossed tile step.
    const t = (i + 1) / (totalSteps + 1);
    const rayHeight = z1 + (z2 - z1) * t;

    const tile = getTile(state.map, pos.x, pos.y);

    if (!tile) {
      return {
        blocked: true,
        blockingTile: pos,
        reason: "invalid_tile",
        terrainHeight: null,
        rayHeight,
        stopHeight: rayHeight
      };
    }

    if (tile.blocksLOS === true) {
      return {
        blocked: true,
        blockingTile: pos,
        reason: "hard_blocker",
        terrainHeight: getTileEffectiveElevation(tile),
        rayHeight,
        stopHeight: rayHeight
      };
    }

    const terrainHeight = getTileEffectiveElevation(tile);

    // White sheet rule: touching counts as blocked.
    if (terrainHeight >= rayHeight) {
      return {
        blocked: true,
        blockingTile: pos,
        reason: "terrain_blocked",
        terrainHeight,
        rayHeight,
        stopHeight: rayHeight
      };
    }
  }

  return {
    blocked: false,
    blockingTile: null,
    reason: "clear",
    terrainHeight: null,
    rayHeight: null,
    stopHeight: null
  };
}
