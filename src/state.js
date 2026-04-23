// src/state.js

import { createActionUiState, getCommandMenuItemsForPhase } from "./action.js";

export function createState({
  map,
  units = null,
  mechs = [],
  rotation = 0,
  content = { mechs: [], weapons: [], sigils: [], attacks: [], pilots: [], pilotAbilities: [], mechAbilities: [], pilotItems: [], mechItems: [], spawnPoints: [], mapCatalog: null, defaultMap: null }
}) {
  const runtimeUnits = Array.isArray(units)
    ? units
    : Array.isArray(mechs)
      ? mechs
      : [];

  const previewUnit = runtimeUnits.length > 0 ? runtimeUnits[0] : null;
  const previewUnitId = previewUnit?.instanceId ?? null;

  return {
    map,
    units: runtimeUnits,

    rotation,
    content,

    turn: {
      activeUnitId: null,
      activeActorId: null,
      activeBodyId: null,

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

      action: null,
      targetTile: null
    },

    focus: {
      x: previewUnit ? previewUnit.x : 0,
      y: previewUnit ? previewUnit.y : 0,
      scale: previewUnit?.scale ?? "pilot"
    },

    mission: {
      sourceMap: map ? structuredClone(map) : null,
      result: null
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
      },

      deployment: {
        active: false,
        unitType: "pilot",
        requiredCount: 0,
        cells: [],
        roster: [],
        listOpen: false,
        listIndex: 0,
        selectedCellKey: null,
        menuFocus: "map"
      },

      shell: {
        screen: "title",
        selectedMapId: content?.mapCatalog?.defaultMapId ?? "000_test",
        titleMenuIndex: 0
      }
    },

    camera: {
      angle: rotation * 90,
      isTurning: false,
      zoomMode: previewUnit?.scale ?? "map",
      zoomScale: previewUnit?.scale ?? "pilot"
    },

    hover: {
      tile: null
    }
  };
}
