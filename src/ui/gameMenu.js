// src/ui/gameMenu.js

import { PILOT_STAT_CAPS, PILOT_STAT_KEYS, setMechLoadoutSlot, setPilotLoadoutSlot } from "../campaign/campaignState.js";
import { normalizeMechLoadout, normalizePilotLoadout } from "../content/unitLoadout.js";
import { getMissionObjectiveStatus } from "../mission/missionObjectives.js";
import { getContextScreenTabId, getContextScreenTitle, normalizeContextScreenId } from "./contextScreens.js";

const TABS = Object.freeze([
  { id: "characters", label: "Characters" },
  { id: "inventory", label: "Inventory" },
  { id: "missions", label: "Missions" },
  { id: "lore", label: "Lore" },
  { id: "system", label: "System" }
]);

const LOADOUT_TAB = Object.freeze({ id: "loadout", label: "Loadout" });

const CONTEXT_TAB_IDS = Object.freeze(["loadout", "telum_loadout", "shop", "mission_board", "medbay"]);

const LOADOUT_SLOTS = Object.freeze([
  { key: "armor", label: "Armor", type: "armor" },
  { key: "accessory", label: "Accessory", type: "accessory" },
  { key: "primaryWeapon", label: "Primary", type: "weapon" },
  { key: "secondaryWeapon", label: "Secondary", type: "weapon" }
]);

const TELUM_LOADOUT_SLOTS = Object.freeze([
  { key: "plating", label: "Plating", type: "mechGear" },
  { key: "system", label: "System", type: "mechGear" },
  { key: "primaryWeapon", label: "Primary", type: "mechWeapon" },
  { key: "secondaryWeapon", label: "Secondary", type: "mechWeapon" },
  { key: "supportWeapon", label: "Support", type: "mechWeapon" }
]);

const SHOP_CATEGORIES = Object.freeze([
  { key: "weapons", label: "Pilot Weapons", type: "weapon" },
  { key: "armor", label: "Pilot Armor", type: "armor" },
  { key: "accessories", label: "Accessories", type: "accessory" },
  { key: "mechWeapons", label: "Telum Weapons", type: "mechWeapon" },
  { key: "mechGear", label: "Telum Gear", type: "mechGear" },
  { key: "items", label: "Items", type: "item" }
]);

const SYSTEM_ACTIONS = Object.freeze([
  { id: "resume", label: "Resume" },
  { id: "save", label: "Save" },
  { id: "restart", label: "Restart Mission" },
  { id: "missionSelect", label: "Mission Select" },
  { id: "mainMenu", label: "Main Menu" }
]);

const STAT_LABELS = Object.freeze({
  core: "Core",
  abilityPoints: "Ability Points",
  targeting: "Targeting",
  reaction: "Reaction"
});

export function normalizeGameMenuState(state) {
  if (!state.ui.gameMenu || typeof state.ui.gameMenu !== "object") {
    state.ui.gameMenu = {};
  }

  state.ui.gameMenu.open = Boolean(state.ui.gameMenu.open);
  state.ui.gameMenu.loadoutAccess = Boolean(state.ui.gameMenu.loadoutAccess);
  state.ui.gameMenu.contextScreenId = normalizeContextScreenId(state.ui.gameMenu.contextScreenId);
  state.ui.gameMenu.activeTab = normalizeTab(state.ui.gameMenu.activeTab, state.ui.gameMenu);
  state.ui.gameMenu.selectedPilotId = String(state.ui.gameMenu.selectedPilotId ?? "").trim();
  state.ui.gameMenu.selectedStatKey = normalizeStatKey(state.ui.gameMenu.selectedStatKey);
  state.ui.gameMenu.characterStage = normalizeCharacterStage(state.ui.gameMenu.characterStage);
  state.ui.gameMenu.selectedLoadoutSlot = normalizeLoadoutSlot(state.ui.gameMenu.selectedLoadoutSlot);
  state.ui.gameMenu.selectedLoadoutOptionIndex = normalizeLoadoutOptionIndex(state.ui.gameMenu.selectedLoadoutOptionIndex);
  state.ui.gameMenu.loadoutStage = normalizeLoadoutStage(state.ui.gameMenu.loadoutStage);
  state.ui.gameMenu.selectedMechId = String(state.ui.gameMenu.selectedMechId ?? "").trim();
  state.ui.gameMenu.selectedTelumLoadoutSlot = normalizeTelumLoadoutSlot(state.ui.gameMenu.selectedTelumLoadoutSlot);
  state.ui.gameMenu.selectedTelumLoadoutOptionIndex = normalizeLoadoutOptionIndex(state.ui.gameMenu.selectedTelumLoadoutOptionIndex);
  state.ui.gameMenu.telumLoadoutStage = normalizeLoadoutStage(state.ui.gameMenu.telumLoadoutStage);
  state.ui.gameMenu.selectedShopCategory = normalizeShopCategory(state.ui.gameMenu.selectedShopCategory);
  state.ui.gameMenu.selectedShopItemIndex = normalizeLoadoutOptionIndex(state.ui.gameMenu.selectedShopItemIndex);
  state.ui.gameMenu.shopStage = normalizeShopStage(state.ui.gameMenu.shopStage);
  state.ui.gameMenu.selectedMissionBoardIndex = normalizeLoadoutOptionIndex(state.ui.gameMenu.selectedMissionBoardIndex);
  state.ui.gameMenu.selectedSystemIndex = normalizeSystemIndex(state.ui.gameMenu.selectedSystemIndex);
  state.ui.gameMenu.statusText = String(state.ui.gameMenu.statusText ?? "").trim();
  state.ui.gameMenu.shopId = String(state.ui.gameMenu.shopId ?? "").trim();

  return state.ui.gameMenu;
}

export function openGameMenu(state) {
  const menu = normalizeGameMenuState(state);
  menu.open = true;
  menu.contextScreenId = "";
  menu.loadoutAccess = false;
  menu.shopId = "";
  menu.activeTab = normalizeTab(menu.activeTab, menu);

  const firstPilotId = getVisiblePilotEntries(state)[0]?.id ?? "";
  if (!menu.selectedPilotId && firstPilotId) {
    menu.selectedPilotId = firstPilotId;
  }
}

export function closeGameMenu(state) {
  const menu = normalizeGameMenuState(state);
  menu.open = false;
  menu.contextScreenId = "";
  menu.loadoutAccess = false;
  if (menu.activeTab === "loadout") menu.activeTab = "characters";
  menu.shopId = "";
  menu.loadoutStage = "pilots";
}

export function openContextualScreen(state, screenId = "pilot_loadout", options = {}) {
  const id = normalizeContextScreenId(screenId) || "pilot_loadout";
  const menu = normalizeGameMenuState(state);
  menu.open = true;
  menu.contextScreenId = id;
  menu.activeTab = getContextScreenTabId(id);
  menu.loadoutAccess = id === "pilot_loadout";
  if (menu.activeTab === "loadout") {
    menu.loadoutStage = "pilots";
    menu.selectedLoadoutOptionIndex = 0;
  }
  if (menu.activeTab === "telum_loadout") {
    menu.telumLoadoutStage = "pilots";
    menu.selectedTelumLoadoutOptionIndex = 0;
  }
  if (menu.activeTab === "shop") {
    menu.shopStage = "categories";
    menu.selectedShopItemIndex = 0;
    menu.shopId = String(options?.shopId ?? "").trim();
  } else {
    menu.shopId = "";
  }
  if (options?.statusText) menu.statusText = String(options.statusText ?? "").trim();
  const firstPilotId = getVisiblePilotEntries(state)[0]?.id ?? "";
  if (!menu.selectedPilotId && firstPilotId) menu.selectedPilotId = firstPilotId;
  const firstMechId = getVisibleMechEntries(state)[0]?.id ?? "";
  if (!menu.selectedMechId && firstMechId) menu.selectedMechId = firstMechId;
  return id;
}

export function toggleGameMenu(state) {
  if (normalizeGameMenuState(state).open) {
    closeGameMenu(state);
    return false;
  }

  openGameMenu(state);
  return true;
}

export function setGameMenuTab(state, tabId) {
  const menu = normalizeGameMenuState(state);
  const id = String(tabId ?? "").trim().toLowerCase();
  if (id === "loadout") {
    openContextualScreen(state, "pilot_loadout");
    return;
  }
  menu.activeTab = normalizeTab(id, menu);
}

export function moveGameMenuTab(state, delta) {
  const menu = normalizeGameMenuState(state);
  if (menu.contextScreenId || menu.activeTab === "loadout") return true;
  const tabs = getVisibleTabs(menu);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === menu.activeTab));
  const nextIndex = (index + delta + tabs.length) % tabs.length;
  menu.activeTab = tabs[nextIndex].id;
}

export function moveGameMenuSelection(state, delta) {
  const menu = normalizeGameMenuState(state);

  if (menu.activeTab === "system") {
    const currentIndex = normalizeSystemIndex(menu.selectedSystemIndex);
    menu.selectedSystemIndex = (currentIndex + Math.sign(delta || 0) + SYSTEM_ACTIONS.length) % SYSTEM_ACTIONS.length;
    return true;
  }

  if (menu.activeTab === "loadout") {
    return moveLoadoutSelection(state, delta);
  }

  if (menu.activeTab === "telum_loadout") {
    return moveTelumLoadoutSelection(state, delta);
  }

  if (menu.activeTab === "shop") {
    return moveShopSelection(state, delta);
  }

  if (menu.activeTab === "mission_board") {
    return moveMissionBoardSelection(state, delta);
  }

  if (menu.activeTab !== "characters") return false;

  const step = Math.sign(delta || 0);
  if (!step) return false;

  if (menu.characterStage === "stats") {
    const currentStatIndex = Math.max(0, PILOT_STAT_KEYS.findIndex((key) => key === menu.selectedStatKey));
    const nextStatIndex = (currentStatIndex + step + PILOT_STAT_KEYS.length) % PILOT_STAT_KEYS.length;
    menu.selectedStatKey = PILOT_STAT_KEYS[nextStatIndex];
    return true;
  }

  const pilots = getVisiblePilotEntries(state);
  if (!pilots.length) return false;

  const currentIndex = Math.max(0, pilots.findIndex((pilot) => pilot.id === menu.selectedPilotId));
  const nextIndex = (currentIndex + step + pilots.length) % pilots.length;
  menu.selectedPilotId = pilots[nextIndex].id;
  return true;
}

