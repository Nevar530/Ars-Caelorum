// src/render/projection.js

import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import { rotateCoord } from "../map.js";

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

  const focusTile = state.map?.tiles?.find?.(() => false); // noop guard for shape changes
  const actualFocusTile = state.map ? null : focusTile;
  void actualFocusTile;

  const tile = state.map ? null : null;
  void tile;

  const focusElevation =
    state.map?.[0] === undefined
      ? (state.map && state.focus ? undefined : undefined)
      : undefined;
  void focusElevation;

  const safeElevation =
    state.map && typeof state.focus?.x === "number" && typeof state.focus?.y === "number"
      ? (state.map[state.focus.y]?.[state.focus.x]?.elevation ?? 0)
      : 0;

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
    { x: MAP_CONFIG.mechWidth - 1, y: MAP_CONFIG.mechHeight - 1 },
    { x: 0, y: MAP_CONFIG.mechHeight - 1 }
  ];

  const points = corners.map((corner) =>
    projectSceneBase(state, corner.x, corner.y, 0)
  );

  if (state.ui.viewMode === "top") {
    return {
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)) + TOPDOWN_CONFIG.cellSize,
      minY: Math.min(...points.map((p) => p.y)),
      maxY: Math.max(...points.map((p) => p.y)) + TOPDOWN_CONFIG.cellSize
    };
  }

  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const tileBottomPad =
    RENDER_CONFIG.isoTileHeight +
    (MAP_CONFIG.maxElevation * RENDER_CONFIG.elevationStepPx);

  return {
    minX: Math.min(...points.map((p) => p.x)) - halfW,
    maxX: Math.max(...points.map((p) => p.x)) + halfW,
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)) + tileBottomPad
  };
}

export function projectScene(state, x, y, elevation) {
  const base = projectSceneBase(state, x, y, elevation);

  return {
    x: base.x + state.camera.offsetX,
    y: base.y + state.camera.offsetY
  };
}

export function projectSceneBase(state, x, y, elevation) {
  if (state.ui.viewMode === "top") {
    const snappedTurns = normalizedTurns(state);

    const rotated = rotateCoord(
      x,
      y,
      MAP_CONFIG.mechWidth,
      MAP_CONFIG.mechHeight,
      snappedTurns
    );

    return {
      x: CAMERA_CENTER.topX + (rotated.x * TOPDOWN_CONFIG.cellSize),
      y: CAMERA_CENTER.topY + (rotated.y * TOPDOWN_CONFIG.cellSize)
    };
  }

  const startTurns = ((Math.floor(state.camera.angle / 90) % 4) + 4) % 4;
  const nextTurns = (startTurns + 1) % 4;
  const blend = (state.camera.angle % 90) / 90;

  const startRot = rotateCoord(
    x,
    y,
    MAP_CONFIG.mechWidth,
    MAP_CONFIG.mechHeight,
    startTurns
  );

  const nextRot = rotateCoord(
    x,
    y,
    MAP_CONFIG.mechWidth,
    MAP_CONFIG.mechHeight,
    nextTurns
  );

  const p0 = isoProjectRaw(startRot.x, startRot.y, elevation);
  const p1 = isoProjectRaw(nextRot.x, nextRot.y, elevation);

  return {
    x: lerp(p0.x, p1.x, blend) + CAMERA_CENTER.isoX,
    y: lerp(p0.y, p1.y, blend) + CAMERA_CENTER.isoY
  };
}

export function getSceneSortKey(state, x, y, elevation) {
  const turns = normalizedTurns(state);

  const rotated = rotateCoord(
    x,
    y,
    MAP_CONFIG.mechWidth,
    MAP_CONFIG.mechHeight,
    turns
  );

  return (rotated.x + rotated.y) * 100 + elevation;
}

export function getLosHeights(baseElevation, scale = "mech") {
  const profile = LOS_HEIGHT_PROFILES[scale] ?? LOS_HEIGHT_PROFILES.mech;
  return {
    fire: baseElevation + profile.fire,
    chest: baseElevation + profile.chest,
    head: baseElevation + profile.head
  };
}

export function getLosRayEndPoint(state, ray, fallbackX, fallbackY, fallbackHeight) {
  if (ray?.blocked && ray.blockingTile) {
    return projectLosPoint(
      state,
      ray.blockingTile.x,
      ray.blockingTile.y,
      ray.stopHeight ?? ray.rayHeight ?? fallbackHeight
    );
  }

  return projectLosPoint(state, fallbackX, fallbackY, fallbackHeight);
}

export function projectLosPoint(state, x, y, elevation) {
  if (state.ui.viewMode === "top") {
    const rotated = rotateCoord(
      x,
      y,
      MAP_CONFIG.mechWidth,
      MAP_CONFIG.mechHeight,
      normalizedTurns(state)
    );

    return {
      x:
        CAMERA_CENTER.topX +
        state.camera.offsetX +
        (rotated.x * TOPDOWN_CONFIG.cellSize) +
        (TOPDOWN_CONFIG.cellSize / 2),
      y:
        CAMERA_CENTER.topY +
        state.camera.offsetY +
        (rotated.y * TOPDOWN_CONFIG.cellSize) +
        (TOPDOWN_CONFIG.cellSize / 2)
    };
  }

  const projected = projectScene(state, x, y, elevation);
  return {
    x: projected.x,
    y: projected.y + (RENDER_CONFIG.isoTileHeight * 0.5)
  };
}

export function isoProjectRaw(x, y, elevation) {
  const screenX =
    (x - y) * (RENDER_CONFIG.isoTileWidth / 2);

  const screenY =
    (x + y) * (RENDER_CONFIG.isoTileHeight / 2) -
    (elevation * RENDER_CONFIG.elevationStepPx);

  return { x: screenX, y: screenY };
}

export function lerp(a, b, t) {
  return a + ((b - a) * t);
}

export function normalizedTurns(state) {
  return ((Math.round(state.camera.angle / 90) % 4) + 4) % 4;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
