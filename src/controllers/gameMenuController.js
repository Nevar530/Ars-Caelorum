// src/controllers/gameMenuController.js
//
// Controller for the campaign/system menu. script.js wires this controller into
// input and click events, but menu behavior lives here instead of becoming a
// script.js catch-all.

import {
  closeGameMenu,
  confirmGameMenuSelection,
  moveGameMenuSelection,
  moveGameMenuStatSelection,
  moveGameMenuTab,
  selectGameMenuPilot,
  setGameMenuTab,
  spendPilotStatPoint,
  toggleGameMenu
} from "../ui/gameMenu.js";

export function createGameMenuController({
  state,
  render,
  saveCampaign,
  getCpuTurnController = null,
  returnToTitle = null
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
    if (result?.ok) save();
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

    if (action === "return-title") {
      closeGameMenu(state);
      if (typeof returnToTitle === "function") returnToTitle();
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