export function moveGameMenuStatSelection(state, delta) {
  const menu = normalizeGameMenuState(state);

  if (menu.activeTab === "loadout") {
    return moveLoadoutStage(state, delta);
  }

  if (menu.activeTab === "telum_loadout") {
    return moveTelumLoadoutStage(state, delta);
  }

  if (menu.activeTab === "shop") {
    return moveShopStage(state, delta);
  }

  if (menu.activeTab !== "characters") return false;

  const step = Math.sign(delta || 0);
  if (!step) return false;

  if (step < 0 && menu.characterStage === "stats") {
    menu.characterStage = "pilots";
    return true;
  }

  if (step > 0 && menu.characterStage === "pilots") {
    menu.characterStage = "stats";
    return true;
  }

  return false;
}

export function confirmGameMenuSelection(state) {
  const menu = normalizeGameMenuState(state);

  if (menu.activeTab === "system") {
    return {
      ok: true,
      type: "system",
      action: SYSTEM_ACTIONS[normalizeSystemIndex(menu.selectedSystemIndex)]?.id ?? "resume"
    };
  }

  if (menu.activeTab === "loadout") {
    return confirmLoadoutSelection(state);
  }

  if (menu.activeTab === "telum_loadout") {
    return confirmTelumLoadoutSelection(state);
  }

  if (menu.activeTab === "shop") {
    return confirmShopSelection(state);
  }

  if (menu.activeTab === "mission_board") {
    return confirmMissionBoardSelection(state);
  }

  if (menu.activeTab !== "characters") return { ok: false, reason: "no_confirm_action" };
  if (menu.characterStage === "pilots") {
    menu.characterStage = "stats";
    return { ok: false, reason: "open_character_stats" };
  }
  return spendPilotStatPoint(state, menu.selectedPilotId, menu.selectedStatKey);
}

export function selectGameMenuPilot(state, pilotId) {
  const id = String(pilotId ?? "").trim();
  if (!id) return false;
  const exists = getVisiblePilotEntries(state).some((entry) => entry.id === id);
  if (!exists) return false;
  const menu = normalizeGameMenuState(state);
  menu.selectedPilotId = id;
  if (menu.activeTab === "loadout") {
    menu.loadoutStage = "slots";
    menu.selectedLoadoutOptionIndex = 0;
  }
  return true;
}

export function selectGameMenuLoadoutSlot(state, slotKey) {
  const slot = normalizeLoadoutSlot(slotKey);
  const menu = normalizeGameMenuState(state);
  menu.selectedLoadoutSlot = slot;
  menu.selectedLoadoutOptionIndex = 0;
  if (menu.activeTab === "loadout") menu.loadoutStage = "gear";
  return true;
}

export function selectGameMenuLoadoutOption(state, index) {
  const menu = normalizeGameMenuState(state);
  menu.selectedLoadoutOptionIndex = normalizeLoadoutOptionIndex(index);
  if (menu.activeTab === "loadout") menu.loadoutStage = "gear";
  return true;
}

export function selectGameMenuMech(state, mechId) {
  const id = String(mechId ?? "").trim();
  if (!id) return false;
  const exists = getVisibleMechEntries(state).some((entry) => entry.id === id);
  if (!exists) return false;
  const menu = normalizeGameMenuState(state);
  menu.selectedMechId = id;
  if (menu.activeTab === "telum_loadout") {
    menu.telumLoadoutStage = "slots";
    menu.selectedTelumLoadoutOptionIndex = 0;
  }
  return true;
}

export function selectGameMenuTelumLoadoutSlot(state, slotKey) {
  const slot = normalizeTelumLoadoutSlot(slotKey);
  const menu = normalizeGameMenuState(state);
  menu.selectedTelumLoadoutSlot = slot;
  menu.selectedTelumLoadoutOptionIndex = 0;
  if (menu.activeTab === "telum_loadout") menu.telumLoadoutStage = "gear";
  return true;
}

export function selectGameMenuTelumLoadoutOption(state, index) {
  const menu = normalizeGameMenuState(state);
  menu.selectedTelumLoadoutOptionIndex = normalizeLoadoutOptionIndex(index);
  if (menu.activeTab === "telum_loadout") menu.telumLoadoutStage = "gear";
  return true;
}

export function selectGameMenuShopCategory(state, categoryKey) {
  const menu = normalizeGameMenuState(state);
  menu.selectedShopCategory = normalizeShopCategory(categoryKey);
  menu.selectedShopItemIndex = 0;
  if (menu.activeTab === "shop") menu.shopStage = "items";
  return true;
}

export function selectGameMenuMissionBoardIndex(state, index) {
  const missions = getMissionBoardEntries(state);
  const menu = normalizeGameMenuState(state);
  menu.selectedMissionBoardIndex = clampIndex(index, missions.length);
  return true;
}

export function selectGameMenuSystemAction(state, actionId) {
  const id = String(actionId ?? "").trim();
  const index = SYSTEM_ACTIONS.findIndex((action) => action.id === id);
  if (index < 0) return false;
  normalizeGameMenuState(state).selectedSystemIndex = index;
  return true;
}

export function setGameMenuStatus(state, text = "") {
  normalizeGameMenuState(state).statusText = String(text ?? "").trim();
}

export function spendPilotStatPoint(state, pilotId, statKey) {
  const id = String(pilotId ?? "").trim();
  const key = String(statKey ?? "").trim();
  if (!id || !PILOT_STAT_KEYS.includes(key)) return { ok: false, reason: "invalid_stat" };

  const campaign = state?.campaign;
  const progress = campaign?.pilots?.[id];
  if (!campaign || !progress || progress.recruited === false) return { ok: false, reason: "pilot_not_recruited" };

  const points = Math.max(0, Math.trunc(Number(progress.statPoints ?? 0) || 0));
  if (points <= 0) return { ok: false, reason: "no_points" };

  if (!progress.statBonuses || typeof progress.statBonuses !== "object") progress.statBonuses = {};
  const current = Math.max(0, Math.trunc(Number(progress.statBonuses[key] ?? 0) || 0));
  const cap = PILOT_STAT_CAPS[key];
  if (Number.isFinite(cap) && current >= cap) return { ok: false, reason: "stat_capped" };

  progress.statBonuses[key] = current + 1;
  progress.statPoints = points - 1;

  return { ok: true, pilotId: id, statKey: key, value: progress.statBonuses[key], remaining: progress.statPoints };
}

export function setPilotLoadoutChoice(state, pilotId, slotKey, equipmentId) {
  if (!canEditLoadoutsInSafePrep(state)) return { ok: false, reason: "loadout_locked" };

  const id = String(pilotId ?? "").trim();
  const slot = normalizeLoadoutSlot(slotKey);
  const options = getLoadoutOptions(state, { id, loadout: getPilotMenuLoadout(state, id) }, slot);
  const cleanEquipmentId = String(equipmentId ?? "").trim();
  const match = options.find((option) => String(option.id ?? "") === cleanEquipmentId && !option.disabled);
  if (!match) return { ok: false, reason: "invalid_equipment" };

  const result = setPilotLoadoutSlot(state?.campaign, id, slot, match.id ?? "", getPilotMenuLoadout(state, id));
  if (!result?.ok) return result ?? { ok: false, reason: "loadout_update_failed" };

  const removedPlacedRuntime = removePlacedDeploymentForPilot(state, id);
  const menu = normalizeGameMenuState(state);
  menu.selectedLoadoutSlot = slot;
  menu.statusText = removedPlacedRuntime
    ? "Loadout updated. Re-place that unit so deployment uses the new gear."
    : "Loadout updated.";
  return { ok: true, type: "loadout", pilotId: id, slotKey: slot, equipmentId: match.id ?? "", removedPlacedRuntime };
}

export function setMechLoadoutChoice(state, mechId, slotKey, equipmentId) {
  if (!canEditLoadoutsInSafePrep(state)) return { ok: false, reason: "loadout_locked" };

  const id = String(mechId ?? "").trim();
  const slot = normalizeTelumLoadoutSlot(slotKey);
  const options = getTelumLoadoutOptions(state, { id, loadout: getMechMenuLoadout(state, id) }, slot);
  const cleanEquipmentId = String(equipmentId ?? "").trim();
  const match = options.find((option) => String(option.id ?? "") === cleanEquipmentId && !option.disabled);
  if (!match) return { ok: false, reason: "invalid_equipment" };

  const result = setMechLoadoutSlot(state?.campaign, id, slot, match.id ?? "", getMechMenuLoadout(state, id));
  if (!result?.ok) return result ?? { ok: false, reason: "mech_loadout_update_failed" };

  const menu = normalizeGameMenuState(state);
  menu.selectedTelumLoadoutSlot = slot;
  menu.statusText = "Telum loadout updated.";
  return { ok: true, type: "telum_loadout", mechId: id, slotKey: slot, equipmentId: match.id ?? "" };
}


