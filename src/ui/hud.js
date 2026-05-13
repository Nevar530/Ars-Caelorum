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
      <div class="hud-readout-empty">
        <div class="hud-card-title">Unit</div>
        <div class="hud-empty-state">No active unit</div>
      </div>
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

  const stats = [
    ["MV", activeBody.move],
    ["INIT", activeBody.initiative ?? "-"],
    ["REACT", activeBody.reaction],
    ["TARG", activeBody.targeting],
    ["F", facingLabel(activeBody.facing)],
    ["STAT", activeBody.status ?? "-"]
  ];

  return `
    <div class="hud-unit-readout">
      <div class="hud-unit-topline">
        <div class="hud-unit-titleblock">
          <div class="hud-card-title">${escapeHtml(role)}</div>
          <div class="hud-unit-name-row">
            <div class="hud-unit-name-stack">
              <div class="hud-unit-name">${escapeHtml(activeBody.name)}</div>
              <div class="hud-subline">${escapeHtml(sublineParts.join(" · "))}</div>
            </div>
            <div class="hud-active-vitals">
              ${vitalBar("SHD", activeBody.shield, activeBody.maxShield, "shield")}
              ${vitalBar("CORE", activeBody.core, activeBody.maxCore, "core")}
            </div>
          </div>
        </div>
        <div class="hud-tag">ACTIVE</div>
      </div>

      <div class="hud-stat-strip">
        ${stats.map(([label, value]) => compactStat(label, value)).join("")}
      </div>

      ${mech && pilot ? `
        <div class="hud-embarked-strip ${disabledMech ? "is-warning" : ""}">
          <div class="hud-embarked-name">Pilot: ${escapeHtml(pilot.name)}</div>
          ${vitalBar("P-SHD", pilot.shield, pilot.maxShield, "shield")}
          ${vitalBar("P-CORE", pilot.core, pilot.maxCore, "core")}
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

      const objectiveHtml = `
        <div class="hud-column-title">Deployment</div>
        <div class="hud-compact-line">${placed}/${required} placed</div>
        <div class="hud-compact-line muted">Cursor to legal cell</div>
      `;

      const commandHtml = listOpen ? `
        <button class="hud-command-button compact" data-hud-action="confirm-deployment-placement">Confirm Unit</button>
      ` : placedUnit ? `
        <button class="hud-command-button compact" data-hud-action="remove-deployment-placement">Remove Unit</button>
      ` : `
        <button class="hud-command-button compact" data-hud-action="open-deployment-list">Open Unit List</button>
      `;

      return renderHudFlowGrid({
        header: "Deployment",
        status: ready ? "Ready" : "Set Units",
        objectives: objectiveHtml,
        commands: `
          ${commandHtml}
          <button class="hud-command-button compact ${isDeploymentMenuFocused(state) ? 'is-selected' : ''}" data-hud-action="start-combat" ${ready ? '' : 'disabled'}>Begin Mission</button>
        `
      });
    }

    return renderHudFlowGrid({
      header: "Combat Ready",
      status: "Init Off",
      objectives: `<div class="hud-compact-line muted">No active combat round.</div>`,
      commands: `<button class="hud-command-button" data-hud-action="start-combat">Start Combat</button>`
    });
  }

  const commandHtml = renderCombatCommandBlock(state);
  return renderHudFlowGrid({
    header: getCombatHeader(state),
    status: String(state.ui.mode ?? "idle"),
    objectives: renderObjectiveSummary(state) || `<div class="hud-compact-line muted">No objectives.</div>`,
    commands: commandHtml
  });
}

function renderCombatCommandBlock(state) {
  if (state.ui.mode === "idle" && state.ui.commandMenu.open) return renderCommandMenu(state);
  if (state.ui.mode === "action-ability-select") return renderAbilityMenu(state);
  if (state.ui.mode === "action-attack-select") return renderAttackMenu(state);
  if (state.ui.mode === "action-item-select") return renderItemMenu(state);
  if (state.ui.mode === "action-target") return renderTargeting(state);
  if (state.ui.mode === "move") return renderMove(state);
  if (state.ui.mode === "face") return renderFacing(state);

  return `
    <div class="hud-command-status">
      <div class="hud-command-label">Awaiting Command</div>
      <button class="hud-command-button" data-hud-action="open-menu">Open Menu</button>
    </div>
  `;
}

