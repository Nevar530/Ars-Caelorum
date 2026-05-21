// src/ui/interactPrompt.js
//
// Small map-space interaction affordance for story maps.
// It only appears when the active player body is close enough to a valid interact trigger.

import { getActiveActor, getActiveBody, getControlledBodyForPilot } from "../actors/actorResolver.js";
import { getTile, getTileRenderElevation } from "../map.js";
import { isStoryMode } from "../mode/mapMode.js";
import { projectScene } from "../render/projection.js";
import { svgEl, makeText } from "../utils.js";

const INTERACT_PRESETS = new Set([
  "load_map",
  "change_unit_stat",
  "complete_objective",
  "end_mission",
  "start_dialogue",
  "open_menu_tab",
  "open_context_screen",
  "run_logic"
]);

export function drawInteractPrompt(state, parent) {
  const prompt = getCurrentInteractPrompt(state);
  if (!prompt || !parent) return false;

  const projected = projectScene(state, prompt.x + 0.5, prompt.y + 0.5, prompt.elevation, 1);
  const offsetY = state?.ui?.viewMode === "top" ? -18 : -34;
  const label = prompt.label || "INTERACT";

  const group = svgEl("g");
  group.setAttribute("class", "interact-prompt");
  group.setAttribute("transform", `translate(${Math.round(projected.x)}, ${Math.round(projected.y + offsetY)})`);

  const text = `[ENTER] ${label}`;
  const width = Math.max(72, Math.min(132, 42 + (text.length * 6)));
  const bg = svgEl("rect");
  bg.setAttribute("x", String(-width / 2));
  bg.setAttribute("y", "-16");
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", "18");
  bg.setAttribute("rx", "2");
  bg.setAttribute("class", "interact-prompt-bg");
  group.appendChild(bg);

  const marker = svgEl("path");
  marker.setAttribute("d", "M -4 8 L 0 14 L 4 8 Z");
  marker.setAttribute("class", "interact-prompt-caret");
  group.appendChild(marker);

  const textEl = makeText(0, -4, text, "interact-prompt-text");
  textEl.setAttribute("text-anchor", "middle");
  group.appendChild(textEl);

  parent.appendChild(group);
  return true;
}

export function getCurrentInteractPrompt(state) {
  if (!isStoryMode(state)) return null;
  if (state?.ui?.gameMenu?.open || state?.ui?.dialogue?.active || state?.mission?.result) return null;

  const actor = getActiveActor(state) ?? getFirstPlayablePilot(state);
  const body = getActiveBody(state) ?? (actor ? getControlledBodyForPilot(state, actor) : null) ?? actor;
  if (!actor || !body) return null;

  const candidates = getInteractCandidates(state, body);
  if (!candidates.length) return null;

  candidates.sort((a, b) => a.distance - b.distance || a.priority - b.priority || a.id.localeCompare(b.id));
  return candidates[0];
}

function getFirstPlayablePilot(state) {
  return (Array.isArray(state?.units) ? state.units : []).find((unit) => {
    if (unit?.unitType !== "pilot") return false;
    if (unit?.controlType !== "PC") return false;
    return String(unit?.status ?? "operational") !== "disabled";
  }) ?? null;
}

function getInteractCandidates(state, sourceUnit) {
  const triggers = Array.isArray(state?.map?.triggers) ? state.map.triggers : [];
  const out = [];
  const sourceX = Number(sourceUnit?.x);
  const sourceY = Number(sourceUnit?.y);
  if (!Number.isInteger(sourceX) || !Number.isInteger(sourceY)) return out;

  for (const trigger of triggers) {
    if (!trigger?.id) continue;
    if (trigger.type !== "onInteract" && trigger.type !== "onUnitInteract") continue;
    if (!INTERACT_PRESETS.has(trigger.preset)) continue;
    if (isOnceTriggerAlreadyFired(state, trigger)) continue;
    if (!doesTeamMatch(trigger.team ?? "player", sourceUnit.team ?? "player")) continue;

    if (trigger.type === "onUnitInteract") {
      const candidate = getUnitInteractCandidate(state, trigger, sourceUnit, sourceX, sourceY);
      if (candidate) out.push(candidate);
      continue;
    }

    const tileCandidates = getTileInteractCandidates(state, trigger, sourceX, sourceY);
    out.push(...tileCandidates);
  }

  return out;
}

function getTileInteractCandidates(state, trigger, sourceX, sourceY) {
  const out = [];
  const range = Math.max(0, Math.trunc(Number(trigger?.interactionRange ?? 0) || 0));
  for (const tile of Array.isArray(trigger?.tiles) ? trigger.tiles : []) {
    const x = Math.trunc(Number(tile?.x));
    const y = Math.trunc(Number(tile?.y));
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    const distance = Math.abs(sourceX - x) + Math.abs(sourceY - y);
    if (distance > range) continue;
    out.push({
      id: String(trigger.id),
      x,
      y,
      elevation: getTileElevation(state, x, y),
      distance,
      priority: 10,
      label: getTriggerPromptLabel(trigger, "INTERACT")
    });
  }
  return out;
}

function getUnitInteractCandidate(state, trigger, sourceUnit, sourceX, sourceY) {
  const targetUnitId = String(trigger?.targetUnitId ?? "").trim();
  if (!targetUnitId) return null;

  const target = (Array.isArray(state?.units) ? state.units : []).find((unit) => unit?.instanceId === targetUnitId || unit?.id === targetUnitId);
  if (!target) return null;
  if (target.instanceId === sourceUnit?.instanceId) return null;
  if (target.status === "disabled" || target.status === "destroyed") return null;

  const targetX = Number(target.x);
  const targetY = Number(target.y);
  if (!Number.isInteger(targetX) || !Number.isInteger(targetY)) return null;

  const range = Math.max(1, Math.trunc(Number(trigger?.interactionRange ?? 1) || 1));
  const distance = Math.abs(sourceX - targetX) + Math.abs(sourceY - targetY);
  if (distance > range) return null;

  return {
    id: String(trigger.id),
    x: targetX,
    y: targetY,
    elevation: getTileElevation(state, targetX, targetY),
    distance,
    priority: 0,
    label: getTriggerPromptLabel(trigger, trigger.preset === "start_dialogue" ? "TALK" : "INTERACT")
  };
}

function getTriggerPromptLabel(trigger, fallback) {
  const explicit = String(trigger?.interactLabel ?? trigger?.promptLabel ?? "").trim();
  if (explicit) return explicit.toUpperCase().slice(0, 18);
  if (trigger?.preset === "open_context_screen" || trigger?.preset === "open_menu_tab") return "INTERACT";
  return fallback;
}

function getTileElevation(state, x, y) {
  const tile = getTile(state?.map, x, y);
  return tile ? getTileRenderElevation(tile) : 0;
}

function isOnceTriggerAlreadyFired(state, trigger) {
  if (trigger?.once === false) return false;
  const mapId = String(state?.map?.id ?? state?.mission?.definition?.activeMapId ?? "map");
  const key = `${mapId}:${trigger.type}:${trigger.id}`;
  return Boolean(state?.mission?.triggerRuntime?.fired?.[key]);
}

function doesTeamMatch(expected, actual) {
  const cleanExpected = String(expected ?? "any").trim().toLowerCase();
  if (!cleanExpected || cleanExpected === "any" || cleanExpected === "all") return true;
  const cleanActual = String(actual ?? "player").trim().toLowerCase();
  return cleanExpected === cleanActual;
}
