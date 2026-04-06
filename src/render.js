// src/render.js

import { MAP_CONFIG, RENDER_CONFIG } from "./config.js";
import { getTile, rotateCoord, tileTypeFromElevation } from "./map.js";
import { getReachableTiles } from "./movement.js";
import { getMechById } from "./mechs.js";
import { svgEl, makePolygon, makeText } from "./utils.js";

const TOPDOWN_CONFIG = {
  cellSize: 56,
  originX: 460,
  originY: 130
};

const LOS_HEIGHT_PROFILES = {
  mech: {
    fire: 1,
    chest: 1,
    head: 2
  },
  pilot: {
    fire: 0.25,
    chest: 0.125,
    head: 0.25
  }
};

export function renderAll(state, refs) {
  renderIso(state, refs);
  renderEditor(state, refs);
}

export function renderIso(state, refs) {
  const { worldScene, worldUi, rotationLabel } = refs;
  const { map, mechs } = state;

  worldScene.innerHTML = "";
  worldUi.innerHTML = "";

  const sceneItems = [];
  const reachableMap = new Map();

  if (state.ui.mode === "move") {
    for (const tile of getReachableTiles(state)) {
      reachableMap.set(`${tile.x},${tile.y}`, tile.cost);
    }
  }

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      const projected = projectScene(state, x, y, tile.elevation);

      sceneItems.push({
        kind: "tile",
        x,
        y,
        elevation: tile.elevation,
        screenX: projected.x,
        screenY: projected.y,
        sortKey: getSceneSortKey(state, x, y, tile.elevation),
        reachableCost: reachableMap.get(`${x},${y}`) ?? null
      });
    }
  }

  for (const mech of mechs) {
    const tile = getTile(map, mech.x, mech.y);
    const projected = projectScene(state, mech.x, mech.y, tile.elevation);

    sceneItems.push({
      kind: "mech",
      mech,
      elevation: tile.elevation,
      screenX: projected.x,
      screenY: projected.y,
      sortKey: getSceneSortKey(state, mech.x, mech.y, tile.elevation) + 0.25
    });
  }

  sceneItems.sort((a, b) => a.sortKey - b.sortKey);

  for (const item of sceneItems) {
    if (item.kind === "tile") {
      if (state.ui.viewMode === "top") {
        drawTopTile(item, worldScene);
      } else {
        drawIsoTile(item, worldScene);
      }

      if (state.ui.mode === "move" && item.reachableCost !== null) {
        drawSceneMoveOverlay(state, item, worldScene, String(item.reachableCost));
      }

      drawScenePathOverlayForTile(state, item, worldScene);
      drawSceneActionOverlayForTile(state, item, worldScene);
      drawSceneFocusOverlayForTile(state, item, worldScene);
    } else {
      const isActive = item.mech.instanceId === state.turn.activeMechId;
      drawMech(state, item.mech, item.screenX, item.screenY, worldScene, isActive);
    }
  }

  drawSceneLosPreview(state, worldUi);

  const snappedRotation = normalizedTurns(state);
  rotationLabel.textContent =
    state.ui.viewMode === "top"
      ? `View: Tactical · Rotation: ${snappedRotation * 90}°`
      : `View: Iso · Rotation: ${Math.round(state.camera.angle) % 360}°`;
}

export function renderEditor(state, refs) {
  const { editor } = refs;
  const { map } = state;

  editor.innerHTML = "";

  const usable = RENDER_CONFIG.editorSize - (RENDER_CONFIG.editorPadding * 2);
  const cellWidth = usable / MAP_CONFIG.mechWidth;
  const cellHeight = usable / MAP_CONFIG.mechHeight;

  for (let y = 0; y < MAP_CONFIG.mechHeight; y++) {
    for (let x = 0; x < MAP_CONFIG.mechWidth; x++) {
      const tile = getTile(map, x, y);
      const px = RENDER_CONFIG.editorPadding + (x * cellWidth);
      const py = RENDER_CONFIG.editorPadding + (y * cellHeight);

      const group = svgEl("g");

      const rect = svgEl("rect");
      rect.setAttribute("x", px);
      rect.setAttribute("y", py);
      rect.setAttribute("width", cellWidth);
      rect.setAttribute("height", cellHeight);
      rect.setAttribute("fill", editorCellColor(tile.elevation));
      rect.setAttribute("class", "editor-cell");
      rect.dataset.x = String(x);
      rect.dataset.y = String(y);

      const label = makeText(
        px + (cellWidth / 2),
        py + (cellHeight / 2),
        String(tile.elevation),
        "editor-text"
      );

      group.appendChild(rect);
      group.appendChild(label);
      editor.appendChild(group);
    }
  }
}

