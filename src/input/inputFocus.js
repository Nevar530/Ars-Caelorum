import { getUnitById } from "../mechs.js";
import { getUnitFootprint } from "../scale/scaleMath.js";

export function getActiveUnit(state) {
  const activeId = state.turn.activeUnitId ?? null;
  const units = state.units ?? [];
  return getUnitById(units, activeId);
}

export function getFocusStep(state) {
  const activeUnit = getActiveUnit(state);

  if (state.ui.mode === "move" && activeUnit) {
    const footprint = getUnitFootprint(activeUnit);

    if ((activeUnit.scale ?? activeUnit.unitType ?? "mech") === "mech") {
      return {
        dx: Math.max(1, footprint.width),
        dy: Math.max(1, footprint.height)
      };
    }
  }

  return { dx: 1, dy: 1 };
}

export function snapFocusToActiveMech(state) {
  snapFocusToActiveUnit(state);
}

export function snapFocusToActiveUnit(state) {
  const activeUnit = getActiveUnit(state);
  if (!activeUnit) return;

  state.focus.x = activeUnit.x;
  state.focus.y = activeUnit.y;
  state.focus.scale = activeUnit.scale ?? activeUnit.unitType ?? "mech";
  state.camera.zoomScale = activeUnit.scale ?? activeUnit.unitType ?? "mech";
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
