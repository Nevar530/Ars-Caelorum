import { getUnitById } from "../mechs.js";
import { projectTileCenter } from "../render/projection.js";
import { getUnitCenterPoint } from "../scale/scaleMath.js";
import { getUnitSupportElevation } from "../render/renderSceneMath.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function ensureMarkerState(state) {
  if (!Array.isArray(state.turn.combatTextMarkers)) {
    state.turn.combatTextMarkers = [];
  }
}

function getToneStyle(tone) {
  switch (tone) {
    case "hit":
      return { fill: "#ffffff", stroke: "#111111" };
    case "miss":
      return { fill: "#ff3b30", stroke: "#000000" };
    case "shield":
      return { fill: "#3aa0ff", stroke: "#000000" };
    case "core":
      return { fill: "#ffffff", stroke: "#000000" };
    case "disabled":
      return { fill: "#c66bff", stroke: "#000000" };
    default:
      return { fill: "#ffffff", stroke: "#000000" };
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
  const worldUi = refs?.worldUi;
  const markers = state.turn.combatTextMarkers ?? [];

  if (overlay) {
    overlay.innerHTML = "";
    overlay.classList.remove("is-visible");
    overlay.classList.add("is-clickthrough");
  }

  if (!worldUi) return;

  const existing = worldUi.querySelector('[data-role="combat-marker-layer"]');
  if (existing) existing.remove();

  if (!markers.length) {
    return;
  }

  const layer = document.createElementNS(SVG_NS, "g");
  layer.setAttribute("data-role", "combat-marker-layer");
  layer.setAttribute("pointer-events", "none");

  const stackCounts = new Map();

  for (const marker of markers) {
    const unit = getUnitById(state.units, marker.targetId);
    if (!unit) continue;

    const currentStack = stackCounts.get(marker.targetId) ?? 0;
    stackCounts.set(marker.targetId, currentStack + 1);

    const projected = projectMarkerAnchor(state, unit, currentStack);
    const style = getToneStyle(marker.tone);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(projected.x));
    text.setAttribute("y", String(projected.y));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", state.ui?.viewMode === "top" ? "18" : "20");
    text.setAttribute("font-weight", "900");
    text.setAttribute("letter-spacing", "0.08em");
    text.setAttribute("paint-order", "stroke fill");
    text.setAttribute("stroke-linejoin", "round");
    text.setAttribute("stroke-width", "5");
    text.setAttribute("stroke", style.stroke);
    text.setAttribute("fill", style.fill);
    text.textContent = marker.text;

    layer.appendChild(text);
  }

  worldUi.appendChild(layer);
}

function projectMarkerAnchor(state, unit, stackIndex = 0) {
  const stackOffset = stackIndex * 22;
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
      y: projected.y - 18 - stackOffset
    };
  }

  return {
    x: projected.x,
    y: projected.y - 34 - stackOffset
  };
}
