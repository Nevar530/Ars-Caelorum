// src/builder/workspace/wysiwygWorkspace.js
//
// Engine-backed WYSIWYG workspace preview and picking helpers.
// This is the first builder adapter layer: it renders the current runtime map
// using the same projection/render modules as the game scene, then overlays
// builder-owned hover/selection markers without mutating runtime truth.

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
  getMapStructures,
  getStructureCells,
  getStructureEdgeParts,
  getStructuresAtTile,
  makeCellKey
} from "../../structures/structureRules.js";

const PICK_MAX_DISTANCE_PX = 44;
const TILE_EDGE_ORDER = ["ne", "se", "sw", "nw"];

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
  const polygon = getTilePolygonPoints(previewState, x, y);
  if (polygon.length !== 4 || !point) return "ne";

  const edges = [
    { id: "ne", a: polygon[0], b: polygon[1] },
    { id: "se", a: polygon[1], b: polygon[2] },
    { id: "sw", a: polygon[2], b: polygon[3] },
    { id: "nw", a: polygon[3], b: polygon[0] }
  ];

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

function renderTileMarker(previewState, x, y, tone) {
  const points = getTilePolygonPoints(previewState, x, y);
  if (points.length !== 4) return "";

  const pointString = points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
  const stroke = tone === "hover" ? "#f2d16b" : "#67e8f9";
  const fill = tone === "hover" ? "rgba(242,209,107,0.16)" : "rgba(103,232,249,0.20)";
  const width = tone === "hover" ? 2 : 3;

  return `<polygon points="${pointString}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" vector-effect="non-scaling-stroke" pointer-events="none" />`;
}

function renderEdgeMarker(previewState, x, y, edge) {
  const points = getTilePolygonPoints(previewState, x, y);
  if (points.length !== 4) return "";

  const index = TILE_EDGE_ORDER.indexOf(String(edge ?? "").toLowerCase());
  if (index < 0) return "";

  const edgePairs = [
    [points[0], points[1]],
    [points[1], points[2]],
    [points[2], points[3]],
    [points[3], points[0]]
  ];
  const [a, b] = edgePairs[index];

  return `<line x1="${round(a.x)}" y1="${round(a.y)}" x2="${round(b.x)}" y2="${round(b.y)}" stroke="#ff7ab6" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none" />`;
}

function getTilePolygonPoints(previewState, x, y) {
  const tile = getTile(previewState?.map, x, y);
  if (!tile) return [];

  const elevation = Number(getTileRenderElevation(tile) ?? 0);

  return [
    projectIso(previewState, x + 0.5, y, elevation, 1),
    projectIso(previewState, x + 1, y + 0.5, elevation, 1),
    projectIso(previewState, x + 0.5, y + 1, elevation, 1),
    projectIso(previewState, x, y + 0.5, elevation, 1)
  ];
}

function renderWorkspaceReadout({ appState, builderState, workspaceRefs }) {
  const readout = workspaceRefs.readout;
  if (!readout) return;

  const map = appState?.map ?? null;
  const mapId = map?.id ?? "runtime-map";
  const mapName = map?.name ?? mapId;
  const width = getMapWidth(map);
  const height = getMapHeight(map);
  const structures = Array.isArray(map?.structures) ? map.structures.length : 0;
  const deploymentCells = Array.isArray(map?.startState?.deploymentCells)
    ? map.startState.deploymentCells.length
    : 0;
  const selected = builderState?.selected;

  readout.innerHTML = `
    <div class="builder-readout-kicker">ENGINE PREVIEW</div>
    <div class="builder-readout-title">${escapeHtml(mapName)}</div>
    <div class="builder-readout-grid">
      <span>Map ID</span><strong>${escapeHtml(mapId)}</strong>
      <span>Size</span><strong>${width} × ${height}</strong>
      <span>Structures</span><strong>${structures}</strong>
      <span>Deployment Cells</span><strong>${deploymentCells}</strong>
      <span>Selected</span><strong>${escapeHtml(selected?.label ?? "Map")}</strong>
    </div>
    <div class="builder-readout-help">Click a tile to inspect it. Shift-click selects the nearest tile edge.</div>
  `;
}

