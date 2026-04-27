// src/render/renderStructures.js
// Structure Render V2.5
// Keeps world-face lock, no sprite mirroring, and doorway openings reveal a
// recessed interior return plane so transparent doors read as depth, not void.

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
const DOOR_PATTERN = /(^|[_-])door([_-]|\.|$)/i;

export function getStructureSceneItems(state) {
  const list = getMapStructures(state?.map);
  const items = [];

  for (const raw of list) {
    const structure = normalizeStructureForMap(state, raw);
    if (!structure) continue;

    if (state.ui?.viewMode === "top") {
      items.push(makeTopItem(state, structure));
      continue;
    }

    const leftWorldFace = getWorldFaceForScreenSide(state.rotation, "left");
    const rightWorldFace = getWorldFaceForScreenSide(state.rotation, "right");

    const leftSprite = getStructureFaceSprite(structure, leftWorldFace);
    const rightSprite = getStructureFaceSprite(structure, rightWorldFace);

    if (leftSprite || structure.drawFallbackFaces) {
      items.push(makeFaceItem(state, structure, "left", leftWorldFace, leftSprite));
    }

    if (rightSprite || structure.drawFallbackFaces) {
      items.push(makeFaceItem(state, structure, "right", rightWorldFace, rightSprite));
    }

    if (structure.roofSprite) {
      items.push(makeRoofItem(state, structure));
    }
  }

  return items.filter(Boolean);
}

function makeFaceItem(state, structure, screenSide, worldFace, imagePath) {
  const g = geometry(state, structure);
  const points = screenSide === "left" ? g.leftFace : g.rightFace;
  const depth = getTerrainDepth({
    size: 1,
    screenY: g.base.screenY,
    leftFaceHeight: structure.elevation,
    rightFaceHeight: structure.elevation
  });

  return {
    kind: "structure_face",
    structureId: structure.id,
    screenSide,
    worldFace,
    points,
    imagePath,
    doorwayBacking: resolveDoorwayBacking(state, structure, screenSide, worldFace, imagePath, points),
    sortDepth: depth + (screenSide === "left" ? 0.36 : 0.37),
    sortKey: getSceneSortKey(state, structure.x, structure.y, structure.elevation) + (screenSide === "left" ? 0.1 : 0.2),
    render(parent) {
      drawFace(this, parent);
    }
  };
}

function makeRoofItem(state, structure) {
  const g = geometry(state, structure);
  const depth = getTerrainDepth({
    size: 1,
    screenY: g.base.screenY,
    leftFaceHeight: structure.elevation,
    rightFaceHeight: structure.elevation
  });

  return {
    kind: "structure_roof",
    structureId: structure.id,
    imagePath: structure.roofSprite,
    points: g.roof,
    textureRotation: state.rotation,
    sortDepth: depth + 0.42,
    sortKey: getSceneSortKey(state, structure.x, structure.y, structure.elevation + structure.heightLevels) + 0.3,
    render(parent) {
      drawRoof(this, parent);
    }
  };
}

function makeTopItem(state, structure) {
  const size = getTopdownCellSize(state);
  const p = projectScene(state, structure.x, structure.y, structure.elevation, 1);

  return {
    kind: "structure_topdown",
    x: p.x,
    y: p.y,
    width: size * structure.w,
    height: size * structure.h,
    sortDepth: p.y + 0.2,
    sortKey: getSceneSortKey(state, structure.x, structure.y, structure.elevation) + 0.2,
    render(parent) {
      drawTop(this, parent);
    }
  };
}

function geometry(state, structure) {
  const rise = structure.heightPx;
  const w = Math.max(1, Number(structure.w ?? 1));
  const h = Math.max(1, Number(structure.h ?? 1));

  // Structure anchoring must use the same board-space truth as units:
  // x/y identify the map cell footprint, then the renderer projects the actual
  // footprint corners for the current camera rotation. Do not build the box by
  // taking one projected point and adding fixed screen offsets; that drifts from
  // tile truth as the camera rotates.
  const footprintCorners = [
    projectScene(state, structure.x, structure.y, structure.elevation, 1),
    projectScene(state, structure.x + w, structure.y, structure.elevation, 1),
    projectScene(state, structure.x + w, structure.y + h, structure.elevation, 1),
    projectScene(state, structure.x, structure.y + h, structure.elevation, 1)
  ];

  const base = classifyProjectedDiamond(footprintCorners);

  const roof = {
    top: liftPoint(base.top, rise),
    right: liftPoint(base.right, rise),
    bottom: liftPoint(base.bottom, rise),
    left: liftPoint(base.left, rise)
  };

  return {
    base,
    roof: [roof.top, roof.right, roof.bottom, roof.left],
    leftFace: [roof.left, roof.bottom, base.bottom, base.left],
    rightFace: [roof.right, roof.bottom, base.bottom, base.right]
  };
}

