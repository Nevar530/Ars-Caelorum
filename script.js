import { createState } from "./src/state.js";
import { createInitialMap, normalizeMapDefinition } from "./src/map.js";
import {
  instantiateTestUnits,
  getUnitAt,
  getUnitById,
  moveUnitTo,
  setUnitFacing
} from "./src/mechs.js";
import { bindInput, snapFocusToActiveUnit as snapFocusHelper } from "./src/input.js";
import { loadGameData, loadMapDefinitionByPath, loadMissionDefinitionByPath } from "./src/dataLoader.js";
import { bindHudInput } from "./src/ui/hud.js";
import { clearCombatTextMarkers } from "./src/combat/combatTextOverlay.js";
import { initializeMissionBuilder } from "./src/builder/missionBuilder.js";
import { logDev, setDevLogSize } from "./src/debug/devLogger.js";
import { createGameController } from "./src/controllers/gameController.js";
import { createTurnController } from "./src/controllers/turnController.js";
import { createMovementController } from "./src/controllers/movementController.js";
import { createStoryController } from "./src/controllers/storyController.js";
import { createCombatController } from "./src/controllers/combatController.js";
import { createCpuTurnController } from "./src/ai/cpuTurnController.js";
import { isCommandMenuItemDisabled } from "./src/action.js";
import { getMissionEntries } from "./src/ui/frontScreen.js";
import { confirmDeploymentPlacement, getDeploymentReady, isDeploymentActive, openDeploymentListAtFocus, removeDeploymentPlacementAtFocus } from "./src/deployment/deploymentState.js";
import { advanceMissionDialogue, clearDialogueState, moveMissionDialogueOption, selectMissionDialogueOption } from "./src/mission/missionState.js";
import { createMissionTriggerRuntime } from "./src/mission/missionTriggerRuntime.js";
import { isMissionUnlocked, setCurrentMission } from "./src/campaign/campaignState.js";
import { loadCampaignState, resetStoredCampaignState, saveCampaignState } from "./src/campaign/campaignStorage.js";
import { applyMissionRewards } from "./src/campaign/campaignRewards.js";
import { getCurrentMissionEntry } from "./src/campaign/campaignProgression.js";
import { createGameMenuController } from "./src/controllers/gameMenuController.js";
import { FLOW_ACTIONS, getMissionFlowBranch, normalizeFlowAction } from "./src/campaign/campaignFlow.js";

const refs = {
  frontScreen: document.getElementById("frontScreen"),
  titleScreen: document.getElementById("titleScreen"),
  missionSelectScreen: document.getElementById("missionSelectScreen"),
  titleStartButton: document.getElementById("titleStartButton"),
  titleMissionSelectButton: document.getElementById("titleMissionSelectButton"),
  titleResetCampaignButton: document.getElementById("titleResetCampaignButton"),
  titleAudioToggle: document.getElementById("titleAudioToggle"),
  titleThemeAudio: document.getElementById("titleThemeAudio"),
  missionList: document.getElementById("missionList"),
  missionDescription: document.getElementById("missionDescription"),
  missionBackButton: document.getElementById("missionBackButton"),
  missionStartButton: document.getElementById("missionStartButton"),
  missionBriefingScreen: document.getElementById("missionBriefingScreen"),
  briefingTitle: document.getElementById("briefingTitle"),
  briefingMap: document.getElementById("briefingMap"),
  briefingText: document.getElementById("briefingText"),
  briefingObjectives: document.getElementById("briefingObjectives"),
  briefingBackButton: document.getElementById("briefingBackButton"),
  briefingStartButton: document.getElementById("briefingStartButton"),
  main: document.getElementById("mainRoot"),
  board: document.getElementById("board"),
  worldScene: document.getElementById("world-scene"),
  worldUi: document.getElementById("world-ui"),
  toggleViewButton: document.getElementById("toggleView"),
  resetMapButton: document.getElementById("resetMap"),
  hudRoot: document.getElementById("hudRoot"),
  hudLeft: document.getElementById("hudLeft"),
  hudCenter: document.getElementById("hudCenter"),
  hudRight: document.getElementById("hudRight"),
  helpDrawer: document.getElementById("helpDrawer"),
  combatRibbon: document.getElementById("combatRibbon"),
  combatOverlay: document.getElementById("combatOverlay")
};

