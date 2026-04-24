// src/render/renderTerrain.js

import { GAME_CONFIG, RENDER_CONFIG } from "../config.js";
import {
  tileTypeFromElevation,
  detailTypeFromFineElevation,
  formatDetailElevation
} from "../map.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { getTopdownCellSize } from "./projection.js";
import { getWorldFaceForScreenSide } from "./renderCompass.js";

let terrainFaceClipId = 0;
let terrainTopClipId = 0;

export function renderTerrainTile(state, item, parent) {
  if (state.ui.viewMode === "top") {
    drawTopTerrainCell(state, item, parent);
    return;
  }

  drawIsoTerrainCell(state, item, parent);
}

export function renderEditorTile(tile, x, y, px, py, cellWidth, cellHeight, parent, options = {}) {
  const group = svgEl("g");
  const isSelected = options.selected === true;
  const isPreview = options.preview === true;

  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorCellColor(tile));
  rect.setAttribute("class", isSelected ? "editor-cell editor-cell-selected" : "editor-cell");
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);
  group.appendChild(rect);

  if (isPreview) {
    const preview = svgEl("rect");
    preview.setAttribute("x", px + 1.5);
    preview.setAttribute("y", py + 1.5);
    preview.setAttribute("width", Math.max(0, cellWidth - 3));
    preview.setAttribute("height", Math.max(0, cellHeight - 3));
    preview.setAttribute("class", "editor-brush-preview");
    preview.dataset.x = String(x);
    preview.dataset.y = String(y);
    group.appendChild(preview);
  }

  const showLabel = cellWidth >= 18 && cellHeight >= 18;
  if (showLabel) {
    const label = makeText(
      px + (cellWidth / 2),
      py + (cellHeight / 2),
      String(tile.elevation),
      cellWidth >= 26 ? "editor-detail-text-large" : "editor-text"
    );
    group.appendChild(label);
  }

  if (tile.spawnId) {
    const marker = svgEl("circle");
    marker.setAttribute("cx", px + (cellWidth * 0.18));
    marker.setAttribute("cy", py + (cellHeight * 0.18));
    marker.setAttribute("r", Math.max(5, Math.min(cellWidth, cellHeight) * 0.13));
    marker.setAttribute("class", tile.spawnId.startsWith("enemy_") ? "editor-spawn-marker editor-spawn-marker-enemy" : "editor-spawn-marker editor-spawn-marker-player");
    group.appendChild(marker);

    const spawnLabel = makeText(
      px + (cellWidth * 0.18),
      py + (cellHeight * 0.18),
      String(tile.spawnId).split("_")[1] ?? "",
      "editor-spawn-text"
    );
    group.appendChild(spawnLabel);
  }

  if (tile.movementClass && tile.movementClass !== "clear") {
    const badgeWidth = Math.max(12, cellWidth * 0.28);
    const badgeHeight = Math.max(10, cellHeight * 0.2);
    const badge = svgEl("rect");
    badge.setAttribute("x", px + cellWidth - badgeWidth - 2);
    badge.setAttribute("y", py + 2);
    badge.setAttribute("rx", 3);
    badge.setAttribute("ry", 3);
    badge.setAttribute("width", badgeWidth);
    badge.setAttribute("height", badgeHeight);
    badge.setAttribute("class", `editor-movement-badge editor-movement-badge-${tile.movementClass}`);
    group.appendChild(badge);

    if (cellWidth >= 24) {
      const badgeText = makeText(
        px + cellWidth - (badgeWidth / 2) - 2,
        py + 2 + (badgeHeight / 2),
        movementClassLabel(tile.movementClass),
        "editor-badge-text"
      );
      group.appendChild(badgeText);
    }
  }

  parent.appendChild(group);
}

export function renderEditorMiniTile(tile, x, y, px, py, cellWidth, cellHeight, parent, options = {}) {
  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorCellColor(tile));
  rect.setAttribute(
    "class",
    options.selected ? "editor-cell-mini editor-cell-mini-selected" : "editor-cell-mini"
  );
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);
  parent.appendChild(rect);
}

