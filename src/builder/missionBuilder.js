// src/builder/missionBuilder.js
//
// New fullscreen WYSIWYG Mission Builder entry point.
// This replaces the old backtick-owned dev menu path for new work.

import {
  createBuilderState,
  getBuilderWorkspaceAppState,
  isBuilderWorkspaceMap,
  prepareBuilderLaunch,
  pushBuilderLog,
  setBuilderAuthoredMap,
  setBuilderOpen,
  setBuilderTab,
  setBuilderWorkspaceMode,
  syncBuilderRuntimeMap,
  toggleBuilderOverlay
} from "./builderState.js";
import { createBlankBuilderMap, readBlankMapForm } from "./builderMapFactory.js";
import { exportBuilderMissionPackage } from "./builderExport.js";
import {
  applyTerrainToolAtTile,
  isTerrainEyedropperActive,
  resetTerrainToolToDefaults,
  sampleTerrainToolAtTile,
  setTerrainEyedropper,
  updateTerrainToolFromFields
} from "./builderTerrain.js";
import {
  applyStructureEdgeToolAtEdge,
  applyStructureToolAtTile,
  isStructureEdgeEraseModeActive,
  isStructureEdgeEyedropperActive,
  isStructureEyedropperActive,
  resetStructureToolToDefaults,
  sampleStructureEdgeToolAtEdge,
  sampleStructureToolAtTile,
  setStructureEdgeEraseMode,
  setStructureEdgeEyedropper,
  setStructureEraseMode,
  setStructureEyedropper,
  toggleStructureRoofVisibility,
  updateStructureToolFromFields
} from "./builderStructures.js";
import {
  createEdgeSelection,
  createTileSelection,
  moveBuilderTileSelection,
  setBuilderHover,
  setBuilderSelection
} from "./builderSelection.js";
import {
  applyDeploymentSettings,
  applySpawnAuthoringAtTile,
  isSpawnAuthoringActive,
  resetSpawnToolToDefaults,
  setDeploymentEraseMode,
  setSpawnEraseMode,
  setSpawnToolMode,
  updateSpawnToolFromFields
} from "./builderSpawns.js";
import { createBuilderShell, renderBuilderShell } from "./ui/builderShell.js";
import {
  clearWysiwygWorkspace,
  pickWorkspaceEdgeFromEvent,
  pickWorkspaceTileFromEvent,
  renderWysiwygWorkspace
} from "./workspace/wysiwygWorkspace.js";

class MissionBuilder {
  constructor() {
    this.builderState = createBuilderState();
    this.appState = null;
    this.renderApp = null;
    this.appRefs = null;
    this.refs = null;
    this.initialized = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
  }

