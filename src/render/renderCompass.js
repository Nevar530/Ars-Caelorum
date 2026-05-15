// src/render/renderCompass.js
//
// Shared world-facing helpers for fixed authored isometric rendering.
// Core truth uses world faces only: ne, se, sw, nw.

export const WORLD_FACES = Object.freeze(["ne", "se", "sw", "nw"]);

const FIXED_SCREEN_FACE_MAP = Object.freeze({
  left: "sw",
  right: "se"
});

export function normalizeWorldFace(face) {
  const value = String(face ?? "").trim().toLowerCase();
  return WORLD_FACES.includes(value) ? value : null;
}

export function getWorldFaceForScreenSide(side = "left") {
  return FIXED_SCREEN_FACE_MAP[String(side).toLowerCase()] ?? null;
}
