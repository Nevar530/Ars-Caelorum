// src/builder/ui/builderShell.js
//
// Fullscreen Mission Builder shell.
// This is a new system shell, not the old dev menu DOM moved into a larger box.

import {
  BUILDER_TABS,
  areBuilderStructuresVisible,
  canUseCurrentRuntimeMap,
  getBuilderSelectionSummary,
  getBuilderTab,
  getBuilderWorkspaceAppState,
  isBuilderNewMapForm,
  isBuilderWorkspaceMap,
  shouldShowStructureArtToggle
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
import {
  ensureMissionPackageDraft,
  getMissionMapDrafts,
  getMissionPackageSummary,
  getObjectivePresetOptions
} from "../builderMissionPackage.js";
import {
  ensureObjectiveToolSettings,
  getObjectiveDefinitions,
  getObjectiveTypeOptions,
  objectiveTypeNeedsZone
} from "../builderObjectives.js";
import {
  ensureTriggerToolSettings,
  getTriggerDefinitions,
  getTriggerMissionResultOptions,
  getTriggerPresetOptions,
  getTriggerStatOptions,
  getTriggerTeamOptions,
  getTriggerTypeOptions
} from "../builderTriggers.js";
import {
  ensureLogicToolSettings,
  getLogicActionOptions,
  getLogicConditionOptions,
  getLogicDefinitions,
  getLogicMissionResultOptions,
  getLogicStatOptions
} from "../builderLogic.js";
import {
  getBuilderMapCatalogOptions,
  getBuilderMissionCatalogOptions
} from "../builderLoadExisting.js";
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
          <button type="button" data-builder-action="test">Test Mission</button>
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
  refs.tabKicker.textContent = (tab.id === "project" ? "MISSION" : tab.id.toUpperCase());
  refs.tabTitle.textContent = isBuilderWorkspaceMap(builderState) ? tab.label : isBuilderNewMapForm(builderState) ? "New Blank Map" : "New / Load";

  const notes = {
    project: "Mission wrapper, map list, start map, briefing, and overall goal live here.",
    map: "Map metadata and map-level setup live here. New blank maps are builder-owned and do not mutate the runtime map.",
    terrain: "Terrain owns tile truth: terrain type, tile flags/default movement, texture set, and height/elevation.",
    structures: "Structure cells/rooms are active for builder-owned maps. Roof visibility is an editor view toggle; edge/wall tools are active.",
    spawns: "Spawn and deployment authoring writes existing map.spawns and map.startState truth.",
    units: "Unit start assignments write map.startState.deployments using the current runtime contract.",
    objectives: "Objective definitions are authored here. Reach/Hold objectives use map painting for zones.",
    triggers: "Preset triggers live here. Use Run Logic Chain when one zone needs several actions.",
    logic: "Logic V1 is simple: optional condition, then ordered action list. No node graph, no NASA console.",
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

  const toggles = [];

  if (shouldShowStructureArtToggle(builderState)) {
    toggles.push(["structureArt", "Structures", areBuilderStructuresVisible(builderState)]);
  }

  toggles.push(
    ["structureEdges", "Edges", builderState.overlays?.structureEdges],
    ["rooms", "Rooms", builderState.overlays?.rooms],
    ["spawns", "Spawns", builderState.overlays?.spawns],
    ["deployment", "Deploy", builderState.overlays?.deployment],
    ["objectives", "Objectives", builderState.overlays?.objectives],
    ["triggers", "Triggers", builderState.overlays?.triggers],
    ["tileHeights", "Heights", builderState.overlays?.tileHeights]
  );

  refs.overlayToggles.innerHTML = toggles.map(([id, label, enabled]) => {
    const active = enabled ? " is-active" : "";
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
    : renderLanding(appState, builderState);
}

function renderLanding(appState, builderState = null) {
  const canUseCurrent = canUseCurrentRuntimeMap(appState);
  const shellScreen = appState?.ui?.shell?.screen ?? "unknown";
  const mapSummary = getMapSummary(appState);
  const selectedMapId = builderState?.loadExistingTool?.standaloneMapId ?? "";
  const selectedMissionId = builderState?.loadExistingTool?.standaloneMissionId ?? "";
  const mapCatalogOptions = buildExistingMapOptions(appState, selectedMapId);
  const missionCatalogOptions = buildExistingMissionOptions(appState, selectedMissionId);
  const hasCatalogMaps = Boolean(mapCatalogOptions);
  const hasCatalogMissions = Boolean(missionCatalogOptions);

  return `
    <section class="builder-landing-hero">
      <div class="builder-section-kicker">MISSION BUILDER</div>
      <h3>New / Load</h3>
      <p>Load or create missions. Mission is the authoring unit; maps are phases inside a mission. Existing maps can still be imported into a mission as reusable bases.</p>
    </section>

    <section class="builder-start-grid">
      <button type="button" class="builder-start-card" data-builder-action="new-mission">
        <span>New Mission Package</span>
        <small>Create mission metadata, start map, objectives, results, and export package.</small>
      </button>
      <button type="button" class="builder-start-card" data-builder-action="new-map">
        <span>New Blank Map</span>
        <small>Create a new mission package starting from one blank map.</small>
      </button>
      <div class="builder-start-card builder-start-card-form">
        <span>Load Existing Mission</span>
        <small>Open a mission package for editing. Loose maps are imported from inside the Mission tab.</small>
        <label class="builder-form-field builder-form-field-compact">
          <span>Mission</span>
          <select data-builder-field="existing-mission-id"${hasCatalogMissions ? "" : " disabled"}>${missionCatalogOptions || '<option value="">No catalog missions found</option>'}</select>
        </label>
        <button type="button" class="builder-tool-button" data-builder-action="load-existing-mission"${hasCatalogMissions ? "" : " disabled"}>Load Mission</button>
      </div>
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
      <div class="builder-inspector-note">New Blank Map creates a mission package with one blank map. Existing maps are imported into missions from the Mission tab.</div>
    </section>
  `;
}

function renderNewMapForm(appState) {
  const terrainOptions = buildTerrainOptions(appState);

  return `
    <section class="builder-landing-hero">
      <div class="builder-section-kicker">MAP AUTHORING</div>
      <h3>Create New Blank Map</h3>
      <p>This creates a new mission package with one builder-owned blank map. It does not touch the currently loaded runtime mission/map.</p>
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
        <span>Create Mission From Blank Map</span>
        <small>Open this mission package in the WYSIWYG builder workspace.</small>
      </button>
      <button type="button" class="builder-start-card" data-builder-action="cancel-new-map">
        <span>Cancel</span>
        <small>Return to New / Load without creating anything.</small>
      </button>
    </section>

    <section class="builder-landing-context">
      <div class="builder-inspector-note">Pencil rule: this creates one simple mission package with one map. Terrain brushes, structures, spawns, units, and objectives remain separate authoring passes.</div>
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
  const packageTools = builderState.activeTab === "project"
    ? renderPackageInspectorTools(builderState, appState)
    : "";
  const mapTools = builderState.activeTab === "map"
    ? renderMapInspectorTools(builderState, appState)
    : "";
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
  const objectiveTools = builderState.activeTab === "objectives"
    ? renderObjectiveInspectorTools(builderState, appState)
    : "";
  const triggerTools = builderState.activeTab === "triggers"
    ? renderTriggerInspectorTools(builderState, appState)
    : "";
  const logicTools = builderState.activeTab === "logic"
    ? renderLogicInspectorTools(builderState, appState)
    : "";
  const resultsTools = builderState.activeTab === "results"
    ? renderResultsInspectorTools(builderState)
    : "";
  const validationTools = builderState.activeTab === "validate"
    ? renderValidationInspectorTools(builderState)
    : "";
  const exportTools = builderState.activeTab === "export"
    ? renderExportInspectorTools(builderState)
    : "";
  const note = builderState.workspaceMode === "builder-map"
    ? "Builder-owned map. Terrain paints tile truth. Structures paint cells/edges. Spawns paints map.spawns and deployment cells. Units writes startState.deployments. Objectives and triggers write active-map mission scripting truth."
    : "Current loaded runtime map is read-only in the builder. Use New/Load for authored package work.";

  refs.inspector.innerHTML = `
    <div class="builder-inspector-card">
      <div class="builder-field-label">Selected</div>
      <div class="builder-field-value">${escapeHtml(selected.label ?? selected.type ?? "None")}</div>
    </div>
    ${packageTools}
    ${mapTools}
    ${terrainTools}
    ${structureTools}
    ${spawnTools}
    ${unitTools}
    ${objectiveTools}
    ${triggerTools}
    ${logicTools}
    ${resultsTools}
    ${validationTools}
    ${exportTools}
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


function renderPackageInspectorTools(builderState, appState) {
  const mission = ensureMissionPackageDraft(builderState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const summary = getMissionPackageSummary(builderState);
  const presetOptions = buildObjectivePresetOptions(mission.objectivePreset ?? mission.objectives?.[0]?.type ?? "defeat_all");
  const activeMapOptions = buildMissionMapOptions(summary.maps, summary.activeMapId);
  const startMapOptions = buildMissionMapOptions(summary.maps, summary.startMapId);
  const selectedExistingMapId = builderState?.loadExistingTool?.packageMapId ?? "";
  const existingMapOptions = buildExistingMapOptions(appState, selectedExistingMapId);
  const hasCatalogMaps = Boolean(existingMapOptions);

  return `
    <div class="builder-inspector-card builder-package-tool-card">
      <div class="builder-field-label">Mission Package Core</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Mission ID</span>
        <input type="text" data-builder-field="package-mission-id" value="${escapeHtml(mission.id ?? "")}" spellcheck="false"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Mission Name</span>
        <input type="text" data-builder-field="package-mission-name" value="${escapeHtml(mission.name ?? "")}" spellcheck="true"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Overall Goal</span>
        <textarea data-builder-field="package-goal-text" rows="3" spellcheck="true"${editable ? "" : " disabled"}>${escapeHtml(summary.goalText ?? mission.goalText ?? "")}</textarea>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Active Map / Phase</span>
        <select data-builder-field="package-active-map-id"${editable ? "" : " disabled"}>${activeMapOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Start Map</span>
        <select data-builder-field="package-start-map-id"${editable ? "" : " disabled"}>${startMapOptions}</select>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="add-package-map"${editable ? "" : " disabled"}>New Map</button>
        <button type="button" class="builder-tool-button" data-builder-action="duplicate-package-map"${editable ? "" : " disabled"}>Duplicate Active</button>
        
      </div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Load Existing Map</span>
        <select data-builder-field="package-load-map-id"${editable && hasCatalogMaps ? "" : " disabled"}>${existingMapOptions || '<option value="">No catalog maps found</option>'}</select>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="load-package-map"${editable && hasCatalogMaps ? "" : " disabled"}>Add Loaded Copy</button>
      </div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Briefing Title</span>
        <input type="text" data-builder-field="package-briefing-title" value="${escapeHtml(mission.briefing?.title ?? mission.name ?? "")}" spellcheck="true"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Briefing Body</span>
        <textarea data-builder-field="package-briefing-body" rows="5" spellcheck="true"${editable ? "" : " disabled"}>${escapeHtml(mission.briefing?.text ?? "")}</textarea>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Objective Preset For Active Map</span>
        <select data-builder-field="package-objective-preset"${editable ? "" : " disabled"}>${presetOptions}</select>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="apply-objective-preset"${editable ? "" : " disabled"}>Apply Preset</button>
      </div>
      <div class="builder-inspector-note">Mission owns the goal and map list. Objectives are scoped to the active map/phase.</div>
    </div>
    ${renderMissionMapList(summary)}
    ${renderCatalogPreview(summary)}
  `;
}

function renderMapInspectorTools(builderState, appState) {
  const map = builderState?.authoring?.map ?? null;
  const editable = builderState.workspaceMode === "builder-map";
  const width = Array.isArray(map) ? map[0]?.length ?? 0 : 0;
  const height = Array.isArray(map) ? map.length : 0;
  const selectedTerrain = map?.defaults?.terrainTypeId ?? map?.defaultTerrainTypeId ?? map?.terrainTypes?.[0] ?? "grass";
  const terrainOptions = buildTerrainOptions(appState, builderState, selectedTerrain);
  const movementOptions = buildMovementOptions(map?.defaults?.movementClass ?? "clear");

  return `
    <div class="builder-inspector-card builder-map-tool-card">
      <div class="builder-field-label">Active Map Defaults</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Map ID</span>
        <input type="text" data-builder-field="active-map-id" value="${escapeHtml(map?.id ?? "")}" spellcheck="false"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Map Name</span>
        <input type="text" data-builder-field="active-map-name" value="${escapeHtml(map?.name ?? "")}" spellcheck="true"${editable ? "" : " disabled"}>
      </label>
      <div class="builder-field-value">Size: ${escapeHtml(width)}×${escapeHtml(height)}</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Default Terrain</span>
        <select data-builder-field="map-default-terrain"${editable ? "" : " disabled"}>${terrainOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Default Height</span>
        <input type="number" data-builder-field="map-default-elevation" value="${escapeHtml(map?.defaults?.elevation ?? 0)}" min="-8" max="16" step="1"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Default Movement</span>
        <select data-builder-field="map-default-movement"${editable ? "" : " disabled"}>${movementOptions}</select>
      </label>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="apply-map-settings"${editable ? "" : " disabled"}>Apply Map Settings</button>
      </div>
      <div class="builder-inspector-note">This edits active map metadata/defaults. It does not repaint existing tiles; terrain painting remains on the Terrain tab.</div>
    </div>
  `;
}


function renderResultsInspectorTools(builderState) {
  const mission = ensureMissionPackageDraft(builderState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  return `
    <div class="builder-inspector-card builder-results-tool-card">
      <div class="builder-field-label">Mission Results</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Victory Title</span>
        <input type="text" data-builder-field="package-victory-title" value="${escapeHtml(mission.results?.victory?.title ?? "Victory")}" spellcheck="true"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Victory Text</span>
        <textarea data-builder-field="package-victory-text" rows="4" spellcheck="true"${editable ? "" : " disabled"}>${escapeHtml(mission.results?.victory?.text ?? "Mission complete.")}</textarea>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Defeat Title</span>
        <input type="text" data-builder-field="package-defeat-title" value="${escapeHtml(mission.results?.defeat?.title ?? "Defeat")}" spellcheck="true"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Defeat Text</span>
        <textarea data-builder-field="package-defeat-text" rows="4" spellcheck="true"${editable ? "" : " disabled"}>${escapeHtml(mission.results?.defeat?.text ?? "Mission failed.")}</textarea>
      </label>
      <div class="builder-inspector-note">Result text stays mission-wrapper data. Dialogue hookups belong to Dialogue/Logic later.</div>
    </div>
  `;
}

function renderMissionMapList(summary) {
  const maps = Array.isArray(summary?.maps) ? summary.maps : [];
  if (!maps.length) return "";
  const canRemove = maps.length > 1;

  return `
    <div class="builder-inspector-card builder-mission-map-list-card">
      <div class="builder-field-label">Maps In Mission</div>
      ${maps.map((map) => {
        const active = map.id === summary.activeMapId ? " · ACTIVE" : "";
        const start = map.id === summary.startMapId ? " · START" : "";
        const removeDisabled = canRemove ? "" : " disabled";
        const removeTitle = canRemove ? "Remove this map from the mission" : "Mission package must keep at least one map";
        return `
          <div class="builder-tool-row">
            <div class="builder-field-value">${escapeHtml(map.phaseIndex ?? "")}. ${escapeHtml(map.name)}${escapeHtml(active)}${escapeHtml(start)}</div>
            <button type="button" class="builder-tool-button" data-builder-action="remove-package-map:${escapeHtml(map.id)}" title="${escapeHtml(removeTitle)}" aria-label="Remove ${escapeHtml(map.name)} from mission"${removeDisabled}>✕</button>
          </div>
          <div class="builder-inspector-note">${escapeHtml(map.id)} · ${escapeHtml(map.objectiveCount)} objective(s)</div>
        `;
      }).join("")}
    </div>
  `;
}

function renderCatalogPreview(summary) {
  return `
    <div class="builder-inspector-card builder-catalog-preview-card">
      <div class="builder-field-label">Catalog Entry Preview</div>
      <div class="builder-field-value">Mission: ${escapeHtml(summary.missionId)}</div>
      <div class="builder-inspector-note">${escapeHtml(summary.missionPath)}</div>
      <div class="builder-field-value">Complete Package</div>
      <div class="builder-inspector-note">${escapeHtml(summary.packagePath)}</div>
      <div class="builder-field-value">Maps: ${escapeHtml(summary.maps?.length ?? 0)}</div>
      ${(summary.catalogMapEntries ?? []).map((entry) => `<div class="builder-inspector-note">${escapeHtml(entry.path)}</div>`).join("")}
    </div>
  `;
}

function buildExistingMapOptions(appState, selectedId = "") {
  const maps = getBuilderMapCatalogOptions(appState);
  return maps.map((map, index) => {
    const id = map.id;
    const selected = (selectedId ? id === selectedId : index === 0) ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(map.name || id)} (${escapeHtml(id)})</option>`;
  }).join("");
}

function buildMissionMapOptions(maps, selectedId) {
  return (Array.isArray(maps) ? maps : []).map((map) => {
    const selected = map.id === selectedId ? " selected" : "";
    return `<option value="${escapeHtml(map.id)}"${selected}>${escapeHtml(map.name)} (${escapeHtml(map.id)})</option>`;
  }).join("");
}


function buildObjectivePresetOptions(selectedPreset = "defeat_all") {
  return getObjectivePresetOptions().map((preset) => {
    const selected = preset.id === selectedPreset ? " selected" : "";
    return `<option value="${escapeHtml(preset.id)}"${selected}>${escapeHtml(preset.label)}</option>`;
  }).join("");
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
      <div class="builder-inspector-note">Pilot with no mech starts on foot. Pilot with a mech starts embarked at the pilot spawn/deployment slot. Separate parked vehicles use Empty Mech.</div>
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
      <div class="builder-inspector-note">Team and control are inferred from the selected spawn: player=PC, enemy=CPU, neutral=CPU. Export still writes explicit team/controlType.</div>
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
        ? "P+M:" + (entry?.pilotSpawnId || entry?.mechSpawnId || "deploy")
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
  const teamOptions = buildSimpleOptions(["player", "enemy", "neutral"], tool.team ?? "player");
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



function renderObjectiveInspectorTools(builderState, appState) {
  const tool = ensureObjectiveToolSettings(builderState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const objectives = getObjectiveDefinitions(builderState);
  const typeOptions = buildObjectiveTypeOptions(tool.type ?? "defeat_all");
  const teamOptions = buildSimpleOptions(["player", "enemy", "neutral"], tool.team ?? "player");
  const targetTeamOptions = buildSimpleOptions(["enemy", "player", "neutral"], tool.targetTeam ?? "enemy");
  const needsZone = objectiveTypeNeedsZone(tool.type);
  const selectedObjective = Number.isInteger(Number(tool.selectedIndex)) && objectives[Number(tool.selectedIndex)]
    ? objectives[Number(tool.selectedIndex)]
    : null;
  const selectedTileCount = Array.isArray(selectedObjective?.tiles) ? selectedObjective.tiles.length : 0;
  const addActive = tool.paintMode !== "erase" ? " is-active" : "";
  const eraseActive = tool.paintMode === "erase" ? " is-active" : "";

  const targetTeamFields = tool.type === "defeat_all" ? `
      <label class="builder-form-field builder-form-field-compact">
        <span>Target Team</span>
        <select data-builder-field="objective-target-team"${editable ? "" : " disabled"}>${targetTeamOptions}</select>
      </label>
    ` : "";

  const teamFields = tool.type !== "defeat_all" && tool.type !== "trigger_complete" ? `
      <label class="builder-form-field builder-form-field-compact">
        <span>Owning Team</span>
        <select data-builder-field="objective-team"${editable ? "" : " disabled"}>${teamOptions}</select>
      </label>
    ` : "";

  const roundFields = tool.type === "hold_zone" || tool.type === "survive_rounds" ? `
      <label class="builder-form-field builder-form-field-compact">
        <span>Rounds</span>
        <input type="number" data-builder-field="objective-rounds" value="${escapeHtml(tool.roundsRequired ?? 3)}" min="1" max="99" step="1"${editable ? "" : " disabled"}>
      </label>
    ` : "";

  const zoneTools = needsZone ? `
      <div class="builder-field-label builder-section-label">Zone Painter</div>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button${addActive}" data-builder-action="objective-paint-add"${editable ? "" : " disabled"}>Paint Zone</button>
        <button type="button" class="builder-tool-button${eraseActive}" data-builder-action="objective-paint-erase"${editable ? "" : " disabled"}>Erase Zone</button>
      </div>
      <div class="builder-inspector-note">Select an objective below, then click tiles on the map. Current selected objective has ${selectedTileCount} zone tile(s).</div>
    ` : `<div class="builder-inspector-note">This objective type does not use a painted zone.</div>`;

  return `
    <div class="builder-inspector-card builder-objective-tool-card">
      <div class="builder-field-label">Objectives V1</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Mission Type</span>
        <select data-builder-field="objective-type"${editable ? "" : " disabled"}>${typeOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Objective ID</span>
        <input type="text" data-builder-field="objective-id" value="${escapeHtml(tool.id ?? "")}" placeholder="auto" spellcheck="false"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>HUD Label</span>
        <input type="text" data-builder-field="objective-label" value="${escapeHtml(tool.label ?? "")}" placeholder="Objective label" spellcheck="false"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Briefing Text</span>
        <textarea data-builder-field="objective-briefing-text" rows="3" spellcheck="true"${editable ? "" : " disabled"}>${escapeHtml(tool.briefingText ?? "")}</textarea>
      </label>
      ${targetTeamFields}
      ${teamFields}
      ${roundFields}
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="add-objective"${editable ? "" : " disabled"}>Add Objective</button>
        <button type="button" class="builder-tool-button" data-builder-action="update-objective"${editable ? "" : " disabled"}>Update Selected</button>
      </div>
      ${zoneTools}
      <div class="builder-field-label builder-section-label">Current Objectives</div>
      ${renderObjectiveList(objectives, tool.selectedIndex)}
    </div>
  `;
}

function renderObjectiveList(objectives, selectedIndex) {
  const list = Array.isArray(objectives) ? objectives : [];
  if (!list.length) return '<div class="builder-inspector-note">No authored objectives yet.</div>';

  return '<div class="builder-objective-list">' + list.map((objective, index) => {
    const selected = Number(selectedIndex) === index ? ' is-active' : '';
    const tileCount = Array.isArray(objective?.tiles) ? objective.tiles.length : 0;
    const sub = objective?.type === 'defeat_all'
      ? 'target: ' + (objective?.targetTeam ?? 'enemy')
      : objective?.type === 'survive_rounds'
        ? 'rounds: ' + (objective?.roundsRequired ?? objective?.rounds ?? 0)
        : objective?.type === 'trigger_complete'
          ? 'completed by trigger'
          : 'zone tiles: ' + tileCount + (objective?.type === 'hold_zone' ? ' · rounds: ' + (objective?.roundsRequired ?? 0) : '');
    return '<div class="builder-objective-row' + selected + '">' +
      '<button type="button" class="builder-objective-main" data-builder-action="select-objective:' + index + '">' +
        '<strong>' + escapeHtml((index + 1) + '. ' + (objective?.label ?? objective?.id ?? 'Objective')) + '</strong>' +
        '<span>' + escapeHtml((objective?.type ?? 'objective') + ' · ' + sub) + '</span>' +
      '</button>' +
      '<button type="button" class="builder-tool-button" data-builder-action="remove-objective:' + index + '">Remove</button>' +
    '</div>';
  }).join('') + '</div>';
}

function buildObjectiveTypeOptions(selectedType = "defeat_all") {
  return getObjectiveTypeOptions().map((option) => {
    const selected = option.value === selectedType ? " selected" : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}


function renderTriggerInspectorTools(builderState, appState) {
  const tool = ensureTriggerToolSettings(builderState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const triggers = getTriggerDefinitions(builderState);
  const mapDrafts = getMissionMapDrafts(builderState);
  const activeMapId = String(builderState?.authoring?.map?.id ?? builderState?.authoring?.activeMapId ?? "");
  const presetOptions = buildTriggerPresetOptions(tool.preset ?? "load_map");
  const typeOptions = buildTriggerTypeOptions(tool.type ?? "onUnitEnterZone");
  const teamOptions = buildSimpleOptions(getTriggerTeamOptions(), tool.team ?? "player");
  const nextMapOptions = buildTriggerMapOptions(mapDrafts, tool.nextMapId, activeMapId);
  const triggerObjectiveList = Array.isArray(builderState?.authoring?.map?.objectives) && builderState.authoring.map.objectives.length
    ? builderState.authoring.map.objectives
    : builderState?.authoring?.mission?.objectives;
  const objectiveOptions = buildTriggerObjectiveOptions(triggerObjectiveList, tool.completeObjectiveId);
  const statOptions = buildSimpleOptions(getTriggerStatOptions(), tool.stat ?? "core");
  const missionResultOptions = buildSimpleOptions(getTriggerMissionResultOptions(), tool.missionResult ?? "victory");
  const logicOptions = buildLogicChainOptions(getLogicDefinitions(builderState), tool.logicChainId);
  const selectedTrigger = Number.isInteger(Number(tool.selectedIndex)) && triggers[Number(tool.selectedIndex)]
    ? triggers[Number(tool.selectedIndex)]
    : null;
  const selectedTileCount = Array.isArray(selectedTrigger?.tiles) ? selectedTrigger.tiles.length : 0;
  const addActive = tool.paintMode !== "erase" ? " is-active" : "";
  const eraseActive = tool.paintMode === "erase" ? " is-active" : "";
  const showLoadMapFields = tool.preset === "load_map";
  const showObjectiveField = tool.preset === "load_map" || tool.preset === "complete_objective";
  const showStatFields = tool.preset === "change_unit_stat";
  const showResultField = tool.preset === "end_mission";
  const showLogicField = tool.preset === "run_logic";

  return `
    <div class="builder-inspector-card builder-trigger-tool-card">
      <div class="builder-field-label">Triggers V1</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Trigger ID</span>
        <input type="text" data-builder-field="trigger-id" value="${escapeHtml(tool.id ?? "")}" placeholder="auto" spellcheck="false"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Trigger Name</span>
        <input type="text" data-builder-field="trigger-name" value="${escapeHtml(tool.name ?? "")}" spellcheck="true"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Preset</span>
        <select data-builder-field="trigger-preset"${editable ? "" : " disabled"}>${presetOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Trigger Type</span>
        <select data-builder-field="trigger-type"${editable ? "" : " disabled"}>${typeOptions}</select>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Team Filter</span>
        <select data-builder-field="trigger-team"${editable ? "" : " disabled"}>${teamOptions}</select>
      </label>
      <label class="builder-form-check">
        <input type="checkbox" data-builder-field="trigger-once"${tool.once !== false ? " checked" : ""}${editable ? "" : " disabled"}>
        <span>Once</span>
      </label>
      ${showLoadMapFields ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Next Map</span>
          <select data-builder-field="trigger-next-map-id"${editable ? "" : " disabled"}>${nextMapOptions}</select>
        </label>
      ` : ""}
      ${showObjectiveField ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>${tool.preset === "complete_objective" ? "Objective To Complete" : "Complete Objective Optional"}</span>
          <select data-builder-field="trigger-complete-objective-id"${editable ? "" : " disabled"}>${objectiveOptions}</select>
        </label>
      ` : ""}
      ${showStatFields ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Stat</span>
          <select data-builder-field="trigger-stat"${editable ? "" : " disabled"}>${statOptions}</select>
        </label>
        <label class="builder-form-field builder-form-field-compact">
          <span>Value (+ heals / - hurts)</span>
          <input type="number" step="1" data-builder-field="trigger-value" value="${escapeHtml(tool.value ?? -1)}"${editable ? "" : " disabled"}>
        </label>
      ` : ""}
      ${showResultField ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Mission Result</span>
          <select data-builder-field="trigger-mission-result"${editable ? "" : " disabled"}>${missionResultOptions}</select>
        </label>
      ` : ""}
      ${showLogicField ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Logic Chain</span>
          <select data-builder-field="trigger-logic-chain-id"${editable ? "" : " disabled"}>${logicOptions}</select>
        </label>
      ` : ""}
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="add-trigger"${editable ? "" : " disabled"}>Add Trigger</button>
        <button type="button" class="builder-tool-button" data-builder-action="update-trigger"${editable ? "" : " disabled"}>Update Selected</button>
      </div>
      <div class="builder-field-label builder-section-label">Zone Painter</div>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button${addActive}" data-builder-action="trigger-paint-add"${editable ? "" : " disabled"}>Paint Zone</button>
        <button type="button" class="builder-tool-button${eraseActive}" data-builder-action="trigger-paint-erase"${editable ? "" : " disabled"}>Erase Zone</button>
      </div>
      <div class="builder-inspector-note">Select or add a trigger, then click tiles on the map. Only fields used by the selected preset are shown. Current selected trigger has ${selectedTileCount} zone tile(s).</div>
      <div class="builder-field-label builder-section-label">Current Triggers</div>
      ${renderTriggerList(triggers, tool.selectedIndex)}
    </div>
  `;
}

function renderTriggerList(triggers, selectedIndex) {
  const list = Array.isArray(triggers) ? triggers : [];
  if (!list.length) return '<div class="builder-inspector-note">No authored triggers yet.</div>';

  return '<div class="builder-trigger-list">' + list.map((trigger, index) => {
    const selected = Number(selectedIndex) === index ? ' is-active' : '';
    const tileCount = Array.isArray(trigger?.tiles) ? trigger.tiles.length : 0;
    const sub = (trigger?.preset ?? 'trigger') + ' · ' + (trigger?.team ?? 'player') + ' · tiles: ' + tileCount + formatTriggerListDetail(trigger);
    return '<div class="builder-trigger-row' + selected + '">' +
      '<button type="button" class="builder-trigger-main" data-builder-action="select-trigger:' + index + '">' +
        '<strong>' + escapeHtml((index + 1) + '. ' + (trigger?.name ?? trigger?.id ?? 'Trigger')) + '</strong>' +
        '<span>' + escapeHtml(sub) + '</span>' +
      '</button>' +
      '<button type="button" class="builder-tool-button" data-builder-action="remove-trigger:' + index + '">Remove</button>' +
    '</div>';
  }).join('') + '</div>';
}


function formatTriggerListDetail(trigger) {
  if (trigger?.preset === 'load_map') return trigger?.nextMapId ? ' · next: ' + trigger.nextMapId : ' · next: missing';
  if (trigger?.preset === 'change_unit_stat') return ' · ' + (trigger?.stat ?? 'core') + ' ' + (Number(trigger?.value ?? 0) >= 0 ? '+' : '') + (trigger?.value ?? 0);
  if (trigger?.preset === 'complete_objective') return trigger?.completeObjectiveId ? ' · objective: ' + trigger.completeObjectiveId : ' · objective: missing';
  if (trigger?.preset === 'end_mission') return ' · result: ' + (trigger?.missionResult ?? 'victory');
  if (trigger?.preset === 'run_logic') return trigger?.logicChainId ? ' · logic: ' + trigger.logicChainId : ' · logic: missing';
  return '';
}


function renderLogicInspectorTools(builderState, appState) {
  const tool = ensureLogicToolSettings(builderState) ?? {};
  const editable = builderState.workspaceMode === "builder-map";
  const logic = getLogicDefinitions(builderState);
  const mapDrafts = getMissionMapDrafts(builderState);
  const activeMapId = String(builderState?.authoring?.map?.id ?? builderState?.authoring?.activeMapId ?? "");
  const objectiveList = Array.isArray(builderState?.authoring?.map?.objectives) && builderState.authoring.map.objectives.length
    ? builderState.authoring.map.objectives
    : builderState?.authoring?.mission?.objectives;
  const conditionOptions = buildSimpleObjectOptions(getLogicConditionOptions(), tool.conditionType ?? "none");
  const actionOptions = buildSimpleObjectOptions(getLogicActionOptions(), tool.actionType ?? "complete_objective");
  const objectiveOptions = buildTriggerObjectiveOptions(objectiveList, tool.actionObjectiveId || tool.conditionObjectiveId);
  const conditionObjectiveOptions = buildTriggerObjectiveOptions(objectiveList, tool.conditionObjectiveId);
  const nextMapOptions = buildTriggerMapOptions(mapDrafts, tool.actionNextMapId, activeMapId);
  const statOptions = buildSimpleOptions(getLogicStatOptions(), tool.actionStat ?? "core");
  const missionResultOptions = buildSimpleOptions(getLogicMissionResultOptions(), tool.actionMissionResult ?? "victory");
  const itemOptions = buildLogicItemOptions(appState, tool.actionItemId);
  const selectedChain = Number.isInteger(Number(tool.selectedIndex)) && logic[Number(tool.selectedIndex)]
    ? logic[Number(tool.selectedIndex)]
    : null;
  const actionCount = Array.isArray(selectedChain?.actions) ? selectedChain.actions.length : 0;
  const showConditionObjective = tool.conditionType === "objective_complete" || tool.conditionType === "objective_incomplete";
  const showConditionFlag = tool.conditionType === "flag_true" || tool.conditionType === "flag_false";
  const showConditionRound = tool.conditionType === "round_at_least";
  const showActionObjective = tool.actionType === "complete_objective";
  const showActionStat = tool.actionType === "change_unit_stat";
  const showActionMap = tool.actionType === "load_map";
  const showActionResult = tool.actionType === "end_mission";
  const showActionFlag = tool.actionType === "set_flag";
  const showActionItem = tool.actionType === "give_item" || tool.actionType === "remove_item";

  return `
    <div class="builder-inspector-card builder-logic-tool-card">
      <div class="builder-field-label">Logic V1</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Logic ID</span>
        <input type="text" data-builder-field="logic-id" value="${escapeHtml(tool.id ?? "")}" placeholder="auto" spellcheck="false"${editable ? "" : " disabled"}>
      </label>
      <label class="builder-form-field builder-form-field-compact">
        <span>Logic Name</span>
        <input type="text" data-builder-field="logic-name" value="${escapeHtml(tool.name ?? "")}" spellcheck="true"${editable ? "" : " disabled"}>
      </label>
      <div class="builder-field-label builder-section-label">Condition Optional</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Condition</span>
        <select data-builder-field="logic-condition-type"${editable ? "" : " disabled"}>${conditionOptions}</select>
      </label>
      ${showConditionObjective ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Objective</span>
          <select data-builder-field="logic-condition-objective-id"${editable ? "" : " disabled"}>${conditionObjectiveOptions}</select>
        </label>
      ` : ""}
      ${showConditionFlag ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Flag ID</span>
          <input type="text" data-builder-field="logic-condition-flag-id" value="${escapeHtml(tool.conditionFlagId ?? "")}" placeholder="alarm_on" spellcheck="false"${editable ? "" : " disabled"}>
        </label>
      ` : ""}
      ${showConditionRound ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Round At Least</span>
          <input type="number" min="1" step="1" data-builder-field="logic-condition-round" value="${escapeHtml(tool.conditionRound ?? 1)}"${editable ? "" : " disabled"}>
        </label>
      ` : ""}
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="add-logic"${editable ? "" : " disabled"}>Add Logic</button>
        <button type="button" class="builder-tool-button" data-builder-action="update-logic"${editable ? "" : " disabled"}>Update Selected</button>
      </div>

      <div class="builder-field-label builder-section-label">Add Action</div>
      <label class="builder-form-field builder-form-field-compact">
        <span>Action</span>
        <select data-builder-field="logic-action-type"${editable ? "" : " disabled"}>${actionOptions}</select>
      </label>
      ${showActionObjective ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Objective</span>
          <select data-builder-field="logic-action-objective-id"${editable ? "" : " disabled"}>${objectiveOptions}</select>
        </label>
      ` : ""}
      ${showActionStat ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Target</span>
          <div class="builder-field-value">Triggering unit</div>
        </label>
        <label class="builder-form-field builder-form-field-compact">
          <span>Stat</span>
          <select data-builder-field="logic-action-stat"${editable ? "" : " disabled"}>${statOptions}</select>
        </label>
        <label class="builder-form-field builder-form-field-compact">
          <span>Value (+ heals / - hurts)</span>
          <input type="number" step="1" data-builder-field="logic-action-value" value="${escapeHtml(tool.actionValue ?? -1)}"${editable ? "" : " disabled"}>
        </label>
      ` : ""}
      ${showActionMap ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Next Map</span>
          <select data-builder-field="logic-action-next-map-id"${editable ? "" : " disabled"}>${nextMapOptions}</select>
        </label>
      ` : ""}
      ${showActionResult ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Mission Result</span>
          <select data-builder-field="logic-action-mission-result"${editable ? "" : " disabled"}>${missionResultOptions}</select>
        </label>
      ` : ""}
      ${showActionFlag ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Flag ID</span>
          <input type="text" data-builder-field="logic-action-flag-id" value="${escapeHtml(tool.actionFlagId ?? "")}" placeholder="alarm_on" spellcheck="false"${editable ? "" : " disabled"}>
        </label>
        <label class="builder-form-field builder-form-field-compact">
          <span>Flag Value</span>
          <select data-builder-field="logic-action-flag-value"${editable ? "" : " disabled"}>${buildSimpleOptions(["true", "false"], tool.actionFlagValue === false ? "false" : "true")}</select>
        </label>
      ` : ""}
      ${showActionItem ? `
        <label class="builder-form-field builder-form-field-compact">
          <span>Target</span>
          <div class="builder-field-value">Triggering unit</div>
        </label>
        <label class="builder-form-field builder-form-field-compact">
          <span>Item</span>
          <select data-builder-field="logic-action-item-id"${editable ? "" : " disabled"}>${itemOptions}</select>
        </label>
      ` : ""}
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="add-logic-action"${editable ? "" : " disabled"}>Add Action To Selected</button>
      </div>
      <div class="builder-inspector-note">Triggers call logic with the Run Logic Chain preset. Logic chains are optional condition + ordered actions. Current selected chain has ${actionCount} action(s).</div>
      <div class="builder-field-label builder-section-label">Current Logic Chains</div>
      ${renderLogicList(logic, tool.selectedIndex)}
    </div>
  `;
}

function renderLogicList(logic, selectedIndex) {
  const list = Array.isArray(logic) ? logic : [];
  if (!list.length) return '<div class="builder-inspector-note">No authored logic chains yet.</div>';
  return '<div class="builder-trigger-list builder-logic-list">' + list.map((chain, index) => {
    const selected = Number(selectedIndex) === index ? ' is-active' : '';
    const actions = Array.isArray(chain?.actions) ? chain.actions : [];
    const conditionText = formatLogicCondition(chain?.conditions?.[0]);
    const actionText = actions.length ? actions.map(formatLogicAction).join(' → ') : 'no actions';
    return '<div class="builder-trigger-row' + selected + '">' +
      '<button type="button" class="builder-trigger-main" data-builder-action="select-logic:' + index + '">' +
        '<strong>' + escapeHtml((index + 1) + '. ' + (chain?.name ?? chain?.id ?? 'Logic Chain')) + '</strong>' +
        '<span>' + escapeHtml(conditionText + ' · ' + actionText) + '</span>' +
      '</button>' +
      '<button type="button" class="builder-tool-button" data-builder-action="remove-logic:' + index + '">Remove</button>' +
      '<div class="builder-logic-actions">' + actions.map((action, actionIndex) =>
        '<button type="button" class="builder-tool-button" data-builder-action="remove-logic-action:' + index + ':' + actionIndex + '">Remove ' + escapeHtml(String(actionIndex + 1)) + '</button>'
      ).join('') + '</div>' +
    '</div>';
  }).join('') + '</div>';
}

function formatLogicCondition(condition) {
  if (!condition?.type) return 'always';
  if (condition.type === 'objective_complete') return 'if ' + (condition.objectiveId ?? 'objective') + ' complete';
  if (condition.type === 'objective_incomplete') return 'if ' + (condition.objectiveId ?? 'objective') + ' incomplete';
  if (condition.type === 'flag_true') return 'if flag ' + (condition.flagId ?? 'flag') + ' true';
  if (condition.type === 'flag_false') return 'if flag ' + (condition.flagId ?? 'flag') + ' false';
  if (condition.type === 'round_at_least') return 'if round >= ' + (condition.round ?? 1);
  return 'always';
}

function formatLogicAction(action) {
  if (action?.type === 'complete_objective') return 'complete ' + (action.objectiveId ?? 'objective');
  if (action?.type === 'change_unit_stat') return (action.stat ?? 'core') + ' ' + (Number(action.value ?? 0) >= 0 ? '+' : '') + (action.value ?? 0);
  if (action?.type === 'load_map') return 'load ' + (action.nextMapId ?? 'map');
  if (action?.type === 'end_mission') return 'end ' + (action.missionResult ?? 'victory');
  if (action?.type === 'set_flag') return 'flag ' + (action.flagId ?? 'flag') + '=' + (action.value === false ? 'false' : 'true');
  if (action?.type === 'give_item') return 'give ' + (action.itemId ?? 'item');
  if (action?.type === 'remove_item') return 'remove ' + (action.itemId ?? 'item');
  return action?.type ?? 'action';
}


function buildLogicItemOptions(appState, selectedItemId = "") {
  const content = appState?.content ?? {};
  const items = [
    ...(Array.isArray(content.pilotItems) ? content.pilotItems : []),
    ...(Array.isArray(content.mechItems) ? content.mechItems : [])
  ];
  const cleanSelected = String(selectedItemId ?? "");
  const seen = new Set();
  const options = ['<option value="">Select item...</option>'];
  for (const item of items) {
    const id = String(item?.id ?? item ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = String(item?.label ?? item?.name ?? id);
    options.push(`<option value="${escapeHtml(id)}"${id === cleanSelected ? " selected" : ""}>${escapeHtml(label)}</option>`);
  }
  if (cleanSelected && !seen.has(cleanSelected)) {
    options.push(`<option value="${escapeHtml(cleanSelected)}" selected>${escapeHtml(cleanSelected)}</option>`);
  }
  return options.join("");
}

function buildLogicChainOptions(logic, selectedId = "") {
  const list = Array.isArray(logic) ? logic : [];
  if (!list.length) return '<option value="">No logic chains</option>';
  const selected = String(selectedId ?? "");
  return ['<option value="">Select logic chain</option>', ...list.map((chain) => {
    const id = String(chain?.id ?? "");
    return `<option value="${escapeHtml(id)}"${id === selected ? " selected" : ""}>${escapeHtml(chain?.name || id)}</option>`;
  })].join("");
}

function buildSimpleObjectOptions(options, selectedValue) {
  return (Array.isArray(options) ? options : []).map((option) => {
    const value = String(option?.value ?? option ?? "");
    const label = String(option?.label ?? option?.value ?? option ?? "");
    const selected = value === String(selectedValue ?? "") ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function buildTriggerPresetOptions(selectedPreset = "load_map") {
  return getTriggerPresetOptions().map((option) => {
    const selected = option.value === selectedPreset ? " selected" : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}

function buildTriggerTypeOptions(selectedType = "onUnitEnterZone") {
  return getTriggerTypeOptions().map((option) => {
    const selected = option.value === selectedType ? " selected" : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}

function buildTriggerMapOptions(maps, selectedMapId = "", activeMapId = "") {
  const list = Array.isArray(maps) ? maps : [];
  if (!list.length) return '<option value="">No mission maps</option>';
  const cleanSelected = String(selectedMapId ?? "");
  return '<option value="">Choose next map...</option>' + list.map((map) => {
    const id = String(map?.id ?? "");
    const selected = id === cleanSelected ? " selected" : "";
    const self = id === activeMapId ? " (current)" : "";
    return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml((map?.name ?? id) + self)}</option>`;
  }).join("");
}

function buildTriggerObjectiveOptions(objectives, selectedObjectiveId = "") {
  const list = Array.isArray(objectives) ? objectives : [];
  const cleanSelected = String(selectedObjectiveId ?? "");
  return '<option value="">None</option>' + list.map((objective) => {
    const id = String(objective?.id ?? "");
    const selected = id === cleanSelected ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(objective?.label ?? id)}</option>`;
  }).join("");
}

function renderValidationInspectorTools(builderState) {
  const validation = builderState.validation ?? { errors: [], warnings: [], info: [] };
  const errors = validation.errors ?? [];
  const warnings = validation.warnings ?? [];
  const info = validation.info ?? [];
  const checked = validation.checkedAt ? new Date(validation.checkedAt).toLocaleTimeString() : "not run yet";

  return `
    <div class="builder-inspector-card builder-validation-card">
      <div class="builder-field-label">Validation V1</div>
      <div class="builder-field-value">${errors.length} errors · ${warnings.length} warnings</div>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="validate">Run Validation</button>
      </div>
      <div class="builder-inspector-note">Last check: ${escapeHtml(checked)}. Export and Test Mission run validation first and block on errors. Warnings are allowed for now.</div>
    </div>
    ${renderIssueSection("Errors", errors, "No errors.")}
    ${renderIssueSection("Warnings", warnings, "No warnings.")}
    ${renderIssueSection("Info", info, "No info.")}
  `;
}

function renderExportInspectorTools(builderState) {
  const validation = builderState.validation ?? { errors: [], warnings: [] };
  const errorCount = validation.errors?.length ?? 0;
  const warningCount = validation.warnings?.length ?? 0;
  const checked = validation.checkedAt ? new Date(validation.checkedAt).toLocaleTimeString() : "not run yet";
  const blocked = errorCount > 0;

  return `
    <div class="builder-inspector-card builder-export-card">
      <div class="builder-field-label">Export Package</div>
      <div class="builder-field-value">${blocked ? "Blocked" : "Ready"}</div>
      <div class="builder-tool-row">
        <button type="button" class="builder-tool-button" data-builder-action="validate">Run Validation</button>
        <button type="button" class="builder-tool-button" data-builder-action="export">Export Package</button>
      </div>
      <div class="builder-inspector-note">Last validation: ${escapeHtml(checked)}. Current result: ${errorCount} errors · ${warningCount} warnings. Export will re-check before creating the zip.</div>
    </div>
  `;
}

function renderIssueSection(title, issues, emptyText) {
  const list = Array.isArray(issues) ? issues : [];
  const body = list.length
    ? `<ul class="builder-issue-list">${list.map(renderIssueItem).join("")}</ul>`
    : `<ul class="builder-issue-list"><li>${escapeHtml(emptyText)}</li></ul>`;

  return `
    <div class="builder-inspector-card builder-issue-card">
      <div class="builder-field-label">${escapeHtml(title)}</div>
      ${body}
    </div>
  `;
}

function renderIssueItem(issue) {
  return `<li><strong>${escapeHtml(issue?.code ?? "ISSUE")}</strong><span>${escapeHtml(issue?.message ?? "")}</span></li>`;
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
function buildExistingMissionOptions(appState, selectedId = "") {
  const options = getBuilderMissionCatalogOptions(appState);
  if (!options.length) return "";

  const selected = selectedId || options[0]?.id || "";
  return options.map((entry) => {
    const isSelected = entry.id === selected ? " selected" : "";
    return `<option value="${escapeHtml(entry.id)}"${isSelected}>${escapeHtml(entry.name || entry.id)}</option>`;
  }).join("");
}

