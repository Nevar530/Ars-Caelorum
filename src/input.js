import { changeElevation } from "./map.js";

export function bindInput(state, refs, actions) {
  const {
    editor,
    rotateLeftButton,
    rotateRightButton,
    resetMapButton
  } = refs;

  rotateLeftButton.addEventListener("click", () => {
    actions.rotateLeft();
  });

  rotateRightButton.addEventListener("click", () => {
    actions.rotateRight();
  });

  resetMapButton.addEventListener("click", () => {
    actions.resetMap();
  });

  editor.addEventListener("click", (event) => {
    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    changeElevation(state.map, x, y, 1);
    actions.render();
  });

  editor.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    changeElevation(state.map, x, y, -1);
    actions.render();
  });
}
