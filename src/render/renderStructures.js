// src/render/renderStructures.js
//
// Structure Render V3
// Board truth: structure cells + real world edge parts + separate roof.
// No prefab boxes. No left/right face swapping. Rotation only changes projection.

import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { projectScene, getTopdownCellSize, getSceneSortKey } from "./projection.js";
import { getWorldFaceForScreenSide } from "./renderCompass.js";
import { getTerrainDepth } from "./renderSceneMath.js";
import {
  getMapStructures,
  getStructureCells,
  getStructureEdgeParts,
  normalizeStructureForMap
} from "../structures/structureRules.js";

let clipId = 0;

const EDGE_FALLBACK_COLOR = "rgb(80,74,84)";
const ROOF_COLOR = "rgb(120,68,86)";
const FLOOR_COLOR = "rgba(42,38,50,0.62)";
const DEBUG_CELL_COLOR = "rgba(255, 221, 80, 0.16)";
const DEBUG_EDGE_COLOR = "rgba(255, 221, 80, 0.78)";
const TRANSPARENT_EDGE_TYPES = new Set(["door", "window", "open"]);


export function getStructureSceneItems(state) {
  const list = getMapStructures(state?.map);
  const items = [];

  for (const raw of list) {
    const structure = normalizeStructureForMap(state, raw);
    if (!structure) continue;

    if (state.ui?.viewMode === "top") {
      items.push(...makeTopItems(state, structure));
      continue;
    }

    items.push(...makeFloorItems(state, structure));
    items.push(...makeEdgeItems(state, structure));
    items.push(...makeRoofItems(state, structure));

    if (structure.debug) {
      items.push(...makeDebugItems(state, structure));
    }
  }

  return items.filter(Boolean);
}

function makeTopItems(state, structure) {
  const size = getTopdownCellSize(state);
  const items = [];

  for (const cell of getStructureCells(structure)) {
    const p = projectScene(state, cell.x, cell.y, structure.elevation, 1);

    items.push({
      kind: "structure_topdown_cell",
      x: p.x,
      y: p.y,
      width: size,
      height: size,
      sortDepth: p.y + 0.2,
      sortKey: getSceneSortKey(state, cell.x, cell.y, structure.elevation) + 0.2,
      render(parent) {
        const rect = svgEl("rect");
        rect.setAttribute("x", String(this.x));
        rect.setAttribute("y", String(this.y));
        rect.setAttribute("width", String(this.width));
        rect.setAttribute("height", String(this.height));
        rect.setAttribute("fill", "rgba(180,120,170,0.34)");
        rect.setAttribute("stroke", "rgba(255,255,255,0.72)");
        rect.setAttribute("stroke-width", "2");
        rect.setAttribute("pointer-events", "none");
        parent.appendChild(rect);
      }
    });
  }

  return items;
}

function makeFloorItems(state, structure) {
  // Floors/interior fills are normally opt-in. If a room is revealed, the
  // floor remains visible under that room's roof cutaway. This is render-only;
  // movement/LOS still come from map edge height truth.
  const revealInfo = getStructureRevealInfo(state, structure);
  if (!structure.floorSprite && structure.showInteriorFloor !== true && !revealInfo.revealsAny) return [];

  const items = [];

  for (const cell of getStructureCells(structure)) {
    const points = getCellRoofOrFloorPoints(state, cell.x, cell.y, structure.elevation, 0);
    const screenY = Math.max(...points.map((point) => point.y));

    items.push({
      kind: "structure_floor",
      structureId: structure.id,
      cell,
      points,
      imagePath: structure.floorSprite,
      sortDepth: screenY - 0.25,
      sortKey: getSceneSortKey(state, cell.x, cell.y, structure.elevation) - 0.25,
      render(parent) {
        drawFloor(this, parent);
      }
    });
  }

  return items;
}

