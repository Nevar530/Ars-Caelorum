// src/builder/ui/builderShell.js
//
// Fullscreen Mission Builder shell.
// This is a new system shell, not the old dev menu DOM moved into a larger box.

import { BUILDER_TABS, getBuilderTab } from "../builderState.js";
import { buildTileInspectorHtml } from "../workspace/wysiwygWorkspace.js";

export function createBuilderShell() {
  const root = document.createElement("section");
  root.id = "missionBuilderRoot";
  root.className = "mission-builder";
  root.setAttribute("aria-label", "Mission Builder");
  root.setAttribute("aria-hidden", "true");
  root.style.display = "none";

  root.innerHTML = `
    <div class="builder-frame">
      <header class="builder-topbar">
        <div class="builder-title-block">
          <div class="builder-kicker">ARS CAELORUM</div>
          <h1>Mission Builder</h1>
        </div>
        <div class="builder-status-strip">
          <span data-builder-status>READY</span>
          <span data-builder-dirty>CLEAN</span>
        </div>
        <div class="builder-top-actions">
          <button type="button" data-builder-action="validate">Validate</button>
          <button type="button" data-builder-action="test">Test Mission</button>
          <button type="button" data-builder-action="export">Export Package</button>
          <button type="button" data-builder-action="close" class="builder-close">Close</button>
        </div>
      </header>

      <div class="builder-body">
        <nav class="builder-tabs" aria-label="Mission Builder tabs" data-builder-tabs></nav>

        <main class="builder-workspace-shell">
          <div class="builder-workspace-header">
            <div>
              <div class="builder-section-kicker" data-builder-tab-kicker>PROJECT</div>
              <h2 data-builder-tab-title>Project</h2>
            </div>
            <div class="builder-workspace-note" data-builder-workspace-note>
              WYSIWYG engine-backed workspace. Deep authoring tools come after shell/workspace/adapters are stable.
            </div>
          </div>

          <div class="builder-workspace" data-builder-workspace>
            <svg data-builder-board viewBox="0 0 1400 900" aria-label="Mission Builder live engine preview">
              <g data-builder-world-scene></g>
              <g data-builder-world-ui></g>
            </svg>
            <aside class="builder-readout" data-builder-readout></aside>
          </div>
        </main>

        <aside class="builder-inspector" aria-label="Builder inspector">
          <div class="builder-panel-title">Inspector</div>
          <div data-builder-inspector></div>
        </aside>
      </div>

      <footer class="builder-bottombar">
        <div data-builder-hints>` + "`" + ` closes · Esc reserved for tool cancel · Builder owns this fullscreen workspace</div>
        <div data-builder-validation>0 errors · 0 warnings</div>
        <div data-builder-log></div>
      </footer>
    </div>
  `;

  document.body.appendChild(root);

  return {
    root,
    tabs: root.querySelector("[data-builder-tabs]"),
    status: root.querySelector("[data-builder-status]"),
    dirty: root.querySelector("[data-builder-dirty]"),
    tabKicker: root.querySelector("[data-builder-tab-kicker]"),
    tabTitle: root.querySelector("[data-builder-tab-title]"),
    workspaceNote: root.querySelector("[data-builder-workspace-note]"),
    board: root.querySelector("[data-builder-board]"),
    worldScene: root.querySelector("[data-builder-world-scene]"),
    worldUi: root.querySelector("[data-builder-world-ui]"),
    readout: root.querySelector("[data-builder-readout]"),
    inspector: root.querySelector("[data-builder-inspector]"),
    validation: root.querySelector("[data-builder-validation]"),
    log: root.querySelector("[data-builder-log]")
  };
}

export function renderBuilderShell({ builderState, refs, appState }) {
  if (!builderState || !refs?.root) return;

  refs.root.style.display = builderState.isOpen ? "block" : "none";
  refs.root.setAttribute("aria-hidden", builderState.isOpen ? "false" : "true");
  refs.status.textContent = builderState.status ?? "READY";
  refs.dirty.textContent = builderState.dirty ? "UNSAVED" : "CLEAN";

  renderTabs({ builderState, refs });
  renderTabHeader({ builderState, refs });
  renderInspector({ builderState, refs, appState });
  renderValidation({ builderState, refs });
  renderLog({ builderState, refs });
}

function renderTabs({ builderState, refs }) {
  refs.tabs.innerHTML = BUILDER_TABS.map((tab) => {
    const active = tab.id === builderState.activeTab ? " is-active" : "";
    return `<button type="button" class="builder-tab${active}" data-builder-tab="${tab.id}">${tab.label}</button>`;
  }).join("");
}

function renderTabHeader({ builderState, refs }) {
  const tab = getBuilderTab(builderState.activeTab);
  refs.tabKicker.textContent = tab.id.toUpperCase();
  refs.tabTitle.textContent = tab.label;

  const notes = {
    project: "Mission package summary. This pass confirms the new builder shell and engine preview.",
    map: "Map metadata and future map-level tools live here.",
    terrain: "Terrain/elevation authoring will connect through builder adapters after the workspace core is stable.",
    structures: "Structure cells, edges, edgeHeight, roomId, and roof/cutaway tools come here next.",
    spawns: "Spawn and deployment authoring will use existing deployment/startState truth.",
    units: "Mission roster and later loadout restrictions will live here.",
    objectives: "Objective definitions come after mission package core.",
    triggers: "Tile/zone/runtime triggers connect to Logic Chains here.",
    logic: "Mission Logic Chains: trigger → conditions → effects → follow-up.",
    dialogue: "Dialogue authoring will adapt to current missionState dialogue hooks.",
    results: "Victory/defeat result authoring belongs here.",
    validate: "Validation is part of authoring, not end polish.",
    export: "Exports complete mission packages, not just map files."
  };

  refs.workspaceNote.textContent = notes[tab.id] ?? "Mission Builder workspace.";
}

function renderInspector({ builderState, refs, appState }) {
  const selected = builderState.selected ?? {};
  const map = appState?.map ?? null;
  const mission = appState?.mission?.definition ?? null;
  const selectedTruth = buildTileInspectorHtml(appState, selected);

  refs.inspector.innerHTML = `
    <div class="builder-inspector-card">
      <div class="builder-field-label">Selected</div>
      <div class="builder-field-value">${escapeHtml(selected.label ?? selected.type ?? "None")}</div>
    </div>
    ${selectedTruth}
    <div class="builder-inspector-card">
      <div class="builder-field-label">Current Runtime Map</div>
      <div class="builder-field-value">${escapeHtml(map?.name ?? map?.id ?? "unknown")}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Current Mission</div>
      <div class="builder-field-value">${escapeHtml(mission?.name ?? mission?.id ?? "No active mission definition")}</div>
    </div>
    <div class="builder-inspector-note">
      Inspector edits are intentionally disabled in this workspace-core pass. This is read-only truth inspection before map mutation/adapters are allowed.
    </div>
  `;
}

function renderValidation({ builderState, refs }) {
  const errors = builderState.validation?.errors?.length ?? 0;
  const warnings = builderState.validation?.warnings?.length ?? 0;
  refs.validation.textContent = `${errors} errors · ${warnings} warnings`;
}

function renderLog({ builderState, refs }) {
  const first = Array.isArray(builderState.log) ? builderState.log[0] : "";
  refs.log.textContent = first ?? "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