export function renderEditorDetailCell(
  detailCell,
  mechX,
  mechY,
  subX,
  subY,
  px,
  py,
  cellWidth,
  cellHeight,
  parent,
  options = {}
) {
  const group = svgEl("g");

  const rect = svgEl("rect");
  rect.setAttribute("x", px);
  rect.setAttribute("y", py);
  rect.setAttribute("width", cellWidth);
  rect.setAttribute("height", cellHeight);
  rect.setAttribute("fill", editorDetailCellColor(detailCell.elevation));
  rect.setAttribute(
    "class",
    options.large ? "editor-cell-detail editor-cell-detail-large" : "editor-cell-detail"
  );
  rect.dataset.mx = String(mechX);
  rect.dataset.my = String(mechY);
  rect.dataset.sx = String(subX);
  rect.dataset.sy = String(subY);

  group.appendChild(rect);

  const showLabel = options.large ? cellWidth >= 28 : cellWidth >= 10;

  if (showLabel) {
    const label = makeText(
      px + (cellWidth / 2),
      py + (cellHeight / 2),
      formatDetailElevation(detailCell.elevation),
      options.large ? "editor-detail-text-large" : "editor-text"
    );
    group.appendChild(label);
  }

  parent.appendChild(group);
}

function drawIsoTerrainCell(state, item, parent) {
  const {
    x,
    y,
    elevation,
    size = 1,
    screenX,
    screenY,
    leftFaceHeight = elevation,
    rightFaceHeight = elevation,
    fineElevation = null,
    tileOverlayStyle = null
  } = item;

  const type = fineElevation === null
    ? tileTypeFromElevation(elevation)
    : detailTypeFromFineElevation(fineElevation);
  const colors = resolveTerrainColors(state, item, type, fineElevation);
  const sprites = resolveTerrainSprites(state, item, fineElevation);

  const halfW = (RENDER_CONFIG.isoTileWidth * size) / 2;
  const halfH = (RENDER_CONFIG.isoTileHeight * size) / 2;
  const leftHeightPx = leftFaceHeight * RENDER_CONFIG.elevationStepPx;
  const rightHeightPx = rightFaceHeight * RENDER_CONFIG.elevationStepPx;

  const top = {
    top: { x: screenX, y: screenY },
    right: { x: screenX + halfW, y: screenY + halfH },
    bottom: { x: screenX, y: screenY + (halfH * 2) },
    left: { x: screenX - halfW, y: screenY + halfH }
  };

  const group = svgEl("g");
  group.dataset.x = String(x);
  group.dataset.y = String(y);

  if (leftHeightPx > 0) {
    const leftFace = [
      top.left,
      top.bottom,
      { x: top.bottom.x, y: top.bottom.y + leftHeightPx },
      { x: top.left.x, y: top.left.y + leftHeightPx }
    ];

    const leftWorldFace = getWorldFaceForScreenSide(state.rotation, "left");
    drawIsoTerrainFace({
      parentGroup: group,
      points: leftFace,
      className: "tile-left",
      fallbackColor: colors.left,
      strokeColor: darkerTerrainGridStroke(colors.left),
      imagePath: getTerrainFaceSprite(sprites, leftWorldFace),
      faceHeightPx: leftHeightPx
    });
  }

  if (rightHeightPx > 0) {
    const rightFace = [
      top.right,
      top.bottom,
      { x: top.bottom.x, y: top.bottom.y + rightHeightPx },
      { x: top.right.x, y: top.right.y + rightHeightPx }
    ];

    const rightWorldFace = getWorldFaceForScreenSide(state.rotation, "right");
    drawIsoTerrainFace({
      parentGroup: group,
      points: rightFace,
      className: "tile-right",
      fallbackColor: colors.right,
      strokeColor: darkerTerrainGridStroke(colors.right),
      imagePath: getTerrainFaceSprite(sprites, rightWorldFace),
      faceHeightPx: rightHeightPx
    });
  }

  const topFace = [top.top, top.right, top.bottom, top.left];

  drawIsoTerrainTop({
    parentGroup: group,
    points: topFace,
    fallbackColor: colors.top,
    strokeColor: darkerTerrainGridStroke(colors.top),
    imagePath: sprites.top,
    textureRotation: state.rotation
  });

  if (tileOverlayStyle?.fill) {
    const overlayFill = makePolygon(topFace, "tile-top-overlay-fill", tileOverlayStyle.fill);
    overlayFill.setAttribute("pointer-events", "none");
    group.appendChild(overlayFill);
  }

  const outline = makePolygon(topFace, "tile-outline", "none");
  if (tileOverlayStyle?.stroke) {
    outline.setAttribute("stroke", tileOverlayStyle.stroke);
    outline.setAttribute("stroke-width", String(tileOverlayStyle.strokeWidth ?? 2.5));
    outline.setAttribute("paint-order", "stroke fill");
    outline.setAttribute("stroke-linejoin", "round");
  }
  group.appendChild(outline);

  parent.appendChild(group);
}

