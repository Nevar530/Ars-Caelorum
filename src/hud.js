import { getTile, tileTypeFromElevation } from "./map.js";
import { getMechAt, getMechById } from "./mechs.js";
import { getSelectedAttackMenuItems } from "./action.js";
import { getLineOfSightResult } from "./los.js";

export function bindHudInput(state, refs, actions) {
  refs.hudRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-hud-action]");
    if (!button) return;
    if (button.disabled) return;

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
      default:
        break;
    }
  });

  if (refs.combatOverlay) {
    refs.combatOverlay.addEventListener("click", (event) => {
      const button = event.target.closest("[data-hud-action='start-combat']");
      if (!button || button.disabled) return;
      actions.startCombat();
    });
  }
}

export function renderHud(state, refs) {
  refs.hudLeft.innerHTML = renderActivePanel(state);
  refs.hudCenter.innerHTML = renderCenterPanel(state);
  refs.hudRight.innerHTML = renderContextPanel(state);

  if (refs.combatRibbon) {
    refs.combatRibbon.innerHTML = renderCombatRibbon(state);
  }

  if (refs.combatOverlay) {
    refs.combatOverlay.innerHTML = renderCombatOverlay(state);
    refs.combatOverlay.classList.toggle("is-visible", shouldShowOverlay(state));
    refs.combatOverlay.classList.toggle("is-clickthrough", !shouldOverlayCapture(state));
  }
}

function renderActivePanel(state) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  const selectedMech = getMechById(state.mechs, state.selection.mechId);
  const displayMech = activeMech ?? selectedMech ?? null;

  if (!displayMech) {
    return `
      <div class="hud-section-title">Unit</div>
      <div class="hud-mini-card">
        <div class="hud-context-title">No Unit</div>
        <div class="hud-context-sub">Spawn a mech to begin.</div>
      </div>
    `;
  }

  const statusLabel = state.turn.combatStarted ? "Active" : "Preview";

  return `
    <div class="hud-section-title">Unit</div>

    <div class="hud-unit-row">
      <div>
        <div class="hud-unit-name">${escapeHtml(displayMech.name)}</div>
        <div class="hud-subline">
          ${escapeHtml(displayMech.pilotName ?? "No Pilot")} · ${escapeHtml(displayMech.team ?? "neutral")}
        </div>
      </div>
      <div class="hud-tag">${statusLabel}</div>
    </div>

    <div class="hud-stat-row">
      ${renderInlineStat("SHD", `${displayMech.shield}/${displayMech.maxShield ?? displayMech.shield}`)}
      ${renderInlineStat("CORE", `${displayMech.core}/${displayMech.maxCore ?? displayMech.core}`)}
      ${renderInlineStat("REACT", displayMech.reaction ?? 0)}
      ${renderInlineStat("TARG", displayMech.targeting ?? 0)}
    </div>

    <div class="hud-stat-row">
      ${renderInlineStat("MV", displayMech.move)}
      ${renderInlineStat("INIT", displayMech.initiative ?? "-")}
      ${renderInlineStat("F", facingLabel(getDisplayedFacing(state, displayMech)))}
      ${renderInlineStat("CTRL", displayMech.controlType ?? "-")}
    </div>
  `;
}

