import { createState } from "./src/state.js";
import { createInitialMap, resetMap } from "./src/map.js";
import {
  instantiateTestMechs,
  getMechById,
  getMechAt,
  moveMechTo,
  setMechFacing
} from "./src/mechs.js";
import { renderAll } from "./src/render.js";
import { bindInput, snapFocusToActiveMech as snapFocusHelper } from "./src/input.js";
import { loadGameData } from "./src/dataLoader.js";
import { canMoveActiveMechTo, getPathToTile } from "./src/movement.js";
import { renderHud, bindHudInput } from "./src/hud.js";
import {
  getCommandMenuItemsForPhase,
  resetActionUiState,
  startAttackSelection,
  confirmAttackSelection,
  confirmActionTarget,
  cancelActionState
} from "./src/action.js";
import {
  rebuildRoundOrder,
  getActiveUnitFromPhaseOrder
} from "./src/initiative.js";
import { initializeDevMenu } from "./dev/devMenu.js";
import { logDev } from "./dev/devLogger.js";

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

function facingToLabel(facing) {
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

async function init() {
  const content = await loadGameData();

  const state = createState({
    map: createInitialMap(),
    mechs: instantiateTestMechs(content),
    rotation: 0,
    content
  });

  let splashTimer = null;

  function render() {
    renderAll(state, refs);
    renderHud(state, refs);
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

  function snapFocusToActiveMech() {
    snapFocusHelper(state);
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

  function setActiveMechByCurrentTurnIndex() {
    const activeMechId = getActiveUnitFromPhaseOrder(state);

    state.turn.activeMechId = activeMechId ?? null;
    state.selection.mechId = activeMechId ?? null;

    if (activeMechId) {
      snapFocusToActiveMech();
    }
  }

  function logRoundInitiative() {
    for (const roll of state.turn.lastInitiativeRolls) {
      logDev(
        `${roll.name} / ${roll.pilotName || "No Pilot"} initiative = ${roll.initiative} (${roll.dice[0]}+${roll.dice[1]}+${roll.reaction})`
      );
    }
  }

  function rebuildOrdersAndLog() {
    rebuildRoundOrder(state);
    logDev(`Initiative rerolled for Round ${state.turn.round}.`);
    logRoundInitiative();
  }

  function startCombat() {
    if (state.turn.combatStarted) return;
    if (!state.mechs.length) return;

    clearTransientUi();
    state.turn.combatStarted = true;
    state.turn.round = 1;
    state.turn.phase = "move";

    rebuildOrdersAndLog();

    state.turn.moveIndex = 0;
    state.turn.actionIndex = -1;
    setActiveMechByCurrentTurnIndex();

    logDev("Combat started.");
    logDev("Phase changed to MOVE.");
    showSplash(`ROUND ${state.turn.round} — MOVEMENT PHASE`);

    render();
  }

  function beginActionPhase() {
    state.turn.phase = "action";
    state.turn.actionIndex = 0;
    state.turn.moveIndex = state.turn.moveOrder.length;

    clearTransientUi();
    setActiveMechByCurrentTurnIndex();

    logDev("Phase changed to ACTION.");
    showSplash(`ROUND ${state.turn.round} — ACTION PHASE`);

    render();
  }

  function endRoundAndBeginNext() {
    state.turn.round += 1;
    state.turn.phase = "move";

    clearTransientUi();
    rebuildOrdersAndLog();

    state.turn.moveIndex = 0;
    state.turn.actionIndex = -1;
    setActiveMechByCurrentTurnIndex();

    logDev(`Round advanced to ${state.turn.round}.`);
    logDev("Phase changed to MOVE.");
    showSplash(`ROUND ${state.turn.round} — MOVEMENT PHASE`);

    render();
  }

  function advanceMoveTurn() {
    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (activeMech) {
      activeMech.hasMoved = true;
    }

    state.turn.moveIndex += 1;

    if (state.turn.moveIndex < state.turn.moveOrder.length) {
      clearTransientUi();
      setActiveMechByCurrentTurnIndex();
      render();
      return;
    }

    beginActionPhase();
  }

  function advanceActionTurn() {
    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (activeMech) {
      activeMech.hasActed = true;
    }

    state.turn.actionIndex += 1;

    if (state.turn.actionIndex < state.turn.actionOrder.length) {
      clearTransientUi();
      setActiveMechByCurrentTurnIndex();
      render();
      return;
    }

    endRoundAndBeginNext();
  }

  function selectFocusedMechIfPresent() {
    if (state.turn.combatStarted) return false;
    if (state.ui.mode !== "idle") return false;
    if (state.ui.commandMenu.open) return false;

    const hoveredMech = getMechAt(state.mechs, state.focus.x, state.focus.y);
    if (!hoveredMech) return false;

    if (state.selection.mechId === hoveredMech.instanceId) {
      return true;
    }

    state.selection.mechId = hoveredMech.instanceId;

    logDev(
      `${hoveredMech.name} selected at (${hoveredMech.x},${hoveredMech.y}).`
    );

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

  function confirmMenuSelection() {
    const menu = state.ui.commandMenu;
    if (!menu.open) return;

    const action = menu.items[menu.index];
    selectMenuAction(action);
  }

  function completeBraceForCurrentUnit() {
    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    activeMech.isBraced = true;
    logDev(`${activeMech.name} braced.`);

    clearTransientUi();

    if (state.turn.phase === "move") {
      advanceMoveTurn();
      return;
    }

    if (state.turn.phase === "action") {
      advanceActionTurn();
    }
  }

  function completeEndTurnForCurrentUnit() {
    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    logDev(`${activeMech.name} ended action turn.`);
    clearTransientUi();
    advanceActionTurn();
  }

  function selectMenuAction(action) {
    if (action === "move") {
      startMove();
      return;
    }

    if (action === "brace") {
      completeBraceForCurrentUnit();
      return;
    }

    if (action === "attack") {
      startAttack();
      return;
    }

    if (action === "end_turn") {
      completeEndTurnForCurrentUnit();
      return;
    }

    if (action === "ability") {
      logDev("Ability menu not implemented yet.");
      render();
      return;
    }

    if (action === "item") {
      logDev("Item menu not implemented yet.");
      render();
    }
  }

  function getDefaultFacingFromPath(path, fallbackFacing) {
    if (!path || path.length < 2) return fallbackFacing;

    const last = path[path.length - 1];
    const prev = path[path.length - 2];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;

    if (dx === 0 && dy === -1) return 0;
    if (dx === 1 && dy === 0) return 1;
    if (dx === 0 && dy === 1) return 2;
    if (dx === -1 && dy === 0) return 3;

    return fallbackFacing;
  }

  function startMove() {
    if (!state.turn.combatStarted || state.turn.phase !== "move") return;

    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    state.ui.commandMenu.open = false;

    state.ui.preMove = {
      mechId: activeMech.instanceId,
      x: activeMech.x,
      y: activeMech.y,
      facing: activeMech.facing
    };

    state.ui.mode = "move";
    state.selection.action = "move";
    state.ui.facingPreview = null;
    state.ui.previewPath = [];
    snapFocusToActiveMech();

    logDev(
      `${activeMech.name} started movement from (${activeMech.x},${activeMech.y}).`
    );

    render();
  }

  function startAttack() {
    if (!state.turn.combatStarted || state.turn.phase !== "action") return;

    const activeMech = getMechById(state.mechs, state.turn.activeMechId);
    if (!activeMech) return;

    if (!startAttackSelection(state)) return;

    logDev(`${activeMech.name} entered attack selection.`);
    render();
  }

  function waitTurn() {
    if (state.turn.phase === "move") {
      completeBraceForCurrentUnit();
      return;
    }

    if (state.turn.phase === "action") {
      completeEndTurnForCurrentUnit();
    }
  }

  function confirmAction() {
    if (state.ui.mode === "move") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      if (!activeMech) return;

      if (canMoveActiveMechTo(state, state.focus.x, state.focus.y)) {
        const fromX = activeMech.x;
        const fromY = activeMech.y;

        const defaultFacing = getDefaultFacingFromPath(
          state.ui.previewPath,
          activeMech.facing
        );

        moveMechTo(
          state.mechs,
          activeMech.instanceId,
          state.focus.x,
          state.focus.y
        );

        logDev(
          `${activeMech.name} moved from (${fromX},${fromY}) to (${state.focus.x},${state.focus.y}).`
        );

        state.ui.mode = "face";
        state.selection.action = "face";
        state.ui.previewPath = [];
        state.ui.facingPreview = defaultFacing;
        snapFocusToActiveMech();
        render();
      }

      return;
    }

    if (state.ui.mode === "action-attack-select") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);

      if (confirmAttackSelection(state)) {
        const selectedAttack = state.ui.action.selectedAction;
        if (activeMech && selectedAttack) {
          logDev(`${activeMech.name} selected attack ${selectedAttack.name}.`);
        }
        render();
      }
      return;
    }

    if (state.ui.mode === "action-target") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      const selectedAttack = state.ui.action.selectedAction;
      const targetX = state.focus.x;
      const targetY = state.focus.y;
      const targetMech = getMechAt(state.mechs, targetX, targetY);

      if (confirmActionTarget(state)) {
        if (activeMech && selectedAttack) {
          if (targetMech) {
            logDev(
              `${activeMech.name} targeted ${targetMech.name} with ${selectedAttack.name}.`
            );
          } else {
            logDev(
              `${activeMech.name} targeted tile (${targetX},${targetY}) with ${selectedAttack.name}.`
            );
          }
        }

        clearTransientUi();
        advanceActionTurn();
      }
      return;
    }

    if (state.ui.mode === "face") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      if (!activeMech) return;

      if (state.ui.facingPreview !== null) {
        setMechFacing(
          state.mechs,
          activeMech.instanceId,
          state.ui.facingPreview
        );

        logDev(
          `${activeMech.name} facing set to ${facingToLabel(state.ui.facingPreview)}.`
        );
      }

      clearTransientUi();
      advanceMoveTurn();
    }
  }

  function cancelAction() {
    if (cancelActionState(state)) {
      render();
      return;
    }

    if (state.ui.mode === "move") {
      state.ui.mode = "idle";
      state.selection.action = null;
      state.ui.previewPath = [];
      state.ui.facingPreview = null;
      state.ui.preMove = null;
      state.ui.commandMenu.open = true;
      state.ui.commandMenu.index = 0;
      snapFocusToActiveMech();
      render();
      return;
    }

    if (state.ui.mode === "face") {
      const snap = state.ui.preMove;

      if (snap) {
        moveMechTo(state.mechs, snap.mechId, snap.x, snap.y);
        setMechFacing(state.mechs, snap.mechId, snap.facing);
      }

      state.ui.mode = "move";
      state.selection.action = "move";
      state.ui.facingPreview = null;
      snapFocusToActiveMech();
      state.ui.previewPath = getPathToTile(state, state.focus.x, state.focus.y);
      render();
      return;
    }

    if (state.ui.mode === "idle" && state.ui.commandMenu.open) {
      closeCommandMenu();
    }
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

  function resetCombatToSetup() {
    clearTransientUi();
    hideSplash();

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

  function actions() {
    return {
      render,
      snapFocusToActiveMech,
      selectFocusedMechIfPresent,
      openCommandMenu,
      closeCommandMenu,
      moveMenuSelection,
      confirmMenuSelection,
      selectMenuAction,
      startCombat,
      clearTransientUi,
      setActiveMechByCurrentTurnIndex,
      rebuildOrdersAndLog,
      resetCombatToSetup,

      rotateLeft() {
        animateRotation(-1);
      },

      rotateRight() {
        animateRotation(1);
      },

      toggleView,

      startMove,
      startAttack,
      waitTurn,
      confirmAction,
      cancelAction,

      resetMap() {
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
    };
  }

  resetCombatToSetup();

  const boundActions = actions();

  bindInput(state, refs, boundActions);
  bindHudInput(state, refs, boundActions);

  initializeDevMenu({
    state,
    render,
    refs
  });

  render();
}

init().catch((error) => {
  console.error("Failed to initialize Ars Caelorum:", error);
});