function drawTopTerrainCell(state, item, parent) {
  const {
    x,
    y,
    elevation,
    screenX,
    screenY,
    size = 1,
    fineElevation = null,
    tileOverlayStyle = null
  } = item;

  const type = fineElevation === null
    ? tileTypeFromElevation(elevation)
    : detailTypeFromFineElevation(fineElevation);
  const colors = resolveTerrainColors(state, item, type, fineElevation);
  const sprites = resolveTerrainSprites(state, item, fineElevation);
  const cellSize = getTopdownCellSize(state);
  const sizePx = cellSize * size;

  const rect = svgEl("rect");
  rect.setAttribute("x", screenX);
  rect.setAttribute("y", screenY);
  rect.setAttribute("width", sizePx);
  rect.setAttribute("height", sizePx);
  const topFill = sprites.top
    ? getTerrainPatternFill(parent, sprites.top, colors.top, "top")
    : colors.top;
  rect.setAttribute("fill", topFill);
  rect.setAttribute("stroke", tileOverlayStyle?.stroke ?? "rgba(255,255,255,0.08)");
  rect.setAttribute("stroke-width", String(tileOverlayStyle?.strokeWidth ?? (size < 1 ? 0.5 : 1)));
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);

  parent.appendChild(rect);

  if (tileOverlayStyle?.fill) {
    const inset = Math.max(1, sizePx * 0.08);
    const overlay = svgEl("rect");
    overlay.setAttribute("x", screenX + inset);
    overlay.setAttribute("y", screenY + inset);
    overlay.setAttribute("width", Math.max(0, sizePx - (inset * 2)));
    overlay.setAttribute("height", Math.max(0, sizePx - (inset * 2)));
    overlay.setAttribute("fill", tileOverlayStyle.fill);
    overlay.setAttribute("stroke", "none");
    overlay.setAttribute("pointer-events", "none");
    parent.appendChild(overlay);
  }

  if (size >= 1 && elevation > 0) {
    const label = makeText(
      screenX + sizePx - 6,
      screenY + 13,
      Number.isInteger(elevation) ? String(elevation) : elevation.toFixed(2).replace(/\.?0+$/, ""),
      "top-elevation-label"
    );
    label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "rgba(255,255,255,0.9)");
    label.setAttribute("font-size", "12");
    parent.appendChild(label);
  }
}


function applyTerrainFaceStroke(polygon, strokeColor) {
  polygon.setAttribute("stroke", strokeColor);
  polygon.setAttribute("stroke-width", "1");
}

function darkerTerrainGridStroke(fillColor) {
  return shiftHexBrightness(fillColor, -24);
}

function resolveTerrainColors(state, tileLike, fallbackType, fineElevation = null) {
  if (fineElevation !== null) {
    const definition = getTerrainDefinition(state, tileLike.terrainTypeId);
    const top = definition?.baseColor ?? tileColors(fallbackType).top;
    return {
      top,
      left: shiftHexBrightness(top, -28),
      right: shiftHexBrightness(top, -16)
    };
  }

  const definition = getTerrainDefinition(state, tileLike.terrainTypeId);
  const top = definition?.baseColor ?? editorCellColor(tileLike);
  return {
    top,
    left: shiftHexBrightness(top, -28),
    right: shiftHexBrightness(top, -16)
  };
}

