// dev/devMenu.js
//
// Dev menu for the live Ars Caelorum app.
// Toggle key: `

import { createMechInstance } from "../src/mechs.js";
import { rebuildRoundOrder } from "../src/initiative.js";
import {
  logDev,
  clearDevLog,
  getDevLogFormatted,
  subscribeToDevLog
} from "./devLogger.js";

const DEFAULT_DEV_STATE = {
  isOpen: false,
  activeTab: "units",
  selectedFrameId: "",
  selectedPilotId: "",
  selectedSpawnId: "",
  selectedControlType: "PC",
  selectedTeam: "player"
};

let generatedDevUnitCounter = 0;

function nextDevUnitId() {
  generatedDevUnitCounter += 1;
  return `dev_unit_${String(generatedDevUnitCounter).padStart(4, "0")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeControlType(value) {
  return value === "CPU" ? "CPU" : "PC";
}

function normalizeTeam(value) {
  return value === "enemy" ? "enemy" : "player";
}

function safeUpper(value) {
  return String(value ?? "").toUpperCase();
}

function getUnitScale(unit) {
  return unit?.scale ?? unit?.unitType ?? "mech";
}

function getUnitFootprintLabel(unit) {
  const scale = getUnitScale(unit);
  return scale === "pilot" ? "1x1" : "3x3";
}

function getUnitDisplayName(unit) {
  const frame = unit?.name ?? "Unnamed Frame";
  const pilot = unit?.pilotName ?? "No Pilot";
  return { frame, pilot };
}

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

    this.editorSidebarEl = null;
    this.editorSidebarOriginalParent = null;
    this.editorSidebarOriginalNextSibling = null;

    this.mapEditorHostEl = null;
    this.mapRotateLeftEl = null;
    this.mapRotateRightEl = null;
    this.mapToggleViewEl = null;
    this.mapResetEl = null;

    this.initialized = false;
    this.unsubscribeLog = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init({ state, render, refs }) {
    if (this.initialized) return this;

    if (!state) {
      throw new Error("DevMenu.init requires app state.");
    }

    if (typeof render !== "function") {
      throw new Error("DevMenu.init requires a render function.");
    }

    if (!refs) {
      throw new Error("DevMenu.init requires DOM refs.");
    }

    this.appState = state;
    this.renderApp = render;
    this.refs = refs;

    this.captureExistingSidebar();
    this.buildDom();
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

    if (this.unsubscribeLog) {
      this.unsubscribeLog();
      this.unsubscribeLog = null;
    }

    this.restoreExistingSidebar();

    if (this.refs?.devToolbar) {
      const toolbar = this.refs.devToolbar;
      toolbar.style.display = "";
      toolbar.style.visibility = "";
      toolbar.style.pointerEvents = "";
      toolbar.style.opacity = "";
    }

    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }

    this.rootEl = null;
    this.panelEl = null;
    this.initialized = false;
  }

  captureExistingSidebar() {
    const sidebar = document.querySelector(".sidebar");
    this.editorSidebarEl = sidebar ?? null;

    if (sidebar) {
      this.editorSidebarOriginalParent = sidebar.parentNode;
      this.editorSidebarOriginalNextSibling = sidebar.nextSibling;
    }
  }

  mountExistingMapEditorIntoTab() {
    if (!this.editorSidebarEl || !this.mapEditorHostEl) return;

    this.editorSidebarEl.style.width = "100%";
    this.editorSidebarEl.style.maxWidth = "100%";
    this.editorSidebarEl.style.height = "auto";
    this.editorSidebarEl.style.margin = "0";
    this.editorSidebarEl.style.background = "transparent";
    this.editorSidebarEl.style.border = "0";
    this.editorSidebarEl.style.padding = "0";
    this.editorSidebarEl.style.boxShadow = "none";

    this.mapEditorHostEl.appendChild(this.editorSidebarEl);
  }

  restoreExistingSidebar() {
    if (!this.editorSidebarEl || !this.editorSidebarOriginalParent) return;

    this.editorSidebarEl.style.width = "";
    this.editorSidebarEl.style.maxWidth = "";
    this.editorSidebarEl.style.height = "";
    this.editorSidebarEl.style.margin = "";
    this.editorSidebarEl.style.background = "";
    this.editorSidebarEl.style.border = "";
    this.editorSidebarEl.style.padding = "";
    this.editorSidebarEl.style.boxShadow = "";

    if (this.editorSidebarOriginalNextSibling) {
      this.editorSidebarOriginalParent.insertBefore(
        this.editorSidebarEl,
        this.editorSidebarOriginalNextSibling
      );
    } else {
      this.editorSidebarOriginalParent.appendChild(this.editorSidebarEl);
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
    return Array.isArray(this.getContent().spawnPoints) ? this.getContent().spawnPoints : [];
  }

  getRuntimeUnits() {
    if (Array.isArray(this.appState?.units)) return this.appState.units;
    if (Array.isArray(this.appState?.mechs)) return this.appState.mechs;
    return [];
  }

  getRotationValue() {
    return this.appState?.camera?.rotation ?? this.appState?.rotation ?? 0;
  }

  getViewLabel() {
    const tactical =
      this.appState?.camera?.tacticalView ??
      this.appState?.ui?.tacticalView ??
      this.appState?.tacticalView ??
      false;

    return tactical ? "TACTICAL" : "ISO";
  }

  buildDom() {
    const root = document.createElement("div");
    root.id = "ac-dev-root";
    root.style.position = "fixed";
    root.style.top = "0";
    root.style.right = "0";
    root.style.height = "100vh";
    root.style.zIndex = "9999";
    root.style.pointerEvents = "none";

    const panel = document.createElement("div");
    panel.id = "ac-dev-panel";
    panel.style.width = "420px";
    panel.style.height = "100%";
    panel.style.background = "rgba(10, 12, 18, 0.96)";
    panel.style.color = "#d8e1ea";
    panel.style.borderLeft = "1px solid rgba(255,255,255,0.12)";
    panel.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.35)";
    panel.style.fontFamily = "monospace";
    panel.style.fontSize = "12px";
    panel.style.display = "none";
    panel.style.pointerEvents = "auto";
    panel.style.overflowY = "auto";
    panel.style.padding = "12px";
    panel.style.boxSizing = "border-box";

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:14px; font-weight:bold;">DEV MENU</div>
        <button id="ac-dev-close-btn" type="button">Close</button>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button id="ac-dev-tab-units" type="button">Units</button>
        <button id="ac-dev-tab-map" type="button">Map</button>
      </div>

      <div id="ac-dev-tab-panel-units">
        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="font-weight:bold; margin-bottom:8px;">Spawn / Replace Unit</div>

          <label style="display:block; margin-bottom:6px;">
            <div>Frame</div>
            <select id="ac-dev-frame-select" style="width:100%;"></select>
          </label>

          <label style="display:block; margin-bottom:6px;">
            <div>Pilot</div>
            <select id="ac-dev-pilot-select" style="width:100%;"></select>
          </label>

          <label style="display:block; margin-bottom:6px;">
            <div>Spawn Point</div>
            <select id="ac-dev-spawn-select" style="width:100%;"></select>
          </label>

          <label style="display:block; margin-bottom:6px;">
            <div>Control</div>
            <select id="ac-dev-control-select" style="width:100%;">
              <option value="PC">PC</option>
              <option value="CPU">CPU</option>
            </select>
          </label>

          <label style="display:block; margin-bottom:10px;">
            <div>Team</div>
            <select id="ac-dev-team-select" style="width:100%;">
              <option value="player">player</option>
              <option value="enemy">enemy</option>
            </select>
          </label>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="ac-dev-spawn-btn" type="button">Spawn / Replace Unit</button>
            <button id="ac-dev-reset-btn" type="button">Reset Units</button>
            <button id="ac-dev-reroll-btn" type="button">Reroll Initiative</button>
            <button id="ac-dev-clearlog-btn" type="button">Clear Log</button>
          </div>
        </div>

        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="font-weight:bold; margin-bottom:8px;">Runtime State</div>
          <div id="ac-dev-runtime-state"></div>
        </div>

        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="font-weight:bold; margin-bottom:8px;">Round / Phase</div>
          <div id="ac-dev-round-phase"></div>
          <div id="ac-dev-phase-order" style="margin-top:8px;"></div>
        </div>

        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="font-weight:bold; margin-bottom:8px;">Units On Map</div>
          <div id="ac-dev-unit-list"></div>
        </div>

        <div>
          <div style="font-weight:bold; margin-bottom:8px;">Debug Log</div>
          <div id="ac-dev-log-list"></div>
        </div>
      </div>

      <div id="ac-dev-tab-panel-map" style="display:none;">
        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="font-weight:bold; margin-bottom:8px;">Map State</div>
          <div id="ac-dev-map-state"></div>
        </div>

        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="font-weight:bold; margin-bottom:8px;">Map Controls</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="ac-dev-map-rotate-left" type="button">⟲ Rotate Left</button>
            <button id="ac-dev-map-rotate-right" type="button">⟳ Rotate Right</button>
            <button id="ac-dev-map-toggle-view" type="button">Toggle Tactical (R)</button>
            <button id="ac-dev-map-reset" type="button">Reset Map</button>
          </div>
        </div>

        <div id="ac-dev-map-editor-host"></div>
      </div>
    `;

    root.appendChild(panel);
    document.body.appendChild(root);

    this.rootEl = root;
    this.panelEl = panel;

    this.unitsTabButtonEl = panel.querySelector("#ac-dev-tab-units");
    this.mapTabButtonEl = panel.querySelector("#ac-dev-tab-map");
    this.unitsTabEl = panel.querySelector("#ac-dev-tab-panel-units");
    this.mapTabEl = panel.querySelector("#ac-dev-tab-panel-map");

    this.logListEl = panel.querySelector("#ac-dev-log-list");
    this.unitListEl = panel.querySelector("#ac-dev-unit-list");
    this.phaseOrderEl = panel.querySelector("#ac-dev-phase-order");
    this.roundPhaseEl = panel.querySelector("#ac-dev-round-phase");
    this.runtimeStateEl = panel.querySelector("#ac-dev-runtime-state");
    this.mapStateEl = panel.querySelector("#ac-dev-map-state");

    this.frameSelectEl = panel.querySelector("#ac-dev-frame-select");
    this.pilotSelectEl = panel.querySelector("#ac-dev-pilot-select");
    this.spawnSelectEl = panel.querySelector("#ac-dev-spawn-select");
    this.controlSelectEl = panel.querySelector("#ac-dev-control-select");
    this.teamSelectEl = panel.querySelector("#ac-dev-team-select");

    this.mapEditorHostEl = panel.querySelector("#ac-dev-map-editor-host");
    this.mapRotateLeftEl = panel.querySelector("#ac-dev-map-rotate-left");
    this.mapRotateRightEl = panel.querySelector("#ac-dev-map-rotate-right");
    this.mapToggleViewEl = panel.querySelector("#ac-dev-map-toggle-view");
    this.mapResetEl = panel.querySelector("#ac-dev-map-reset");

    this.mountExistingMapEditorIntoTab();
  }

  bindEvents() {
    window.addEventListener("keydown", this.handleKeyDown);

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

    this.state.selectedFrameId = frames[0]?.id ?? "";
    this.state.selectedPilotId = pilots[0]?.id ?? "";
    this.state.selectedSpawnId = spawnPoints[0]?.id ?? "";
    this.state.selectedControlType = "PC";
    this.state.selectedTeam = "player";

    if (this.state.selectedFrameId) this.frameSelectEl.value = this.state.selectedFrameId;
    if (this.state.selectedPilotId) this.pilotSelectEl.value = this.state.selectedPilotId;
    if (this.state.selectedSpawnId) this.spawnSelectEl.value = this.state.selectedSpawnId;
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
  }

  toggle(force) {
    const nextState = typeof force === "boolean" ? force : !this.state.isOpen;

    this.state.isOpen = nextState;
    this.panelEl.style.display = nextState ? "block" : "none";

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
    this.appState.mechs = this.appState.units;
  }

  syncActiveUnitAfterMutation(preferredInstanceId = null) {
    const units = this.getRuntimeUnits();

    if (units.length === 0) {
      this.appState.turn.activeUnitId = null;
      this.appState.turn.activeMechId = null;
      this.appState.selection.unitId = null;
      this.appState.selection.mechId = null;
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
    this.appState.turn.activeMechId = preferred.instanceId;
    this.appState.selection.unitId = preferred.instanceId;
    this.appState.selection.mechId = preferred.instanceId;
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
    this.appState.mechs = this.appState.units;

    this.appState.turn.moveOrder = this.appState.turn.moveOrder.filter(
      (id) => id !== instanceId
    );
    this.appState.turn.actionOrder = this.appState.turn.actionOrder.filter(
      (id) => id !== instanceId
    );

    if (this.appState.turn.activeUnitId === instanceId) {
      this.appState.turn.activeUnitId = null;
      this.appState.turn.activeMechId = null;
    }

    logDev(`${unit.name} / ${unit.pilotName ?? "No Pilot"} removed from map.`);

    if (this.getRuntimeUnits().length === 0) {
      this.appState.turn.activeUnitId = null;
      this.appState.turn.activeMechId = null;
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
      this.appState.selection.mechId = null;
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
    this.appState.mechs = this.appState.units;

    this.appState.turn.activeUnitId = null;
    this.appState.turn.activeMechId = null;
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
    this.appState.selection.mechId = null;
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

  render() {
    this.renderRuntimeState();
    this.renderRoundPhase();
    this.renderPhaseOrder();
    this.renderUnits();
    this.renderMapState();
    this.renderLog();
    this.setActiveTab(this.state.activeTab);
  }

  renderRuntimeState() {
    const units = this.getRuntimeUnits();
    const activeUnitId = this.appState?.turn?.activeUnitId ?? null;
    const selectedUnitId = this.appState?.selection?.unitId ?? null;

    const activeUnit = units.find((unit) => unit.instanceId === activeUnitId) ?? null;
    const selectedUnit = units.find((unit) => unit.instanceId === selectedUnitId) ?? null;

    const activeText = activeUnit
      ? `${activeUnit.name} / ${activeUnit.pilotName ?? "No Pilot"}`
      : "None";

    const selectedText = selectedUnit
      ? `${selectedUnit.name} / ${selectedUnit.pilotName ?? "No Pilot"}`
      : "None";

    const focus = this.appState?.focus ?? {};
    const commandMenu = this.appState?.ui?.commandMenu ?? {};
    const actionProfile = this.appState?.ui?.action?.selectedAction ?? null;

    this.runtimeStateEl.innerHTML = `
      <div>Units: <strong>${units.length}</strong></div>
      <div>Mode: <strong>${safeUpper(this.appState?.ui?.mode ?? "idle")}</strong></div>
      <div>Active Unit: <strong>${activeText}</strong></div>
      <div>Selected Unit: <strong>${selectedText}</strong></div>
      <div>Focus: <strong>(${focus.x ?? 0},${focus.y ?? 0})</strong> [${focus.scale ?? "-"}]</div>
      <div>Selection Action: <strong>${this.appState?.selection?.action ?? "-"}</strong></div>
      <div>Action Profile: <strong>${actionProfile?.name ?? actionProfile?.id ?? "-"}</strong></div>
      <div>Command Menu: <strong>${commandMenu.open ? "OPEN" : "CLOSED"}</strong></div>
      <div>View: <strong>${this.getViewLabel()}</strong></div>
      <div>Rotation: <strong>${this.getRotationValue()}</strong></div>
    `;
  }

  renderRoundPhase() {
    this.roundPhaseEl.innerHTML = `
      <div>Round: <strong>${this.appState.turn.round}</strong></div>
      <div>Phase: <strong>${safeUpper(this.appState.turn.phase)}</strong></div>
      <div>Combat Started: <strong>${this.appState.turn.combatStarted ? "YES" : "NO"}</strong></div>
      <div>Move Index: <strong>${this.appState.turn.moveIndex}</strong></div>
      <div>Action Index: <strong>${this.appState.turn.actionIndex}</strong></div>
    `;
  }

  renderPhaseOrder() {
    const units = this.getRuntimeUnits();

    if (!units.length) {
      this.phaseOrderEl.innerHTML = `<div style="opacity:0.7;">No units on map.</div>`;
      return;
    }

    const moveOrder = Array.isArray(this.appState.turn.moveOrder)
      ? this.appState.turn.moveOrder
      : [];
    const actionOrder = Array.isArray(this.appState.turn.actionOrder)
      ? this.appState.turn.actionOrder
      : [];

    const resolveRow = (label, order, currentIndex, isCurrentPhase) => {
      const orderedUnits = order
        .map((instanceId) => units.find((unit) => unit.instanceId === instanceId))
        .filter(Boolean);

      if (!orderedUnits.length) {
        return `
          <div style="margin-bottom:8px;">
            <div style="font-weight:700; margin-bottom:4px;">${label}</div>
            <div style="opacity:0.7;">No order built.</div>
          </div>
        `;
      }

      return `
        <div style="margin-bottom:8px;">
          <div style="font-weight:700; margin-bottom:4px;">
            ${label} ${isCurrentPhase ? "(current)" : ""}
          </div>
          ${orderedUnits.map((unit, index) => {
            const isActive = isCurrentPhase && index === currentIndex;
            const isComplete = isCurrentPhase && index < currentIndex;

            return `
              <div style="
                padding:4px 0;
                border-bottom:1px solid rgba(255,255,255,0.06);
                opacity:${isComplete ? "0.45" : isCurrentPhase ? "1" : "0.7"};
                color:${isActive ? "#f0b000" : "inherit"};
              ">
                ${index + 1}. ${unit.name} / ${unit.pilotName ?? "No Pilot"}
                <span style="opacity:0.7;">(Init ${unit.initiative ?? "-"})</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    };

    this.phaseOrderEl.innerHTML = `
      ${resolveRow(
        "Move",
        moveOrder,
        this.appState.turn.moveIndex,
        this.appState.turn.phase === "move"
      )}
      ${resolveRow(
        "Action",
        actionOrder,
        this.appState.turn.actionIndex,
        this.appState.turn.phase === "action"
      )}
    `;
  }

  renderUnits() {
    const units = this.getRuntimeUnits();

    if (!units.length) {
      this.unitListEl.innerHTML = `<div style="opacity:0.7;">No units on map.</div>`;
      return;
    }

    const activeUnitId = this.appState?.turn?.activeUnitId ?? null;
    const selectedUnitId = this.appState?.selection?.unitId ?? null;

    this.unitListEl.innerHTML = units
      .map((unit) => {
        const { frame, pilot } = getUnitDisplayName(unit);
        const scale = getUnitScale(unit);
        const footprint = getUnitFootprintLabel(unit);
        const isActive = unit.instanceId === activeUnitId;
        const isSelected = unit.instanceId === selectedUnitId;

        return `
          <div
            data-instance-id="${unit.instanceId}"
            style="
              padding:8px;
              margin-bottom:8px;
              border:1px solid ${isActive ? "rgba(240,176,0,0.7)" : "rgba(255,255,255,0.08)"};
              background:${isSelected ? "rgba(255,255,255,0.04)" : "transparent"};
            "
          >
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
              <div>
                <div><strong>${frame}</strong></div>
                <div style="opacity:0.78;">Pilot: ${pilot}</div>
              </div>
              <div style="text-align:right;">
                <div style="color:${isActive ? "#f0b000" : "#9fb3c8"};">${isActive ? "ACTIVE" : isSelected ? "SELECTED" : scale.toUpperCase()}</div>
                <div style="opacity:0.65;">${footprint}</div>
              </div>
            </div>

            <div style="opacity:0.8;">Team ${unit.team ?? "-"} | Control ${unit.controlType ?? "-"} | Spawn ${unit.spawnId ?? "-"}</div>
            <div style="opacity:0.8;">Pos (${unit.x},${unit.y}) | Facing ${unit.facing ?? 0} | Scale ${scale}</div>
            <div style="opacity:0.8;">Shield ${unit.shield ?? unit.armor ?? "-"} | Core ${unit.core ?? unit.structure ?? "-"} | Move ${unit.move ?? "-"}</div>
            <div style="opacity:0.8;">Reaction ${unit.reaction ?? "-"} | Targeting ${unit.targeting ?? "-"}</div>
            <div style="opacity:0.8;">Init ${unit.initiative ?? "-"} | Status ${unit.status ?? "operational"}</div>
            <div style="opacity:0.8;">Moved ${unit.hasMoved ? "Y" : "N"} | Acted ${unit.hasActed ? "Y" : "N"} | Braced ${unit.isBraced ? "Y" : "N"}</div>

            <div style="margin-top:6px;">
              <button type="button" class="ac-dev-remove-unit-btn">Remove</button>
            </div>
          </div>
        `;
      })
      .join("");

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

    this.mapStateEl.innerHTML = `
      <div>View: <strong>${this.getViewLabel()}</strong></div>
      <div>Rotation: <strong>${this.getRotationValue()}</strong></div>
      <div>Focus Tile: <strong>(${focus.x ?? 0},${focus.y ?? 0})</strong></div>
      <div>Focus Scale: <strong>${focus.scale ?? "-"}</strong></div>
      <div>Selected Unit: <strong>${selectedUnit ? `${selectedUnit.name} / ${selectedUnit.pilotName ?? "No Pilot"}` : "None"}</strong></div>
    `;
  }

  renderLog() {
    const entries = getDevLogFormatted();

    if (!entries.length) {
      this.logListEl.innerHTML = `<div style="opacity:0.7;">No log entries.</div>`;
      return;
    }

    this.logListEl.innerHTML = entries
      .map(
        (entry) => `
          <div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06); word-break:break-word;">
            ${entry}
          </div>
        `
      )
      .join("");
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
