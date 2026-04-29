// src/builder/workspace/wysiwygWorkspace.js
//
// Engine-backed WYSIWYG workspace preview and picking helpers.
// This builder layer renders current runtime truth, then adds builder-owned
// read overlays. It does not mutate engine/map state.

import { RENDER_CONFIG } from "../../config.js";
import { renderIso } from "../../render.js";
import {
  ensureCameraState,
  projectIso,
  updateCameraFraming
} from "../../render/projection.js";
import {
  getMapHeight,
  getMapWidth,
  getTile,
  getTileRenderElevation
} from "../../map.js";
import {
  formatDeploymentCell,
  formatEdges,
  formatStructureCells,
  getDeploymentCellTruth,
  getMapSummary,
  getSpawnTruth,
  getStructureCellTruth,
  getStructureEdgeTruth,
  getTileTruth
} from "../builderAdapters.js";

const PICK_MAX_DISTANCE_PX = 44;

export function renderWysiwygWorkspace({ appState, builderState, workspaceRefs }) {
  if (!appState || !workspaceRefs?.board || !workspaceRefs?.worldScene || !workspaceRefs?.worldUi) {
    return;
  }

  const previewState = buildPreviewState(appState, { workspaceRefs });
  renderIso(previewState, workspaceRefs);
  renderBuilderWorkspaceOverlays({ previewState, appState, builderState, workspaceRefs });
  renderWorkspaceReadout({ appState, builderState, workspaceRefs });
}

export function pickWorkspaceTileFromEvent({ event, appState, board }) {
  if (!event || !appState || !board) return null;

  const previewState = buildPreviewState(appState, { updateFraming: false });
  const point = getSvgPointFromEvent(board, event);
  if (!point) return null;

  return pickNearestTile(previewState, point.x, point.y);
}

export function pickWorkspaceEdgeFromEvent({ event, appState, board }) {
  const tilePick = pickWorkspaceTileFromEvent({ event, appState, board });
  if (!tilePick) return null;

  const previewState = buildPreviewState(appState, { updateFraming: false });
  const point = getSvgPointFromEvent(board, event);
  const edge = pickNearestTileEdge(previewState, tilePick.x, tilePick.y, point);

  return {
    ...tilePick,
    edge
  };
}

function buildPreviewState(appState, options = {}) {
  const previewState = cloneForPreview(appState);
  previewState.ui.viewMode = "iso";
  previewState.ui.mode = "idle";
  previewState.ui.previewPath = [];
  previewState.ui.facingPreview = null;
  previewState.ui.preMove = null;
  previewState.ui.commandMenu.open = false;
  previewState.selection.action = null;
  previewState.selection.targetTile = null;
  previewState.camera.zoomMode = "map";
  previewState.camera.zoomLevel = "map";
  previewState.camera.zoomScale = "map";

  ensureCameraState(previewState);

  if (options.updateFraming !== false && options.workspaceRefs) {
    updateCameraFraming(previewState, options.workspaceRefs);
  }

  return previewState;
}

function cloneForPreview(appState) {
  if (typeof structuredClone === "function") {
    return structuredClone(appState);
  }

  return JSON.parse(JSON.stringify(appState));
}

function getSvgPointFromEvent(board, event) {
  const svg = board?.ownerSVGElement ?? board;
  if (!svg?.createSVGPoint) return null;

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;

  const matrix = svg.getScreenCTM?.();
  if (!matrix) return null;

  return point.matrixTransform(matrix.inverse());
}

function pickNearestTile(previewState, svgX, svgY) {
  const map = previewState?.map ?? null;
  const width = getMapWidth(map);
  const height = getMapHeight(map);

  let best = null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;

      const elevation = Number(getTileRenderElevation(tile) ?? 0);
      const center = projectIso(previewState, x + 0.5, y + 0.5, elevation, 1);
      const dx = center.x - svgX;
      const dy = center.y - svgY;
      const distance = Math.sqrt((dx * dx) + (dy * dy));

      if (!best || distance < best.distance) {
        best = { x, y, tile, elevation, distance };
      }
    }
  }

  if (!best || best.distance > PICK_MAX_DISTANCE_PX) return null;
  return best;
}

function pickNearestTileEdge(previewState, x, y, point) {
  const edges = getTileEdgeSegments(previewState, x, y);
  if (!edges.length || !point) return "ne";

  let best = edges[0];
  let bestDistance = Infinity;

  for (const edge of edges) {
    const distance = distancePointToSegment(point, edge.a, edge.b);
    if (distance < bestDistance) {
      best = edge;
      bestDistance = distance;
    }
  }

  return best?.id ?? "ne";
}

