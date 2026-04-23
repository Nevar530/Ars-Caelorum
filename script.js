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
import { loadGameData } from "./src/dataLoader.js";
import { bindHudInput } from "./src/ui/hud.js";
import { clearCombatTextMarkers } from "./src/combat/combatTextOverlay.js";
import { initializeDevMenu } from "./dev/devMenu.js";
import { logDev, setDevLogSize } from "./dev/devLogger.js";
import { createGameController } from "./src/controllers/gameController.js";
import { createTurnController } from "./src/controllers/turnController.js";
import { createMovementController } from "./src/controllers/movementController.js";
import { createCombatController } from "./src/controllers/combatController.js";
import { isCommandMenuItemDisabled } from "./src/action.js";

const refs = {
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
    units: instantiateTestUnits(content, initialMap),
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

  const turnController = createTurnController({
    state,
    getUnitById,
    clearTransientUi,
    snapFocusToActiveUnit,
    render: gameController.render,
    logDev,
    showSplash: gameController.showSplash,
    clearCombatTextMarkers
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


  refs.combatOverlay.addEventListener("click", (event) => {
    const button = event.target.closest("[data-combat-overlay-action]");
    if (!button) return;

    if (button.dataset.combatOverlayAction === "restart-mission") {
      actions.resetMap();
    }
  });

  const actions = {
    render: gameController.render,
    snapFocusToActiveUnit,
    toggleHelpDrawer: gameController.toggleHelpDrawer,
    closeHelpDrawer: gameController.closeHelpDrawer,
    
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

    startCombat: turnController.startCombat,
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
