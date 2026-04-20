// src/render/renderTileStyles.js

function makeStyle(fill, stroke, strokeWidth = 2.5, priority = 0) {
  return { fill, stroke, strokeWidth, priority };
}

function setStyle(styleMap, x, y, style) {
  const key = `${x},${y}`;
  const current = styleMap.get(key);

  if (!current || (style.priority ?? 0) >= (current.priority ?? 0)) {
    styleMap.set(key, style);
  }
}

function styleForEvaluatedTarget(tile) {
  const cover = tile.cover ?? "none";
  const visible = tile.visible ?? tile.los?.visible ?? false;

  if (visible && cover === "none") {
    return makeStyle(
      "rgba(82, 208, 146, 0.18)",
      "rgba(82, 208, 146, 0.98)",
      3,
      60
    );
  }

  if (visible && cover === "half") {
    return makeStyle(
      "rgba(240, 176, 0, 0.18)",
      "rgba(240, 176, 0, 0.98)",
      3,
      60
    );
  }

  return makeStyle(
    "rgba(255, 74, 74, 0.18)",
    "rgba(255, 74, 74, 0.98)",
    3,
    60
  );
}

export function buildTileOverlayStyleMap(state, reachableMap = new Map()) {
  const styleMap = new Map();

  if (state.ui?.mode === "move") {
    for (const tile of reachableMap.values()) {
      setStyle(styleMap, tile.x, tile.y, makeStyle(
        "rgba(80, 180, 255, 0.14)",
        "rgba(80, 180, 255, 0.92)",
        2.5,
        10
      ));
    }

    for (const tile of state.ui?.previewPath || []) {
      setStyle(styleMap, tile.x, tile.y, makeStyle(
        "rgba(240, 176, 0, 0.16)",
        "rgba(240, 176, 0, 1)",
        3,
        30
      ));
    }
  }

  if (state.focus) {
    setStyle(styleMap, state.focus.x, state.focus.y, makeStyle(
      "rgba(240, 176, 0, 0.12)",
      "rgba(240, 176, 0, 1)",
      3,
      40
    ));
  }

  if (state.ui?.mode === "action-target") {
    for (const tile of state.ui?.action?.fireArcTiles || []) {
      setStyle(styleMap, tile.x, tile.y, makeStyle(
        "rgba(255, 176, 0, 0.14)",
        "rgba(255, 176, 0, 0.96)",
        2.5,
        20
      ));
    }

    for (const tile of state.ui?.action?.evaluatedTargetTiles || []) {
      setStyle(styleMap, tile.x, tile.y, styleForEvaluatedTarget(tile));
    }

    for (const tile of state.ui?.action?.effectTiles || []) {
      setStyle(styleMap, tile.x, tile.y, makeStyle(
        "rgba(255, 74, 74, 0.18)",
        "rgba(255, 74, 74, 1)",
        3.25,
        80
      ));
    }
  }

  return styleMap;
}

export function getTileOverlayStyle(styleMap, x, y) {
  return styleMap?.get(`${x},${y}`) ?? null;
}