export function renderGameMenu(state) {
  const menu = normalizeGameMenuState(state);
  if (!menu.open) return "";

  if (menu.contextScreenId) {
    const title = getContextScreenTitle(menu.contextScreenId);
    const tabId = getContextScreenTabId(menu.contextScreenId);
    return `
      <div class="game-menu-backdrop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <section class="game-menu-card game-menu-card--terminal game-menu-card--context">
          <header class="game-menu-header game-menu-header--terminal">
            <div>
              <div class="game-menu-kicker">Context Terminal</div>
              <h2 class="game-menu-title">${escapeHtml(title)}</h2>
            </div>
            <button type="button" class="game-menu-close" data-game-menu-action="close">Close (I)</button>
          </header>
          <div class="game-menu-body game-menu-body--terminal game-menu-body--context">
            ${renderActiveTab(state, tabId)}
          </div>
          <footer class="game-menu-footer game-menu-footer--terminal">
            <span>↑/↓ select · Enter open/equip · ← back · I close</span>
            <span>Opened from map interaction.</span>
          </footer>
        </section>
      </div>
    `;
  }

  return `
    <div class="game-menu-backdrop" role="dialog" aria-modal="true" aria-label="Game Menu">
      <section class="game-menu-card game-menu-card--terminal">
        <header class="game-menu-header game-menu-header--terminal">
          <div>
            <div class="game-menu-kicker">Campaign Menu</div>
            <h2 class="game-menu-title">Ars Caelorum</h2>
          </div>
          <button type="button" class="game-menu-close" data-game-menu-action="close">Close (I)</button>
        </header>
        <nav class="game-menu-tabs game-menu-tabs--terminal" aria-label="Campaign menu tabs">
          ${getVisibleTabs(menu).map((tab) => `
            <button
              type="button"
              class="game-menu-tab ${tab.id === menu.activeTab ? "is-active" : ""}"
              data-game-menu-action="tab"
              data-game-menu-tab="${escapeHtml(tab.id)}"
            >${escapeHtml(tab.label)}</button>
          `).join("")}
        </nav>
        <div class="game-menu-body game-menu-body--terminal">
          ${renderActiveTab(state, menu.activeTab)}
        </div>
        <footer class="game-menu-footer game-menu-footer--terminal">
          <span>I/Esc close · Q/E tabs · ↑/↓ select · Enter opens/confirms · ← back</span>
          <span>${menu.activeTab === "system" ? "System actions are keyboard-first." : "Readout screen. Gear changes use ship/shop terminals."}</span>
        </footer>
      </section>
    </div>
  `;
}

function renderActiveTab(state, tabId) {
  if (tabId === "loadout") return renderLoadoutTab(state);
  if (tabId === "telum_loadout") return renderTelumLoadoutTab(state);
  if (tabId === "shop") return renderShopTab(state);
  if (tabId === "mission_board") return renderMissionBoardTab(state);
  if (tabId === "inventory") return renderInventoryTab(state);
  if (tabId === "missions") return renderMissionsTab(state);
  if (tabId === "lore") return renderLoreTab();
  if (tabId === "system") return renderSystemTab(state);
  return renderCharactersTab(state);
}

function renderCharactersTab(state) {
  const pilots = getVisiblePilotEntries(state);
  if (!pilots.length) {
    return `<div class="game-menu-empty">No recruited pilots yet.</div>`;
  }

  const menu = normalizeGameMenuState(state);
  const selected = pilots.find((pilot) => pilot.id === menu.selectedPilotId) ?? pilots[0];
  menu.selectedPilotId = selected.id;

  return `
    <div class="terminal-screen terminal-screen--characters">
      <section class="terminal-panel terminal-panel--list" aria-label="Pilot list">
        <div class="terminal-panel-title">Crew</div>
        <div class="terminal-row-list">
          ${pilots.map((pilot) => renderCompactPilotRow(pilot, selected.id, menu.characterStage === "pilots")).join("")}
        </div>
      </section>

      <section class="terminal-panel">
        <div class="terminal-panel-title">${escapeHtml(selected.name)} / ${escapeHtml(selected.role || "Pilot")}</div>
        <div class="terminal-strip">
          <span>Lv ${escapeHtml(selected.level)}</span>
          <span>SP ${escapeHtml(selected.statPoints)}</span>
          <span>${escapeHtml(getPilotStatusLabel(selected))}</span>
        </div>
        <div class="terminal-row-list terminal-row-list--stats">
          ${PILOT_STAT_KEYS.map((statKey) => renderStatRow(selected, statKey, menu.selectedStatKey, menu.characterStage === "stats")).join("")}
        </div>
      </section>

      <section class="terminal-panel">
        <div class="terminal-panel-title">Gear / Abilities</div>
        ${renderPilotLoadoutPanel(state, selected)}
        <div class="terminal-note">Ability slots pending. Target: 4 active abilities.</div>
      </section>
    </div>
  `;
}


function renderLoadoutTab(state) {
  const pilots = getVisiblePilotEntries(state);
  const editable = canEditLoadoutsInSafePrep(state);

  if (!pilots.length) {
    return `<div class="game-menu-empty">No recruited pilots yet.</div>`;
  }

  const menu = normalizeGameMenuState(state);
  const selected = pilots.find((pilot) => pilot.id === menu.selectedPilotId) ?? pilots[0];
  menu.selectedPilotId = selected.id;

  const selectedSlot = normalizeLoadoutSlot(menu.selectedLoadoutSlot);
  menu.selectedLoadoutSlot = selectedSlot;
  const slotMeta = LOADOUT_SLOTS.find((slot) => slot.key === selectedSlot) ?? LOADOUT_SLOTS[0];
  const options = getLoadoutOptions(state, selected, selectedSlot);
  menu.selectedLoadoutOptionIndex = clampIndex(menu.selectedLoadoutOptionIndex, options.length);
  const stage = normalizeLoadoutStage(menu.loadoutStage);
  menu.loadoutStage = stage;

  return `
    <div class="loadout-console ${editable ? "" : "is-locked"}">
      <div class="loadout-console-head">
        <strong>Ship Locker</strong>
        <span>${editable ? "EDIT" : "LOCKED"}</span>
      </div>
      <div class="loadout-console-grid">
        <section class="loadout-column ${stage === "pilots" ? "is-focused" : ""}">
          <div class="loadout-column-title">Pilot</div>
          <div class="loadout-row-list">
            ${pilots.map((pilot) => renderLoadoutPilotRow(pilot, selected.id, stage === "pilots")).join("")}
          </div>
        </section>
        <section class="loadout-column ${stage === "slots" ? "is-focused" : ""}">
          <div class="loadout-column-title">Gear Slots</div>
          <div class="loadout-row-list">
            ${LOADOUT_SLOTS.map((slot) => renderLoadoutSlotRow(state, selected, slot, selectedSlot === slot.key, stage === "slots")).join("")}
          </div>
        </section>
        <section class="loadout-column ${stage === "gear" ? "is-focused" : ""}">
          <div class="loadout-column-title">${escapeHtml(slotMeta.label)} Options</div>
          <div class="loadout-row-list">
            ${stage === "gear"
              ? options.map((option, index) => renderLoadoutGearRow(state, selected, slotMeta, option, editable, selected.loadout?.[selectedSlot] ?? "", index, menu.selectedLoadoutOptionIndex === index)).join("")
              : `<div class="loadout-empty-row">Enter on a gear slot to choose equipment.</div>`}
          </div>
        </section>
      </div>
      ${menu.statusText ? `<div class="loadout-status">${escapeHtml(menu.statusText)}</div>` : ""}
    </div>
  `;
}

function renderLoadoutPilotRow(pilot, selectedId, focusColumn) {
  const selected = pilot.id === selectedId;
  return `
    <button
      type="button"
      class="loadout-row ${selected ? "is-selected" : ""} ${focusColumn && selected ? "is-cursor" : ""}"
      data-game-menu-action="select-pilot"
      data-pilot-id="${escapeHtml(pilot.id)}"
    >
      <span>${escapeHtml(pilot.name)}</span>
      <b>Lv ${escapeHtml(pilot.level)}</b>
    </button>
  `;
}

function renderLoadoutSlotRow(state, pilot, slot, selected, focusColumn) {
  const currentId = pilot?.loadout?.[slot.key] ?? "";
  const entry = getContentEntry(state, currentId, slot.type);
  const name = entry?.name ?? (currentId || "Empty");
  const modifierText = renderModifierText(entry?.modifiers);

  return `
    <button
      type="button"
      class="loadout-row ${selected ? "is-selected" : ""} ${focusColumn && selected ? "is-cursor" : ""}"
      data-game-menu-action="select-loadout-slot"
      data-loadout-slot="${escapeHtml(slot.key)}"
    >
      <span>${escapeHtml(slot.label)}</span>
      <b>${escapeHtml(name)}${modifierText ? ` - ${escapeHtml(modifierText)}` : ""}</b>
    </button>
  `;
}

function renderLoadoutGearRow(state, pilot, slot, option, editable, currentId, index, selected) {
  const active = String(option.id ?? "") === String(currentId ?? "");
  const disabled = !editable || Boolean(option.disabled);
  const entry = option.id ? getContentEntry(state, option.id, slot.type) : null;
  const label = entry?.name ?? (option.id ? option.id : "Empty");
  const detail = option.id ? renderModifierText(entry?.modifiers) : "None";

  return `
    <button
      type="button"
      class="loadout-row ${selected ? "is-cursor" : ""} ${active ? "is-equipped" : ""}"
      data-game-menu-action="set-loadout-slot"
      data-pilot-id="${escapeHtml(pilot.id)}"
      data-loadout-slot="${escapeHtml(slot.key)}"
      data-loadout-option-index="${escapeHtml(index)}"
      data-equipment-id="${escapeHtml(option.id ?? "")}"
      ${disabled ? "disabled" : ""}
    >
      <span>${active ? "* " : ""}${escapeHtml(label)}</span>
      <b>${escapeHtml(detail)}</b>
    </button>
  `;
}