function resolveTerrainSprites(state, tileLike, fineElevation = null) {
  const definition = getTerrainDefinition(state, tileLike.terrainTypeId);
  if (!definition) {
    return { top: null, face: null, faces: {} };
  }

  const legacyFace = normalizeSpritePath(definition.faceSprite);
  const sourceFaces = definition.faceSprites && typeof definition.faceSprites === "object"
    ? definition.faceSprites
    : {};

  return {
    top: normalizeSpritePath(definition.topSprite),
    face: legacyFace,
    faces: {
      ne: normalizeSpritePath(sourceFaces.ne) ?? legacyFace,
      se: normalizeSpritePath(sourceFaces.se) ?? legacyFace,
      sw: normalizeSpritePath(sourceFaces.sw) ?? legacyFace,
      nw: normalizeSpritePath(sourceFaces.nw) ?? legacyFace
    }
  };
}

function getTerrainFaceSprite(sprites, worldFace) {
  const faceKey = String(worldFace ?? "").toLowerCase();
  return sprites?.faces?.[faceKey] ?? sprites?.face ?? null;
}

function getTerrainDefinition(state, terrainTypeId) {
  const id = terrainTypeId ?? "grass";
  return state?.content?.terrainDefinitions?.[id] ?? null;
}

function normalizeSpritePath(path) {
  const value = String(path ?? "").trim();
  return value || null;
}


function drawIsoTerrainTop({
  parentGroup,
  points,
  fallbackColor,
  strokeColor,
  imagePath,
  textureRotation = 0
}) {
  const fallbackPolygon = makePolygon(points, "tile-top", fallbackColor);
  fallbackPolygon.setAttribute("stroke", "none");
  parentGroup.appendChild(fallbackPolygon);

  if (imagePath) {
    const clipId = `terrain-top-clip-${terrainTopClipId += 1}`;

    const clipPath = svgEl("clipPath");
    clipPath.setAttribute("id", clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

    const clipPolygon = makePolygon(points, "tile-top-clip", "#fff");
    clipPath.appendChild(clipPolygon);
    parentGroup.appendChild(clipPath);

    const textureGroup = svgEl("g");
    textureGroup.setAttribute("clip-path", `url(#${clipId})`);

    appendSkewedTopTexture({
      parentGroup: textureGroup,
      topLeft: points[3],
      topAxisEnd: points[0],
      sideAxisEnd: points[2],
      imagePath,
      textureRotation
    });

    parentGroup.appendChild(textureGroup);
  }

  const outline = makePolygon(points, "tile-top", "none");
  applyTerrainFaceStroke(outline, strokeColor);
  parentGroup.appendChild(outline);
}

function appendSkewedTopTexture({
  parentGroup,
  topLeft,
  topAxisEnd,
  sideAxisEnd,
  imagePath,
  textureRotation = 0
}) {
  const ux = topAxisEnd.x - topLeft.x;
  const uy = topAxisEnd.y - topLeft.y;
  const vx = sideAxisEnd.x - topLeft.x;
  const vy = sideAxisEnd.y - topLeft.y;
  const sourceSize = Math.max(1, Math.hypot(ux, uy), Math.hypot(vx, vy));

  const image = svgEl("image");
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", String(sourceSize));
  image.setAttribute("height", String(sourceSize));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("href", imagePath);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

  const baseA = ux / sourceSize;
  const baseB = uy / sourceSize;
  const baseC = vx / sourceSize;
  const baseD = vy / sourceSize;
  const baseE = topLeft.x;
  const baseF = topLeft.y;

  const rot = normalizeTopTextureRotation(textureRotation);
  const radians = (rot * -Math.PI) / 2;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const center = sourceSize / 2;

  // Rotate the source texture in tile-local space first, then map it into
  // the existing isometric top diamond. This keeps art inside the clip while
  // preventing directional top details from staying pinned to screen corners.
  const rotA = cos;
  const rotB = sin;
  const rotC = -sin;
  const rotD = cos;
  const rotE = center - (cos * center) + (sin * center);
  const rotF = center - (sin * center) - (cos * center);

  const a = (baseA * rotA) + (baseC * rotB);
  const b = (baseB * rotA) + (baseD * rotB);
  const c = (baseA * rotC) + (baseC * rotD);
  const d = (baseB * rotC) + (baseD * rotD);
  const e = (baseA * rotE) + (baseC * rotF) + baseE;
  const f = (baseB * rotE) + (baseD * rotF) + baseF;

  image.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
  parentGroup.appendChild(image);
}

function normalizeTopTextureRotation(rotation = 0) {
  const value = Number(rotation ?? 0);
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 4) + 4) % 4;
}

