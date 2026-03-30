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

  function actions() {
    return {
      render,
      rotateLeft() {
        state.rotation = (state.rotation + 3) % 4;
        render();
      },
      rotateRight() {
        state.rotation = (state.rotation + 1) % 4;
        render();
      },
      resetMap() {
        state.map = resetMap();
        state.mechs = instantiateTestMechs(state.content);

        state.turn.activeMechId =
          state.mechs.length > 0 ? state.mechs[0].instanceId : null;

        state.selection.mechId = state.turn.activeMechId;
        state.selection.action = null;
        state.ui.mode = "idle";
        state.ui.previewPath = [];

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
