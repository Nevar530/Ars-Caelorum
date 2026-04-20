// src/config.js

export const GAME_CONFIG = {
  baseGridIsTruth: true,

  footprintByUnitType: {
    pilot: { width: 1, height: 1 },
    mech: { width: 3, height: 3 },
    structure: { width: 1, height: 1 }
  },

  anchorType: "center",

  // Legacy bridge values kept alive until sprite / structure phases consume them directly.
  detailSubdivisionsPerMechTile: 1,
  detailElevationPerMechLevel: 1,
  humanTilesPerMechTile: 2
};

export const MAP_CONFIG = {
  width: 40,
  height: 40,

  // Deprecated compatibility keys. New code should use width/height only.
  mechWidth: 40,
  mechHeight: 40,

  minElevation: 0,
  maxElevation: 40
};

export const CAMERA_ZOOM_CONFIG = {
  levels: ["map", "mech", "pilot"],

  topdown: {
    map: { cols: null, rows: null },
    mech: { cols: 18, rows: 18 },
    pilot: { cols: 12, rows: 12 }
  },

  iso: {
    map: { spanX: null, spanY: null },
    mech: { spanX: 10, spanY: 10 },
    pilot: { spanX: 6, spanY: 6 }
  }
};

export const RENDER_CONFIG = {
  isoTileWidth: 96,
  isoTileHeight: 48,
  elevationStepPx: 24,
  originX: 700,
  originY: 140,
  sceneWidth: 1400,
  sceneHeight: 900,
  editorSize: 760,
  editorPadding: 18,
  showCoords: false
};