function drawSceneLosPreview(state, parent) {
  if (state.ui.mode !== "action-target") return;

  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  const profile = state.ui.action.selectedAction;

  if (!activeMech || !profile) return;

  const focusedTarget = (state.ui.action.validTargetTiles || []).find(
    (tile) => tile.x === state.focus.x && tile.y === state.focus.y
  );

  if (!focusedTarget || !focusedTarget.los) return;

  const attackerTile = getTile(state.map, activeMech.x, activeMech.y);
  const targetTile = getTile(state.map, focusedTarget.x, focusedTarget.y);

  if (!attackerTile || !targetTile) return;

  const attackerScale = activeMech.scale ?? "mech";
  const targetScale = profile.scale ?? "mech";

  const attackerHeights = getLosHeights(attackerTile.elevation, attackerScale);
  const targetHeights = getLosHeights(targetTile.elevation, targetScale);

  const attackerFirePoint = projectLosPoint(
    state,
    activeMech.x,
    activeMech.y,
    attackerHeights.fire
  );

  const targetChestPoint = projectLosPoint(
    state,
    focusedTarget.x,
    focusedTarget.y,
    targetHeights.chest
  );

  const targetHeadPoint = projectLosPoint(
    state,
    focusedTarget.x,
    focusedTarget.y,
    targetHeights.head
  );

  const isMissile = isMissileProfile(profile);
  const los = focusedTarget.los;

  if (isMissile) {
    const headColor = los.rays?.head?.blocked ? "#ff4a4a" : "#52d092";
    drawLosLine(parent, attackerFirePoint, targetHeadPoint, headColor, 3.5, true);
    drawLosEndpoint(parent, attackerFirePoint, headColor);
    drawLosEndpoint(parent, targetHeadPoint, headColor);
    return;
  }

  let chestColor = "#52d092";
  let headColor = "#52d092";

  if (los.rays?.head?.blocked) {
    chestColor = "#ff4a4a";
    headColor = "#ff4a4a";
  } else if (los.rays?.chest?.blocked) {
    chestColor = "#f0b000";
    headColor = "#52d092";
  }

  drawLosLine(parent, attackerFirePoint, targetChestPoint, chestColor, 3, false);
  drawLosLine(parent, attackerFirePoint, targetHeadPoint, headColor, 3.5, true);

  drawLosEndpoint(parent, attackerFirePoint, headColor);
  drawLosEndpoint(parent, targetChestPoint, chestColor);
  drawLosEndpoint(parent, targetHeadPoint, headColor);
}

function getLosHeights(baseElevation, scale = "mech") {
  const profile = LOS_HEIGHT_PROFILES[scale] ?? LOS_HEIGHT_PROFILES.mech;
  return {
    fire: baseElevation + profile.fire,
    chest: baseElevation + profile.chest,
    head: baseElevation + profile.head
  };
}

function projectLosPoint(state, x, y, elevation) {
  if (state.ui.viewMode === "top") {
    const snappedTurns = normalizedTurns(state);
    const rotated = rotateCoord(
      x,
      y,
      MAP_CONFIG.mechWidth,
      MAP_CONFIG.mechHeight,
      snappedTurns
    );

    return {
      x: TOPDOWN_CONFIG.originX + (rotated.x * TOPDOWN_CONFIG.cellSize) + (TOPDOWN_CONFIG.cellSize / 2),
      y: TOPDOWN_CONFIG.originY + (rotated.y * TOPDOWN_CONFIG.cellSize) + (TOPDOWN_CONFIG.cellSize / 2)
    };
  }

  const projected = projectScene(state, x, y, elevation);
  return {
    x: projected.x,
    y: projected.y + (RENDER_CONFIG.isoTileHeight * 0.5)
  };
}

