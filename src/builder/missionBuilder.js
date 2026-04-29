// src/builder/missionBuilder.js
//
// New fullscreen WYSIWYG Mission Builder entry point.
// This replaces the old backtick-owned dev menu path for new work.

import {
  createBuilderState,
  isBuilderWorkspaceCurrentMap,
  prepareBuilderLaunch,
  pushBuilderLog,
  setBuilderOpen,
  setBuilderTab,
  setBuilderWorkspaceMode,
  syncBuilderRuntimeMap,
  toggleBuilderOverlay
} from "./builderState.js";
import {
  createEdgeSelection,
  createTileSelection,
  setBuilderHover,
  setBuilderSelection
} from "./builderSelection.js";
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
    this.refs.board.addEventListener("pointermove", this.handlePointerMove);
    this.refs.board.addEventListener("pointerleave", this.handlePointerLeave);

    this.initialized = true;
    this.render();
    return this;
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown, { capture: true });
    this.refs?.root?.removeEventListener("click", this.handleClick);
    this.refs?.board?.removeEventListener("pointermove", this.handlePointerMove);
    this.refs?.board?.removeEventListener("pointerleave", this.handlePointerLeave);
    this.refs?.root?.remove();
    this.refs = null;
    this.initialized = false;
  }

  handleKeyDown(event) {
    if (event.key !== "`") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.toggle();
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

  handlePointerMove(event) {
    if (!this.builderState.isOpen || !isBuilderWorkspaceCurrentMap(this.builderState)) return;

    const picked = pickWorkspaceTileFromEvent({
      event,
      appState: this.appState,
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
    if (!isBuilderWorkspaceCurrentMap(this.builderState)) {
      return;
    }

    const picked = event.shiftKey
      ? pickWorkspaceEdgeFromEvent({ event, appState: this.appState, board: this.refs.board })
      : pickWorkspaceTileFromEvent({ event, appState: this.appState, board: this.refs.board });

    if (!picked) {
      pushBuilderLog(this.builderState, "No map tile under pointer.");
      this.render();
      return;
    }

    if (event.shiftKey) {
      setBuilderSelection(this.builderState, createEdgeSelection(this.appState, picked.x, picked.y, picked.edge));
      pushBuilderLog(this.builderState, `Selected edge ${picked.edge.toUpperCase()} at ${picked.x}, ${picked.y}.`);
    } else {
      setBuilderSelection(this.builderState, createTileSelection(this.appState, picked.x, picked.y));
      pushBuilderLog(this.builderState, `Selected tile ${picked.x}, ${picked.y}.`);
    }

    this.render();
  }

  handleAction(action) {
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
      pushBuilderLog(this.builderState, "New Mission Package flow is staged next; no package mutation in this pass.");
      this.render();
      return;
    }

    if (action === "new-map") {
      pushBuilderLog(this.builderState, "New Map flow is staged next: id, size, base terrain, base height.");
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
      pushBuilderLog(this.builderState, "Validation placeholder active. Real validators come after adapter wiring.");
      this.render();
      return;
    }

    if (action === "test") {
      pushBuilderLog(this.builderState, "Test Mission is intentionally disabled until package/adapters are real.");
      this.render();
      return;
    }

    if (action === "export") {
      pushBuilderLog(this.builderState, "Export Package is intentionally disabled until package/adapters are real.");
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

    if (isBuilderWorkspaceCurrentMap(this.builderState)) {
      syncBuilderRuntimeMap(this.builderState, this.appState);
    }

    renderBuilderShell({
      builderState: this.builderState,
      refs: this.refs,
      appState: this.appState
    });

    if (this.builderState.isOpen && isBuilderWorkspaceCurrentMap(this.builderState)) {
      renderWysiwygWorkspace({
        appState: this.appState,
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

const missionBuilder = new MissionBuilder();

export default missionBuilder;

export function initializeMissionBuilder({ state, render, refs }) {
  return missionBuilder.init({ state, render, refs });
}

export function toggleMissionBuilder(force) {
  missionBuilder.toggle(force);
}
