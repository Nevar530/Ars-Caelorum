// src/los.js

import { getMapHeight, getMapWidth, getTile } from "./map.js";
import { getHeightsForScale, traceRay } from "./losUtils.js";

export function isTileOnBoard(x, y, map = null) {
  const width = getMapWidth(map);
  const height = getMapHeight(map);

  return (
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height
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
  if (!isTileOnBoard(fromX, fromY, state.map) || !isTileOnBoard(toX, toY, state.map)) {
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

  // Ignore origin and destination tiles completely.
  // Only crossed tiles matter for blocking.
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

export function getLineOfSightResult(state, fromX, fromY, toX, toY, options = {}) {
  return getLosResultInternal(state, fromX, fromY, toX, toY, options);
}

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
  return tiles.map((tile) => {
    const los = getLineOfSightResult(
      state,
      origin.x,
      origin.y,
      tile.x,
      tile.y,
      options
    );

    return {
      ...tile,
      cover: los.cover,
      los,
      visible: los.visible
    };
  });
}