function renderTelumLoadoutTab(state) {
  const mechs = getVisibleMechEntries(state);
  const editable = canEditLoadoutsInSafePrep(state);

  if (!mechs.length) {
    return `<div class="game-menu-empty">No Telum frames available.</div>`;
  }

  const menu = normalizeGameMenuState(state);
  const selected = mechs.find((mech) => mech.id === menu.selectedMechId) ?? mechs[0];
  menu.selectedMechId = selected.id;

  const selectedSlot = normalizeTelumLoadoutSlot(menu.selectedTelumLoadoutSlot);
  menu.selectedTelumLoadoutSlot = selectedSlot;
  const slotMeta = TELUM_LOADOUT_SLOTS.find((slot) => slot.key === selectedSlot) ?? TELUM_LOADOUT_SLOTS[0];
  const options = getTelumLoadoutOptions(state, selected, selectedSlot);
  menu.selectedTelumLoadoutOptionIndex = clampIndex(menu.selectedTelumLoadoutOptionIndex, options.length);
  const stage = normalizeLoadoutStage(menu.telumLoadoutStage);
  menu.telumLoadoutStage = stage;

  return `
    <div class="loadout-console ${editable ? "" : "is-locked"}">
      <div class="loadout-console-head">
        <strong>Mech Bay</strong>
        <span>${editable ? "EDIT" : "LOCKED"}</span>
      </div>
      <div class="loadout-console-grid loadout-console-grid--telum">
        <section class="loadout-column ${stage === "pilots" ? "is-focused" : ""}">
          <div class="loadout-column-title">Telum</div>
          <div class="loadout-row-list">
            ${mechs.map((mech) => renderTelumFrameRow(mech, selected.id, stage === "pilots")).join("")}
          </div>
        </section>
        <section class="loadout-column ${stage === "slots" ? "is-focused" : ""}">
          <div class="loadout-column-title">Mounts</div>
          <div class="loadout-row-list">
            ${TELUM_LOADOUT_SLOTS.map((slot) => renderTelumSlotRow(state, selected, slot, selectedSlot === slot.key, stage === "slots")).join("")}
          </div>
        </section>
        <section class="loadout-column ${stage === "gear" ? "is-focused" : ""}">
          <div class="loadout-column-title">${escapeHtml(slotMeta.label)} Options</div>
          <div class="loadout-row-list">
            ${stage === "gear"
              ? options.map((option, index) => renderTelumGearRow(state, selected, slotMeta, option, editable, selected.loadout?.[selectedSlot] ?? "", index, menu.selectedTelumLoadoutOptionIndex === index)).join("")
              : `<div class="loadout-empty-row">Enter on a mount to choose equipment.</div>`}
          </div>
        </section>
      </div>
      ${menu.statusText ? `<div class="loadout-status">${escapeHtml(menu.statusText)}</div>` : ""}
    </div>
  `;
}

function renderTelumFrameRow(mech, selectedId, focusColumn) {
  const selected = mech.id === selectedId;
  return `
    <button
      type="button"
      class="loadout-row ${selected ? "is-selected" : ""} ${focusColumn && selected ? "is-cursor" : ""}"
      data-game-menu-action="select-mech"
      data-mech-id="${escapeHtml(mech.id)}"
    >
      <span>${escapeHtml(mech.name)}</span>
      <b>${escapeHtml(mech.class || mech.role || mech.id)}</b>
    </button>
  `;
}

function renderTelumSlotRow(state, mech, slot, selected, focusColumn) {
  const currentId = mech?.loadout?.[slot.key] ?? "";
  const entry = getContentEntry(state, currentId, slot.type);
  const name = entry?.name ?? (currentId || "Empty");
  const modifierText = renderModifierText(entry?.modifiers);

  return `
    <button
      type="button"
      class="loadout-row ${selected ? "is-selected" : ""} ${focusColumn && selected ? "is-cursor" : ""}"
      data-game-menu-action="select-telum-loadout-slot"
      data-loadout-slot="${escapeHtml(slot.key)}"
    >
      <span>${escapeHtml(slot.label)}</span>
      <b>${escapeHtml(name)}${modifierText ? ` - ${escapeHtml(modifierText)}` : ""}</b>
    </button>
  `;
}

function renderTelumGearRow(state, mech, slot, option, editable, currentId, index, selected) {
  const active = String(option.id ?? "") === String(currentId ?? "");
  const disabled = !editable || Boolean(option.disabled);
  const entry = option.id ? getContentEntry(state, option.id, slot.type) : null;
  const label = entry?.name ?? (option.id ? option.id : "Empty");
  const detail = option.id ? renderModifierText(entry?.modifiers) || renderWeaponDetail(entry) : "None";

  return `
    <button
      type="button"
      class="loadout-row ${selected ? "is-cursor" : ""} ${active ? "is-equipped" : ""}"
      data-game-menu-action="set-telum-loadout-slot"
      data-mech-id="${escapeHtml(mech.id)}"
      data-loadout-slot="${escapeHtml(slot.key)}"
      data-loadout-option-index="${escapeHtml(index)}"
      data-equipment-id="${escapeHtml(option.id ?? "")}"
      ${disabled ? "disabled" : ""}
    >
      <span>${active ? "* " : ""}${escapeHtml(label)}</span>
      <b>${escapeHtml(detail)}</b>
    </button>
  `;
}

function renderShopTab(state) {
  const menu = normalizeGameMenuState(state);
  const category = SHOP_CATEGORIES.find((entry) => entry.key === menu.selectedShopCategory) ?? SHOP_CATEGORIES[0];
  menu.selectedShopCategory = category.key;
  const items = getShopItemsForCategory(state, category);
  menu.selectedShopItemIndex = clampIndex(menu.selectedShopItemIndex, items.length);
  const selectedItem = items[menu.selectedShopItemIndex] ?? null;
  const shop = getActiveShopDefinition(state, menu.shopId);
  const shopName = shop?.name ?? (menu.shopId ? menu.shopId : "Shop");

  return `
    <div class="terminal-screen terminal-screen--context-list">
      <section class="terminal-panel ${menu.shopStage === "categories" ? "is-focused" : ""}">
        <div class="terminal-panel-title">${escapeHtml(shopName)}</div>
        <div class="terminal-row-list">
          ${SHOP_CATEGORIES.map((entry) => `
            <button type="button" class="terminal-row ${entry.key === category.key ? "is-selected" : ""} ${menu.shopStage === "categories" && entry.key === category.key ? "is-cursor" : ""}" data-game-menu-action="select-shop-category" data-shop-category="${escapeHtml(entry.key)}">
              <span>${escapeHtml(entry.label)}</span><b>${escapeHtml(getShopItemsForCategory(state, entry).length)}</b>
            </button>
          `).join("")}
        </div>
      </section>
      <section class="terminal-panel ${menu.shopStage === "items" ? "is-focused" : ""}">
        <div class="terminal-panel-title">Stock / ${escapeHtml(category.label)}</div>
        <div class="terminal-row-list">
          ${items.length ? items.map((item, index) => renderShopItemRow(state, item, category.type, menu.shopStage === "items" && index === menu.selectedShopItemIndex)).join("") : `<div class="terminal-empty">No stock in this category.</div>`}
        </div>
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Details</div>
        ${selectedItem ? renderShopDetail(selectedItem) : `<div class="terminal-empty">Select stock.</div>`}
        <div class="terminal-note">Shop economy is shell-only in this pass. Buy/sell hooks come after gear authority is stable.</div>
      </section>
    </div>
  `;
}

function renderShopItemRow(state, item, type, selected) {
  const detail = renderModifierText(item?.modifiers) || renderWeaponDetail(item) || item?.id || "";
  return `<button type="button" class="terminal-row ${selected ? "is-cursor" : ""}" disabled><span>${escapeHtml(item?.name ?? item?.id ?? "Item")}</span><b>${escapeHtml(detail)}</b></button>`;
}

function renderShopDetail(item) {
  const modifierText = renderModifierText(item?.modifiers);
  const weaponText = renderWeaponDetail(item);
  return `
    <div class="terminal-record terminal-record--stack">
      <strong>${escapeHtml(item?.name ?? item?.id ?? "Item")}</strong>
      <span>${escapeHtml(item?.id ?? "")}</span>
      ${modifierText ? `<span>${escapeHtml(modifierText)}</span>` : ""}
      ${weaponText ? `<span>${escapeHtml(weaponText)}</span>` : ""}
      ${item?.description || item?.notes ? `<span>${escapeHtml(item.description ?? item.notes)}</span>` : ""}
    </div>
  `;
}

function renderMissionBoardTab(state) {
  const missions = getMissionBoardEntries(state);
  const menu = normalizeGameMenuState(state);
  menu.selectedMissionBoardIndex = clampIndex(menu.selectedMissionBoardIndex, missions.length);
  const selected = missions[menu.selectedMissionBoardIndex] ?? null;

  return `
    <div class="terminal-screen terminal-screen--context-list">
      <section class="terminal-panel terminal-panel--wide">
        <div class="terminal-panel-title">Mission Board</div>
        <div class="terminal-row-list">
          ${missions.length ? missions.map((mission, index) => `
            <button type="button" class="terminal-row ${index === menu.selectedMissionBoardIndex ? "is-cursor" : ""}" data-game-menu-action="select-mission-board" data-mission-index="${escapeHtml(index)}">
              <span>${escapeHtml(mission.name)}</span><b>${escapeHtml(mission.id)}</b>
            </button>
          `).join("") : `<div class="terminal-empty">No unlocked missions.</div>`}
        </div>
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Selected</div>
        ${selected ? `
          <div class="terminal-record terminal-record--stack">
            <strong>${escapeHtml(selected.name)}</strong>
            <span>${escapeHtml(selected.id)}</span>
            <span>${selected.completed ? "Completed" : "Available"}</span>
          </div>
          <div class="terminal-note">Enter opens the mission select/deployment screen.</div>
        ` : `<div class="terminal-empty">Select mission.</div>`}
      </section>
    </div>
  `;
}


