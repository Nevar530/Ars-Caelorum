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

    // NEW
    units,

    // BRIDGE
    mechs: units,

    rotation,
    content,

    turn: {
      // NEW
      activeUnitId: null,

      // BRIDGE
      activeMechId: null,

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
      // NEW
      unitId: previewUnitId,
      targetUnitId: null,

      // BRIDGE
      mechId: previewUnitId,
      targetMechId: null,

      action: null,
      targetTile: null
    },

    focus: {
      x: previewUnit ? previewUnit.x : 0,
      y: previewUnit ? previewUnit.y : 0,
      scale: previewUnit?.scale ?? "mech"
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
      }
    },

    camera: {
      angle: rotation * 90,
      isTurning: false,
      zoomScale: previewUnit?.scale ?? "mech"
    },

    hover: {
      tile: null
    }
  };
}
