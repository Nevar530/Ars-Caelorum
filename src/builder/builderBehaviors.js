// src/builder/builderBehaviors.js

import { getTile } from "../map.js";

const AREA_MODES = ["box", "zone"];
const PAINT_MODES = ["add", "erase"];

function createDefaultBehaviorTool() {
  return {
    id: "",
    unitId: "",
    type: "wander",
    areaMode: "box",
    areaW: 3,
    areaH: 3,
    stepInterval: 4,
    enabled: true,
    selectedIndex: -1,
    paintMode: "add"
  };
}

export function ensureBehaviorToolSettings(builderState) {
  if (!builderState) return null;
  if (!builderState.behaviorTool) builderState.behaviorTool = createDefaultBehaviorTool();
  const tool = builderState.behaviorTool;

  tool.id = sanitizeId(tool.id ?? "");
  tool.unitId = sanitizeLooseId(tool.unitId ?? "");
  tool.type = "wander";
  tool.areaMode = AREA_MODES.includes(tool.areaMode) ? tool.areaMode : "box";
  tool.areaW = Math.max(1, normalizeInteger(tool.areaW, 3));
  tool.areaH = Math.max(1, normalizeInteger(tool.areaH, tool.areaW));
  tool.stepInterval = Math.max(1, normalizeInteger(tool.stepInterval, 4));
  tool.enabled = tool.enabled !== false;
  if (!Number.isInteger(Number(tool.selectedIndex))) tool.selectedIndex = -1;
  if (!PAINT_MODES.includes(tool.paintMode)) tool.paintMode = "add";

  return tool;
}

export function updateBehaviorToolFromFields(builderState, root) {
  const tool = ensureBehaviorToolSettings(builderState);
  if (!tool || !root) return tool;

  tool.id = sanitizeId(readField(root, "behavior-id", tool.id));
  tool.unitId = sanitizeLooseId(readField(root, "behavior-unit-id", tool.unitId));
  const mode = readField(root, "behavior-area-mode", tool.areaMode);
  tool.areaMode = AREA_MODES.includes(mode) ? mode : "box";
  tool.areaW = Math.max(1, normalizeInteger(readField(root, "behavior-area-w", tool.areaW), tool.areaW));
  tool.areaH = Math.max(1, normalizeInteger(readField(root, "behavior-area-h", tool.areaH), tool.areaH));
  tool.stepInterval = Math.max(1, normalizeInteger(readField(root, "behavior-step-interval", tool.stepInterval), tool.stepInterval));
  tool.enabled = readCheckbox(root, "behavior-enabled", tool.enabled !== false);

  return tool;
}

export function getBehaviorDefinitions(builderState) {
  const map = ensureMapDraft(builderState);
  return Array.isArray(map?.npcBehaviors) ? map.npcBehaviors : [];
}

export function addBehaviorDefinition(builderState) {
  const tool = ensureBehaviorToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  if (!tool || !map) return { ok: false, message: "No builder map is active." };
  if (!tool.unitId) return { ok: false, message: "Choose a Unit ID before adding a behavior." };

  const behaviors = Array.isArray(map.npcBehaviors) ? map.npcBehaviors : [];
  const baseId = sanitizeId(tool.id) || createBehaviorId(tool.unitId, behaviors);
  const behavior = buildBehaviorFromTool(tool, createUniqueBehaviorId(baseId, behaviors));

  map.npcBehaviors = [...behaviors, behavior];
  tool.selectedIndex = map.npcBehaviors.length - 1;
  builderState.dirty = true;

  return { ok: true, message: `Added behavior ${behavior.id}.` };
}

