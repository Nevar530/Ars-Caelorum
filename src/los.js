import { MAP_CONFIG } from "./config.js";
import { getTile } from "./map.js";

const HALF_COVER_THRESHOLD = 1;
const FULL_BLOCK_THRESHOLD = 2;
const EPSILON = 0.0001;

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

  let x = x0;
  let y = y0;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    tiles.push({ x, y });

    if (x === x1 && y === y1) {
      break;
    }

    const e2 = err * 2;

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

export function getLineOfSightResult(state, fromX, fromY, toX, toY) {
  if (!isTileOnBoard(fromX, fromY) || !isTileOnBoard(toX, toY)) {
    return {
      visible: false,
      blocked: true,
      cover: "full",
      reason: "out_of_bounds",
      line: [],
      blockingTile: null,
      maxTerrainOverLine: 0
    };
  }

  const fromTile = getTile(state.map, fromX, fromY);
  const toTile = getTile(state.map, toX, toY);

  if (!fromTile || !toTile) {
    return {
      visible: false,
      blocked: true,
      cover: "full",
      reason: "missing_tile",
      line: [],
      blockingTile: null,
      maxTerrainOverLine: 0
    };
  }

  const line = getLineTiles(fromX, fromY, toX, toY);

  if (line.length <= 1) {
    return {
      visible: true,
      blocked: false,
      cover: "none",
      reason: "same_tile",
      line,
      blockingTile: null,
      maxTerrainOverLine: 0
    };
  }

  const fromElevation = fromTile.elevation ?? 0;
  const toElevation = toTile.elevation ?? 0;
  const lastIndex = line.length - 1;

  let maxTerrainOverLine = 0;
  let blockingTile = null;
  let reason = "clear";

  // Only intermediate tiles matter for LOS blocking.
  // The target tile itself does not block its own visibility.
  for (let i = 1; i < lastIndex; i++) {
    const step = line[i];
    const tile = getTile(state.map, step.x, step.y);

    if (!tile) {
      return {
        visible: false,
        blocked: true,
        cover: "full",
        reason: "missing_tile",
        line,
        blockingTile: step,
        maxTerrainOverLine
      };
    }

    // Hard LOS blockers always fully block anything behind them.
    if (tile.blocksLOS === true) {
      return {
        visible: false,
        blocked: true,
        cover: "full",
        reason: "hard_blocker",
        line,
        blockingTile: step,
        maxTerrainOverLine: FULL_BLOCK_THRESHOLD
      };
    }

    const t = i / lastIndex;
    const losHeight = lerp(fromElevation, toElevation, t);
    const terrainHeight = tile.elevation ?? 0;
    const terrainOverLine = terrainHeight - losHeight;

    if (terrainOverLine > maxTerrainOverLine) {
      maxTerrainOverLine = terrainOverLine;
      blockingTile = step;
    }
  }

  if (maxTerrainOverLine >= FULL_BLOCK_THRESHOLD - EPSILON) {
    reason = "full_cover";
    return {
      visible: false,
      blocked: true,
      cover: "full",
      reason,
      line,
      blockingTile,
      maxTerrainOverLine
    };
  }

  if (maxTerrainOverLine >= HALF_COVER_THRESHOLD - EPSILON) {
    reason = "half_cover";
    return {
      visible: true,
      blocked: false,
      cover: "half",
      reason,
      line,
      blockingTile,
      maxTerrainOverLine
    };
  }

  return {
    visible: true,
    blocked: false,
    cover: "none",
    reason,
    line,
    blockingTile: null,
    maxTerrainOverLine
  };
}

export function hasLineOfSight(state, fromX, fromY, toX, toY) {
  return getLineOfSightResult(state, fromX, fromY, toX, toY).visible;
}

export function filterTilesByLineOfSight(state, origin, tiles) {
  return tiles.flatMap((tile) => {
    const los = getLineOfSightResult(
      state,
      origin.x,
      origin.y,
      tile.x,
      tile.y
    );

    if (!los.visible) {
      return [];
    }

    return [
      {
        ...tile,
        cover: los.cover,
        los
      }
    ];
  });
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}
