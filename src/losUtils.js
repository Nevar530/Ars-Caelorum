// src/losUtils.js

import { getTile, getTileEffectiveElevation } from "./map.js";
import { getEdgeLosBlockBetween } from "./structures/structureRules.js";

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

export function traceRay(z1, z2, lineTiles, state) {
  const tiles = Array.isArray(lineTiles) ? lineTiles : [];
  const lastIndex = tiles.length - 1;

  for (let i = 1; i <= lastIndex; i += 1) {
    const prev = tiles[i - 1];
    const pos = tiles[i];

    const edgeT = i / Math.max(1, lastIndex);
    const edgeRayHeight = z1 + (z2 - z1) * edgeT;
    const edgeBlock = getEdgeLosBlockBetween(state.map, prev.x, prev.y, pos.x, pos.y, edgeRayHeight);

    if (edgeBlock.blocked) {
      return {
        blocked: true,
        blockingTile: edgeBlock.blockingTile,
        reason: "edge_blocked",
        terrainHeight: edgeBlock.edgeHeight,
        edge: edgeBlock.edge,
        rayHeight: edgeRayHeight,
        stopHeight: edgeRayHeight
      };
    }

    // Origin/destination tile bodies are ignored, but their crossed edges are not.
    if (i === lastIndex) continue;

    const tileT = (i + 0.5) / Math.max(1, lastIndex);
    const rayHeight = z1 + (z2 - z1) * tileT;
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
