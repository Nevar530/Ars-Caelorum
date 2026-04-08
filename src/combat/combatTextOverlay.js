import { MAP_CONFIG, RENDER_CONFIG } from "../config.js";
import { getTile, rotateCoord } from "../map.js";
import { getMechById } from "../mechs.js";

const TOPDOWN_CONFIG = {
  cellSize: 56
};

const CAMERA_CENTER = {
  isoX: 700,
  isoY: 320,
  topX: 700,
  topY: 360
};

function ensureMarkerState(state) {
  if (!Array.isArray(state.turn.combatTextMarkers)) {
    state.turn.combatTextMarkers = [];
  }
}

export function addCombatTextMarker(state, targetId, text, options = {}) {
  ensureMarkerState(state);

  state.turn.combatTextMarkers.push({
    id: `marker_${targetId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    targetId,
    text,
    tone: options.tone ?? "neutral"
  });
}

export function clearCombatTextMarkers(state) {
  ensureMarkerState(state);
  state.turn.combatTextMarkers = [];
}

export function renderCombatTextOverlay(state, refs) {
  ensureMarkerState(state);

  const overlay = refs?.combatOverlay;
  const board = refs?.board;

  if (!overlay || !board) return;

  const markers = state.turn.combatTextMarkers ?? [];

  overlay.innerHTML = "";

  if (!markers.length) {
    overlay.classList.remove("is-visible");
    overlay.classList.add("is-clickthrough");
    return;
  }

  overlay.classList.add("is-visible", "is-clickthrough");

  const boardRect = board.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const viewBox = board.viewBox?.baseVal ?? { width: 1400, height: 900 };

  const boardOffsetX = boardRect.left - overlayRect.left;
  const boardOffsetY = boardRect.top - overlayRect.top;

  const stackCounts = new Map();

  for (const marker of markers) {
    const mech = getMechById(state.mechs, marker.targetId);
    if (!mech) continue;

    const tile = getTile(state.map, mech.x, mech.y);
    if (!tile) continue;

    const currentStack = stackCounts.get(marker.targetId) ?? 0;
    stackCounts.set(marker.targetId, currentStack + 1);

    const projected = projectMarkerAnchor(
      state,
      mech.x,
      mech.y,
      tile.elevation,
      currentStack
    );

    const pixelX =
      boardOffsetX + ((projected.x / viewBox.width) * boardRect.width);
    const pixelY =
      boardOffsetY + ((projected.y / viewBox.height) * boardRect.height);

    const el = document.createElement("div");
    el.textContent = marker.text;
    el.style.position = "absolute";
    el.style.left = `${pixelX}px`;
    el.style.top = `${pixelY}px`;
    el.style.transform = "translate(-50%, -50%)";
    el.style.padding = "4px 10px";
    el.style.borderRadius = "999px";
    el.style.fontSize = "16px";
    el.style.fontWeight = "800";
    el.style.letterSpacing = "0.06em";
    el.style.textTransform = "uppercase";
    el.style.pointerEvents = "none";
    el.style.whiteSpace = "nowrap";
    el.style.border = "1px solid rgba(255,255,255,0.18)";
    el.style.boxShadow = "0 8px 20px rgba(0,0,0,0.35)";
    el.style.textShadow = "0 1px 2px rgba(0,0,0,0.55)";

    if (marker.tone === "hit") {
      el.style.background = "rgba(82, 208, 146, 0.92)";
      el.style.color = "#08120d";
    } else if (marker.tone === "miss") {
      el.style.background = "rgba(200, 77, 77, 0.92)";
      el.style.color = "#ffffff";
    } else if (marker.tone === "shield") {
      el.style.background = "rgba(74, 154, 255, 0.92)";
      el.style.color = "#08131f";
    } else if (marker.tone === "core") {
      el.style.background = "rgba(255, 170, 64, 0.92)";
      el.style.color = "#1c1207";
    } else if (marker.tone === "disabled") {
      el.style.background = "rgba(120, 86, 196, 0.94)";
      el.style.color = "#ffffff";
    } else {
      el.style.background = "rgba(240, 176, 0, 0.92)";
      el.style.color = "#17130a";
    }

    overlay.appendChild(el);
  }
}

function projectMarkerAnchor(state, x, y, elevation, stackIndex = 0) {
  const stackOffset = stackIndex * 26;

  if (state.ui.viewMode === "top") {
    const turns = normalizedTurns(state);
    const rotated = rotateCoord(
      x,
      y,
      MAP_CONFIG.mechWidth,
      MAP_CONFIG.mechHeight,
      turns
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
        10 -
        stackOffset
    };
  }

  const base = projectSceneBase(state, x, y, elevation);

  return {
    x: base.x + state.camera.offsetX,
    y: base.y + state.camera.offsetY - 34 - stackOffset
  };
}

function projectSceneBase(state, x, y, elevation) {
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

function isoProjectRaw(x, y, elevation) {
  return {
    x: (x - y) * (RENDER_CONFIG.isoTileWidth / 2),
    y:
      (x + y) * (RENDER_CONFIG.isoTileHeight / 2) -
      (elevation * RENDER_CONFIG.elevationStepPx)
  };
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function normalizedTurns(state) {
  return ((Math.round(state.camera.angle / 90) % 4) + 4) % 4;
}