  init({ state, render, refs }) {
    if (this.initialized) return this;
    if (!state) throw new Error("MissionBuilder.init requires app state.");
    if (typeof render !== "function") throw new Error("MissionBuilder.init requires app render function.");

    this.appState = state;
    this.renderApp = render;
    this.appRefs = refs ?? {};
    this.refs = createBuilderShell();

    window.addEventListener("keydown", this.handleKeyDown, { capture: true });
    this.refs.root.addEventListener("click", this.handleClick);
    this.refs.root.addEventListener("change", this.handleChange);
    this.refs.board.addEventListener("pointermove", this.handlePointerMove);
    this.refs.board.addEventListener("pointerleave", this.handlePointerLeave);

    this.initialized = true;
    this.render();
    return this;
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown, { capture: true });
    this.refs?.root?.removeEventListener("click", this.handleClick);
    this.refs?.root?.removeEventListener("change", this.handleChange);
    this.refs?.board?.removeEventListener("pointermove", this.handlePointerMove);
    this.refs?.board?.removeEventListener("pointerleave", this.handlePointerLeave);
    this.refs?.root?.remove();
    this.refs = null;
    this.initialized = false;
  }

  handleKeyDown(event) {
    if (event.key === "`") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      this.toggle();
      return;
    }

    if (!this.builderState.isOpen) return;

    if (isTextEntryEvent(event, this.refs?.root)) {
      // Builder owns the overlay while open, but text fields must still type normally.
      // Stop the game/runtime keyboard handlers from stealing WASD/arrow keys, but
      // do not preventDefault so the browser can enter characters/change fields.
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    if (this.handleWorkspaceConfirmKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    if (this.handleWorkspaceNavigationKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }

  handleWorkspaceNavigationKey(event) {
    if (!isBuilderWorkspaceMap(this.builderState)) return false;

    const key = event.key.toLowerCase();
    let direction = null;

    if (key === "arrowup" || key === "w") direction = "up";
    else if (key === "arrowdown" || key === "s") direction = "down";
    else if (key === "arrowleft" || key === "a") direction = "left";
    else if (key === "arrowright" || key === "d") direction = "right";
    else return false;

    const workspaceAppState = getBuilderWorkspaceAppState(this.builderState, this.appState);
    const moved = moveBuilderTileSelection(this.builderState, workspaceAppState, direction);

    if (moved) {
      pushBuilderLog(this.builderState, `Cursor moved to tile ${moved.x}, ${moved.y}.`);
      this.render();
    }

    return true;
  }

  handleWorkspaceConfirmKey(event) {
    if (event.code !== "Space" && event.key !== " ") return false;
    if (!this.isTerrainAuthoringActive() && !this.isStructureAuthoringActive() && !this.isSpawnAuthoringActive()) return false;

    const selected = this.builderState.selected ?? null;
    const hover = this.builderState.hover ?? null;
    const target = getTileLikeSelection(selected) ?? getTileLikeSelection(hover);

    if (!target) {
      pushBuilderLog(this.builderState, "No selected tile to paint. Move the builder cursor or click a tile first.");
      this.render();
      return true;
    }

    const result = this.isStructureAuthoringActive() && selected?.type === "edge"
      ? this.applyStructureEdgeActionAtEdge(selected.x, selected.y, selected.edge)
      : this.isStructureAuthoringActive()
        ? this.applyStructureActionAtTile(target.x, target.y)
        : this.isSpawnAuthoringActive()
          ? this.applySpawnActionAtTile(target.x, target.y)
          : this.applyTerrainActionAtTile(target.x, target.y);

    pushBuilderLog(this.builderState, result.message);
    this.render();
    return true;
  }

  handleClick(event) {
    const actionButton = event.target.closest("[data-builder-action]");
    if (actionButton) {
      this.handleAction(actionButton.dataset.builderAction);
      return;
    }

    const tabButton = event.target.closest("[data-builder-tab]");
    if (tabButton) {
      setBuilderTab(this.builderState, tabButton.dataset.builderTab);
      pushBuilderLog(this.builderState, `Opened ${tabButton.textContent.trim()} tab.`);
      this.render();
      return;
    }

    const board = event.target.closest("[data-builder-board]");
    if (board) {
      this.handleWorkspaceClick(event);
    }
  }

  handleChange(event) {
    if (!this.builderState.isOpen) return;
    if (!event.target?.closest?.("[data-builder-field]")) return;

    if (this.builderState.activeTab === "terrain") {
      const previousTerrainTypeId = this.builderState.terrainTool?.terrainTypeId;
      updateTerrainToolFromFields(this.builderState, this.refs.root, this.appState);

      const changedField = event.target.getAttribute("data-builder-field");
      if (changedField === "terrain-type" && this.builderState.terrainTool?.terrainTypeId !== previousTerrainTypeId) {
        pushBuilderLog(this.builderState, "Terrain brush set to " + this.builderState.terrainTool.terrainTypeId + "; movement default loaded.");
      }

      this.render();
      return;
    }

    if (this.builderState.activeTab === "structures") {
      updateStructureToolFromFields(this.builderState, this.refs.root, this.appState, { changedField: event.target.getAttribute("data-builder-field") });
      this.render();
      return;
    }

    if (this.builderState.activeTab === "spawns") {
      updateSpawnToolFromFields(this.builderState, this.refs.root);
      this.render();
    }
  }

  handlePointerMove(event) {
    if (!this.builderState.isOpen || !isBuilderWorkspaceMap(this.builderState)) return;

    const workspaceAppState = getBuilderWorkspaceAppState(this.builderState, this.appState);
    const picked = pickWorkspaceTileFromEvent({
      event,
      appState: workspaceAppState,
      board: this.refs.board
    });

    if (!picked) {
      if (this.builderState.hover) {
        setBuilderHover(this.builderState, null);
        this.render();
      }
      return;
    }

    const current = this.builderState.hover;
    if (current?.type === "tile" && current.x === picked.x && current.y === picked.y) return;

    setBuilderHover(this.builderState, {
      type: "tile",
      id: `${picked.x},${picked.y}`,
      label: `Tile ${picked.x}, ${picked.y}`,
      x: picked.x,
      y: picked.y
    });
    this.render();
  }

  handlePointerLeave() {
    if (!this.builderState.hover) return;
    setBuilderHover(this.builderState, null);
    this.render();
  }

  handleWorkspaceClick(event) {
    if (!isBuilderWorkspaceMap(this.builderState)) {
      return;
    }

    const workspaceAppState = getBuilderWorkspaceAppState(this.builderState, this.appState);
    const picked = event.shiftKey
      ? pickWorkspaceEdgeFromEvent({ event, appState: workspaceAppState, board: this.refs.board })
      : pickWorkspaceTileFromEvent({ event, appState: workspaceAppState, board: this.refs.board });

    if (!picked) {
      pushBuilderLog(this.builderState, "No map tile under pointer.");
      this.render();
      return;
    }

    if (event.shiftKey) {
      setBuilderSelection(this.builderState, createEdgeSelection(workspaceAppState, picked.x, picked.y, picked.edge));
      if (this.isStructureAuthoringActive()) {
        const result = this.applyStructureEdgeActionAtEdge(picked.x, picked.y, picked.edge);
        pushBuilderLog(this.builderState, result.message);
      } else {
        pushBuilderLog(this.builderState, `Selected edge ${picked.edge.toUpperCase()} at ${picked.x}, ${picked.y}.`);
      }
      this.render();
      return;
    }

    setBuilderSelection(this.builderState, createTileSelection(workspaceAppState, picked.x, picked.y));

    if (this.isTerrainAuthoringActive()) {
      const result = this.applyTerrainActionAtTile(picked.x, picked.y);
      pushBuilderLog(this.builderState, result.message);
    } else if (this.isStructureAuthoringActive()) {
      const result = this.applyStructureActionAtTile(picked.x, picked.y);
      pushBuilderLog(this.builderState, result.message);
    } else if (this.isSpawnAuthoringActive()) {
      const result = this.applySpawnActionAtTile(picked.x, picked.y);
      pushBuilderLog(this.builderState, result.message);
    } else {
      pushBuilderLog(this.builderState, "Selected tile " + picked.x + ", " + picked.y + ".");
    }

    this.render();
  }

  isTerrainAuthoringActive() {
    return this.builderState.workspaceMode === "builder-map" && this.builderState.activeTab === "terrain";
  }

  isStructureAuthoringActive() {
    return this.builderState.workspaceMode === "builder-map" && this.builderState.activeTab === "structures";
  }

  isSpawnAuthoringActive() {
    return isSpawnAuthoringActive(this.builderState);
  }

  applyTerrainActionAtTile(x, y) {
    updateTerrainToolFromFields(this.builderState, this.refs.root, this.appState);
    return isTerrainEyedropperActive(this.builderState)
      ? sampleTerrainToolAtTile(this.builderState, this.appState, x, y)
      : applyTerrainToolAtTile(this.builderState, this.appState, x, y);
  }

  applyStructureActionAtTile(x, y) {
    updateStructureToolFromFields(this.builderState, this.refs.root, this.appState);
    return isStructureEyedropperActive(this.builderState)
      ? sampleStructureToolAtTile(this.builderState, this.appState, x, y)
      : applyStructureToolAtTile(this.builderState, this.appState, x, y);
  }

  applyStructureEdgeActionAtEdge(x, y, edge) {
    updateStructureToolFromFields(this.builderState, this.refs.root, this.appState);
    if (isStructureEdgeEyedropperActive(this.builderState)) {
      return sampleStructureEdgeToolAtEdge(this.builderState, this.appState, x, y, edge);
    }
    return applyStructureEdgeToolAtEdge(this.builderState, this.appState, x, y, edge);
  }

  applySpawnActionAtTile(x, y) {
    updateSpawnToolFromFields(this.builderState, this.refs.root);
    return applySpawnAuthoringAtTile(this.builderState, this.appState, x, y);
  }

  handleAction(action) {
    if (action === "spawn-tab-fixed") {
      updateSpawnToolFromFields(this.builderState, this.refs.root);
      setSpawnToolMode(this.builderState, "spawn");
      pushBuilderLog(this.builderState, "Spawns menu set to Fixed Spawns.");
      this.render();
      return;
    }

    if (action === "spawn-tab-deployment") {
      updateSpawnToolFromFields(this.builderState, this.refs.root);
      setSpawnToolMode(this.builderState, "deployment");
      pushBuilderLog(this.builderState, "Spawns menu set to Deployment Zones.");
      this.render();
      return;
    }

    if (action === "spawn-erase") {
      updateSpawnToolFromFields(this.builderState, this.refs.root);
      const tool = setSpawnEraseMode(this.builderState, !this.builderState.spawnTool?.spawnErase);
      pushBuilderLog(this.builderState, tool?.spawnErase ? "Spawn erase armed. Click a tile to remove its spawn." : "Spawn erase cancelled.");
      this.render();
      return;
    }

    if (action === "deployment-erase") {
      updateSpawnToolFromFields(this.builderState, this.refs.root);
      const tool = setDeploymentEraseMode(this.builderState, !this.builderState.spawnTool?.deploymentErase);
      pushBuilderLog(this.builderState, tool?.deploymentErase ? "Deployment erase armed. Click a tile to remove its deployment cell." : "Deployment erase cancelled.");
      this.render();
      return;
    }

    if (action === "reset-spawn-brush") {
      resetSpawnToolToDefaults(this.builderState);
      pushBuilderLog(this.builderState, "Spawn/deployment brush reset to default settings.");
      this.render();
      return;
    }

    if (action === "apply-deployment-settings") {
      updateSpawnToolFromFields(this.builderState, this.refs.root);
      const result = applyDeploymentSettings(this.builderState);
      pushBuilderLog(this.builderState, result.message);
      this.render();
      return;
    }

    if (action === "structure-eyedropper") {
      updateStructureToolFromFields(this.builderState, this.refs.root, this.appState);
      const tool = setStructureEyedropper(this.builderState, !isStructureEyedropperActive(this.builderState));
      pushBuilderLog(this.builderState, tool?.eyedropper ? "Structure eyedropper armed. Click a cell to sample structure brush settings." : "Structure eyedropper cancelled.");
      this.render();
      return;
    }

    if (action === "structure-erase") {
      updateStructureToolFromFields(this.builderState, this.refs.root, this.appState);
      const nextErase = !this.builderState.structureTool?.erase;
      const tool = setStructureEraseMode(this.builderState, nextErase);
      pushBuilderLog(this.builderState, tool?.erase ? "Structure erase brush armed. Click cells to remove structure cells." : "Structure erase cancelled.");
      this.render();
      return;
    }

    if (action === "structure-edge-eyedropper") {
      updateStructureToolFromFields(this.builderState, this.refs.root, this.appState);
      const tool = setStructureEdgeEyedropper(this.builderState, !isStructureEdgeEyedropperActive(this.builderState));
      pushBuilderLog(this.builderState, tool?.edgeEyedropper ? "Structure edge eyedropper armed. Shift-click an edge to sample edge brush settings." : "Structure edge eyedropper cancelled.");
      this.render();
      return;
    }

    if (action === "structure-edge-erase") {
      updateStructureToolFromFields(this.builderState, this.refs.root, this.appState);
      const nextErase = !this.builderState.structureTool?.edgeErase;
      const tool = setStructureEdgeEraseMode(this.builderState, nextErase);
      pushBuilderLog(this.builderState, tool?.edgeErase ? "Structure edge erase armed. Shift-click edges to remove them." : "Structure edge erase cancelled.");
      this.render();
      return;
    }

    if (action === "reset-structure-brush") {
      resetStructureToolToDefaults(this.builderState, this.appState);
      pushBuilderLog(this.builderState, "Structure brush reset to default settings.");
      this.render();
      return;
    }

    if (action === "toggle-structure-roofs") {
      const tool = toggleStructureRoofVisibility(this.builderState);
      pushBuilderLog(this.builderState, tool?.showRoofs === false ? "Structure roofs hidden in builder preview." : "Structure roofs shown in builder preview.");
      this.render();
      return;
    }

    if (action === "terrain-eyedropper") {
      updateTerrainToolFromFields(this.builderState, this.refs.root, this.appState);
      const tool = setTerrainEyedropper(this.builderState, !isTerrainEyedropperActive(this.builderState));
      pushBuilderLog(this.builderState, tool?.eyedropper ? "Eyedropper armed. Click a tile to sample terrain brush settings." : "Eyedropper cancelled.");
      this.render();
      return;
    }

    if (action === "reset-terrain-brush") {
      resetTerrainToolToDefaults(this.builderState, this.appState);
      pushBuilderLog(this.builderState, "Terrain brush reset to default settings.");
      this.render();
      return;
    }

    if (action && typeof action === "string" && action.startsWith("toggle-overlay:")) {
      const overlayId = action.split(":")[1];
      const enabled = toggleBuilderOverlay(this.builderState, overlayId);
      pushBuilderLog(this.builderState, overlayId + " overlay " + (enabled ? "shown" : "hidden") + ".");
      this.render();
      return;
    }

    if (action === "use-current-map") {
      setBuilderWorkspaceMode(this.builderState, "current-map", this.appState);
      this.render();
      return;
    }

    if (action === "new-mission") {
      pushBuilderLog(this.builderState, "New Mission Package flow comes after blank-map creation/export foundation.");
      this.render();
      return;
    }

    if (action === "new-map") {
      setBuilderWorkspaceMode(this.builderState, "new-map-form", this.appState);
      this.render();
      return;
    }

    if (action === "cancel-new-map") {
      setBuilderWorkspaceMode(this.builderState, "landing", this.appState);
      pushBuilderLog(this.builderState, "Returned to New / Load menu.");
      this.render();
      return;
    }

    if (action === "create-blank-map") {
      const form = readBlankMapForm(this.refs.root);
      const terrainTypes = Array.isArray(this.appState?.content?.terrainList)
        ? this.appState.content.terrainList.map((entry) => entry?.id ?? entry).filter(Boolean)
        : Array.isArray(this.appState?.map?.terrainTypes) ? this.appState.map.terrainTypes : undefined;
      const map = createBlankBuilderMap({
        ...form,
        terrainTypes,
        terrainDefinitions: this.appState?.content?.terrainDefinitions ?? {}
      });
      setBuilderAuthoredMap(this.builderState, map, "new-blank-map");
      this.render();
      return;
    }

    if (action === "load-existing") {
      pushBuilderLog(this.builderState, "Load Existing flow is staged next; catalog/file picker is not active yet.");
      this.render();
      return;
    }

    if (action === "close") {
      this.toggle(false);
      return;
    }

    if (action === "validate") {
      pushBuilderLog(this.builderState, "Validation placeholder active. Real validators come after authoring/export wiring.");
      this.render();
      return;
    }

    if (action === "test") {
      pushBuilderLog(this.builderState, "Test Mission is intentionally disabled until package/export adapters are real.");
      this.render();
      return;
    }

    if (action === "export") {
      const result = exportBuilderMissionPackage({
        builderState: this.builderState,
        appState: this.appState
      });
      pushBuilderLog(this.builderState, result.message);
      this.render();
    }
  }

  toggle(force = null) {
    const nextOpen = typeof force === "boolean" ? force : !this.builderState.isOpen;
    setBuilderOpen(this.builderState, nextOpen);

    if (nextOpen) {
      prepareBuilderLaunch(this.builderState, this.appState);
    } else {
      pushBuilderLog(this.builderState, "Mission Builder closed.");
    }

    this.render();
  }

  render() {
    if (!this.refs) return;

    if (this.builderState.workspaceMode === "current-map") {
      syncBuilderRuntimeMap(this.builderState, this.appState);
    }

    renderBuilderShell({
      builderState: this.builderState,
      refs: this.refs,
      appState: this.appState
    });

    if (this.builderState.isOpen && isBuilderWorkspaceMap(this.builderState)) {
      const workspaceAppState = getBuilderWorkspaceAppState(this.builderState, this.appState);
      renderWysiwygWorkspace({
        appState: workspaceAppState,
        builderState: this.builderState,
        workspaceRefs: {
          board: this.refs.board,
          worldScene: this.refs.worldScene,
          worldUi: this.refs.worldUi,
          readout: this.refs.readout
        }
      });
      return;
    }

    clearWysiwygWorkspace(this.refs);
  }
}

function getTileLikeSelection(selection) {
  if (!selection || (selection.type !== "tile" && selection.type !== "edge")) return null;
  const x = Number(selection.x);
  const y = Number(selection.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function isTextEntryEvent(event, root) {
  if (!event) return false;

  if (isTextEntryElement(event.target)) return true;

  const active = root?.contains?.(document.activeElement) ? document.activeElement : null;
  if (isTextEntryElement(active)) return true;

  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  return path.some((element) => isTextEntryElement(element));
}

function isTextEntryElement(element) {
  if (!element || element === window || element === document) return false;

  const tagName = String(element.tagName ?? "").toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (element.isContentEditable) return true;

  const role = String(element.getAttribute?.("role") ?? "").toLowerCase();
  return role === "textbox" || role === "combobox" || role === "spinbutton";
}

const missionBuilder = new MissionBuilder();

export default missionBuilder;

export function initializeMissionBuilder({ state, render, refs }) {
  return missionBuilder.init({ state, render, refs });
}

export function toggleMissionBuilder(force) {
  missionBuilder.toggle(force);
}
