// src/ui/hud.js

import { getTile, tileTypeFromElevation } from "../map.js";
import { getUnitAt, getUnitById } from "../mechs.js";
import { getSelectedAbilityMenuItems, getSelectedAttackMenuItems, getSelectedItemMenuItems, isCommandMenuItemDisabled } from "../action.js";
import { getLineOfSightResult } from "../los.js";
import { getActiveActor, getActiveBody, getEmbarkedPilotForMech } from "../actors/actorResolver.js";
import { getDeploymentAvailableRoster, getDeploymentPlacedUnitAt, getDeploymentPlacementCount, getDeploymentReady, isDeploymentActive, isDeploymentMenuFocused } from "../deployment/deploymentState.js";
import { getMissionObjectiveStatus } from "../mission/missionObjectives.js";
import { isStoryMode } from "../mode/mapMode.js";

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
      case "item":
        actions.startItem?.();
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
      case "story-interact":
        actions.storyInteract?.();
        break;
      case "open-deployment-list":
        actions.openDeploymentList?.();
        break;
      case "confirm-deployment-placement":
        actions.confirmDeploymentPlacement?.();
        break;
      case "remove-deployment-placement":
        actions.removeDeploymentPlacement?.();
        break;
      case "restart-mission":
        actions.resetMap();
        break;
      case "advance-dialogue":
        actions.advanceDialogue?.();
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
      <div class="hud-card-title">Unit</div>
      <div class="hud-empty-state">No active unit</div>
    `;
  }

  const mech = activeBody.unitType === "mech" ? activeBody : null;
  const pilot = activeActor?.unitType === "pilot"
    ? activeActor
    : mech
      ? getEmbarkedPilotForMech(state, mech)
      : null;

  const role = activeBody.unitType === "mech" ? "Telum" : "Pilot";
  const sublineParts = [role, activeBody.team].filter(Boolean);
  const disabledMech = mech && activeBody.status === "disabled";

  const primaryStats = activeBody.unitType === "mech"
    ? [
        ["SHD", `${activeBody.shield}/${activeBody.maxShield}`],
        ["CORE", `${activeBody.core}/${activeBody.maxCore}`],
        ["MV", activeBody.move],
        ["INIT", activeBody.initiative ?? "-"],
        ["REACT", activeBody.reaction],
        ["TARG", activeBody.targeting],
        ["F", facingLabel(activeBody.facing)],
        ["STAT", activeBody.status ?? "-"]
      ]
    : [
        ["SHD", `${activeBody.shield}/${activeBody.maxShield}`],
        ["CORE", `${activeBody.core}/${activeBody.maxCore}`],
        ["MV", activeBody.move],
        ["INIT", activeBody.initiative ?? "-"],
        ["REACT", activeBody.reaction],
        ["TARG", activeBody.targeting],
        ["F", facingLabel(activeBody.facing)],
        ["STAT", activeBody.status ?? "-"]
      ];

  return `
    <div class="hud-unit-compact">
      <div class="hud-unit-head">
        <div>
          <div class="hud-card-title">${escapeHtml(role)}</div>
          <div class="hud-unit-name">${escapeHtml(activeBody.name)}</div>
          <div class="hud-subline">${escapeHtml(sublineParts.join(" · "))}</div>
        </div>
        <div class="hud-tag">ACTIVE</div>
      </div>

      <div class="hud-stat-grid hud-stat-grid--wide">
        ${primaryStats.map(([label, value]) => stat(label, value)).join("")}
      </div>

      ${mech && pilot ? `
        <div class="hud-pilot-strip ${disabledMech ? "is-warning" : ""}">
          <span class="hud-pilot-strip-name">Pilot: ${escapeHtml(pilot.name)}</span>
          <span>SHD <b>${escapeHtml(`${pilot.shield}/${pilot.maxShield}`)}</b></span>
          <span>CORE <b>${escapeHtml(`${pilot.core}/${pilot.maxCore}`)}</b></span>
        </div>
      ` : ""}
    </div>
  `;
}

/* =========================
   CENTER PANEL (FLOW)
========================= */

function renderCenterPanel(state) {
  if (!state.turn.combatStarted) {
    if (isStoryMode(state)) {
      return renderStoryModePanel(state);
    }

    if (isDeploymentActive(state)) {
      const placed = getDeploymentPlacementCount(state);
      const required = Number(state.ui.deployment.requiredCount ?? 0);
      const ready = getDeploymentReady(state);
      const listOpen = Boolean(state.ui.deployment.listOpen);
      const placedUnit = getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y);

      return `
        <div class="hud-section-title">Deployment</div>

        <div class="hud-mode-box">
          <div class="hud-mode-title">Place Units</div>
          <div class="hud-mode-text">${placed}/${required} placed · Cursor to legal cell · Enter to assign</div>
        </div>

        ${listOpen ? `
          <button class="hud-command-button compact" data-hud-action="confirm-deployment-placement">
            Confirm Unit
          </button>
        ` : placedUnit ? `
          <button class="hud-command-button compact" data-hud-action="remove-deployment-placement">
            Remove Unit
          </button>
        ` : `
          <button class="hud-command-button compact" data-hud-action="open-deployment-list">
            Open Unit List
          </button>
        `}

        <button class="hud-command-button compact ${isDeploymentMenuFocused(state) ? 'is-selected' : ''}" data-hud-action="start-combat" ${ready ? '' : 'disabled'}>
          Begin Mission
        </button>
      `;
    }

    return `
      <div class="hud-flow-head">
        <span>Combat Ready</span>
        <b>INIT OFF</b>
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

  if (state.ui.mode === "action-item-select") {
    return `
      ${summary}
      ${renderItemMenu(state)}
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

    <div class="hud-card-title">Command</div>

    <div class="hud-mode-box">
      <div class="hud-mode-title">Awaiting Command</div>
      <div class="hud-mode-text">Press Enter</div>
    </div>

    <button class="hud-command-button" data-hud-action="open-menu">
      Open Menu
    </button>
  `;
}


