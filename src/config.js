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
    mech: { cols: 9, rows: 9 },
    pilot: { cols: 6, rows: 6 }
  },

  iso: {
    map: { spanX: null, spanY: null },
    mech: { spanX: 5, spanY: 5 },
    pilot: { spanX: .5, spanY: .5 }
  }
};

export const RENDER_CONFIG = {
  isoTileWidth: 192,
  isoTileHeight: 96,
  elevationStepPx: 48,
  originX: 700,
  originY: 140,
  sceneWidth: 1400,
  sceneHeight: 900,
  editorSize: 760,
  editorPadding: 18,
  showCoords: false
};
