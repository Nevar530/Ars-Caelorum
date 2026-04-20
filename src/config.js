// src/config.js

export const GAME_CONFIG = {
  baseGridIsTruth: true,

  footprintByUnitType: {
    pilot: { width: 1, height: 1 },
    mech: { width: 3, height: 3 },
    structure: { width: 1, height: 1 }
  },

  anchorType: "center",

  // Legacy bridge values kept alive until render / editor / LOS are rewritten.
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

export const RENDER_CONFIG = {
  isoTileWidth: 96,
  isoTileHeight: 48,
  elevationStepPx: 24,
  originX: 700,
  originY: 140,
  editorSize: 760,
  editorPadding: 18,
  showCoords: false
};