function renderStoryModePanel(state) {
  const objectives = renderObjectiveSummary(state);
  const activeBody = getActiveBody(state);
  const label = activeBody?.unitType === "mech" ? "Telum" : "Pilot";

  return `
    <div class="hud-flow-head">
      <span>Story Mode</span>
      <b>${escapeHtml(label)}: ${escapeHtml(activeBody?.name ?? "None")}</b>
    </div>

    ${objectives}

    <button class="hud-command-button" data-hud-action="story-interact">
      Interact
    </button>
  `;
}

/* =========================
   TURN SUMMARY (CORE FIX)
========================= */

function renderTurnSummary(state) {
  if (!state.turn.combatStarted) return "";

  const phaseLabel = state.turn.phase === "move"
    ? "Move"
    : state.turn.phase === "action"
      ? "Action"
      : "Combat";

  return `
    <div class="hud-flow-head">
      <span>Round ${escapeHtml(state.turn.round)} · ${escapeHtml(phaseLabel)}</span>
      <b>${escapeHtml(state.ui.mode ?? "idle")}</b>
    </div>

    ${renderObjectiveSummary(state)}
  `;
}

function renderObjectiveSummary(state) {
  const objectives = getMissionObjectiveStatus(state);
  if (!objectives.length) return "";

  return `
    <div class="hud-objectives-compact">
      ${objectives.map((objective) => {
        const done = objective.completed;
        const progress = objective.required > 1 ? ` ${objective.progress}/${objective.required}` : "";
        return `
          <div class="hud-objective-line ${done ? "is-done" : ""}">
            <span>${done ? "✓" : "□"} ${escapeHtml(objective.label)}</span>
            ${progress.trim() ? `<b>${escapeHtml(progress.trim())}</b>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* =========================
   RIGHT PANEL (TARGET/TILE)
========================= */

function renderContextPanel(state) {
  if (isDeploymentActive(state)) {
    return renderDeploymentPanel(state);
  }

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

      <div class="hud-stat-grid">
        ${stat("SHD", focusedUnit.shield)}
        ${stat("CORE", focusedUnit.core)}
        ${stat("REACT", focusedUnit.reaction)}
        ${stat("TARG", focusedUnit.targeting)}
      </div>

      ${targetPilot ? `
        <div class="hud-mini-card" style="margin-top:8px;">
          <div style="font-size:11px; opacity:.7; margin-bottom:4px;">Embarked Pilot</div>
          <div class="hud-stat-grid">
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

    <div class="hud-stat-grid">
      ${stat("ELEV", elev)}
      ${stat("LOS", los)}
      ${stat(isStoryMode(state) ? "MODE" : "ROUND", isStoryMode(state) ? "Story" : state.turn.round)}
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
    <div class="hud-card-title">Command</div>
    <div class="hud-menu-grid">
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
    </div>
  `;
}

function renderAbilityMenu(state) {
  const items = getSelectedAbilityMenuItems(state);

  return `
    <div class="hud-card-title">Ability</div>
    <div class="hud-menu-grid">
      ${items.map((a, i) => {
        const isSelected = i === state.ui.action.menuIndex;
        const isDisabled = a.enabled === false;
        return `
          <button
            class="hud-menu-button ${isSelected ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}"
            ${isDisabled ? "disabled" : ""}
          >
            ${isSelected ? "▶ " : ""}${escapeHtml(a.label)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderAttackMenu(state) {
  const items = getSelectedAttackMenuItems(state);

  return `
    <div class="hud-card-title">Attack</div>
    <div class="hud-menu-grid">
      ${items.map((a, i) => `
        <button class="hud-menu-button ${i === state.ui.action.menuIndex ? "is-selected" : ""}">
          ${i === state.ui.action.menuIndex ? "▶ " : ""}${escapeHtml(a.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderItemMenu(state) {
  const items = getSelectedItemMenuItems(state);

  return `
    <div class="hud-card-title">Item</div>
    <div class="hud-menu-grid">
      ${items.map((a, i) => {
        const isSelected = i === state.ui.action.menuIndex;
        const isDisabled = a.enabled === false;
        return `
          <button
            class="hud-menu-button ${isSelected ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}"
            ${isDisabled ? "disabled" : ""}
          >
            ${isSelected ? "▶ " : ""}${escapeHtml(a.label)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderTargeting() {
  return `
    <div class="hud-card-title">Targeting</div>
    <div class="hud-prompt-pill">Select target</div>
  `;
}

function renderMove() {
  return `
    <div class="hud-card-title">Move</div>
    <div class="hud-prompt-pill">Select tile</div>
  `;
}

function renderFacing() {
  return `
    <div class="hud-card-title">Facing</div>
    <div class="hud-prompt-pill">Choose direction</div>
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

function renderDeploymentPanel(state) {
  const available = getDeploymentAvailableRoster(state);
  const selectedIndex = Math.max(0, Math.min(Number(state.ui.deployment.listIndex ?? 0), Math.max(0, available.length - 1)));
  const placedUnit = getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y);

  if (state.ui.deployment.listOpen) {
    return `
      <div class="hud-section-title">Available Units</div>
      <div class="hud-mini-card" style="margin-bottom:8px;">Select ${state.ui.deployment.unitType} for (${state.focus.x}, ${state.focus.y})</div>
      ${available.length ? available.map((entry, index) => `
        <button class="hud-menu-button ${index === selectedIndex ? "is-selected" : ""}">
          ${index === selectedIndex ? "▶ " : ""}${entry.displayName ?? entry.definition?.name ?? entry.pilotDefinitionId}
        </button>
      `).join("") : `<div class="hud-mini-card">No available units.</div>`}
    `;
  }

  if (placedUnit) {
    return `
      <div class="hud-section-title">Placed Unit</div>
      <div class="hud-mini-card">
        <div>${placedUnit.name}</div>
        <div style="opacity:.7;">Press Esc to remove</div>
      </div>
      <div class="hud-stat-grid">
        ${stat("SHD", placedUnit.shield)}
        ${stat("CORE", placedUnit.core)}
        ${stat("MV", placedUnit.move)}
        ${stat("CTRL", placedUnit.controlType)}
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Deploy Tile</div>
    <div class="hud-mini-card">(${state.focus.x}, ${state.focus.y})</div>
    <div class="hud-mode-box">
      <div class="hud-mode-title">Available ${state.ui.deployment.unitType === "mech" ? "Mechs" : "Pilots"}</div>
      <div class="hud-mode-text">${available.length} remaining</div>
    </div>
  `;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