function getCombatHeader(state) {
  const phaseLabel = state.turn.phase === "move"
    ? "Move"
    : state.turn.phase === "action"
      ? "Action"
      : "Combat";
  return `Round ${state.turn.round} · ${phaseLabel}`;
}

function renderHudFlowGrid({ header, status, objectives, commands }) {
  return `
    <div class="hud-flow-head">
      <span>${escapeHtml(header)}</span>
      <b>${escapeHtml(status)}</b>
    </div>
    <div class="hud-flow-grid">
      <div class="hud-flow-column hud-flow-column--objectives">
        <div class="hud-column-title">Objective</div>
        <div class="hud-column-body">${objectives}</div>
      </div>
      <div class="hud-flow-column hud-flow-column--commands">
        <div class="hud-column-title">Command</div>
        <div class="hud-column-body">${commands}</div>
      </div>
    </div>
  `;
}

function renderStoryModePanel(state) {
  const activeBody = getActiveBody(state);
  const label = activeBody?.unitType === "mech" ? "Telum" : "Pilot";

  return renderHudFlowGrid({
    header: "Story Mode",
    status: `${label}: ${activeBody?.name ?? "None"}`,
    objectives: renderObjectiveSummary(state) || `<div class="hud-compact-line muted">Explore the area.</div>`,
    commands: `
      <div class="hud-command-status">
        <div class="hud-command-label">Action / Interact</div>
        <button class="hud-command-button" data-hud-action="story-interact">Interact</button>
      </div>
    `
  });
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

    const role = focusedUnit.unitType === "mech" ? "Target Telum" : "Target Pilot";
    const stats = [
      ["MV", focusedUnit.move],
      ["INIT", focusedUnit.initiative ?? "-"],
      ["REACT", focusedUnit.reaction],
      ["TARG", focusedUnit.targeting],
      ["F", facingLabel(focusedUnit.facing)],
      ["STAT", focusedUnit.status ?? "-"]
    ];

    return `
      <div class="hud-target-readout">
        <div class="hud-target-topline">
          <div class="hud-card-title">${escapeHtml(role)}</div>
          <div class="hud-target-name-row">
            <div class="hud-unit-name-stack">
              <div class="hud-unit-name">${escapeHtml(focusedUnit.name)}</div>
              <div class="hud-subline">${escapeHtml(focusedUnit.team ?? "")}</div>
            </div>
            <div class="hud-active-vitals">
              ${vitalBar("SHD", focusedUnit.shield, focusedUnit.maxShield, "shield")}
              ${vitalBar("CORE", focusedUnit.core, focusedUnit.maxCore, "core")}
            </div>
          </div>
        </div>

        <div class="hud-stat-strip">
          ${stats.map(([label, value]) => compactStat(label, value)).join("")}
        </div>

        ${targetPilot ? `
          <div class="hud-embarked-strip">
            <div class="hud-embarked-name">Pilot: ${escapeHtml(targetPilot.name)}</div>
            ${vitalBar("P-SHD", targetPilot.shield, targetPilot.maxShield, "shield")}
            ${vitalBar("P-CORE", targetPilot.core, targetPilot.maxCore, "core")}
          </div>
        ` : ""}
      </div>
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
    <div class="hud-tile-readout">
      <div class="hud-card-title">Tile</div>
      <div class="hud-tile-focus">(${state.focus.x}, ${state.focus.y})</div>
      <div class="hud-stat-strip hud-stat-strip--tile">
        ${compactStat("ELEV", elev)}
        ${compactStat("LOS", los)}
        ${compactStat(isStoryMode(state) ? "MODE" : "ROUND", isStoryMode(state) ? "Story" : state.turn.round)}
        ${compactStat("PHASE", state.turn.phase)}
      </div>
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
      <div class="hud-inline-stat-label">${escapeHtml(label)}</div>
      <div class="hud-inline-stat-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function compactStat(label, value) {
  return `
    <div class="hud-compact-stat">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function vitalBar(label, value, maxValue, kind) {
  const current = Number(value ?? 0);
  const max = Math.max(1, Number(maxValue ?? value ?? 1));
  const percent = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  return `
    <div class="hud-vital hud-vital--${escapeClassToken(kind || label)}">
      <div class="hud-vital-top"><span>${escapeHtml(label)}</span><b>${escapeHtml(`${current}/${max}`)}</b></div>
      <div class="hud-vital-track"><i style="width:${percent}%"></i></div>
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

function escapeClassToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}
