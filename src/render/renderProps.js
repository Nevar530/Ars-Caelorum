// src/render/renderProps.js
//
// Props are footprint-based map objects. Rendering is visual only; movement and
// LOS read the same prop footprint/height truth from props/propRules.js.

import { RENDER_CONFIG } from "../config.js";
import { svgEl } from "../utils.js";
import { getTile, getTileRenderElevation } from "../map.js";
import { getMapProps, getPropFootprintCells, normalizeProp } from "../props/propRules.js";
import { projectScene, projectTileCenter, getSceneSortKey, getTopdownCellSize } from "./projection.js";
import { getTerrainDepth } from "./renderSceneMath.js";

const FOOTPRINT_FILL = "rgba(245, 178, 72, 0.18)";
const FOOTPRINT_STROKE = "rgba(245, 178, 72, 0.78)";

export function getPropSceneItems(state) {
  const props = getMapProps(state?.map).map((prop) => normalizeProp(prop)).filter(Boolean);
  const items = [];

  for (const prop of props) {
    if (state.ui?.viewMode === "top") {
      items.push(makeTopdownPropItem(state, prop));
    } else {
      items.push(makeIsoPropItem(state, prop));
    }
  }

  return items.filter(Boolean);
}

function makeIsoPropItem(state, prop) {
  const cells = getPropFootprintCells(prop);
  if (!cells.length) return null;

  const supportElevation = getPropSupportElevation(state, cells);
  if (supportElevation === null) return null;

  const anchorCell = getBottomVisibleCell(state, cells, supportElevation);
  const anchor = projectTileCenter(state, anchorCell.x, anchorCell.y, supportElevation);
  const widthPx = Math.max(8, RENDER_CONFIG.isoTileWidth * prop.footprintW * prop.scale);
  const heightPx = Math.max(8, ((RENDER_CONFIG.isoTileHeight * prop.footprintH) + (RENDER_CONFIG.elevationStepPx * prop.visualHeight)) * prop.scale);
  const sortDepth = getPropFootprintSortDepth(state, cells, supportElevation) + getLayerSortBias(prop.layer);

  return {
    kind: "prop",
    prop,
    x: anchor.x + prop.offsetX - (widthPx / 2),
    y: anchor.y + prop.offsetY - heightPx + (RENDER_CONFIG.isoTileHeight / 2),
    widthPx,
    heightPx,
    imagePath: prop.sprite,
    sortDepth,
    sortKey: getSceneSortKey(state, anchorCell.x, anchorCell.y, supportElevation) + getLayerSortBias(prop.layer),
    render(parent) {
      drawIsoProp(this, parent);
    }
  };
}

function makeTopdownPropItem(state, prop) {
  const size = getTopdownCellSize(state);
  const originX = Number(state.camera?.topdownOriginX ?? 0);
  const originY = Number(state.camera?.topdownOriginY ?? 0);
  const x = originX + (prop.x * size);
  const y = originY + (prop.y * size);

  return {
    kind: "prop_topdown",
    prop,
    x,
    y,
    widthPx: prop.footprintW * size,
    heightPx: prop.footprintH * size,
    sortDepth: y + (prop.footprintH * size) + 0.55,
    sortKey: getSceneSortKey(state, prop.x, prop.y, 0) + 0.55,
    render(parent) {
      const group = svgEl("g");
      group.dataset.propId = this.prop.id;
      group.dataset.propPart = "topdown";

      const rect = svgEl("rect");
      rect.setAttribute("x", String(this.x));
      rect.setAttribute("y", String(this.y));
      rect.setAttribute("width", String(this.widthPx));
      rect.setAttribute("height", String(this.heightPx));
      rect.setAttribute("fill", FOOTPRINT_FILL);
      rect.setAttribute("stroke", this.prop.blocksMovement ? "rgba(255,99,99,0.95)" : FOOTPRINT_STROKE);
      rect.setAttribute("stroke-width", this.prop.blocksMovement ? "3" : "2");
      rect.setAttribute("pointer-events", "none");
      group.appendChild(rect);

      parent.appendChild(group);
    }
  };
}

function drawIsoProp(item, parent) {
  const group = svgEl("g");
  group.dataset.propId = item.prop.id;
  group.dataset.propPart = "sprite";

  if (item.prop.mirrorX === true) {
    const cx = item.x + (item.widthPx / 2);
    group.setAttribute("transform", `translate(${cx} 0) scale(-1 1) translate(${-cx} 0)`);
  }

  if (item.imagePath) {
    const image = svgEl("image");
    image.setAttribute("href", item.imagePath);
    image.setAttribute("x", String(item.x));
    image.setAttribute("y", String(item.y));
    image.setAttribute("width", String(item.widthPx));
    image.setAttribute("height", String(item.heightPx));
    image.setAttribute("preserveAspectRatio", "xMidYMid meet");
    image.setAttribute("pointer-events", "none");
    group.appendChild(image);
  } else {
    const rect = svgEl("rect");
    rect.setAttribute("x", String(item.x));
    rect.setAttribute("y", String(item.y));
    rect.setAttribute("width", String(item.widthPx));
    rect.setAttribute("height", String(item.heightPx));
    rect.setAttribute("fill", FOOTPRINT_FILL);
    rect.setAttribute("stroke", FOOTPRINT_STROKE);
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("pointer-events", "none");
    group.appendChild(rect);
  }

  parent.appendChild(group);
}

function getPropSupportElevation(state, cells) {
  let maxElevation = null;
  for (const cell of cells) {
    const tile = getTile(state?.map, cell.x, cell.y);
    if (!tile) return null;
    const elevation = Number(getTileRenderElevation(tile) ?? 0);
    if (maxElevation === null || elevation > maxElevation) maxElevation = elevation;
  }
  return maxElevation;
}

function getBottomVisibleCell(state, cells, elevation) {
  let best = cells[0];
  let bestPoint = projectTileCenter(state, best.x, best.y, elevation);

  for (let i = 1; i < cells.length; i += 1) {
    const cell = cells[i];
    const point = projectTileCenter(state, cell.x, cell.y, elevation);
    if (point.y > bestPoint.y || (point.y === bestPoint.y && point.x > bestPoint.x)) {
      best = cell;
      bestPoint = point;
    }
  }

  return best;
}

function getPropFootprintSortDepth(state, cells, elevation) {
  let maxDepth = null;
  for (const cell of cells) {
    const projected = projectScene(state, cell.x, cell.y, elevation, 1);
    const depth = getTerrainDepth({
      size: 1,
      screenY: projected.y,
      leftFaceHeight: elevation,
      rightFaceHeight: elevation
    });
    if (maxDepth === null || depth > maxDepth) maxDepth = depth;
  }
  return maxDepth ?? 0;
}

function getLayerSortBias(layer) {
  switch (layer) {
    case "belowUnits":
      return -0.15;
    case "aboveUnits":
      return 0.65;
    case "roofOverlay":
      return 1.1;
    case "samePlane":
    default:
      return 0.28;
  }
}
