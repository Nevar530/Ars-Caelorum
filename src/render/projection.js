// src/render/projection.js

import {
  CAMERA_ZOOM_CONFIG,
  MAP_CONFIG,
  RENDER_CONFIG
} from "../config.js";
import { getTile, getTileFootElevation } from "../map.js";
import { normalizeScale, getResolutionBoardSize } from "../scale/scaleMath.js";

export const TOPDOWN_CONFIG = {
  minCellSize: 10,
  maxCellSize: 64,
  padding: 24,
  cellSize: Math.round(RENDER_CONFIG.isoTileWidth / 2)
};

export const SCALE_ZOOM = {
  mech: 1,
  pilot: 1
};

export const CAMERA_CENTER = {
  isoX: 700,
  isoY: 320
};

export const LOS_HEIGHT_PROFILES = {
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

  if (typeof state.camera.topdownCellSize !== "number") {
    state.camera.topdownCellSize = TOPDOWN_CONFIG.cellSize;
  }

  if (typeof state.camera.topdownOriginX !== "number") {
    state.camera.topdownOriginX = 0;
  }

  if (typeof state.camera.topdownOriginY !== "number") {
    state.camera.topdownOriginY = 0;
  }

  const zoomMode = isValidZoomLevel(state.camera.zoomMode) ? state.camera.zoomMode : null;
  const zoomLevel = isValidZoomLevel(state.camera.zoomLevel) ? state.camera.zoomLevel : null;
  const zoomScale = isValidZoomLevel(state.camera.zoomScale) ? state.camera.zoomScale : null;
  const resolved = zoomMode ?? zoomLevel ?? zoomScale ?? resolveDefaultZoomLevel(state);

  // Keep all three fields aligned because older code still writes zoomMode/zoomScale.
  state.camera.zoomMode = resolved;
  state.camera.zoomLevel = resolved;
  state.camera.zoomScale = resolved;
}

export function updateCameraFraming(state, refs) {
  ensureCameraState(state);

  const zoomLevel = getCurrentZoomLevel(state);
  const viewport = getSceneViewport(refs);
  const svg = refs?.worldScene?.ownerSVGElement ?? refs?.board ?? null;

  state.camera.offsetX = 0;
  state.camera.offsetY = 0;

  if (state.ui?.viewMode === "top") {
    updateTopdownFraming(state, viewport, zoomLevel);
    applySvgViewBox(svg, 0, 0, viewport.width, viewport.height);
    return;
  }

  const bounds = getIsoTargetFrameBounds(state, zoomLevel);
  applySvgViewBox(svg, bounds.minX, bounds.minY, bounds.width, bounds.height);
}

function updateTopdownFraming(state, viewport, zoomLevel) {
  const board = getResolutionBoardSize("base", MAP_CONFIG);
  const preset = CAMERA_ZOOM_CONFIG.topdown?.[zoomLevel] ?? CAMERA_ZOOM_CONFIG.topdown.map;

  if (!preset || preset.cols == null || preset.rows == null) {
    const usableWidth = Math.max(200, viewport.width - (TOPDOWN_CONFIG.padding * 2));
    const usableHeight = Math.max(200, viewport.height - (TOPDOWN_CONFIG.padding * 2));

    const cellSizeByWidth = usableWidth / board.width;
    const cellSizeByHeight = usableHeight / board.height;

    const cellSize = clamp(
      Math.floor(Math.min(cellSizeByWidth, cellSizeByHeight)),
      TOPDOWN_CONFIG.minCellSize,
      TOPDOWN_CONFIG.maxCellSize
    );

    state.camera.topdownCellSize = cellSize;

    const mapPixelWidth = board.width * cellSize;
    const mapPixelHeight = board.height * cellSize;

    state.camera.topdownOriginX = Math.floor((viewport.width - mapPixelWidth) / 2);
    state.camera.topdownOriginY = Math.floor((viewport.height - mapPixelHeight) / 2);
    return;
  }

  const cols = Math.max(1, Number(preset.cols));
  const rows = Math.max(1, Number(preset.rows));
  const cellSize = clamp(
    Math.floor(Math.min(viewport.width / cols, viewport.height / rows)),
    TOPDOWN_CONFIG.minCellSize,
    TOPDOWN_CONFIG.maxCellSize
  );

  const focus = getCameraFocusTarget(state, zoomLevel);

  state.camera.topdownCellSize = cellSize;
  state.camera.topdownOriginX = Math.floor((viewport.width / 2) - ((focus.x + 0.5) * cellSize));
  state.camera.topdownOriginY = Math.floor((viewport.height / 2) - ((focus.y + 0.5) * cellSize));
}

