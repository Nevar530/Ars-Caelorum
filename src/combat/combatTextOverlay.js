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

function projectMarkerAnchor(state, unit, stackIndex = 0) {
  const stackOffset = stackIndex * 26;
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
    y: projected.y - 34 - stackOffset
  };
}