function liftPoint(point, rise) {
  return { x: point.x, y: point.y - rise };
}

function classifyProjectedDiamond(points) {
  const sortedByY = [...points].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const top = sortedByY[0];
  const bottom = sortedByY[sortedByY.length - 1];
  const middle = sortedByY.slice(1, -1).sort((a, b) => a.x - b.x);
  const left = middle[0];
  const right = middle[middle.length - 1];

  return {
    screenY: top.y,
    top,
    right,
    bottom,
    left
  };
}

function resolveDoorwayBacking(state, structure, screenSide, worldFace, imagePath, frontFacePoints) {
  if (!looksLikeDoorSprite(imagePath)) return null;

  const backingSprite = resolveDoorwayBackingSprite(state, structure, worldFace);
  if (!backingSprite) return null;

  // The transparent pixels in door_*.png are the aperture mask.
  // Do NOT map the backing onto the same exterior face as the door.
  // That makes the doorway read as a flat wall pasted behind the hole.
  // Instead, map the texture onto a recessed return plane that runs inward
  // from the outside vertical edge of the face. The front door image still
  // clips/covers it, so only the transparent opening reveals this skewed depth.
  return {
    imagePath: backingSprite,
    points: makeDoorwayReturnPlanePoints(screenSide, frontFacePoints)
  };
}

function makeDoorwayReturnPlanePoints(screenSide, frontFacePoints) {
  if (!Array.isArray(frontFacePoints) || frontFacePoints.length < 4) return frontFacePoints;

  const topOuter = frontFacePoints[0];
  const bottomOuter = frontFacePoints[3];
  const topInnerOnFrontFace = frontFacePoints[1];

  // Face points are ordered as:
  //   [roof outer, roof/bottom shared edge, base/bottom shared edge, base outer]
  // for both visible side faces. The top edge vector lies along the exterior face.
  // Flipping its screen-Y component gives the roof-depth vector into the tile.
  const faceTopVector = {
    x: topInnerOnFrontFace.x - topOuter.x,
    y: topInnerOnFrontFace.y - topOuter.y
  };

  const depthScale = 1;
  const inward = {
    x: faceTopVector.x * depthScale,
    y: -faceTopVector.y * depthScale
  };

  const topInner = {
    x: topOuter.x + inward.x,
    y: topOuter.y + inward.y
  };
  const bottomInner = {
    x: bottomOuter.x + inward.x,
    y: bottomOuter.y + inward.y
  };

  return [topOuter, topInner, bottomInner, bottomOuter];
}

function resolveDoorwayBackingSprite(state, structure, worldFace) {
  const sameFaceInterior =
    getStructureInteriorSprite(structure, worldFace)
    ?? getStructureFaceSprite(structure, getOppositeWorldFace(worldFace))
    ?? getStructureInteriorSprite(structure, getOppositeWorldFace(worldFace));

  if (sameFaceInterior) return sameFaceInterior;

  const inward = getInteriorOffsetForWorldFace(worldFace);
  if (!inward) return null;

  const neighbor = findStructureAt(state, structure.x + inward.x, structure.y + inward.y, structure.id);
  if (!neighbor) return null;

  return getStructureFaceSprite(neighbor, worldFace)
    ?? getStructureInteriorSprite(neighbor, worldFace)
    ?? getStructureFaceSprite(neighbor, getOppositeWorldFace(worldFace))
    ?? getStructureInteriorSprite(neighbor, getOppositeWorldFace(worldFace));
}

function findStructureAt(state, x, y, excludedId = null) {
  const list = getMapStructures(state?.map);

  for (const raw of list) {
    const structure = normalizeStructureForMap(state, raw);
    if (!structure || structure.id === excludedId) continue;

    const withinX = x >= structure.x && x < (structure.x + (structure.w ?? 1));
    const withinY = y >= structure.y && y < (structure.y + (structure.h ?? 1));
    if (withinX && withinY) return structure;
  }

  return null;
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

function getOppositeWorldFace(worldFace) {
  switch (String(worldFace ?? "").toLowerCase()) {
    case "sw":
      return "ne";
    case "se":
      return "nw";
    case "ne":
      return "sw";
    case "nw":
      return "se";
    default:
      return worldFace;
  }
}

function looksLikeDoorSprite(imagePath) {
  return DOOR_PATTERN.test(String(imagePath ?? "").trim());
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

  if (item.doorwayBacking?.imagePath) {
    appendProjectedFaceImage(group, item.points, item.doorwayBacking.points, item.doorwayBacking.imagePath, "doorway-backing");
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

  if (item.imagePath) {
    appendRoofImage(group, item.points, item.imagePath, item.textureRotation);
  }

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

  image.setAttribute(
    "transform",
    `matrix(${ux / 32} ${uy / 32} ${vx / 64} ${vy / 64} ${topStart.x} ${topStart.y})`
  );

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
