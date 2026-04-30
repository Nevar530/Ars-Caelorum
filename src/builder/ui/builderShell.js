// src/builder/ui/builderShell.js
//
// Fullscreen Mission Builder shell.
// This is a new system shell, not the old dev menu DOM moved into a larger box.

import {
  BUILDER_TABS,
  canUseCurrentRuntimeMap,
  getBuilderSelectionSummary,
  getBuilderTab,
  getBuilderWorkspaceAppState,
  isBuilderNewMapForm,
  isBuilderWorkspaceMap
} from "../builderState.js";
import { BUILDER_DEFAULT_TERRAIN_TYPES } from "../builderMapFactory.js";
import {
  ensureTerrainToolSettings,
  getBuilderBrushSizeOptions,
  getBuilderMovementClassOptions,
  getBuilderTerrainOptions
} from "../builderTerrain.js";
import {
  areStructureRoofsVisible,
  ensureStructureToolSettings,
  getBuilderRoofSpriteOptions,
  getBuilderStructureEdgeSpriteOptions,
  getStructureEdgeTypeDefaults,
  getStructureEdgeTypeOptions,
  getStructureSpritePreviewPath,
  isStructureEdgeEraseModeActive,
  isStructureEdgeEyedropperActive,
  isStructureEraseModeActive,
  isStructureEyedropperActive
} from "../builderStructures.js";
import { getMapSummary } from "../builderAdapters.js";
import { ensureSpawnToolSettings } from "../builderSpawns.js";
import {
  ensureUnitToolSettings,
  getMechOptions,
  getPilotOptions,
  getSpawnIdOptions,
  getUnitStartAssignments
} from "../builderUnits.js";
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
            <div class="builder-workspace-side">
              <div class="builder-workspace-note" data-builder-workspace-note>
                WYSIWYG engine-backed workspace. Deep authoring tools come after shell/workspace/adapters are stable.
              </div>
              <div class="builder-overlay-toggles" data-builder-overlay-toggles></div>
            </div>
          </div>

          <div class="builder-workspace" data-builder-workspace>
            <div class="builder-landing" data-builder-landing></div>
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
        <div data-builder-hints>` + "`" + ` closes · WASD/Arrows move builder cursor · Shift-click edge</div>
        <div data-builder-selection-summary>Builder Menu · New / Load · Hover none</div>
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
    overlayToggles: root.querySelector("[data-builder-overlay-toggles]"),
    landing: root.querySelector("[data-builder-landing]"),
    board: root.querySelector("[data-builder-board]"),
    worldScene: root.querySelector("[data-builder-world-scene]"),
    worldUi: root.querySelector("[data-builder-world-ui]"),
    readout: root.querySelector("[data-builder-readout]"),
    inspector: root.querySelector("[data-builder-inspector]"),
    selectionSummary: root.querySelector("[data-builder-selection-summary]"),
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
  renderOverlayToggles({ builderState, refs });
  renderWorkspaceMode({ builderState, refs, appState });
  renderInspector({ builderState, refs, appState });
  renderSelectionSummary({ builderState, refs });
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
  refs.tabTitle.textContent = isBuilderWorkspaceMap(builderState) ? tab.label : isBuilderNewMapForm(builderState) ? "New Blank Map" : "New / Load";

  const notes = {
    project: "Start a new package, load existing mission data, or open current runtime map only when a mission is active.",
    map: "Map metadata and map-level setup live here. New blank maps are builder-owned and do not mutate the runtime map.",
    terrain: "Terrain owns tile truth: terrain type, tile flags/default movement, texture set, and height/elevation.",
    structures: "Structure cells/rooms are active for builder-owned maps. Roof visibility is an editor view toggle; edge/wall tools are active.",
    spawns: "Spawn and deployment authoring writes existing map.spawns and map.startState truth.",
    units: "Unit start assignments write map.startState.deployments using the current runtime contract.",
    objectives: "Objective definitions come after mission package core.",
    triggers: "Tile/zone/runtime triggers connect to Logic Chains here.",
    logic: "Mission Logic Chains: trigger → conditions → effects → follow-up.",
    dialogue: "Dialogue authoring will adapt to current missionState dialogue hooks.",
    results: "Victory/defeat result authoring belongs here.",
    validate: "Validation is part of authoring, not end polish.",
    export: "Exports a contained mission package zip with repo paths."
  };

  refs.workspaceNote.textContent = notes[tab.id] ?? "Mission Builder workspace.";
}