function applySvgViewBox(svg, x, y, width, height) {
  if (!svg) return;

  const safeWidth = Math.max(1, Number(width));
  const safeHeight = Math.max(1, Number(height));
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;

  svg.setAttribute("viewBox", `${safeX} ${safeY} ${safeWidth} ${safeHeight}`);
}

function getIsoTargetFrameBounds(state, zoomLevel) {
  const preset = CAMERA_ZOOM_CONFIG.iso?.[zoomLevel] ?? CAMERA_ZOOM_CONFIG.iso?.mech ?? {};
  const focus = getCameraFocusTarget(state, zoomLevel);

  const spanX = Math.max(0.1, Number(preset.spanX ?? 2));
  const spanY = Math.max(0.1, Number(preset.spanY ?? 2));
  const padPxX = Math.max(0, Number(preset.padPxX ?? 24));
  const padPxTop = Math.max(0, Number(preset.padPxTop ?? 36));
  const padPxBottom = Math.max(0, Number(preset.padPxBottom ?? 30));
  const liftTiles = Number(preset.liftTiles ?? 0);

  const tile = getTile(state.map, focus.x, focus.y);
  const supportElevation = tile ? getTileFootElevation(tile) : 0;

  const center = projectIsoRaw(
    focus.x + 0.5,
    focus.y + 0.5,
    supportElevation + liftTiles,
    state.rotation,
    1
  );

  const xNeg = projectIsoRaw(focus.x + 0.5 - spanX, focus.y + 0.5, supportElevation, state.rotation, 1);
  const xPos = projectIsoRaw(focus.x + 0.5 + spanX, focus.y + 0.5, supportElevation, state.rotation, 1);
  const yNeg = projectIsoRaw(focus.x + 0.5, focus.y + 0.5 - spanY, supportElevation, state.rotation, 1);
  const yPos = projectIsoRaw(focus.x + 0.5, focus.y + 0.5 + spanY, supportElevation, state.rotation, 1);

  const halfWidth =
    Math.max(
      Math.abs(xNeg.x - center.x),
      Math.abs(xPos.x - center.x),
      Math.abs(yNeg.x - center.x),
      Math.abs(yPos.x - center.x)
    ) + padPxX;

  const halfHeightCore =
    Math.max(
      Math.abs(xNeg.y - center.y),
      Math.abs(xPos.y - center.y),
      Math.abs(yNeg.y - center.y),
      Math.abs(yPos.y - center.y)
    );

  const minX = center.x - halfWidth;
  const maxX = center.x + halfWidth;
  const minY = center.y - halfHeightCore - padPxTop;
  const maxY = center.y + halfHeightCore + padPxBottom;

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function getCameraFocusTarget(state, zoomLevel) {
  const activeUnit = getActiveUnit(state);
  const focus = {
    x: Number(state?.focus?.x ?? activeUnit?.x ?? 0),
    y: Number(state?.focus?.y ?? activeUnit?.y ?? 0)
  };

  if (!activeUnit) {
    return focus;
  }

  const active = {
    x: Number(activeUnit.x ?? 0),
    y: Number(activeUnit.y ?? 0)
  };

  const preset =
    state.ui?.viewMode === "top"
      ? (CAMERA_ZOOM_CONFIG.topdown?.[zoomLevel] ?? {})
      : (CAMERA_ZOOM_CONFIG.iso?.[zoomLevel] ?? {});

  const deadzone = Math.max(0, Number(preset.followDeadzoneTiles ?? 0));

  // If focus moves a few tiles away from the active unit, let the camera follow it.
  // Otherwise keep the camera anchored to the active unit.
  if (
    Math.abs(focus.x - active.x) > deadzone ||
    Math.abs(focus.y - active.y) > deadzone
  ) {
    return focus;
  }

  return active;
}

function getActiveUnit(state) {
  const activeId = state.turn?.activeUnitId ?? state.selection?.unitId ?? null;
  if (!activeId) return null;

  const units = Array.isArray(state.units) ? state.units : [];
  return units.find((unit) => unit.instanceId === activeId) ?? null;
}

function resolveDefaultZoomLevel(state) {
  const scale = getCurrentInteractionScale(state);
  if (!state?.turn?.combatStarted) return "map";
  if (scale === "pilot") return "pilot";
  return "mech";
}

function isValidZoomLevel(value) {
  return CAMERA_ZOOM_CONFIG.levels.includes(value);
}

function normalizeZoomLevel(zoomLevel, state) {
  if (isValidZoomLevel(zoomLevel)) {
    return zoomLevel;
  }

  if (isValidZoomLevel(state?.camera?.zoomMode)) {
    return state.camera.zoomMode;
  }

  if (isValidZoomLevel(state?.camera?.zoomScale)) {
    return state.camera.zoomScale;
  }

  return resolveDefaultZoomLevel(state);
}

export function getCurrentZoomLevel(state) {
  const baseZoomLevel = normalizeZoomLevel(state?.camera?.zoomLevel, state);
  const zoomLevel = getEffectiveZoomLevelForPhase(state, baseZoomLevel);

  if (state?.camera) {
    // Keep the stored camera selection stable, but let the rendered zoom
    // step out one level during action phase for readability.
    state.camera.zoomMode = baseZoomLevel;
    state.camera.zoomLevel = baseZoomLevel;
    state.camera.zoomScale = baseZoomLevel;
  }

  return zoomLevel;
}

function getEffectiveZoomLevelForPhase(state, zoomLevel) {
  if (!state?.turn?.combatStarted) return zoomLevel;
  if (state?.turn?.phase !== "action") return zoomLevel;

  switch (zoomLevel) {
    case "pilot":
      return "mech";
    case "mech":
      return "map";
    default:
      return zoomLevel;
  }
}

export function getSceneViewport(refs) {
  const svg = refs?.worldScene?.ownerSVGElement ?? refs?.board ?? null;
  const width = svg?.clientWidth || RENDER_CONFIG.sceneWidth;
  const height = svg?.clientHeight || RENDER_CONFIG.sceneHeight;

  return { width, height };
}

export function getCameraOffsetLimits(_rawBounds, _viewport) {
  return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
}

export function getMapScreenBoundsRaw(state) {
  const board = getResolutionBoardSize("base", MAP_CONFIG);

  if (state.ui?.viewMode === "top") {
    const corners = [
      projectTopDown(state, 0, 0),
      projectTopDown(state, board.width, 0),
      projectTopDown(state, board.width, board.height),
      projectTopDown(state, 0, board.height)
    ];

    return {
      minX: Math.min(...corners.map((p) => p.x)),
      maxX: Math.max(...corners.map((p) => p.x)),
      minY: Math.min(...corners.map((p) => p.y)),
      maxY: Math.max(...corners.map((p) => p.y))
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
    points.push(projectIsoRaw(corner.x, corner.y, MAP_CONFIG.maxElevation + 4, state.rotation, 1));
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
  const cellSize = getTopdownCellSize(state);
  const originX = state.camera?.topdownOriginX ?? 0;
  const originY = state.camera?.topdownOriginY ?? 0;

  return {
    x: originX + (x * cellSize),
    y: originY + (y * cellSize)
  };
}

export function getSceneSortKey(state, x, y, elevation = 0) {
  const board = getResolutionBoardSize("base", MAP_CONFIG);
  const rotated = rotateSceneCoordContinuous(x, y, board.width, board.height, state.rotation);

  if (state.ui?.viewMode === "top") {
    return (y * 1000) + x;
  }

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
    return projectTopDown(state, x + 0.5, y + 0.5);
  }

  const projected = projectIso(state, x, y, height, 1);

  return {
    x: projected.x,
    y: projected.y + (RENDER_CONFIG.isoTileHeight / 2)
  };
}

export function projectTileCenter(state, x, y, elevation = 0) {
  if (state.ui?.viewMode === "top") {
    return projectTopDown(state, x + 0.5, y + 0.5);
  }

  const projected = projectIso(state, x, y, elevation, 1);

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

export function getTopdownCellSize(state) {
  return state?.camera?.topdownCellSize ?? TOPDOWN_CONFIG.cellSize;
}

export function getZoomFactor(scale = "mech") {
  return SCALE_ZOOM[normalizeScale(scale)] ?? 1;
}

export function getCurrentInteractionScale(state) {
  const activeUnit = getActiveUnit(state);

  return normalizeScale(
    activeUnit?.scale ??
    state?.focus?.scale ??
    "pilot"
  );
}

function rotateSceneCoordContinuous(x, y, width, height, rotation = 0) {
  const rot = ((rotation % 4) + 4) % 4;

  switch (rot) {
    case 1:
      return { x: height - y, y: x };
    case 2:
      return { x: width - x, y: height - y };
    case 3:
      return { x: y, y: width - x };
    case 0:
    default:
      return { x, y };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
