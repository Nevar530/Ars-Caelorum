// src/render/renderStructures.js
// Structure Render V2.1: compass-locked faces plus doorway interior projection.

import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon } from "../utils.js";
import { projectScene, getTopdownCellSize, getSceneSortKey } from "./projection.js";
import { getWorldFaceForScreenSide } from "./renderCompass.js";
import { getTerrainDepth } from "./renderSceneMath.js";
import {
  getMapStructures,
  getStructureFaceSprite,
  getStructureInteriorSprite,
  normalizeStructureForMap
} from "../structures/structureRules.js";

let clipId = 0;
const FACE_COLOR = "rgba(80,74,84,0.72)";
const ROOF_COLOR = "rgba(120,68,86,0.82)";
const DOOR_PATTERN = /(^|[_-])door([_-]|\.)/i;

export function getStructureSceneItems(state) {
  const list = getMapStructures(state?.map);
  const items = [];

  for (const raw of list) {
    const s = normalizeStructureForMap(state, raw);
    if (!s) continue;

    if (state.ui?.viewMode === "top") {
      items.push(makeTopItem(state, s));
      continue;
    }

    const leftWorldFace = getWorldFaceForScreenSide(state.rotation, "left");
    const rightWorldFace = getWorldFaceForScreenSide(state.rotation, "right");
    const leftSprite = getStructureFaceSprite(s, leftWorldFace);
    const rightSprite = getStructureFaceSprite(s, rightWorldFace);
    const leftInteriorSprite = getStructureInteriorSprite(s, leftWorldFace);
    const rightInteriorSprite = getStructureInteriorSprite(s, rightWorldFace);

    if (leftSprite || leftInteriorSprite || s.drawFallbackFaces) {
      items.push(makeFaceItem(state, s, "left", leftWorldFace, leftSprite, leftInteriorSprite));
    }

    if (rightSprite || rightInteriorSprite || s.drawFallbackFaces) {
      items.push(makeFaceItem(state, s, "right", rightWorldFace, rightSprite, rightInteriorSprite));
    }
    if (s.roofSprite) items.push(makeRoofItem(state, s));
  }

  return items.filter(Boolean);
}

function makeFaceItem(state, s, screenSide, worldFace, imagePath, interiorImagePath = null) {
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
    interiorImagePath,
    interiorProjection: getInteriorProjection(state, s, screenSide, worldFace, imagePath, interiorImagePath),
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

function getInteriorProjection(state, s, screenSide, worldFace, imagePath, interiorImagePath) {
  if (!interiorImagePath) return null;
  if (!looksLikeDoorSprite(imagePath)) return null;

  const inward = getInteriorOffsetForWorldFace(worldFace);
  if (!inward) return null;

  const shifted = {
    ...s,
    x: s.x + inward.x,
    y: s.y + inward.y
  };
  const g = geometry(state, shifted);

  return {
    imagePath: interiorImagePath,
    points: screenSide === "left" ? g.rightFace : g.leftFace
  };
}

function looksLikeDoorSprite(imagePath) {
  const value = String(imagePath ?? "").trim();
  return DOOR_PATTERN.test(value);
}

function getInteriorOffsetForWorldFace(worldFace) {
  switch (String(worldFace ?? "").toLowerCase()) {
    case "sw":
      return { x: 1, y: 0 };
    case "se":
      return { x: 0, y: 1 };
    case "ne":
      return { x: -1, y: 0 };
    case "nw":
      return { x: 0, y: -1 };
    default:
      return null;
  }
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

  if (item.interiorProjection?.imagePath) {
    appendProjectedFaceImage(group, item.points, item.interiorProjection.points, item.interiorProjection.imagePath, "interior");
  }

  if (item.imagePath) {
    appendProjectedFaceImage(group, item.points, item.points, item.imagePath, "exterior");
  }

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

function appendProjectedFaceImage(parentGroup, clipPoints, imagePoints, imagePath, layerName = "face") {
  const id = `structure-face-clip-${clipId += 1}`;
  const clip = svgEl("clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  clip.appendChild(makePolygon(clipPoints, "structure-face-clip", "#fff"));
  parentGroup.appendChild(clip);

  const group = svgEl("g");
  group.dataset.structureImageLayer = layerName;
  group.setAttribute("clip-path", `url(#${id})`);
  const image = svgEl("image");
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", "32");
  image.setAttribute("height", "64");
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("href", imagePath);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

  const topStart = imagePoints[0];
  const topEnd = imagePoints[1];
  const bottomStart = imagePoints[3];
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
