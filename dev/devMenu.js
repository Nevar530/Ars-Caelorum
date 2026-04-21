// dev/devMenu.js
//
// Dev menu for the live Ars Caelorum app.
// Toggle key: `

import { createMechInstance } from "../src/mechs.js";
import { rebuildRoundOrder } from "../src/initiative.js";
import { getMapHeight, getMapSpawns, getMapWidth, getTile, getTileSummary } from "../src/map.js";
import {
  logDev,
  clearDevLog,
  getDevLogFormatted,
  subscribeToDevLog
} from "./devLogger.js";
import {
  ensureMapEditorState,
  replaceRuntimeMapFromDefinition,
  resizeRuntimeMap,
  setMapEditorBrushSize,
  setMapEditorEnabled,
  setMapEditorMovementClass,
  setMapEditorHeight,
  setMapEditorMode,
  setMapEditorPendingResize,
  setMapEditorSpawnBrush,
  setMapEditorTerrainPreset,
  setMapEditorStatus,
  getMapEditorDeployments,
  addMapEditorDeployment,
  removeMapEditorDeployment,
  updateMapEditorDeploymentField
} from "./mapEditor/mapEditorActions.js";
import { renderMapEditorPanel } from "./mapEditor/mapEditorPanel.js";
import { buildMapDefinitionFromRuntimeMap, downloadMapDefinition, parseMapDefinition } from "./mapEditor/mapSerialization.js";
import { loadMapDefinition } from "./mapEditor/mapCatalog.js";
import { DEFAULT_DEV_STATE } from "./devMenuModules/devMenuConstants.js";
import { createDevMenuDom } from "./devMenuModules/devMenuDom.js";
import {
  renderLogHtml,
  renderMapStateHtml,
  renderPhaseOrderHtml,
  renderRoundPhaseHtml,
  renderRuntimeStateHtml,
  renderUnitsHtml
} from "./devMenuModules/devMenuRender.js";
import {
  clone,
  formatSummaryValue,
  getUnitDisplayName,
  getUnitFootprintLabel,
  getUnitScale,
  nextDevUnitId,
  normalizeControlType,
  normalizeTeam,
  safeUpper
} from "./devMenuModules/devMenuUtils.js";

class DevMenu {
  constructor() {
    this.state = clone(DEFAULT_DEV_STATE);

    this.appState = null;
    this.renderApp = null;
    this.refs = null;

    this.rootEl = null;
    this.panelEl = null;

    this.unitsTabButtonEl = null;
    this.mapTabButtonEl = null;
    this.unitsTabEl = null;
    this.mapTabEl = null;

    this.logListEl = null;
    this.unitListEl = null;
    this.phaseOrderEl = null;
    this.roundPhaseEl = null;
    this.runtimeStateEl = null;
    this.mapStateEl = null;

    this.frameSelectEl = null;
    this.pilotSelectEl = null;
    this.spawnSelectEl = null;
    this.controlSelectEl = null;
    this.teamSelectEl = null;

    this.mapRotateLeftEl = null;
    this.mapRotateRightEl = null;
    this.mapToggleViewEl = null;
    this.mapResetEl = null;
    this.mapRaiseHeightEl = null;
    this.mapLowerHeightEl = null;

    this.editorShellEl = null;
    this.editorShellOriginalParent = null;
    this.editorShellOriginalNextSibling = null;
    this.mapEditorHostEl = null;

    this.initialized = false;
    this.unsubscribeLog = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMapEditorRuntimeUpdate = this.handleMapEditorRuntimeUpdate.bind(this);
  }

  init({ state, render, refs }) {
    if (this.initialized) return this;

    if (!state) throw new Error("DevMenu.init requires app state.");
    if (typeof render !== "function") throw new Error("DevMenu.init requires a render function.");
    if (!refs) throw new Error("DevMenu.init requires DOM refs.");

    this.appState = state;
    this.renderApp = render;
    this.refs = refs;

    this.captureEditorShell();
    this.buildDom();
    this.mountEditorIntoMapTab();
    this.bindEvents();
    this.populateSelectors();
    this.render();
    this.syncToolbarVisibility();

    this.unsubscribeLog = subscribeToDevLog(() => {
      this.renderLog();
    });

    this.initialized = true;
    logDev("Dev menu initialized.");

    return this;
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("ac:map-editor-updated", this.handleMapEditorRuntimeUpdate);

    if (this.unsubscribeLog) {
      this.unsubscribeLog();
      this.unsubscribeLog = null;
    }

    this.restoreEditorShell();

    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }

