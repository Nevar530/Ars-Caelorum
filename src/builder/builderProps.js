// src/builder/builderProps.js
//
// Prop authoring: tile-footprint objects that can optionally block movement
// and LOS by height. This stays small and uses existing map truth.

import { getMapHeight, getMapWidth } from "../map.js";
import { getMapProps, getPropFootprintCells, getPropsAtTile, normalizeProp } from "../props/propRules.js";

const DEFAULT_PROP_SPRITES = ["prop_car_001.png"];

export function ensurePropToolSettings(builderState, appState = null) {
  if (!builderState) return null;
  if (!builderState.propTool) builderState.propTool = createDefaultPropTool(appState, builderState);

  const tool = builderState.propTool;
  tool.spriteId = sanitizeSprite(tool.spriteId, getBuilderPropSpriteOptions(appState, builderState)[0] ?? "prop_car_001.png");
  tool.footprintW = clampWhole(tool.footprintW, 1, 1, 12);
  tool.footprintH = clampWhole(tool.footprintH, 1, 1, 12);
  tool.height = clampNumber(tool.height, 1, 0, 99);
  tool.visualHeight = clampNumber(tool.visualHeight, tool.height, 0, 99);
  tool.blocksMovement = tool.blocksMovement !== false;
  tool.scale = clampNumber(tool.scale, 1, 0.1, 8);
  tool.mirrorX = Boolean(tool.mirrorX);
  tool.offsetX = clampWhole(tool.offsetX, 0, -2048, 2048);
  tool.offsetY = clampWhole(tool.offsetY, 0, -2048, 2048);
  tool.layer = normalizeLayer(tool.layer);
  tool.erase = Boolean(tool.erase);
  tool.select = Boolean(tool.select);
  tool.selectedPropId = String(tool.selectedPropId ?? "").trim();
  return tool;
}

export function updatePropToolFromFields(builderState, root, appState = null) {
  const tool = ensurePropToolSettings(builderState, appState);
  if (!tool || !root) return tool;

  const spriteId = root.querySelector('[data-builder-field="prop-sprite"]')?.value;
  const footprintW = root.querySelector('[data-builder-field="prop-footprint-w"]')?.value;
  const footprintH = root.querySelector('[data-builder-field="prop-footprint-h"]')?.value;
  const height = root.querySelector('[data-builder-field="prop-height"]')?.value;
  const visualHeight = root.querySelector('[data-builder-field="prop-visual-height"]')?.value;
  const blocksMovement = root.querySelector('[data-builder-field="prop-blocks-movement"]')?.checked;
  const scale = root.querySelector('[data-builder-field="prop-scale"]')?.value;
  const mirrorX = root.querySelector('[data-builder-field="prop-mirror-x"]')?.checked;
  const offsetX = root.querySelector('[data-builder-field="prop-offset-x"]')?.value;
  const offsetY = root.querySelector('[data-builder-field="prop-offset-y"]')?.value;
  const layer = root.querySelector('[data-builder-field="prop-layer"]')?.value;

  if (spriteId !== undefined) tool.spriteId = sanitizeSprite(spriteId, tool.spriteId);
  if (footprintW !== undefined) tool.footprintW = clampWhole(footprintW, tool.footprintW, 1, 12);
  if (footprintH !== undefined) tool.footprintH = clampWhole(footprintH, tool.footprintH, 1, 12);
  if (height !== undefined) tool.height = clampNumber(height, tool.height, 0, 99);
  if (visualHeight !== undefined) tool.visualHeight = clampNumber(visualHeight, tool.visualHeight, 0, 99);
  if (blocksMovement !== undefined) tool.blocksMovement = Boolean(blocksMovement);
  if (scale !== undefined) tool.scale = clampNumber(scale, tool.scale, 0.1, 8);
  if (mirrorX !== undefined) tool.mirrorX = Boolean(mirrorX);
  if (offsetX !== undefined) tool.offsetX = clampWhole(offsetX, tool.offsetX, -2048, 2048);
  if (offsetY !== undefined) tool.offsetY = clampWhole(offsetY, tool.offsetY, -2048, 2048);
  if (layer !== undefined) tool.layer = normalizeLayer(layer);

  return ensurePropToolSettings(builderState, appState);
}