function drawLosLine(parent, from, to, color, width = 3, dashed = false) {
  const glow = svgEl("line");
  glow.setAttribute("x1", from.x);
  glow.setAttribute("y1", from.y);
  glow.setAttribute("x2", to.x);
  glow.setAttribute("y2", to.y);
  glow.setAttribute("stroke", color);
  glow.setAttribute("stroke-width", String(width + 4));
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("opacity", "0.18");
  if (dashed) {
    glow.setAttribute("stroke-dasharray", "8 6");
  }

  const line = svgEl("line");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", String(width));
  line.setAttribute("stroke-linecap", "round");
  if (dashed) {
    line.setAttribute("stroke-dasharray", "8 6");
  }

  parent.appendChild(glow);
  parent.appendChild(line);
}

function drawLosEndpoint(parent, point, color) {
  const outer = svgEl("circle");
  outer.setAttribute("cx", point.x);
  outer.setAttribute("cy", point.y);
  outer.setAttribute("r", "6");
  outer.setAttribute("fill", color);
  outer.setAttribute("opacity", "0.22");

  const inner = svgEl("circle");
  inner.setAttribute("cx", point.x);
  inner.setAttribute("cy", point.y);
  inner.setAttribute("r", "2.75");
  inner.setAttribute("fill", color);

  parent.appendChild(outer);
  parent.appendChild(inner);
}

function isMissileProfile(profile) {
  return (
    profile?.targeting?.kind === "fire_arc_tile" &&
    profile?.effect?.kind === "circle"
  );
}

function projectScene(state, x, y, elevation) {
  if (state.ui.viewMode === "top") {
    const snappedTurns = normalizedTurns(state);
    const rotated = rotateCoord(
      x,
      y,
      MAP_CONFIG.mechWidth,
      MAP_CONFIG.mechHeight,
      snappedTurns
    );

    return {
      x: TOPDOWN_CONFIG.originX + (rotated.x * TOPDOWN_CONFIG.cellSize),
      y: TOPDOWN_CONFIG.originY + (rotated.y * TOPDOWN_CONFIG.cellSize)
    };
  }

  const startTurns = Math.floor(state.camera.angle / 90) % 4;
  const nextTurns = (startTurns + 1) % 4;
  const blend = (state.camera.angle % 90) / 90;

  const startRot = rotateCoord(
    x,
    y,
    MAP_CONFIG.mechWidth,
    MAP_CONFIG.mechHeight,
    startTurns
  );

  const nextRot = rotateCoord(
    x,
    y,
    MAP_CONFIG.mechWidth,
    MAP_CONFIG.mechHeight,
    nextTurns
  );

  const p0 = isoProject(startRot.x, startRot.y, elevation);
  const p1 = isoProject(nextRot.x, nextRot.y, elevation);

  return {
    x: lerp(p0.x, p1.x, blend),
    y: lerp(p0.y, p1.y, blend)
  };
}

function getSceneSortKey(state, x, y, elevation) {
  const turns = normalizedTurns(state);

  const rotated = rotateCoord(
    x,
    y,
    MAP_CONFIG.mechWidth,
    MAP_CONFIG.mechHeight,
    turns
  );

  return (rotated.x + rotated.y) * 100 + elevation;
}

