// dev/devMenu.js
//
// Dev menu for the live Ars Caelorum app.
// This version is built to fit the CURRENT app structure.
//
// Source of truth:
// - state.mechs
// - state.content
//
// It does NOT fetch content itself.
// It does NOT keep a fake parallel runtime unit list.
//
// Toggle key: `

import { createMechInstance } from "../src/mechs.js";
import {
  logDev,
  clearDevLog,
  getDevLogFormatted,
  subscribeToDevLog
} from "./devLogger.js";

const DEFAULT_DEV_STATE = {
  isOpen: false,
  selectedMechId: "",
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

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function sortMovePhaseOrder(units) {
  return [...units].sort((a, b) => {
    const aInit = a.initiative ?? -999;
    const bInit = b.initiative ?? -999;

    if (aInit !== bInit) {
      return aInit - bInit;
    }

    return String(a.instanceId).localeCompare(String(b.instanceId));
  });
}

function sortActionPhaseOrder(units) {
  return [...units].sort((a, b) => {
    const aInit = a.initiative ?? -999;
    const bInit = b.initiative ?? -999;

    if (aInit !== bInit) {
      return bInit - aInit;
    }

    return String(a.instanceId).localeCompare(String(b.instanceId));
  });
}

class DevMenu {
  constructor() {
    this.state = clone(DEFAULT_DEV_STATE);

    this.appState = null;
    this.renderApp = null;

    this.rootEl = null;
    this.panelEl = null;
    this.logListEl = null;
    this.unitListEl = null;
    this.phaseOrderEl = null;
    this.roundPhaseEl = null;

    this.mechSelectEl = null;
    this.pilotSelectEl = null;
    this.spawnSelectEl = null;
    this.controlSelectEl = null;
    this.teamSelectEl = null;

    this.initialized = false;
    this.unsubscribeLog = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init({ state, render }) {
    if (this.initialized) return this;

    if (!state) {
      throw new Error("DevMenu.init requires app state.");
    }

    if (typeof render !== "function") {
      throw new Error("DevMenu.init requires a render function.");
    }

    this.appState = state;
    this.renderApp = render;

    this.buildDom();
    this.bindEvents();
    this.populateSelectors();
    this.render();

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

    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }

    this.rootEl = null;
    this.panelEl = null;
    this.logListEl = null;
    this.unitListEl = null;
    this.phaseOrderEl = null;
    this.roundPhaseEl = null;
    this.initialized = false;
  }

  getContent() {
    return this.appState?.content ?? {};
  }

  getMechDefinitions() {
    return Array.isArray(this.getContent().mechs) ? this.getContent().mechs : [];
  }

  getPilotDefinitions() {
    return Array.isArray(this.getContent().pilots) ? this.getContent().pilots : [];
  }

  getSpawnPoints() {
    return Array.isArray(this.getContent().spawnPoints) ? this.getContent().spawnPoints : [];
  }

  getRuntimeUnits() {
    return Array.isArray(this.appState?.mechs) ? this.appState.mechs : [];
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
    panel.style.width = "360px";
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

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:14px; font-weight:bold;">DEV MENU</div>
        <button id="ac-dev-close-btn" type="button">Close</button>
      </div>

      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Spawn Unit</div>

        <label style="display:block; margin-bottom:6px;">
          <div>Mech</div>
          <select id="ac-dev-mech-select" style="width:100%;"></select>
        </label>

        <label style="display:block; margin-bottom:6px;">
          <div>Pilot</div>
          <select id="ac-dev-pilot-select" style="width:100%;"></select>
        </label>

        <label style="display:block; margin-bottom:6px;">
          <div>Spawn</div>
          <select id="ac-dev-spawn-select" style="width:100%;"></select>
        </label>

        <label style="display:block; margin-bottom:6px;">
          <div>Control Type</div>
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
          <button id="ac-dev-spawn-btn" type="button">Spawn / Replace</button>
          <button id="ac-dev-reset-btn" type="button">Reset Units</button>
          <button id="ac-dev-reroll-btn" type="button">Reroll Initiative</button>
          <button id="ac-dev-clearlog-btn" type="button">Clear Log</button>
        </div>
      </div>

      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Combat State</div>
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
    `;

    root.appendChild(panel);
    document.body.appendChild(root);

    this.rootEl = root;
    this.panelEl = panel;
    this.logListEl = panel.querySelector("#ac-dev-log-list");
    this.unitListEl = panel.querySelector("#ac-dev-unit-list");
    this.phaseOrderEl = panel.querySelector("#ac-dev-phase-order");
    this.roundPhaseEl = panel.querySelector("#ac-dev-round-phase");

    this.mechSelectEl = panel.querySelector("#ac-dev-mech-select");
    this.pilotSelectEl = panel.querySelector("#ac-dev-pilot-select");
    this.spawnSelectEl = panel.querySelector("#ac-dev-spawn-select");
    this.controlSelectEl = panel.querySelector("#ac-dev-control-select");
    this.teamSelectEl = panel.querySelector("#ac-dev-team-select");
  }

  bindEvents() {
    window.addEventListener("keydown", this.handleKeyDown);

    this.panelEl.querySelector("#ac-dev-close-btn").addEventListener("click", () => {
      this.toggle(false);
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

    this.mechSelectEl.addEventListener("change", (event) => {
      this.state.selectedMechId = event.target.value;
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
    const mechs = this.getMechDefinitions();
    const pilots = this.getPilotDefinitions();
    const spawnPoints = this.getSpawnPoints();

    this.mechSelectEl.innerHTML = mechs
      .map(
        (mech) =>
          `<option value="${mech.id}">${mech.name} [${mech.variant ?? ""}]</option>`
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

    this.state.selectedMechId = mechs[0]?.id ?? "";
    this.state.selectedPilotId = pilots[0]?.id ?? "";
    this.state.selectedSpawnId = spawnPoints[0]?.id ?? "";
    this.state.selectedControlType = "PC";
    this.state.selectedTeam = "player";

    if (this.state.selectedMechId) this.mechSelectEl.value = this.state.selectedMechId;
    if (this.state.selectedPilotId) this.pilotSelectEl.value = this.state.selectedPilotId;
    if (this.state.selectedSpawnId) this.spawnSelectEl.value = this.state.selectedSpawnId;
    this.controlSelectEl.value = this.state.selectedControlType;
    this.teamSelectEl.value = this.state.selectedTeam;
  }

  toggle(force) {
    const nextState =
      typeof force === "boolean" ? force : !this.state.isOpen;

    this.state.isOpen = nextState;
    this.panelEl.style.display = nextState ? "block" : "none";
    this.render();

    logDev(`Dev menu ${nextState ? "opened" : "closed"}.`);
  }

  getMechDefinitionById(id) {
    return this.getMechDefinitions().find((mech) => mech.id === id) ?? null;
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
    this.appState.mechs = [
      ...this.getRuntimeUnits().filter((unit) => unit.spawnId !== newUnit.spawnId),
      newUnit
    ];
  }

  syncActiveMechAfterMutation(preferredInstanceId = null) {
    const mechs = this.getRuntimeUnits();

    if (mechs.length === 0) {
      this.appState.turn.activeMechId = null;
      this.appState.selection.mechId = null;
      this.appState.focus.x = 0;
      this.appState.focus.y = 0;
      return;
    }

    const preferred =
      mechs.find((mech) => mech.instanceId === preferredInstanceId) ??
      mechs.find((mech) => mech.instanceId === this.appState.turn.activeMechId) ??
      mechs[0];

    this.appState.turn.activeMechId = preferred.instanceId;
    this.appState.selection.mechId = preferred.instanceId;
    this.appState.focus.x = preferred.x;
    this.appState.focus.y = preferred.y;
  }

  spawnSelectedUnit() {
    const mechDef = this.getMechDefinitionById(this.state.selectedMechId);
    const pilotDef = this.getPilotDefinitionById(this.state.selectedPilotId);
    const spawn = this.getSpawnPointById(this.state.selectedSpawnId);

    if (!mechDef) {
      logDev("Spawn failed: selected mech definition not found.");
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

    const newUnit = createMechInstance(mechDef, {
      instanceId: nextDevUnitId(),
      x: spawn.x,
      y: spawn.y,
      facing: mechDef.defaultFacing
    });

    // attach pilot/runtime metadata without breaking current app expectations
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
    this.syncActiveMechAfterMutation(newUnit.instanceId);

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

  removeUnit(instanceId) {
    const unit = this.getRuntimeUnits().find((entry) => entry.instanceId === instanceId);
    if (!unit) return;

    this.appState.mechs = this.getRuntimeUnits().filter(
      (entry) => entry.instanceId !== instanceId
    );

    logDev(`${unit.name} / ${unit.pilotName ?? "No Pilot"} removed from map.`);

    this.syncActiveMechAfterMutation();
    this.render();
    this.renderApp();
  }

  resetUnits() {
    this.appState.mechs = [];
    this.appState.turn.round = 1;
    this.appState.turn.phase = "move";
    this.appState.ui.mode = "idle";
    this.appState.ui.previewPath = [];
    this.appState.ui.facingPreview = null;
    this.appState.ui.preMove = null;
    this.appState.ui.commandMenu.open = false;
    this.appState.ui.commandMenu.index = 0;

    this.syncActiveMechAfterMutation();

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

    for (const unit of units) {
      unit.hasMoved = false;
      unit.hasActed = false;
      unit.isBraced = false;
      unit.initiative = rollD6() + rollD6() + (unit.reaction ?? 0);
    }

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
    this.renderRoundPhase();
    this.renderPhaseOrder();
    this.renderUnits();
    this.renderLog();
  }

  renderRoundPhase() {
    this.roundPhaseEl.innerHTML = `
      <div>Round: <strong>${this.appState.turn.round}</strong></div>
      <div>Phase: <strong>${String(this.appState.turn.phase).toUpperCase()}</strong></div>
    `;
  }

  renderPhaseOrder() {
    const units = this.getRuntimeUnits();

    if (!units.length) {
      this.phaseOrderEl.innerHTML = `<div style="opacity:0.7;">No units on map.</div>`;
      return;
    }

    const currentPhase = this.appState.turn.phase;
    const ordered =
      currentPhase === "action"
        ? sortActionPhaseOrder(units)
        : sortMovePhaseOrder(units);

    this.phaseOrderEl.innerHTML = ordered
      .map(
        (unit, index) => `
          <div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
            ${index + 1}. ${unit.name} / ${unit.pilotName ?? "No Pilot"}
            <span style="opacity:0.7;">| Init ${unit.initiative ?? "-"}</span>
            <span style="opacity:0.7;">| ${unit.team ?? "-"}</span>
            <span style="opacity:0.7;">| ${unit.controlType ?? "-"}</span>
          </div>
        `
      )
      .join("");
  }

  renderUnits() {
    const units = this.getRuntimeUnits();

    if (!units.length) {
      this.unitListEl.innerHTML = `<div style="opacity:0.7;">No units on map.</div>`;
      return;
    }

    this.unitListEl.innerHTML = units
      .map(
        (unit) => `
          <div data-instance-id="${unit.instanceId}" style="padding:8px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.08);">
            <div><strong>${unit.name}</strong> / ${unit.pilotName ?? "No Pilot"}</div>
            <div style="opacity:0.8;">${unit.team ?? "-"} | ${unit.controlType ?? "-"} | ${unit.spawnId ?? "-"}</div>
            <div style="opacity:0.8;">Pos (${unit.x},${unit.y}) | Facing ${unit.facing}</div>
            <div style="opacity:0.8;">ARM ${unit.armor} | STR ${unit.structure} | MV ${unit.move}</div>
            <div style="opacity:0.8;">Reaction ${unit.reaction ?? "-"} | Targeting ${unit.targeting ?? "-"}</div>
            <div style="opacity:0.8;">Init ${unit.initiative ?? "-"}</div>
            <div style="margin-top:6px;">
              <button type="button" class="ac-dev-remove-unit-btn">Remove</button>
            </div>
          </div>
        `
      )
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

export function initializeDevMenu({ state, render }) {
  return devMenu.init({ state, render });
}

export function toggleDevMenu(force) {
  devMenu.toggle(force);
}
