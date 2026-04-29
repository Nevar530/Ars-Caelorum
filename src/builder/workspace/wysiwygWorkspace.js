// src/builder/workspace/wysiwygWorkspace.js
//
// Engine-backed WYSIWYG workspace preview.
// This is the first builder adapter: it renders the current runtime map using
// the same projection/render modules as the game scene instead of drawing a
// fake editor-only board.

import { renderIso } from "../../render.js";
import { ensureCameraState, updateCameraFraming } from "../../render/projection.js";
import { getMapHeight, getMapWidth } from "../../map.js";

export function renderWysiwygWorkspace({ appState, workspaceRefs }) {
  if (!appState || !workspaceRefs?.board || !workspaceRefs?.worldScene || !workspaceRefs?.worldUi) {
    return;
  }

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
  updateCameraFraming(previewState, workspaceRefs);
  renderIso(previewState, workspaceRefs);

  renderWorkspaceReadout({ appState, workspaceRefs });
}

function cloneForPreview(appState) {
  if (typeof structuredClone === "function") {
    return structuredClone(appState);
  }

  return JSON.parse(JSON.stringify(appState));
}

function renderWorkspaceReadout({ appState, workspaceRefs }) {
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

  readout.innerHTML = `
    <div class="builder-readout-kicker">ENGINE PREVIEW</div>
    <div class="builder-readout-title">${escapeHtml(mapName)}</div>
    <div class="builder-readout-grid">
      <span>Map ID</span><strong>${escapeHtml(mapId)}</strong>
      <span>Size</span><strong>${width} × ${height}</strong>
      <span>Structures</span><strong>${structures}</strong>
      <span>Deployment Cells</span><strong>${deploymentCells}</strong>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