function drawSceneActionOverlayForTile(state, item, parent) {
  if (state.ui.mode !== "action-target") return;

  const key = `${item.x},${item.y}`;
  const fireArc = tileSetFromList(state.ui.action.fireArcTiles || []);
  const validTiles = tileSetFromList(state.ui.action.validTargetTiles || []);
  const effectTiles = tileSetFromList(state.ui.action.effectTiles || []);

  let fill = null;
  let stroke = null;

  if (fireArc.has(key)) {
    fill = "rgba(255, 176, 0, 0.06)";
    stroke = "rgba(255, 176, 0, 0.22)";
  }

  if (validTiles.has(key)) {
    fill = "rgba(82, 208, 146, 0.12)";
    stroke = "rgba(82, 208, 146, 0.55)";
  }

  if (effectTiles.has(key)) {
    fill = "rgba(255, 74, 74, 0.14)";
    stroke = "rgba(255, 74, 74, 0.70)";
  }

  if (!fill || !stroke) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(item.screenX, item.screenY, fill, stroke, parent);
    return;
  }

  drawOverlayDiamond(item.screenX, item.screenY, "action-preview-tile", fill, stroke, parent);
}

function drawSceneFocusOverlayForTile(state, item, parent) {
  if (item.x !== state.focus.x || item.y !== state.focus.y) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      item.screenX,
      item.screenY,
      "rgba(240, 176, 0, 0.04)",
      "rgba(240, 176, 0, 0.95)",
      parent
    );
    return;
  }

  drawOverlayDiamond(
    item.screenX,
    item.screenY,
    "focus-tile",
    "rgba(240, 176, 0, 0.04)",
    "rgba(240, 176, 0, 0.95)",
    parent
  );
}

function drawScenePathOverlayForTile(state, item, parent) {
  if (state.ui.mode !== "move") return;

  const path = state.ui.previewPath || [];
  if (!path.length) return;

  const step = path.find((p) => p.x === item.x && p.y === item.y);
  if (!step) return;

  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      item.screenX,
      item.screenY,
      "rgba(240, 176, 0, 0.10)",
      "rgba(240, 176, 0, 0.90)",
      parent
    );

    if (step.cost !== undefined && step.cost !== null) {
      const label = makeText(
        item.screenX + (TOPDOWN_CONFIG.cellSize / 2),
        item.screenY + (TOPDOWN_CONFIG.cellSize / 2),
        String(step.cost),
        "move-cost-label"
      );
      styleMoveCostLabel(label);
      parent.appendChild(label);
    }

    return;
  }

  drawOverlayDiamond(
    item.screenX,
    item.screenY,
    "move-path-tile",
    "rgba(240, 176, 0, 0.10)",
    "rgba(240, 176, 0, 0.85)",
    parent
  );

  if (step.cost !== undefined && step.cost !== null) {
    const label = makeText(
      item.screenX,
      item.screenY + (RENDER_CONFIG.isoTileHeight * 0.62),
      String(step.cost),
      "move-cost-label"
    );
    styleMoveCostLabel(label);
    parent.appendChild(label);
  }
}

function tileSetFromList(tiles) {
  const set = new Set();
  for (const tile of tiles) {
    set.add(`${tile.x},${tile.y}`);
  }
  return set;
}

