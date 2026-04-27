// src/render/renderStructures.js
//
// Structure V1 renderer.
// This pass is visual-only: structures are read from map.structures and drawn as
// projected flat asset pieces. Movement/LOS authority comes in a later pass.

import { RENDER_CONFIG } from "../config.js";
import { getTile, getTileRenderElevation } from "../map.js";
import { svgEl, makePolygon } from "../utils.js";
import { projectScene, getSceneSortKey, getTopdownCellSize } from "./projection.js";
import { getTerrainDepth } from "./renderSceneMath.js";

const STRUCTURE_ART_ROOT = "./art/structures/";
const DEFAULT_FACE_WIDTH = 32;
const DEFAULT_FACE_HEIGHT = 64;
const DEFAULT_ROOF_SIZE = 32;

let structureClipId = 0;

export function buildStructureSceneItems(state) {
  const structures = Array.isArray(state?.map?.structures) ? state.map.structures : [];
  const items = [];

  if (!structures.length) return items;

  for (const structure of structures) {
    const normalized = normalizeStructure(structure);
    if (!normalized) continue;

    const tile = getTile(state.map, normalized.x, normalized.y);
    if (!tile) continue;

    const elevation = getTileRenderElevation(tile);
    const projected = projectScene(state, normalized.x, normalized.y, elevation, 1);

    items.push({
      kind: "structure",
      sourceKind: "structure",
      id: normalized.id,
      x: normalized.x,
      y: normalized.y,
      elevation,
      screenX: projected.x,
      screenY: projected.y,
      heightPx: normalized.heightPx,
      structure: normalized,
      sortDepth: getStructureDepth(state, normalized, projected, elevation),
      sortKey: getSceneSortKey(state, normalized.x, normalized.y, elevation) + 0.5,
      render(parent) {
        renderStructure(state, this, parent);
      }
    });
  }

  return items;
}

function normalizeStructure(raw) {
  if (!raw || typeof raw !== "object") return null;

  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    id: String(raw.id ?? `structure_${x}_${y}`),
    x,
    y,
    w: Math.max(1, Number(raw.w ?? 1) || 1),
    h: Math.max(1, Number(raw.h ?? 1) || 1),
    heightPx: Math.max(1, Number(raw.heightPx ?? DEFAULT_FACE_HEIGHT) || DEFAULT_FACE_HEIGHT),
    leftFace: normalizeAssetPath(raw.leftFace),
    rightFace: normalizeAssetPath(raw.rightFace),
    roof: normalizeAssetPath(raw.roof)
  };
}

function normalizeAssetPath(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.startsWith("./") || text.startsWith("/") || text.includes("/")) return text;
  return `${STRUCTURE_ART_ROOT}${text}`;
}

function getStructureDepth(state, structure, projected, elevation) {
  if (state.ui?.viewMode === "top") {
    return projected.y + getTopdownCellSize(state);
  }

  return getTerrainDepth({
    size: 1,
    screenY: projected.y,
    leftFaceHeight: elevation,
    rightFaceHeight: elevation
  }) + structure.heightPx;
}

function renderStructure(state, item, parent) {
  if (state.ui?.viewMode === "top") {
    renderTopStructure(state, item, parent);
    return;
  }

  renderIsoStructure(item, parent);
}

function renderIsoStructure(item, parent) {
  const { screenX, screenY, heightPx, structure } = item;
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;

  const base = {
    top: { x: screenX, y: screenY },
    right: { x: screenX + halfW, y: screenY + halfH },
    bottom: { x: screenX, y: screenY + (halfH * 2) },
    left: { x: screenX - halfW, y: screenY + halfH }
  };

  const roof = {
    top: { x: base.top.x, y: base.top.y - heightPx },
    right: { x: base.right.x, y: base.right.y - heightPx },
    bottom: { x: base.bottom.x, y: base.bottom.y - heightPx },
    left: { x: base.left.x, y: base.left.y - heightPx }
  };

  const group = svgEl("g");
  group.setAttribute("class", "structure structure-v1");
  group.dataset.structureId = structure.id;
  group.dataset.x = String(structure.x);
  group.dataset.y = String(structure.y);
  group.setAttribute("pointer-events", "none");

  drawStructureFace({
    parentGroup: group,
    points: [roof.left, roof.bottom, base.bottom, base.left],
    imagePath: structure.leftFace,
    fallbackColor: "rgba(92, 83, 90, 0.95)",
    className: "structure-left-face",
    sourceWidth: DEFAULT_FACE_WIDTH,
    sourceHeight: DEFAULT_FACE_HEIGHT
  });

  drawStructureFace({
    parentGroup: group,
    points: [roof.right, roof.bottom, base.bottom, base.right],
    imagePath: structure.rightFace,
    fallbackColor: "rgba(105, 95, 92, 0.95)",
    className: "structure-right-face",
    sourceWidth: DEFAULT_FACE_WIDTH,
    sourceHeight: DEFAULT_FACE_HEIGHT
  });

  drawStructureTop({
    parentGroup: group,
    points: [roof.top, roof.right, roof.bottom, roof.left],
    imagePath: structure.roof,
    fallbackColor: "rgba(121, 68, 76, 0.96)",
    className: "structure-roof",
    sourceSize: DEFAULT_ROOF_SIZE
  });

  parent.appendChild(group);
}

