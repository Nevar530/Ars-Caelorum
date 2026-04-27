// src/render/renderStructures.js
// Structure Render V1.2: render-only, compass-locked world faces.

import { RENDER_CONFIG } from "../config.js";
import { getTile, getTileRenderElevation } from "../map.js";
import { svgEl, makePolygon } from "../utils.js";
import { projectScene, getTopdownCellSize, getSceneSortKey } from "./projection.js";
import { getWorldFaceForScreenSide, normalizeWorldFace } from "./renderCompass.js";
import { getTerrainDepth } from "./renderSceneMath.js";

let clipId = 0;
const FACE_COLOR = "rgba(80,74,84,0.72)";
const ROOF_COLOR = "rgba(120,68,86,0.82)";

export function getStructureSceneItems(state) {
  const list = Array.isArray(state?.map?.structures) ? state.map.structures : [];
  const items = [];

  for (const raw of list) {
    const s = normalizeStructure(state, raw);
    if (!s) continue;

    if (state.ui?.viewMode === "top") {
      items.push(makeTopItem(state, s));
      continue;
    }

    const leftWorldFace = getWorldFaceForScreenSide(state.rotation, "left");
    const rightWorldFace = getWorldFaceForScreenSide(state.rotation, "right");
    const leftSprite = faceSprite(s, leftWorldFace);
    const rightSprite = faceSprite(s, rightWorldFace);

    if (leftSprite || s.drawFallbackFaces) items.push(makeFaceItem(state, s, "left", leftWorldFace, leftSprite));
    if (rightSprite || s.drawFallbackFaces) items.push(makeFaceItem(state, s, "right", rightWorldFace, rightSprite));
    if (s.roofSprite) items.push(makeRoofItem(state, s));
  }

  return items.filter(Boolean);
}

