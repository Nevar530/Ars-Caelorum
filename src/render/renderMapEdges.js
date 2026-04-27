// src/render/renderMapEdges.js
// Map Edge Rain Curtain V1.
// Visual-only hologram/rain curtain along the visible front edges of the map.
// No gameplay authority, no terrain mutation, no structure coupling.

import { RENDER_CONFIG } from "../config.js";
import {
  getMapHeight,
  getMapWidth,
  getTile,
  getTileRenderElevation
} from "../map.js";
import { svgEl } from "../utils.js";
import { projectScene } from "./projection.js";

const EDGE_CONFIG = Object.freeze({
  sprite: "art/menu/edge.png",
  stripWidthPx: 8,
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
      const midpoint = lerpPoint(segment.start, segment.end, deterministicT(side.name, index));
      const stripHeight = getStripHeight(side.name, index);
      const stripWidth = getStripWidth(side.name, index);

      items.push({
        kind: "map_edge_rain",
        side: side.name,
        x: midpoint.x,
        y: midpoint.y,
        width: stripWidth,
        height: stripHeight,
        opacity: getStripOpacity(side.name, index),
        imagePath: EDGE_CONFIG.sprite,
        sortDepth: midpoint.y + 0.05,
        sortKey: (midpoint.y * 1000) + midpoint.x - 500000,
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
    const northCorners = getTileTopCorners(state, x, 0);
    if (northCorners) {
      sides[0].segments.push({
        start: northCorners.top,
        end: northCorners.right
      });
    }

    const southCorners = getTileTopCorners(state, x, height - 1);
    if (southCorners) {
      sides[1].segments.push({
        start: southCorners.left,
        end: southCorners.bottom
      });
    }
  }

  for (let y = 0; y < height; y += 1) {
    const westCorners = getTileTopCorners(state, 0, y);
    if (westCorners) {
      sides[2].segments.push({
        start: westCorners.top,
        end: westCorners.left
      });
    }

    const eastCorners = getTileTopCorners(state, width - 1, y);
    if (eastCorners) {
      sides[3].segments.push({
        start: eastCorners.right,
        end: eastCorners.bottom
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

  const image = svgEl("image");
  image.setAttribute("href", item.imagePath);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", item.imagePath);
  image.setAttribute("x", String(item.x - (item.width / 2)));
  image.setAttribute("y", String(item.y));
  image.setAttribute("width", String(item.width));
  image.setAttribute("height", String(item.height));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("pointer-events", "none");
  group.appendChild(image);

  parent.appendChild(group);
}

function deterministicT(sideName, index) {
  const seed = sideSeed(sideName) + (index * 17);
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = value - Math.floor(value);
  return 0.24 + (frac * 0.52);
}

function getStripHeight(sideName, index) {
  const seed = sideSeed(sideName) + (index * 31);
  const wave = Math.sin(seed * 1.731) * 0.5 + 0.5;
  const jag = Math.sin(seed * 7.117) * 0.5 + 0.5;
  const blend = (wave * 0.7) + (jag * 0.3);
  return Math.round(EDGE_CONFIG.minHeightPx + ((EDGE_CONFIG.maxHeightPx - EDGE_CONFIG.minHeightPx) * blend));
}

function getStripWidth(sideName, index) {
  const seed = sideSeed(sideName) + (index * 13);
  const pulse = Math.sin(seed * 2.413) * 0.5 + 0.5;
  return Math.round(EDGE_CONFIG.stripWidthPx * (0.7 + (pulse * 0.65)));
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

function lerpPoint(a, b, t) {
  return {
    x: a.x + ((b.x - a.x) * t),
    y: a.y + ((b.y - a.y) * t)
  };
}
