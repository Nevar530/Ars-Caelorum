import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import { getTile, getMapWidth, getMapHeight } from "../map.js";
import { getUnitById } from "../mechs.js";
import { getUnitFootprint, normalizeScale } from "../scale/scaleMath.js";

export const TOPDOWN_CONFIG = {
  minCellSize: 12,
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

  if (!state.camera.zoomScale) {
    state.camera.zoomScale = getCurrentInteractionScale(state);
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
}

export function updateCameraFraming(state, refs) {
  const currentScale = getCurrentInteractionScale(state);
  state.camera.zoomScale = currentScale;

  const viewport = getSceneViewport(refs);

  if (state.ui?.viewMode === "top") {
    applyBoardViewBox(refs, 0, 0, viewport.width, viewport.height);
    updateTopdownFit(state, viewport);
    state.camera.offsetX = 0;
    state.camera.offsetY = 0;
    return;
  }

  state.camera.offsetX = 0;
  state.camera.offsetY = 0;
  updateIsoViewBox(state, refs, viewport);
}

function updateTopdownFit(state, viewport) {
  const mapWidth = Math.max(1, getMapWidth(state.map));
  const mapHeight = Math.max(1, getMapHeight(state.map));
  const target = getCameraTarget(state);

  const usableWidth = Math.max(200, viewport.width - (TOPDOWN_CONFIG.padding * 2));
  const usableHeight = Math.max(200, viewport.height - (TOPDOWN_CONFIG.padding * 2));

  let desiredCols = mapWidth;
  let desiredRows = mapHeight;

  if (target.unit) {
    const radius = getCameraRadius(target.unit);
    const footprint = getUnitFootprint(target.unit);
    desiredCols = Math.max(8, (radius * 2) + footprint.width + 4);
    desiredRows = Math.max(8, (radius * 2) + footprint.height + 4);
  }

  const cellSize = clamp(
    Math.floor(Math.min(usableWidth / desiredCols, usableHeight / desiredRows)),
    TOPDOWN_CONFIG.minCellSize,
    TOPDOWN_CONFIG.maxCellSize
  );

  state.camera.topdownCellSize = cellSize;

  const mapPixelWidth = mapWidth * cellSize;
  const mapPixelHeight = mapHeight * cellSize;

  if (!target.unit) {
    state.camera.topdownOriginX = Math.floor((viewport.width - mapPixelWidth) / 2);
    state.camera.topdownOriginY = Math.floor((viewport.height - mapPixelHeight) / 2);
    return;
  }

  let originX = Math.round((viewport.width / 2) - ((target.x + 0.5) * cellSize));
  let originY = Math.round((viewport.height / 2) - ((target.y + 0.5) * cellSize));

  if (mapPixelWidth <= viewport.width) {
    originX = Math.floor((viewport.width - mapPixelWidth) / 2);
  } else {
    originX = clamp(originX, viewport.width - mapPixelWidth, 0);
  }

  if (mapPixelHeight <= viewport.height) {
    originY = Math.floor((viewport.height - mapPixelHeight) / 2);
  } else {
    originY = clamp(originY, viewport.height - mapPixelHeight, 0);
  }

  state.camera.topdownOriginX = originX;
  state.camera.topdownOriginY = originY;
}

function updateIsoViewBox(state, refs, viewport) {
  const mapWidth = Math.max(1, getMapWidth(state.map));
  const mapHeight = Math.max(1, getMapHeight(state.map));
  const target = getCameraTarget(state);
  const interactionRadius = target.unit ? getCameraRadius(target.unit) : 8;
  const footprint = target.unit ? getUnitFootprint(target.unit) : { width: 1, height: 1 };
  const supportElevation = Number(getTile(state.map, target.x, target.y)?.elevation ?? 0);

  const spanX = interactionRadius + Math.ceil(footprint.width / 2) + 2;
  const spanY = interactionRadius + Math.ceil(footprint.height / 2) + 2;

  const rawBounds = getIsoTargetFrameBounds(
    state,
    target.x,
    target.y,
    supportElevation,
    spanX,
    spanY,
    mapWidth,
    mapHeight
  );

  let frameWidth = rawBounds.maxX - rawBounds.minX;
  let frameHeight = rawBounds.maxY - rawBounds.minY;
  const aspect = viewport.width / viewport.height;

  if ((frameWidth / frameHeight) > aspect) {
    frameHeight = frameWidth / aspect;
  } else {
    frameWidth = frameHeight * aspect;
  }

  let viewBoxX = ((rawBounds.minX + rawBounds.maxX) / 2) - (frameWidth / 2);
  let viewBoxY = ((rawBounds.minY + rawBounds.maxY) / 2) - (frameHeight / 2);

  const mapBounds = getMapScreenBoundsRaw(state);
  const xLimits = getViewBoxLimits(mapBounds.minX - 80, mapBounds.maxX + 80, frameWidth);
  const yLimits = getViewBoxLimits(mapBounds.minY - 140, mapBounds.maxY + 80, frameHeight);

  viewBoxX = clamp(viewBoxX, xLimits.min, xLimits.max);
  viewBoxY = clamp(viewBoxY, yLimits.min, yLimits.max);

  applyBoardViewBox(refs, viewBoxX, viewBoxY, frameWidth, frameHeight);
}

function getIsoTargetFrameBounds(state, focusX, focusY, supportElevation, spanX, spanY, mapWidth, mapHeight) {
  const corners = [
    projectIsoRaw(focusX - spanX, focusY - spanY, 0, state.rotation, 1, mapWidth, mapHeight),
    projectIsoRaw(focusX + spanX + 1, focusY - spanY, 0, state.rotation, 1, mapWidth, mapHeight),
    projectIsoRaw(focusX + spanX + 1, focusY + spanY + 1, 0, state.rotation, 1, mapWidth, mapHeight),
    projectIsoRaw(focusX - spanX, focusY + spanY + 1, 0, state.rotation, 1, mapWidth, mapHeight)
  ];

  const minX = Math.min(...corners.map((point) => point.x)) - 96;
  const maxX = Math.max(...corners.map((point) => point.x)) + 96;
  const topY = Math.min(...corners.map((point) => point.y)) - (((supportElevation + 8) * RENDER_CONFIG.elevationStepPx) + 120);
  const bottomY = Math.max(...corners.map((point) => point.y)) + RENDER_CONFIG.isoTileHeight + 96;

  return {
    minX,
    maxX,
    minY: topY,
    maxY: bottomY
  };
}

export function getSceneViewport(_refs) {
  return {
    width: Number(RENDER_CONFIG.sceneWidth ?? 1400),
    height: Number(RENDER_CONFIG.sceneHeight ?? 900)
  };
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
  const mapWidth = Math.max(1, getMapWidth(state.map) || MAP_CONFIG.width);
  const mapHeight = Math.max(1, getMapHeight(state.map) || MAP_CONFIG.height);

  if (state.ui?.viewMode === "top") {
    const corners = [
      projectTopDown(state, 0, 0),
      projectTopDown(state, mapWidth, 0),
      projectTopDown(state, mapWidth, mapHeight),
      projectTopDown(state, 0, mapHeight)
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
    { x: mapWidth, y: 0 },
    { x: 0, y: mapHeight },
    { x: mapWidth, y: mapHeight }
  ];

  const points = [];

  for (const corner of corners) {
    points.push(projectIsoRaw(corner.x, corner.y, 0, state.rotation, 1, mapWidth, mapHeight));
    points.push(projectIsoRaw(corner.x, corner.y, MAP_CONFIG.maxElevation + 8, state.rotation, 1, mapWidth, mapHeight));
  }

  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)) + RENDER_CONFIG.isoTileHeight
  };
}

