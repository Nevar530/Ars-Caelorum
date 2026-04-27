// src/render/renderStructures.js
//
// Structure V1 renderer.
// This pass is visual-only: structures are read from map.structures and drawn as
// projected flat asset pieces. Movement/LOS authority comes in a later pass.
//
// V1.1 locks three render contracts:
// - transparent source pixels remain transparent; no fallback color is drawn behind valid images
// - face art is compass/world-face aware, matching terrain face behavior
// - each visible face/roof is its own scene item so basic front/behind sorting can work

import { RENDER_CONFIG } from "../config.js";
import { getTile, getTileRenderElevation } from "../map.js";
import { svgEl, makePolygon } from "../utils.js";
import { projectScene, getSceneSortKey, getTopdownCellSize } from "./projection.js";
import { getTerrainDepth } from "./renderSceneMath.js";
import { getScreenSideForWorldFace, getVisibleWorldFaces, normalizeWorldFace } from "./renderCompass.js";

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

    if (state.ui?.viewMode === "top") {
      items.push(makeTopdownStructureItem(state, normalized, projected, elevation));
      continue;
    }

    const geometry = buildIsoStructureGeometry(projected.x, projected.y, normalized.heightPx);
    const visibleFaces = getVisibleWorldFaces(state.rotation).visible;

    for (const worldFace of visibleFaces) {
      const screenSide = getScreenSideForWorldFace(state.rotation, worldFace);
      const points = screenSide === "left"
        ? [geometry.roof.left, geometry.roof.bottom, geometry.base.bottom, geometry.base.left]
        : [geometry.roof.right, geometry.roof.bottom, geometry.base.bottom, geometry.base.right];

      items.push(makeIsoStructurePieceItem({
        state,
        structure: normalized,
        projected,
        elevation,
        points,
        piece: "face",
        worldFace,
        screenSide,
        imagePath: getStructureFaceSprite(normalized, worldFace),
        fallbackColor: screenSide === "left" ? "rgba(92, 83, 90, 0.95)" : "rgba(105, 95, 92, 0.95)",
        className: `structure-${screenSide}-face structure-face-${worldFace}`,
        depthBias: screenSide === "left" ? 0.12 : 0.18,
        render(parent) {
          renderIsoStructureFace(this, parent);
        }
      }));
    }

    items.push(makeIsoStructurePieceItem({
      state,
      structure: normalized,
      projected,
      elevation,
      points: [geometry.roof.top, geometry.roof.right, geometry.roof.bottom, geometry.roof.left],
      piece: "roof",
      worldFace: "top",
      screenSide: "top",
      imagePath: normalized.roof,
      fallbackColor: "rgba(121, 68, 76, 0.96)",
      className: "structure-roof",
      depthBias: 0.3,
      render(parent) {
        renderIsoStructureRoof(this, parent);
      }
    }));
  }

  return items;
}

function normalizeStructure(raw) {
  if (!raw || typeof raw !== "object") return null;

  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const faceSprites = normalizeFaceSprites(raw);

  return {
    id: String(raw.id ?? `structure_${x}_${y}`),
    x,
    y,
    w: Math.max(1, Number(raw.w ?? 1) || 1),
    h: Math.max(1, Number(raw.h ?? 1) || 1),
    heightPx: Math.max(1, Number(raw.heightPx ?? DEFAULT_FACE_HEIGHT) || DEFAULT_FACE_HEIGHT),
    face: normalizeAssetPath(raw.face),
    faceSprites,
    roof: normalizeAssetPath(raw.roof)
  };
}

function normalizeFaceSprites(raw) {
  const source = raw.faceSprites && typeof raw.faceSprites === "object"
    ? raw.faceSprites
    : raw.faces && typeof raw.faces === "object"
      ? raw.faces
      : {};

  const faces = {};
  for (const key of ["ne", "se", "sw", "nw"]) {
    faces[key] = normalizeAssetPath(source[key]);
  }

  // Legacy compatibility from the V1 test map:
  // rotation 0 screen-left == sw, screen-right == se.
  if (!faces.sw && raw.leftFace) faces.sw = normalizeAssetPath(raw.leftFace);
  if (!faces.se && raw.rightFace) faces.se = normalizeAssetPath(raw.rightFace);

  const fallback = normalizeAssetPath(raw.face ?? raw.wall ?? raw.leftFace ?? raw.rightFace);
  for (const key of ["ne", "se", "sw", "nw"]) {
    if (!faces[key]) faces[key] = fallback;
  }

  return faces;
}