function distancePointToSegment(point, a, b) {
  const px = Number(point.x);
  const py = Number(point.y);
  const ax = Number(a.x);
  const ay = Number(a.y);
  const bx = Number(b.x);
  const by = Number(b.y);
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, (((px - ax) * dx) + ((py - ay) * dy)) / ((dx * dx) + (dy * dy))));
  const cx = ax + (t * dx);
  const cy = ay + (t * dy);
  return Math.hypot(px - cx, py - cy);
}

function renderBuilderWorkspaceOverlays({ previewState, appState, builderState, workspaceRefs }) {
  const ui = workspaceRefs.worldUi;
  if (!ui) return;

  const overlays = [];
  const hover = builderState?.hover;
  const selected = builderState?.selected;
  const overlayState = builderState?.overlays ?? {};

  if (overlayState.deployment) overlays.push(renderDeploymentOverlays(previewState, appState));
  if (overlayState.spawns) overlays.push(renderSpawnOverlays(previewState, appState));
  if (overlayState.rooms) overlays.push(renderRoomOverlays(previewState, appState));
  if (overlayState.structureEdges) overlays.push(renderStructureEdgeOverlays(previewState, appState));
  if (overlayState.tileHeights) overlays.push(renderTileHeightOverlays(previewState, appState));

  if (hover?.type === "tile") {
    overlays.push(renderTileMarker(previewState, hover.x, hover.y, "hover"));
  }

  if (selected?.type === "tile") {
    overlays.push(renderTileMarker(previewState, selected.x, selected.y, "selected"));
  }

  if (selected?.type === "edge") {
    overlays.push(renderTileMarker(previewState, selected.x, selected.y, "selected"));
    overlays.push(renderEdgeMarker(previewState, selected.x, selected.y, selected.edge));
  }

  ui.insertAdjacentHTML("beforeend", `<g class="builder-workspace-overlays">${overlays.filter(Boolean).join("")}</g>`);
}

function renderDeploymentOverlays(previewState, appState) {
  const cells = getDeploymentCellTruth(appState?.map);
  if (!cells.length) return "";

  return cells.map((cell) => {
    const points = getTilePolygonPoints(previewState, cell.x, cell.y);
    if (points.length !== 4) return "";
    const label = cell.unitType ?? cell.type ?? "deploy";
    return `
      <polygon class="builder-overlay-deployment" points="${formatPointString(points)}" pointer-events="none" />
      ${renderTileText(previewState, cell.x, cell.y, label, "builder-overlay-label builder-overlay-label-deploy")}
    `;
  }).join("");
}

function renderSpawnOverlays(previewState, appState) {
  const spawns = getSpawnTruth(appState?.map);
  if (!spawns.length) return "";

  return spawns.map((spawn) => {
    const center = getTileCenter(previewState, spawn.x, spawn.y);
    if (!center) return "";
    const label = spawn.team ? spawn.team.slice(0, 1).toUpperCase() : "S";
    return `
      <circle class="builder-overlay-spawn" cx="${round(center.x)}" cy="${round(center.y)}" r="12" pointer-events="none" />
      <text class="builder-overlay-spawn-text" x="${round(center.x)}" y="${round(center.y + 4)}" text-anchor="middle" pointer-events="none">${escapeHtml(label)}</text>
    `;
  }).join("");
}

function renderRoomOverlays(previewState, appState) {
  const cells = getStructureCellTruth(appState?.map);
  if (!cells.length) return "";

  return cells.map((cell) => {
    const points = getTilePolygonPoints(previewState, cell.x, cell.y);
    if (points.length !== 4) return "";
    const label = cell.roomId ?? cell.structureId ?? "cell";
    return `
      <polygon class="builder-overlay-room" points="${formatPointString(points)}" pointer-events="none" />
      ${renderTileText(previewState, cell.x, cell.y, label, "builder-overlay-label builder-overlay-label-room")}
    `;
  }).join("");
}

function renderStructureEdgeOverlays(previewState, appState) {
  const edges = getStructureEdgeTruth(appState?.map);
  if (!edges.length) return "";

  return edges.map((edge) => {
    const segment = getTileEdgeSegments(previewState, edge.x, edge.y)
      .find((candidate) => candidate.id === String(edge.edge ?? "").toLowerCase());
    if (!segment) return "";

    const height = Number(edge.edgeHeight ?? 0);
    const cls = height > 0 ? "builder-overlay-structure-edge is-blocking" : "builder-overlay-structure-edge is-open";
    const mx = (segment.a.x + segment.b.x) / 2;
    const my = (segment.a.y + segment.b.y) / 2;
    const label = `${edge.type ?? "edge"}:${height}`;

    return `
      <line class="${cls}" x1="${round(segment.a.x)}" y1="${round(segment.a.y)}" x2="${round(segment.b.x)}" y2="${round(segment.b.y)}" pointer-events="none" />
      <text class="builder-overlay-edge-label" x="${round(mx)}" y="${round(my - 3)}" text-anchor="middle" pointer-events="none">${escapeHtml(label)}</text>
    `;
  }).join("");
}

