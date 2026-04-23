import { getCommandMenuItemsForPhase, resetActionUiState } from "../action.js";
import {
  clearCombatTextMarkers,
  renderCombatTextOverlay
} from "../combat/combatTextOverlay.js";
import { clearMissionResult } from "../mission/missionState.js";
import { renderMissionOverlay } from "../ui/missionOverlay.js";
import { renderFrontScreen } from "../ui/frontScreen.js";
import { renderHud } from "../ui/hud.js";
import { renderHelpDrawer } from "../ui/helpDrawer.js";
import { renderAll } from "../render.js";
import { cloneMapDefinition, resetMap } from "../map.js";

export function createGameController({
  state,
  refs,
  instantiateTestUnits,
  snapFocusToActiveUnit,
  logDev
}) {
  let splashTimer = null;

  function render() {
    renderAll(state, refs);
    renderHud(state, refs);
    renderHelpDrawer(state, refs);
    renderCombatTextOverlay(state, refs);
    renderMissionOverlay(state, refs);
    renderFrontScreen(state, refs);
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
    state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase, state);
  }

  function setPreviewSelectionFromFirstUnit() {
    if (state.units.length > 0) {
      state.selection.unitId = state.units[0].instanceId;
      state.focus.x = state.units[0].x;
      state.focus.y = state.units[0].y;
      state.focus.scale = state.units[0].scale ?? state.units[0].unitType ?? "pilot";
      state.camera.zoomMode = "map";
      state.camera.zoomScale = state.camera.zoomMode;
      return;
    }

    state.selection.unitId = null;
    state.focus.x = 0;
    state.focus.y = 0;
  }

  function resetCombatToSetup() {
    clearTransientUi();
    hideSplash();
    clearCombatTextMarkers(state);
    clearMissionResult(state);

    state.turn.activeUnitId = null;
    state.turn.activeActorId = null;
    state.turn.activeBodyId = null;
    state.turn.round = 1;
    state.turn.phase = "setup";
    state.turn.combatStarted = false;
    state.turn.moveOrder = [];
    state.turn.actionOrder = [];
    state.turn.moveIndex = -1;
    state.turn.actionIndex = -1;
    state.turn.lastInitiativeRolls = [];

    setPreviewSelectionFromFirstUnit();
  }

  function loadMapAndUnits(mapDefinition = null) {
    const sourceMap = mapDefinition ?? state.mission?.sourceMap ?? state.content?.defaultMap ?? null;
    state.map = resetMap(sourceMap);
    state.units = instantiateTestUnits(state.content, state.map);
    state.mission.sourceMap = cloneMapDefinition(sourceMap);

    state.rotation = 0;
    state.camera.angle = 0;
    state.camera.isTurning = false;
    state.ui.viewMode = "iso";

    resetCombatToSetup();

    logDev("Map reset and test units reloaded.");
    render();
  }

  function showTitleScreen() {
    clearTransientUi();
    hideSplash();
    clearMissionResult(state);
    state.ui.shell.screen = "title";
    render();
  }

  function endMission(result) {
    if (!result) return;

    clearTransientUi();
    hideSplash();
    state.turn.combatStarted = false;
    state.turn.phase = "setup";
    state.turn.activeUnitId = null;
    state.turn.activeActorId = null;
    state.turn.activeBodyId = null;
    state.mission.result = result;
    logDev(result === "victory" ? "Mission ended: Victory." : "Mission ended: Defeat.");
    render();
  }

  function selectFocusedUnitIfPresent(getUnitAt) {
    if (state.turn.combatStarted) return false;
    if (state.ui.mode !== "idle") return false;
    if (state.ui.commandMenu.open) return false;

    const hoveredUnit = getUnitAt(state.units, state.focus.x, state.focus.y);
    if (!hoveredUnit) return false;

    if (state.selection.unitId === hoveredUnit.instanceId) {
      return true;
    }

    state.selection.unitId = hoveredUnit.instanceId;

    state.focus.x = hoveredUnit.x;
    state.focus.y = hoveredUnit.y;
    state.focus.scale = hoveredUnit.scale ?? hoveredUnit.unitType ?? "mech";
    state.camera.zoomScale = state.camera.zoomMode ?? state.focus.scale;

    logDev(`${hoveredUnit.name} selected at (${hoveredUnit.x},${hoveredUnit.y}).`);

    return true;
  }

  function openCommandMenu() {
    if (!state.turn.combatStarted) return;
    if (state.ui.mode !== "idle") return;

    snapFocusToActiveUnit();

    state.ui.commandMenu.open = true;
    state.ui.commandMenu.index = 0;
    state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase, state);
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

  function toggleHelpDrawer() {
    state.ui.helpDrawer.open = !state.ui.helpDrawer.open;
    render();
  }

  function closeHelpDrawer() {
    if (!state.ui.helpDrawer.open) return;
    state.ui.helpDrawer.open = false;
    render();
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

  function zoomIn() {
    const levels = ["map", "mech", "pilot"];
    const current = String(state.camera.zoomMode ?? "map");
    const index = Math.max(0, levels.indexOf(current));
    state.camera.zoomMode = levels[Math.min(levels.length - 1, index + 1)];
    state.camera.zoomScale = state.camera.zoomMode;
    render();
  }

  function zoomOut() {
    const levels = ["map", "mech", "pilot"];
    const current = String(state.camera.zoomMode ?? "map");
    const index = Math.max(0, levels.indexOf(current));
    state.camera.zoomMode = levels[Math.max(0, index - 1)];
    state.camera.zoomScale = state.camera.zoomMode;
    render();
  }

  return {
    render,
    hideSplash,
    showSplash,
    clearTransientUi,
    resetCombatToSetup,
    loadMapAndUnits,
    showTitleScreen,
    resetMapAndUnits: loadMapAndUnits,
    endMission,
    selectFocusedUnitIfPresent,
    openCommandMenu,
    closeCommandMenu,
    moveMenuSelection,
    animateRotation,
    toggleHelpDrawer,
    closeHelpDrawer,
    toggleView,
    zoomIn,
    zoomOut
  };
}