async function init() {
  const content = await loadGameData();
  const defaultMissionId = content?.missionCatalog?.defaultMissionId ?? content?.mapCatalog?.defaultMapId ?? "000_game_state_tester_mission";
  const campaign = loadCampaignState({ defaultMissionId });

  const initialMap = content.defaultMap ? normalizeMapDefinition(content.defaultMap) : createInitialMap();

  const state = createState({
    map: initialMap,
    units: [],
    content,
    campaign
  });

  setDevLogSize(25);

  function snapFocusToActiveUnit(options = {}) {
    snapFocusHelper(state, options);
  }

  const gameController = createGameController({
    state,
    refs,
    instantiateTestUnits,
    snapFocusToActiveUnit,
    logDev,
    onMissionEnded(missionResult, missionDefinition) {
      const rewardOutcome = applyMissionRewards(state.campaign, missionDefinition, missionResult);
      state.campaign = saveCampaignState(state.campaign, { defaultMissionId });
      return rewardOutcome;
    }
  });

  function clearTransientUi() {
    gameController.clearTransientUi();
  }

  let cpuTurnController = null;

  const turnController = createTurnController({
    state,
    getUnitById,
    clearTransientUi,
    snapFocusToActiveUnit,
    render: gameController.render,
    logDev,
    showSplash: gameController.showSplash,
    clearCombatTextMarkers,
    onTurnReady: () => cpuTurnController?.scheduleForCurrentTurn(),
    onMissionResult: gameController.endMission,
    onMissionTriggerEvent: (eventType, context) => missionTriggerRuntime.handleMissionTriggerEvent(eventType, context)
  });


  const missionTriggerRuntime = createMissionTriggerRuntime({
    state,
    gameController,
    loadMapDefinitionByPath,
    logDev
  });

  gameController.setMapLoadedHook?.(() => missionTriggerRuntime.handleMissionTriggerEvent("onMissionStart", {
    round: state.turn?.round ?? 0,
    mode: state.turn?.mode ?? state.map?.mode ?? "combat"
  }));

  const movementController = createMovementController({
    state,
    getUnitById,
    moveUnitTo,
    setUnitFacing,
    snapFocusToActiveUnit,
    clearTransientUi,
    render: gameController.render,
    logDev,
    advanceMoveTurn: turnController.advanceMoveTurn,
    advanceActionTurn: turnController.advanceActionTurn,
    onUnitEnteredZone: missionTriggerRuntime.handleUnitEnteredZone
  });

  const storyController = createStoryController({
    state,
    setUnitFacing,
    render: gameController.render,
    logDev,
    onUnitEnteredZone: missionTriggerRuntime.handleUnitEnteredZone,
    onMissionTriggerEvent: (eventType, context) => missionTriggerRuntime.handleMissionTriggerEvent(eventType, context),
    onMissionResult: gameController.endMission
  });

  const combatController = createCombatController({
    state,
    getUnitById,
    getUnitAt,
    render: gameController.render,
    logDev,
    clearTransientUi,
    advanceActionTurn: turnController.advanceActionTurn,
    movementController,
    endMission: gameController.endMission,
    onMissionTriggerEvent: (eventType, context) => missionTriggerRuntime.handleMissionTriggerEvent(eventType, context)
  });

  cpuTurnController = createCpuTurnController({
    state,
    render: gameController.render,
    logDev,
    movementController,
    combatController
  });

  refs.combatOverlay.addEventListener("click", (event) => {
    const button = event.target.closest("[data-combat-overlay-action], [data-game-menu-action]");
    if (!button) return;

    if (button.dataset.combatOverlayAction === "return-title") {
      actions.showTitleScreen();
    }

    if (button.dataset.combatOverlayAction === "advance-dialogue") {
      actions.advanceDialogue?.();
    }

    if (button.dataset.combatOverlayAction === "select-dialogue-option") {
      actions.confirmDialogueOption?.(button.dataset.dialogueOptionIndex);
    }

    if (button.dataset.combatOverlayAction === "continue-phase-briefing") {
      actions.continuePhaseBriefing?.();
    }

    if (button.dataset.combatOverlayAction === "mission-result-flow") {
      actions.handleMissionResultFlow?.(button.dataset.flowAction, button.dataset.loadMissionId);
    }

    const gameMenuAction = button.dataset.gameMenuAction;
    if (gameMenuAction) {
      actions.handleGameMenuClick?.(button);
    }
  });

  refs.titleStartButton?.addEventListener("click", () => {
    startTitleThemeAudio();
    actions.startDefaultMission();
  });

  refs.titleMissionSelectButton?.addEventListener("click", () => {
    startTitleThemeAudio();
    actions.openMissionSelect();
  });

  refs.titleResetCampaignButton?.addEventListener("click", () => {
    actions.resetCampaign();
  });

  refs.missionBackButton?.addEventListener("click", () => {
    actions.showTitleScreen();
  });

  refs.missionList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-front-screen-mission-id]");
    if (!button) return;
    actions.selectMission(button.dataset.frontScreenMissionId);
  });

  refs.missionStartButton?.addEventListener("click", () => {
    actions.openSelectedMissionBriefing();
  });

  refs.briefingBackButton?.addEventListener("click", () => {
    actions.openMissionSelect();
  });

  refs.briefingStartButton?.addEventListener("click", () => {
    if (state.ui?.shell?.screen === "phase-briefing") {
      actions.continuePhaseBriefing?.();
      return;
    }
    actions.startSelectedMission();
  });

  const titleAudioState = {
    muted: false,
    started: false
  };

  function updateTitleAudioToggle() {
    if (!refs.titleAudioToggle) return;

    refs.titleAudioToggle.textContent = titleAudioState.muted ? "🔇" : "🔊";
    refs.titleAudioToggle.classList.toggle("is-muted", titleAudioState.muted);
    refs.titleAudioToggle.setAttribute("aria-pressed", titleAudioState.muted ? "true" : "false");
    refs.titleAudioToggle.setAttribute("aria-label", titleAudioState.muted ? "Unmute title music" : "Mute title music");
    refs.titleAudioToggle.title = titleAudioState.muted ? "Unmute title music" : "Mute title music";
  }

  function startTitleThemeAudio() {
    const audio = refs.titleThemeAudio;
    if (!audio || titleAudioState.muted) return;

    audio.volume = 0.55;
    audio.muted = false;
    audio.play()
      .then(() => {
        titleAudioState.started = true;
      })
      .catch(() => {
        // Browser may require another user gesture before audio can start.
      });
  }

  function pauseTitleThemeAudio() {
    const audio = refs.titleThemeAudio;
    if (!audio) return;

    audio.pause();
  }

  refs.titleAudioToggle?.addEventListener("click", (event) => {
    event.stopPropagation();

    titleAudioState.muted = !titleAudioState.muted;

    if (refs.titleThemeAudio) {
      refs.titleThemeAudio.muted = titleAudioState.muted;
      if (titleAudioState.muted) {
        refs.titleThemeAudio.pause();
      } else {
        startTitleThemeAudio();
      }
    }

    updateTitleAudioToggle();
  });

  refs.titleScreen?.addEventListener("pointerdown", () => {
    startTitleThemeAudio();
  }, { once: true });

  refs.titleScreen?.addEventListener("keydown", () => {
    startTitleThemeAudio();
  }, { once: true });

  updateTitleAudioToggle();


  
