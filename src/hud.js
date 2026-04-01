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
      case "menu-select":
        actions.selectMenuAction(button.dataset.menuAction);
        break;
      default:
        break;
    }
  });
}

export function renderHud(state, refs) {
  refs.hudLeft.innerHTML = renderActivePanel(state);
  refs.hudCenter.innerHTML = renderCenterPanel(state);
  refs.hudRight.innerHTML = renderContextPanel(state);
}

function renderActivePanel(state) {
  const activeMech = getMechById(state.mechs, state.turn.activeMechId);

  if (!activeMech) {
    return `
      <div class="hud-section-title">Unit</div>
      <div class="hud-mini-card">
        <div class="hud-context-title">No Active Mech</div>
        <div class="hud-context-sub">Load a unit to begin.</div>
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Unit</div>

    <div class="hud-unit-row">
      <div>
        <div class="hud-unit-name">${escapeHtml(activeMech.name)}</div>
        <div class="hud-subline">Round ${state.turn.round} · ${escapeHtml(capitalize(state.turn.phase))} Phase</div>
      </div>
      <div class="hud-tag">Active</div>
    </div>

    <div class="hud-stat-row">
      ${renderInlineStat("ARM", activeMech.armor)}
      ${renderInlineStat("STR", activeMech.structure)}
      ${renderInlineStat("MV", activeMech.move)}
      ${renderInlineStat("F", facingLabel(getDisplayedFacing(state, activeMech)))}
    </div>
  `;
}

function renderCenterPanel(state) {
  const mode = state.ui.mode;
  const menu = state.ui.commandMenu;

  if (mode === "idle" && menu.open) {
    return `
      <div class="hud-section-title">Command</div>

      <div class="hud-mode-box compact">
        <div class="hud-mode-title">Select Action</div>
        <div class="hud-mode-text">Up / Down to choose · Enter confirm · Esc back</div>
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
      <div class="hud-mode-text">Press Enter to open command menu for the active mech.</div>
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
  const targetStatus = getFocusedTileTargetStatus(state);

  if (focusMech && activeMech && focusMech.instanceId !== activeMech.instanceId) {
    return `
      <div class="hud-section-title">Target</div>

      <div class="hud-mini-card">
        <div class="hud-context-title">${escapeHtml(focusMech.name)}</div>
        <div class="hud-context-sub">Focused hostile / target candidate</div>
        ${targetStatus ? `<div class="hud-context-sub">${escapeHtml(targetStatus)}</div>` : ""}
      </div>

      <div class="hud-stat-row">
        ${renderInlineStat("ARM", focusMech.armor)}
        ${renderInlineStat("STR", focusMech.structure)}
        ${renderInlineStat("MV", focusMech.move)}
        ${renderInlineStat("F", facingLabel(getDisplayedFacing(state, focusMech)))}
      </div>
    `;
  }

  if (focusTile) {
    const terrain = tileTypeFromElevation(focusTile.elevation);

    return `
      <div class="hud-section-title">Context</div>

      <div class="hud-mini-card">
        <div class="hud-context-title">Tile ${focusTile.x}, ${focusTile.y}</div>
        <div class="hud-context-sub">${terrainLabel(terrain)} · Elevation ${focusTile.elevation}</div>
        ${targetStatus ? `<div class="hud-context-sub">${escapeHtml(targetStatus)}</div>` : ""}
      </div>

      <div class="hud-stat-row">
        ${renderInlineStat("Mode", modeLabel(state.ui.mode))}
        ${renderInlineStat("View", state.ui.viewMode === "iso" ? "Iso" : "Top")}
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Context</div>
    <div class="hud-mini-card">
      <div class="hud-context-title">Prototype Skirmish</div>
      <div class="hud-context-sub">Move phase flow and facing validation.</div>
    </div>
  `;
}

function getFocusedTileTargetStatus(state) {
  if (state.ui.mode !== "action-target") {
    return "";
  }

  const activeMech = getMechById(state.mechs, state.turn.activeMechId);
  const profile = state.ui.action.selectedAction;
  const focusX = state.focus.x;
  const focusY = state.focus.y;

  if (!activeMech || !profile) {
    return "";
  }

  const fireArcTiles = state.ui.action.fireArcTiles || [];
  const validTargetTiles = state.ui.action.validTargetTiles || [];

  const validTarget = validTargetTiles.find(
    (tile) => tile.x === focusX && tile.y === focusY
  );

  if (validTarget) {
    if (validTarget.cover === "half") {
      return "Target - Available · Half Cover";
    }

    return "Target - Available";
  }

  const targetingKind = profile.targeting?.kind;
  if (targetingKind === "cardinal_adjacent") {
    return "Target - Out of Range";
  }

  const inFireArc = fireArcTiles.some(
    (tile) => tile.x === focusX && tile.y === focusY
  );

  if (!inFireArc) {
    return "Target - Out of Arc";
  }

  const minRange = profile.targeting?.minRange ?? 1;
  const maxRange = profile.targeting?.maxRange ?? 1;
  const dist = Math.abs(focusX - activeMech.x) + Math.abs(focusY - activeMech.y);

  if (dist < minRange || dist > maxRange) {
    return "Target - Out of Range";
  }

  const los = getLineOfSightResult(
    state,
    activeMech.x,
    activeMech.y,
    focusX,
    focusY
  );

  if (!los.visible) {
    if (los.cover === "full") {
      return "Target - Full Cover / Blocked";
    }

    return "Target - Blocked";
  }

  if (los.cover === "half") {
    return "Target - Available · Half Cover";
  }

  return "Target - Available";
}

function renderInlineStat(label, value) {
  return `
    <div class="hud-inline-stat">
      <span class="hud-inline-stat-label">${escapeHtml(String(label))}</span>
      <span class="hud-inline-stat-value">${escapeHtml(String(value))}</span>
    </div>
  `;
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
    default:
      return capitalize(item);
  }
}

function modeLabel(mode) {
  switch (mode) {
    case "move":
      return "Move";
    case "face":
      return "Facing";
    case "action-attack-select":
      return "Attack";
    case "action-target":
      return "Target";
    default:
      return "Idle";
  }
}

function facingLabel(facing) {
  switch (facing) {
    case 0:
      return "North";
    case 1:
      return "East";
    case 2:
      return "South";
    case 3:
      return "West";
    default:
      return "Unknown";
  }
}

function terrainLabel(terrain) {
  switch (terrain) {
    case "peak":
      return "Peak";
    case "high":
      return "High";
    default:
      return "Ground";
  }
}

function getDisplayedFacing(state, mech) {
  const isPreviewing =
    state.ui.mode === "face" &&
    mech.instanceId === state.turn.activeMechId &&
    state.ui.facingPreview !== null;

  return isPreviewing ? state.ui.facingPreview : mech.facing;
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