function isoProject(x, y, elevation) {
  const screenX =
    (x - y) * (RENDER_CONFIG.isoTileWidth / 2) + RENDER_CONFIG.originX;

  const screenY =
    (x + y) * (RENDER_CONFIG.isoTileHeight / 2) +
    RENDER_CONFIG.originY -
    (elevation * RENDER_CONFIG.elevationStepPx);

  return { x: screenX, y: screenY };
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function normalizedTurns(state) {
  return ((Math.round(state.camera.angle / 90) % 4) + 4) % 4;
}

function drawIsoTile(item, parent) {
  const { x, y, elevation, screenX, screenY } = item;

  const type = tileTypeFromElevation(elevation);
  const colors = tileColors(type);

  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;
  const heightPx = elevation * RENDER_CONFIG.elevationStepPx;

  const top = {
    top: { x: screenX, y: screenY },
    right: { x: screenX + halfW, y: screenY + halfH },
    bottom: { x: screenX, y: screenY + RENDER_CONFIG.isoTileHeight },
    left: { x: screenX - halfW, y: screenY + halfH }
  };

  const leftFace = [
    top.left,
    top.bottom,
    { x: top.bottom.x, y: top.bottom.y + heightPx },
    { x: top.left.x, y: top.left.y + heightPx }
  ];

  const rightFace = [
    top.right,
    top.bottom,
    { x: top.bottom.x, y: top.bottom.y + heightPx },
    { x: top.right.x, y: top.right.y + heightPx }
  ];

  const topFace = [top.top, top.right, top.bottom, top.left];

  const group = svgEl("g");
  group.dataset.x = String(x);
  group.dataset.y = String(y);

  if (elevation > 0) {
    group.appendChild(makePolygon(leftFace, "tile-left", colors.left));
    group.appendChild(makePolygon(rightFace, "tile-right", colors.right));
  }

  group.appendChild(makePolygon(topFace, "tile-top", colors.top));
  group.appendChild(makePolygon(topFace, "tile-outline", "none"));

  if (RENDER_CONFIG.showCoords) {
    group.appendChild(
      makeText(
        screenX,
        screenY + (RENDER_CONFIG.isoTileHeight * 0.68),
        `${x},${y}:${elevation}`,
        "iso-label"
      )
    );
  }

  parent.appendChild(group);
}

function drawTopTile(item, parent) {
  const { x, y, elevation, screenX, screenY } = item;
  const type = tileTypeFromElevation(elevation);
  const colors = tileColors(type);

  const rect = svgEl("rect");
  rect.setAttribute("x", screenX);
  rect.setAttribute("y", screenY);
  rect.setAttribute("width", TOPDOWN_CONFIG.cellSize);
  rect.setAttribute("height", TOPDOWN_CONFIG.cellSize);
  rect.setAttribute("fill", colors.top);
  rect.setAttribute("stroke", "rgba(255,255,255,0.08)");
  rect.setAttribute("stroke-width", "1");
  rect.dataset.x = String(x);
  rect.dataset.y = String(y);

  parent.appendChild(rect);

  if (elevation > 0) {
    const label = makeText(
      screenX + TOPDOWN_CONFIG.cellSize - 8,
      screenY + 14,
      String(elevation),
      "top-elevation-label"
    );
    label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "rgba(255,255,255,0.9)");
    label.setAttribute("font-size", "12");
    parent.appendChild(label);
  }
}

function drawSceneMoveOverlay(state, item, parent, text) {
  if (state.ui.viewMode === "top") {
    drawTopOverlayBox(
      item.screenX,
      item.screenY,
      "rgba(80, 180, 255, 0.10)",
      "rgba(80, 180, 255, 0.35)",
      parent
    );

    const label = makeText(
      item.screenX + (TOPDOWN_CONFIG.cellSize / 2),
      item.screenY + (TOPDOWN_CONFIG.cellSize / 2),
      text,
      "move-cost-label"
    );
    styleMoveCostLabel(label);
    parent.appendChild(label);
    return;
  }

  drawOverlayDiamond(
    item.screenX,
    item.screenY,
    "move-range-tile",
    "rgba(80, 180, 255, 0.10)",
    "rgba(80, 180, 255, 0.35)",
    parent
  );

  const label = makeText(
    item.screenX,
    item.screenY + (RENDER_CONFIG.isoTileHeight * 0.62),
    text,
    "move-cost-label"
  );
  styleMoveCostLabel(label);
  parent.appendChild(label);
}

function styleMoveCostLabel(label) {
  label.setAttribute("fill", "#dceeff");
  label.setAttribute("font-size", "13");
  label.setAttribute("font-weight", "700");
  label.setAttribute("stroke", "rgba(0,0,0,0.65)");
  label.setAttribute("stroke-width", "3");
  label.setAttribute("paint-order", "stroke fill");
}