function renderOverlayToggles({ builderState, refs }) {
  if (!refs.overlayToggles) return;

  if (!isBuilderWorkspaceMap(builderState)) {
    refs.overlayToggles.innerHTML = "";
    return;
  }

  const overlays = [
    ["structureEdges", "Edges"],
    ["rooms", "Rooms"],
    ["spawns", "Spawns"],
    ["deployment", "Deploy"],
    ["tileHeights", "Heights"]
  ];

  refs.overlayToggles.innerHTML = overlays.map(([id, label]) => {
    const active = builderState.overlays?.[id] ? " is-active" : "";
    return '<button type="button" class="builder-overlay-toggle' + active + '" data-builder-action="toggle-overlay:' + id + '">' + label + '</button>';
  }).join("");
}

function renderWorkspaceMode({ builderState, refs, appState }) {
  const mapMode = isBuilderWorkspaceMap(builderState);

  refs.board.style.display = mapMode ? "block" : "none";
  refs.readout.style.display = mapMode ? "block" : "none";
  refs.landing.style.display = mapMode ? "none" : "grid";

  if (mapMode) {
    refs.landing.innerHTML = "";
    return;
  }

  refs.landing.innerHTML = isBuilderNewMapForm(builderState)
    ? renderNewMapForm(appState)
    : renderLanding(appState);
}

function renderLanding(appState) {
  const canUseCurrent = canUseCurrentRuntimeMap(appState);
  const shellScreen = appState?.ui?.shell?.screen ?? "unknown";
  const mapSummary = getMapSummary(appState);

  return `
    <section class="builder-landing-hero">
      <div class="builder-section-kicker">MISSION BUILDER</div>
      <h3>New / Load</h3>
      <p>Choose what the builder should author. Opening from the title or menu does not pull in the current runtime map. Opening from an active mission opens the current map for read-only inspection.</p>
    </section>

    <section class="builder-start-grid">
      <button type="button" class="builder-start-card" data-builder-action="new-mission">
        <span>New Mission Package</span>
        <small>Create mission metadata, map reference, objectives, results, and export package.</small>
      </button>
      <button type="button" class="builder-start-card" data-builder-action="new-map">
        <span>New Blank Map</span>
        <small>Pick size, base terrain fill, and base elevation.</small>
      </button>
      <button type="button" class="builder-start-card" data-builder-action="load-existing">
        <span>Load Existing</span>
        <small>Next flow: load a mission/map package from catalog or imported JSON.</small>
      </button>
      <button type="button" class="builder-start-card${canUseCurrent ? "" : " is-disabled"}" data-builder-action="use-current-map"${canUseCurrent ? "" : " disabled"}>
        <span>Use Current Loaded Map</span>
        <small>${canUseCurrent ? "Inspect the active mission map." : "Only available while a mission map is active."}</small>
      </button>
    </section>

    <section class="builder-landing-context">
      <div class="builder-inspector-card">
        <div class="builder-field-label">Current App Screen</div>
        <div class="builder-field-value">${escapeHtml(shellScreen)}</div>
      </div>
      <div class="builder-inspector-card">
        <div class="builder-field-label">Runtime Map Available</div>
        <div class="builder-field-value">${escapeHtml(mapSummary.name)} · ${mapSummary.width}×${mapSummary.height}</div>
      </div>
      <div class="builder-inspector-note">New Blank Map now creates a builder-owned map. It does not mutate the runtime map.</div>
    </section>
  `;
}

