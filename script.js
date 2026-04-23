import { createState } from "./src/state.js";
import { createInitialMap, normalizeMapDefinition } from "./src/map.js";
import {
  instantiateTestUnits,
  getUnitAt,
  getUnitById,
  moveUnitTo,
  setUnitFacing
} from "./src/mechs.js";
import { bindInput, snapFocusToActiveUnit as snapFocusHelper } from "./src/input.js";
import { loadGameData, loadMapDefinitionByPath } from "./src/dataLoader.js";
import { bindHudInput } from "./src/ui/hud.js";
import { clearCombatTextMarkers } from "./src/combat/combatTextOverlay.js";
import { initializeDevMenu } from "./dev/devMenu.js";
import { logDev, setDevLogSize } from "./dev/devLogger.js";
import { createGameController } from "./src/controllers/gameController.js";
import { createTurnController } from "./src/controllers/turnController.js";
import { createMovementController } from "./src/controllers/movementController.js";
import { createCombatController } from "./src/controllers/combatController.js";
import { createCpuTurnController } from "./src/ai/cpuTurnController.js";
import { isCommandMenuItemDisabled } from "./src/action.js";
import { getMissionMaps } from "./src/ui/frontScreen.js";
import { confirmDeploymentPlacement, getDeploymentReady, isDeploymentActive, openDeploymentListAtFocus, removeDeploymentPlacementAtFocus } from "./src/deployment/deploymentState.js";

const refs = {
  frontScreen: document.getElementById("frontScreen"),
  titleScreen: document.getElementById("titleScreen"),
  missionSelectScreen: document.getElementById("missionSelectScreen"),
  titleStartButton: document.getElementById("titleStartButton"),
  titleMissionSelectButton: document.getElementById("titleMissionSelectButton"),
  missionList: document.getElementById("missionList"),
  missionDescription: document.getElementById("missionDescription"),
  missionBackButton: document.getElementById("missionBackButton"),
  missionStartButton: document.getElementById("missionStartButton"),
  main: document.getElementById("mainRoot"),
  editor: document.getElementById("editor"),
  board: document.getElementById("board"),
  worldScene: document.getElementById("world-scene"),
  worldUi: document.getElementById("world-ui"),
  devToolbar: document.getElementById("devToolbar"),
  rotateLeftButton: document.getElementById("rotateLeft"),
  rotateRightButton: document.getElementById("rotateRight"),
  toggleViewButton: document.getElementById("toggleView"),
  resetMapButton: document.getElementById("resetMap"),
  editorModeMechButton: document.getElementById("editorModeMech"),
  editorModeDetailButton: document.getElementById("editorModeDetail"),
  editorModeLabel: document.getElementById("editorModeLabel"),
  hudRoot: document.getElementById("hudRoot"),
  hudLeft: document.getElementById("hudLeft"),
  hudCenter: document.getElementById("hudCenter"),
  hudRight: document.getElementById("hudRight"),
  helpDrawer: document.getElementById("helpDrawer"),
  combatRibbon: document.getElementById("combatRibbon"),
  combatOverlay: document.getElementById("combatOverlay")
};