function drawIsoTerrainFace({
  parentGroup,
  points,
  className,
  fallbackColor,
  strokeColor,
  imagePath,
  faceHeightPx
}) {
  const fallbackPolygon = makePolygon(points, className, fallbackColor);
  fallbackPolygon.setAttribute("stroke", "none");
  parentGroup.appendChild(fallbackPolygon);

  if (imagePath) {
    const clipId = `terrain-face-clip-${terrainFaceClipId += 1}`;

    const clipPath = svgEl("clipPath");
    clipPath.setAttribute("id", clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

    const clipPolygon = makePolygon(points, `${className}-clip`, "#fff");
    clipPath.appendChild(clipPolygon);
    parentGroup.appendChild(clipPath);

    const textureGroup = svgEl("g");
    textureGroup.setAttribute("clip-path", `url(#${clipId})`);

    appendSkewedFaceTextureBands({
      parentGroup: textureGroup,
      topStart: points[0],
      topEnd: points[1],
      imagePath,
      faceHeightPx
    });

    parentGroup.appendChild(textureGroup);
  }

  const outline = makePolygon(points, className, "none");
  applyTerrainFaceStroke(outline, strokeColor);
  parentGroup.appendChild(outline);
}

function appendSkewedFaceTextureBands({
  parentGroup,
  topStart,
  topEnd,
  imagePath,
  faceHeightPx
}) {
  const dx = topEnd.x - topStart.x;
  const dy = topEnd.y - topStart.y;
  const faceWidth = Math.max(1, Math.hypot(dx, dy));
  const bandHeight = Math.max(8, RENDER_CONFIG.elevationStepPx);
  const totalHeight = Math.max(0, faceHeightPx);
  const bandCount = Math.max(1, Math.ceil(totalHeight / bandHeight));

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const yOffset = bandIndex * bandHeight;
    const currentBandHeight = Math.min(bandHeight, totalHeight - yOffset);
    if (currentBandHeight <= 0) continue;

    const image = svgEl("image");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", String(faceWidth));
    image.setAttribute("height", String(currentBandHeight));
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("href", imagePath);
    image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

    const a = dx / faceWidth;
    const b = dy / faceWidth;
    const c = 0;
    const d = 1;
    const e = topStart.x;
    const f = topStart.y + yOffset;

    image.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
    parentGroup.appendChild(image);
  }
}


function getTerrainPatternFill(parent, imagePath, fallbackColor, role) {
  const svg = parent?.ownerSVGElement ?? parent;
  if (!svg) return fallbackColor;

  const patternId = terrainPatternId(imagePath, role);
  let pattern = svg.querySelector(`[id="${patternId}"]`);

  if (!pattern) {
    pattern = buildTerrainPattern(patternId, imagePath, fallbackColor, role);
    const defs = ensureSvgDefs(svg);
    defs.appendChild(pattern);
  }

  return `url(#${patternId})`;
}

