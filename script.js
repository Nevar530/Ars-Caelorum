import { createState } from "./src/state.js";
import { createInitialMap, changeElevation, resetMap } from "./src/map.js";
import { createTestMechs } from "./src/mechs.js";
import { renderAll } from "./src/render.js";

const refs = {
  editor: document.getElementById("editor"),
  board: document.getElementById("board"),
  worldGround: document.getElementById("world-ground"),
  worldMechs: document.getElementById("world-mechs"),
  worldUi: document.getElementById("world-ui"),
  rotateLeftButton: document.getElementById("rotateLeft"),
  rotateRightButton: document.getElementById("rotateRight"),
  resetMapButton: document.getElementById("resetMap"),
  rotationLabel: document.getElementById("rotationLabel")
};

const state = createState({
  map: createInitialMap(),
  mechs: createTestMechs(),
  rotation: 0
});

function render() {
  renderAll(state, refs);
}

function handleRaiseTile(x, y) {
  changeElevation(state.map, x, y, 1);
  render();
}

function handleLowerTile(x, y) {
  changeElevation(state.map, x, y, -1);
  render();
}

function handleRotateLeft() {
  state.rotation = (state.rotation + 3) % 4;
  render();
}

function handleRotateRight() {
  state.rotation = (state.rotation + 1) % 4;
  render();
}

function handleResetMap() {
  state.map = resetMap();
  state.mechs = createTestMechs();
  render();
}

function bindEvents() {
  refs.rotateLeftButton.addEventListener("click", handleRotateLeft);
  refs.rotateRightButton.addEventListener("click", handleRotateRight);
  refs.resetMapButton.addEventListener("click", handleResetMap);

  refs.editor.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  state.handlers.raiseTile = handleRaiseTile;
  state.handlers.lowerTile = handleLowerTile;
}

function init() {
  bindEvents();
  render();
}

init();