function renderTileHeightOverlays(previewState, appState) {
  const map = appState?.map;
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const labels = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = getTile(map, x, y);
      if (!tile) continue;
      labels.push(renderTileText(previewState, x, y, `h${tile.elevation ?? 0}`, "builder-overlay-label builder-overlay-label-height"));
    }
  }

  return labels.join("");
}

function renderTileText(previewState, x, y, label, className) {
  const center = getTileCenter(previewState, x, y);
  if (!center) return "";
  return `<text class="${className}" x="${round(center.x)}" y="${round(center.y + 4)}" text-anchor="middle" pointer-events="none">${escapeHtml(label)}</text>`;
}

function renderTileMarker(previewState, x, y, tone) {
  const points = getTilePolygonPoints(previewState, x, y);
  if (points.length !== 4) return "";

  const pointString = formatPointString(points);
  const stroke = tone === "hover" ? "#f2d16b" : "#67e8f9";
  const fill = tone === "hover" ? "rgba(242,209,107,0.16)" : "rgba(103,232,249,0.20)";
  const width = tone === "hover" ? 2 : 3;

  return `<polygon points="${pointString}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" vector-effect="non-scaling-stroke" pointer-events="none" />`;
}

function renderEdgeMarker(previewState, x, y, edge) {
  const segment = getTileEdgeSegments(previewState, x, y)
    .find((candidate) => candidate.id === String(edge ?? "").toLowerCase());

  if (!segment) return "";

  const { a, b } = segment;
  return `<line x1="${round(a.x)}" y1="${round(a.y)}" x2="${round(b.x)}" y2="${round(b.y)}" stroke="#ff7ab6" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none" />`;
}

function getTilePolygonPoints(previewState, x, y) {
  const diamond = getTileScreenDiamond(previewState, x, y);
  if (!diamond) return [];

  return [diamond.top, diamond.right, diamond.bottom, diamond.left];
}

function getTileCenter(previewState, x, y) {
  const points = getTilePolygonPoints(previewState, x, y);
  if (points.length !== 4) return null;
  const xSum = points.reduce((sum, point) => sum + point.x, 0);
  const ySum = points.reduce((sum, point) => sum + point.y, 0);
  return { x: xSum / points.length, y: ySum / points.length };
}

function getTileScreenDiamond(previewState, x, y) {
  const tile = getTile(previewState?.map, x, y);
  if (!tile) return null;

  // Builder-only copy of the terrain/structure screen diamond contract:
  // project the tile origin once, then build the diamond from fixed iso offsets.
  // This makes the selection marker match the rendered isometric tile without
  // changing engine/runtime rendering code.
  const elevation = Number(getTileRenderElevation(tile) ?? 0);
  const origin = projectIso(previewState, x, y, elevation, 1);
  const halfW = RENDER_CONFIG.isoTileWidth / 2;
  const halfH = RENDER_CONFIG.isoTileHeight / 2;

  return {
    top: { x: origin.x, y: origin.y },
    right: { x: origin.x + halfW, y: origin.y + halfH },
    bottom: { x: origin.x, y: origin.y + (halfH * 2) },
    left: { x: origin.x - halfW, y: origin.y + halfH }
  };
}

function getTileEdgeSegments(previewState, x, y) {
  const diamond = getTileScreenDiamond(previewState, x, y);
  if (!diamond) return [];

  return [
    { id: getWorldFaceForScreenEdge(previewState.rotation, "topLeft"), a: diamond.top, b: diamond.left },
    { id: getWorldFaceForScreenEdge(previewState.rotation, "topRight"), a: diamond.top, b: diamond.right },
    { id: getWorldFaceForScreenEdge(previewState.rotation, "bottomRight"), a: diamond.right, b: diamond.bottom },
    { id: getWorldFaceForScreenEdge(previewState.rotation, "bottomLeft"), a: diamond.left, b: diamond.bottom }
  ].filter((edge) => edge.id);
}

function getWorldFaceForScreenEdge(rotation, screenEdge) {
  const leftWorldFace = getWorldFaceForScreenSide(rotation, "left");
  const rightWorldFace = getWorldFaceForScreenSide(rotation, "right");
  const topRightWorldFace = getOppositeWorldFace(leftWorldFace);
  const topLeftWorldFace = getOppositeWorldFace(rightWorldFace);

  switch (screenEdge) {
    case "bottomLeft":
      return leftWorldFace;
    case "bottomRight":
      return rightWorldFace;
    case "topRight":
      return topRightWorldFace;
    case "topLeft":
      return topLeftWorldFace;
    default:
      return null;
  }
}

