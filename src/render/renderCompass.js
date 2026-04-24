// src/render/renderCompass.js
//
// Shared world-facing helpers for camera-aware rendering.
// Core truth uses world faces only: ne, se, sw, nw.
// Renderers may ask which world face is currently visible on screen-left/screen-right.

export const WORLD_FACES = Object.freeze(["ne", "se", "sw", "nw"]);

const BASE_SCREEN_FACE_MAP = Object.freeze({
  left: "nw",
  right: "se"
});

export function normalizeRotation(rotation = 0) {
  const value = Number(rotation ?? 0);
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 4) + 4) % 4;
}

export function normalizeWorldFace(face) {
  const value = String(face ?? "").trim().toLowerCase();
  return WORLD_FACES.includes(value) ? value : null;
}

export function rotateWorldFace(face, rotation = 0) {
  const normalizedFace = normalizeWorldFace(face);
  if (!normalizedFace) return null;

  const index = WORLD_FACES.indexOf(normalizedFace);
  const rot = normalizeRotation(rotation);
  return WORLD_FACES[(index + rot) % WORLD_FACES.length];
}

export function getVisibleWorldFaces(rotation = 0) {
  const left = getWorldFaceForScreenSide(rotation, "left");
  const right = getWorldFaceForScreenSide(rotation, "right");
  const visible = [left, right].filter(Boolean);
  const hidden = WORLD_FACES.filter((face) => !visible.includes(face));

  return { visible, hidden };
}

export function getWorldFaceForScreenSide(rotation = 0, side = "left") {
  const baseFace = BASE_SCREEN_FACE_MAP[String(side).toLowerCase()];
  if (!baseFace) return null;
  return rotateWorldFace(baseFace, rotation);
}

export function getScreenSideForWorldFace(rotation = 0, worldFace) {
  const normalizedFace = normalizeWorldFace(worldFace);
  if (!normalizedFace) return "hidden";

  const left = getWorldFaceForScreenSide(rotation, "left");
  if (normalizedFace === left) return "left";

  const right = getWorldFaceForScreenSide(rotation, "right");
  if (normalizedFace === right) return "right";

  return "hidden";
}
