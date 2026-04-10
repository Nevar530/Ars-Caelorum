// src/render/projection.js

import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import { rotateCoord, getTileEffectiveElevation } from "../map.js";

export const TOPDOWN_CONFIG = {
  cellSize: 56,
  originX: 460,
  originY: 130
};

export const CAMERA_CENTER = {
  isoX: 700,
  isoY: 320,
  topX: 700,
  topY: 360
};

export const LOS_HEIGHT_PROFILES = {
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

const EPSILON = 1e-9;

export function ensureCameraState(state) {
  if (!state.camera) {
    state.camera = { angle: 0 };
  }

  if (typeof state.camera.offsetX !== "number") {
    state.camera.offsetX = 0;
  }

  if (typeof state.camera.offsetY !== "number") {
    state.camera.offsetY = 0;
  }
}

export function updateCameraFraming(state, refs) {
  const viewport = getSceneViewport(refs);
  const rawBounds = getMapScreenBoundsRaw(state);
  const offsetLimits = getCameraOffsetLimits(rawBounds, viewport);

  const safeTile =
    state.map &&
    typeof state.focus?.x === "number" &&
    typeof state.focus?.y === "number"
      ? state.map[state.focus.y]?.[state.focus.x] ?? null
      : null;

  const safeElevation = safeTile ? getTileEffectiveElevation(safeTile) : 0;

  const focusScreen = projectScene(state, state.focus.x, state.focus.y, safeElevation);

  const deadZone = {
    left: viewport.width * 0.28,
    right: viewport.width * 0.72,
    top: viewport.height * 0.18,
    bottom: viewport.height * 0.72
  };

  let dx = 0;
  let dy = 0;

  if (focusScreen.x < deadZone.left) {
    dx = deadZone.left - focusScreen.x;
  } else if (focusScreen.x > deadZone.right) {
    dx = deadZone.right - focusScreen.x;
  }

  if (focusScreen.y < deadZone.top) {
    dy = deadZone.top - focusScreen.y;
  } else if (focusScreen.y > deadZone.bottom) {
    dy = deadZone.bottom - focusScreen.y;
  }

  state.camera.offsetX += dx;
  state.camera.offsetY += dy;

  state.camera.offsetX = clamp(
    state.camera.offsetX,
    offsetLimits.minX,
    offsetLimits.maxX
  );

  state.camera.offsetY = clamp(
    state.camera.offsetY,
    offsetLimits.minY,
    offsetLimits.maxY
  );
}

export function getSceneViewport(refs) {
  const svg = refs?.worldScene?.ownerSVGElement;

  const vb = svg?.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { width: vb.width, height: vb.height };
  }

  const width = svg?.clientWidth || 1400;
  const height = svg?.clientHeight || 760;

  return { width, height };
}

export function getCameraOffsetLimits(rawBounds, viewport) {
  const marginX = 48;
  const marginTop = 42;
  const marginBottom = 54;

  let minX = viewport.width - marginX - rawBounds.maxX;
  let maxX = marginX - rawBounds.minX;

  let minY = viewport.height - marginBottom - rawBounds.maxY;
  let maxY = marginTop - rawBounds.minY;

  if (minX > maxX) {
    const centerX = (minX + maxX) / 2;
    minX = centerX;
    maxX = centerX;
  }

  if (minY > maxY) {
    const centerY = (minY + maxY) / 2;
    minY = centerY;
    maxY = centerY;
  }

  return { minX, maxX, minY, maxY };
}

