// src/render/renderTileStyles.js

import { getUnitById } from "../mechs.js";
import { getPrimaryOccupantAt } from "../scale/occupancy.js";
import { getUnitOccupiedCells } from "../scale/scaleMath.js";

function makeStyle(fill, stroke, strokeWidth = 2.5, priority = 0) {
  return { fill, stroke, strokeWidth, priority };
}

const OVERLAY_COLORS = {
  move: {
    fill: "rgba(32, 214, 255, 0.20)",
    stroke: "rgba(32, 214, 255, 1)"
  },
  path: {
    fill: "rgba(255, 255, 255, 0.18)",
    stroke: "rgba(255, 255, 255, 1)"
  },
  focus: {
    fill: "rgba(255, 225, 32, 0.22)",
    stroke: "rgba(255, 225, 32, 1)"
  },
  active: {
    fill: "rgba(32, 214, 255, 0.14)",
    stroke: "rgba(32, 214, 255, 1)"
  },
  hostile: {
    fill: "rgba(255, 48, 48, 0.18)",
    stroke: "rgba(255, 48, 48, 1)"
  },
  special: {
    fill: "rgba(194, 86, 255, 0.18)",
    stroke: "rgba(194, 86, 255, 1)"
  }
};

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
      OVERLAY_COLORS.hostile.fill,
      OVERLAY_COLORS.hostile.stroke,
      6,
      60
    );
  }

  if (visible && cover === "half") {
    return makeStyle(
      OVERLAY_COLORS.special.fill,
      OVERLAY_COLORS.special.stroke,
      6,
      60
    );
  }

  return makeStyle(
    OVERLAY_COLORS.hostile.fill,
    OVERLAY_COLORS.hostile.stroke,
    6,
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
      OVERLAY_COLORS.move.fill,
      OVERLAY_COLORS.move.stroke,
      6,
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
      OVERLAY_COLORS.path.fill,
      OVERLAY_COLORS.path.stroke,
      6.5,
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

  if (activeUnit && state.ui?.mode !== "move" && state.ui?.mode !== "face") {
    const activeStyle = makeStyle(
      OVERLAY_COLORS.active.fill,
      OVERLAY_COLORS.active.stroke,
      6,
      15
    );

    setStyleForCells(styleMap, getUnitOccupiedCells(activeUnit), activeStyle);
  }

  if (state.focus) {
    const focusStyle = makeStyle(
      OVERLAY_COLORS.focus.fill,
      OVERLAY_COLORS.focus.stroke,
      7,
      40
    );

    const focusCells = state.ui?.mode === "move"
      ? getPreviewFootprintCells(activeUnit, state.focus.x, state.focus.y)
      : [{ x: state.focus.x, y: state.focus.y }];

    setStyleForCells(styleMap, focusCells, focusStyle);
  }

  if (state.ui?.mode === "action-target") {
    const fireArcStyle = makeStyle(
      OVERLAY_COLORS.special.fill,
      OVERLAY_COLORS.special.stroke,
      6,
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
      OVERLAY_COLORS.hostile.fill,
      OVERLAY_COLORS.hostile.stroke,
      7,
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