function ensureSvgDefs(svg) {
  let defs = Array.from(svg.children).find((child) => child.tagName?.toLowerCase() === "defs") ?? null;
  if (!defs) {
    defs = svgEl("defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  return defs;
}

function buildTerrainPattern(patternId, imagePath, fallbackColor, role) {
  const isFace = role === "face";
  const width = RENDER_CONFIG.isoTileWidth;
  const height = isFace
    ? Math.max(8, RENDER_CONFIG.elevationStepPx)
    : RENDER_CONFIG.isoTileHeight;

  const pattern = svgEl("pattern");
  pattern.setAttribute("id", patternId);
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("width", String(width));
  pattern.setAttribute("height", String(height));

  const fallback = svgEl("rect");
  fallback.setAttribute("x", "0");
  fallback.setAttribute("y", "0");
  fallback.setAttribute("width", String(width));
  fallback.setAttribute("height", String(height));
  fallback.setAttribute("fill", fallbackColor);
  pattern.appendChild(fallback);

  const image = svgEl("image");
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", String(width));
  image.setAttribute("height", String(height));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("href", imagePath);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);
  pattern.appendChild(image);

  return pattern;
}

function terrainPatternId(imagePath, role) {
  const safe = String(imagePath)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `terrain-pattern-${role}-${safe}`;
}

export function tileColors(type) {
  switch (type) {
    case "peak":
      return {
        top: "#a08f72",
        left: "#6d5f49",
        right: "#85755c"
      };
    case "high":
      return {
        top: "#6f8b5e",
        left: "#506546",
        right: "#5e7751"
      };
    default:
      return {
        top: "#4e6b86",
        left: "#34495d",
        right: "#3e566d"
      };
  }
}

export function editorCellColor(tileOrElevation) {
  const tile = typeof tileOrElevation === "object" && tileOrElevation !== null
    ? tileOrElevation
    : { elevation: Number(tileOrElevation) || 0, terrainTypeId: "grass", movementClass: "clear", spawnId: null };

  const baseColor = terrainBaseColor(tile.terrainTypeId);
  const elevation = Number(tile.elevation ?? 0);
  let color = shiftHexBrightness(baseColor, Math.max(-35, Math.min(35, elevation * 8)));

  switch (tile.movementClass) {
    case "hazard":
      color = mixHex(color, "#b94d2f", 0.45);
      break;
    case "impassable":
      color = mixHex(color, "#2b2b2b", 0.42);
      break;
    case "difficult":
      color = mixHex(color, "#8f7d2f", 0.28);
      break;
    default:
      break;
  }

  if (tile.spawnId) color = mixHex(color, tile.spawnId.startsWith("enemy_") ? "#8c2b2b" : "#2b5f9b", 0.25);

  return color;
}

function movementClassLabel(movementClass) {
  switch (movementClass) {
    case "difficult": return "D";
    case "hazard": return "H";
    case "impassable": return "X";
    default: return "";
  }
}

export function editorDetailCellColor(fineElevation) {
  const type = detailTypeFromFineElevation(fineElevation);
  const colors = tileColors(type);
  return colors.top;
}

function terrainBaseColor(terrainTypeId) {
  switch (terrainTypeId) {
    case "rock": return "#7a7a72";
    case "sand": return "#c8b27a";
    case "water": return "#4c7ea8";
    case "asphalt": return "#4c4f55";
    case "concrete": return "#9a9a94";
    case "grass":
    default:
      return "#5f8f4f";
  }
}

function shiftHexBrightness(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(clamp255(r + amount), clamp255(g + amount), clamp255(b + amount));
}

function mixHex(a, b, ratio = 0.5) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    Math.round(ca.r + ((cb.r - ca.r) * t)),
    Math.round(ca.g + ((cb.g - ca.g) * t)),
    Math.round(ca.b + ((cb.b - ca.b) * t))
  );
}

function hexToRgb(hex) {
  const normalized = String(hex).replace("#", "").trim();
  const value = normalized.length === 3
    ? normalized.split("").map((ch) => ch + ch).join("")
    : normalized.padStart(6, "0").slice(0, 6);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp255(value).toString(16).padStart(2, "0")).join("")}`;
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
