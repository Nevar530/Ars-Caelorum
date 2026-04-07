import { createActionUiState, getCommandMenuItemsForPhase } from "./action.js";

export function createState({
  map,
  mechs = [],
  rotation = 0,
  content = { mechs: [], weapons: [], sigils: [], attacks: [], pilots: [], spawnPoints: [] }
}) {
  const previewMech = mechs.length > 0 ? mechs[0] : null;
  const previewMechId = previewMech?.instanceId ?? null;

  return {
    map,
    mechs,
    rotation,
    content,

    turn: {
      activeMechId: null,
      round: 1,
      phase: "setup", // "setup" | "move" | "action"
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
      mechId: previewMechId,
      action: null,
      targetTile: null,
      targetMechId: null
    },

    focus: {
      x: previewMech ? previewMech.x : 0,
      y: previewMech ? previewMech.y : 0
    },

    ui: {
      mode: "idle",
      previewPath: [],
      viewMode: "iso",
      facingPreview: null,
      preMove: null,

      action: createActionUiState(),

      commandMenu: {
        open: false,
        index: 0,
        items: getCommandMenuItemsForPhase("setup")
      }
    },

    camera: {
      angle: rotation * 90,
      isTurning: false
    },

    hover: {
      tile: null
    }
  };
}
