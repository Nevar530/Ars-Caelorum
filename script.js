import { createState } from "./src/state.js";
import { createInitialMap, resetMap } from "./src/map.js";
import {
  instantiateTestMechs,
  getMechById,
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
import { initializeDevMenu } from "./dev/devMenu.js";

const refs = {
  editor: document.getElementById("editor"),
  board: document.getElementById("board"),
  worldScene: document.getElementById("world-scene"),
  worldUi: document.getElementById("world-ui"),
  rotateLeftButton: document.getElementById("rotateLeft"),
  rotateRightButton: document.getElementById("rotateRight"),
  toggleViewButton: document.getElementById("toggleView"),
  resetMapButton: document.getElementById("resetMap"),
  rotationLabel: document.getElementById("rotationLabel"),
  hudRoot: document.getElementById("hudRoot"),
  hudLeft: document.getElementById("hudLeft"),
  hudCenter: document.getElementById("hudCenter"),
  hudRight: document.getElementById("hudRight")
};

async function init() {
  const content = await loadGameData();

  const state = createState({
    map: createInitialMap(),
    mechs: instantiateTestMechs(content),
    rotation: 0,
    content
  });

  function render() {
    renderAll(state, refs);
    renderHud(state, refs);
  }

  function snapFocusToActiveMech() {
    snapFocusHelper(state);
  }

  function openCommandMenu() {
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

  function selectMenuAction(action) {
    if (action === "move") {
      startMove();
      return;
    }

    if (action === "brace") {
      waitTurn();
      return;
    }

    if (action === "attack") {
      startAttack();
      return;
    }

    if (action === "end_turn") {
      waitTurn();
      return;
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
    render();
  }

  function startAttack() {
    if (!startAttackSelection(state)) return;
    render();
  }

  function waitTurn() {
    state.ui.mode = "idle";
    state.selection.action = null;
    state.ui.previewPath = [];
    state.ui.facingPreview = null;
    state.ui.preMove = null;
    resetActionUiState(state);
    state.ui.commandMenu.open = false;
    state.ui.commandMenu.index = 0;

    if (state.turn.phase === "move") {
      state.turn.phase = "action";
    } else {
      state.turn.phase = "move";
      state.turn.round += 1;
    }

    state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase);
    snapFocusToActiveMech();
    render();
  }

  function confirmAction() {
    if (state.ui.mode === "move") {
      const activeMech = getMechById(state.mechs, state.turn.activeMechId);
      if (!activeMech) return;

      if (canMoveActiveMechTo(state, state.focus.x, state.focus.y)) {
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
      if (confirmAttackSelection(state)) {
        render();
      }
      return;
    }

    if (state.ui.mode === "action-target") {
      if (confirmActionTarget(state)) {
        resetActionUiState(state);
        state.turn.phase = "move";
        state.turn.round += 1;
        state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase);
        snapFocusToActiveMech();
        render();
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
      }

      state.ui.mode = "idle";
      state.selection.action = null;
      state.ui.previewPath = [];
      state.ui.facingPreview = null;
      state.ui.preMove = null;
      state.ui.commandMenu.open = false;
      state.ui.commandMenu.index = 0;
      state.turn.phase = "action";
      state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase);
      snapFocusToActiveMech();
      render();
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

  function actions() {
    return {
      render,
      snapFocusToActiveMech,
      openCommandMenu,
      closeCommandMenu,
      moveMenuSelection,
      confirmMenuSelection,
      selectMenuAction,

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

        state.turn.activeMechId =
          state.mechs.length > 0 ? state.mechs[0].instanceId : null;

        state.selection.mechId = state.turn.activeMechId;
        state.selection.action = null;

        state.ui.mode = "idle";
        state.ui.previewPath = [];
        state.ui.facingPreview = null;
        state.ui.preMove = null;
        resetActionUiState(state);
        state.ui.commandMenu.open = false;
        state.ui.commandMenu.index = 0;
        state.ui.commandMenu.items = getCommandMenuItemsForPhase(state.turn.phase);

        state.rotation = 0;
        state.camera.angle = 0;
        state.camera.isTurning = false;
        state.ui.viewMode = "iso";

        if (state.mechs.length > 0) {
          state.focus.x = state.mechs[0].x;
          state.focus.y = state.mechs[0].y;
        } else {
          state.focus.x = 0;
          state.focus.y = 0;
        }

        render();
      }
    };
  }

  const boundActions = actions();

  bindInput(state, refs, boundActions);
  bindHudInput(state, refs, boundActions);

  initializeDevMenu({
    state,
    render
  });

  render();
}

init().catch((error) => {
  console.error("Failed to initialize Ars Caelorum:", error);
});
