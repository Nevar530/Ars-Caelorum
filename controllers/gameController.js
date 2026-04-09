import { getCommandMenuItemsForPhase, resetActionUiState } from "../action.js";
import {
  clearCombatTextMarkers,
  renderCombatTextOverlay
} from "../combat/combatTextOverlay.js";
import { renderHud } from "../hud.js";
import { renderAll } from "../render.js";
import { resetMap } from "../map.js";

export function createGameController({
  state,
  refs,
  instantiateTestMechs,
  snapFocusToActiveMech,
  logDev
}) {
  let splashTimer = null;

  function render() {
    renderAll(state, refs);
    renderHud(state, refs);
    renderCombatTextOverlay(state, refs);
  }

  function hideSplash() {
    state.turn.splashVisible = false;
    state.turn.splashText = "";
    state.turn.splashKind = null;
  }

  function showSplash(text, kind = "round-phase", durationMs = 1200) {
    state.turn.splashText = text;
    state.turn.splashVisible = true;
    state.turn.splashKind = kind;

    if (splashTimer) {
      clearTimeout(splashTimer);
      splashTimer = null;
    }

    splashTimer = window.setTimeout(() => {
      hideSplash();
      render();
    }, durationMs);
  }

  function clearTransientUi() {
    state.ui.mode = "idle";
    state.selection.action = null;
    state.ui.previewPath = [];
    state.ui.facingPreview = null;
    state.ui.preMove = null;
    resetActionUiState(state);
    state.ui.commandMenu.open = false;
    state.ui.commandMenu.index = 0;
    state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase);
  }

  function setPreviewSelectionFromFirstMech() {
    if (state.mechs.length > 0) {
      state.selection.mechId = state.mechs[0].instanceId;
      state.focus.x = state.mechs[0].x;
      state.focus.y = state.mechs[0].y;
      return;
    }

    state.selection.mechId = null;
    state.focus.x = 0;
    state.focus.y = 0;
  }

  function resetCombatToSetup() {
    clearTransientUi();
    hideSplash();
    clearCombatTextMarkers(state);

    state.turn.activeMechId = null;
    state.turn.round = 1;
    state.turn.phase = "setup";
    state.turn.combatStarted = false;
    state.turn.moveOrder = [];
    state.turn.actionOrder = [];
    state.turn.moveIndex = -1;
    state.turn.actionIndex = -1;
    state.turn.lastInitiativeRolls = [];

    setPreviewSelectionFromFirstMech();
  }

  function resetMapAndUnits() {
    state.map = resetMap();
    state.mechs = instantiateTestMechs(state.content);

    state.rotation = 0;
    state.camera.angle = 0;
    state.camera.isTurning = false;
    state.ui.viewMode = "iso";

    resetCombatToSetup();

    logDev("Map reset and 4 test mechs reloaded.");
    render();
  }

  function selectFocusedMechIfPresent(getMechAt) {
    if (state.turn.combatStarted) return false;
    if (state.ui.mode !== "idle") return false;
    if (state.ui.commandMenu.open) return false;

    const hoveredMech = getMechAt(state.mechs, state.focus.x, state.focus.y);
    if (!hoveredMech) return false;

    if (state.selection.mechId === hoveredMech.instanceId) {
      return true;
    }

    state.selection.mechId = hoveredMech.instanceId;

    logDev(`${hoveredMech.name} selected at (${hoveredMech.x},${hoveredMech.y}).`);

    return true;
  }

  function openCommandMenu() {
    if (!state.turn.combatStarted) return;
    if (state.ui.mode !== "idle") return;

    snapFocusToActiveMech();

    state.ui.commandMenu.open = true;
    state.ui.commandMenu.index = 0;
    state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase);
    state.selection.action = null;

    render();
  }

  function closeCommandMenu() {
    state.ui.commandMenu.open = false;
    state.ui.commandMenu.index = 0;
    render();
  }

  function moveMenuSelection(delta) {
    const menu = state.ui.commandMenu;
    if (!menu.open) return;

    const count = menu.items.length;
    menu.index = (menu.index + delta + count) % count;
    render();
  }

  function animateRotation(direction) {
    if (state.ui.viewMode !== "iso") return;
    if (state.camera.isTurning) return;

    state.camera.isTurning = true;

    const startAngle = state.camera.angle;
    const endAngle = startAngle + (direction * 90);
    const durationMs = 320;
    const startTime = performance.now();

    function easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function tick(now) {
      const elapsed = now - startTime;
      const rawT = Math.min(1, elapsed / durationMs);
      const easedT = easeInOutQuad(rawT);

      state.camera.angle = startAngle + ((endAngle - startAngle) * easedT);
      render();

      if (rawT < 1) {
        requestAnimationFrame(tick);
        return;
      }

      state.camera.angle = ((endAngle % 360) + 360) % 360;
      state.rotation = Math.round(state.camera.angle / 90) % 4;
      state.camera.isTurning = false;
      render();
    }

    requestAnimationFrame(tick);
  }

  function toggleView() {
    state.ui.viewMode = state.ui.viewMode === "iso" ? "top" : "iso";

    if (state.ui.viewMode === "top") {
      state.camera.angle = Math.round(state.camera.angle / 90) * 90;
      state.rotation = Math.round(state.camera.angle / 90) % 4;
      state.camera.isTurning = false;
    }

    render();
  }

  return {
    render,
    hideSplash,
    showSplash,
    clearTransientUi,
    setPreviewSelectionFromFirstMech,
    resetCombatToSetup,
    resetMapAndUnits,
    selectFocusedMechIfPresent,
    openCommandMenu,
    closeCommandMenu,
    moveMenuSelection,
    animateRotation,
    toggleView
  };
}
