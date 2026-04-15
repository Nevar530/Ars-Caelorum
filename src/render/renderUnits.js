// src/render/renderUnits.js

import { svgEl, makePolygon, makeText } from "../utils.js";
import { getUnitFootprint } from "../scale/scaleMath.js";
import { RENDER_CONFIG } from "../config.js";
import { getTopdownCellSize } from "./projection.js";

const SPRITE_RENDER_BOX = {
  mech: { width: 192, height: 192 },
  pilot: { width: 64, height: 64 }
};

const DEBUG_HEIGHTS = {
  mech: { body: 3, head: 6 },
  pilot: { body: 1, head: 2 }
};

// Temporary code-side mech split.
// Tune this value against the current mech art.
const MECH_SPRITE_SPLIT_Y = 96;

const UNIT_SORT_EPSILON = 0.25;

export function drawMech(state, unit, renderModel, parent, isActive = false) {
  const items = getUnitRenderSceneItems(state, unit, renderModel, isActive);

  for (const item of items) {
    item.render(parent);
  }
}

export function getUnitVisualLevels(unit) {
  if (unit?.unitType === "pilot") {
    return 2;
  }

  return 6;
}

export function getUnitCubeHeightPx(unit) {
  return getUnitVisualLevels(unit) * RENDER_CONFIG.elevationStepPx;
}

export function getUnitRenderSceneItems(state, unit, renderModel, isActive = false) {
  if (state.ui.viewMode === "top") {
    return buildTopUnitSceneItems(state, unit, renderModel, isActive);
  }

  return buildIsoUnitSceneItems(state, unit, renderModel, isActive);
}

function buildTopUnitSceneItems(state, unit, renderModel, isActive) {
  const footprint = getUnitFootprint(unit);
  const cellSize = getTopdownCellSize(state);
  const halfW = footprint.width * (cellSize / 2);
  const halfH = footprint.height * (cellSize / 4);

  const anchorX = renderModel.top.center.x;
  const anchorY = renderModel.top.center.y;

  const diamond = {
    top: { x: anchorX, y: anchorY - halfH },
    right: { x: anchorX + halfW, y: anchorY },
    bottom: { x: anchorX, y: anchorY + halfH },
    left: { x: anchorX - halfW, y: anchorY },
    center: { x: anchorX, y: anchorY }
  };

  const topPoints = [diamond.top, diamond.right, diamond.bottom, diamond.left];

  return [
    {
      sortDepth: diamond.bottom.y,
      sortKey: diamond.center.x,
      render(parent) {
        const poly = makePolygon(topPoints, getTopBodyClass(isActive), "currentColor");
        poly.removeAttribute("fill");
        parent.appendChild(poly);
      }
    },
    {
      sortDepth: diamond.bottom.y + 0.01,
      sortKey: diamond.center.x,
      render(parent) {
        const line = svgEl("line");
        const facing = getDiamondFacingLinePoints(state, unit, diamond);
        line.setAttribute("x1", facing.x1);
        line.setAttribute("y1", facing.y1);
        line.setAttribute("x2", facing.x2);
        line.setAttribute("y2", facing.y2);
        line.setAttribute("class", getFacingLineClass(state, unit));
        parent.appendChild(line);
      }
    },
    {
      sortDepth: diamond.bottom.y + 0.02,
      sortKey: diamond.center.x,
      render(parent) {
        const label = makeText(
          diamond.center.x,
          diamond.center.y + 4,
          unit.name,
          "mech-label"
        );
        parent.appendChild(label);
      }
    }
  ];
}

