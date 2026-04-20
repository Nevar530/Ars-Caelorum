import {
  applyMapEditorAtTile,
  ensureMapEditorState,
  sampleMapEditorFromTile
} from "../../dev/mapEditor/mapEditorActions.js";
import { getBrushedTileCoords } from "../../dev/mapEditor/mapBrush.js";

function updateEditorHover(state, x, y) {
  const editorState = ensureMapEditorState(state);
  const mapWidth = state.map?.width ?? state.map?.mechWidth ?? 0;
  const mapHeight = state.map?.height ?? state.map?.mechHeight ?? 0;
  editorState.hoverTiles = getBrushedTileCoords(x, y, editorState.brushSize, mapWidth, mapHeight);
}

function emitEditorUpdate(detail) {
  window.dispatchEvent(new CustomEvent("ac:map-editor-updated", { detail }));
}

export function bindEditorInput(state, refs, actions) {
  const { editor, editorModeMechButton, editorModeDetailButton } = refs;

  if (editorModeMechButton) {
    editorModeMechButton.addEventListener("click", () => {
      actions.setEditorMode("mech");
      actions.render();
    });
  }

  if (editorModeDetailButton) {
    editorModeDetailButton.style.display = "none";
    editorModeDetailButton.disabled = true;
  }

  if (!editor) return;

  editor.addEventListener("mousemove", (event) => {
    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);
    updateEditorHover(state, x, y);
    emitEditorUpdate({ x, y, source: "hover" });
    actions.render();
  });

  editor.addEventListener("mouseleave", () => {
    const editorState = ensureMapEditorState(state);
    editorState.hoverTiles = [];
    emitEditorUpdate({ source: "hover-clear" });
    actions.render();
  });

  editor.addEventListener("click", (event) => {
    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    state.ui.editor.selectedTile.x = x;
    state.ui.editor.selectedTile.y = y;
    state.ui.editor.mode = "mech";

    const editorState = ensureMapEditorState(state);
    updateEditorHover(state, x, y);
    if (editorState.isEnabled) {
      applyMapEditorAtTile(state, x, y);
    }

    emitEditorUpdate({ x, y, source: "paint" });
    actions.render();
  });

  editor.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    const tileRect = event.target.closest(".editor-cell");
    if (!tileRect) return;

    const x = Number(tileRect.dataset.x);
    const y = Number(tileRect.dataset.y);

    state.ui.editor.selectedTile.x = x;
    state.ui.editor.selectedTile.y = y;
    state.ui.editor.mode = "mech";

    const editorState = ensureMapEditorState(state);
    updateEditorHover(state, x, y);
    if (editorState.isEnabled) {
      sampleMapEditorFromTile(state, x, y);
    }

    emitEditorUpdate({ x, y, source: "sample" });
    actions.render();
  });
}