function getWorldFaceForScreenSide(rotation, screenSide) {
  const index = normalizeRotationIndex(rotation);
  const side = String(screenSide ?? "").toLowerCase();

  const leftFaces = ["sw", "se", "ne", "nw"];
  const rightFaces = ["se", "ne", "nw", "sw"];

  if (side === "left") return leftFaces[index];
  if (side === "right") return rightFaces[index];
  return null;
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

function normalizeRotationIndex(rotation) {
  const raw = Math.round(Number(rotation ?? 0));
  return ((raw % 4) + 4) % 4;
}

function renderWorkspaceReadout({ appState, builderState, workspaceRefs }) {
  const readout = workspaceRefs.readout;
  if (!readout) return;

  const summary = getMapSummary(appState);
  const selected = builderState?.selected;

  readout.innerHTML = `
    <div class="builder-readout-kicker">DRAFT PREVIEW · READ ONLY</div>
    <div class="builder-readout-title">${escapeHtml(summary.name)}</div>
    <div class="builder-readout-grid">
      <span>Map ID</span><strong>${escapeHtml(summary.id)}</strong>
      <span>Size</span><strong>${summary.width} × ${summary.height}</strong>
      <span>Structures</span><strong>${summary.structureCount}</strong>
      <span>Deployment Cells</span><strong>${summary.deploymentCellCount}</strong>
      <span>Spawns</span><strong>${summary.spawnCount}</strong>
      <span>Selected</span><strong>${escapeHtml(selected?.label ?? "Map")}</strong>
    </div>
    <div class="builder-readout-help">Click selects draft tile truth. Shift-click selects nearest tile edge. Preview is a builder-owned clone; the engine track is not changed.</div>
  `;
}

export function buildTileInspectorHtml(appState, selection) {
  if (!appState || selection?.type !== "tile" && selection?.type !== "edge") return "";

  const truth = getTileTruth(appState, selection.x, selection.y);
  if (!truth) return `<div class="builder-inspector-note">No tile found at ${selection.x}, ${selection.y}.</div>`;

  const selectedEdgeId = String(selection.edge ?? "").toLowerCase();
  const selectedEdgeTruth = selection.type === "edge"
    ? truth.authoredEdges.find((edge) => String(edge.edge ?? "").toLowerCase() === selectedEdgeId)
    : null;

  const edgeNote = selection.type === "edge"
    ? `<div class="builder-inspector-card is-emphasis"><div class="builder-field-label">Selected Edge</div><div class="builder-field-value">${escapeHtml(selectedEdgeId.toUpperCase())}</div></div>
       <div class="builder-inspector-card"><div class="builder-field-label">Selected Edge Truth</div><div class="builder-field-value">${selectedEdgeTruth ? escapeHtml(`${selectedEdgeTruth.type ?? "edge"}:${selectedEdgeTruth.edgeHeight ?? 0} / ${selectedEdgeTruth.structureId ?? "structure"}`) : "No authored edge on this side"}</div></div>`
    : "";

  return `
    ${edgeNote}
    <div class="builder-inspector-card">
      <div class="builder-field-label">Coordinates</div>
      <div class="builder-field-value">${truth.x}, ${truth.y}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Terrain</div>
      <div class="builder-field-value">${escapeHtml(truth.terrainTypeId)}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Elevation</div>
      <div class="builder-field-value">${escapeHtml(truth.elevation)}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Movement Class</div>
      <div class="builder-field-value">${escapeHtml(truth.movementClass)}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Structure Cell</div>
      <div class="builder-field-value">${truth.structureCells.length ? escapeHtml(formatStructureCells(truth.structureCells)) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Authored Edges</div>
      <div class="builder-field-value">${truth.authoredEdges.length ? escapeHtml(formatEdges(truth.authoredEdges)) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Spawn</div>
      <div class="builder-field-value">${truth.spawn ? escapeHtml(truth.spawn.id) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Deployment</div>
      <div class="builder-field-value">${truth.deploymentCell ? escapeHtml(formatDeploymentCell(truth.deploymentCell)) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Runtime Unit</div>
      <div class="builder-field-value">${truth.unit ? escapeHtml(truth.unit.name ?? truth.unit.instanceId ?? truth.unit.id) : "None"}</div>
    </div>
    <div class="builder-inspector-note">Read-only inspection through builder adapters. Edits stay locked until mutation adapters are in place.</div>
  `;
}

function formatPointString(points) {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
