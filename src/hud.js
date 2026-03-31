import { getTile, tileTypeFromElevation } from "./map.js";
import { getMechAt, getMechById } from "./mechs.js";

export function bindHudInput(state, refs, actions) {
  refs.hudRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-hud-action]");
    if (!button) return;
    if (button.disabled) return;

    const action = button.dataset.hudAction;

    switch (action) {
      case "move":
        actions.startMove();
        break;
      case "attack":
        actions.startAttack();
        break;
      case "wait":
        actions.waitTurn();
        break;
      case "confirm":
        actions.confirmAction();
        break;
      case "cancel":
        actions.cancelAction();
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
      <div class="hud-section-title">Active Unit</div>
      <div class="hud-context-card">
        <div class="hud-context-title">No Active Mech</div>
        <div class="hud-context-sub">Load a unit to begin prototype combat flow.</div>
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Active Unit</div>
    <div class="hud-unit-name">${escapeHtml(activeMech.name)}</div>
    <div class="hud-subline">Prototype Command Feed · Round ${state.turn.round}</div>

    <div class="hud-stat-grid">
      ${renderStat("Armor", activeMech.armor)}
      ${renderStat("Structure", activeMech.structure)}
      ${renderStat("Move", activeMech.move)}
      ${renderStat("Facing", facingLabel(getDisplayedFacing(state, activeMech)))}
    </div>

    <div class="hud-context-card">
      <div class="hud-tag">Player Unit</div>
      <div class="hud-context-sub" style="margin-top:8px;">
        Position ${activeMech.x}, ${activeMech.y} · Footprint ${activeMech.footprint}
      </div>
    </div>
  `;
}

function renderCenterPanel(state) {
  const mode = state.ui.mode;
  const isIdle = mode === "idle";
  const isMove = mode === "move";
  const isFace = mode === "face";

  const modeTitle = getModeTitle(mode);
  const modeText = getModeText(mode);

  return `
    <div class="hud-section-title">Command</div>

    <div class="hud-mode-box">
      <div class="hud-mode-title">${modeTitle}</div>
      <div class="hud-mode-text">${modeText}</div>
    </div>

    <div class="hud-command-list">
      <button
        class="hud-command-button"
        type="button"
        data-hud-action="move"
        ${isIdle ? "" : "disabled"}
      >
        <span>Move</span>
        <span class="hud-command-key">M</span>
      </button>

      <button
        class="hud-command-button"
        type="button"
        data-hud-action="attack"
        disabled
      >
        <span>Attack</span>
        <span class="hud-command-key">Soon</span>
      </button>

      <button
        class="hud-command-button"
        type="button"
        data-hud-action="wait"
        disabled
      >
        <span>Wait</span>
        <span class="hud-command-key">Later</span>
      </button>

      <button
        class="hud-command-button"
        type="button"
        data-hud-action="confirm"
        ${isMove || isFace ? "" : "disabled"}
      >
        <span>Confirm</span>
        <span class="hud-command-key">Enter</span>
      </button>

      <button
        class="hud-command-button"
        type="button"
        data-hud-action="cancel"
        ${isMove || isFace ? "" : "disabled"}
      >
        <span>Cancel</span>
        <span class="hud-command-key">Esc</span>
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
      <div class="hud-context-card">
        <div class="hud-context-title">${escapeHtml(focusMech.name)}</div>
        <div class="hud-context-sub">Potential target unit</div>
      </div>

      <div class="hud-context-grid">
        ${renderStat("Armor", focusMech.armor)}
        ${renderStat("Structure", focusMech.structure)}
        ${renderStat("Move", focusMech.move)}
        ${renderStat("Facing", facingLabel(getDisplayedFacing(state, focusMech)))}
      </div>
    `;
  }

  if (focusTile) {
    const terrain = tileTypeFromElevation(focusTile.elevation);

    return `
      <div class="hud-section-title">Context</div>
      <div class="hud-context-card">
        <div class="hud-context-title">Tile ${focusTile.x}, ${focusTile.y}</div>
        <div class="hud-context-sub">Focused board position</div>
      </div>

      <div class="hud-context-grid">
        ${renderStat("Elevation", focusTile.elevation)}
        ${renderStat("Terrain", terrainLabel(terrain))}
        ${renderStat("Mode", modeLabel(state.ui.mode))}
        ${renderStat("View", state.ui.viewMode === "iso" ? "Iso" : "Tactical")}
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Mission</div>
    <div class="hud-context-card">
      <div class="hud-context-title">Prototype Skirmish</div>
      <div class="hud-context-sub">Movement, camera rotation, facing, and HUD validation pass.</div>
    </div>

    <div class="hud-context-grid">
      ${renderStat("Objective", "Test")}
      ${renderStat("Enemy", "None")}
      ${renderStat("Phase", "Command")}
      ${renderStat("Build", "Proto")}
    </div>
  `;
}

function renderStat(label, value) {
  return `
    <div class="hud-stat">
      <div class="hud-stat-label">${escapeHtml(String(label))}</div>
      <div class="hud-stat-value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function getModeTitle(mode) {
  switch (mode) {
    case "move":
      return "Move Selection";
    case "face":
      return "Facing Selection";
    default:
      return "Unit Command";
  }
}

function getModeText(mode) {
  switch (mode) {
    case "move":
      return "Choose a destination tile, then confirm movement.";
    case "face":
      return "Pick final facing, then confirm to lock the unit in place.";
    default:
      return "Select an action for the active mech. Attack is present in the HUD but not built yet.";
  }
}

function modeLabel(mode) {
  switch (mode) {
    case "move":
      return "Move";
    case "face":
      return "Facing";
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