function drawMech(state, mech, screenX, screenY, parent, isActive = false) {
  const group = svgEl("g");
  const tile = getTile(state.map, mech.x, mech.y);

  if (!tile) return;

  if (state.ui.viewMode === "top") {
    const cellX = screenX + (TOPDOWN_CONFIG.cellSize / 2);
    const cellY = screenY + (TOPDOWN_CONFIG.cellSize / 2);
    const size = 14;

    const body = svgEl("rect");
    body.setAttribute("x", cellX - size);
    body.setAttribute("y", cellY - size);
    body.setAttribute("width", size * 2);
    body.setAttribute("height", size * 2);
    body.setAttribute("rx", "3");
    body.setAttribute("class", getTopMechBodyClass(state, mech, isActive));

    const facingMark = makePolygon(
      getTopFacingStripePointsFromWorld(state, mech, tile.elevation, cellX, cellY),
      getTopFacingClass(state, mech),
      "currentColor"
    );
    facingMark.removeAttribute("fill");

    const label = makeText(
      cellX,
      cellY + 24,
      mech.name,
      "mech-label"
    );

    group.appendChild(body);
    group.appendChild(facingMark);
    group.appendChild(label);
    parent.appendChild(group);
    return;
  }

  const halfW = 18;
  const halfH = 10;
  const height = 18;

  const anchorX = screenX;
  const anchorY = screenY + (RENDER_CONFIG.isoTileHeight / 2);

  const top = [
    { x: anchorX,         y: anchorY - height - halfH },
    { x: anchorX + halfW, y: anchorY - height },
    { x: anchorX,         y: anchorY - height + halfH },
    { x: anchorX - halfW, y: anchorY - height }
  ];

  const left = [
    top[3],
    top[2],
    { x: top[2].x, y: top[2].y + height },
    { x: top[3].x, y: top[3].y + height }
  ];

  const right = [
    top[1],
    top[2],
    { x: top[2].x, y: top[2].y + height },
    { x: top[1].x, y: top[1].y + height }
  ];

  const shadow = svgEl("ellipse");
  shadow.setAttribute("cx", anchorX);
  shadow.setAttribute("cy", anchorY + 10);
  shadow.setAttribute("rx", 18);
  shadow.setAttribute("ry", 8);
  shadow.setAttribute("class", "mech-shadow");

  const leftPoly = makePolygon(left, "mech-cube-left", "currentColor");
  leftPoly.removeAttribute("fill");

  const rightPoly = makePolygon(right, "mech-cube-right", "currentColor");
  rightPoly.removeAttribute("fill");

  const topPoly = makePolygon(
    top,
    getIsoTopClass(state, mech, isActive),
    "currentColor"
  );
  topPoly.removeAttribute("fill");

  const stripe = makePolygon(
    getIsoTopStripePointsFromWorld(state, mech, tile.elevation, anchorX, anchorY, height, halfH),
    getIsoTopStripeClass(state, mech),
    "currentColor"
  );
  stripe.removeAttribute("fill");

  const label = makeText(
    anchorX,
    anchorY - height + 6,
    mech.name,
    "mech-label"
  );

  group.appendChild(shadow);
  group.appendChild(leftPoly);
  group.appendChild(rightPoly);
  group.appendChild(topPoly);
  group.appendChild(stripe);
  group.appendChild(label);

  parent.appendChild(group);
}

function getWorldFacing(state, mech) {
  const isPreviewing =
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? state.ui.facingPreview : mech.facing;
}

function facingToWorldDelta(facing) {
  switch (facing) {
    case 0:
      return { dx: 0, dy: -1 };
    case 1:
      return { dx: 1, dy: 0 };
    case 2:
      return { dx: 0, dy: 1 };
    case 3:
      return { dx: -1, dy: 0 };
    default:
      return { dx: 0, dy: -1 };
  }
}

function getTopMechBodyClass(state, mech, isActive) {
  const classes = ["mech-top-body"];

  if (isActive) {
    classes.push("mech-top-body-active");
  }

  if (
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null
  ) {
    classes.push("mech-top-body-preview");
  }

  return classes.join(" ");
}

function getTopFacingClass(state, mech) {
  const isPreviewing =
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-top-facing-preview" : "mech-top-facing";
}

function getIsoTopClass(state, mech, isActive) {
  const classes = ["mech-cube-top"];

  if (isActive) {
    classes.push("mech-cube-top-active");
  }

  if (
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null
  ) {
    classes.push("mech-cube-top-preview");
  }

  return classes.join(" ");
}