function renderCenterPanel(state) {
  const mode = state.ui.mode;
  const menu = state.ui.commandMenu;

  if (!state.turn.combatStarted) {
    return `
      <div class="hud-section-title">Combat</div>

      <div class="hud-mode-box compact">
        <div class="hud-mode-title">Awaiting Combat Start</div>
        <div class="hud-mode-text">Start Combat to roll initiative and begin the round loop.</div>
      </div>

      <div class="hud-idle-actions">
        <button class="hud-command-button compact" type="button" data-hud-action="start-combat">
          <span>Start Combat</span>
          <span class="hud-command-key">Enter</span>
        </button>
      </div>
    `;
  }

  if (mode === "idle" && menu.open) {
    return `
      <div class="hud-section-title">Command</div>

      <div class="hud-mode-box compact">
        <div class="hud-mode-title">Select Action</div>
        <div class="hud-mode-text">Up / Down choose · Enter confirm · Esc back</div>
      </div>

      <div class="hud-menu-list" role="menu" aria-label="Unit command menu">
        ${menu.items.map((item, index) => {
          const selected = index === menu.index;
          return `
            <button
              class="hud-menu-button ${selected ? "is-selected" : ""}"
              type="button"
              data-hud-action="menu-select"
              data-menu-action="${item}"
            >
              <span class="hud-menu-caret">${selected ? "▶" : "&nbsp;"}</span>
              <span>${menuLabel(item)}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  if (mode === "action-attack-select") {
    const items = getSelectedAttackMenuItems(state);

    return `
      <div class="hud-section-title">Attack</div>

      <div class="hud-mode-box compact">
        <div class="hud-mode-title">Select Weapon</div>
        <div class="hud-mode-text">Up / Down choose attack · Enter confirm · Esc back</div>
      </div>

      <div class="hud-menu-list" role="menu" aria-label="Attack selection menu">
        ${items.map((item, index) => {
          const selected = index === state.ui.action.menuIndex;
          return `
            <button
              class="hud-menu-button ${selected ? "is-selected" : ""}"
              type="button"
              data-hud-action="confirm"
            >
              <span class="hud-menu-caret">${selected ? "▶" : "&nbsp;"}</span>
              <span>${escapeHtml(item.label)}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  if (mode === "action-target") {
    const profile = state.ui.action.selectedAction;

    return `
      <div class="hud-section-title">Targeting</div>

      <div class="hud-mode-box compact">
        <div class="hud-mode-title">${escapeHtml(profile?.name ?? "Attack")}</div>
        <div class="hud-mode-text">Move cursor to valid tile · Enter confirm · Esc back</div>
      </div>

      <div class="hud-step-row">
        <div class="hud-step is-active">1. Command</div>
        <div class="hud-step is-active">2. Weapon</div>
        <div class="hud-step is-active">3. Target</div>
      </div>
    `;
  }

  if (mode === "move") {
    return `
      <div class="hud-section-title">Move</div>

      <div class="hud-mode-box compact">
        <div class="hud-mode-title">Select Destination</div>
        <div class="hud-mode-text">Arrow keys move cursor · Enter confirm tile · Esc cancel</div>
      </div>

      <div class="hud-step-row">
        <div class="hud-step is-active">1. Menu</div>
        <div class="hud-step is-active">2. Tile</div>
        <div class="hud-step">3. Facing</div>
      </div>
    `;
  }

  if (mode === "face") {
    return `
      <div class="hud-section-title">Facing</div>

      <div class="hud-mode-box compact">
        <div class="hud-mode-title">Choose Final Facing</div>
        <div class="hud-mode-text">Arrow keys set facing · Enter confirm · Esc back to move</div>
      </div>

      <div class="hud-step-row">
        <div class="hud-step is-active">1. Menu</div>
        <div class="hud-step is-active">2. Tile</div>
        <div class="hud-step is-active">3. Facing</div>
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Command</div>

    <div class="hud-mode-box compact">
      <div class="hud-mode-title">Awaiting Command</div>
      <div class="hud-mode-text">Press Enter to open the command menu for the active mech.</div>
    </div>

    <div class="hud-idle-actions">
      <button class="hud-command-button compact" type="button" data-hud-action="open-menu">
        <span>Open Menu</span>
        <span class="hud-command-key">Enter</span>
      </button>
    </div>
  `;
}

function renderContextPanel(state) {
  const focusTile = getTile(state.map, state.focus.x, state.focus.y);
  const focusMech = getMechAt(state.mechs, state.focus.x, state.focus.y);
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);

  if (focusMech && activeMech && focusMech.instanceId !== activeMech.instanceId) {
    return `
      <div class="hud-section-title">Target</div>

      <div class="hud-mini-card">
        <div class="hud-context-title">${escapeHtml(focusMech.name)}</div>
        <div class="hud-context-sub">
          ${escapeHtml(focusMech.pilotName ?? "No Pilot")} · ${escapeHtml(focusMech.team ?? "neutral")}
        </div>
      </div>

      <div class="hud-stat-row">
        ${renderInlineStat("SHD", `${focusMech.shield}/${focusMech.maxShield ?? focusMech.shield}`)}
        ${renderInlineStat("CORE", `${focusMech.core}/${focusMech.maxCore ?? focusMech.core}`)}
        ${renderInlineStat("REACT", focusMech.reaction ?? 0)}
        ${renderInlineStat("TARG", focusMech.targeting ?? 0)}
      </div>
    `;
  }

  const elevation = focusTile?.elevation ?? 0;
  const tileType = tileTypeFromElevation(elevation);

  let losText = "—";
  if (activeMech && state.turn.combatStarted) {
    const los = getLineOfSightResult(state, activeMech.x, activeMech.y, state.focus.x, state.focus.y, {
      attackerScale: activeMech.scale ?? "mech",
      targetScale: "mech"
    });

    if (los.cover === "half") losText = "Half Cover";
    else if (los.cover === "full") losText = "Blocked";
    else if (los.visible) losText = "Clear";
  }

  return `
    <div class="hud-section-title">Tile</div>

    <div class="hud-mini-card">
      <div class="hud-context-title">(${state.focus.x}, ${state.focus.y})</div>
      <div class="hud-context-sub">${escapeHtml(tileType)}</div>
    </div>

    <div class="hud-stat-row">
      ${renderInlineStat("ELEV", elevation)}
      ${renderInlineStat("LOS", losText)}
      ${renderInlineStat("ROUND", state.turn.round)}
      ${renderInlineStat("PHASE", capitalize(state.turn.phase))}
    </div>
  `;
}

function renderCombatRibbon(state) {
  const currentLabel = !state.turn.combatStarted
    ? "Setup"
    : `${capitalize(state.turn.phase)} Phase`;

  return `
    <div class="combat-ribbon-summary">
      <div class="combat-ribbon-round">Round ${state.turn.round}</div>
      <div class="combat-ribbon-phase">${escapeHtml(currentLabel)}</div>
    </div>

    <div class="combat-ribbon-rows">
      ${renderRibbonRow(state, "Move", state.turn.moveOrder, state.turn.moveIndex, state.turn.phase === "move")}
      ${renderRibbonRow(state, "Action", state.turn.actionOrder, state.turn.actionIndex, state.turn.phase === "action")}
    </div>
  `;
}

function renderRibbonRow(state, label, order, currentIndex, isCurrentPhase) {
  const cells = (Array.isArray(order) ? order : []).map((instanceId, index) => {
    const unit = getMechById(state.mechs, instanceId);
    if (!unit) return "";

    const isActive = isCurrentPhase && index === currentIndex;
    const isComplete = isCurrentPhase && index < currentIndex;
    const classes = [
      "combat-ribbon-cell",
      isCurrentPhase ? "is-phase-current" : "is-phase-dim",
      isActive ? "is-active" : "",
      isComplete ? "is-complete" : ""
    ].join(" ");

    return `
      <div class="${classes}">
        <div class="combat-ribbon-cell-name">${escapeHtml(unit.name)}</div>
        <div class="combat-ribbon-cell-sub">
          ${escapeHtml(unit.pilotName ?? "No Pilot")} · Init ${unit.initiative ?? "-"}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="combat-ribbon-row ${isCurrentPhase ? "is-current" : ""}">
      <div class="combat-ribbon-row-label">${escapeHtml(label)}</div>
      <div class="combat-ribbon-row-cells">
        ${cells || `<div class="combat-ribbon-empty">No order</div>`}
      </div>
    </div>
  `;
}

function renderCombatOverlay(state) {
  if (!state.turn.combatStarted) {
    return `
      <div class="combat-overlay-card">
        <div class="combat-overlay-title">Combat Ready</div>
        <div class="combat-overlay-text">
          4 test mechs are loaded into the spawn points. Start Combat to roll initiative.
        </div>
        <button class="combat-start-button" type="button" data-hud-action="start-combat">
          Start Combat
        </button>
      </div>
    `;
  }

  if (state.turn.splashVisible && state.turn.splashText) {
    return `
      <div class="combat-splash-banner">
        ${escapeHtml(state.turn.splashText)}
      </div>
    `;
  }

  return "";
}

function shouldShowOverlay(state) {
  return !state.turn.combatStarted || (state.turn.splashVisible && !!state.turn.splashText);
}

function shouldOverlayCapture(state) {
  return !state.turn.combatStarted;
}

function renderInlineStat(label, value) {
  return `
    <div class="hud-inline-stat">
      <div class="hud-inline-stat-label">${escapeHtml(String(label))}</div>
      <div class="hud-inline-stat-value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function getDisplayedFacing(state, mech) {
  if (state.ui.mode === "face" && state.ui.facingPreview !== null && mech.instanceId === state.turn.activeMechId) {
    return state.ui.facingPreview;
  }

  return mech.facing;
}

function facingLabel(facing) {
  switch (facing) {
    case 0:
      return "N";
    case 1:
      return "E";
    case 2:
      return "S";
    case 3:
      return "W";
    default:
      return "?";
  }
}

function menuLabel(item) {
  switch (item) {
    case "move":
      return "Move";
    case "brace":
      return "Brace";
    case "attack":
      return "Attack";
    case "ability":
      return "Ability";
    case "item":
      return "Item";
    case "end_turn":
      return "End Turn";
    default:
      return item;
  }
}

function capitalize(value) {
  if (!value) return "";
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