export function getMapScreenBoundsRaw(state) {
  const corners = [
    { x: 0, y: 0 },
    { x: MAP_CONFIG.mechWidth - 1, y: 0 },
    { x: 0, y: MAP_CONFIG.mechHeight - 1 },
    { x: MAP_CONFIG.mechWidth - 1, y: MAP_CONFIG.mechHeight - 1 }
  ];

  const points = [];

  for (const corner of corners) {
    for (const elevation of [0, MAP_CONFIG.maxElevation + 2]) {
      points.push(projectIsoRaw(corner.x, corner.y, elevation, state.rotation));
    }
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

export function projectScene(state, x, y, elevation = 0) {
  if (state.ui?.viewMode === "top") {
    return projectTopDown(state, x, y);
  }

  return projectIso(state, x, y, elevation);
}

export function projectIso(state, x, y, elevation = 0) {
  const raw = projectIsoRaw(x, y, elevation, state.rotation);

  return {
    x: raw.x + (state.camera?.offsetX ?? 0),
    y: raw.y + (state.camera?.offsetY ?? 0)
  };
}

export function projectIsoRaw(x, y, elevation = 0, rotation = 0) {
  const rotated = rotateSceneCoord(x, y, rotation);

  const isoX =
    (rotated.x - rotated.y) * (RENDER_CONFIG.isoTileWidth / 2) + CAMERA_CENTER.isoX;

  const isoY =
    (rotated.x + rotated.y) * (RENDER_CONFIG.isoTileHeight / 2) +
    CAMERA_CENTER.isoY -
    (elevation * RENDER_CONFIG.elevationStepPx);

  return {
    x: isoX,
    y: isoY
  };
}

export function projectTopDown(state, x, y) {
  return {
    x: TOPDOWN_CONFIG.originX + (x * TOPDOWN_CONFIG.cellSize),
    y: TOPDOWN_CONFIG.originY + (y * TOPDOWN_CONFIG.cellSize)
  };
}

export function getSceneSortKey(state, x, y, elevation = 0) {
  if (state.ui?.viewMode === "top") {
    return (y * 1000) + x;
  }

  const rotated = rotateSceneCoord(x, y, state.rotation);
  return (rotated.x + rotated.y) * 1000 + (elevation * 10);
}

export function getLosHeights(baseElevation, scale = "mech") {
  const profile = LOS_HEIGHT_PROFILES[scale] ?? LOS_HEIGHT_PROFILES.mech;

  return {
    fire: baseElevation + profile.fire,
    chest: baseElevation + profile.chest,
    head: baseElevation + profile.head
  };
}

export function projectLosPoint(state, x, y, height) {
  if (state.ui?.viewMode === "top") {
    const top = projectTopDown(state, x, y);
    return {
      x: top.x + (TOPDOWN_CONFIG.cellSize / 2),
      y: top.y + (TOPDOWN_CONFIG.cellSize / 2)
    };
  }

  const projected = projectIso(state, x, y, height);
  return {
    x: projected.x,
    y: projected.y + (RENDER_CONFIG.isoTileHeight / 2)
  };
}

export function getLosRayEndPoint(state, rayTrace, fallbackX, fallbackY, fallbackHeight) {
  if (rayTrace?.blocked && rayTrace?.blockingTile) {
    return projectLosPoint(
      state,
      rayTrace.blockingTile.x,
      rayTrace.blockingTile.y,
      rayTrace.stopHeight ?? fallbackHeight
    );
  }

  return projectLosPoint(state, fallbackX, fallbackY, fallbackHeight);
}

function rotateSceneCoord(x, y, rotation = 0) {
  const normalizedRotation = ((rotation % 4) + 4) % 4;

  if (isWholeTileCoord(x) && isWholeTileCoord(y)) {
    return rotateCoord(
      x,
      y,
      MAP_CONFIG.mechWidth,
      MAP_CONFIG.mechHeight,
      normalizedRotation
    );
  }

  const baseX = Math.floor(x);
  const baseY = Math.floor(y);
  const localX = x - baseX;
  const localY = y - baseY;

  const rotatedBase = rotateCoord(
    baseX,
    baseY,
    MAP_CONFIG.mechWidth,
    MAP_CONFIG.mechHeight,
    normalizedRotation
  );

  const rotatedLocal = rotateLocalOffset(localX, localY, normalizedRotation);

  return {
    x: rotatedBase.x + rotatedLocal.x,
    y: rotatedBase.y + rotatedLocal.y
  };
}

function rotateLocalOffset(localX, localY, rotation = 0) {
  // shift to center (pivot = 0.5,0.5)
  const cx = localX - 0.5;
  const cy = localY - 0.5;

  let rx, ry;

  switch (rotation) {
    case 0:
      rx = cx;
      ry = cy;
      break;
    case 1:
      rx = -cy;
      ry = cx;
      break;
    case 2:
      rx = -cx;
      ry = -cy;
      break;
    case 3:
      rx = cy;
      ry = -cx;
      break;
    default:
      rx = cx;
      ry = cy;
  }

  // shift back to tile space
  return {
    x: rx + 0.5,
    y: ry + 0.5
  };
}

function isWholeTileCoord(value) {
  return Math.abs(value - Math.round(value)) < EPSILON;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