export function updateSelectedBehaviorDefinition(builderState) {
  const tool = ensureBehaviorToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  const behaviors = Array.isArray(map?.npcBehaviors) ? map.npcBehaviors : [];
  const index = Number(tool?.selectedIndex ?? -1);
  if (!Number.isInteger(index) || index < 0 || index >= behaviors.length) {
    return { ok: false, message: "No behavior selected to update." };
  }
  if (!tool.unitId) return { ok: false, message: "Choose a Unit ID before updating behavior." };

  const existing = behaviors[index] ?? {};
  const baseId = sanitizeId(tool.id) || existing.id || createBehaviorId(tool.unitId, behaviors);
  const other = behaviors.filter((_, otherIndex) => otherIndex !== index);
  behaviors[index] = {
    ...buildBehaviorFromTool(tool, createUniqueBehaviorId(baseId, other)),
    tiles: normalizeTiles(existing.tiles)
  };
  map.npcBehaviors = behaviors;
  builderState.dirty = true;

  return { ok: true, message: `Updated behavior ${behaviors[index].id}.` };
}

export function selectBehaviorDefinition(builderState, index) {
  const tool = ensureBehaviorToolSettings(builderState);
  const behaviors = getBehaviorDefinitions(builderState);
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= behaviors.length) {
    return { ok: false, message: "Behavior selection is out of range." };
  }

  const behavior = behaviors[cleanIndex] ?? {};
  tool.selectedIndex = cleanIndex;
  tool.id = behavior.id ?? "";
  tool.unitId = behavior.unitId ?? "";
  tool.areaMode = AREA_MODES.includes(behavior.areaMode) ? behavior.areaMode : "box";
  tool.areaW = normalizeInteger(behavior.areaW, 3);
  tool.areaH = normalizeInteger(behavior.areaH, tool.areaW);
  tool.stepInterval = normalizeInteger(behavior.stepInterval, 4);
  tool.enabled = behavior.enabled !== false;
  ensureBehaviorToolSettings(builderState);
  return { ok: true, message: `Selected behavior ${behavior.id ?? cleanIndex + 1}.` };
}

export function removeBehaviorDefinition(builderState, index) {
  const map = ensureMapDraft(builderState);
  const behaviors = Array.isArray(map?.npcBehaviors) ? map.npcBehaviors : [];
  const cleanIndex = Number(index);
  if (!Number.isInteger(cleanIndex) || cleanIndex < 0 || cleanIndex >= behaviors.length) {
    return { ok: false, message: "No behavior removed; index was invalid." };
  }

  const [removed] = behaviors.splice(cleanIndex, 1);
  map.npcBehaviors = behaviors;
  const tool = ensureBehaviorToolSettings(builderState);
  tool.selectedIndex = behaviors.length ? Math.min(cleanIndex, behaviors.length - 1) : -1;
  builderState.dirty = true;
  return { ok: true, message: `Removed behavior ${removed?.id ?? cleanIndex + 1}.` };
}

export function setBehaviorPaintMode(builderState, mode) {
  const tool = ensureBehaviorToolSettings(builderState);
  tool.paintMode = mode === "erase" ? "erase" : "add";
  return tool;
}

export function isBehaviorAuthoringActive(builderState) {
  return builderState?.workspaceMode === "builder-map" && builderState?.activeTab === "units" && builderState?.behaviorTool?.areaMode === "zone";
}

export function applyBehaviorToolAtTile(builderState, appState, x, y) {
  const tool = ensureBehaviorToolSettings(builderState);
  const map = ensureMapDraft(builderState);
  const behaviors = Array.isArray(map?.npcBehaviors) ? map.npcBehaviors : [];
  const index = Number(tool?.selectedIndex ?? -1);
  if (!Number.isInteger(index) || index < 0 || index >= behaviors.length) {
    return { ok: false, message: "Select or add a zone behavior before painting wander tiles." };
  }

  const activeMap = appState?.map ?? map;
  const tx = Number(x);
  const ty = Number(y);
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || !getTile(activeMap, tx, ty)) {
    return { ok: false, message: "Wander tile is outside the map." };
  }

  const behavior = behaviors[index];
  const tiles = normalizeTiles(behavior.tiles);
  const key = `${tx},${ty}`;
  const exists = tiles.some((tile) => `${tile.x},${tile.y}` === key);

  if (tool.paintMode === "erase") {
    behavior.tiles = tiles.filter((tile) => `${tile.x},${tile.y}` !== key);
    builderState.dirty = true;
    return { ok: true, message: `Removed ${tx}, ${ty} from behavior ${behavior.id}.` };
  }

  behavior.tiles = exists ? tiles : [...tiles, { x: tx, y: ty }];
  behavior.areaMode = "zone";
  builderState.dirty = true;
  return { ok: true, message: exists ? `${tx}, ${ty} is already in behavior ${behavior.id}.` : `Added ${tx}, ${ty} to behavior ${behavior.id}.` };
}

