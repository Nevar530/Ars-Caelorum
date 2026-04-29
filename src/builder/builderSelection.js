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