function renderNewMapForm(appState) {
  const terrainOptions = buildTerrainOptions(appState);

  return `
    <section class="builder-landing-hero">
      <div class="builder-section-kicker">MAP AUTHORING</div>
      <h3>Create New Blank Map</h3>
      <p>This creates a builder-owned map workspace. It does not touch the currently loaded runtime mission/map.</p>
    </section>

    <section class="builder-form-grid">
      <label class="builder-form-field">
        <span>Map ID</span>
        <input type="text" data-builder-field="map-id" value="006_new_map" spellcheck="false">
      </label>
      <label class="builder-form-field">
        <span>Map Name</span>
        <input type="text" data-builder-field="map-name" value="New Map" spellcheck="false">
      </label>
      <label class="builder-form-field">
        <span>Width</span>
        <input type="number" data-builder-field="map-width" value="16" min="4" max="96" step="1">
      </label>
      <label class="builder-form-field">
        <span>Height</span>
        <input type="number" data-builder-field="map-height" value="16" min="4" max="96" step="1">
      </label>
      <label class="builder-form-field">
        <span>Base Terrain</span>
        <select data-builder-field="base-terrain">${terrainOptions}</select>
      </label>
      <label class="builder-form-field">
        <span>Base Elevation</span>
        <input type="number" data-builder-field="base-elevation" value="0" min="-8" max="16" step="1">
      </label>
    </section>

    <section class="builder-form-actions">
      <button type="button" class="builder-start-card" data-builder-action="create-blank-map">
        <span>Create Blank Map</span>
        <small>Open this map in the WYSIWYG builder workspace.</small>
      </button>
      <button type="button" class="builder-start-card" data-builder-action="cancel-new-map">
        <span>Cancel</span>
        <small>Return to New / Load without creating anything.</small>
      </button>
    </section>

    <section class="builder-landing-context">
      <div class="builder-inspector-note">Pencil rule: this creates only the simple base map. Terrain brushes, structures, and spawns are separate later passes. Export is active for builder-owned maps.</div>
    </section>
  `;
}

function buildTerrainOptions(appState, builderState = null, selectedId = "grass") {
  const terrainTypes = getBuilderTerrainOptions(appState, builderState);
  const fallback = terrainTypes.length
    ? terrainTypes
    : BUILDER_DEFAULT_TERRAIN_TYPES.map((id) => ({ id, label: id }));

  return fallback.map((terrain) => {
    const value = escapeHtml(terrain.id ?? terrain);
    const label = escapeHtml(terrain.label ?? terrain.id ?? terrain);
    const selected = (terrain.id ?? terrain) === selectedId ? " selected" : "";
    return `<option value="${value}"${selected}>${label}</option>`;
  }).join("");
}

function buildMovementOptions(selectedClass = "clear") {
  return getBuilderMovementClassOptions().map((movementClass) => {
    const value = escapeHtml(movementClass);
    const selected = movementClass === selectedClass ? " selected" : "";
    return `<option value="${value}"${selected}>${value}</option>`;
  }).join("");
}

function renderInspector({ builderState, refs, appState }) {
  if (!isBuilderWorkspaceMap(builderState)) {
    const shellScreen = appState?.ui?.shell?.screen ?? "unknown";
    const modeLabel = isBuilderNewMapForm(builderState) ? "New Blank Map Setup" : "Menu / Package Start";
    refs.inspector.innerHTML = `
      <div class="builder-inspector-card">
        <div class="builder-field-label">Selected</div>
        <div class="builder-field-value">${escapeHtml(builderState.selected?.label ?? "New / Load")}</div>
      </div>
      <div class="builder-inspector-card">
        <div class="builder-field-label">Builder Mode</div>
        <div class="builder-field-value">${escapeHtml(modeLabel)}</div>
      </div>
      <div class="builder-inspector-card">
        <div class="builder-field-label">Current App Screen</div>
        <div class="builder-field-value">${escapeHtml(shellScreen)}</div>
      </div>
      <div class="builder-inspector-note">
        New Blank Map creates builder-owned map data. It does not edit the current runtime map. Export is active for builder-owned maps.
      </div>
    `;
    return;
  }

  const workspaceAppState = getBuilderWorkspaceAppState(builderState, appState);
  const selected = builderState.selected ?? {};
  const map = workspaceAppState?.map ?? null;
  const mission = workspaceAppState?.mission?.definition ?? null;
  const selectedTruth = buildTileInspectorHtml(workspaceAppState, selected);
  const sourceLabel = builderState.workspaceMode === "builder-map" ? "Builder-Owned Map" : "Current Runtime Map";
  const terrainTools = builderState.activeTab === "terrain"
    ? renderTerrainInspectorTools(builderState, appState)
    : "";
  const structureTools = builderState.activeTab === "structures"
    ? renderStructureInspectorTools(builderState, appState)
    : "";
  const spawnTools = builderState.activeTab === "spawns"
    ? renderSpawnInspectorTools(builderState, appState)
    : "";
  const unitTools = builderState.activeTab === "units"
    ? renderUnitInspectorTools(builderState, appState)
    : "";
  const note = builderState.workspaceMode === "builder-map"
    ? "Builder-owned map. Terrain paints tile truth. Structures paint cells/edges. Spawns paints map.spawns and deployment cells. Units writes startState.deployments."
    : "Current loaded runtime map is read-only in the builder. Use New/Load for authored package work.";

  refs.inspector.innerHTML = `
    <div class="builder-inspector-card">
      <div class="builder-field-label">Selected</div>
      <div class="builder-field-value">${escapeHtml(selected.label ?? selected.type ?? "None")}</div>
    </div>
    ${terrainTools}
    ${structureTools}
    ${spawnTools}
    ${unitTools}
    ${selectedTruth}
    <div class="builder-inspector-card">
      <div class="builder-field-label">Map Source</div>
      <div class="builder-field-value">${escapeHtml(sourceLabel)}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Map</div>
      <div class="builder-field-value">${escapeHtml(map?.name ?? map?.id ?? "unknown")}</div>
    </div>
    <div class="builder-inspector-card">
      <div class="builder-field-label">Mission</div>
      <div class="builder-field-value">${escapeHtml(mission?.name ?? mission?.id ?? "No active mission definition")}</div>
    </div>
    <div class="builder-inspector-note">${escapeHtml(note)}</div>
  `;
}

