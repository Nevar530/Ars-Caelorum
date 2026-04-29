// src/builder/missionBuilder.js
//
// New fullscreen WYSIWYG Mission Builder entry point.
// This replaces the old backtick-owned dev menu path for new work.

import {
  createBuilderState,
  pushBuilderLog,
  setBuilderOpen,
  setBuilderTab
} from "./builderState.js";
import { createBuilderShell, renderBuilderShell } from "./ui/builderShell.js";
import { renderWysiwygWorkspace } from "./workspace/wysiwygWorkspace.js";

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

    this.initialized = true;
    this.render();
    return this;
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown, { capture: true });
    this.refs?.root?.removeEventListener("click", this.handleClick);
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
    }
  }

  handleAction(action) {
    if (action === "close") {
      this.toggle(false);
      return;
    }

    if (action === "validate") {
      pushBuilderLog(this.builderState, "Validation model placeholder active. Real validators come after adapters.");
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
    pushBuilderLog(this.builderState, `Mission Builder ${nextOpen ? "opened" : "closed"}.`);
    this.render();
  }

  render() {
    if (!this.refs) return;

    renderBuilderShell({
      builderState: this.builderState,
      refs: this.refs,
      appState: this.appState
    });

    if (this.builderState.isOpen) {
      renderWysiwygWorkspace({
        appState: this.appState,
        workspaceRefs: {
          board: this.refs.board,
          worldScene: this.refs.worldScene,
          worldUi: this.refs.worldUi,
          readout: this.refs.readout
        }
      });
    }
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
