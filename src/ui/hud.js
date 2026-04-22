// src/ui/hud.js

import { getTile, tileTypeFromElevation } from "../map.js";
import { getUnitAt, getUnitById } from "../mechs.js";
import { getSelectedAbilityMenuItems, getSelectedAttackMenuItems, isCommandMenuItemDisabled } from "../action.js";
import { getLineOfSightResult } from "../los.js";
import { getActiveActor, getActiveBody, getEmbarkedPilotForMech } from "../actors/actorResolver.js";

/* =========================
   INPUT
========================= */

export function bindHudInput(state, refs, actions) {
  refs.hudRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-hud-action]");
    if (!button || button.disabled) return;

    const action = button.dataset.hudAction;

    switch (action) {
      case "open-menu":
        actions.openCommandMenu();
        break;
      case "move":
        actions.startMove();
        break;
      case "brace":
        actions.waitTurn();
        break;
      case "attack":
        actions.startAttack();
        break;
      case "ability":
        actions.startAbility?.();
        break;
      case "confirm":
        actions.confirmAction();
        break;
      case "cancel":
        actions.cancelAction();
        break;
      case "start-combat":
        actions.startCombat();
        break;
      case "restart-mission":
        actions.resetMap();
        break;
      case "menu-select":
        actions.selectMenuAction(button.dataset.menuAction);
        break;
    }
  });
}

/* =========================
   MAIN RENDER
========================= */

export function renderHud(state, refs) {
  refs.hudLeft.innerHTML = renderActivePanel(state);
  refs.hudCenter.innerHTML = renderCenterPanel(state);
  refs.hudRight.innerHTML = renderContextPanel(state);
}

/* =========================
   LEFT PANEL (ACTIVE UNIT)
========================= */

function renderActivePanel(state) {
  const activeBody = getActiveBody(state);
  const activeActor = getActiveActor(state);

  if (!activeBody) {
    return `
      <div class="hud-section-title">Unit</div>
      <div class="hud-mini-card">No Active Unit</div>
    `;
  }

  const mech = activeBody.unitType === "mech" ? activeBody : null;
  const pilot = activeActor?.unitType === "pilot"
    ? activeActor
    : mech
      ? getEmbarkedPilotForMech(state, mech)
      : null;

  const name = activeBody.name;
  const sublineParts = [activeBody.team];
  if (activeActor?.embarked && mech && pilot) {
    sublineParts.unshift(`Pilot: ${pilot.name}`);
  }

  const bodyStats = activeBody.unitType === "mech"
    ? `
      <div class="hud-mini-card" style="margin-bottom:8px;">
        <div style="font-size:11px; opacity:.7; margin-bottom:4px;">Mech</div>
        <div class="hud-stat-row">
          ${stat("SHD", `${activeBody.shield}/${activeBody.maxShield}`)}
          ${stat("CORE", `${activeBody.core}/${activeBody.maxCore}`)}
          ${stat("REACT", activeBody.reaction)}
          ${stat("TARG", activeBody.targeting)}
        </div>
        <div class="hud-stat-row">
          ${stat("MV", activeBody.move)}
          ${stat("INIT", activeBody.initiative ?? "-")}
          ${stat("F", facingLabel(activeBody.facing))}
          ${stat("STAT", activeBody.status ?? "-")}
        </div>
      </div>
    `
    : `
      <div class="hud-mini-card" style="margin-bottom:8px;">
        <div style="font-size:11px; opacity:.7; margin-bottom:4px;">Pilot</div>
        <div class="hud-stat-row">
          ${stat("SHD", `${activeBody.shield}/${activeBody.maxShield}`)}
          ${stat("CORE", `${activeBody.core}/${activeBody.maxCore}`)}
          ${stat("REACT", activeBody.reaction)}
          ${stat("TARG", activeBody.targeting)}
        </div>
        <div class="hud-stat-row">
          ${stat("MV", activeBody.move)}
          ${stat("INIT", activeBody.initiative ?? "-")}
          ${stat("F", facingLabel(activeBody.facing))}
          ${stat("STAT", activeBody.status ?? "-")}
        </div>
      </div>
    `;

  const pilotStats = mech && pilot
    ? `
      <div class="hud-mini-card">
        <div style="font-size:11px; opacity:.7; margin-bottom:4px;">Embarked Pilot</div>
        <div class="hud-stat-row">
          ${stat("SHD", `${pilot.shield}/${pilot.maxShield}`)}
          ${stat("CORE", `${pilot.core}/${pilot.maxCore}`)}
          ${stat("REACT", pilot.reaction)}
          ${stat("TARG", pilot.targeting)}
        </div>
        <div class="hud-stat-row">
          ${stat("MV", pilot.move)}
          ${stat("INIT", pilot.initiative ?? "-")}
          ${stat("F", facingLabel(pilot.facing))}
          ${stat("STAT", pilot.status ?? "-")}
        </div>
      </div>
    `
    : "";

  return `
    <div class="hud-section-title">Unit</div>

    <div class="hud-unit-row">
      <div>
        <div class="hud-unit-name">${name}</div>
        <div class="hud-subline">${sublineParts.join(" · ")}</div>
      </div>
      <div class="hud-tag">ACTIVE</div>
    </div>

    ${bodyStats}
    ${pilotStats}
  `;
}

