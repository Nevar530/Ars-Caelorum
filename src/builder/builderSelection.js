// src/builder/builderSelection.js
//
// Central selection helpers for the new Mission Builder.
// Selection is builder-owned authoring state. It points at runtime/map truth,
// but it does not mutate map data by itself.

export function createMapSelection(appState) {
  const map = appState?.map ?? null;
  return {
    type: "map",
    id: map?.id ?? "runtime-map",
    label: map?.name ?? map?.id ?? "Runtime Map"
  };
}

export function createTileSelection(appState, x, y) {
  const tileX = Number(x);
  const tileY = Number(y);
  const map = appState?.map ?? null;

  return {
    type: "tile",
    id: `${tileX},${tileY}`,
    label: `Tile ${tileX}, ${tileY}`,
    x: tileX,
    y: tileY,
    mapId: map?.id ?? null,
    dataPath: `map.tiles[${tileX},${tileY}]`
  };
}

export function createEdgeSelection(appState, x, y, edge) {
  const tileX = Number(x);
  const tileY = Number(y);
  const edgeId = String(edge ?? "").toLowerCase();
  const map = appState?.map ?? null;

  return {
    type: "edge",
    id: `${tileX},${tileY},${edgeId}`,
    label: `Edge ${tileX}, ${tileY} ${edgeId.toUpperCase()}`,
    x: tileX,
    y: tileY,
    edge: edgeId,
    mapId: map?.id ?? null,
    dataPath: `map.structures[*].edges[${tileX},${tileY},${edgeId}]`
  };
}

export function setBuilderSelection(builderState, selection) {
  if (!builderState) return;
  builderState.selected = selection && typeof selection === "object"
    ? selection
    : { type: "none", id: "none", label: "None" };
}

export function setBuilderHover(builderState, hover) {
  if (!builderState) return;
  builderState.hover = hover && typeof hover === "object" ? hover : null;
}

export function moveBuilderTileSelection(builderState, appState, screenDirection) {
  if (!builderState || !appState?.map) return null;

  const selected = builderState.selected ?? null;
  const start = getSelectionStartTile(selected, appState);
  const delta = getBoardDeltaFromScreenDirection(appState?.rotation, screenDirection);
  const width = getMapWidth(appState.map);
  const height = getMapHeight(appState.map);

  if (width <= 0 || height <= 0) return null;

  const nextX = clamp(start.x + delta.dx, 0, width - 1);
  const nextY = clamp(start.y + delta.dy, 0, height - 1);

  const nextSelection = createTileSelection(appState, nextX, nextY);
  setBuilderSelection(builderState, nextSelection);
  return nextSelection;
}

function getSelectionStartTile(selected, appState) {
  if ((selected?.type === "tile" || selected?.type === "edge") && Number.isFinite(Number(selected.x)) && Number.isFinite(Number(selected.y))) {
    return {
      x: Number(selected.x),
      y: Number(selected.y)
    };
  }

  const focus = appState?.focus ?? {};
  if (Number.isFinite(Number(focus.x)) && Number.isFinite(Number(focus.y))) {
    return {
      x: Number(focus.x),
      y: Number(focus.y)
    };
  }

  const width = getMapWidth(appState?.map);
  const height = getMapHeight(appState?.map);
  return {
    x: Math.floor(Math.max(0, width - 1) / 2),
    y: Math.floor(Math.max(0, height - 1) / 2)
  };
}

function getBoardDeltaFromScreenDirection(rotation, direction) {
  const facing = getWorldFacingFromScreenDirection(rotation, direction);

  switch (facing) {
    case 0:
      return { dx: 0, dy: -1 };
    case 1:
      return { dx: 1, dy: 0 };
    case 2:
      return { dx: 0, dy: 1 };
    case 3:
      return { dx: -1, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}

function getWorldFacingFromScreenDirection(rotation, direction) {
  const baseFacing = screenDirectionToBaseFacing(direction);
  if (baseFacing === null) return null;

  const rot = normalizeRotation(rotation);
  return ((baseFacing - rot) + 4) % 4;
}

function screenDirectionToBaseFacing(direction) {
  switch (direction) {
    case "up":
      return 0;
    case "right":
      return 1;
    case "down":
      return 2;
    case "left":
      return 3;
    default:
      return null;
  }
}

function normalizeRotation(value) {
  const n = Number(value);
  return Number.isFinite(n) ? ((n % 4) + 4) % 4 : 0;
}

function getMapWidth(map) {
  const value = Number(map?.width ?? map?.cols ?? 0);
  if (Number.isFinite(value) && value > 0) return Math.floor(value);

  const tiles = Array.isArray(map?.tiles) ? map.tiles : [];
  return tiles.length;
}

function getMapHeight(map) {
  const value = Number(map?.height ?? map?.rows ?? 0);
  if (Number.isFinite(value) && value > 0) return Math.floor(value);

  const tiles = Array.isArray(map?.tiles) ? map.tiles : [];
  const firstColumn = Array.isArray(tiles[0]) ? tiles[0] : [];
  return firstColumn.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}