export function projectScene(state, x, y, elevation = 0, size = 1) {
  if (state.ui?.viewMode === "top") {
    return projectTopDown(state, x, y);
  }

  return projectIso(state, x, y, elevation, size);
}

export function projectIso(state, x, y, elevation = 0, size = 1) {
  const mapWidth = Math.max(1, getMapWidth(state.map) || MAP_CONFIG.width);
  const mapHeight = Math.max(1, getMapHeight(state.map) || MAP_CONFIG.height);
  const raw = projectIsoRaw(x, y, elevation, state.rotation, size, mapWidth, mapHeight);

  return {
    x: raw.x + (state.camera?.offsetX ?? 0),
    y: raw.y + (state.camera?.offsetY ?? 0)
  };
}

export function projectIsoRaw(x, y, elevation = 0, rotation = 0, _size = 1, boardWidth = MAP_CONFIG.width, boardHeight = MAP_CONFIG.height) {
  const rotated = rotateSceneCoordContinuous(x, y, boardWidth, boardHeight, rotation);

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

export function projectTopDownRect(state, x, y, width = 1, height = 1) {
  const origin = projectTopDown(state, x, y);
  const cellSize = getTopdownCellSize(state);

  return {
    x: origin.x,
    y: origin.y,
    width: width * cellSize,
    height: height * cellSize
  };
}

export function getSceneSortKey(state, x, y, elevation = 0) {
  const mapWidth = Math.max(1, getMapWidth(state.map) || MAP_CONFIG.width);
  const mapHeight = Math.max(1, getMapHeight(state.map) || MAP_CONFIG.height);
  const rotated = rotateSceneCoordContinuous(x, y, mapWidth, mapHeight, state.rotation);

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
  return normalizeScale(
    state.camera?.zoomScale ??
    state.focus?.scale ??
    "pilot"
  );
}

function getCameraTarget(state) {
  const units = Array.isArray(state?.units) ? state.units : [];
  const activeUnit = getUnitById(units, state?.turn?.activeUnitId ?? null);
  const selectedUnit = getUnitById(units, state?.selection?.unitId ?? null);
  const unit = activeUnit ?? selectedUnit ?? null;

  if (unit) {
    return {
      unit,
      x: Number(unit.x ?? 0),
      y: Number(unit.y ?? 0)
    };
  }

  return {
    unit: null,
    x: Number(state?.focus?.x ?? 0),
    y: Number(state?.focus?.y ?? 0)
  };
}

function getCameraRadius(unit) {
  const move = Math.max(1, Number(unit?.move ?? 0));
  const scale = normalizeScale(unit?.scale ?? unit?.unitType ?? "mech");

  if (scale === "pilot") {
    return move + Math.floor(move / 2);
  }

  if (scale === "structure") {
    return Math.max(4, move);
  }

  return Math.max(6, move * 2);
}

function getViewBoxLimits(minEdge, maxEdge, span) {
  let min = minEdge;
  let max = maxEdge - span;

  if (min > max) {
    const center = (min + max) / 2;
    min = center;
    max = center;
  }

  return { min, max };
}

function applyBoardViewBox(refs, x, y, width, height) {
  const board = refs?.board;
  if (!board) return;

  board.setAttribute(
    "viewBox",
    `${Math.round(x)} ${Math.round(y)} ${Math.max(1, Math.round(width))} ${Math.max(1, Math.round(height))}`
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
