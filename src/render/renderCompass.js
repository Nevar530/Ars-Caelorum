// src/render/renderCompass.js
//
// Fixed authored-isometric face helpers.
// Core truth uses world faces only: ne, se, sw, nw.
// The player camera uses a fixed authored-isometric view, so screen-left/screen-right
// are stable art-authoring faces.

export const WORLD_FACES = Object.freeze(["ne", "se", "sw", "nw"]);

const SCREEN_FACE_MAP = Object.freeze({
  left: "sw",
  right: "se"
});

export function normalizeWorldFace(face) {
  const value = String(face ?? "").trim().toLowerCase();
  return WORLD_FACES.includes(value) ? value : null;
}

export function getVisibleWorldFaces() {
  const visible = [SCREEN_FACE_MAP.left, SCREEN_FACE_MAP.right];
  const hidden = WORLD_FACES.filter((face) => !visible.includes(face));

  return { visible, hidden };
}

export function getWorldFaceForScreenSide(side = "left") {
  return SCREEN_FACE_MAP[String(side).toLowerCase()] ?? null;
}

export function getScreenSideForWorldFace(worldFace) {
  const normalizedFace = normalizeWorldFace(worldFace);
  if (!normalizedFace) return "hidden";
  if (normalizedFace === SCREEN_FACE_MAP.left) return "left";
  if (normalizedFace === SCREEN_FACE_MAP.right) return "right";
  return "hidden";
}
