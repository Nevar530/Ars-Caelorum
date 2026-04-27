// src/render/renderStructures.js
//
// Structure Render V3
// Board truth: structure cells + real world edge parts + separate roof.
// No prefab boxes. No left/right face swapping. Rotation only changes projection.

import { RENDER_CONFIG } from "../config.js";
import { svgEl, makePolygon, makeText } from "../utils.js";
import { projectScene, getTopdownCellSize, getSceneSortKey } from "./projection.js";
import { getTerrainDepth } from "./renderSceneMath.js";
import {
  getMapStructures,
  getStructureCells,
  getStructureEdgeParts,
  normalizeStructureForMap
} from "../structures/structureRules.js";

let clipId = 0;

const EDGE_FALLBACK_COLOR = "rgba(80,74,84,0.72)";
const ROOF_COLOR = "rgba(120,68,86,0.82)";
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
      sortDepth: getTerrainDepth({
        size: 1,
        screenY,
        leftFaceHeight: structure.elevation,
        rightFaceHeight: structure.elevation
      }) + 0.03,
      sortKey: getSceneSortKey(state, cell.x, cell.y, structure.elevation) + 0.03,
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

  for (const cell of getStructureCells(structure)) {
    const points = getCellRoofOrFloorPoints(state, cell.x, cell.y, structure.elevation, structure.heightPx);
    const screenY = Math.max(...points.map((point) => point.y));

    items.push({
      kind: "structure_roof",
      structureId: structure.id,
      cell,
      points,
      imagePath: structure.roofSprite,
      textureRotation: state.rotation,
      sortDepth: screenY + 0.42,
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
  group.dataset.edge = item.edgePart?.edge ?? "";
  group.dataset.edgeType = item.edgePart?.type ?? "";

  const fallback = makePolygon(item.points, "structure-edge-face", EDGE_FALLBACK_COLOR);
  fallback.setAttribute("stroke", "none");
  group.appendChild(fallback);

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

function getCellRoofOrFloorPoints(state, x, y, elevation, risePx = 0) {
  const corners = getCellProjectedCorners(state, x, y, elevation)
    .map((point) => ({ x: point.x, y: point.y - risePx }));

  return orderDiamondPoints(corners);
}

function getEdgePlanePoints(state, x, y, edge, elevation, heightPx) {
  const endpoints = getWorldEdgeEndpoints(state, x, y, edge, elevation);
  if (!endpoints) return null;

  let [a, b] = endpoints;

  // Keep texture handedness stable on screen. This avoids the old mirrored face
  // problem while leaving the map edge itself fixed in world space.
  if (a.x > b.x) {
    [a, b] = [b, a];
  }

  const topA = { x: a.x, y: a.y - heightPx };
  const topB = { x: b.x, y: b.y - heightPx };

  return [topA, topB, b, a];
}

function getWorldEdgeEndpoints(state, x, y, edge, elevation) {
  const corners = getNamedCellCorners(state, x, y, elevation);

  switch (String(edge ?? "").toLowerCase()) {
    case "ne":
      return [corners.top, corners.right];
    case "se":
      return [corners.right, corners.bottom];
    case "sw":
      return [corners.left, corners.bottom];
    case "nw":
      return [corners.top, corners.left];
    default:
      return null;
  }
}

function getNamedCellCorners(state, x, y, elevation) {
  const ordered = orderDiamondPoints(getCellProjectedCorners(state, x, y, elevation));

  return {
    top: ordered[0],
    right: ordered[1],
    bottom: ordered[2],
    left: ordered[3]
  };
}

function getCellProjectedCorners(state, x, y, elevation) {
  return [
    projectScene(state, x, y, elevation, 1),
    projectScene(state, x + 1, y, elevation, 1),
    projectScene(state, x + 1, y + 1, elevation, 1),
    projectScene(state, x, y + 1, elevation, 1)
  ];
}

function orderDiamondPoints(points) {
  const sortedByY = [...points].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const top = sortedByY[0];
  const bottom = sortedByY[sortedByY.length - 1];
  const middle = sortedByY.slice(1, -1).sort((a, b) => a.x - b.x);

  return [top, middle[1], bottom, middle[0]];
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

  group.appendChild(image);
  parentGroup.appendChild(group);
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
