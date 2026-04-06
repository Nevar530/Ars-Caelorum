// src/los.js

import { MAP_CONFIG } from "./config.js";
import { getTile } from "./map.js";
import { getHeightsForScale, traceRay } from "./losUtils.js";

export function isTileOnBoard(x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < MAP_CONFIG.mechWidth &&
    y < MAP_CONFIG.mechHeight
  );
}

export function getLineTiles(x0, y0, x1, y1) {
  const tiles = [];

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    tiles.push({ x, y });

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;

    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }

    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return tiles;
}

function buildInvalidLosResult(reason) {
  return {
    visible: false,
    blocked: true,
    cover: "full",
    reason,
    line: [],
    blockingTile: null,
    rays: {
      chest: { blocked: true, reason },
      head: { blocked: true, reason }
    }
  };
}

function buildSameTileResult(line) {
  return {
    visible: true,
    blocked: false,
    cover: "none",
    reason: "same_tile",
    line,
    blockingTile: null,
    rays: {
      chest: { blocked: false, reason: "same_tile" },
      head: { blocked: false, reason: "same_tile" }
    }
  };
}

function getLosResultInternal(state, fromX, fromY, toX, toY, options = {}) {
  if (!isTileOnBoard(fromX, fromY) || !isTileOnBoard(toX, toY)) {
    return buildInvalidLosResult("out_of_bounds");
  }

  const fromTile = getTile(state.map, fromX, fromY);
  const toTile = getTile(state.map, toX, toY);

  if (!fromTile || !toTile) {
    return buildInvalidLosResult("missing_tile");
  }

  const attackerScale = options.attackerScale ?? "mech";
  const targetScale = options.targetScale ?? "mech";

  const attackerHeights = getHeightsForScale(fromTile, attackerScale);
  const targetHeights = getHeightsForScale(toTile, targetScale);

  const line = getLineTiles(fromX, fromY, toX, toY);

  if (line.length <= 1) {
    return buildSameTileResult(line);
  }

  // Never let origin or destination tile block the shot.
  const sampledTiles = line.slice(1, -1);

  const chestTrace = traceRay(
    attackerHeights.fire,
    targetHeights.chest,
    sampledTiles,
    state
  );

  const headTrace = traceRay(
    attackerHeights.fire,
    targetHeights.head,
    sampledTiles,
    state
  );

  const headBlocked = headTrace.blocked;
  const chestBlocked = chestTrace.blocked;

  return {
    visible: !headBlocked,
    blocked: headBlocked,
    cover: headBlocked ? "full" : chestBlocked ? "half" : "none",
    reason: headBlocked
      ? headTrace.reason
      : chestBlocked
        ? "half_cover"
        : "clear",
    line,
    blockingTile: headBlocked
      ? headTrace.blockingTile
      : chestBlocked
        ? chestTrace.blockingTile
        : null,
    rays: {
      chest: chestTrace,
      head: headTrace
    }
  };
}

/**
 * Direct fire:
 * - head blocked => invalid / full block
 * - chest blocked only => half cover
 * - neither blocked => clear
 */
export function getLineOfSightResult(state, fromX, fromY, toX, toY, options = {}) {
  return getLosResultInternal(state, fromX, fromY, toX, toY, options);
}

/**
 * Missile targeting:
 * - head blocked => invalid
 * - chest blocked only => still valid
 * - cover is still returned for downstream systems/debug
 */
export function getMissileLineOfSightResult(
  state,
  fromX,
  fromY,
  toX,
  toY,
  options = {}
) {
  const result = getLosResultInternal(state, fromX, fromY, toX, toY, options);
  const headBlocked = result.rays.head.blocked;
  const chestBlocked = result.rays.chest.blocked;

  return {
    ...result,
    visible: !headBlocked,
    blocked: headBlocked,
    cover: headBlocked ? "full" : chestBlocked ? "half" : "none",
    reason: headBlocked ? result.rays.head.reason : "missile_valid"
  };
}

export function hasLineOfSight(state, fromX, fromY, toX, toY, options = {}) {
  return getLineOfSightResult(state, fromX, fromY, toX, toY, options).visible;
}

export function filterTilesByLineOfSight(state, origin, tiles, options = {}) {
  return tiles.flatMap((tile) => {
    const los = getLineOfSightResult(
      state,
      origin.x,
      origin.y,
      tile.x,
      tile.y,
      options
    );

    if (!los.visible) return [];

    return [
      {
        ...tile,
        cover: los.cover,
        los
      }
    ];
  });
}
