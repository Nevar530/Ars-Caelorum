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

    <div class="hud-stat-row">
      ${statInline("ARM", activeMech.armor)}
      ${statInline("STR", activeMech.structure)}
      ${statInline("MOV", activeMech.move)}
      ${statInline("FAC", facingShort(getDisplayedFacing(state, activeMech)))}
    </div>

    <div class="hud-context-card">
      <div class="hud-tag">Player Unit</div>
      <div class="hud-context-sub" style="margin-top:6px;">
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

      <div class="hud-context-row">
        ${contextInline("ARM", focusMech.armor)}
        ${contextInline("STR", focusMech.structure)}
        ${contextInline("MOV", focusMech.move)}
        ${contextInline("FAC", facingShort(getDisplayedFacing(state, focusMech)))}
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

      <div class="hud-context-row">
        ${contextInline("X", focusTile.x)}
        ${contextInline("Y", focusTile.y)}
        ${contextInline("Z", focusTile.elevation)}
        ${contextInline("T", terrainShort(terrain))}
        ${contextInline("MODE", modeShort(state.ui.mode))}
        ${contextInline("VIEW", state.ui.viewMode === "iso" ? "ISO" : "TOP")}
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Mission</div>
    <div class="hud-context-card">
      <div class="hud-context-title">Prototype Skirmish</div>
      <div class="hud-context-sub">Movement, camera rotation, facing, and HUD validation pass.</div>
    </div>

    <div class="hud-context-row">
      ${contextInline("OBJ", "TEST")}
      ${contextInline("ENEMY", "NONE")}
      ${contextInline("PHASE", "CMD")}
      ${contextInline("BUILD", "PROTO")}
    </div>
  `;
}

function statInline(label, value) {
  return `
    <div class="hud-stat-inline">
      <span class="hud-stat-label">${escapeHtml(String(label))}</span>
      <span class="hud-stat-value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function contextInline(label, value) {
  return `
    <div class="hud-context-item">
      <span class="hud-stat-label">${escapeHtml(String(label))}</span>
      <span class="hud-stat-value">${escapeHtml(String(value))}</span>
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

function modeShort(mode) {
  switch (mode) {
    case "move":
      return "MOVE";
    case "face":
      return "FACE";
    default:
      return "IDLE";
  }
}

function facingShort(facing) {
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

function terrainShort(terrain) {
  switch (terrain) {
    case "peak":
      return "PEAK";
    case "high":
      return "HIGH";
    default:
      return "GRND";
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