function getMissionStartMapPath(missionDefinition, missionEntry = null) {
  const startMapId = missionDefinition?.startMapId ?? missionDefinition?.mapId ?? missionEntry?.mapId ?? null;
  const maps = Array.isArray(missionDefinition?.maps) ? missionDefinition.maps : [];
  const startMap = startMapId
    ? maps.find((map) => (map?.id ?? map?.mapId) === startMapId)
    : maps[0];

  return startMap?.mapPath
    ?? startMap?.path
    ?? missionDefinition?.mapPath
    ?? missionEntry?.mapPath
    ?? null;
}

function getSelectedMissionEntry() {
    const missions = getMissionEntries(state);
    if (!missions.length) return null;

    const selectedMissionId = state.ui.shell.selectedMissionId ?? state.ui.shell.selectedMapId ?? null;
    return missions.find((entry) => entry?.id === selectedMissionId) ?? missions[0] ?? null;
  }

  function isMissionEntryUnlocked(entry) {
    if (!entry) return false;
    if (entry.alwaysUnlocked === true || entry.devUnlocked === true || entry.testMission === true) return true;
    return isMissionUnlocked(state.campaign, entry.id);
  }

  async function loadMissionForEntry(entry) {
    if (!entry) return null;

    if (entry.sourceType === "map-fallback") {
      return {
        id: entry.id,
        name: entry.name || entry.id,
        mapId: entry.mapId || entry.id,
        mapPath: entry.mapPath || entry.path,
        briefing: {
          title: entry.name || entry.id,
          text: "Fallback mission wrapper generated from map catalog data.",
          objectives: ["Defeat all enemy pilots."]
        },
        objectives: [
          { id: "defeat_enemies", type: "defeat_all", targetTeam: "enemy", label: "Defeat all enemy pilots" }
        ],
        results: {
          victory: { title: "Victory", text: "Mission complete." },
          defeat: { title: "Defeat", text: "Mission failed." }
        }
      };
    }

    if (!entry.path) return null;
    return loadMissionDefinitionByPath(entry.path);
  }

  function getTitleMenuCount() {
    return Array.isArray(state?.campaign?.completedMissions) && state.campaign.completedMissions.length > 0 ? 3 : 2;
  }

  function saveCampaign() {
    state.campaign = saveCampaignState(state.campaign, { defaultMissionId });
  }

  function getMissionEntryById(missionId) {
    const id = String(missionId ?? "").trim();
    if (!id) return null;
    return getMissionEntries(state).find((entry) => entry?.id === id) ?? null;
  }

  async function startMissionEntry(missionEntry, { force = false } = {}) {
    if (!missionEntry) return false;
    if (!force && !isMissionEntryUnlocked(missionEntry)) return false;

    const missionDefinition = await loadMissionForEntry(missionEntry);
    const mapPath = getMissionStartMapPath(missionDefinition, missionEntry);
    if (!mapPath) return false;

    const mapDefinition = await loadMapDefinitionByPath(mapPath);
    state.ui.shell.selectedMissionId = missionEntry.id;
    state.ui.shell.selectedMapId = missionEntry.id;
    setCurrentMission(state.campaign, missionEntry.id);
    state.campaign = saveCampaignState(state.campaign, { defaultMissionId });
    state.ui.shell.briefingMission = missionEntry;
    state.ui.shell.briefingDefinition = missionDefinition;
    state.ui.shell.screen = "game";
    gameController.loadMapAndUnits(mapDefinition, missionDefinition);
    return true;
  }

  async function loadMissionById(missionId, options = {}) {
    const missionEntry = getMissionEntryById(missionId);
    if (!missionEntry) return false;
    return startMissionEntry(missionEntry, options);
  }

  async function restartCurrentMission() {
    const missionId = state?.mission?.definition?.id ?? state?.campaign?.currentMissionId ?? state?.ui?.shell?.selectedMissionId ?? null;
    if (missionId && await loadMissionById(missionId, { force: true })) return true;

    if (state?.mission?.sourceMap && state?.mission?.definition) {
      state.ui.shell.screen = "game";
      gameController.loadMapAndUnits(state.mission.sourceMap, state.mission.definition);
      return true;
    }

    actions.openMissionSelect();
    return false;
  }

  async function handleMissionResultFlow(actionValue, explicitMissionId = "") {
    const result = state?.mission?.result === "defeat" ? "defeat" : "victory";
    const branch = getMissionFlowBranch(state?.mission?.definition, result);
    const action = normalizeFlowAction(actionValue || branch?.action, result === "defeat" ? FLOW_ACTIONS.RESTART : FLOW_ACTIONS.CONTINUE);
    const loadMissionId = String(explicitMissionId || branch?.loadMissionId || "").trim();

    if (action === FLOW_ACTIONS.RESTART) {
      await restartCurrentMission();
      return;
    }

    if ((action === FLOW_ACTIONS.CONTINUE || action === FLOW_ACTIONS.LOAD_MISSION) && loadMissionId) {
      if (await loadMissionById(loadMissionId, { force: true })) return;
    }

    if (action === FLOW_ACTIONS.MISSION_SELECT || action === FLOW_ACTIONS.LOAD_MISSION || action === FLOW_ACTIONS.CONTINUE) {
      actions.openMissionSelect();
      return;
    }

    actions.showTitleScreen();
  }

  const gameMenuController = createGameMenuController({
    state,
    render: gameController.render,
    saveCampaign,
    getCpuTurnController: () => cpuTurnController,
    returnToTitle: () => actions.showTitleScreen(),
    openMissionSelect: () => actions.openMissionSelect(),
    restartMission: () => actions.restartCurrentMission()
  });

  const actions = {
    render: gameController.render,
    snapFocusToActiveUnit,
    toggleHelpDrawer: gameController.toggleHelpDrawer,
    closeHelpDrawer: gameController.closeHelpDrawer,

    showTitleScreen() {
      state.ui.shell.screen = "title";
      gameController.showTitleScreen();
    },

    openMissionSelect() {
      startTitleThemeAudio();
      state.ui.shell.screen = "mission-select";
      gameController.render();
    },

    moveTitleSelection(delta) {
      const count = getTitleMenuCount();
      const current = Number.isFinite(Number(state.ui.shell.titleMenuIndex))
        ? Number(state.ui.shell.titleMenuIndex)
        : 0;
      state.ui.shell.titleMenuIndex = (current + delta + count) % count;
      gameController.render();
    },

    confirmTitleSelection() {
      const index = state.ui.shell.titleMenuIndex ?? 0;
      if (index === 1) {
        actions.openMissionSelect();
        return;
      }
      if (index === 2) {
        actions.resetCampaign();
        return;
      }
      actions.startDefaultMission();
    },

    selectMission(missionId) {
      if (!missionId) return;
      state.ui.shell.selectedMissionId = missionId;
      state.ui.shell.selectedMapId = missionId;
      gameController.render();
    },

    async openSelectedMissionBriefing() {
      const missionEntry = getSelectedMissionEntry();
      if (!missionEntry) return;
      if (!isMissionEntryUnlocked(missionEntry)) return;

      const missionDefinition = await loadMissionForEntry(missionEntry);
      state.ui.shell.briefingMission = missionEntry;
      state.ui.shell.briefingDefinition = missionDefinition;
      state.ui.shell.screen = "mission-briefing";
      gameController.render();
    },

    async startDefaultMission() {
      const missions = getMissionEntries(state);
      const currentMission = getCurrentMissionEntry(state.campaign, missions);
      const defaultMission = currentMission ?? missions[0] ?? null;
      if (!defaultMission) return;

      state.ui.shell.selectedMissionId = defaultMission.id;
      state.ui.shell.selectedMapId = defaultMission.id;
      state.ui.shell.briefingMission = defaultMission;
      state.ui.shell.briefingDefinition = await loadMissionForEntry(defaultMission);
      await actions.startSelectedMission();
    },

    resetCampaign() {
      state.campaign = resetStoredCampaignState({ defaultMissionId });
      state.ui.shell.selectedMissionId = state.campaign.currentMissionId;
      state.ui.shell.selectedMapId = state.campaign.currentMissionId;
      state.ui.shell.briefingMission = null;
      state.ui.shell.briefingDefinition = null;
      state.ui.shell.titleMenuIndex = 0;
      gameController.showTitleScreen();
    },

    async startSelectedMission() {
      pauseTitleThemeAudio();
      const missionEntry = state.ui.shell.briefingMission ?? getSelectedMissionEntry();
      await startMissionEntry(missionEntry);
    },

    moveMissionSelection(delta) {
      const missions = getMissionEntries(state);
      if (!missions.length) return;

      const selectedMissionId = state.ui.shell.selectedMissionId ?? state.ui.shell.selectedMapId ?? null;
      const currentIndex = Math.max(0, missions.findIndex((entry) => entry?.id === selectedMissionId));
      const nextIndex = (currentIndex + delta + missions.length) % missions.length;
      actions.selectMission(missions[nextIndex].id);
    },
    
    selectFocusedMechIfPresent() {
      return gameController.selectFocusedUnitIfPresent(getUnitAt);
    },

    openCommandMenu: gameController.openCommandMenu,
    closeCommandMenu: gameController.closeCommandMenu,
    moveMenuSelection: gameController.moveMenuSelection,

    confirmMenuSelection() {
      const menu = state.ui.commandMenu;
      if (!menu.open) return;

      const action = menu.items[menu.index];
      if (isCommandMenuItemDisabled(state, action)) {
        return;
      }

      if (action === "move") {
        movementController.startMove();
        return;
      }

      if (action === "brace") {
        movementController.completeBraceForCurrentUnit();
        return;
      }

      if (action === "end_turn" && state.turn.phase === "move") {
        movementController.skipMoveForCurrentUnit();
        return;
      }

      if (action === "attack") {
        combatController.startAttack();
        return;
      }

      if (action === "ability") {
        combatController.startAbility();
        return;
      }

      if (action === "item") {
        combatController.startItem();
        return;
      }

      if (action === "end_turn" && state.turn.phase === "move") {
        movementController.skipMoveForCurrentUnit();
        return;
      }

      if (action === "end_turn") {
        combatController.completeEndTurnForCurrentUnit();
        return;
      }

    },

    selectMenuAction(action) {
      if (isCommandMenuItemDisabled(state, action)) {
        return;
      }

      if (action === "move") {
        movementController.startMove();
        return;
      }

      if (action === "brace") {
        movementController.completeBraceForCurrentUnit();
        return;
      }

      if (action === "attack") {
        combatController.startAttack();
        return;
      }

      if (action === "ability") {
        combatController.startAbility();
        return;
      }

      if (action === "item") {
        combatController.startItem();
        return;
      }

      if (action === "end_turn" && state.turn.phase === "move") {
        movementController.skipMoveForCurrentUnit();
        return;
      }

      if (action === "end_turn") {
        combatController.completeEndTurnForCurrentUnit();
        return;
      }

    },

    toggleGameMenu: gameMenuController.toggle,
    closeGameMenu: gameMenuController.close,
    moveGameMenuTab: gameMenuController.moveTab,
    moveGameMenuSelection: gameMenuController.moveSelection,
    moveGameMenuStat: gameMenuController.moveStat,
    confirmGameMenuSelection: gameMenuController.confirmSelection,
    handleGameMenuClick: gameMenuController.handleClick,
    restartCurrentMission,
    loadMissionById,
    handleMissionResultFlow,

    continuePhaseBriefing() {
      gameController.continuePhaseBriefing?.();
    },

    closeDialogue() {
      clearDialogueState(state);
      gameController.render();
    },

    moveDialogueOption(delta) {
      if (moveMissionDialogueOption(state, delta)) gameController.render();
    },

    async confirmDialogueOption(optionIndex = null) {
      if (optionIndex !== null && optionIndex !== undefined && state?.ui?.dialogue?.active) {
        const parsed = Number(optionIndex);
        if (Number.isFinite(parsed)) state.ui.dialogue.optionIndex = Math.max(0, Math.trunc(parsed));
      }

      const result = selectMissionDialogueOption(state);
      if (!result?.selected) {
        gameController.render();
        return;
      }

      if (result.action === "loadMission" || result.action === "continue") {
        if (result.loadMissionId && await loadMissionById(result.loadMissionId, { force: true })) return;
        actions.openMissionSelect();
        return;
      }

      if (result.action === "missionSelect") {
        actions.openMissionSelect();
        return;
      }

      if (result.action === "mainMenu") {
        actions.showTitleScreen();
        return;
      }

      gameController.render();
    },

    advanceDialogue() {
      if (advanceMissionDialogue(state)) {
        if (storyController.resumePendingStoryMoveAfterDialogue?.()) return;
        if (movementController.resumePendingMoveAfterDialogue?.()) return;
        if (combatController.resumePendingActionAfterDialogue?.()) return;
        gameController.render();
        return;
      }
      gameController.render();
    },

    startCombat() {
      if (state.ui.dialogue?.active) return;
      if (isDeploymentActive(state) && !getDeploymentReady(state)) {
        return;
      }
      turnController.startCombat();
    },

    openDeploymentList() {
      if (openDeploymentListAtFocus(state)) {
        gameController.render();
      }
    },

    confirmDeploymentPlacement() {
      if (confirmDeploymentPlacement(state)) {
        gameController.render();
      }
    },

    removeDeploymentPlacement() {
      if (removeDeploymentPlacementAtFocus(state)) {
        gameController.render();
      }
    },
    clearTransientUi,
    setActiveUnitByCurrentTurnIndex: turnController.setActiveUnitByCurrentTurnIndex,
    rebuildOrdersAndLog: turnController.rebuildOrdersAndLog,
    resetCombatToSetup: gameController.resetCombatToSetup,

    toggleView: gameController.toggleView,
    zoomIn: gameController.zoomIn,
    zoomOut: gameController.zoomOut,
    storyMove: storyController.moveStoryUnit,
    storyInteract: storyController.storyInteract,
    startMove: movementController.startMove,
    startAttack: combatController.startAttack,
    startAbility: combatController.startAbility,
    startItem: combatController.startItem,
    waitTurn: combatController.waitTurn,
    confirmAction: combatController.confirmAction,
    cancelAction: combatController.cancelAction,
    resetMap: gameController.resetMapAndUnits
  };

  gameController.resetCombatToSetup();

  bindInput(state, refs, actions);
  bindHudInput(state, refs, actions);

  initializeMissionBuilder({
    state,
    render: gameController.render,
    refs,
    launchMissionFromBuilder({ mapDefinition, missionDefinition, packageDefinition }) {
      state.ui.shell.screen = "game";
      state.ui.shell.briefingMission = null;
      state.ui.shell.briefingDefinition = null;
      const runtimeMissionDefinition = packageDefinition
        ? { ...missionDefinition, packageDefinition }
        : missionDefinition;
      gameController.loadMapAndUnits(mapDefinition, runtimeMissionDefinition);
    }
  });

  gameController.render();
}

init().catch((error) => {
  console.error("Failed to initialize Ars Caelorum:", error);
});