export function resetPropToolToDefaults(builderState, appState = null) {
  if (!builderState) return null;
  builderState.propTool = createDefaultPropTool(appState, builderState);
  return ensurePropToolSettings(builderState, appState);
}

export function setPropEraseMode(builderState, enabled = true) {
  const tool = ensurePropToolSettings(builderState);
  if (!tool) return null;
  tool.erase = Boolean(enabled);
  if (tool.erase) tool.select = false;
  return tool;
}

export function isPropEraseModeActive(builderState) {
  return Boolean(builderState?.propTool?.erase);
}

export function setPropSelectMode(builderState, enabled = true) {
  const tool = ensurePropToolSettings(builderState);
  if (!tool) return null;
  tool.select = Boolean(enabled);
  if (tool.select) tool.erase = false;
  return tool;
}

export function isPropSelectModeActive(builderState) {
  return Boolean(builderState?.propTool?.select);
}

export function getSelectedPropId(builderState) {
  return String(builderState?.propTool?.selectedPropId ?? "").trim();
}

export function applyPropToolAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Prop editing is only available on builder-owned maps." };

  const tileX = Number(x);
  const tileY = Number(y);
  if (!Number.isInteger(tileX) || !Number.isInteger(tileY) || tileX < 0 || tileY < 0 || tileX >= getMapWidth(map) || tileY >= getMapHeight(map)) {
    return { ok: false, message: "No valid prop tile selected." };
  }

  const tool = ensurePropToolSettings(builderState, appState);
  ensurePropsArray(map);

  if (tool.erase) {
    const removed = erasePropsAtTile(map, tileX, tileY);
    if (removed > 0 && tool.selectedPropId && !findPropById(map, tool.selectedPropId)) tool.selectedPropId = "";
    builderState.dirty = removed > 0 || builderState.dirty;
    return { ok: true, message: removed > 0 ? `Erased ${removed} prop${removed === 1 ? "" : "s"}.` : "No prop under selected tile." };
  }

  if (tool.select) {
    return selectPropAtTile(builderState, appState, tileX, tileY);
  }

  const prop = {
    id: makePropId(map, tileX, tileY),
    spriteId: tool.spriteId,
    x: tileX,
    y: tileY,
    footprintW: tool.footprintW,
    footprintH: tool.footprintH,
    height: tool.height,
    visualHeight: tool.visualHeight,
    blocksMovement: tool.blocksMovement,
    scale: tool.scale,
    layer: tool.layer
  };

  if (tool.mirrorX) prop.mirrorX = true;
  if (tool.offsetX !== 0) prop.offsetX = tool.offsetX;
  if (tool.offsetY !== 0) prop.offsetY = tool.offsetY;

  map.props.push(prop);
  builderState.dirty = true;
  return { ok: true, message: `Placed prop ${prop.spriteId} at ${tileX}, ${tileY}.`, prop };
}

export function selectPropAtTile(builderState, appState, x, y) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Prop selection is only available on builder-owned maps." };

  const hits = getPropsAtTile(map, x, y);
  const prop = hits.length ? hits[hits.length - 1] : null;
  if (!prop) {
    return { ok: false, message: `No prop footprint at ${x}, ${y}.` };
  }

  const clean = normalizeProp(prop);
  if (!clean) return { ok: false, message: "Selected prop could not be read." };

  const tool = ensurePropToolSettings(builderState, appState);
  tool.selectedPropId = clean.id;
  tool.spriteId = clean.spriteId;
  tool.footprintW = clean.footprintW;
  tool.footprintH = clean.footprintH;
  tool.height = clean.height;
  tool.visualHeight = clean.visualHeight;
  tool.blocksMovement = clean.blocksMovement;
  tool.scale = clean.scale;
  tool.mirrorX = clean.mirrorX;
  tool.offsetX = clean.offsetX;
  tool.offsetY = clean.offsetY;
  tool.layer = clean.layer;
  tool.erase = false;

  return { ok: true, message: `Selected prop ${clean.id}. Adjust fields and click Update Selected.` };
}

