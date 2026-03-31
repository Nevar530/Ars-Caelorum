import { createState } from "./src/state.js";
import { createInitialMap, resetMap } from "./src/map.js";
import { instantiateTestMechs } from "./src/mechs.js";
import { renderAll } from "./src/render.js";
import { bindInput } from "./src/input.js";
import { loadGameData } from "./src/dataLoader.js";

const refs = {
  editor: document.getElementById("editor"),
  board: document.getElementById("board"),
  worldScene: document.getElementById("world-scene"),
  worldUi: document.getElementById("world-ui"),
  rotateLeftButton: document.getElementById("rotateLeft"),
  rotateRightButton: document.getElementById("rotateRight"),
  toggleViewButton: document.getElementById("toggleView"),
  resetMapButton: document.getElementById("resetMap"),
  rotationLabel: document.getElementById("rotationLabel")
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

      rotateLeft() {
        animateRotation(-1);
      },

      rotateRight() {
        animateRotation(1);
      },

      toggleView,

      resetMap() {
        state.map = resetMap();
        state.mechs = instantiateTestMechs(state.content);

        state.turn.activeMechId =
          state.mechs.length > 0 ? state.mechs[0].instanceId : null;

        state.selection.mechId = state.turn.activeMechId;
        state.selection.action = null;
        state.ui.mode = "idle";
        state.ui.previewPath = [];

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

  bindInput(state, refs, actions());
  render();
}

init().catch((error) => {
  console.error("Failed to initialize Ars Caelorum:", error);
});