    this.rootEl = null;
    this.panelEl = null;
    this.initialized = false;
  }

  captureEditorShell() {
    const shell = document.getElementById("editorShell");
    this.editorShellEl = shell ?? null;

    if (shell) {
      this.editorShellOriginalParent = shell.parentNode;
      this.editorShellOriginalNextSibling = shell.nextSibling;
    }
  }

  mountEditorIntoMapTab() {
    this.renderMapEditorPanelIntoHost();
  }

  restoreEditorShell() {
    if (!this.editorShellEl || !this.editorShellOriginalParent) return;

    this.editorShellEl.style.display = "block";
    this.editorShellEl.style.width = "";
    this.editorShellEl.style.maxWidth = "";

    const editor = this.editorShellEl.querySelector("#editor");
    if (editor) {
      editor.style.display = "";
      editor.style.width = "";
      editor.style.height = "";
      editor.style.background = "";
      editor.style.border = "";
      editor.style.marginTop = "";
    }

    if (this.editorShellOriginalNextSibling) {
      this.editorShellOriginalParent.insertBefore(
        this.editorShellEl,
        this.editorShellOriginalNextSibling
      );
    } else {
      this.editorShellOriginalParent.appendChild(this.editorShellEl);
    }
  }

  getContent() {
    return this.appState?.content ?? {};
  }

  getFrameDefinitions() {
    return Array.isArray(this.getContent().mechs) ? this.getContent().mechs : [];
  }

  getPilotDefinitions() {
    return Array.isArray(this.getContent().pilots) ? this.getContent().pilots : [];
  }

  getSpawnPoints() {
    const mapSpawns = getMapSpawns(this.appState?.map);
    const runtimePoints = [];

    for (const team of ["player", "enemy"]) {
      const entries = Array.isArray(mapSpawns?.[team]) ? mapSpawns[team] : [];
      entries.forEach((spawn, index) => {
        if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) return;
        runtimePoints.push({
          id: `${team}_${index + 1}`,
          label: `${team.charAt(0).toUpperCase()}${team.slice(1)} ${index + 1}`,
          x: spawn.x,
          y: spawn.y,
          team,
          unitType: "mech"
        });
      });
    }

    if (runtimePoints.length > 0) return runtimePoints;
    return Array.isArray(this.getContent().spawnPoints) ? this.getContent().spawnPoints : [];
  }

  getRuntimeUnits() {
    if (Array.isArray(this.appState?.units)) return this.appState.units;
    return [];
  }

  getRotationValue() {
    return this.appState?.camera?.rotation ?? this.appState?.rotation ?? 0;
  }

  getViewLabel() {
    const currentView = this.appState?.ui?.viewMode ?? "iso";
    return currentView === "top" ? "TACTICAL" : "ISO";
  }

  getSelectedMapTile() {
    const selected = this.appState?.ui?.editor?.selectedTile ?? { x: 0, y: 0 };
    return {
      x: Number.isFinite(selected.x) ? selected.x : 0,
      y: Number.isFinite(selected.y) ? selected.y : 0
    };
  }

  getSelectedTileInfo() {
    const selected = this.getSelectedMapTile();
    const tile = getTile(this.appState.map, selected.x, selected.y);
    const summary = getTileSummary(tile);
    return { selected, tile, summary };
  }

  adjustSelectedTileHeight(delta) {
    const editor = ensureMapEditorState(this.appState);
    setMapEditorHeight(this.appState, Number(editor.selectedHeight ?? 0) + delta);
    this.render();
  }

  buildDom() {
    const { root, panel, refs } = createDevMenuDom();

    this.rootEl = root;
    this.panelEl = panel;

    this.unitsTabButtonEl = refs.unitsTabButtonEl;
    this.mapTabButtonEl = refs.mapTabButtonEl;
    this.unitsTabEl = refs.unitsTabEl;
    this.mapTabEl = refs.mapTabEl;

    this.logListEl = refs.logListEl;
    this.unitListEl = refs.unitListEl;
    this.phaseOrderEl = refs.phaseOrderEl;
    this.roundPhaseEl = refs.roundPhaseEl;
    this.runtimeStateEl = refs.runtimeStateEl;
    this.mapStateEl = refs.mapStateEl;

    this.frameSelectEl = refs.frameSelectEl;
    this.pilotSelectEl = refs.pilotSelectEl;
    this.spawnSelectEl = refs.spawnSelectEl;
    this.controlSelectEl = refs.controlSelectEl;
    this.teamSelectEl = refs.teamSelectEl;

    this.mapRotateLeftEl = refs.mapRotateLeftEl;
    this.mapRotateRightEl = refs.mapRotateRightEl;
    this.mapToggleViewEl = refs.mapToggleViewEl;
    this.mapResetEl = refs.mapResetEl;
    this.mapEditorHostEl = refs.mapEditorHostEl;
  }

  bindEvents() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("ac:map-editor-updated", this.handleMapEditorRuntimeUpdate);

    this.panelEl.querySelector("#ac-dev-close-btn").addEventListener("click", () => {
      this.toggle(false);
    });

    this.unitsTabButtonEl.addEventListener("click", () => {
      this.setActiveTab("units");
    });

    this.mapTabButtonEl.addEventListener("click", () => {
      this.setActiveTab("map");
    });

    this.mapRotateLeftEl?.addEventListener("click", () => {
      this.refs?.rotateLeftButton?.click();
      this.render();
    });

    this.mapRotateRightEl?.addEventListener("click", () => {
      this.refs?.rotateRightButton?.click();
      this.render();
    });

    this.mapToggleViewEl?.addEventListener("click", () => {
      this.refs?.toggleViewButton?.click();
      this.render();
    });

    this.mapResetEl?.addEventListener("click", () => {
      this.refs?.resetMapButton?.click();
      this.render();
    });

    this.mapEditorHostEl?.addEventListener("change", (event) => {
      this.handleMapEditorChange(event);
    });

    this.mapEditorHostEl?.addEventListener("click", (event) => {
      this.handleMapEditorClick(event);
    });


    this.panelEl.querySelector("#ac-dev-spawn-btn").addEventListener("click", () => {
      this.spawnSelectedUnit();
    });

    this.panelEl.querySelector("#ac-dev-reset-btn").addEventListener("click", () => {
      this.resetUnits();
    });

    this.panelEl.querySelector("#ac-dev-reroll-btn").addEventListener("click", () => {
      this.rerollInitiative();
    });

    this.panelEl.querySelector("#ac-dev-clearlog-btn").addEventListener("click", () => {
      clearDevLog();
      logDev("Dev log cleared.");
    });

    this.frameSelectEl.addEventListener("change", (event) => {
      this.state.selectedFrameId = event.target.value;
    });

    this.pilotSelectEl.addEventListener("change", (event) => {
      this.state.selectedPilotId = event.target.value;
    });

    this.spawnSelectEl.addEventListener("change", (event) => {
      this.state.selectedSpawnId = event.target.value;
    });

    this.controlSelectEl.addEventListener("change", (event) => {
      this.state.selectedControlType = event.target.value;
    });

    this.teamSelectEl.addEventListener("change", (event) => {
      this.state.selectedTeam = event.target.value;
    });
  }


  handleMapEditorRuntimeUpdate() {
    this.populateSelectors();

    if (!this.state.isOpen || this.state.activeTab !== 'map') return;
    this.renderMapState();
  }

  handleKeyDown(event) {
    if (event.key !== "`") return;

    event.preventDefault();
    event.stopPropagation();
    this.toggle();
  }

  populateSelectors() {
    const frames = this.getFrameDefinitions();
    const pilots = this.getPilotDefinitions();
    const spawnPoints = this.getSpawnPoints();

    const previousFrameId = this.state.selectedFrameId;
    const previousPilotId = this.state.selectedPilotId;
    const previousSpawnId = this.state.selectedSpawnId;
    const previousControlType = this.state.selectedControlType;
    const previousTeam = this.state.selectedTeam;

    this.frameSelectEl.innerHTML = frames
      .map(
        (frame) =>
          `<option value="${frame.id}">${frame.name} [${frame.variant ?? ""}]</option>`
      )
      .join("");

    this.pilotSelectEl.innerHTML = pilots
      .map(
        (pilot) =>
          `<option value="${pilot.id}">${pilot.name} (${pilot.role ?? "pilot"})</option>`
      )
      .join("");

    this.spawnSelectEl.innerHTML = spawnPoints
      .map(
        (spawn) =>
          `<option value="${spawn.id}">${spawn.label ?? spawn.id} (${spawn.x},${spawn.y})</option>`
      )
      .join("");

    this.state.selectedFrameId = frames.some((frame) => frame.id === previousFrameId)
      ? previousFrameId
      : (frames[0]?.id ?? "");
    this.state.selectedPilotId = pilots.some((pilot) => pilot.id === previousPilotId)
      ? previousPilotId
      : (pilots[0]?.id ?? "");
    this.state.selectedSpawnId = spawnPoints.some((spawn) => spawn.id === previousSpawnId)
      ? previousSpawnId
      : (spawnPoints[0]?.id ?? "");
    this.state.selectedControlType = normalizeControlType(previousControlType);
    this.state.selectedTeam = normalizeTeam(previousTeam);

    if (this.state.selectedFrameId) this.frameSelectEl.value = this.state.selectedFrameId;
    if (this.state.selectedPilotId) this.pilotSelectEl.value = this.state.selectedPilotId;
    if (this.state.selectedSpawnId) {
      this.spawnSelectEl.value = this.state.selectedSpawnId;
    } else if (this.spawnSelectEl) {
      this.spawnSelectEl.value = "";
    }
    this.controlSelectEl.value = this.state.selectedControlType;
    this.teamSelectEl.value = this.state.selectedTeam;
  }

  setActiveTab(tabName) {
    this.state.activeTab = tabName === "map" ? "map" : "units";

    const isUnits = this.state.activeTab === "units";

    this.unitsTabEl.style.display = isUnits ? "block" : "none";
    this.mapTabEl.style.display = isUnits ? "none" : "block";

    this.unitsTabButtonEl.style.opacity = isUnits ? "1" : "0.65";
    this.mapTabButtonEl.style.opacity = isUnits ? "0.65" : "1";

    setMapEditorEnabled(this.appState, this.state.isOpen && this.state.activeTab === 'map');
    this.render();
  }

  toggle(force) {
    const nextState = typeof force === "boolean" ? force : !this.state.isOpen;

    this.state.isOpen = nextState;
    this.panelEl.style.display = nextState ? "block" : "none";

    setMapEditorEnabled(this.appState, nextState && this.state.activeTab === 'map');
    this.syncToolbarVisibility();
    this.render();

    logDev(`Dev menu ${nextState ? "opened" : "closed"}.`);
  }

  getFrameDefinitionById(id) {
    return this.getFrameDefinitions().find((frame) => frame.id === id) ?? null;
  }

  getPilotDefinitionById(id) {
    return this.getPilotDefinitions().find((pilot) => pilot.id === id) ?? null;
  }

  getSpawnPointById(id) {
    return this.getSpawnPoints().find((spawn) => spawn.id === id) ?? null;
  }

  getUnitAtSpawn(spawnId) {
    return this.getRuntimeUnits().find((unit) => unit.spawnId === spawnId) ?? null;
  }

  replaceUnitAtSpawn(newUnit) {
    this.appState.units = [
      ...this.getRuntimeUnits().filter((unit) => unit.spawnId !== newUnit.spawnId),
      newUnit
    ];
  }

  syncActiveUnitAfterMutation(preferredInstanceId = null) {
    const units = this.getRuntimeUnits();

    if (units.length === 0) {
      this.appState.turn.activeUnitId = null;
      this.appState.selection.unitId = null;
      this.appState.focus.x = 0;
      this.appState.focus.y = 0;
      this.appState.focus.scale = "mech";
      return;
    }

    const preferred =
      units.find((unit) => unit.instanceId === preferredInstanceId) ??
      units.find((unit) => unit.instanceId === this.appState.turn.activeUnitId) ??
      units[0];

    this.appState.turn.activeUnitId = preferred.instanceId;
    this.appState.selection.unitId = preferred.instanceId;
    this.appState.focus.x = preferred.x;
    this.appState.focus.y = preferred.y;
    this.appState.focus.scale = getUnitScale(preferred);
  }

  spawnSelectedUnit() {
    const frameDef = this.getFrameDefinitionById(this.state.selectedFrameId);
    const pilotDef = this.getPilotDefinitionById(this.state.selectedPilotId);
    const spawn = this.getSpawnPointById(this.state.selectedSpawnId);

    if (!frameDef) {
      logDev("Spawn failed: selected frame definition not found.");
      return;
    }

    if (!pilotDef) {
      logDev("Spawn failed: selected pilot definition not found.");
      return;
    }

    if (!spawn) {
      logDev("Spawn failed: selected spawn point not found.");
      return;
    }

    const existingUnit = this.getUnitAtSpawn(spawn.id);

    const newUnit = createMechInstance(frameDef, {
      instanceId: nextDevUnitId(),
      x: spawn.x,
      y: spawn.y,
      facing: frameDef.defaultFacing
    });

    newUnit.spawnId = spawn.id;
    newUnit.spawnLabel = spawn.label ?? spawn.id;
    newUnit.controlType = normalizeControlType(this.state.selectedControlType);
    newUnit.team = normalizeTeam(this.state.selectedTeam);

    newUnit.pilotId = pilotDef.id;
    newUnit.pilotName = pilotDef.name;
    newUnit.pilotRole = pilotDef.role ?? "pilot";
    newUnit.reaction = pilotDef.reaction ?? 0;
    newUnit.targeting = pilotDef.targeting ?? 0;
    newUnit.pilotCore = pilotDef.core ?? 0;
    newUnit.pilotShield = pilotDef.shield ?? 0;
    newUnit.pilotAether = pilotDef.aether ?? 0;
    newUnit.pilotMove = pilotDef.move ?? 0;
    newUnit.abilityPoints = pilotDef.abilityPoints ?? 0;

    newUnit.hasMoved = false;
    newUnit.hasActed = false;
    newUnit.isBraced = false;
    newUnit.initiative = null;
    newUnit.status = "operational";

    this.replaceUnitAtSpawn(newUnit);
    this.syncActiveUnitAfterMutation(newUnit.instanceId);

    if (existingUnit) {
      logDev(
        `Replaced ${existingUnit.name} / ${existingUnit.pilotName ?? "No Pilot"} at ${existingUnit.spawnId} with ${newUnit.name} / ${newUnit.pilotName}.`
      );
    } else {
      logDev(
        `${newUnit.name} / ${newUnit.pilotName} spawned at ${newUnit.spawnId} (${newUnit.x},${newUnit.y}).`
      );
    }

    this.render();
    this.renderApp();
  }

  syncToolbarVisibility() {
    return;
  }

  removeUnit(instanceId) {
    const unit = this.getRuntimeUnits().find((entry) => entry.instanceId === instanceId);
    if (!unit) return;

    this.appState.units = this.getRuntimeUnits().filter(
      (entry) => entry.instanceId !== instanceId
    );

    this.appState.turn.moveOrder = this.appState.turn.moveOrder.filter(
      (id) => id !== instanceId
    );
    this.appState.turn.actionOrder = this.appState.turn.actionOrder.filter(
      (id) => id !== instanceId
    );

    if (this.appState.turn.activeUnitId === instanceId) {
      this.appState.turn.activeUnitId = null;
    }

    logDev(`${unit.name} / ${unit.pilotName ?? "No Pilot"} removed from map.`);

    if (this.getRuntimeUnits().length === 0) {
      this.appState.turn.activeUnitId = null;
      this.appState.turn.round = 1;
      this.appState.turn.phase = "setup";
      this.appState.turn.combatStarted = false;
      this.appState.turn.moveOrder = [];
      this.appState.turn.actionOrder = [];
      this.appState.turn.moveIndex = -1;
      this.appState.turn.actionIndex = -1;
      this.appState.turn.lastInitiativeRolls = [];
      this.appState.turn.splashText = "";
      this.appState.turn.splashVisible = false;
      this.appState.turn.splashKind = null;

      this.appState.selection.unitId = null;
      this.appState.selection.action = null;

      this.appState.ui.mode = "idle";
      this.appState.ui.previewPath = [];
      this.appState.ui.facingPreview = null;
      this.appState.ui.preMove = null;
      this.appState.ui.commandMenu.open = false;
      this.appState.ui.commandMenu.index = 0;
      this.appState.ui.commandMenu.items = [];

      this.appState.focus.x = 0;
      this.appState.focus.y = 0;
      this.appState.focus.scale = "mech";
    } else {
      this.syncActiveUnitAfterMutation();
    }

    this.render();
    this.renderApp();
  }

  resetUnits() {
    this.appState.units = [];

    this.appState.turn.activeUnitId = null;
    this.appState.turn.round = 1;
    this.appState.turn.phase = "setup";
    this.appState.turn.combatStarted = false;
    this.appState.turn.moveOrder = [];
    this.appState.turn.actionOrder = [];
    this.appState.turn.moveIndex = -1;
    this.appState.turn.actionIndex = -1;
    this.appState.turn.lastInitiativeRolls = [];
    this.appState.turn.splashText = "";
    this.appState.turn.splashVisible = false;
    this.appState.turn.splashKind = null;

    this.appState.selection.unitId = null;
    this.appState.selection.action = null;

    this.appState.ui.mode = "idle";
    this.appState.ui.previewPath = [];
    this.appState.ui.facingPreview = null;
    this.appState.ui.preMove = null;
    this.appState.ui.commandMenu.open = false;
    this.appState.ui.commandMenu.index = 0;
    this.appState.ui.commandMenu.items = [];

    this.appState.focus.x = 0;
    this.appState.focus.y = 0;
    this.appState.focus.scale = "mech";

    logDev("All units removed from map.");
    this.render();
    this.renderApp();
  }

  rerollInitiative() {
    const units = this.getRuntimeUnits();

    if (!units.length) {
      logDev("Initiative reroll skipped: no units on map.");
      return;
    }

    rebuildRoundOrder(this.appState);

    logDev(`Initiative rerolled for Round ${this.appState.turn.round}.`);

    for (const unit of units) {
      logDev(
        `${unit.name} / ${unit.pilotName ?? "No Pilot"} initiative = ${unit.initiative}`
      );
    }

    this.render();
    this.renderApp();
  }

  getMapEditorState() {
    return ensureMapEditorState(this.appState);
  }

  getMapCatalogEntries() {
    const maps = Array.isArray(this.appState?.content?.mapCatalog?.maps)
      ? this.appState.content.mapCatalog.maps
      : [];

    return maps.map((entry) => ({
      id: entry?.id ?? '',
      label: entry?.label ?? entry?.name ?? entry?.id ?? 'map',
      path: entry?.path ?? ''
    }));
  }

  getSelectedCatalogMapId() {
    return this.mapEditorHostEl?.querySelector('#ac-map-editor-map-select')?.value ?? this.getMapEditorState().activeMapId;
  }

  getSelectedCatalogEntry() {
    const selectedId = this.getSelectedCatalogMapId();
    return this.getMapCatalogEntries().find((entry) => entry.id === selectedId) ?? null;
  }


  validateCurrentMap() {
    const issues = [];
    const warnings = [];
    const map = this.appState?.map;
    const width = getMapWidth(map);
    const height = getMapHeight(map);

    if (!map) {
      issues.push('No active map loaded.');
      return { issues, warnings };
    }

    const spawns = map.spawns ?? { player: [], enemy: [] };
    const seenCoords = new Map();
    const pilotIds = new Set(this.getPilotDefinitions().map((entry) => entry?.id).filter(Boolean));
    const mechIds = new Set(this.getFrameDefinitions().map((entry) => entry?.id).filter(Boolean));
    const spawnIds = new Set(this.getSpawnPoints().map((entry) => entry?.id).filter(Boolean));
    const deployments = getMapEditorDeployments(this.appState);

    for (const team of ['player', 'enemy']) {
      const entries = Array.isArray(spawns[team]) ? spawns[team] : [];
      for (let i = 0; i < 4; i += 1) {
        const spawn = entries[i] ?? null;
        const label = `${team}_${i + 1}`;
        if (!spawn) {
          warnings.push(`Missing ${label}.`);
          continue;
        }
        if (spawn.x < 0 || spawn.y < 0 || spawn.x >= width || spawn.y >= height) {
          issues.push(`${label} is out of bounds.`);
          continue;
        }
        const key = `${spawn.x},${spawn.y}`;
        if (seenCoords.has(key)) {
          warnings.push(`${label} overlaps ${seenCoords.get(key)} at (${spawn.x},${spawn.y}).`);
        } else {
          seenCoords.set(key, label);
        }
      }
    }

    deployments.forEach((deployment, index) => {
      const label = `Deployment ${index + 1}`;

      if (!deployment.pilotDefinitionId) {
        warnings.push(`${label} is missing Pilot ID.`);
      } else if (!pilotIds.has(deployment.pilotDefinitionId)) {
        issues.push(`${label} pilot ${deployment.pilotDefinitionId} is not in pilots data.`);
      }

      if (!deployment.mechDefinitionId) {
        warnings.push(`${label} is missing Mech ID.`);
      } else if (!mechIds.has(deployment.mechDefinitionId)) {
        issues.push(`${label} mech ${deployment.mechDefinitionId} is not in mechs data.`);
      }

      if (!deployment.pilotSpawnId) {
        warnings.push(`${label} is missing Pilot Spawn ID.`);
      } else if (!spawnIds.has(deployment.pilotSpawnId)) {
        issues.push(`${label} pilot spawn ${deployment.pilotSpawnId} is not on this map.`);
      }

      if (!deployment.mechSpawnId) {
        warnings.push(`${label} is missing Mech Spawn ID.`);
      } else if (!spawnIds.has(deployment.mechSpawnId)) {
        issues.push(`${label} mech spawn ${deployment.mechSpawnId} is not on this map.`);
      }
    });

    for (const unit of this.getRuntimeUnits()) {
      if (!Number.isFinite(unit?.x) || !Number.isFinite(unit?.y)) continue;
      if (unit.x < 0 || unit.y < 0 || unit.x >= width || unit.y >= height) {
        issues.push(`Unit ${unit.name ?? unit.instanceId} is out of bounds.`);
      }
    }

    return { issues, warnings };
  }

  buildMapEditorViewModel() {
    const editor = this.getMapEditorState();
    const { selected, tile, summary } = this.getSelectedTileInfo();
    const terrainPresets = Array.isArray(this.appState?.content?.terrainList)
      ? this.appState.content.terrainList.map((entry) => ({
          ...entry,
          ...(this.appState?.content?.terrainDefinitions?.[entry.id] ?? {})
        }))
      : [];
    const validation = this.validateCurrentMap();

    return {
      editor,
      terrainPresets,
      movementClasses: [
        { id: 'clear', label: 'Clear' },
        { id: 'difficult', label: 'Difficult' },
        { id: 'impassable', label: 'Impassable' },
        { id: 'hazard', label: 'Hazard' }
      ],
      mapOptions: this.getMapCatalogEntries(),
      deployments: getMapEditorDeployments(this.appState),
      deploymentOptions: {
        pilots: this.getPilotDefinitions().map((pilot) => ({
          id: pilot.id,
          label: `${pilot.name ?? pilot.id} (${pilot.id})`
        })),
        mechs: this.getFrameDefinitions().map((mech) => ({
          id: mech.id,
          label: `${mech.name ?? mech.id} (${mech.id})`
        })),
        spawns: this.getSpawnPoints().map((spawn) => ({
          id: spawn.id,
          label: `${spawn.label ?? spawn.id} (${spawn.x},${spawn.y})`
        }))
      },
      selectedTile: tile ? {
        x: selected.x,
        y: selected.y,
        elevation: tile.elevation ?? 0,
        terrainTypeId: tile.terrainTypeId ?? 'grass',
        terrainSpriteId: tile.terrainSpriteId ?? null,
        movementClass: tile.movementClass ?? 'clear',
        spawnId: tile.spawnId ?? null
      } : null,
      selectedSummary: summary,
      validation,
      statusMessage: editor.statusMessage ?? '',
      statusTone: editor.statusTone ?? 'info'
    };
  }

  renderMapEditorPanelIntoHost() {
    if (!this.mapEditorHostEl) return;

    renderMapEditorPanel(this.mapEditorHostEl, this.buildMapEditorViewModel());

    const slot = this.mapEditorHostEl.querySelector('#ac-map-editor-canvas-slot');
    if (slot && this.editorShellEl) {
      this.editorShellEl.style.display = 'block';
      this.editorShellEl.style.width = '100%';
      this.editorShellEl.style.maxWidth = '100%';

      const title = this.editorShellEl.querySelector('.panel-title');
      if (title) title.textContent = 'Map Grid';

      const subs = Array.from(this.editorShellEl.querySelectorAll('.panel-sub'));
      if (subs[0]) subs[0].textContent = 'Left click paints · Right click samples · Hover shows brush';
      if (subs[1]) subs[1].textContent = 'Rotation-aligned tactical authoring view of the live map';
      if (subs[2]) subs[2].textContent = 'Live unit footprints, focus tile, and spawn markers';

      const editor = this.editorShellEl.querySelector('#editor');
      if (editor) {
        editor.style.display = 'block';
        editor.style.width = '100%';
        editor.style.maxWidth = '100%';
        editor.style.height = 'auto';
        editor.style.background = 'rgba(255,255,255,0.02)';
        editor.style.border = '1px solid rgba(255,255,255,0.08)';
        editor.style.marginTop = '8px';
      }
      slot.appendChild(this.editorShellEl);
    }
  }

  handleMapEditorChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const deploymentIndex = Number(target.getAttribute('data-deployment-index'));
    const deploymentField = target.getAttribute('data-deployment-field');

    if (Number.isInteger(deploymentIndex) && deploymentIndex >= 0 && deploymentField) {
      const nextValue = target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value;

      updateMapEditorDeploymentField(this.appState, deploymentIndex, deploymentField, nextValue);
      this.render();
      return;
    }

    switch (target.id) {
      case 'ac-map-editor-map-select':
        this.getMapEditorState().activeMapId = target.value;
        break;
      case 'ac-map-editor-mode-select':
        setMapEditorMode(this.appState, target.value);
        break;
      case 'ac-map-editor-brush-size':
        setMapEditorBrushSize(this.appState, target.value);
        break;
      case 'ac-map-editor-height-input':
        setMapEditorHeight(this.appState, target.value);
        break;
      case 'ac-map-editor-terrain-preset':
        setMapEditorTerrainPreset(this.appState, target.value);
        break;
      case 'ac-map-editor-movement-class':
        setMapEditorMovementClass(this.appState, target.value);
        break;
      case 'ac-map-editor-spawn-brush': {
        const [team, rawIndex] = String(target.value).split('_');
        setMapEditorSpawnBrush(this.appState, team, (Number(rawIndex) || 1) - 1);
        break;
      }
      case 'ac-map-editor-resize-width':
      case 'ac-map-editor-resize-height': {
        const width = this.mapEditorHostEl?.querySelector('#ac-map-editor-resize-width')?.value;
        const height = this.mapEditorHostEl?.querySelector('#ac-map-editor-resize-height')?.value;
        setMapEditorPendingResize(this.appState, width, height);
        break;
      }
      case 'ac-map-editor-import-input':
        if (target.files?.[0]) {
          this.importMapFromFile(target.files[0]);
        }
        break;
      default:
        return;
    }

    this.render();
  }

  async handleMapEditorClick(event) {
    const button = event.target.closest('[data-map-editor-action]');
    if (!button) return;

    const action = button.getAttribute('data-map-editor-action');

    try {
      switch (action) {
        case 'load-selected-map':
          await this.loadSelectedMap();
          break;
        case 'export-map':
          this.exportCurrentMap();
          break;
        case 'import-map':
          this.mapEditorHostEl?.querySelector('#ac-map-editor-import-input')?.click();
          break;
        case 'apply-resize':
          this.applyResizeFromEditor();
          break;
        case 'validate-map':
          setMapEditorStatus(this.appState, 'Map validated. Check issues and warnings below.', 'success');
          this.render();
          break;
        case 'add-deployment-row':
          addMapEditorDeployment(this.appState);
          setMapEditorStatus(this.appState, 'Deployment row added.', 'success');
          this.render();
          break;
        case 'remove-deployment-row': {
          const index = Number(button.getAttribute('data-deployment-index'));
          if (Number.isInteger(index) && index >= 0) {
            removeMapEditorDeployment(this.appState, index);
            setMapEditorStatus(this.appState, `Deployment ${index + 1} removed.`, 'success');
            this.render();
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error(error);
      logDev(`Map editor action failed: ${error.message}`);
    }
  }

  async loadSelectedMap() {
    const entry = this.getSelectedCatalogEntry();
    if (!entry?.path) {
      logDev('Map load failed: selected catalog entry has no path.');
      return;
    }

    const definition = await loadMapDefinition(entry.path);
    replaceRuntimeMapFromDefinition(this.appState, definition);
    this.getMapEditorState().activeMapId = entry.id;
    this.refs?.resetMapButton?.click();
    this.populateSelectors();
    setMapEditorStatus(this.appState, `Loaded map ${entry.id}.`, 'success');
    logDev(`Loaded map ${entry.id}.`);
  }

  async importMapFromFile(file) {
    const text = await file.text();
    const definition = parseMapDefinition(text);
    replaceRuntimeMapFromDefinition(this.appState, definition);
    this.getMapEditorState().activeMapId = definition?.id ?? 'imported_map';
    this.refs?.resetMapButton?.click();
    this.populateSelectors();
    setMapEditorStatus(this.appState, `Imported map ${definition?.name ?? definition?.id ?? file.name}.`, 'success');
    logDev(`Imported map ${definition?.name ?? definition?.id ?? file.name}.`);
  }

  exportCurrentMap() {
    const definition = buildMapDefinitionFromRuntimeMap(this.appState.map);
    const fileNameBase = definition.id || 'map_export';
    downloadMapDefinition(`${fileNameBase}.json`, definition);
    setMapEditorStatus(this.appState, `Exported map ${fileNameBase}.json.`, 'success');
    logDev(`Exported map ${fileNameBase}.json.`);
  }

  applyResizeFromEditor() {
    const editor = this.getMapEditorState();
    const nextWidth = Number(editor.pendingResize.width) || 1;
    const nextHeight = Number(editor.pendingResize.height) || 1;

    const blockedSpawns = [];
    const spawns = this.appState?.map?.spawns ?? {};
    for (const team of ['player', 'enemy']) {
      const entries = Array.isArray(spawns[team]) ? spawns[team] : [];
      entries.forEach((spawn, index) => {
        if (!spawn) return;
        if (spawn.x >= nextWidth || spawn.y >= nextHeight) {
          blockedSpawns.push(`${team}_${index + 1}`);
        }
      });
    }

    const blockedUnits = this.getRuntimeUnits()
      .filter((unit) => unit.x >= nextWidth || unit.y >= nextHeight)
      .map((unit) => unit.name ?? unit.instanceId);

    if (blockedSpawns.length || blockedUnits.length) {
      const parts = [];
      if (blockedSpawns.length) parts.push(`spawns out of bounds: ${blockedSpawns.join(', ')}`);
      if (blockedUnits.length) parts.push(`units out of bounds: ${blockedUnits.join(', ')}`);
      const message = `Resize blocked — ${parts.join(' · ')}`;
      setMapEditorStatus(this.appState, message, 'error');
      logDev(message);
      this.render();
      return;
    }

    resizeRuntimeMap(this.appState, nextWidth, nextHeight);
    this.refs?.resetMapButton?.click();
    this.populateSelectors();
    setMapEditorStatus(this.appState, `Map resized to ${nextWidth}x${nextHeight}.`, 'success');
    logDev(`Map resized to ${nextWidth}x${nextHeight}.`);
  }

  render() {
    this.renderRuntimeState();
    this.renderRoundPhase();
    this.renderPhaseOrder();
    this.renderUnits();
    this.renderMapState();
    this.renderLog();

    if (this.state.activeTab === "map") {
      this.renderApp();
    }
  }

  renderRuntimeState() {
    const units = this.getRuntimeUnits();
    const activeUnitId = this.appState?.turn?.activeUnitId ?? null;
    const selectedUnitId = this.appState?.selection?.unitId ?? null;

    const activeUnit = units.find((unit) => unit.instanceId === activeUnitId) ?? null;
    const selectedUnit = units.find((unit) => unit.instanceId === selectedUnitId) ?? null;

    this.runtimeStateEl.innerHTML = renderRuntimeStateHtml({
      units,
      appState: this.appState,
      activeUnit,
      selectedUnit,
      viewLabel: this.getViewLabel(),
      rotationValue: this.getRotationValue()
    });
  }

  renderRoundPhase() {
    this.roundPhaseEl.innerHTML = renderRoundPhaseHtml(this.appState.turn);
  }

  renderPhaseOrder() {
    this.phaseOrderEl.innerHTML = renderPhaseOrderHtml({
      units: this.getRuntimeUnits(),
      turn: this.appState.turn
    });
  }

  renderUnits() {
    const units = this.getRuntimeUnits();
    const activeUnitId = this.appState?.turn?.activeUnitId ?? null;
    const selectedUnitId = this.appState?.selection?.unitId ?? null;

    this.unitListEl.innerHTML = renderUnitsHtml({
      units,
      activeUnitId,
      selectedUnitId
    });

    const buttons = this.unitListEl.querySelectorAll(".ac-dev-remove-unit-btn");
    buttons.forEach((button) => {
      button.addEventListener("click", (event) => {
        const card = event.target.closest("[data-instance-id]");
        const instanceId = card?.getAttribute("data-instance-id");
        if (instanceId) {
          this.removeUnit(instanceId);
        }
      });
    });
  }

  renderMapState() {
    const focus = this.appState?.focus ?? {};
    const selectedUnitId = this.appState?.selection?.unitId ?? null;
    const units = this.getRuntimeUnits();
    const selectedUnit = units.find((unit) => unit.instanceId === selectedUnitId) ?? null;

    const { selected, tile, summary } = this.getSelectedTileInfo();
    const mapWidth = getMapWidth(this.appState.map);
    const mapHeight = getMapHeight(this.appState.map);

    this.mapStateEl.innerHTML = renderMapStateHtml({
      viewLabel: this.getViewLabel(),
      rotationValue: this.getRotationValue(),
      mapWidth,
      mapHeight,
      focus,
      selectedUnit,
      selected,
      tile,
      summary
    });

    this.renderMapEditorPanelIntoHost();
  }

  renderLog() {
    const entries = getDevLogFormatted();
    this.logListEl.innerHTML = renderLogHtml(entries);
  }
}


const devMenu = new DevMenu();

export default devMenu;

export function initializeDevMenu({ state, render, refs }) {
  return devMenu.init({ state, render, refs });
}

export function toggleDevMenu(force) {
  devMenu.toggle(force);
}
