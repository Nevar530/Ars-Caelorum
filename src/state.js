// src/state.js

import { createActionUiState, getCommandMenuItemsForPhase } from "./action.js";

export function createState({
  map,
  mechs = [],
  rotation = 0,
  content = { mechs: [], weapons: [], sigils: [], attacks: [], pilots: [], spawnPoints: [] }
}) {
  const units = Array.isArray(mechs) ? mechs : [];
  const previewUnit = units.length > 0 ? units[0] : null;
  const previewUnitId = previewUnit?.instanceId ?? null;

  return {
    map,
    units,
    mechs: units, // bridge only

    rotation,
    content,

    turn: {
      activeUnitId: null,
      activeMechId: null, // bridge only

      round: 1,
      phase: "setup",
      combatStarted: false,

      moveOrder: [],
      actionOrder: [],

      moveIndex: -1,
      actionIndex: -1,

      splashText: "",
      splashVisible: false,
      splashKind: null,
      lastInitiativeRolls: []
    },

    selection: {
      unitId: previewUnitId,
      targetUnitId: null,

      mechId: previewUnitId, // bridge only
      targetMechId: null, // bridge only

      action: null,
      targetTile: null
    },

    focus: {
      x: previewUnit ? previewUnit.x : 0,
      y: previewUnit ? previewUnit.y : 0,
      scale: previewUnit?.scale ?? "pilot"
    },

    ui: {
      mode: "idle",
      previewPath: [],
      viewMode: "iso",
      facingPreview: null,
      preMove: null,

      editor: {
        mode: "mech",
        selectedTile: {
          x: 0,
          y: 0
        }
      },

      action: createActionUiState(),

      commandMenu: {
        open: false,
        index: 0,
        items: getCommandMenuItemsForPhase("setup")
      },

      helpDrawer: {
        open: false
      }
},
    
    camera: {
      angle: rotation * 90,
      isTurning: false,
      zoomScale: previewUnit?.scale ?? "pilot"
    },

    hover: {
      tile: null
    }
  };
}