function renderPilotLoadoutPanel(state, pilot) {
  const loadout = pilot?.loadout ?? {};
  const rows = [
    ["Armor", loadout.armor, "armor"],
    ["Accessory", loadout.accessory, "accessory"],
    ["Primary", loadout.primaryWeapon, "weapon"],
    ["Secondary", loadout.secondaryWeapon, "weapon"]
  ];

  return `
    <div class="terminal-row-list">
      ${rows.map(([label, id, type]) => `
        <div class="terminal-static-row">
          <span>${escapeHtml(label)}</span>
          <b>${renderEquipmentText(state, id, type)}</b>
        </div>
      `).join("")}
    </div>
  `;
}

function renderEquipmentText(state, id, type) {
  const clean = String(id ?? "").trim();
  if (!clean) return "Empty";
  const entry = getContentEntry(state, clean, type);
  const name = entry?.name ?? clean;
  const modifierText = renderModifierText(entry?.modifiers);
  return `${escapeHtml(name)}${modifierText ? ` · ${escapeHtml(modifierText)}` : ""}`;
}


function renderEquipmentName(state, id, type) {
  const clean = String(id ?? "").trim();
  if (!clean) return `<span class="game-menu-muted">Empty</span>`;
  const entry = getContentEntry(state, clean, type);
  const name = entry?.name ?? clean;
  const modifierText = renderModifierText(entry?.modifiers);
  return `<span>${escapeHtml(name)}</span>${modifierText ? ` <span class="game-menu-muted">${escapeHtml(modifierText)}</span>` : ""}`;
}

function renderCatalogIdList(state, items, type, emptyText) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul class="game-menu-id-list">${list.map((itemId) => {
    const entry = getContentEntry(state, itemId, type);
    const name = entry?.name ?? itemId;
    const modifierText = renderModifierText(entry?.modifiers);
    return `<li><strong>${escapeHtml(name)}</strong><br><span class="game-menu-muted">${escapeHtml(itemId)}${modifierText ? ` - ${escapeHtml(modifierText)}` : ""}</span></li>`;
  }).join("")}</ul>`;
}

function renderCatalogRows(state, items, type, emptyText) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<div class="terminal-empty">${escapeHtml(emptyText)}</div>`;
  return `<div class="terminal-row-list">${list.map((itemId) => {
    const entry = getContentEntry(state, itemId, type);
    const name = entry?.name ?? itemId;
    const modifierText = renderModifierText(entry?.modifiers);
    return `<div class="terminal-static-row"><span>${escapeHtml(name)}</span><b>${escapeHtml(modifierText || itemId)}</b></div>`;
  }).join("")}</div>`;
}

function renderMissionRows(state, items, emptyText) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<div class="terminal-empty">${escapeHtml(emptyText)}</div>`;
  return `<div class="terminal-row-list">${list.map((missionId) => {
    const name = getMissionDisplayName(state, missionId);
    return `<div class="terminal-static-row"><span>${escapeHtml(name)}</span><b>${escapeHtml(missionId)}</b></div>`;
  }).join("")}</div>`;
}

function renderObjectiveRows(objectives, emptyText) {
  const list = Array.isArray(objectives) ? objectives : [];
  if (!list.length) return `<div class="terminal-empty">${escapeHtml(emptyText)}</div>`;
  return `<div class="terminal-row-list">${list.map((objective) => {
    const done = Boolean(objective?.completed);
    const required = Math.max(1, Number(objective?.required ?? 1) || 1);
    const progress = required > 1 ? `${Number(objective?.progress ?? 0) || 0}/${required}` : "";
    return `<div class="terminal-static-row"><span>${done ? "✓" : "□"} ${escapeHtml(objective?.label ?? objective?.id ?? "Objective")}</span><b>${escapeHtml(progress)}</b></div>`;
  }).join("")}</div>`;
}


function getContentEntry(state, id, type) {
  const clean = String(id ?? "").trim();
  if (!clean) return null;
  const content = state?.content ?? {};
  const catalogs = type === "weapon"
    ? [content.weapons]
    : type === "mechWeapon"
      ? [content.weapons]
      : type === "mechGear"
        ? [content.mechGear]
        : type === "item"
          ? [content.pilotItems, content.mechItems]
          : [content.pilotGear];
  return catalogs
    .flatMap((catalog) => Array.isArray(catalog) ? catalog : [])
    .find((entry) => {
      if (String(entry?.id ?? "") !== clean) return false;
      if (type === "weapon") return String(entry?.scale ?? "pilot") === "pilot";
      if (type === "mechWeapon") return String(entry?.scale ?? "mech") === "mech";
      if (type === "armor" || type === "accessory") return entry?.slot === type;
      return true;
    }) ?? null;
}

function renderModifierText(modifiers) {
  if (!modifiers || typeof modifiers !== "object") return "";
  return Object.entries(modifiers)
    .map(([key, value]) => [key, Math.trunc(Number(value ?? 0) || 0)])
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${titleCase(key)}`)
    .join(", ");
}

function renderPilotGroup(title, pilots, selectedId, emptyText) {
  return `
    <div class="game-menu-list-group">
      <div class="game-menu-list-heading">${escapeHtml(title)}</div>
      ${pilots.length
        ? pilots.map((pilot) => renderPilotRow(pilot, selectedId)).join("")
        : `<div class="game-menu-list-empty">${escapeHtml(emptyText)}</div>`}
    </div>
  `;
}

function renderPilotRow(pilot, selectedId) {
  return renderCompactPilotRow(pilot, selectedId);
}

function renderCompactPilotRow(pilot, selectedId, focusColumn = true) {
  return `
    <button
      type="button"
      class="terminal-row ${pilot.id === selectedId ? "is-selected" : ""} ${focusColumn && pilot.id === selectedId ? "is-cursor" : ""} ${pilot.active ? "is-active" : ""}"
      data-game-menu-action="select-pilot"
      data-pilot-id="${escapeHtml(pilot.id)}"
    >
      <span>${escapeHtml(pilot.name)}</span>
      <b>${escapeHtml(getPilotStatusLabel(pilot))} · Lv ${escapeHtml(pilot.level)}</b>
    </button>
  `;
}


function getPilotStatusLabel(pilot) {
  if (pilot.active) return "Active";
  if (!pilot.available) return "Unavailable";
  return "Inactive";
}

function renderStatRow(pilot, statKey, selectedStatKey, focusColumn = true) {
  const base = pilot.baseStats[statKey] ?? 0;
  const bonus = pilot.statBonuses[statKey] ?? 0;
  const total = pilot.totalStats[statKey] ?? (base + bonus);
  const cap = PILOT_STAT_CAPS[statKey];
  const capped = Number.isFinite(cap) && bonus >= cap;
  const disabled = pilot.statPoints <= 0 || capped;
  const helper = statKey === "core"
    ? `Core HP ${total * 5}`
    : Number.isFinite(cap)
      ? `Cap ${cap}`
      : "Value";

  return `
    <div class="terminal-row terminal-row--stat ${statKey === selectedStatKey ? "is-selected" : ""} ${focusColumn && statKey === selectedStatKey ? "is-cursor" : ""}">
      <span>${escapeHtml(STAT_LABELS[statKey] ?? statKey)}</span>
      <b>${escapeHtml(base)}+${escapeHtml(bonus)} = ${escapeHtml(total)}</b>
      <em>${escapeHtml(helper)}</em>
      <button
        type="button"
        class="terminal-mini-button"
        data-game-menu-action="spend-stat"
        data-pilot-id="${escapeHtml(pilot.id)}"
        data-stat-key="${escapeHtml(statKey)}"
        ${disabled ? "disabled" : ""}
      >+1</button>
    </div>
  `;
}


function renderInventoryTab(state) {
  const inventory = state?.campaign?.inventory ?? {};
  const credits = Math.max(0, Math.trunc(Number(inventory.currency ?? 0) || 0));
  const items = Array.isArray(inventory.items) ? inventory.items : [];
  const weapons = Array.isArray(inventory.weapons) ? inventory.weapons : [];
  const armor = Array.isArray(inventory.armor) ? inventory.armor : [];
  const accessories = Array.isArray(inventory.accessories) ? inventory.accessories : [];
  const mechWeapons = Array.isArray(inventory.mechWeapons) ? inventory.mechWeapons : [];
  const mechGear = Array.isArray(inventory.mechGear) ? inventory.mechGear : [];

  return `
    <div class="terminal-screen terminal-screen--inventory">
      <section class="terminal-panel terminal-panel--status">
        <div class="terminal-panel-title">Credits</div>
        <div class="terminal-big-value">${escapeHtml(credits)}</div>
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Weapons</div>
        ${renderCatalogRows(state, weapons, "weapon", "No stored weapons.")}
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Armor</div>
        ${renderCatalogRows(state, armor, "armor", "No armor.")}
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Accessories</div>
        ${renderCatalogRows(state, accessories, "accessory", "No accessories.")}
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Telum Weapons</div>
        ${renderCatalogRows(state, mechWeapons, "mechWeapon", "No Telum weapons.")}
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Telum Gear</div>
        ${renderCatalogRows(state, mechGear, "mechGear", "No Telum gear.")}
      </section>
      <section class="terminal-panel terminal-panel--wide">
        <div class="terminal-panel-title">Items</div>
        ${renderCatalogRows(state, items, "item", "No items.")}
      </section>
    </div>
  `;
}


