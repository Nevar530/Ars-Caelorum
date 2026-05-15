// src/props/propRules.js
//
// Props are tile-footprint map objects. They are not edge blockers and they do
// not add a separate cover system. Gameplay truth stays simple:
// - blocksMovement blocks every tile in the prop footprint
// - height is LOS height in map height levels
// - visual fields only affect rendering/authoring

const DEFAULT_PROP_ART_ROOT = "art/props/";
const DEFAULT_PROP_SPRITE = "prop_car_001.png";

export function getMapProps(map) {
  return Array.isArray(map?.props) ? map.props : [];
}

export function resolvePropSpritePath(name) {
  const value = String(name ?? "").trim();
  if (!value) return null;
  if (value.startsWith("./") || value.startsWith("/") || value.startsWith("art/")) return value;
  return `${DEFAULT_PROP_ART_ROOT}${value}`;
}

export function normalizeProp(raw) {
  const x = Number(raw?.x ?? raw?.tileX);
  const y = Number(raw?.y ?? raw?.tileY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const footprintW = clampWhole(raw?.footprintW ?? raw?.w ?? raw?.width ?? 1, 1, 12, 1);
  const footprintH = clampWhole(raw?.footprintH ?? raw?.h ?? raw?.heightTiles ?? 1, 1, 12, 1);
  const height = clampNumber(raw?.height ?? raw?.losHeight ?? raw?.heightLevels ?? 0, 0, 99, 0);
  const visualHeight = clampNumber(raw?.visualHeight ?? raw?.visualHeightLevels ?? height, 0, 99, height);
  const scale = clampNumber(raw?.scale, 0.1, 8, 1);
  const offsetX = clampWhole(raw?.offsetX, -2048, 2048, 0);
  const offsetY = clampWhole(raw?.offsetY, -2048, 2048, 0);
  const layer = normalizeLayer(raw?.layer);
  const id = String(raw?.id ?? `prop_${x}_${y}`).trim() || `prop_${x}_${y}`;
  const name = String(raw?.name ?? raw?.propName ?? raw?.label ?? "").trim();
  const spriteId = String(raw?.spriteId ?? raw?.sprite ?? raw?.image ?? DEFAULT_PROP_SPRITE).trim() || DEFAULT_PROP_SPRITE;

  return {
    id,
    name,
    x,
    y,
    footprintW,
    footprintH,
    height,
    visualHeight,
    blocksMovement: raw?.blocksMovement !== false,
    spriteId,
    sprite: resolvePropSpritePath(spriteId),
    scale,
    mirrorX: raw?.mirrorX === true,
    offsetX,
    offsetY,
    layer
  };
}

export function getPropFootprintCells(prop) {
  const clean = prop?.sprite ? prop : normalizeProp(prop);
  if (!clean) return [];

  const cells = [];
  for (let dy = 0; dy < clean.footprintH; dy += 1) {
    for (let dx = 0; dx < clean.footprintW; dx += 1) {
      cells.push({ x: clean.x + dx, y: clean.y + dy });
    }
  }
  return cells;
}

export function getPropsAtTile(map, x, y) {
  const tileX = Number(x);
  const tileY = Number(y);
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return [];

  return getMapProps(map)
    .map((prop) => normalizeProp(prop))
    .filter(Boolean)
    .filter((prop) => getPropFootprintCells(prop).some((cell) => Number(cell.x) === tileX && Number(cell.y) === tileY));
}

export function isPropMovementBlockedAt(map, x, y) {
  return getPropsAtTile(map, x, y).some((prop) => prop.blocksMovement === true);
}

export function getPropLosHeightAt(map, x, y) {
  let maxHeight = 0;
  for (const prop of getPropsAtTile(map, x, y)) {
    const height = Number(prop.height ?? 0);
    if (height > maxHeight) maxHeight = height;
  }
  return maxHeight;
}

function normalizeLayer(value) {
  const clean = String(value ?? "samePlane").trim();
  if (clean === "belowUnits" || clean === "aboveUnits" || clean === "roofOverlay") return clean;
  return "samePlane";
}

function clampNumber(value, min, max, fallback) {
  const explicit = Number(value);
  if (!Number.isFinite(explicit)) return fallback;
  return Math.max(min, Math.min(max, explicit));
}

function clampWhole(value, min, max, fallback) {
  return Math.round(clampNumber(value, min, max, fallback));
}
