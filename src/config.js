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
    // Fixed board windows. Bigger number = farther out.
    map: { cols: 24, rows: 24, followDeadzoneTiles: 4 },
    mech: { cols: 9, rows: 9, followDeadzoneTiles: 2 },
    pilot: { cols: 6, rows: 6, followDeadzoneTiles: 1 }
  },

  iso: {
    // Fixed windows. Smaller span = closer zoom.
    // Map is now a real zoom level, not forced full-board.
    map: {
      spanX: 12,
      spanY: 12,
      padPxX: 40,
      padPxTop: 52,
      padPxBottom: 40,
      liftTiles: 0.8,
      followDeadzoneTiles: 4
    },

    mech: {
      spanX: 6,
      spanY: 6,
      padPxX: 28,
      padPxTop: 44,
      padPxBottom: 36,
      liftTiles: 1.0,
      followDeadzoneTiles: 2
    },

    pilot: {
      spanX: 2,
      spanY: 2,
      padPxX: 18,
      padPxTop: 28,
      padPxBottom: 22,
      liftTiles: 0.65,
      followDeadzoneTiles: 1
    }
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