function renderMissionsTab(state) {
  const campaign = state?.campaign ?? {};
  const completed = Array.isArray(campaign.completedMissions) ? campaign.completedMissions : [];
  const unlocked = Array.isArray(campaign.unlockedMissions) ? campaign.unlockedMissions : [];
  const currentMissionId = state?.mission?.definition?.id ?? campaign.currentMissionId ?? "None";
  const currentMissionName = getMissionDisplayName(state, currentMissionId);
  const activeMapId = state?.mission?.definition?.activeMapId ?? state?.mission?.definition?.mapId ?? state?.map?.id ?? "None";
  const objectives = getMissionObjectiveStatus(state);

  return `
    <div class="terminal-screen terminal-screen--missions">
      <section class="terminal-panel terminal-panel--wide">
        <div class="terminal-panel-title">Current</div>
        <div class="terminal-record">
          <strong>${escapeHtml(currentMissionName)}</strong>
          <span>${escapeHtml(currentMissionId)} · Map ${escapeHtml(activeMapId)}</span>
        </div>
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Objectives</div>
        ${renderObjectiveRows(objectives, "No active objectives.")}
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Unlocked</div>
        ${renderMissionRows(state, unlocked, "No unlocked missions.")}
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Completed</div>
        ${renderMissionRows(state, completed, "No completed missions.")}
      </section>
    </div>
  `;
}


function renderLoreTab() {
  return `
    <div class="terminal-screen terminal-screen--lore">
      <section class="terminal-panel terminal-panel--wide">
        <div class="terminal-panel-title">Codex</div>
        <div class="terminal-record">
          <strong>Not Built</strong>
          <span>Corporations, pilots, Telum, Magi, Aether, mission intel, and world terms will live here.</span>
        </div>
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Queue</div>
        <div class="terminal-row-list">
          <div class="terminal-static-row"><span>Kholer Corp</span><b>Pending</b></div>
          <div class="terminal-static-row"><span>Gabrielle Agency</span><b>Pending</b></div>
          <div class="terminal-static-row"><span>Telum Frames</span><b>Pending</b></div>
        </div>
      </section>
    </div>
  `;
}


function renderSystemTab(state) {
  const menu = normalizeGameMenuState(state);
  const difficulty = state?.campaign?.difficulty ?? "normal";
  return `
    <div class="terminal-screen terminal-screen--system">
      <section class="terminal-panel">
        <div class="terminal-panel-title">Campaign</div>
        <div class="terminal-row-list">
          <div class="terminal-static-row"><span>Difficulty</span><b>${escapeHtml(titleCase(difficulty))}</b></div>
          <div class="terminal-static-row"><span>Save Rule</span><b>Manual / Rewards</b></div>
          <div class="terminal-static-row"><span>Gear Rule</span><b>Ship / Shop Only</b></div>
        </div>
      </section>
      <section class="terminal-panel terminal-panel--wide">
        <div class="terminal-panel-title">Actions</div>
        <div class="terminal-row-list">
          ${SYSTEM_ACTIONS.map((action, index) => `
            <button
              type="button"
              class="terminal-row terminal-row--action ${index === menu.selectedSystemIndex ? "is-cursor" : ""}"
              data-game-menu-action="system-action"
              data-system-action="${escapeHtml(action.id)}"
            ><span>${escapeHtml(action.label)}</span><b>Enter</b></button>
          `).join("")}
        </div>
      </section>
      <section class="terminal-panel">
        <div class="terminal-panel-title">Controls</div>
        <div class="terminal-note">↑/↓ choose action. Enter confirms. I or Esc closes.</div>
        ${menu.statusText ? `<div class="terminal-status">${escapeHtml(menu.statusText)}</div>` : ""}
      </section>
    </div>
  `;
}