function makeEdgeItems(state, structure) {
  const items = [];
  const fadeInfo = getStructureFadeInfo(state, structure);

  for (const edgePart of getStructureEdgeParts(structure)) {
    if (!edgePart?.sprite && edgePart?.type === "open") continue;

    const points = getEdgePlanePoints(
      state,
      edgePart.x,
      edgePart.y,
      edgePart.edge,
      structure.elevation,
      structure.heightPx
    );

    if (!points) continue;

    const screenY = Math.max(...points.map((point) => point.y));
    const midpoint = getMidpoint(points[2], points[3]);

    items.push({
      kind: "structure_edge",
      structureId: structure.id,
      edgePart,
      points,
      imagePath: edgePart.sprite,
      opacity: shouldFadeEdgeForInteriorView(state, fadeInfo, edgePart) ? 0.2 : 1,
      sortDepth: screenY + 0.18,
      sortKey:
        getSceneSortKey(state, midpoint.worldX ?? edgePart.x, midpoint.worldY ?? edgePart.y, structure.elevation) +
        edgeSortBias(edgePart.edge),
      render(parent) {
        drawEdge(this, parent);
      }
    });
  }

  return items;
}

function makeRoofItems(state, structure) {
  const items = [];

  if (!structure.roofSprite) return items;

  const revealInfo = getStructureRevealInfo(state, structure);
  if (revealInfo.revealWholeStructure) return items;

  for (const cell of getStructureCells(structure)) {
    if (isCellRoofRevealed(cell, revealInfo)) continue;

    const floorPoints = getCellRoofOrFloorPoints(state, cell.x, cell.y, structure.elevation, 0);
    const points = getCellRoofOrFloorPoints(state, cell.x, cell.y, structure.elevation, structure.heightPx);
    const floorScreenY = Math.max(...floorPoints.map((point) => point.y));

    items.push({
      kind: "structure_roof",
      structureId: structure.id,
      cell,
      points,
      imagePath: structure.roofSprite,
      textureRotation: state.rotation,
      sortDepth: floorScreenY + structure.heightPx + 0.42,
      sortKey: getSceneSortKey(state, cell.x, cell.y, structure.elevation + structure.heightLevels) + 0.3,
      render(parent) {
        drawRoof(this, parent);
      }
    });
  }

  return items;
}

function getStructureRevealInfo(state, structure) {
  const cellByKey = makeStructureCellLookup(structure);
  const revealedRoomIds = new Set();
  let revealsAny = false;
  let revealWholeStructure = false;

  for (const pos of getInteriorRevealPositions(state, structure, { includeAllPilots: true })) {
    const cell = cellByKey.get(makeCellKey(pos.x, pos.y));
    if (!cell) continue;

    revealsAny = true;

    if (cell.roomId) {
      revealedRoomIds.add(String(cell.roomId));
    } else {
      // Older maps do not have room zones. Preserve their previous behavior:
      // any pilot inside hides the full roof.
      revealWholeStructure = true;
    }
  }

  return {
    revealsAny,
    revealWholeStructure,
    revealedRoomIds
  };
}

function getStructureFadeInfo(state, structure) {
  const positions = getInteriorRevealPositions(state, structure, { includeAllPilots: false });
  const fadeCells = new Set();

  for (const pos of positions) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = Number(pos.x) + dx;
        const y = Number(pos.y) + dy;
        if (structure.cellKeys?.has(makeCellKey(x, y))) fadeCells.add(makeCellKey(x, y));
      }
    }
  }

  return { fadeCells };
}

function getInteriorRevealPositions(state, structure, options = {}) {
  const includeAllPilots = options.includeAllPilots === true;
  const positions = [];
  const cells = structure?.cellKeys instanceof Set
    ? structure.cellKeys
    : new Set(getStructureCells(structure).map((cell) => makeCellKey(cell.x, cell.y)));

  if (!cells.size) return positions;

  const units = Array.isArray(state?.units) ? state.units : [];

  if (includeAllPilots) {
    for (const unit of units) {
      if (!unit || unit.unitType !== "pilot" || unit.embarked === true) continue;
      const pos = { x: Number(unit.x), y: Number(unit.y) };
      if (cells.has(makeCellKey(pos.x, pos.y))) positions.push(pos);
    }
  } else {
    const active = getActiveRenderPilot(state);
    if (active) {
      const pos = { x: Number(active.x), y: Number(active.y) };
      if (cells.has(makeCellKey(pos.x, pos.y))) positions.push(pos);
    }
  }

  const preview = getMovePreviewDestination(state);
  if (preview && cells.has(makeCellKey(preview.x, preview.y))) positions.push(preview);

  return dedupePositions(positions);
}