async function init() {
  const content = await loadGameData();

  const initialMap = content.defaultMap ? normalizeMapDefinition(content.defaultMap) : createInitialMap();

  const state = createState({
    map: initialMap,
    units: [],
    rotation: 0,
    content
  });

  setDevLogSize(25);

  function snapFocusToActiveUnit(options = {}) {
    snapFocusHelper(state, options);
  }

  const gameController = createGameController({
    state,
    refs,
    instantiateTestUnits,
    snapFocusToActiveUnit,
    logDev
  });

  function clearTransientUi() {
    gameController.clearTransientUi();
  }

  let cpuTurnController = null;

  const turnController = createTurnController({
    state,
    getUnitById,
    clearTransientUi,
    snapFocusToActiveUnit,
    render: gameController.render,
    logDev,
    showSplash: gameController.showSplash,
    clearCombatTextMarkers,
    onTurnReady: () => cpuTurnController?.scheduleForCurrentTurn()
  });

  const movementController = createMovementController({
    state,
    getUnitById,
    moveUnitTo,
    setUnitFacing,
    snapFocusToActiveUnit,
    clearTransientUi,
    render: gameController.render,
    logDev,
    advanceMoveTurn: turnController.advanceMoveTurn,
    advanceActionTurn: turnController.advanceActionTurn
  });

  const combatController = createCombatController({
    state,
    getUnitById,
    getUnitAt,
    render: gameController.render,
    logDev,
    clearTransientUi,
    advanceActionTurn: turnController.advanceActionTurn,
    movementController,
    endMission: gameController.endMission
  });

  cpuTurnController = createCpuTurnController({
    state,
    render: gameController.render,
    logDev,
    movementController,
    combatController
  });

  refs.combatOverlay.addEventListener("click", (event) => {
    const button = event.target.closest("[data-combat-overlay-action]");
    if (!button) return;

    if (button.dataset.combatOverlayAction === "return-title") {
      actions.showTitleScreen();
    }
  });

  refs.titleStartButton?.addEventListener("click", () => {
    actions.openMissionSelect();
  });

  refs.titleMissionSelectButton?.addEventListener("click", () => {
    actions.openMissionSelect();
  });

  refs.missionBackButton?.addEventListener("click", () => {
    actions.showTitleScreen();
  });

  refs.missionList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-front-screen-map-id]");
    if (!button) return;
    actions.selectMissionMap(button.dataset.frontScreenMapId);
  });

  refs.missionStartButton?.addEventListener("click", () => {
    actions.startSelectedMission();
  });

  const actions = {
    render: gameController.render,
    snapFocusToActiveUnit,
    toggleHelpDrawer: gameController.toggleHelpDrawer,
    closeHelpDrawer: gameController.closeHelpDrawer,

    showTitleScreen() {
      state.ui.shell.screen = "title";
      gameController.showTitleScreen();
    },

    openMissionSelect() {
      state.ui.shell.screen = "mission-select";
      gameController.render();
    },

    moveTitleSelection(delta) {
      const count = 2;
      const current = Number.isFinite(Number(state.ui.shell.titleMenuIndex))
        ? Number(state.ui.shell.titleMenuIndex)
        : 0;
      state.ui.shell.titleMenuIndex = (current + delta + count) % count;
      gameController.render();
    },

    confirmTitleSelection() {
      if ((state.ui.shell.titleMenuIndex ?? 0) === 1) {
        actions.openMissionSelect();
        return;
      }
      actions.openMissionSelect();
    },

    selectMissionMap(mapId) {
      if (!mapId) return;
      state.ui.shell.selectedMapId = mapId;
      gameController.render();
    },

    async startSelectedMission() {
      const maps = Array.isArray(state.content?.mapCatalog?.maps) ? state.content.mapCatalog.maps : [];
      const selectedMapId = state.ui.shell.selectedMapId ?? state.content?.mapCatalog?.defaultMapId ?? null;
      const selectedEntry = maps.find((entry) => entry?.id === selectedMapId) ?? null;
      if (!selectedEntry?.path) return;

      const mapDefinition = await loadMapDefinitionByPath(selectedEntry.path);
      state.ui.shell.screen = "game";
      gameController.loadMapAndUnits(mapDefinition);
    },

    moveMissionSelection(delta) {
      const maps = getMissionMaps(state);
      if (!maps.length) return;

      const currentIndex = Math.max(0, maps.findIndex((entry) => entry?.id === state.ui.shell.selectedMapId));
      const nextIndex = (currentIndex + delta + maps.length) % maps.length;
      actions.selectMissionMap(maps[nextIndex].id);
    },
    
    setEditorMode() {
      state.ui.editor.mode = "mech";
      gameController.render();
    },

    selectFocusedMechIfPresent() {
      return gameController.selectFocusedUnitIfPresent(getUnitAt);
    },

    openCommandMenu: gameController.openCommandMenu,
    closeCommandMenu: gameController.closeCommandMenu,
    moveMenuSelection: gameController.moveMenuSelection,

    confirmMenuSelection() {
      const menu = state.ui.commandMenu;
      if (!menu.open) return;

      const action = menu.items[menu.index];
      if (isCommandMenuItemDisabled(state, action)) {
        return;
      }

      if (action === "move") {
        movementController.startMove();
        return;
      }

      if (action === "brace") {
        movementController.completeBraceForCurrentUnit();
        return;
      }

      if (action === "end_turn" && state.turn.phase === "move") {
        movementController.skipMoveForCurrentUnit();
        return;
      }

      if (action === "attack") {
        combatController.startAttack();
        return;
      }

      if (action === "ability") {
        combatController.startAbility();
        return;
      }

      if (action === "item") {
        combatController.startItem();
        return;
      }

      if (action === "end_turn" && state.turn.phase === "move") {
        movementController.skipMoveForCurrentUnit();
        return;
      }

      if (action === "end_turn") {
        combatController.completeEndTurnForCurrentUnit();
        return;
      }

    },

    selectMenuAction(action) {
      if (isCommandMenuItemDisabled(state, action)) {
        return;
      }

      if (action === "move") {
        movementController.startMove();
        return;
      }

      if (action === "brace") {
        movementController.completeBraceForCurrentUnit();
        return;
      }

      if (action === "attack") {
        combatController.startAttack();
        return;
      }

      if (action === "ability") {
        combatController.startAbility();
        return;
      }

      if (action === "item") {
        combatController.startItem();
        return;
      }

      if (action === "end_turn" && state.turn.phase === "move") {
        movementController.skipMoveForCurrentUnit();
        return;
      }

      if (action === "end_turn") {
        combatController.completeEndTurnForCurrentUnit();
        return;
      }

    },

    startCombat() {
      if (isDeploymentActive(state) && !getDeploymentReady(state)) {
        return;
      }
      turnController.startCombat();
    },

    openDeploymentList() {
      if (openDeploymentListAtFocus(state)) {
        gameController.render();
      }
    },

    confirmDeploymentPlacement() {
      if (confirmDeploymentPlacement(state)) {
        gameController.render();
      }
    },

    removeDeploymentPlacement() {
      if (removeDeploymentPlacementAtFocus(state)) {
        gameController.render();
      }
    },
    clearTransientUi,
    setActiveUnitByCurrentTurnIndex: turnController.setActiveUnitByCurrentTurnIndex,
    rebuildOrdersAndLog: turnController.rebuildOrdersAndLog,
    resetCombatToSetup: gameController.resetCombatToSetup,

    rotateLeft() {
      gameController.animateRotation(-1);
    },

    rotateRight() {
      gameController.animateRotation(1);
    },

    toggleView: gameController.toggleView,
    zoomIn: gameController.zoomIn,
    zoomOut: gameController.zoomOut,
    startMove: movementController.startMove,
    startAttack: combatController.startAttack,
    startAbility: combatController.startAbility,
    startItem: combatController.startItem,
    waitTurn: combatController.waitTurn,
    confirmAction: combatController.confirmAction,
    cancelAction: combatController.cancelAction,
    resetMap: gameController.resetMapAndUnits
  };

  gameController.resetCombatToSetup();

  bindInput(state, refs, actions);
  bindHudInput(state, refs, actions);

  initializeDevMenu({
    state,
    render: gameController.render,
    refs
  });

  gameController.render();
}

init().catch((error) => {
  console.error("Failed to initialize Ars Caelorum:", error);
});
