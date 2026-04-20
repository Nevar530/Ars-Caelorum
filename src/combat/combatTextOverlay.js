import { getUnitById } from "../mechs.js";
import { projectTileCenter } from "../render/projection.js";
import { getUnitCenterPoint } from "../scale/scaleMath.js";
import { getUnitSupportElevation } from "../render/renderSceneMath.js";

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
    const unit = getUnitById(state.units, marker.targetId);
    if (!unit) continue;

    const currentStack = stackCounts.get(marker.targetId) ?? 0;
    stackCounts.set(marker.targetId, currentStack + 1);

    const projected = projectMarkerAnchor(state, unit, currentStack);

    const pixelX =
      boardOffsetX + ((projected.x / viewBox.width) * boardRect.width);
    const pixelY =
      boardOffsetY + ((projected.y / viewBox.height) * boardRect.height);

    const el = document.createElement("div");
    el.textContent = marker.text;
    el.style.position = "absolute";
    el.style.left = `${pixelX}px`;
    el.style.top = `${pixelY}px`;
    el.style.transform = "translate(-50%, -100%)";
    el.style.padding = "0";
    el.style.borderRadius = "0";
    el.style.fontSize = "16px";
    el.style.fontWeight = "900";
    el.style.letterSpacing = "0.08em";
    el.style.textTransform = "uppercase";
    el.style.pointerEvents = "none";
    el.style.whiteSpace = "nowrap";
    el.style.border = "none";
    el.style.boxShadow = "none";
    el.style.background = "transparent";
    el.style.fontFamily = "inherit";
    el.style.textShadow = "0 0 2px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.7)";

    if (marker.tone === "hit") {
      el.style.color = "#7ef0b0";
    } else if (marker.tone === "miss") {
      el.style.color = "#ff8c8c";
    } else if (marker.tone === "shield") {
      el.style.color = "#6cc6ff";
    } else if (marker.tone === "core") {
      el.style.color = "#ffb05a";
    } else if (marker.tone === "disabled") {
      el.style.color = "#d0a4ff";
    } else {
      el.style.color = "#ffd65a";
    }

    overlay.appendChild(el);
  }
}

function projectMarkerAnchor(state, unit, stackIndex = 0) {
  const stackOffset = stackIndex * 18;
  const centerTile = getUnitCenterPoint(unit);
  const supportElevation = getUnitSupportElevation(state, unit) ?? 0;
  const projected = projectTileCenter(
    state,
    centerTile.x,
    centerTile.y,
    supportElevation
  );

  if (state.ui.viewMode === "top") {
    return {
      x: projected.x,
      y: projected.y - 10 - stackOffset
    };
  }

  return {
    x: projected.x,
    y: projected.y - 18 - stackOffset
  };
}