function getActiveRenderPilot(state) {
  const units = Array.isArray(state?.units) ? state.units : [];
  const ids = [
    state?.ui?.preMove?.unitId,
    state?.turn?.activeBodyId,
    state?.turn?.activeUnitId,
    state?.selection?.unitId
  ].filter(Boolean);

  for (const id of ids) {
    const unit = units.find((entry) => entry?.instanceId === id || entry?.id === id);
    if (unit?.unitType === "pilot" && unit.embarked !== true) return unit;
  }

  return null;
}

function getMovePreviewDestination(state) {
  if (state?.ui?.mode !== "move") return null;

  const path = Array.isArray(state?.ui?.previewPath) ? state.ui.previewPath : [];
  const last = path.length ? path[path.length - 1] : null;
  if (last && Number.isFinite(Number(last.x)) && Number.isFinite(Number(last.y))) {
    return { x: Number(last.x), y: Number(last.y) };
  }

  return null;
}

function isCellRoofRevealed(cell, revealInfo) {
  if (!revealInfo?.revealsAny) return false;
  if (revealInfo.revealWholeStructure) return true;
  if (!cell?.roomId) return false;
  return revealInfo.revealedRoomIds.has(String(cell.roomId));
}

function shouldFadeEdgeForInteriorView(state, fadeInfo, edgePart) {
  if (!edgePart?.sprite) return false;
  if (!fadeInfo?.fadeCells?.size) return false;
  if (!isLowerScreenWorldEdge(state, edgePart.edge)) return false;
  return fadeInfo.fadeCells.has(makeCellKey(edgePart.x, edgePart.y));
}

function isLowerScreenWorldEdge(state, worldFace) {
  const face = String(worldFace ?? "").toLowerCase();
  return face === getWorldFaceForScreenSide(state.rotation, "left") ||
    face === getWorldFaceForScreenSide(state.rotation, "right");
}

function makeStructureCellLookup(structure) {
  const lookup = new Map();
  for (const cell of getStructureCells(structure)) {
    lookup.set(makeCellKey(cell.x, cell.y), cell);
  }
  return lookup;
}

function makeCellKey(x, y) {
  return String(Number(x)) + "," + String(Number(y));
}

function dedupePositions(positions) {
  const seen = new Set();
  const result = [];

  for (const pos of positions) {
    const key = makeCellKey(pos.x, pos.y);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(pos);
  }

  return result;
}

function makeDebugItems(state, structure) {
  const items = [];

  for (const cell of getStructureCells(structure)) {
    const points = getCellRoofOrFloorPoints(state, cell.x, cell.y, structure.elevation, 0);
    const center = averagePoint(points);

    items.push({
      kind: "structure_debug_cell",
      sortDepth: center.y + 0.8,
      sortKey: getSceneSortKey(state, cell.x, cell.y, structure.elevation) + 0.8,
      render(parent) {
        const poly = makePolygon(points, "structure-debug-cell", DEBUG_CELL_COLOR);
        poly.setAttribute("stroke", DEBUG_EDGE_COLOR);
        poly.setAttribute("stroke-width", "1");
        parent.appendChild(poly);

        const label = makeText(center.x, center.y, `${cell.x},${cell.y}`, "structure-debug-text");
        label.setAttribute("fill", "rgba(255,240,120,0.95)");
        label.setAttribute("font-size", "10");
        parent.appendChild(label);
      }
    });
  }

  return items;
}

