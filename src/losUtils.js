// src/losUtils.js

const HEIGHT_PROFILES = {
  mech: {
    fire: 1,
    chest: 1,
    head: 2
  },
  pilot: {
    fire: 0.25,
    chest: 0.125,
    head: 0.25
  }
};

export function getScaleProfile(scale = "mech") {
  return HEIGHT_PROFILES[scale] ?? HEIGHT_PROFILES.mech;
}

export function getHeightsForScale(tile, scale = "mech") {
  const base = tile?.elevation ?? 0;
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
    const tile = state.map[pos.y]?.[pos.x];

    if (!tile) {
      return {
        blocked: true,
        blockingTile: pos,
        reason: "invalid_tile"
      };
    }

    if (tile.blocksLOS === true) {
      return {
        blocked: true,
        blockingTile: pos,
        reason: "hard_blocker"
      };
    }

    const t = i / totalSteps;
    const rayHeight = z1 + (z2 - z1) * t;
    const terrainHeight = tile.elevation ?? 0;

    // White sheet rule: touching counts as blocked.
    if (terrainHeight >= rayHeight) {
      return {
        blocked: true,
        blockingTile: pos,
        reason: "terrain_blocked",
        terrainHeight,
        rayHeight
      };
    }
  }

  return {
    blocked: false,
    blockingTile: null,
    reason: "clear"
  };
}
