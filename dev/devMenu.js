// dev/devMenu.js
//
// Dev menu hub for Ars Caelorum.
// This file owns:
// - dev menu open/close state
// - spawn form state
// - spawned runtime unit list
// - dev actions (spawn/remove/reroll/reset/etc.)
// - simple DOM rendering for a dev sidebar
//
// This file depends on:
// - ./dataStore.js
// - ./runtimeUnitFactory.js
// - ./devLogger.js
//
// It does NOT own:
// - core render loop
// - combat math
// - LOS logic
// - map movement rules
//
// Toggle key: `

import {
  initializeDataStore,
  getAllPilots,
  getAllMechs,
  getAllSpawnPoints
} from "./dataStore.js";

import {
  createRuntimeUnit,
  replaceUnitAtSpawn,
  removeUnitByRuntimeId,
  getUnitAtSpawn,
  resetUnitRoundFlags,
  rollAllInitiative,
  sortMovePhaseOrder,
  sortActionPhaseOrder
} from "./runtimeUnitFactory.js";

import {
  logDev,
  clearDevLog,
  getDevLogFormatted,
  subscribeToDevLog
} from "./devLogger.js";

const DEFAULT_STATE = {
  isOpen: false,
  selectedMechId: "",
  selectedPilotId: "",
  selectedSpawnId: "",
  selectedControlType: "PC",
  selectedTeam: "player",
  runtimeUnits: [],
  movePhaseOrder: [],
  actionPhaseOrder: [],
  currentPhase: "MOVE",
  round: 1
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class DevMenu {
  constructor() {
    this.state = clone(DEFAULT_STATE);

    this.rootEl = null;
    this.panelEl = null;
    this.logListEl = null;
    this.unitListEl = null;
    this.phaseOrderEl = null;

    this.mechSelectEl = null;
    this.pilotSelectEl = null;
    this.spawnSelectEl = null;
    this.controlSelectEl = null;
    this.teamSelectEl = null;

    this.initialized = false;
    this.unsubscribeLog = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  async init() {
    if (this.initialized) return this;

    await initializeDataStore();

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
    this.initialized = false;
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
        <div style="font-weight:bold; margin-bottom:8px;">Spawned Units</div>
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
      this.resetRuntimeUnits();
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
    if (event.key === "`") {
      event.preventDefault();
      this.toggle();
    }
  }

  populateSelectors() {
    const mechs = getAllMechs();
    const pilots = getAllPilots();
    const spawnPoints = getAllSpawnPoints();

    this.mechSelectEl.innerHTML = mechs
      .map(
        (mech) =>
          `<option value="${mech.id}">${mech.name} [${mech.variant}]</option>`
      )
      .join("");

    this.pilotSelectEl.innerHTML = pilots
      .map(
        (pilot) =>
          `<option value="${pilot.id}">${pilot.name} (${pilot.role})</option>`
      )
      .join("");

    this.spawnSelectEl.innerHTML = spawnPoints
      .map(
        (spawn) =>
          `<option value="${spawn.id}">${spawn.label} (${spawn.x},${spawn.y})</option>`
      )
      .join("");

    this.state.selectedMechId = mechs[0]?.id || "";
    this.state.selectedPilotId = pilots[0]?.id || "";
    this.state.selectedSpawnId = spawnPoints[0]?.id || "";
    this.state.selectedControlType = "PC";
    this.state.selectedTeam = "player";

    this.mechSelectEl.value = this.state.selectedMechId;
    this.pilotSelectEl.value = this.state.selectedPilotId;
    this.spawnSelectEl.value = this.state.selectedSpawnId;
    this.controlSelectEl.value = this.state.selectedControlType;
    this.teamSelectEl.value = this.state.selectedTeam;
  }

  toggle(force) {
    const nextState =
      typeof force === "boolean" ? force : !this.state.isOpen;

    this.state.isOpen = nextState;
    this.panelEl.style.display = nextState ? "block" : "none";

    logDev(`Dev menu ${nextState ? "opened" : "closed"}.`);
  }

  spawnSelectedUnit() {
    try {
      const existingUnit = getUnitAtSpawn(
        this.state.runtimeUnits,
        this.state.selectedSpawnId
      );

      const newUnit = createRuntimeUnit({
        mechId: this.state.selectedMechId,
        pilotId: this.state.selectedPilotId,
        spawnId: this.state.selectedSpawnId,
        controlType: this.state.selectedControlType,
        team: this.state.selectedTeam
      });

      this.state.runtimeUnits = replaceUnitAtSpawn(
        this.state.runtimeUnits,
        newUnit
      );

      if (existingUnit) {
        logDev(
          `Replaced ${existingUnit.mechName} / ${existingUnit.pilotName} at ${existingUnit.spawnId} with ${newUnit.mechName} / ${newUnit.pilotName}.`
        );
      } else {
        logDev(
          `${newUnit.mechName} / ${newUnit.pilotName} spawned at ${newUnit.spawnId} (${newUnit.x},${newUnit.y}).`
        );
      }

      this.render();
    } catch (error) {
      console.error(error);
      logDev(`Spawn failed: ${error.message}`);
    }
  }

  removeRuntimeUnit(runtimeUnitId) {
    const unit = this.state.runtimeUnits.find(
      (entry) => entry.runtimeUnitId === runtimeUnitId
    );

    this.state.runtimeUnits = removeUnitByRuntimeId(
      this.state.runtimeUnits,
      runtimeUnitId
    );

    if (unit) {
      logDev(`${unit.mechName} / ${unit.pilotName} removed from map.`);
    }

    this.refreshPhaseOrders();
    this.render();
  }

  resetRuntimeUnits() {
    this.state.runtimeUnits = [];
    this.state.movePhaseOrder = [];
    this.state.actionPhaseOrder = [];
    this.state.round = 1;
    this.state.currentPhase = "MOVE";

    logDev("All runtime units cleared.");
    this.render();
  }

  rerollInitiative() {
    if (this.state.runtimeUnits.length === 0) {
      logDev("Initiative reroll skipped: no runtime units.");
      return;
    }

    this.state.runtimeUnits = rollAllInitiative(
      this.state.runtimeUnits.map(resetUnitRoundFlags)
    );

    this.refreshPhaseOrders();

    logDev(`Initiative rerolled for Round ${this.state.round}.`);
    for (const unit of this.state.runtimeUnits) {
      logDev(
        `${unit.mechName} / ${unit.pilotName} initiative = ${unit.initiative}`
      );
    }

    this.render();
  }

  nextRound() {
    this.state.round += 1;
    this.state.currentPhase = "MOVE";

    if (this.state.runtimeUnits.length > 0) {
      this.state.runtimeUnits = rollAllInitiative(
        this.state.runtimeUnits.map(resetUnitRoundFlags)
      );
      this.refreshPhaseOrders();
    }

    logDev(`Advanced to Round ${this.state.round}.`);
    this.render();
  }

  setPhase(phaseName) {
    this.state.currentPhase = phaseName === "ACTION" ? "ACTION" : "MOVE";
    logDev(`Phase set to ${this.state.currentPhase}.`);
    this.render();
  }

  refreshPhaseOrders() {
    this.state.movePhaseOrder = sortMovePhaseOrder(this.state.runtimeUnits);
    this.state.actionPhaseOrder = sortActionPhaseOrder(this.state.runtimeUnits);
  }

  getRuntimeUnits() {
    return [...this.state.runtimeUnits];
  }

  setRuntimeUnits(units) {
    this.state.runtimeUnits = Array.isArray(units) ? [...units] : [];
    this.refreshPhaseOrders();
    this.render();
  }

  render() {
    this.refreshPhaseOrders();
    this.renderRoundPhase();
    this.renderPhaseOrder();
    this.renderUnits();
    this.renderLog();
  }

  renderRoundPhase() {
    const el = this.panelEl.querySelector("#ac-dev-round-phase");
    el.innerHTML = `
      <div>Round: <strong>${this.state.round}</strong></div>
      <div>Phase: <strong>${this.state.currentPhase}</strong></div>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        <button id="ac-dev-phase-move-btn" type="button">Set MOVE</button>
        <button id="ac-dev-phase-action-btn" type="button">Set ACTION</button>
        <button id="ac-dev-next-round-btn" type="button">Next Round</button>
      </div>
    `;

    el.querySelector("#ac-dev-phase-move-btn").addEventListener("click", () => {
      this.setPhase("MOVE");
    });

    el.querySelector("#ac-dev-phase-action-btn").addEventListener("click", () => {
      this.setPhase("ACTION");
    });

    el.querySelector("#ac-dev-next-round-btn").addEventListener("click", () => {
      this.nextRound();
    });
  }

  renderPhaseOrder() {
    const order =
      this.state.currentPhase === "ACTION"
        ? this.state.actionPhaseOrder
        : this.state.movePhaseOrder;

    if (!order.length) {
      this.phaseOrderEl.innerHTML = `<div style="opacity:0.7;">No units in phase order.</div>`;
      return;
    }

    this.phaseOrderEl.innerHTML = order
      .map(
        (unit, index) => `
          <div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
            ${index + 1}. ${unit.mechName} / ${unit.pilotName}
            <span style="opacity:0.7;">| Init ${unit.initiative ?? "-"}</span>
            <span style="opacity:0.7;">| ${unit.team}</span>
            <span style="opacity:0.7;">| ${unit.controlType}</span>
          </div>
        `
      )
      .join("");
  }

  renderUnits() {
    if (!this.state.runtimeUnits.length) {
      this.unitListEl.innerHTML = `<div style="opacity:0.7;">No units spawned.</div>`;
      return;
    }

    this.unitListEl.innerHTML = this.state.runtimeUnits
      .map(
        (unit) => `
          <div data-runtime-unit-id="${unit.runtimeUnitId}" style="padding:8px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.08);">
            <div><strong>${unit.mechName}</strong> / ${unit.pilotName}</div>
            <div style="opacity:0.8;">${unit.team} | ${unit.controlType} | ${unit.spawnId}</div>
            <div style="opacity:0.8;">Pos (${unit.x},${unit.y}) | Facing ${unit.facing}</div>
            <div style="opacity:0.8;">Core ${unit.core} | Shield ${unit.shield} | Aether ${unit.aether} | Move ${unit.move}</div>
            <div style="opacity:0.8;">Reaction ${unit.reaction} | Targeting ${unit.targeting}</div>
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
        const parent = event.target.closest("[data-runtime-unit-id]");
        const runtimeUnitId = parent?.getAttribute("data-runtime-unit-id");
        if (runtimeUnitId) {
          this.removeRuntimeUnit(runtimeUnitId);
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

export async function initializeDevMenu() {
  return devMenu.init();
}

export function toggleDevMenu(force) {
  devMenu.toggle(force);
}

export function getDevMenuRuntimeUnits() {
  return devMenu.getRuntimeUnits();
}

export function setDevMenuRuntimeUnits(units) {
  devMenu.setRuntimeUnits(units);
}
