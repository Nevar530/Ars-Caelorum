// src/controllers/gameMenuController.js

import {
  closeGameMenu,
  confirmGameMenuSelection,
  moveGameMenuSelection,
  moveGameMenuStatSelection,
  moveGameMenuTab,
  selectGameMenuPilot,
  selectGameMenuSystemAction,
  setGameMenuStatus,
  setGameMenuTab,
  spendPilotStatPoint,
  toggleGameMenu
} from "../ui/gameMenu.js";

export function createGameMenuController({
  state,
  render,
  saveCampaign,
  getCpuTurnController = null,
  returnToTitle = null,
  openMissionSelect = null,
  restartMission = null
}) {
  function getCpu() {
    return typeof getCpuTurnController === "function" ? getCpuTurnController() : null;
  }

  function save() {
    if (typeof saveCampaign === "function") saveCampaign();
  }

  function toggle() {
    const opened = toggleGameMenu(state);
    if (opened) {
      getCpu()?.clearPendingTurn?.();
    } else {
      getCpu()?.scheduleForCurrentTurn?.();
    }
    render?.();
  }

  function close() {
    closeGameMenu(state);
    render?.();
    getCpu()?.scheduleForCurrentTurn?.();
  }

  function moveTab(delta) {
    moveGameMenuTab(state, delta);
    render?.();
  }

  function moveSelection(delta) {
    moveGameMenuSelection(state, delta);
    render?.();
  }

  function moveStat(delta) {
    moveGameMenuStatSelection(state, delta);
    render?.();
  }

  function confirmSelection() {
    const result = confirmGameMenuSelection(state);

    if (result?.type === "system") {
      handleSystemAction(result.action);
      return;
    }

    if (result?.ok) save();
    render?.();
  }

  function handleSystemAction(action) {
    if (action === "resume") {
      close();
      return;
    }

    if (action === "save") {
      save();
      setGameMenuStatus(state, "Game saved.");
      render?.();
      return;
    }

    closeGameMenu(state);

    if (action === "restart" && typeof restartMission === "function") {
      restartMission();
      return;
    }

    if (action === "missionSelect" && typeof openMissionSelect === "function") {
      openMissionSelect();
      return;
    }

    if (action === "mainMenu" && typeof returnToTitle === "function") {
      returnToTitle();
      return;
    }

    render?.();
  }

  function handleClick(button) {
    const action = button?.dataset?.gameMenuAction ?? "";

    if (action === "close") {
      close();
      return;
    }

    if (action === "tab") {
      setGameMenuTab(state, button.dataset.gameMenuTab);
      render?.();
      return;
    }

    if (action === "select-pilot") {
      selectGameMenuPilot(state, button.dataset.pilotId);
      render?.();
      return;
    }

    if (action === "spend-stat") {
      const result = spendPilotStatPoint(state, button.dataset.pilotId, button.dataset.statKey);
      if (result?.ok) save();
      render?.();
      return;
    }

    if (action === "system-action") {
      if (selectGameMenuSystemAction(state, button.dataset.systemAction)) {
        handleSystemAction(button.dataset.systemAction);
      }
      return;
    }
  }

  return {
    toggle,
    close,
    moveTab,
    moveSelection,
    moveStat,
    confirmSelection,
    handleClick
  };
}