function getVisiblePilotEntries(state) {
  const definitions = Array.isArray(state?.content?.pilots) ? state.content.pilots : [];
  const campaignPilots = state?.campaign?.pilots && typeof state.campaign.pilots === "object" ? state.campaign.pilots : {};
  const activePilotIds = getActivePlayerControlledPilotIds(state);

  return Object.entries(campaignPilots)
    .filter(([, progress]) => progress?.recruited !== false)
    .map(([pilotId, progress]) => {
      const definition = definitions.find((pilot) => pilot?.id === pilotId) ?? { id: pilotId, name: pilotId };
      const baseStats = {
        core: numberStat(definition.core, 1),
        abilityPoints: numberStat(definition.abilityPoints, 0),
        targeting: numberStat(definition.targeting, 0),
        reaction: numberStat(definition.reaction, 0)
      };
      const statBonuses = normalizeMenuBonuses(progress?.statBonuses);
      const totalStats = Object.fromEntries(PILOT_STAT_KEYS.map((key) => [key, baseStats[key] + statBonuses[key]]));

      return {
        id: pilotId,
        name: definition.name ?? pilotId,
        role: definition.role ?? "",
        available: progress?.available !== false,
        active: activePilotIds.has(pilotId),
        level: Math.max(1, Math.trunc(Number(progress?.level ?? 1) || 1)),
        statPoints: Math.max(0, Math.trunc(Number(progress?.statPoints ?? 0) || 0)),
        baseStats,
        statBonuses,
        totalStats,
        loadout: normalizePilotLoadout(progress?.loadout, {
          ...(definition.loadout && typeof definition.loadout === "object" ? definition.loadout : {}),
          weapons: definition.loadout?.weapons ?? definition.weapons ?? []
        })
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function getActivePlayerControlledPilotIds(state) {
  const units = Array.isArray(state?.units) ? state.units : [];
  return new Set(units
    .filter((unit) => unit?.unitType === "pilot")
    .filter((unit) => String(unit?.team ?? "player") === "player")
    .filter((unit) => String(unit?.controlType ?? "PC") === "PC")
    .map((unit) => String(unit?.definitionId ?? unit?.pilotId ?? "").trim())
    .filter(Boolean));
}

function getVisibleMechEntries(state) {
  const definitions = Array.isArray(state?.content?.mechs) ? state.content.mechs : [];
  const campaignMechs = state?.campaign?.mechs && typeof state.campaign.mechs === "object" ? state.campaign.mechs : {};
  const ids = new Set([
    ...definitions.map((mech) => String(mech?.id ?? "").trim()).filter(Boolean),
    ...Object.keys(campaignMechs).map((id) => String(id ?? "").trim()).filter(Boolean)
  ]);

  return [...ids].map((mechId) => {
    const definition = definitions.find((mech) => mech?.id === mechId) ?? { id: mechId, name: mechId };
    const progress = campaignMechs[mechId] ?? { unlocked: true };
    return {
      id: mechId,
      name: definition.name ?? mechId,
      class: definition.class ?? "",
      role: definition.role ?? "",
      unlocked: progress?.unlocked !== false,
      loadout: normalizeMechLoadout(progress?.loadout, {
        ...(definition.loadout && typeof definition.loadout === "object" ? definition.loadout : {}),
        weapons: definition.loadout?.weapons ?? definition.weapons ?? []
      })
    };
  })
    .filter((mech) => mech.unlocked !== false)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function getMissionDisplayName(state, missionId) {
  const id = String(missionId ?? "").trim();
  const missions = Array.isArray(state?.content?.missionCatalog?.missions) ? state.content.missionCatalog.missions : [];
  const found = missions.find((mission) => String(mission?.id ?? "").trim() === id);
  return (found?.name ?? id) || "None";
}

function renderMissionIdList(state, items, emptyText) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul class="game-menu-id-list">${list.map((missionId) => {
    const name = getMissionDisplayName(state, missionId);
    return `<li><strong>${escapeHtml(name)}</strong><br><span class="game-menu-muted">${escapeHtml(missionId)}</span></li>`;
  }).join("")}</ul>`;
}

function renderObjectiveList(objectives, emptyText) {
  const list = Array.isArray(objectives) ? objectives : [];
  if (!list.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul class="game-menu-id-list">${list.map((objective) => {
    const done = Boolean(objective?.completed);
    const required = Math.max(1, Number(objective?.required ?? 1) || 1);
    const progress = required > 1 ? ` ${Number(objective?.progress ?? 0) || 0}/${required}` : "";
    return `<li>${done ? "✓" : "□"} ${escapeHtml(objective?.label ?? objective?.id ?? "Objective")}${escapeHtml(progress)}</li>`;
  }).join("")}</ul>`;
}

function normalizeMenuBonuses(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(PILOT_STAT_KEYS.map((key) => [key, Math.max(0, Math.trunc(Number(source[key] ?? 0) || 0))]));
}

function renderIdList(items, emptyText) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul class="game-menu-id-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function canEditLoadoutsInSafePrep(state) {
  return Boolean(state?.map?.allowsLoadoutEditing === true || state?.mission?.definition?.allowsLoadoutEditing === true);
}

function removePlacedDeploymentForPilot(state, pilotId) {
  const roster = Array.isArray(state?.ui?.deployment?.roster) ? state.ui.deployment.roster : [];
  const entry = roster.find((candidate) => String(candidate?.pilotDefinitionId ?? candidate?.pilotDefinition?.id ?? "") === String(pilotId ?? ""));
  const linkedIds = new Set((entry?.linkedInstanceIds ?? []).map((id) => String(id ?? "")).filter(Boolean));
  if (!linkedIds.size || !Array.isArray(state?.units)) return false;

  const before = state.units.length;
  state.units = state.units.filter((unit) => !linkedIds.has(String(unit?.instanceId ?? "")));
  const removed = state.units.length !== before;
  if (removed && linkedIds.has(String(state?.selection?.unitId ?? ""))) {
    state.selection.unitId = null;
  }
  if (removed && state?.ui?.deployment) {
    state.ui.deployment.menuFocus = "map";
  }
  return removed;
}

function getPilotMenuLoadout(state, pilotId) {
  const definition = (Array.isArray(state?.content?.pilots) ? state.content.pilots : []).find((pilot) => pilot?.id === pilotId) ?? {};
  const progress = state?.campaign?.pilots?.[pilotId] ?? {};
  return normalizePilotLoadout(progress?.loadout, {
    ...(definition.loadout && typeof definition.loadout === "object" ? definition.loadout : {}),
    weapons: definition.loadout?.weapons ?? definition.weapons ?? []
  });
}

function getLoadoutOptions(state, pilot, slotKey) {
  const slot = normalizeLoadoutSlot(slotKey);
  const inventory = state?.campaign?.inventory ?? {};
  const loadout = pilot?.loadout ?? getPilotMenuLoadout(state, pilot?.id);
  const currentId = String(loadout?.[slot] ?? "").trim();

  if (slot === "armor") {
    return buildOwnedOptions(state, inventory.armor, "armor", currentId);
  }

  if (slot === "accessory") {
    return [{ id: "" }, ...buildOwnedOptions(state, inventory.accessories, "accessory", currentId)];
  }

  if (slot === "primaryWeapon" || slot === "secondaryWeapon") {
    const otherSlot = slot === "primaryWeapon" ? "secondaryWeapon" : "primaryWeapon";
    const otherWeaponId = String(loadout?.[otherSlot] ?? "").trim();
    return buildOwnedOptions(state, inventory.weapons, "weapon", currentId).map((option) => ({
      ...option,
      disabled: Boolean(option.id && otherWeaponId && option.id === otherWeaponId)
    }));
  }

  return [];
}

function buildOwnedOptions(state, ids, type, currentId = "") {
  const merged = [...new Set([...(Array.isArray(ids) ? ids : []), currentId].map((id) => String(id ?? "").trim()).filter(Boolean))];
  return merged
    .filter((id) => Boolean(getContentEntry(state, id, type)))
    .map((id) => ({ id }));
}


function getMechMenuLoadout(state, mechId) {
  const definition = (Array.isArray(state?.content?.mechs) ? state.content.mechs : []).find((mech) => mech?.id === mechId) ?? {};
  const progress = state?.campaign?.mechs?.[mechId] ?? {};
  const source = progress?.loadout && typeof progress.loadout === "object" ? progress.loadout : {};
  const fallback = definition.loadout && typeof definition.loadout === "object" ? definition.loadout : {};
  const sourceWeapons = Array.isArray(source.weapons) ? source.weapons : [];
  const fallbackWeapons = Array.isArray(fallback.weapons) ? fallback.weapons : (Array.isArray(definition.weapons) ? definition.weapons : []);
  const primaryWeapon = String(source.primaryWeapon ?? sourceWeapons[0] ?? fallback.primaryWeapon ?? fallbackWeapons[0] ?? "").trim();
  const secondaryWeapon = String(source.secondaryWeapon ?? sourceWeapons[1] ?? fallback.secondaryWeapon ?? fallbackWeapons[1] ?? "").trim();
  const supportWeapon = String(source.supportWeapon ?? sourceWeapons[2] ?? fallback.supportWeapon ?? fallbackWeapons[2] ?? "").trim();
  return {
    plating: String(source.plating ?? source.armor ?? fallback.plating ?? fallback.armor ?? "").trim(),
    system: String(source.system ?? fallback.system ?? "").trim(),
    primaryWeapon,
    secondaryWeapon,
    supportWeapon,
    weapons: [primaryWeapon, secondaryWeapon, supportWeapon].filter(Boolean),
    abilities: Array.isArray(source.abilities) && source.abilities.length ? [...source.abilities] : (Array.isArray(fallback.abilities) ? [...fallback.abilities] : []),
    items: Array.isArray(source.items) && source.items.length ? [...source.items] : (Array.isArray(fallback.items) ? [...fallback.items] : [])
  };
}

function getTelumLoadoutOptions(state, mech, slotKey) {
  const slot = normalizeTelumLoadoutSlot(slotKey);
  const inventory = state?.campaign?.inventory ?? {};
  const loadout = mech?.loadout ?? getMechMenuLoadout(state, mech?.id);
  const currentId = String(loadout?.[slot] ?? "").trim();

  if (slot === "plating" || slot === "system") {
    const base = buildOwnedOptions(state, inventory.mechGear, "mechGear", currentId)
      .filter((option) => {
        const entry = getContentEntry(state, option.id, "mechGear");
        return entry?.slot === slot;
      });
    return slot === "system" ? [{ id: "" }, ...base] : base;
  }

  if (slot === "primaryWeapon" || slot === "secondaryWeapon" || slot === "supportWeapon") {
    const otherIds = new Set([loadout.primaryWeapon, loadout.secondaryWeapon, loadout.supportWeapon]
      .map((id) => String(id ?? "").trim())
      .filter(Boolean));
    otherIds.delete(currentId);
    return buildOwnedOptions(state, inventory.mechWeapons, "mechWeapon", currentId).map((option) => ({
      ...option,
      disabled: Boolean(option.id && otherIds.has(option.id))
    }));
  }

  return [];
}

function getShopItemsForCategory(state, category) {
  const menu = normalizeGameMenuState(state);
  const shop = getActiveShopDefinition(state, menu.shopId);
  const stockIds = Array.isArray(shop?.stock) ? shop.stock : null;

  if (stockIds) {
    return stockIds
      .map((id) => getContentEntry(state, id, category.type))
      .filter((entry) => entry && doesShopEntryMatchCategory(entry, category));
  }

  const inventory = state?.campaign?.inventory ?? {};
  const ids = Array.isArray(inventory?.[category.key]) ? inventory[category.key] : [];
  return ids.map((id) => getContentEntry(state, id, category.type)).filter(Boolean);
}

function getActiveShopDefinition(state, shopId) {
  const id = String(shopId ?? "").trim();
  if (!id) return null;
  const shops = Array.isArray(state?.map?.shops) ? state.map.shops : [];
  return shops.find((shop) => String(shop?.id ?? "").trim() === id) ?? null;
}

function doesShopEntryMatchCategory(entry, category) {
  if (!entry || !category) return false;
  const type = category.type;
  if (type === "weapon") return String(entry.scale ?? "pilot").toLowerCase() !== "mech";
  if (type === "mechWeapon") return String(entry.scale ?? "pilot").toLowerCase() === "mech";
  if (type === "armor") return String(entry.scale ?? "pilot").toLowerCase() === "pilot" && String(entry.slot ?? "").toLowerCase() === "armor";
  if (type === "accessory") return String(entry.scale ?? "pilot").toLowerCase() === "pilot" && String(entry.slot ?? "").toLowerCase() === "accessory";
  if (type === "mechGear") return String(entry.scale ?? "").toLowerCase() === "mech";
  return true;
}

function getMissionBoardEntries(state) {
  const campaign = state?.campaign ?? {};
  const unlocked = Array.isArray(campaign.unlockedMissions) ? campaign.unlockedMissions : [];
  const completed = new Set(Array.isArray(campaign.completedMissions) ? campaign.completedMissions : []);
  return unlocked.map((missionId) => ({
    id: missionId,
    name: getMissionDisplayName(state, missionId),
    completed: completed.has(missionId)
  }));
}

function renderWeaponDetail(entry) {
  if (!entry) return "";
  const range = entry.range && typeof entry.range === "object"
    ? `${entry.range.min ?? 0}-${entry.range.max ?? 0}`
    : "";
  const damage = Number.isFinite(Number(entry.damage)) ? `DMG ${entry.damage}` : "";
  const parts = [damage, range ? `RNG ${range}` : ""].filter(Boolean);
  return parts.join(" / ");
}

function getEquipmentPlainName(state, id, type) {
  const entry = getContentEntry(state, id, type);
  return entry?.name ?? id;
}

function normalizeLoadoutSlot(slotKey) {
  const key = String(slotKey ?? "armor").trim();
  return LOADOUT_SLOTS.some((slot) => slot.key === key) ? key : LOADOUT_SLOTS[0].key;
}

function normalizeTelumLoadoutSlot(slotKey) {
  const key = String(slotKey ?? "plating").trim();
  return TELUM_LOADOUT_SLOTS.some((slot) => slot.key === key) ? key : TELUM_LOADOUT_SLOTS[0].key;
}

function normalizeShopCategory(categoryKey) {
  const key = String(categoryKey ?? "weapons").trim();
  return SHOP_CATEGORIES.some((category) => category.key === key) ? key : SHOP_CATEGORIES[0].key;
}

function normalizeShopStage(stage) {
  const value = String(stage ?? "categories").trim();
  return ["categories", "items"].includes(value) ? value : "categories";
}


function normalizeStatKey(statKey) {
  const key = String(statKey ?? "core").trim();
  return PILOT_STAT_KEYS.includes(key) ? key : PILOT_STAT_KEYS[0];
}

function getVisibleTabs(menu = {}) {
  return menu?.loadoutAccess ? [TABS[0], LOADOUT_TAB, ...TABS.slice(1)] : TABS;
}

function normalizeTab(tabId, menu = {}) {
  const id = String(tabId ?? "characters").trim().toLowerCase();
  if (menu?.contextScreenId && CONTEXT_TAB_IDS.includes(id)) return id;
  if (id === "loadout" && menu?.loadoutAccess) return "loadout";
  return TABS.some((tab) => tab.id === id) ? id : "characters";
}

function normalizeCharacterStage(stage) {
  const value = String(stage ?? "pilots").trim();
  return ["pilots", "stats"].includes(value) ? value : "pilots";
}

function normalizeLoadoutStage(stage) {
  const value = String(stage ?? "pilots").trim();
  return ["pilots", "slots", "gear"].includes(value) ? value : "pilots";
}

function normalizeLoadoutOptionIndex(value) {
  return Math.max(0, Math.trunc(Number(value ?? 0) || 0));
}

function clampIndex(value, length) {
  const count = Math.max(0, Math.trunc(Number(length ?? 0) || 0));
  if (count <= 0) return 0;
  return Math.max(0, Math.min(normalizeLoadoutOptionIndex(value), count - 1));
}

function moveLoadoutSelection(state, delta) {
  const menu = normalizeGameMenuState(state);
  const step = Math.sign(delta || 0);
  if (!step) return false;

  if (menu.loadoutStage === "gear") {
    const selected = getVisiblePilotEntries(state).find((pilot) => pilot.id === menu.selectedPilotId);
    const options = getLoadoutOptions(state, selected, menu.selectedLoadoutSlot);
    if (!options.length) return false;
    menu.selectedLoadoutOptionIndex = (clampIndex(menu.selectedLoadoutOptionIndex, options.length) + step + options.length) % options.length;
    return true;
  }

  if (menu.loadoutStage === "slots") {
    const currentIndex = Math.max(0, LOADOUT_SLOTS.findIndex((slot) => slot.key === menu.selectedLoadoutSlot));
    const nextIndex = (currentIndex + step + LOADOUT_SLOTS.length) % LOADOUT_SLOTS.length;
    menu.selectedLoadoutSlot = LOADOUT_SLOTS[nextIndex].key;
    menu.selectedLoadoutOptionIndex = 0;
    return true;
  }

  const pilots = getVisiblePilotEntries(state);
  if (!pilots.length) return false;
  const currentIndex = Math.max(0, pilots.findIndex((pilot) => pilot.id === menu.selectedPilotId));
  const nextIndex = (currentIndex + step + pilots.length) % pilots.length;
  menu.selectedPilotId = pilots[nextIndex].id;
  menu.selectedLoadoutOptionIndex = 0;
  return true;
}

function moveLoadoutStage(state, delta) {
  const menu = normalizeGameMenuState(state);
  const step = Math.sign(delta || 0);
  if (!step) return false;

  const order = ["pilots", "slots", "gear"];
  const currentIndex = Math.max(0, order.indexOf(menu.loadoutStage));
  const nextIndex = Math.max(0, Math.min(order.length - 1, currentIndex + step));
  menu.loadoutStage = order[nextIndex];
  if (menu.loadoutStage === "gear") menu.selectedLoadoutOptionIndex = clampIndex(menu.selectedLoadoutOptionIndex, getLoadoutOptions(state, getVisiblePilotEntries(state).find((pilot) => pilot.id === menu.selectedPilotId), menu.selectedLoadoutSlot).length);
  return true;
}

function confirmLoadoutSelection(state) {
  const menu = normalizeGameMenuState(state);
  if (menu.loadoutStage === "pilots") {
    menu.loadoutStage = "slots";
    return { ok: false, reason: "open_loadout_slots" };
  }
  if (menu.loadoutStage === "slots") {
    menu.loadoutStage = "gear";
    menu.selectedLoadoutOptionIndex = 0;
    return { ok: false, reason: "open_loadout_gear" };
  }

  const pilotId = menu.selectedPilotId;
  const slot = menu.selectedLoadoutSlot;
  const pilot = getVisiblePilotEntries(state).find((entry) => entry.id === pilotId);
  const options = getLoadoutOptions(state, pilot, slot);
  const index = clampIndex(menu.selectedLoadoutOptionIndex, options.length);
  const option = options[index];
  if (!option || option.disabled) return { ok: false, reason: "invalid_equipment" };
  return setPilotLoadoutChoice(state, pilotId, slot, option.id ?? "");
}


function moveTelumLoadoutSelection(state, delta) {
  const menu = normalizeGameMenuState(state);
  const step = Math.sign(delta || 0);
  if (!step) return false;

  if (menu.telumLoadoutStage === "gear") {
    const selected = getVisibleMechEntries(state).find((mech) => mech.id === menu.selectedMechId);
    const options = getTelumLoadoutOptions(state, selected, menu.selectedTelumLoadoutSlot);
    if (!options.length) return false;
    menu.selectedTelumLoadoutOptionIndex = (clampIndex(menu.selectedTelumLoadoutOptionIndex, options.length) + step + options.length) % options.length;
    return true;
  }

  if (menu.telumLoadoutStage === "slots") {
    const currentIndex = Math.max(0, TELUM_LOADOUT_SLOTS.findIndex((slot) => slot.key === menu.selectedTelumLoadoutSlot));
    const nextIndex = (currentIndex + step + TELUM_LOADOUT_SLOTS.length) % TELUM_LOADOUT_SLOTS.length;
    menu.selectedTelumLoadoutSlot = TELUM_LOADOUT_SLOTS[nextIndex].key;
    menu.selectedTelumLoadoutOptionIndex = 0;
    return true;
  }

  const mechs = getVisibleMechEntries(state);
  if (!mechs.length) return false;
  const currentIndex = Math.max(0, mechs.findIndex((mech) => mech.id === menu.selectedMechId));
  const nextIndex = (currentIndex + step + mechs.length) % mechs.length;
  menu.selectedMechId = mechs[nextIndex].id;
  menu.selectedTelumLoadoutOptionIndex = 0;
  return true;
}

function moveTelumLoadoutStage(state, delta) {
  const menu = normalizeGameMenuState(state);
  const step = Math.sign(delta || 0);
  if (!step) return false;
  const order = ["pilots", "slots", "gear"];
  const currentIndex = Math.max(0, order.indexOf(menu.telumLoadoutStage));
  const nextIndex = Math.max(0, Math.min(order.length - 1, currentIndex + step));
  menu.telumLoadoutStage = order[nextIndex];
  if (menu.telumLoadoutStage === "gear") {
    const selected = getVisibleMechEntries(state).find((mech) => mech.id === menu.selectedMechId);
    menu.selectedTelumLoadoutOptionIndex = clampIndex(menu.selectedTelumLoadoutOptionIndex, getTelumLoadoutOptions(state, selected, menu.selectedTelumLoadoutSlot).length);
  }
  return true;
}

function confirmTelumLoadoutSelection(state) {
  const menu = normalizeGameMenuState(state);
  if (menu.telumLoadoutStage === "pilots") {
    menu.telumLoadoutStage = "slots";
    return { ok: false, reason: "open_telum_loadout_slots" };
  }
  if (menu.telumLoadoutStage === "slots") {
    menu.telumLoadoutStage = "gear";
    menu.selectedTelumLoadoutOptionIndex = 0;
    return { ok: false, reason: "open_telum_loadout_gear" };
  }

  const mechId = menu.selectedMechId;
  const slot = menu.selectedTelumLoadoutSlot;
  const mech = getVisibleMechEntries(state).find((entry) => entry.id === mechId);
  const options = getTelumLoadoutOptions(state, mech, slot);
  const index = clampIndex(menu.selectedTelumLoadoutOptionIndex, options.length);
  const option = options[index];
  if (!option || option.disabled) return { ok: false, reason: "invalid_equipment" };
  return setMechLoadoutChoice(state, mechId, slot, option.id ?? "");
}

function moveShopSelection(state, delta) {
  const menu = normalizeGameMenuState(state);
  const step = Math.sign(delta || 0);
  if (!step) return false;
  if (menu.shopStage === "items") {
    const category = SHOP_CATEGORIES.find((entry) => entry.key === menu.selectedShopCategory) ?? SHOP_CATEGORIES[0];
    const items = getShopItemsForCategory(state, category);
    if (!items.length) return false;
    menu.selectedShopItemIndex = (clampIndex(menu.selectedShopItemIndex, items.length) + step + items.length) % items.length;
    return true;
  }
  const currentIndex = Math.max(0, SHOP_CATEGORIES.findIndex((entry) => entry.key === menu.selectedShopCategory));
  const nextIndex = (currentIndex + step + SHOP_CATEGORIES.length) % SHOP_CATEGORIES.length;
  menu.selectedShopCategory = SHOP_CATEGORIES[nextIndex].key;
  menu.selectedShopItemIndex = 0;
  return true;
}

function moveShopStage(state, delta) {
  const menu = normalizeGameMenuState(state);
  const step = Math.sign(delta || 0);
  if (!step) return false;
  if (step < 0 && menu.shopStage === "items") {
    menu.shopStage = "categories";
    return true;
  }
  if (step > 0 && menu.shopStage === "categories") {
    menu.shopStage = "items";
    return true;
  }
  return false;
}

function confirmShopSelection(state) {
  const menu = normalizeGameMenuState(state);
  if (menu.shopStage === "categories") {
    menu.shopStage = "items";
    menu.selectedShopItemIndex = 0;
    return { ok: false, reason: "open_shop_items" };
  }
  menu.statusText = "Shop buy/sell is not active in this build.";
  return { ok: false, reason: "shop_shell_only" };
}

function moveMissionBoardSelection(state, delta) {
  const menu = normalizeGameMenuState(state);
  const step = Math.sign(delta || 0);
  const missions = getMissionBoardEntries(state);
  if (!step || !missions.length) return false;
  menu.selectedMissionBoardIndex = (clampIndex(menu.selectedMissionBoardIndex, missions.length) + step + missions.length) % missions.length;
  return true;
}

function confirmMissionBoardSelection(state) {
  const missions = getMissionBoardEntries(state);
  const menu = normalizeGameMenuState(state);
  if (!missions.length) return { ok: false, reason: "no_missions" };
  menu.selectedMissionBoardIndex = clampIndex(menu.selectedMissionBoardIndex, missions.length);
  return { ok: true, type: "missionBoard", action: "missionSelect", missionId: missions[menu.selectedMissionBoardIndex]?.id ?? "" };
}

function normalizeSystemIndex(value) {
  const index = Math.trunc(Number(value ?? 0) || 0);
  return Math.max(0, Math.min(index, SYSTEM_ACTIONS.length - 1));
}

function numberStat(value, fallback = 0) {
  return Math.max(0, Math.trunc(Number(value ?? fallback) || fallback));
}

function titleCase(value) {
  const text = String(value ?? "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Normal";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