export function updateSelectedPropFromTool(builderState, appState = null) {
  const map = getEditableBuilderMap(builderState);
  if (!map) return { ok: false, message: "Prop update is only available on builder-owned maps." };

  const tool = ensurePropToolSettings(builderState, appState);
  const selectedId = String(tool?.selectedPropId ?? "").trim();
  if (!selectedId) return { ok: false, message: "No selected prop to update." };

  const prop = findPropById(map, selectedId);
  if (!prop) {
    tool.selectedPropId = "";
    return { ok: false, message: `Selected prop ${selectedId} no longer exists.` };
  }

  prop.spriteId = tool.spriteId;
  prop.footprintW = tool.footprintW;
  prop.footprintH = tool.footprintH;
  prop.height = tool.height;
  prop.visualHeight = tool.visualHeight;
  prop.blocksMovement = tool.blocksMovement;
  prop.scale = tool.scale;
  prop.layer = tool.layer;

  if (tool.mirrorX) prop.mirrorX = true;
  else delete prop.mirrorX;

  if (tool.offsetX !== 0) prop.offsetX = tool.offsetX;
  else delete prop.offsetX;

  if (tool.offsetY !== 0) prop.offsetY = tool.offsetY;
  else delete prop.offsetY;

  builderState.dirty = true;
  return { ok: true, message: `Updated prop ${selectedId}.`, prop };
}

export function getBuilderPropSpriteOptions(appState, builderState = null) {
  const ids = [];
  for (const id of DEFAULT_PROP_SPRITES) addUnique(ids, id);

  const maps = [builderState?.authoring?.map, appState?.map].filter(Boolean);
  for (const map of maps) {
    for (const prop of getMapProps(map)) {
      addUnique(ids, prop?.spriteId ?? prop?.sprite ?? prop?.image);
    }
  }

  return ids;
}

export function getPropSpritePreviewPath(spriteId) {
  const clean = sanitizeSprite(spriteId, "");
  if (!clean) return "";
  if (/^(https?:|data:|\/)/i.test(clean)) return clean;
  if (clean.includes("/")) return clean;
  return `art/props/${clean}`;
}

function createDefaultPropTool(appState, builderState) {
  return {
    spriteId: getBuilderPropSpriteOptions(appState, builderState)[0] ?? "prop_car_001.png",
    footprintW: 2,
    footprintH: 1,
    height: 1,
    visualHeight: 1,
    blocksMovement: true,
    scale: 1,
    mirrorX: false,
    offsetX: 0,
    offsetY: 0,
    layer: "samePlane",
    erase: false,
    select: false,
    selectedPropId: ""
  };
}

function getEditableBuilderMap(builderState) {
  if (builderState?.workspaceMode !== "builder-map") return null;
  return builderState?.authoring?.map ?? null;
}

function ensurePropsArray(map) {
  if (!Array.isArray(map.props)) map.props = [];
  return map.props;
}

function erasePropsAtTile(map, x, y) {
  const props = ensurePropsArray(map);
  const hits = new Set(getPropsAtTile(map, x, y).map((prop) => prop.id));
  if (!hits.size) return 0;
  const before = props.length;
  map.props = props.filter((prop) => !hits.has(String(prop?.id ?? normalizeProp(prop)?.id ?? "")));
  return before - map.props.length;
}

function findPropById(map, propId) {
  const id = String(propId ?? "").trim();
  if (!id) return null;
  return ensurePropsArray(map).find((prop) => String(prop?.id ?? "").trim() === id) ?? null;
}

function makePropId(map, x, y) {
  const base = `prop_${x}_${y}`;
  const existing = new Set(ensurePropsArray(map).map((prop) => String(prop?.id ?? "")));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function sanitizeSprite(value, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function normalizeLayer(value) {
  const clean = String(value ?? "samePlane").trim();
  if (clean === "belowUnits" || clean === "aboveUnits" || clean === "roofOverlay") return clean;
  return "samePlane";
}

function clampNumber(value, fallback, min, max) {
  const explicit = Number(value);
  if (!Number.isFinite(explicit)) return fallback;
  return Math.max(min, Math.min(max, explicit));
}

function clampWhole(value, fallback, min, max) {
  return Math.round(clampNumber(value, fallback, min, max));
}

function addUnique(list, value) {
  const clean = String(value ?? "").trim();
  if (clean && !list.includes(clean)) list.push(clean);
}