export function buildTileInspectorHtml(appState, selection) {
  if (!appState || selection?.type !== "tile" && selection?.type !== "edge") return "";

  const x = Number(selection.x);
  const y = Number(selection.y);
  const map = appState.map;
  const tile = getTile(map, x, y);
  if (!tile) return `<div class="builder-inspector-note">No tile found at ${x}, ${y}.</div>`;

  const structureCells = getStructureCellsAt(map, x, y);
  const authoredEdges = getAuthoredEdgesAt(map, x, y);
  const spawn = getSpawnAt(map, x, y);
  const deploymentCell = getDeploymentCellAt(map, x, y);
  const unit = getUnitAt(appState, x, y);

  const edgeNote = selection.type === "edge"
    ? `<div class="builder-inspector-card is-emphasis"><div class="builder-field-label">Selected Edge</div><div class="builder-field-value">${escapeHtml(selection.edge?.toUpperCase?.() ?? selection.edge)}</div></div>`
    : "";

  return `
    ${edgeNote}
    <div class="builder-inspector-card">
      <div class="builder-field-label">Coordinates</div>
      <div class="builder-field-value">${x}, ${y}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Terrain</div>
      <div class="builder-field-value">${escapeHtml(tile.terrainTypeId ?? tile.type ?? "unknown")}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Elevation</div>
      <div class="builder-field-value">${escapeHtml(tile.elevation ?? 0)}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Movement Class</div>
      <div class="builder-field-value">${escapeHtml(tile.movementClass ?? "clear")}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Structure Cell</div>
      <div class="builder-field-value">${structureCells.length ? escapeHtml(formatStructureCells(structureCells)) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Authored Edges</div>
      <div class="builder-field-value">${authoredEdges.length ? escapeHtml(formatEdges(authoredEdges)) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Spawn</div>
      <div class="builder-field-value">${spawn ? escapeHtml(spawn) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Deployment</div>
      <div class="builder-field-value">${deploymentCell ? escapeHtml(formatDeploymentCell(deploymentCell)) : "None"}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Runtime Unit</div>
      <div class="builder-field-value">${unit ? escapeHtml(unit.name ?? unit.instanceId ?? unit.id) : "None"}</div>
    </div>
    <div class="builder-inspector-note">Read-only inspection. Edits stay locked until the adapter layer is in place.</div>
  `;
}

function getStructureCellsAt(map, x, y) {
  const key = makeCellKey(x, y);
  return getStructuresAtTile(map, x, y).flatMap((structure) => {
    const id = structure?.id ?? "structure";
    return getStructureCells(structure)
      .filter((cell) => makeCellKey(cell.x, cell.y) === key)
      .map((cell) => ({ ...cell, structureId: id }));
  });
}

function getAuthoredEdgesAt(map, x, y) {
  return getMapStructures(map).flatMap((structure) => {
    const id = structure?.id ?? "structure";
    return getStructureEdgeParts(structure)
      .filter((edge) => Number(edge.x) === Number(x) && Number(edge.y) === Number(y))
      .map((edge) => ({ ...edge, structureId: id }));
  });
}

function getSpawnAt(map, x, y) {
  const spawns = map?.spawns && typeof map.spawns === "object" ? map.spawns : {};
  for (const [team, points] of Object.entries(spawns)) {
    if (!Array.isArray(points)) continue;
    const index = points.findIndex((point) => Number(point?.x) === Number(x) && Number(point?.y) === Number(y));
    if (index >= 0) return `${team}_${index + 1}`;
  }

  const tile = getTile(map, x, y);
  return tile?.spawnId ?? null;
}

function getDeploymentCellAt(map, x, y) {
  const cells = Array.isArray(map?.startState?.deploymentCells) ? map.startState.deploymentCells : [];
  return cells.find((cell) => Number(cell?.x) === Number(x) && Number(cell?.y) === Number(y)) ?? null;
}

function getUnitAt(appState, x, y) {
  const units = Array.isArray(appState?.units) ? appState.units : [];
  return units.find((unit) => Number(unit?.x) === Number(x) && Number(unit?.y) === Number(y)) ?? null;
}

function formatStructureCells(cells) {
  return cells.map((cell) => {
    const room = cell.roomId ? ` / room ${cell.roomId}` : "";
    return `${cell.structureId}${room}`;
  }).join("; ");
}

function formatEdges(edges) {
  return edges.map((edge) => `${edge.edge}:${edge.edgeHeight ?? 0} ${edge.type ?? "wall"}`).join("; ");
}

function formatDeploymentCell(cell) {
  const unitType = cell.unitType ?? "pilot";
  const controlType = cell.controlType ?? "PC";
  return `${unitType} / ${controlType}`;
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
