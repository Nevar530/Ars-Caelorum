import { getUnitById } from "../mechs.js";
import { getActiveBody } from "../actors/actorResolver.js";
import { CAMERA_ZOOM_CONFIG } from "../config.js";
import { normalizeScale } from "../scale/scaleMath.js";

export function getActiveUnit(state) {
  const activeBody = getActiveBody(state);
  if (activeBody) return activeBody;

  const activeId = state.turn.activeUnitId ?? null;
  const units = state.units ?? [];
  return getUnitById(units, activeId);
}


export function getDefaultZoomModeForUnit(unit) {
  return normalizeScale(unit?.scale ?? unit?.unitType ?? "mech");
}

export function getDefaultZoomModeForState(state) {
  const activeUnit = getActiveUnit(state);
  if (!state?.turn?.combatStarted || !activeUnit) return "map";
  return getDefaultZoomModeForUnit(activeUnit);
}

export function resetZoomToDefault(state) {
  const zoomMode = getDefaultZoomModeForState(state);
  state.camera.zoomMode = zoomMode;
  state.camera.zoomScale = zoomMode;
  return zoomMode;
}

export function stepZoomMode(state, direction = 0) {
  const levels = Array.isArray(CAMERA_ZOOM_CONFIG.levels) && CAMERA_ZOOM_CONFIG.levels.length
    ? CAMERA_ZOOM_CONFIG.levels
    : ["map", "mech", "pilot"];

  const current = String(state?.camera?.zoomMode ?? getDefaultZoomModeForState(state));
  const currentIndex = Math.max(0, levels.indexOf(current));
  const nextIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + direction));
  const nextMode = levels[nextIndex] ?? current;

  state.camera.zoomMode = nextMode;
  state.camera.zoomScale = nextMode;

  return nextMode;
}

export function getFocusStep(state) {
  const activeUnit = getActiveUnit(state);

  if (state.ui.mode === "move" && activeUnit) {
    return { dx: 1, dy: 1 };
  }

  return { dx: 1, dy: 1 };
}

export function snapFocusToActiveMech(state, options) {
  snapFocusToActiveUnit(state, options);
}

export function snapFocusToActiveUnit(state, options = {}) {
  const { resetZoom = true } = options;
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return;

  state.focus.x = activeUnit.x;
  state.focus.y = activeUnit.y;
  const unitScale = activeUnit.scale ?? activeUnit.unitType ?? "mech";
  state.focus.scale = unitScale;

  if (resetZoom) {
    state.camera.zoomMode = getDefaultZoomModeForUnit(activeUnit);
  }

  state.camera.zoomScale = state.camera.zoomMode ?? unitScale;
}

export function getBoardDeltaFromScreenDirection(rotation, direction, step = { dx: 1, dy: 1 }) {
  const facing = getWorldFacingFromScreenDirection(rotation, direction);

  switch (facing) {
    case 0:
      return { dx: 0, dy: -step.dy };
    case 1:
      return { dx: step.dx, dy: 0 };
    case 2:
      return { dx: 0, dy: step.dy };
    case 3:
      return { dx: -step.dx, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}

export function getWorldFacingFromScreenDirection(rotation, direction) {
  const baseFacing = screenDirectionToBaseFacing(direction);
  if (baseFacing === null) return null;

  const rot = normalizeRotation(rotation);
  return ((baseFacing - rot) + 4) % 4;
}

export function screenDirectionToBaseFacing(direction) {
  switch (direction) {
    case "up":
      return 0;
    case "right":
      return 1;
    case "down":
      return 2;
    case "left":
      return 3;
    default:
      return null;
  }
}

export function normalizeRotation(value) {
  const n = Number.isFinite(value) ? value : 0;
  return ((n % 4) + 4) % 4;
}