function normalizeStructure(state, raw) {
  const x = Number(raw?.x ?? raw?.tileX);
  const y = Number(raw?.y ?? raw?.tileY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const tile = getTile(state.map, x, y);
  if (!tile) return null;
  const elevation = Number(raw?.elevation ?? getTileRenderElevation(tile) ?? 0);
  const heightPx = Math.max(1, Number(raw?.heightPx ?? 64));

  return {
    id: String(raw?.id ?? `structure_${x}_${y}`),
    x,
    y,
    w: Math.max(1, Number(raw?.w ?? raw?.width ?? 1)),
    h: Math.max(1, Number(raw?.h ?? raw?.height ?? 1)),
    elevation,
    heightPx,
    heightLevels: heightPx / RENDER_CONFIG.elevationStepPx,
    drawFallbackFaces: raw?.drawFallbackFaces === true,
    faceSprites: normalizeFaceSprites(raw),
    roofSprite: spritePath(raw?.roof ?? raw?.roofSprite)
  };
}

function normalizeFaceSprites(raw) {
  const src = raw?.faceSprites && typeof raw.faceSprites === "object"
    ? raw.faceSprites
    : raw?.faces && typeof raw.faces === "object"
      ? raw.faces
      : {};
  const legacyFace = spritePath(raw?.face ?? raw?.faceSprite);
  const legacyLeft = spritePath(raw?.leftFace);
  const legacyRight = spritePath(raw?.rightFace);
  return {
    ne: spritePath(src.ne) ?? legacyFace,
    se: spritePath(src.se) ?? legacyRight ?? legacyFace,
    sw: spritePath(src.sw) ?? legacyLeft ?? legacyFace,
    nw: spritePath(src.nw) ?? legacyFace
  };
}

function spritePath(name) {
  const value = String(name ?? "").trim();
  if (!value) return null;
  if (value.startsWith("./") || value.startsWith("/") || value.startsWith("art/")) return value;
  return `art/structures/${value}`;
}

function faceSprite(s, worldFace) {
  const face = normalizeWorldFace(worldFace);
  return face ? (s.faceSprites?.[face] ?? null) : null;
}

function makeFaceItem(state, s, screenSide, worldFace, imagePath) {
  const g = geometry(state, s);
  const points = screenSide === "left" ? g.leftFace : g.rightFace;
  const depth = getTerrainDepth({ size: 1, screenY: g.base.screenY, leftFaceHeight: s.elevation, rightFaceHeight: s.elevation });
  return {
    kind: "structure_face",
    structureId: s.id,
    screenSide,
    worldFace,
    points,
    imagePath,
    sortDepth: depth + 0.36,
    sortKey: getSceneSortKey(state, s.x, s.y, s.elevation) + (screenSide === "left" ? 0.1 : 0.2),
    render(parent) { drawFace(this, parent); }
  };
}

function makeRoofItem(state, s) {
  const g = geometry(state, s);
  const depth = getTerrainDepth({ size: 1, screenY: g.base.screenY, leftFaceHeight: s.elevation, rightFaceHeight: s.elevation });
  return {
    kind: "structure_roof",
    structureId: s.id,
    points: g.roof,
    imagePath: s.roofSprite,
    textureRotation: state.rotation,
    sortDepth: depth + 0.42,
    sortKey: getSceneSortKey(state, s.x, s.y, s.elevation + s.heightLevels) + 0.3,
    render(parent) { drawRoof(this, parent); }
  };
}

function makeTopItem(state, s) {
  const size = getTopdownCellSize(state);
  const p = projectScene(state, s.x, s.y, s.elevation, 1);
  return {
    kind: "structure_topdown",
    x: p.x,
    y: p.y,
    width: size * s.w,
    height: size * s.h,
    sortDepth: p.y + 0.2,
    sortKey: getSceneSortKey(state, s.x, s.y, s.elevation) + 0.2,
    render(parent) { drawTop(this, parent); }
  };
}

function geometry(state, s) {
  const p = projectScene(state, s.x, s.y, s.elevation, 1);
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;
  const rise = s.heightPx;
  const base = {
    screenY: p.y,
    top: { x: p.x, y: p.y },
    right: { x: p.x + halfW, y: p.y + halfH },
    bottom: { x: p.x, y: p.y + (halfH * 2) },
    left: { x: p.x - halfW, y: p.y + halfH }
  };
  const roof = {
    top: { x: base.top.x, y: base.top.y - rise },
    right: { x: base.right.x, y: base.right.y - rise },
    bottom: { x: base.bottom.x, y: base.bottom.y - rise },
    left: { x: base.left.x, y: base.left.y - rise }
  };
  return {
    base,
    roof: [roof.top, roof.right, roof.bottom, roof.left],
    leftFace: [roof.left, roof.bottom, base.bottom, base.left],
    rightFace: [roof.right, roof.bottom, base.bottom, base.right]
  };
}

function drawTop(item, parent) {
  const rect = svgEl("rect");
  rect.setAttribute("x", String(item.x));
  rect.setAttribute("y", String(item.y));
  rect.setAttribute("width", String(item.width));
  rect.setAttribute("height", String(item.height));
  rect.setAttribute("fill", "rgba(180,120,170,0.34)");
  rect.setAttribute("stroke", "rgba(255,255,255,0.72)");
  rect.setAttribute("stroke-width", "2");
  rect.setAttribute("pointer-events", "none");
  parent.appendChild(rect);
}

function drawFace(item, parent) {
  const group = svgEl("g");
  group.dataset.structureId = item.structureId;
  group.dataset.worldFace = item.worldFace ?? "";
  group.dataset.screenSide = item.screenSide ?? "";

  const fallback = makePolygon(item.points, "structure-face", FACE_COLOR);
  fallback.setAttribute("stroke", "none");
  group.appendChild(fallback);
  if (item.imagePath) appendFaceImage(group, item.points, item.imagePath);
  const outline = makePolygon(item.points, "structure-face-outline", "none");
  outline.setAttribute("stroke", "rgba(20,18,24,0.82)");
  outline.setAttribute("stroke-width", "1.2");
  outline.setAttribute("stroke-linejoin", "round");
  group.appendChild(outline);
  parent.appendChild(group);
}

function drawRoof(item, parent) {
  const group = svgEl("g");
  group.dataset.structureId = item.structureId;
  group.dataset.structurePart = "roof";

  const fallback = makePolygon(item.points, "structure-roof", ROOF_COLOR);
  fallback.setAttribute("stroke", "none");
  group.appendChild(fallback);
  if (item.imagePath) appendRoofImage(group, item.points, item.imagePath, item.textureRotation);
  const outline = makePolygon(item.points, "structure-roof-outline", "none");
  outline.setAttribute("stroke", "rgba(20,18,24,0.88)");
  outline.setAttribute("stroke-width", "1.2");
  outline.setAttribute("stroke-linejoin", "round");
  group.appendChild(outline);
  parent.appendChild(group);
}

function appendFaceImage(parentGroup, points, imagePath) {
  const id = `structure-face-clip-${clipId += 1}`;
  const clip = svgEl("clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  clip.appendChild(makePolygon(points, "structure-face-clip", "#fff"));
  parentGroup.appendChild(clip);

  const group = svgEl("g");
  group.setAttribute("clip-path", `url(#${id})`);
  const image = svgEl("image");
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", "32");
  image.setAttribute("height", "64");
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("href", imagePath);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

  const topStart = points[0];
  const topEnd = points[1];
  const bottomStart = points[3];
  const ux = topEnd.x - topStart.x;
  const uy = topEnd.y - topStart.y;
  const vx = bottomStart.x - topStart.x;
  const vy = bottomStart.y - topStart.y;
  image.setAttribute("transform", `matrix(${ux / 32} ${uy / 32} ${vx / 64} ${vy / 64} ${topStart.x} ${topStart.y})`);

  group.appendChild(image);
  parentGroup.appendChild(group);
}

function appendRoofImage(parentGroup, points, imagePath, textureRotation = 0) {
  const id = `structure-roof-clip-${clipId += 1}`;
  const clip = svgEl("clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  clip.appendChild(makePolygon(points, "structure-roof-clip", "#fff"));
  parentGroup.appendChild(clip);

  const group = svgEl("g");
  group.setAttribute("clip-path", `url(#${id})`);
  const image = svgEl("image");
  const size = 32;
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", String(size));
  image.setAttribute("height", String(size));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("href", imagePath);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

  const topLeft = points[3];
  const topAxisEnd = points[0];
  const sideAxisEnd = points[2];
  const ux = topAxisEnd.x - topLeft.x;
  const uy = topAxisEnd.y - topLeft.y;
  const vx = sideAxisEnd.x - topLeft.x;
  const vy = sideAxisEnd.y - topLeft.y;
  const baseA = ux / size;
  const baseB = uy / size;
  const baseC = vx / size;
  const baseD = vy / size;
  const rot = normalizeRotation(textureRotation);
  const radians = (rot * Math.PI) / 2;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const center = size / 2;
  const rotE = center - (cos * center) + (sin * center);
  const rotF = center - (sin * center) - (cos * center);
  const a = (baseA * cos) + (baseC * sin);
  const b = (baseB * cos) + (baseD * sin);
  const c = (baseA * -sin) + (baseC * cos);
  const d = (baseB * -sin) + (baseD * cos);
  const e = (baseA * rotE) + (baseC * rotF) + topLeft.x;
  const f = (baseB * rotE) + (baseD * rotF) + topLeft.y;
  image.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);

  group.appendChild(image);
  parentGroup.appendChild(group);
}

function normalizeRotation(rotation = 0) {
  const value = Number(rotation ?? 0);
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 4) + 4) % 4;
}