function normalizeAssetPath(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.startsWith("./") || text.startsWith("/") || text.includes("/")) return text;
  return `${STRUCTURE_ART_ROOT}${text}`;
}

function getStructureFaceSprite(structure, worldFace) {
  const face = normalizeWorldFace(worldFace);
  return face ? structure.faceSprites?.[face] ?? structure.face ?? null : null;
}

function makeTopdownStructureItem(state, structure, projected, elevation) {
  return {
    kind: "structure",
    sourceKind: "structure",
    piece: "topdown",
    id: `${structure.id}:topdown`,
    x: structure.x,
    y: structure.y,
    elevation,
    screenX: projected.x,
    screenY: projected.y,
    structure,
    sortDepth: projected.y + getTopdownCellSize(state),
    sortKey: getSceneSortKey(state, structure.x, structure.y, elevation) + 0.5,
    render(parent) {
      renderTopStructure(state, this, parent);
    }
  };
}

function makeIsoStructurePieceItem({
  state,
  structure,
  projected,
  elevation,
  points,
  piece,
  worldFace,
  screenSide,
  imagePath,
  fallbackColor,
  className,
  depthBias,
  render
}) {
  return {
    kind: "structure_piece",
    sourceKind: "structure",
    piece,
    worldFace,
    screenSide,
    id: `${structure.id}:${piece}:${worldFace}`,
    x: structure.x,
    y: structure.y,
    elevation,
    screenX: projected.x,
    screenY: projected.y,
    heightPx: structure.heightPx,
    structure,
    points,
    imagePath,
    fallbackColor,
    className,
    sortDepth: getStructurePieceDepth(state, structure, projected, elevation, piece, screenSide),
    sortKey: getSceneSortKey(state, structure.x, structure.y, elevation) + depthBias,
    render
  };
}

function getStructurePieceDepth(state, structure, projected, elevation, piece, screenSide) {
  const baseDepth = getTerrainDepth({
    size: 1,
    screenY: projected.y,
    leftFaceHeight: elevation,
    rightFaceHeight: elevation
  });

  if (piece === "roof") {
    return baseDepth + structure.heightPx + 0.3;
  }

  return baseDepth + structure.heightPx + (screenSide === "right" ? 0.18 : 0.12);
}

function buildIsoStructureGeometry(screenX, screenY, heightPx) {
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

  return { base, roof };
}

function renderIsoStructureFace(item, parent) {
  const group = makeStructureGroup(item);

  drawStructureFace({
    parentGroup: group,
    points: item.points,
    imagePath: item.imagePath,
    fallbackColor: item.fallbackColor,
    className: item.className,
    sourceWidth: DEFAULT_FACE_WIDTH,
    sourceHeight: DEFAULT_FACE_HEIGHT
  });

  parent.appendChild(group);
}

function renderIsoStructureRoof(item, parent) {
  const group = makeStructureGroup(item);

  drawStructureTop({
    parentGroup: group,
    points: item.points,
    imagePath: item.imagePath,
    fallbackColor: item.fallbackColor,
    className: item.className,
    sourceSize: DEFAULT_ROOF_SIZE
  });

  parent.appendChild(group);
}

function makeStructureGroup(item) {
  const group = svgEl("g");
  group.setAttribute("class", `structure structure-v1 ${item.className}`);
  group.dataset.structureId = item.structure.id;
  group.dataset.structurePiece = item.piece;
  group.dataset.worldFace = item.worldFace;
  group.dataset.screenSide = item.screenSide;
  group.dataset.x = String(item.structure.x);
  group.dataset.y = String(item.structure.y);
  group.setAttribute("pointer-events", "none");
  return group;
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
  if (!imagePath) {
    const fallback = makePolygon(points, `${className} structure-face`, fallbackColor);
    fallback.setAttribute("stroke", "none");
    parentGroup.appendChild(fallback);
  }

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
  if (!imagePath) {
    const fallback = makePolygon(points, `${className} structure-top`, fallbackColor);
    fallback.setAttribute("stroke", "none");
    parentGroup.appendChild(fallback);
  }

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