function renderTerrainInspectorTools(builderState, appState) {
  const tool = ensureTerrainToolSettings(builderState, appState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const terrainOptions = buildTerrainOptions(appState, builderState, tool.terrainTypeId ?? "grass");
  const movementOptions = buildMovementOptions(tool.movementClass ?? "clear");
  const brushSizeOptions = buildBrushSizeOptions(tool.brushSize ?? 1);
  const eyedropperActive = tool.eyedropper ? " is-active" : "";

  return `
    <div class="builder-inspector-card builder-terrain-tool-card">
      <div class="builder-field-label">Terrain Brush</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Terrain Type</span>
        <select data-builder-field="terrain-type"${editable ? "" : " disabled"}>${terrainOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Height</span>
        <input type="number" data-builder-field="terrain-height" value="${escapeHtml(tool.height ?? 0)}" min="-8" max="16" step="1"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Movement</span>
        <select data-builder-field="terrain-movement-class"${editable ? "" : " disabled"}>${movementOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Brush Size</span>
        <select data-builder-field="terrain-brush-size"${editable ? "" : " disabled"}>${brushSizeOptions}</select>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button${eyedropperActive}" data-builder-action="terrain-eyedropper"${editable ? "" : " disabled"}>Eyedropper</button>
        <button type="button" class="builder-tool-button" data-builder-action="reset-terrain-brush"${editable ? "" : " disabled"}>Reset Brush</button>
      </div>
      <div class="builder-inspector-note">Select brush settings, then click the map. The centered brush paints terrain type, height, and movement together. Hazards/traps belong in Triggers later.</div>
    </div>
  `;
}

function renderStructureInspectorTools(builderState, appState) {
  const tool = ensureStructureToolSettings(builderState, appState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const roofOptions = buildRoofSpriteOptions(appState, builderState, tool.roofSprite ?? "roof_001.png");
  const brushSizeOptions = buildBrushSizeOptions(tool.brushSize ?? 1);
  const edgeTypeOptions = buildStructureEdgeTypeOptions(tool.edgeType ?? "wall");
  const edgeSpriteOptions = buildStructureEdgeSpriteOptions(appState, builderState, tool.edgeSpriteId ?? "wall_001.png");
  const eyedropperActive = isStructureEyedropperActive(builderState) ? " is-active" : "";
  const eraseActive = isStructureEraseModeActive(builderState) ? " is-active" : "";
  const edgeEyedropperActive = isStructureEdgeEyedropperActive(builderState) ? " is-active" : "";
  const edgeEraseActive = isStructureEdgeEraseModeActive(builderState) ? " is-active" : "";
  const roofsVisible = areStructureRoofsVisible(builderState);
  const roofPreview = renderStructureSpritePreview(tool.roofSprite, "Roof Preview");
  const edgePreview = renderStructureSpritePreview(tool.edgeSpriteId, "Edge Preview");

  return '<div class="builder-inspector-card builder-structure-tool-card">' +
      '<div class="builder-field-label">Structure Room Brush</div>' +
      '<label class="builder-form-field builder-form-field-compact">' +
        '<span>Structure ID</span>' +
        '<input type="text" data-builder-field="structure-id" value="' + escapeHtml(tool.structureId ?? "structure_01") + '" spellcheck="false"' + (editable ? '' : ' disabled') + '>' +
      '</label>' +
      '<label class="builder-form-field builder-form-field-compact">' +
        '<span>Room ID</span>' +
        '<input type="text" data-builder-field="structure-room-id" value="' + escapeHtml(tool.roomId ?? "room_01") + '" spellcheck="false"' + (editable ? '' : ' disabled') + '>' +
      '</label>' +
      '<label class="builder-form-field builder-form-field-compact">' +
        '<span>Roof Sprite</span>' +
        '<select data-builder-field="structure-roof-sprite"' + (editable ? '' : ' disabled') + '>' + roofOptions + '</select>' +
      '</label>' +
      roofPreview +
      '<label class="builder-form-field builder-form-field-compact">' +
        '<span>Brush Size</span>' +
        '<select data-builder-field="structure-brush-size"' + (editable ? '' : ' disabled') + '>' + brushSizeOptions + '</select>' +
      '</label>' +
      '<div class="builder-tool-row">' +
        '<button type="button" class="builder-tool-button' + eyedropperActive + '" data-builder-action="structure-eyedropper"' + (editable ? '' : ' disabled') + '>Cell Eyedropper</button>' +
        '<button type="button" class="builder-tool-button' + eraseActive + '" data-builder-action="structure-erase"' + (editable ? '' : ' disabled') + '>Erase Cells</button>' +
      '</div>' +
      '<div class="builder-tool-row">' +
        '<button type="button" class="builder-tool-button" data-builder-action="reset-structure-brush"' + (editable ? '' : ' disabled') + '>Reset Brush</button>' +
        '<button type="button" class="builder-tool-button' + (roofsVisible ? ' is-active' : '') + '" data-builder-action="toggle-structure-roofs">' + (roofsVisible ? 'Roofs Shown' : 'Roofs Hidden') + '</button>' +
      '</div>' +
      '<div class="builder-field-label builder-section-label">Structure Edge Brush</div>' +
      '<label class="builder-form-field builder-form-field-compact">' +
        '<span>Edge Type</span>' +
        '<select data-builder-field="structure-edge-type"' + (editable ? '' : ' disabled') + '>' + edgeTypeOptions + '</select>' +
      '</label>' +
      '<label class="builder-form-field builder-form-field-compact">' +
        '<span>Edge Sprite</span>' +
        '<select data-builder-field="structure-edge-sprite"' + (editable ? '' : ' disabled') + '>' + edgeSpriteOptions + '</select>' +
      '</label>' +
      edgePreview +
      '<label class="builder-form-field builder-form-field-compact">' +
        '<span>Edge Height</span>' +
        '<input type="number" data-builder-field="structure-edge-height" value="' + escapeHtml(tool.edgeHeight ?? getStructureEdgeTypeDefaults(tool.edgeType).edgeHeight) + '" min="0" max="99" step="1"' + (editable ? '' : ' disabled') + '>' +
      '</label>' +
      '<div class="builder-tool-row">' +
        '<button type="button" class="builder-tool-button' + edgeEyedropperActive + '" data-builder-action="structure-edge-eyedropper"' + (editable ? '' : ' disabled') + '>Edge Eyedropper</button>' +
        '<button type="button" class="builder-tool-button' + edgeEraseActive + '" data-builder-action="structure-edge-erase"' + (editable ? '' : ' disabled') + '>Erase Edge</button>' +
      '</div>' +
      '<div class="builder-inspector-note">Paint rooms/cells with normal click. Shift-click an edge to paint the selected wall/door/opening. Edge height is board truth; type/sprite are art/editor labels.</div>' +
    '</div>';
}

function buildRoofSpriteOptions(appState, builderState, selectedRoof = "roof_001.png") {
  const options = getBuilderRoofSpriteOptions(appState, builderState);
  return options.map((roof) => {
    const value = escapeHtml(roof);
    const selected = roof === selectedRoof ? " selected" : "";
    return '<option value="' + value + '"' + selected + '>' + value + '</option>';
  }).join("");
}

function buildStructureEdgeTypeOptions(selectedType = "wall") {
  return getStructureEdgeTypeOptions().map((type) => {
    const selected = type === selectedType ? " selected" : "";
    return '<option value="' + escapeHtml(type) + '"' + selected + '>' + escapeHtml(type) + '</option>';
  }).join("");
}

function buildStructureEdgeSpriteOptions(appState, builderState, selectedSprite = "wall_001.png") {
  const options = getBuilderStructureEdgeSpriteOptions(appState, builderState);
  const cleanSelected = String(selectedSprite ?? "").trim();
  const values = cleanSelected && !options.includes(cleanSelected) ? [cleanSelected, ...options] : options;
  return '<option value=""' + (!cleanSelected ? ' selected' : '') + '>none / opening</option>' + values.map((sprite) => {
    const value = escapeHtml(sprite);
    const selected = sprite === cleanSelected ? " selected" : "";
    return '<option value="' + value + '"' + selected + '>' + value + '</option>';
  }).join("");
}

function renderStructureSpritePreview(spriteId, label) {
  const clean = String(spriteId ?? "").trim();
  if (!clean) {
    return '<div class="builder-structure-art-preview is-empty"><span>' + escapeHtml(label) + '</span><strong>No sprite / open edge</strong></div>';
  }

  const src = escapeHtml(getStructureSpritePreviewPath(clean));
  return '<div class="builder-structure-art-preview"><span>' + escapeHtml(label) + '</span><img src="' + src + '" alt="' + escapeHtml(clean) + '"><strong>' + escapeHtml(clean) + '</strong></div>';
}

function renderUnitInspectorTools(builderState, appState) {
  const tool = ensureUnitToolSettings(builderState, appState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const pilots = getPilotOptions(appState);
  const mechs = getMechOptions(appState);
  const spawns = getSpawnIdOptions(builderState);
  const starts = getUnitStartAssignments(builderState);
  const isEmptyMech = tool.startType === "emptyMech";
  const hasSelectedMech = Boolean(tool.mechDefinitionId);
  const pilotOptions = buildObjectOptions(pilots, tool.pilotDefinitionId, "No pilots loaded");
  const mechOptions = buildObjectOptions(mechs, tool.mechDefinitionId, "No mechs loaded", !isEmptyMech, isEmptyMech ? "Choose a mech" : "none / on foot");
  const pilotSpawnOptions = buildObjectOptions(spawns, tool.pilotSpawnId, "No fixed spawns placed", true, "deployment / none");
  const mechSpawnOptions = buildObjectOptions(spawns, tool.mechSpawnId, "No fixed spawns placed", true, "deployment / none");
  const teamOptions = buildSimpleOptions(["player", "enemy"], tool.team ?? "player");
  const controlOptions = buildSimpleOptions(["PC", "CPU"], tool.controlType ?? "PC");
  const startTypeOptions = buildLabeledOptions([
    { value: "pilot", label: "Pilot / Pilot + Mech" },
    { value: "emptyMech", label: "Empty Mech" }
  ], tool.startType ?? "pilot");

  const pilotFields = !isEmptyMech ? `
      <label class="builder-form-field builder-form-field-compact">
        <span>Pilot</span>
        <select data-builder-field="unit-pilot-id"${editable ? "" : " disabled"}>${pilotOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Optional Mech</span>
        <select data-builder-field="unit-mech-id"${editable ? "" : " disabled"}>${mechOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Pilot Spawn</span>
        <select data-builder-field="unit-pilot-spawn-id"${editable ? "" : " disabled"}>${pilotSpawnOptions}</select>
      </label>
      ${hasSelectedMech ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Mech Spawn</span>
          <select data-builder-field="unit-mech-spawn-id"${editable ? "" : " disabled"}>${mechSpawnOptions}</select>
        </label>
      ` : ""}
      <div class="builder-inspector-note">Pilot with no mech starts on foot. Pilot with a mech starts embarked. For player deployment roster entries, spawn IDs can stay blank.</div>
    ` : "";

  const emptyMechFields = isEmptyMech ? `
      <label class="builder-form-field builder-form-field-compact">
        <span>Mech</span>
        <select data-builder-field="unit-mech-id"${editable ? "" : " disabled"}>${mechOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Mech Spawn</span>
        <select data-builder-field="unit-mech-spawn-id"${editable ? "" : " disabled"}>${mechSpawnOptions}</select>
      </label>
      <div class="builder-inspector-note">Empty Mech is a fixed vehicle start. It has no pilot and must use a Mech Spawn. It is not a deployment roster type.</div>
    ` : "";

  return `
    <div class="builder-inspector-card builder-unit-tool-card">
      <div class="builder-field-label">Unit / Start Assignment</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Team</span>
        <select data-builder-field="unit-team"${editable ? "" : " disabled"}>${teamOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Control</span>
        <select data-builder-field="unit-control-type"${editable ? "" : " disabled"}>${controlOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Start Kind</span>
        <select data-builder-field="unit-start-type"${editable ? "" : " disabled"}>${startTypeOptions}</select>
      </label>
      ${pilotFields}
      ${emptyMechFields}
      <label class="builder-form-field builder-form-field-compact">
        <span>Instance Prefix</span>
        <input type="text" data-builder-field="unit-instance-prefix" value="${escapeHtml(tool.instancePrefix ?? "")}" placeholder="auto" spellcheck="false"${editable ? "" : " disabled"}>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="add-unit-start"${editable ? "" : " disabled"}>Add Start</button>
        <button type="button" class="builder-tool-button" data-builder-action="reset-unit-start-form"${editable ? "" : " disabled"}>Reset Form</button>
      </div>
      <div class="builder-field-label builder-section-label">Current StartState Deployments</div>
      ${renderUnitStartList(starts)}
    </div>
  `;
}

function renderUnitStartList(starts) {
  if (!starts.length) {
    return '<div class="builder-inspector-note">No unit start assignments yet.</div>';
  }

  return '<div class="builder-unit-start-list">' + starts.map((entry, index) => {
    const hasPilot = Boolean(entry?.pilotDefinitionId);
    const hasMech = Boolean(entry?.mechDefinitionId);
    const isEmptyMech = hasMech && !hasPilot;
    const type = isEmptyMech ? "empty mech" : hasMech ? "pilot + mech" : "pilot";
    const name = isEmptyMech
      ? entry.mechDefinitionId
      : hasMech
        ? entry.pilotDefinitionId + " / " + entry.mechDefinitionId
        : entry?.pilotDefinitionId ?? "unknown pilot";
    const control = (entry?.controlType ?? "PC") + " " + (entry?.team ?? "player");
    const spawn = isEmptyMech
      ? "M:" + (entry?.mechSpawnId || "missing")
      : hasMech
        ? "P:" + (entry?.pilotSpawnId || "deploy") + " M:" + (entry?.mechSpawnId || "deploy")
        : "P:" + (entry?.pilotSpawnId || "deploy");
    return '<div class="builder-unit-start-row">' +
      '<div><strong>' + escapeHtml(index + 1 + ". " + name) + '</strong><span>' + escapeHtml(control + " · " + type + " · " + spawn) + '</span></div>' +
      '<button type="button" class="builder-tool-button" data-builder-action="remove-unit-start:' + index + '">Remove</button>' +
    '</div>';
  }).join("") + '</div>';
}

function buildObjectOptions(options, selectedId = "", emptyLabel = "None", includeBlank = false, blankLabel = "deployment / none") {
  const list = Array.isArray(options) ? options : [];
  const blank = includeBlank ? '<option value="">' + escapeHtml(blankLabel) + '</option>' : "";
  if (!list.length) return blank + '<option value="">' + escapeHtml(emptyLabel) + '</option>';
  return blank + list.map((option) => {
    const id = option?.id ?? "";
    const selected = id === selectedId ? " selected" : "";
    const label = option?.label ? option.label + " · " + id : id;
    return '<option value="' + escapeHtml(id) + '"' + selected + '>' + escapeHtml(label) + '</option>';
  }).join("");
}

function buildLabeledOptions(options, selectedValue) {
  return options.map((option) => {
    const selected = String(option.value) === String(selectedValue) ? " selected" : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}

function buildBrushSizeOptions(selectedSize = 1) {
  const selectedNumber = Number(selectedSize) || 1;
  return getBuilderBrushSizeOptions().map((size) => {
    const selected = size === selectedNumber ? " selected" : "";
    return `<option value="${size}"${selected}>${size}x${size}</option>`;
  }).join("");
}

function renderSpawnInspectorTools(builderState, appState) {
  const tool = ensureSpawnToolSettings(builderState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const mode = tool.mode === "deployment" ? "deployment" : "spawn";
  const teamOptions = buildSimpleOptions(["player", "enemy"], tool.team ?? "player");
  const slotOptions = buildNumberOptions(1, 8, tool.slot ?? 1, (value) => "Slot " + value);
  const unitTypeOptions = buildLabeledOptions([
    { value: "pilot", label: "Pilot Cells" },
    { value: "mech", label: "Pilot + Mech Cells" }
  ], tool.deploymentUnitType ?? "pilot");
  const playerUnitTypeOptions = buildLabeledOptions([
    { value: "pilot", label: "Pilot Only" },
    { value: "mech", label: "Pilot + Mech" }
  ], tool.playerDeploymentUnitType ?? tool.deploymentUnitType ?? "pilot");
  const controlOptions = buildSimpleOptions(["PC", "CPU"], tool.deploymentControlType ?? "PC");
  const spawnEraseActive = tool.spawnErase ? " is-active" : "";
  const deploymentEraseActive = tool.deploymentErase ? " is-active" : "";
  const fixedTabActive = mode === "spawn" ? " is-active" : "";
  const deploymentTabActive = mode === "deployment" ? " is-active" : "";

  const fixedSpawnPanel = mode === "spawn" ? `
      <div class="builder-field-label builder-section-label">Fixed Spawn</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Team</span>
        <select data-builder-field="spawn-team"${editable ? "" : " disabled"}>${teamOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Spawn Slot</span>
        <select data-builder-field="spawn-slot"${editable ? "" : " disabled"}>${slotOptions}</select>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button${spawnEraseActive}" data-builder-action="spawn-erase"${editable ? "" : " disabled"}>Erase Spawn</button>
      </div>
      <div class="builder-inspector-note">Click a tile to place the selected fixed spawn. This writes map.spawns plus the tile spawnId used by the runtime.</div>
    ` : "";

  const deploymentPanel = mode === "deployment" ? `
      <div class="builder-field-label builder-section-label">Deployment Zone Paint</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Deploy Cell Type</span>
        <select data-builder-field="deployment-unit-type"${editable ? "" : " disabled"}>${unitTypeOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Control</span>
        <select data-builder-field="deployment-control-type"${editable ? "" : " disabled"}>${controlOptions}</select>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button${deploymentEraseActive}" data-builder-action="deployment-erase"${editable ? "" : " disabled"}>Erase Deploy Cell</button>
      </div>
      <div class="builder-field-label builder-section-label">Player Deployment Start</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Player Roster Type</span>
        <select data-builder-field="player-deployment-unit-type"${editable ? "" : " disabled"}>${playerUnitTypeOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Required Count</span>
        <input type="number" data-builder-field="deployment-required-count" value="${escapeHtml(tool.requiredCount ?? 2)}" min="0" max="12" step="1"${editable ? "" : " disabled"}>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="apply-deployment-settings"${editable ? "" : " disabled"}>Apply Start Mode</button>
      </div>
      <div class="builder-inspector-note">Click tiles to paint deployment cells. This writes map.startState.deploymentCells and playerDeployment using the runtime data shape.</div>
    ` : "";

  return `
    <div class="builder-inspector-card builder-spawn-tool-card">
      <div class="builder-field-label">Spawns</div>
      <div class="builder-tool-row" role="tablist" aria-label="Spawn authoring sections">
        <button type="button" class="builder-tool-button${fixedTabActive}" data-builder-action="spawn-tab-fixed"${editable ? "" : " disabled"}>Fixed Spawns</button>
        <button type="button" class="builder-tool-button${deploymentTabActive}" data-builder-action="spawn-tab-deployment"${editable ? "" : " disabled"}>Deployment Zones</button>
      </div>
      ${fixedSpawnPanel}
      ${deploymentPanel}
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="reset-spawn-brush"${editable ? "" : " disabled"}>Reset Spawn Tools</button>
      </div>
    </div>
  `;
}

function buildSimpleOptions(values, selectedValue) {
  return values.map((value) => {
    const selected = String(value) === String(selectedValue) ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(value)}</option>`;
  }).join("");
}

function buildNumberOptions(min, max, selectedValue, labeler = (value) => value) {
  const options = [];
  const selectedNumber = Number(selectedValue);
  for (let value = min; value <= max; value += 1) {
    const selected = value === selectedNumber ? " selected" : "";
    options.push(`<option value="${value}"${selected}>${escapeHtml(labeler(value))}</option>`);
  }
  return options.join("");
}

function renderSelectionSummary({ builderState, refs }) {
  if (!refs.selectionSummary) return;
  refs.selectionSummary.textContent = getBuilderSelectionSummary(builderState);
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
