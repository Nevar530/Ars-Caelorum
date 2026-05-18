// src/state.js

import { createActionUiState, getCommandMenuItemsForPhase } from "./action.js";

export function createState({
  map,
  units = null,
  mechs = [],
  content = { mechs: [], weapons: [], sigils: [], attacks: [], pilots: [], pilotAbilities: [], mechAbilities: [], pilotItems: [], mechItems: [], spawnPoints: [], mapCatalog: null, missionCatalog: null, defaultMap: null },
  campaign = null
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
      definition: null,
      result: null,
      resultReceipt: null,
      campaignReward: null
    },

    campaign,

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
        selectedMapId: content?.mapCatalog?.defaultMapId ?? "008_mars_cold_open",
        selectedMissionId: content?.missionCatalog?.defaultMissionId ?? "000_game_state_tester_mission",
        titleMenuIndex: 0
      },

      dialogue: {
        active: false,
        key: null,
        index: 0,
        lines: []
      },

      phaseBriefing: {
        active: false,
        title: "",
        subtitle: "",
        text: "",
        objectives: [],
        pending: null
      },

      gameMenu: {
        open: false,
        activeTab: "characters",
        selectedPilotId: "",
        selectedStatKey: "core"
      }
    },

    camera: {
      zoomMode: previewUnit?.scale ?? "map",
      zoomScale: previewUnit?.scale ?? "pilot"
    },

    hover: {
      tile: null
    }
  };
}