function drawFloor(item, parent) {
  const group = svgEl("g");
  group.dataset.structureId = item.structureId;
  group.dataset.structurePart = "floor";

  const fallback = makePolygon(item.points, "structure-floor", FLOOR_COLOR);
  fallback.setAttribute("stroke", "none");
  group.appendChild(fallback);

  if (item.imagePath) {
    appendProjectedImage(group, item.points, item.imagePath, "floor", 32, 32);
  }

  parent.appendChild(group);
}

function drawEdge(item, parent) {
  const group = svgEl("g");
  group.dataset.structureId = item.structureId;
  group.dataset.structurePart = "edge";
  if (Number(item.opacity ?? 1) < 1) {
    group.setAttribute("opacity", String(item.opacity));
  }
  group.dataset.edge = item.edgePart?.edge ?? "";
  group.dataset.edgeType = item.edgePart?.type ?? "";

  const transparentOpening = isTransparentOpeningEdge(item.edgePart);

  if (!transparentOpening || !item.imagePath) {
    const fallback = makePolygon(item.points, "structure-edge-face", EDGE_FALLBACK_COLOR);
    fallback.setAttribute("stroke", "none");
    group.appendChild(fallback);
  }

  if (item.imagePath) {
    appendProjectedImage(group, item.points, item.imagePath, "edge", 32, 64);
  }

  const outline = makePolygon(item.points, "structure-edge-outline", "none");
  outline.setAttribute("stroke", "rgba(20,18,24,0.82)");
  outline.setAttribute("stroke-width", "1.2");
  outline.setAttribute("stroke-linejoin", "round");
  group.appendChild(outline);

  parent.appendChild(group);
}

function isTransparentOpeningEdge(edgePart) {
  const type = String(edgePart?.type ?? "").trim().toLowerCase();
  return TRANSPARENT_EDGE_TYPES.has(type);
}

function drawRoof(item, parent) {
  const group = svgEl("g");
  group.dataset.structureId = item.structureId;
  group.dataset.structurePart = "roof";

  const fallback = makePolygon(item.points, "structure-roof", ROOF_COLOR);
  fallback.setAttribute("stroke", "none");
  group.appendChild(fallback);

  if (item.imagePath) {
    appendProjectedRoofImage(group, item.points, item.imagePath, item.textureRotation);
  }

  const outline = makePolygon(item.points, "structure-roof-outline", "none");
  outline.setAttribute("stroke", "rgba(20,18,24,0.88)");
  outline.setAttribute("stroke-width", "1.2");
  outline.setAttribute("stroke-linejoin", "round");
  group.appendChild(outline);

  parent.appendChild(group);
}

function getCellRoofOrFloorPoints(state, x, y, elevation, risePx = 0) {
  const diamond = getCellScreenDiamond(state, x, y, elevation);
  return [diamond.top, diamond.right, diamond.bottom, diamond.left]
    .map((point) => ({ x: point.x, y: point.y - risePx }));
}

function getEdgePlanePoints(state, x, y, edge, elevation, heightPx) {
  const endpoints = getScreenEdgeEndpointsForWorldFace(state, x, y, edge, elevation);
  if (!endpoints) return null;

  const [a, b] = endpoints;
  const topA = { x: a.x, y: a.y - heightPx };
  const topB = { x: b.x, y: b.y - heightPx };

  return [topA, topB, b, a];
}

function getScreenEdgeEndpointsForWorldFace(state, x, y, worldFace, elevation) {
  const diamond = getCellScreenDiamond(state, x, y, elevation);
  const screenEdge = getScreenEdgeForWorldFace(state.rotation, worldFace);

  switch (screenEdge) {
    case "topLeft":
      return [diamond.top, diamond.left];
    case "topRight":
      return [diamond.top, diamond.right];
    case "bottomRight":
      return [diamond.right, diamond.bottom];
    case "bottomLeft":
      return [diamond.left, diamond.bottom];
    default:
      return null;
  }
}