export function getBehaviorZoneCells(mapOrBuilderState) {
  const map = mapOrBuilderState?.authoring?.map ?? mapOrBuilderState?.map ?? mapOrBuilderState ?? null;
  const behaviors = Array.isArray(map?.npcBehaviors) ? map.npcBehaviors : [];
  const cells = [];
  for (const behavior of behaviors) {
    if (behavior?.areaMode !== "zone") continue;
    for (const tile of normalizeTiles(behavior.tiles)) {
      cells.push({ x: tile.x, y: tile.y, behaviorId: behavior.id ?? "behavior", unitId: behavior.unitId ?? "unit" });
    }
  }
  return cells;
}

export function getBehaviorTargetUnitOptions(builderState) {
  const deployments = Array.isArray(builderState?.authoring?.map?.startState?.deployments)
    ? builderState.authoring.map.startState.deployments
    : [];
  return deployments
    .map((entry, index) => {
      const id = sanitizeLooseId(entry?.pilotInstanceId ?? entry?.mechInstanceId ?? "");
      if (!id) return null;
      const definitionId = entry?.pilotDefinitionId ?? entry?.mechDefinitionId ?? "unit";
      return { id, label: `${id} (${definitionId})`, index };
    })
    .filter(Boolean);
}

function buildBehaviorFromTool(tool, id) {
  return {
    id,
    type: "wander",
    unitId: tool.unitId || "",
    areaMode: AREA_MODES.includes(tool.areaMode) ? tool.areaMode : "box",
    areaW: Math.max(1, normalizeInteger(tool.areaW, 3)),
    areaH: Math.max(1, normalizeInteger(tool.areaH, tool.areaW)),
    stepInterval: Math.max(1, normalizeInteger(tool.stepInterval, 4)),
    enabled: tool.enabled !== false,
    tiles: []
  };
}

function createBehaviorId(unitId, behaviors) {
  return createUniqueBehaviorId(`${sanitizeId(unitId) || "unit"}_wander`, behaviors);
}

function createUniqueBehaviorId(baseId, behaviors) {
  const base = sanitizeId(baseId) || "wander";
  const used = new Set((Array.isArray(behaviors) ? behaviors : []).map((behavior) => behavior?.id).filter(Boolean));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function ensureMapDraft(builderState) {
  if (!builderState?.authoring?.map) return null;
  const map = builderState.authoring.map;
  if (!Array.isArray(map.npcBehaviors)) map.npcBehaviors = [];
  return map;
}

function normalizeTiles(tiles) {
  if (!Array.isArray(tiles)) return [];
  const seen = new Set();
  const clean = [];
  for (const tile of tiles) {
    const x = Number(tile?.x);
    const y = Number(tile?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ x, y });
  }
  return clean;
}

function readField(root, fieldName, fallback = "") {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? String(node.value ?? "") : String(fallback ?? "");
}

function readCheckbox(root, fieldName, fallback = true) {
  const node = root?.querySelector?.(`[data-builder-field="${fieldName}"]`);
  return node ? Boolean(node.checked) : Boolean(fallback);
}

function normalizeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number(fallback) || 0;
  return Math.trunc(number);
}

function sanitizeLooseId(value) {
  return String(value ?? "").trim();
}

function sanitizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
