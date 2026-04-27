// src/render/renderMapEdges.js
// Map Edge Rain Curtain V1.1.
// Visual-only hologram/rain curtain along the visible front map edges.
// Each strip is skewed to the iso tile-edge width instead of drawn as a screen-space billboard.

import { RENDER_CONFIG } from "../config.js";
import {
  getMapHeight,
  getMapWidth,
  getTile,
  getTileRenderElevation
} from "../map.js";
import { svgEl, makePolygon } from "../utils.js";
import { projectScene } from "./projection.js";

const EDGE_CONFIG = Object.freeze({
  sprite: "art/menu/edge.png",
  minHeightPx: 36,
  maxHeightPx: 104,
  opacity: 0.92,
  sideCount: 2
});

export function getMapEdgeSceneItems(state) {
  if (state.ui?.viewMode === "top") return [];

  const width = getMapWidth(state.map);
  const height = getMapHeight(state.map);
  if (width <= 0 || height <= 0) return [];

  const sideGroups = buildBoundarySideGroups(state, width, height);
  const visibleSides = sideGroups
    .filter((side) => side.segments.length > 0)
    .sort((a, b) => b.averageY - a.averageY)
    .slice(0, EDGE_CONFIG.sideCount);

  const items = [];

  for (const side of visibleSides) {
    side.segments.forEach((segment, index) => {
      const heightPx = getStripHeight(side.name, index);
      const opacity = getStripOpacity(side.name, index);
      const bottomStart = {
        x: segment.start.x,
        y: segment.start.y + heightPx
      };
      const bottomEnd = {
        x: segment.end.x,
        y: segment.end.y + heightPx
      };

      items.push({
        kind: "map_edge_rain",
        side: side.name,
        points: [segment.start, segment.end, bottomEnd, bottomStart],
        imagePath: EDGE_CONFIG.sprite,
        opacity,
        sortDepth: Math.max(segment.start.y, segment.end.y) + 0.05,
        sortKey: (((segment.start.y + segment.end.y) / 2) * 1000) + ((segment.start.x + segment.end.x) / 2) - 500000,
        render(parent) {
          drawRainStrip(this, parent);
        }
      });
    });
  }

  return items;
}

function buildBoundarySideGroups(state, width, height) {
  const sides = [
    { name: "north", segments: [] },
    { name: "south", segments: [] },
    { name: "west", segments: [] },
    { name: "east", segments: [] }
  ];

  for (let x = 0; x < width; x += 1) {
    const north = getTileTopCorners(state, x, 0);
    if (north) {
      sides[0].segments.push({
        start: north.top,
        end: north.right
      });
    }

    const south = getTileTopCorners(state, x, height - 1);
    if (south) {
      sides[1].segments.push({
        start: south.left,
        end: south.bottom
      });
    }
  }

  for (let y = 0; y < height; y += 1) {
    const west = getTileTopCorners(state, 0, y);
    if (west) {
      sides[2].segments.push({
        start: west.top,
        end: west.left
      });
    }

    const east = getTileTopCorners(state, width - 1, y);
    if (east) {
      sides[3].segments.push({
        start: east.right,
        end: east.bottom
      });
    }
  }

  for (const side of sides) {
    side.averageY = side.segments.length
      ? side.segments.reduce((sum, segment) => sum + ((segment.start.y + segment.end.y) / 2), 0) / side.segments.length
      : -Infinity;
  }

  return sides;
}

function getTileTopCorners(state, x, y) {
  const tile = getTile(state.map, x, y);
  if (!tile) return null;

  const elevation = getTileRenderElevation(tile);
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

function drawRainStrip(item, parent) {
  const group = svgEl("g");
  group.dataset.mapEdge = item.side ?? "";
  group.setAttribute("opacity", String(item.opacity));
  group.setAttribute("pointer-events", "none");

  appendSkewedEdgeImage(group, item.points, item.imagePath);

  parent.appendChild(group);
}

function appendSkewedEdgeImage(parentGroup, points, imagePath) {
  const id = `map-edge-rain-clip-${clipId += 1}`;
  const clip = svgEl("clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  clip.appendChild(makePolygon(points, "map-edge-rain-clip", "#fff"));
  parentGroup.appendChild(clip);

  const textureGroup = svgEl("g");
  textureGroup.setAttribute("clip-path", `url(#${id})`);

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

  image.setAttribute(
    "transform",
    `matrix(${ux / 32} ${uy / 32} ${vx / 64} ${vy / 64} ${topStart.x} ${topStart.y})`
  );

  textureGroup.appendChild(image);
  parentGroup.appendChild(textureGroup);
}

let clipId = 0;

function getStripHeight(sideName, index) {
  const seed = sideSeed(sideName) + (index * 31);
  const wave = Math.sin(seed * 1.731) * 0.5 + 0.5;
  const jag = Math.sin(seed * 7.117) * 0.5 + 0.5;
  const blend = (wave * 0.7) + (jag * 0.3);
  return Math.round(EDGE_CONFIG.minHeightPx + ((EDGE_CONFIG.maxHeightPx - EDGE_CONFIG.minHeightPx) * blend));
}

function getStripOpacity(sideName, index) {
  const seed = sideSeed(sideName) + (index * 19);
  const pulse = Math.sin(seed * 4.77) * 0.5 + 0.5;
  return Number((EDGE_CONFIG.opacity * (0.72 + (pulse * 0.28))).toFixed(3));
}

function sideSeed(sideName) {
  switch (sideName) {
    case "north": return 11;
    case "south": return 23;
    case "west": return 37;
    case "east": return 53;
    default: return 7;
  }
}