function drawStructureFace({
  parentGroup,
  points,
  imagePath,
  fallbackColor,
  className,
  sourceWidth,
  sourceHeight
}) {
  const fallback = makePolygon(points, `${className} structure-face`, fallbackColor);
  fallback.setAttribute("stroke", "none");
  parentGroup.appendChild(fallback);

  if (imagePath) {
    const clipId = `structure-face-clip-${structureClipId += 1}`;
    const clipPath = svgEl("clipPath");
    clipPath.setAttribute("id", clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
    clipPath.appendChild(makePolygon(points, `${className}-clip`, "#fff"));
    parentGroup.appendChild(clipPath);

    const textureGroup = svgEl("g");
    textureGroup.setAttribute("clip-path", `url(#${clipId})`);

    const image = svgEl("image");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", String(sourceWidth));
    image.setAttribute("height", String(sourceHeight));
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

    image.setAttribute(
      "transform",
      `matrix(${ux / sourceWidth} ${uy / sourceWidth} ${vx / sourceHeight} ${vy / sourceHeight} ${topStart.x} ${topStart.y})`
    );

    textureGroup.appendChild(image);
    parentGroup.appendChild(textureGroup);
  }

  const outline = makePolygon(points, `${className} structure-outline`, "none");
  outline.setAttribute("stroke", "rgba(20, 16, 18, 0.9)");
  outline.setAttribute("stroke-width", "1.25");
  outline.setAttribute("stroke-linejoin", "round");
  parentGroup.appendChild(outline);
}

function drawStructureTop({
  parentGroup,
  points,
  imagePath,
  fallbackColor,
  className,
  sourceSize
}) {
  const fallback = makePolygon(points, `${className} structure-top`, fallbackColor);
  fallback.setAttribute("stroke", "none");
  parentGroup.appendChild(fallback);

  if (imagePath) {
    const clipId = `structure-roof-clip-${structureClipId += 1}`;
    const clipPath = svgEl("clipPath");
    clipPath.setAttribute("id", clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
    clipPath.appendChild(makePolygon(points, `${className}-clip`, "#fff"));
    parentGroup.appendChild(clipPath);

    const textureGroup = svgEl("g");
    textureGroup.setAttribute("clip-path", `url(#${clipId})`);

    const image = svgEl("image");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", String(sourceSize));
    image.setAttribute("height", String(sourceSize));
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

    image.setAttribute(
      "transform",
      `matrix(${ux / sourceSize} ${uy / sourceSize} ${vx / sourceSize} ${vy / sourceSize} ${topLeft.x} ${topLeft.y})`
    );

    textureGroup.appendChild(image);
    parentGroup.appendChild(textureGroup);
  }

  const outline = makePolygon(points, `${className} structure-outline`, "none");
  outline.setAttribute("stroke", "rgba(20, 16, 18, 0.95)");
  outline.setAttribute("stroke-width", "1.25");
  outline.setAttribute("stroke-linejoin", "round");
  parentGroup.appendChild(outline);
}

function renderTopStructure(state, item, parent) {
  const cellSize = getTopdownCellSize(state);
  const x = item.screenX;
  const y = item.screenY;
  const size = cellSize;

  const group = svgEl("g");
  group.setAttribute("class", "structure structure-v1 structure-topdown");
  group.setAttribute("pointer-events", "none");

  const rect = svgEl("rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(size));
  rect.setAttribute("height", String(size));
  rect.setAttribute("fill", "rgba(180, 96, 108, 0.42)");
  rect.setAttribute("stroke", "rgba(255,255,255,0.52)");
  rect.setAttribute("stroke-width", "1.5");
  group.appendChild(rect);

  const line = svgEl("line");
  line.setAttribute("x1", String(x + 3));
  line.setAttribute("y1", String(y + 3));
  line.setAttribute("x2", String(x + size - 3));
  line.setAttribute("y2", String(y + size - 3));
  line.setAttribute("stroke", "rgba(255,255,255,0.4)");
  line.setAttribute("stroke-width", "1");
  group.appendChild(line);

  parent.appendChild(group);
}