function buildIsoUnitSceneItems(state, unit, renderModel, isActive) {
  const anchorX = renderModel.iso.center.x;
  const anchorY = renderModel.iso.center.y;

  const spriteBox = getSpriteRenderBox(unit);
  const spriteInfo = getUnitSpriteInfo(state, unit);

  const items = [];

  if (unit?.unitType === "mech" && spriteInfo.href) {
    const lowerSortDepth = anchorY + UNIT_SORT_EPSILON;
    const upperSortDepth = anchorY - 0.5;

    items.push({
      sortDepth: upperSortDepth,
      sortKey: anchorX,
      render(parent) {
        renderSpriteSlice({
          parent,
          href: spriteInfo.href,
          anchorX,
          anchorY,
          width: spriteBox.width,
          height: spriteBox.height,
          mirrorX: spriteInfo.mirrorX,
          clipTop: 0,
          clipBottom: MECH_SPRITE_SPLIT_Y,
          className: getSpriteClass(unit, isActive)
        });
      }
    });

    items.push({
      sortDepth: lowerSortDepth,
      sortKey: anchorX,
      render(parent) {
        renderSpriteSlice({
          parent,
          href: spriteInfo.href,
          anchorX,
          anchorY,
          width: spriteBox.width,
          height: spriteBox.height,
          mirrorX: spriteInfo.mirrorX,
          clipTop: MECH_SPRITE_SPLIT_Y,
          clipBottom: spriteBox.height,
          className: getSpriteClass(unit, isActive)
        });
      }
    });
  } else {
    const spriteSortDepth = anchorY + UNIT_SORT_EPSILON;

    items.push({
      sortDepth: spriteSortDepth,
      sortKey: anchorX,
      render(parent) {
        if (spriteInfo.href) {
          const x = anchorX - (spriteBox.width / 2);
          const y = anchorY - spriteBox.height;

          const image = svgEl("image");
          image.setAttribute("x", String(x));
          image.setAttribute("y", String(y));
          image.setAttribute("width", String(spriteBox.width));
          image.setAttribute("height", String(spriteBox.height));
          image.setAttribute("preserveAspectRatio", "xMidYMid meet");
          image.setAttribute("href", spriteInfo.href);
          image.setAttributeNS("http://www.w3.org/1999/xlink", "href", spriteInfo.href);
          image.setAttribute("pointer-events", "none");
          image.setAttribute("class", getSpriteClass(unit, isActive));

          if (spriteInfo.mirrorX) {
            image.setAttribute("transform", `translate(${anchorX * 2}, 0) scale(-1, 1)`);
          }

          parent.appendChild(image);
          return;
        }

        const fallback = buildIsoFallbackDiamond(anchorX, anchorY, unit);
        const poly = makePolygon(fallback, getIsoTopClass(state, unit, isActive), "currentColor");
        poly.removeAttribute("fill");
        parent.appendChild(poly);
      }
    });
  }

  items.push({
    sortDepth: anchorY + 0.02,
    sortKey: anchorX,
    render(parent) {
      drawHeightPole(parent, unit, anchorX, anchorY);
    }
  });

  items.push({
    sortDepth: anchorY + 0.03,
    sortKey: anchorX,
    render(parent) {
      const label = makeText(
        anchorX,
        anchorY - spriteBox.height + 12,
        unit.name,
        "mech-label"
      );
      parent.appendChild(label);
    }
  });

  return items;
}