function getScreenEdgeForWorldFace(rotation, worldFace) {
  const face = String(worldFace ?? "").toLowerCase();
  const leftWorldFace = getWorldFaceForScreenSide(rotation, "left");
  const rightWorldFace = getWorldFaceForScreenSide(rotation, "right");
  const topRightWorldFace = getOppositeWorldFace(leftWorldFace);
  const topLeftWorldFace = getOppositeWorldFace(rightWorldFace);

  if (face === leftWorldFace) return "bottomLeft";
  if (face === rightWorldFace) return "bottomRight";
  if (face === topRightWorldFace) return "topRight";
  if (face === topLeftWorldFace) return "topLeft";
  return null;
}

function getCellScreenDiamond(state, x, y, elevation) {
  // Match terrain rendering exactly: project the authored tile origin once,
  // then build the screen diamond from fixed iso offsets. Do not use
  // projectScene(x + 1, y) etc.; that was the rotation drift.
  const p = projectScene(state, x, y, elevation, 1);
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;

  return {
    top: { x: p.x, y: p.y },
    right: { x: p.x + halfW, y: p.y + halfH },
    bottom: { x: p.x, y: p.y + (halfH * 2) },
    left: { x: p.x - halfW, y: p.y + halfH }
  };
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
      return null;
  }
}


function appendProjectedRoofImage(parentGroup, points, imagePath, textureRotation = 0) {
  const id = `structure-roof-clip-${clipId += 1}`;
  const clip = svgEl("clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  clip.appendChild(makePolygon(points, "structure-roof-clip", "#fff"));
  parentGroup.appendChild(clip);

  const group = svgEl("g");
  group.dataset.structureImageLayer = "roof";
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

  const rot = normalizeTextureRotation(textureRotation);
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

function normalizeTextureRotation(rotation = 0) {
  const value = Number(rotation ?? 0);
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 4) + 4) % 4;
}

function appendProjectedImage(parentGroup, points, imagePath, layerName, sourceWidth, sourceHeight) {
  const id = `structure-${layerName}-clip-${clipId += 1}`;
  const clip = svgEl("clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  clip.appendChild(makePolygon(points, `structure-${layerName}-clip`, "#fff"));
  parentGroup.appendChild(clip);

  const group = svgEl("g");
  group.dataset.structureImageLayer = layerName;
  group.setAttribute("clip-path", `url(#${id})`);

  const image = svgEl("image");
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", String(sourceWidth));
  image.setAttribute("height", String(sourceHeight));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("href", imagePath);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imagePath);

  const imagePoints = getImageMappingPoints(points, layerName);
  const topStart = imagePoints[0];
  const topEnd = imagePoints[1];
  const bottomStart = imagePoints[3];

  const ux = topEnd.x - topStart.x;
  const uy = topEnd.y - topStart.y;
  const vx = bottomStart.x - topStart.x;
  const vy = bottomStart.y - topStart.y;

  image.setAttribute(
    "transform",
    `matrix(${ux / sourceWidth} ${uy / sourceWidth} ${vx / sourceHeight} ${vy / sourceHeight} ${topStart.x} ${topStart.y})`
  );

  group.appendChild(image);
  parentGroup.appendChild(group);
}

function getImageMappingPoints(points, layerName) {
  // Edge geometry order is locked to world/rotation math for correct placement.
  // Texture mapping can be re-ordered independently so wall/door art is not
  // horizontally mirrored on edges whose projected top segment runs right-to-left.
  if (layerName !== "edge") return points;

  const [topA, topB, bottomB, bottomA] = points;
  if (topA.x <= topB.x) return points;

  return [topB, topA, bottomA, bottomB];
}

function edgeSortBias(edge) {
  switch (String(edge ?? "").toLowerCase()) {
    case "sw":
      return 0.16;
    case "se":
      return 0.17;
    case "nw":
      return 0.08;
    case "ne":
      return 0.09;
    default:
      return 0.1;
  }
}

function averagePoint(points) {
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length
  };
}

function getMidpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}