/* =========================
   CENTER PANEL (FLOW)
========================= */

function renderCenterPanel(state) {
  if (!state.turn.combatStarted) {
    return `
      <div class="hud-section-title">Combat</div>

      <div class="hud-mode-box">
        <div class="hud-mode-title">Ready</div>
        <div class="hud-mode-text">Start combat to begin initiative</div>
      </div>

      <button class="hud-command-button" data-hud-action="start-combat">
        Start Combat
      </button>
    `;
  }

  const summary = renderTurnSummary(state);

  if (state.ui.mode === "idle" && state.ui.commandMenu.open) {
    return `
      ${summary}
      ${renderCommandMenu(state)}
    `;
  }

  if (state.ui.mode === "action-ability-select") {
    return `
      ${summary}
      ${renderAbilityMenu(state)}
    `;
  }

  if (state.ui.mode === "action-attack-select") {
    return `
      ${summary}
      ${renderAttackMenu(state)}
    `;
  }


  if (state.ui.mode === "action-target") {
    return `
      ${summary}
      ${renderTargeting(state)}
    `;
  }

  if (state.ui.mode === "move") {
    return `
      ${summary}
      ${renderMove(state)}
    `;
  }

  if (state.ui.mode === "face") {
    return `
      ${summary}
      ${renderFacing(state)}
    `;
  }

  return `
    ${summary}

    <div class="hud-section-title">Command</div>

    <div class="hud-mode-box">
      <div class="hud-mode-title">Awaiting Command</div>
      <div class="hud-mode-text">Press Enter</div>
    </div>

    <button class="hud-command-button" data-hud-action="open-menu">
      Open Menu
    </button>
  `;
}

/* =========================
   TURN SUMMARY (CORE FIX)
========================= */