function renderSpriteSlice({
  parent,
  href,
  anchorX,
  anchorY,
  width,
  height,
  mirrorX,
  clipTop,
  clipBottom,
  className
}) {
  const x = anchorX - (width / 2);
  const y = anchorY - height;
  const clipHeight = Math.max(0, clipBottom - clipTop);

  if (clipHeight <= 0) return;

  const clipId = `mech-slice-${Math.random().toString(36).slice(2, 10)}`;

  const defs = svgEl("defs");
  const clipPath = svgEl("clipPath");
  clipPath.setAttribute("id", clipId);

  const rect = svgEl("rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y + clipTop));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(clipHeight));

  clipPath.appendChild(rect);
  defs.appendChild(clipPath);
  parent.appendChild(defs);

  const image = svgEl("image");
  image.setAttribute("x", String(x));
  image.setAttribute("y", String(y));
  image.setAttribute("width", String(width));
  image.setAttribute("height", String(height));
  image.setAttribute("preserveAspectRatio", "xMidYMid meet");
  image.setAttribute("href", href);
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  image.setAttribute("pointer-events", "none");
  image.setAttribute("class", className);
  image.setAttribute("clip-path", `url(#${clipId})`);

  if (mirrorX) {
    image.setAttribute("transform", `translate(${anchorX * 2}, 0) scale(-1, 1)`);
  }

  parent.appendChild(image);
}

export function getWorldFacing(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? state.ui.facingPreview : unit.facing;
}

function getTopBodyClass(isActive) {
  return isActive ? "mech-top-body mech-top-body-active" : "mech-top-body";
}

export function getIsoTopClass(state, unit, isActive) {
  const classes = ["mech-cube-top"];

  if (isActive) {
    classes.push("mech-cube-top-active");
  }

  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  if (
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null
  ) {
    classes.push("mech-cube-top-preview");
  }

  return classes.join(" ");
}

function getFacingLineClass(state, unit) {
  const activeId = state.turn.activeUnitId ?? state.turn.activeMechId ?? null;
  const isPreviewing =
    state.ui.mode === "face" &&
    unit.instanceId === activeId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-top-facing-preview" : "mech-top-facing";
}

function getDiamondFacingLinePoints(state, unit, diamond) {
  const facing = normalizeFacing(getWorldFacing(state, unit));
  const center = diamond.center;

  const northEast = midpoint(diamond.top, diamond.right);
  const southEast = midpoint(diamond.right, diamond.bottom);
  const southWest = midpoint(diamond.bottom, diamond.left);
  const northWest = midpoint(diamond.left, diamond.top);

  const t = 0.72;

  switch (facing) {
    case 0: {
      const end = lerpPoint(center, northEast, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 1: {
      const end = lerpPoint(center, southEast, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 2: {
      const end = lerpPoint(center, southWest, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
    case 3:
    default: {
      const end = lerpPoint(center, northWest, t);
      return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
    }
  }
}

function getSpriteRenderBox(unit) {
  return SPRITE_RENDER_BOX[unit?.unitType ?? "mech"] ?? SPRITE_RENDER_BOX.mech;
}

function getSpriteClass(unit, isActive) {
  const classes = ["unit-sprite", `unit-sprite-${unit?.unitType ?? "mech"}`];
  if (isActive) classes.push("unit-sprite-active");
  return classes.join(" ");
}

function getUnitSpriteInfo(state, unit) {
  const forced = unit?.render?.sprite ?? unit?.image ?? null;
  if (forced) {
    return { href: forced, mirrorX: false };
  }

  const facing = normalizeFacing(getWorldFacing(state, unit));
  const unitType = unit?.unitType === "pilot" ? "pilot" : "mech";
  const folder = unitType === "pilot" ? "pilot" : "mech";

  switch (facing) {
    case 0:
      return { href: `art/${folder}/${unitType}_NW.png`, mirrorX: false };
    case 1:
      return { href: `art/${folder}/${unitType}_NE.png`, mirrorX: false };
    case 2:
      return { href: `art/${folder}/${unitType}_NE.png`, mirrorX: true };
    case 3:
    default:
      return { href: `art/${folder}/${unitType}_NW.png`, mirrorX: true };
  }
}

function drawHeightPole(parent, unit, anchorX, anchorY) {
  const profile = DEBUG_HEIGHTS[unit?.unitType ?? "mech"] ?? DEBUG_HEIGHTS.mech;

  const line = svgEl("line");
  line.setAttribute("x1", String(anchorX));
  line.setAttribute("y1", String(anchorY));
  line.setAttribute("x2", String(anchorX));
  line.setAttribute("y2", String(anchorY - (profile.head * RENDER_CONFIG.elevationStepPx)));
  line.setAttribute("stroke", unit?.unitType === "pilot" ? "#7fd6ff" : "#ffd166");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-dasharray", "4 4");
  line.setAttribute("pointer-events", "none");
  parent.appendChild(line);

  const bodyDot = makePoleDot(
    anchorX,
    anchorY - (profile.body * RENDER_CONFIG.elevationStepPx),
    unit?.unitType === "pilot" ? "#7fd6ff" : "#ffd166"
  );
  const headDot = makePoleDot(
    anchorX,
    anchorY - (profile.head * RENDER_CONFIG.elevationStepPx),
    "#ff5c5c"
  );

  parent.appendChild(bodyDot);
  parent.appendChild(headDot);
}

function makePoleDot(x, y, fill) {
  const circle = svgEl("circle");
  circle.setAttribute("cx", String(x));
  circle.setAttribute("cy", String(y));
  circle.setAttribute("r", "4");
  circle.setAttribute("fill", fill);
  circle.setAttribute("stroke", "#101418");
  circle.setAttribute("stroke-width", "1.5");
  circle.setAttribute("pointer-events", "none");
  return circle;
}

function buildIsoFallbackDiamond(anchorX, anchorY, unit) {
  const footprint = getUnitFootprint(unit);
  const halfW = footprint.width * (RENDER_CONFIG.isoTileWidth / 2);
  const halfH = footprint.height * (RENDER_CONFIG.isoTileHeight / 2);

  return [
    { x: anchorX, y: anchorY - halfH },
    { x: anchorX + halfW, y: anchorY },
    { x: anchorX, y: anchorY + halfH },
    { x: anchorX - halfW, y: anchorY }
  ];
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + ((b.x - a.x) * t),
    y: a.y + ((b.y - a.y) * t)
  };
}

function normalizeFacing(value) {
  const n = Number.isFinite(value) ? value : 0;
  return ((n % 4) + 4) % 4;
}
