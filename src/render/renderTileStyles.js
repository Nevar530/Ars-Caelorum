// src/render/renderTileStyles.js

import { getUnitById } from "../mechs.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getUnitOccupiedCells } from "../scale/scaleMath.js";

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

function setStyleForCells(styleMap, cells, style) {
  for (const cell of cells || []) {
    setStyle(styleMap, cell.x, cell.y, style);
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

function getActiveUnit(state) {
  const activeId = state.turn?.activeUnitId ?? null;
  if (!activeId) return null;
  return getUnitById(state.units ?? [], activeId);
}

function getPreviewFootprintCells(activeUnit, x, y) {
  if (!activeUnit) return [{ x, y }];
  return getUnitOccupiedCells({ ...activeUnit, x, y });
}

function getOccupantFootprintCells(state, x, y) {
  const occupant = getPrimaryOccupantAt(state, x, y);
  return occupant?.unit ? getUnitOccupiedCells(occupant.unit) : [{ x, y }];
}

export function buildTileOverlayStyleMap(state, reachableMap = new Map()) {
  const styleMap = new Map();
  const activeUnit = getActiveUnit(state);

  if (state.ui?.mode === "move") {
    const moveRangeStyle = makeStyle(
      "rgba(80, 180, 255, 0.14)",
      "rgba(80, 180, 255, 0.92)",
      2.5,
      10
    );

    for (const tile of reachableMap.values()) {
      setStyleForCells(
        styleMap,
        getPreviewFootprintCells(activeUnit, tile.x, tile.y),
        moveRangeStyle
      );
    }

    const pathStyle = makeStyle(
      "rgba(240, 176, 0, 0.16)",
      "rgba(240, 176, 0, 1)",
      3,
      30
    );

    for (const tile of state.ui?.previewPath || []) {
      setStyleForCells(
        styleMap,
        getPreviewFootprintCells(activeUnit, tile.x, tile.y),
        pathStyle
      );
    }
  }

  if (state.focus) {
    const focusStyle = makeStyle(
      "rgba(240, 176, 0, 0.12)",
      "rgba(240, 176, 0, 1)",
      3,
      40
    );

    const focusCells = state.ui?.mode === "move"
      ? getPreviewFootprintCells(activeUnit, state.focus.x, state.focus.y)
      : [{ x: state.focus.x, y: state.focus.y }];

    setStyleForCells(styleMap, focusCells, focusStyle);
  }

  if (state.ui?.mode === "action-target") {
    const fireArcStyle = makeStyle(
      "rgba(255, 176, 0, 0.14)",
      "rgba(255, 176, 0, 0.96)",
      2.5,
      20
    );

    for (const tile of state.ui?.action?.fireArcTiles || []) {
      setStyle(styleMap, tile.x, tile.y, fireArcStyle);
    }

    for (const tile of state.ui?.action?.evaluatedTargetTiles || []) {
      setStyleForCells(
        styleMap,
        getOccupantFootprintCells(state, tile.x, tile.y),
        styleForEvaluatedTarget(tile)
      );
    }

    const effectStyle = makeStyle(
      "rgba(255, 74, 74, 0.18)",
      "rgba(255, 74, 74, 1)",
      3.25,
      80
    );

    for (const tile of state.ui?.action?.effectTiles || []) {
      setStyle(styleMap, tile.x, tile.y, effectStyle);
    }
  }

  return styleMap;
}

export function getTileOverlayStyle(styleMap, x, y) {
  return styleMap?.get(`${x},${y}`) ?? null;
}