function getIsoTopStripeClass(state, mech) {
  const isPreviewing =
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? "mech-cube-top-stripe-preview" : "mech-cube-top-stripe";
}

function getTopFacingStripePointsFromWorld(state, mech, elevation, centerX, centerY) {
  const facing = getWorldFacing(state, mech);
  const { dx, dy } = facingToWorldDelta(facing);

  const from = projectScene(state, mech.x, mech.y, elevation);
  const to = projectScene(state, mech.x + dx, mech.y + dy, elevation);

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const length = Math.hypot(vx, vy) || 1;
  const ux = vx / length;
  const uy = vy / length;
  const px = -uy;
  const py = ux;

  const start = {
    x: centerX - (ux * 4),
    y: centerY - (uy * 4)
  };

  const end = {
    x: centerX + (ux * 10),
    y: centerY + (uy * 10)
  };

  const halfThickness = 2.8;

  return [
    {
      x: start.x + (px * halfThickness),
      y: start.y + (py * halfThickness)
    },
    {
      x: end.x + (px * halfThickness),
      y: end.y + (py * halfThickness)
    },
    {
      x: end.x - (px * halfThickness),
      y: end.y - (py * halfThickness)
    },
    {
      x: start.x - (px * halfThickness),
      y: start.y - (py * halfThickness)
    }
  ];
}

function getIsoTopStripePointsFromWorld(state, mech, elevation, anchorX, anchorY, height, halfH) {
  const facing = getWorldFacing(state, mech);
  const { dx, dy } = facingToWorldDelta(facing);

  const from = projectScene(state, mech.x, mech.y, elevation);
  const to = projectScene(state, mech.x + dx, mech.y + dy, elevation);

  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const length = Math.hypot(vx, vy) || 1;
  const ux = vx / length;
  const uy = vy / length;
  const px = -uy;
  const py = ux;

  const center = {
    x: anchorX,
    y: anchorY - height
  };

  const start = {
    x: center.x - (ux * 3),
    y: center.y - (uy * 3)
  };

  const end = {
    x: center.x + (ux * 12),
    y: center.y + (uy * 12)
  };

  const halfThickness = 2.4;

  return [
    {
      x: start.x + (px * halfThickness),
      y: start.y + (py * halfThickness)
    },
    {
      x: end.x + (px * halfThickness),
      y: end.y + (py * halfThickness)
    },
    {
      x: end.x - (px * halfThickness),
      y: end.y - (py * halfThickness)
    },
    {
      x: start.x - (px * halfThickness),
      y: start.y - (py * halfThickness)
    }
  ];
}

function drawOverlayDiamond(screenX, screenY, className, fill, stroke, parent) {
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;

  const points = [
    { x: screenX, y: screenY },
    { x: screenX + halfW, y: screenY + halfH },
    { x: screenX, y: screenY + RENDER_CONFIG.isoTileHeight },
    { x: screenX - halfW, y: screenY + halfH }
  ];

  const poly = makePolygon(points, className, fill);
  poly.setAttribute("stroke", stroke);
  poly.setAttribute("stroke-width", "1.5");
  parent.appendChild(poly);
}

function drawTopOverlayBox(screenX, screenY, fill, stroke, parent) {
  const rect = svgEl("rect");
  rect.setAttribute("x", screenX + 3);
  rect.setAttribute("y", screenY + 3);
  rect.setAttribute("width", TOPDOWN_CONFIG.cellSize - 6);
  rect.setAttribute("height", TOPDOWN_CONFIG.cellSize - 6);
  rect.setAttribute("rx", "8");
  rect.setAttribute("fill", fill);
  rect.setAttribute("stroke", stroke);
  rect.setAttribute("stroke-width", "1.5");
  parent.appendChild(rect);
}

function tileColors(type) {
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

function editorCellColor(elevation) {
  if (elevation >= 5) return "#d97706";
  if (elevation >= 4) return "#b45309";
  if (elevation >= 3) return "#8b6b4a";
  if (elevation >= 2) return "#5e7751";
  if (elevation >= 1) return "#4e6b86";
  return "#243241";
}
