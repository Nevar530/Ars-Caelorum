// src/ui/hud.js

import { getTile, tileTypeFromElevation } from "../map.js";
import { getUnitAt, getUnitById } from "../mechs.js";
import { getSelectedAttackMenuItems } from "../action.js";
import { getLineOfSightResult } from "../los.js";

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
      case "confirm":
        actions.confirmAction();
        break;
      case "cancel":
        actions.cancelAction();
        break;
      case "start-combat":
        actions.startCombat();
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
  const mech = getUnitById(state.units, state.turn.activeUnitId);

  if (!mech) {
    return `
      <div class="hud-section-title">Unit</div>
      <div class="hud-mini-card">No Active Unit</div>
    `;
  }

  return `
    <div class="hud-section-title">Unit</div>

    <div class="hud-unit-row">
      <div>
        <div class="hud-unit-name">${mech.name}</div>
        <div class="hud-subline">${mech.pilotName ?? "No Pilot"} · ${mech.team}</div>
      </div>
      <div class="hud-tag">ACTIVE</div>
    </div>

    <div class="hud-stat-row">
      ${stat("SHD", `${mech.shield}/${mech.maxShield}`)}
      ${stat("CORE", `${mech.core}/${mech.maxCore}`)}
      ${stat("REACT", mech.reaction)}
      ${stat("TARG", mech.targeting)}
    </div>

    <div class="hud-stat-row">
      ${stat("MV", mech.move)}
      ${stat("INIT", mech.initiative ?? "-")}
      ${stat("F", facingLabel(mech.facing))}
      ${stat("CTRL", mech.controlType)}
    </div>
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
  const mech = getUnitAt(state.units, state.focus.x, state.focus.y);
  const active = getUnitById(state.units, state.turn.activeUnitId);

  if (mech && mech.instanceId !== active?.instanceId) {
    return `
      <div class="hud-section-title">Target</div>

      <div class="hud-mini-card">
        <div>${mech.name}</div>
        <div style="opacity:.7;">${mech.pilotName}</div>
      </div>

      <div class="hud-stat-row">
        ${stat("SHD", mech.shield)}
        ${stat("CORE", mech.core)}
        ${stat("REACT", mech.reaction)}
        ${stat("TARG", mech.targeting)}
      </div>
    `;
  }

  const elev = tile?.elevation ?? 0;

  let los = "-";
  if (active) {
    const result = getLineOfSightResult(
      state,
      active.x,
      active.y,
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

    ${menu.items.map((item, i) => `
      <button 
        class="hud-menu-button ${i === menu.index ? "is-selected" : ""}" 
        data-hud-action="menu-select"
        data-menu-action="${item}">
        ${i === menu.index ? "▶ " : ""}${item}
      </button>
    `).join("")}
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
