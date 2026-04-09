import { createState } from "./src/state.js";
import { createInitialMap } from "./src/map.js";
import {
  instantiateTestMechs,
  getMechAt,
  getMechById,
  moveMechTo,
  setMechFacing
} from "./src/mechs.js";
import { bindInput, snapFocusToActiveMech as snapFocusHelper } from "./src/input.js";
import { loadGameData } from "./src/dataLoader.js";
import { bindHudInput } from "./src/hud.js";
import { clearCombatTextMarkers } from "./src/combat/combatTextOverlay.js";
import { initializeDevMenu } from "./dev/devMenu.js";
import { logDev, setDevLogSize } from "./dev/devLogger.js";
import { createGameController } from "./src/controllers/gameController.js";
import { createTurnController } from "./src/controllers/turnController.js";
import { createMovementController } from "./src/controllers/movementController.js";
import { createCombatController } from "./src/controllers/combatController.js";

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
  hudRoot: document.getElementById("hudRoot"),
  hudLeft: document.getElementById("hudLeft"),
  hudCenter: document.getElementById("hudCenter"),
  hudRight: document.getElementById("hudRight"),
  combatRibbon: document.getElementById("combatRibbon"),
  combatOverlay: document.getElementById("combatOverlay")
};

async function init() {
  const content = await loadGameData();

  const state = createState({
    map: createInitialMap(),
    mechs: instantiateTestMechs(content),
    rotation: 0,
    content
  });

  setDevLogSize(25);

  function snapFocusToActiveMech() {
    snapFocusHelper(state);
  }

  const gameController = createGameController({
    state,
    refs,
    instantiateTestMechs,
    snapFocusToActiveMech,
    logDev
  });

  function clearTransientUi() {
    gameController.clearTransientUi();
  }

  const turnController = createTurnController({
    state,
    getMechById,
    clearTransientUi,
    snapFocusToActiveMech,
    render: gameController.render,
    logDev,
    showSplash: gameController.showSplash,
    clearCombatTextMarkers
  });

  const movementController = createMovementController({
    state,
    getMechById,
    moveMechTo,
    setMechFacing,
    snapFocusToActiveMech,
    clearTransientUi,
    render: gameController.render,
    logDev,
    advanceMoveTurn: turnController.advanceMoveTurn,
    advanceActionTurn: turnController.advanceActionTurn
  });

  const combatController = createCombatController({
    state,
    getMechById,
    getMechAt,
    render: gameController.render,
    logDev,
    clearTransientUi,
    advanceActionTurn: turnController.advanceActionTurn,
    movementController
  });

  const actions = {
    render: gameController.render,
    snapFocusToActiveMech,

    selectFocusedMechIfPresent() {
      return gameController.selectFocusedMechIfPresent(getMechAt);
    },

    openCommandMenu: gameController.openCommandMenu,
    closeCommandMenu: gameController.closeCommandMenu,
    moveMenuSelection: gameController.moveMenuSelection,

    confirmMenuSelection() {
      const menu = state.ui.commandMenu;
      if (!menu.open) return;

      const action = menu.items[menu.index];

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

      if (action === "end_turn") {
        combatController.completeEndTurnForCurrentUnit();
        return;
      }

      if (action === "ability") {
        logDev("Ability menu not implemented yet.");
        gameController.render();
        return;
      }

      if (action === "item") {
        logDev("Item menu not implemented yet.");
        gameController.render();
      }
    },

    selectMenuAction(action) {
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

      if (action === "end_turn") {
        combatController.completeEndTurnForCurrentUnit();
        return;
      }

      if (action === "ability") {
        logDev("Ability menu not implemented yet.");
        gameController.render();
        return;
      }

      if (action === "item") {
        logDev("Item menu not implemented yet.");
        gameController.render();
      }
    },

    startCombat: turnController.startCombat,
    clearTransientUi,
    setActiveMechByCurrentTurnIndex: turnController.setActiveMechByCurrentTurnIndex,
    rebuildOrdersAndLog: turnController.rebuildOrdersAndLog,
    resetCombatToSetup: gameController.resetCombatToSetup,

    rotateLeft() {
      gameController.animateRotation(-1);
    },

    rotateRight() {
      gameController.animateRotation(1);
    },

    toggleView: gameController.toggleView,
    startMove: movementController.startMove,
    startAttack: combatController.startAttack,
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