function renderTurnSummary(state) {
  const isMove = state.turn.phase === "move";
  const order = isMove ? state.turn.moveOrder : state.turn.actionOrder;
  const index = isMove ? state.turn.moveIndex : state.turn.actionIndex;

  return `
    <div class="hud-mode-box" style="margin-bottom:8px;">
      <div class="hud-mode-title">
        ROUND ${state.turn.round} — ${state.turn.phase.toUpperCase()}
      </div>
    </div>

    <div class="hud-mini-card" style="margin-bottom:8px;">
      <div style="font-size:11px; opacity:.7; margin-bottom:4px;">
        ${isMove ? "Move Order" : "Action Order"}
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${order.map((id, i) => {
          const unit = getUnitById(state.units, id);
          if (!unit) return "";

          const isActive = i === index;
          const isDone = i < index;

          return `
            <div style="
              padding:4px 8px;
              border-radius:6px;
              font-size:11px;
              font-weight:700;
              border:1px solid rgba(255,255,255,0.1);
              background:${isActive ? "rgba(240,176,0,.25)" : "rgba(255,255,255,.05)"};
              color:${isActive ? "#f0b000" : "#ddd"};
              opacity:${isDone ? .4 : 1};
            ">
              ${unit.name}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

/* =========================
   RIGHT PANEL (TARGET/TILE)
========================= */

function renderContextPanel(state) {
  const tile = getTile(state.map, state.focus.x, state.focus.y);
  const focusedUnit = getUnitAt(state.units, state.focus.x, state.focus.y);
  const activeBody = getActiveBody(state);

  if (focusedUnit && focusedUnit.instanceId !== activeBody?.instanceId) {
    const targetPilot = focusedUnit.unitType === "mech"
      ? getEmbarkedPilotForMech(state, focusedUnit)
      : null;

    return `
      <div class="hud-section-title">Target</div>

      <div class="hud-mini-card">
        <div>${focusedUnit.name}</div>
        <div style="opacity:.7;">${focusedUnit.team}</div>
      </div>

      <div class="hud-stat-row">
        ${stat("SHD", focusedUnit.shield)}
        ${stat("CORE", focusedUnit.core)}
        ${stat("REACT", focusedUnit.reaction)}
        ${stat("TARG", focusedUnit.targeting)}
      </div>

      ${targetPilot ? `
        <div class="hud-mini-card" style="margin-top:8px;">
          <div style="font-size:11px; opacity:.7; margin-bottom:4px;">Embarked Pilot</div>
          <div class="hud-stat-row">
            ${stat("PSHD", targetPilot.shield)}
            ${stat("PCORE", targetPilot.core)}
            ${stat("STAT", targetPilot.status ?? "-")}
            ${stat("INIT", targetPilot.initiative ?? "-")}
          </div>
        </div>
      ` : ""}
    `;
  }

  const elev = tile?.elevation ?? 0;

  let los = "-";
  if (activeBody) {
    const result = getLineOfSightResult(
      state,
      activeBody.x,
      activeBody.y,
      state.focus.x,
      state.focus.y
    );

    los = result.visible
      ? result.cover === "half"
        ? "Half"
        : "Clear"
      : "Blocked";
  }

  return `
    <div class="hud-section-title">Tile</div>

    <div class="hud-mini-card">
      (${state.focus.x}, ${state.focus.y})
    </div>

    <div class="hud-stat-row">
      ${stat("ELEV", elev)}
      ${stat("LOS", los)}
      ${stat("ROUND", state.turn.round)}
      ${stat("PHASE", state.turn.phase)}
    </div>
  `;
}

/* =========================
   SUB VIEWS
========================= */

function renderCommandMenu(state) {
  const menu = state.ui.commandMenu;

  return `
    <div class="hud-section-title">Command</div>

    ${menu.items.map((item, i) => {
      const isDisabled = isCommandMenuItemDisabled(state, item);
      return `
      <button 
        class="hud-menu-button ${i === menu.index ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}" 
        data-hud-action="menu-select"
        data-menu-action="${item}"
        ${isDisabled ? "disabled" : ""}>
        ${i === menu.index ? "▶ " : ""}${item}
      </button>
    `;
    }).join("")}
  `;
}

function renderAbilityMenu(state) {
  const items = getSelectedAbilityMenuItems(state);

  return `
    <div class="hud-section-title">Ability</div>

    ${items.map((a, i) => {
      const isSelected = i === state.ui.action.menuIndex;
      const isDisabled = a.enabled === false;
      return `
        <button
          class="hud-menu-button ${isSelected ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}"
          ${isDisabled ? "disabled" : ""}
        >
          ${isSelected ? "▶ " : ""}${a.label}
        </button>
      `;
    }).join("")}
  `;
}

function renderAttackMenu(state) {
  const items = getSelectedAttackMenuItems(state);

  return `
    <div class="hud-section-title">Attack</div>

    ${items.map((a, i) => `
      <button class="hud-menu-button ${i === state.ui.action.menuIndex ? "is-selected" : ""}">
        ${i === state.ui.action.menuIndex ? "▶ " : ""}${a.label}
      </button>
    `).join("")}
  `;
}

function renderTargeting() {
  return `
    <div class="hud-section-title">Targeting</div>
    <div class="hud-mode-box">Select target</div>
  `;
}

function renderMove() {
  return `
    <div class="hud-section-title">Move</div>
    <div class="hud-mode-box">Select tile</div>
  `;
}

function renderFacing() {
  return `
    <div class="hud-section-title">Facing</div>
    <div class="hud-mode-box">Choose direction</div>
  `;
}

/* =========================
   HELPERS
========================= */

function stat(label, value) {
  return `
    <div class="hud-inline-stat">
      <div class="hud-inline-stat-label">${label}</div>
      <div class="hud-inline-stat-value">${value}</div>
    </div>
  `;
}

function facingLabel(f) {
  return ["N", "E", "S", "W"][f] ?? "?";
}
