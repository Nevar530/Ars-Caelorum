// src/render/projection.js

import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import { normalizeScale, getResolutionBoardSize } from "../scale/scaleMath.js";

export const TOPDOWN_CONFIG = {
  cellSize: 14
};

export const SCALE_ZOOM = {
  mech: 1,
  pilot: 1
};

export const CAMERA_CENTER = {
  isoX: 700,
  isoY: 320,
  topX: 320,
  topY: 70
};

export const LOS_HEIGHT_PROFILES = {
  mech: {
    fire: 2,
    chest: 2,
    head: 4
  },
  pilot: {
    fire: 1,
    chest: 1,
    head: 2
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

  if (!state.camera.zoomScale) {
    state.camera.zoomScale = getCurrentInteractionScale(state);
  }
}

export function updateCameraFraming(state, refs) {
  const currentScale = getCurrentInteractionScale(state);
  state.camera.zoomScale = currentScale;

  if (state.ui?.viewMode === "top") {
    state.camera.offsetX = 0;
    state.camera.offsetY = 0;
    return;
  }

  const viewport = getSceneViewport(refs);
  const rawBounds = getMapScreenBoundsRaw(state);
  const offsetLimits = getCameraOffsetLimits(rawBounds, viewport);

  const focusX = Number(state.focus?.x ?? 0);
  const focusY = Number(state.focus?.y ?? 0);

  const focusScreen = projectIso(state, focusX, focusY, 0, 1);

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

  state.camera.offsetX = clamp(state.camera.offsetX, offsetLimits.minX, offsetLimits.maxX);
  state.camera.offsetY = clamp(state.camera.offsetY, offsetLimits.minY, offsetLimits.maxY);
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
  const board = getResolutionBoardSize("base", MAP_CONFIG);

  if (state.ui?.viewMode === "top") {
    const cellSize = getTopdownCellSize("base");

    return {
      minX: CAMERA_CENTER.topX,
      minY: CAMERA_CENTER.topY,
      maxX: CAMERA_CENTER.topX + (board.width * cellSize),
      maxY: CAMERA_CENTER.topY + (board.height * cellSize)
    };
  }

  const corners = [
    { x: 0, y: 0 },
    { x: board.width, y: 0 },
    { x: 0, y: board.height },
    { x: board.width, y: board.height }
  ];

  const points = [];

  for (const corner of corners) {
    points.push(projectIsoRaw(corner.x, corner.y, 0, state.rotation, 1));
    points.push(projectIsoRaw(corner.x, corner.y, MAP_CONFIG.maxElevation + 8, state.rotation, 1));
  }

  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y))
  };
}

export function projectScene(state, x, y, elevation = 0, size = 1) {
  if (state.ui?.viewMode === "top") {
    return projectTopDown(state, x, y);
  }

  return projectIso(state, x, y, elevation, size);
}

export function projectIso(state, x, y, elevation = 0, size = 1) {
  const raw = projectIsoRaw(x, y, elevation, state.rotation, size);

  return {
    x: raw.x + (state.camera?.offsetX ?? 0),
    y: raw.y + (state.camera?.offsetY ?? 0)
  };
}

export function projectIsoRaw(x, y, elevation = 0, rotation = 0, _size = 1) {
  const board = getResolutionBoardSize("base", MAP_CONFIG);
  const rotated = rotateSceneCoordContinuous(x, y, board.width, board.height, rotation);

  const isoX =
    ((rotated.x - rotated.y) * (RENDER_CONFIG.isoTileWidth / 2)) + CAMERA_CENTER.isoX;

  const isoY =
    ((rotated.x + rotated.y) * (RENDER_CONFIG.isoTileHeight / 2)) +
    CAMERA_CENTER.isoY -
    (elevation * RENDER_CONFIG.elevationStepPx);

  return {
    x: isoX,
    y: isoY
  };
}

export function projectTopDown(state, x, y) {
  const cellSize = getTopdownCellSize("base");
  const board = getResolutionBoardSize("base", MAP_CONFIG);
  const rotated = rotateSceneCoordContinuous(x, y, board.width, board.height, state.rotation);

  return {
    x: CAMERA_CENTER.topX + (rotated.x * cellSize),
    y: CAMERA_CENTER.topY + (rotated.y * cellSize)
  };
}

export function getSceneSortKey(state, x, y, elevation = 0) {
  if (state.ui?.viewMode === "top") {
    const board = getResolutionBoardSize("base", MAP_CONFIG);
    const rotated = rotateSceneCoordContinuous(x, y, board.width, board.height, state.rotation);
    return (rotated.y * 1000) + rotated.x;
  }

  const board = getResolutionBoardSize("base", MAP_CONFIG);
  const rotated = rotateSceneCoordContinuous(x, y, board.width, board.height, state.rotation);
  return ((rotated.x + rotated.y) * 1000) + (elevation * 10);
}

export function getLosHeights(baseElevation, scale = "mech") {
  const profile = LOS_HEIGHT_PROFILES[normalizeScale(scale)] ?? LOS_HEIGHT_PROFILES.mech;

  return {
    fire: baseElevation + profile.fire,
    chest: baseElevation + profile.chest,
    head: baseElevation + profile.head
  };
}

export function projectLosPoint(state, x, y, height, _scale = "mech") {
  if (state.ui?.viewMode === "top") {
    const top = projectTopDown(state, x, y);
    const cellSize = getTopdownCellSize("base");

    return {
      x: top.x + (cellSize / 2),
      y: top.y + (cellSize / 2)
    };
  }

  const projected = projectIso(state, x, y, height, 1);

  return {
    x: projected.x,
    y: projected.y + (RENDER_CONFIG.isoTileHeight / 2)
  };
}

export function getLosRayEndPoint(state, rayTrace, fallbackX, fallbackY, fallbackHeight, scale = "mech") {
  if (rayTrace?.blocked && rayTrace?.blockingTile) {
    return projectLosPoint(
      state,
      rayTrace.blockingTile.x,
      rayTrace.blockingTile.y,
      rayTrace.stopHeight ?? fallbackHeight,
      scale
    );
  }

  return projectLosPoint(state, fallbackX, fallbackY, fallbackHeight, scale);
}

export function getTopdownCellSize(_scale = "base") {
  return TOPDOWN_CONFIG.cellSize;
}

export function getZoomFactor(scale = "mech") {
  return SCALE_ZOOM[normalizeScale(scale)] ?? 1;
}

export function getCurrentInteractionScale(state) {
  return normalizeScale(
    state.camera?.zoomScale ??
    state.focus?.scale ??
    "pilot"
  );
}

function rotateSceneCoordContinuous(x, y, width, height, rotation = 0) {
  switch ((((rotation % 4) + 4) % 4)) {
    case 0:
      return { x, y };
    case 1:
      return { x: height - y, y: x };
    case 2:
      return { x: width - x, y: height - y };
    case 3:
      return { x: y, y: width - x };
    default:
      return { x, y };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
