// src/render/renderStructures.js
//
// Structure Render V3.1
// Structures are authored as cells + world-edge parts + roof.
// Render anchoring deliberately matches terrain/unit projection truth:
// project the cell's top diamond point, then build the iso diamond with fixed
// screen offsets. Do NOT project x+1/y+1 corners for structure anchoring; the
// rest of the engine does not use that as the visual tile lock.

import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { projectScene, getTopdownCellSize, getSceneSortKey } from "./projection.js";
import { getTerrainDepth } from "./renderSceneMath.js";
import { getScreenSideForWorldFace, rotateWorldFace } from "./renderCompass.js";
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
  // Interior floors are opt-in until roof/cutaway rules are implemented.
  if (!structure.floorSprite && structure.showInteriorFloor !== true) return [];

  const items = [];

  for (const cell of getStructureCells(structure)) {
    const g = cellGeometry(state, cell.x, cell.y, structure.elevation, 0);
    const points = [g.base.top, g.base.right, g.base.bottom, g.base.left];

    items.push({
      kind: "structure_floor",
      structureId: structure.id,
      cell,
      points,
      imagePath: structure.floorSprite,
      sortDepth: getTerrainDepth({
        size: 1,
        screenY: g.base.screenY,
        leftFaceHeight: structure.elevation,
        rightFaceHeight: structure.elevation
      }) - 0.25,
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

  for (const edgePart of getStructureEdgeParts(structure)) {
    if (!edgePart?.sprite && edgePart?.type === "open") continue;

    const screenSide = getScreenSideForWorldFace(state.rotation, edgePart.edge);

    // Normal closed-roof view draws only camera-facing perimeter planes.
    // Hidden/back planes stay as rule data. Door openings get an explicit
    // backing from the opposite wall so transparent door pixels reveal a real
    // room surface instead of the ground.
    if (screenSide !== "left" && screenSide !== "right") continue;

    const points = getFacePointsForWorldEdge(
      state,
      edgePart.x,
      edgePart.y,
      edgePart.edge,
      structure.elevation,
      structure.heightPx
    );

    if (!points) continue;

    const g = cellGeometry(state, edgePart.x, edgePart.y, structure.elevation, structure.heightPx);
    const doorwayBacking = edgePart.type === "door"
      ? resolveDoorwayBacking(state, structure, edgePart)
      : null;

    items.push({
      kind: "structure_edge",
      structureId: structure.id,
      edgePart,
      screenSide,
      points,
      imagePath: edgePart.sprite,
      doorwayBacking,
      sortDepth: getTerrainDepth({
        size: 1,
        screenY: g.base.screenY,
        leftFaceHeight: structure.elevation,
        rightFaceHeight: structure.elevation
      }) + (screenSide === "left" ? 0.16 : 0.17),
      sortKey: getSceneSortKey(state, edgePart.x, edgePart.y, structure.elevation) + (screenSide === "left" ? 0.16 : 0.17),
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

  for (const cell of getStructureCells(structure)) {
    const g = cellGeometry(state, cell.x, cell.y, structure.elevation, structure.heightPx);

    items.push({
      kind: "structure_roof",
      structureId: structure.id,
      cell,
      points: g.roof,
      imagePath: structure.roofSprite,
      textureRotation: state.rotation,
      sortDepth: getTerrainDepth({
        size: 1,
        screenY: g.base.screenY,
        leftFaceHeight: structure.elevation,
        rightFaceHeight: structure.elevation
      }) + 0.42,
      sortKey: getSceneSortKey(state, cell.x, cell.y, structure.elevation + structure.heightLevels) + 0.3,
      render(parent) {
        drawRoof(this, parent);
      }
    });
  }

  return items;
}

function makeDebugItems(state, structure) {
  const items = [];

  for (const cell of getStructureCells(structure)) {
    const g = cellGeometry(state, cell.x, cell.y, structure.elevation, 0);
    const points = [g.base.top, g.base.right, g.base.bottom, g.base.left];
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
  group.dataset.edge = item.edgePart?.edge ?? "";
  group.dataset.screenSide = item.screenSide ?? "";
  group.dataset.edgeType = item.edgePart?.type ?? "";

  const isDoor = item.edgePart?.type === "door";

  // Doors must preserve transparent pixels from door_*.png. A fallback polygon
  // behind the image fills the doorway aperture and makes the door look solid.
  if (!isDoor || !item.imagePath) {
    const fallback = makePolygon(item.points, "structure-edge-face", EDGE_FALLBACK_COLOR);
    fallback.setAttribute("stroke", "none");
    group.appendChild(fallback);
  }

  if (item.doorwayBacking?.imagePath && item.doorwayBacking?.points) {
    appendProjectedImage(
      group,
      item.points,
      item.doorwayBacking.imagePath,
      "doorway-backing",
      32,
      64,
      item.doorwayBacking.points
    );
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

function drawRoof(item, parent) {
  const group = svgEl("g");
  group.dataset.structureId = item.structureId;
  group.dataset.structurePart = "roof";

  const fallback = makePolygon(item.points, "structure-roof", ROOF_COLOR);
  fallback.setAttribute("stroke", "none");
  group.appendChild(fallback);

  if (item.imagePath) {
    appendProjectedImage(group, item.points, item.imagePath, "roof", 32, 32);
  }

  const outline = makePolygon(item.points, "structure-roof-outline", "none");
  outline.setAttribute("stroke", "rgba(20,18,24,0.88)");
  outline.setAttribute("stroke-width", "1.2");
  outline.setAttribute("stroke-linejoin", "round");
  group.appendChild(outline);

  parent.appendChild(group);
}

function cellGeometry(state, x, y, elevation, risePx = 0) {
  const p = projectScene(state, x, y, elevation, 1);
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;

  // This matches renderTerrainTile() and projectTileCenter().
  // It is the lock point that kept units/mechs stable after rotation.
  const base = {
    screenY: p.y,
    top: { x: p.x, y: p.y },
    right: { x: p.x + halfW, y: p.y + halfH },
    bottom: { x: p.x, y: p.y + (halfH * 2) },
    left: { x: p.x - halfW, y: p.y + halfH }
  };

  const roof = {
    top: { x: base.top.x, y: base.top.y - risePx },
    right: { x: base.right.x, y: base.right.y - risePx },
    bottom: { x: base.bottom.x, y: base.bottom.y - risePx },
    left: { x: base.left.x, y: base.left.y - risePx }
  };

  return {
    base,
    roof: [roof.top, roof.right, roof.bottom, roof.left],
    screenFaces: {
      nw: [roof.top, roof.left, base.left, base.top],
      ne: [roof.top, roof.right, base.right, base.top],
      sw: [roof.left, roof.bottom, base.bottom, base.left],
      se: [roof.right, roof.bottom, base.bottom, base.right]
    },
    leftFace: [roof.left, roof.bottom, base.bottom, base.left],
    rightFace: [roof.right, roof.bottom, base.bottom, base.right]
  };
}

function getFacePointsForWorldEdge(state, x, y, worldEdge, elevation, heightPx) {
  const screenEdge = getScreenEdgeForWorldFace(state.rotation, worldEdge);
  if (!screenEdge) return null;

  const g = cellGeometry(state, x, y, elevation, heightPx);
  return g.screenFaces?.[screenEdge] ?? null;
}

function getScreenEdgeForWorldFace(rotation, worldFace) {
  const normalizedWorldFace = String(worldFace ?? "").toLowerCase();

  for (const screenEdge of ["ne", "se", "sw", "nw"]) {
    if (rotateWorldFace(screenEdge, rotation) === normalizedWorldFace) {
      return screenEdge;
    }
  }

  return null;
}

function resolveDoorwayBacking(state, structure, doorEdgePart) {
  const opposite = getOppositeWorldFace(doorEdgePart.edge);
  if (!opposite) return null;

  const backingEdge = getStructureEdgeParts(structure).find((edgePart) => (
    edgePart &&
    Number(edgePart.x) === Number(doorEdgePart.x) &&
    Number(edgePart.y) === Number(doorEdgePart.y) &&
    String(edgePart.edge).toLowerCase() === opposite &&
    edgePart.sprite
  ));

  if (!backingEdge?.sprite) return null;

  const points = getFacePointsForWorldEdge(
    state,
    backingEdge.x,
    backingEdge.y,
    backingEdge.edge,
    structure.elevation,
    structure.heightPx
  );

  if (!points) return null;

  return {
    imagePath: backingEdge.sprite,
    points
  };
}

function getOppositeWorldFace(worldFace) {
  switch (String(worldFace ?? "").toLowerCase()) {
    case "ne":
      return "sw";
    case "se":
      return "nw";
    case "sw":
      return "ne";
    case "nw":
      return "se";
    default:
      return null;
  }
}

function appendProjectedImage(parentGroup, clipPoints, imagePath, layerName, sourceWidth, sourceHeight, imagePoints = clipPoints) {
  const id = `structure-${layerName}-clip-${clipId += 1}`;
  const clip = svgEl("clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  clip.appendChild(makePolygon(clipPoints, `structure-${layerName}-clip`, "#fff"));
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

  const basis = getStableImageBasis(imagePoints);
  const ux = basis.topEnd.x - basis.topStart.x;
  const uy = basis.topEnd.y - basis.topStart.y;
  const vx = basis.bottomStart.x - basis.topStart.x;
  const vy = basis.bottomStart.y - basis.topStart.y;

  image.setAttribute(
    "transform",
    `matrix(${ux / sourceWidth} ${uy / sourceWidth} ${vx / sourceHeight} ${vy / sourceHeight} ${basis.topStart.x} ${basis.topStart.y})`
  );

  group.appendChild(image);
  parentGroup.appendChild(group);
}

function getStableImageBasis(points) {
  // Keep wall art handedness stable. The old right-face path used a top edge
  // that ran right-to-left, which mirrored text/details. Pick the screen-left
  // top endpoint as the source image origin and its matching bottom endpoint
  // as the vertical axis.
  if (points[0].x <= points[1].x) {
    return {
      topStart: points[0],
      topEnd: points[1],
      bottomStart: points[3]
    };
  }

  return {
    topStart: points[1],
    topEnd: points[0],
    bottomStart: points[2]
  };
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
