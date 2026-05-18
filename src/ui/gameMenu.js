// src/ui/gameMenu.js

import { PILOT_STAT_CAPS, PILOT_STAT_KEYS } from "../campaign/campaignState.js";

const TABS = Object.freeze([
  { id: "characters", label: "Characters" },
  { id: "inventory", label: "Inventory" },
  { id: "missions", label: "Missions" },
  { id: "lore", label: "Lore" },
  { id: "system", label: "System" }
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
  state.ui.gameMenu.activeTab = normalizeTab(state.ui.gameMenu.activeTab);
  state.ui.gameMenu.selectedPilotId = String(state.ui.gameMenu.selectedPilotId ?? "").trim();
  state.ui.gameMenu.selectedStatKey = normalizeStatKey(state.ui.gameMenu.selectedStatKey);
  state.ui.gameMenu.selectedSystemIndex = normalizeSystemIndex(state.ui.gameMenu.selectedSystemIndex);
  state.ui.gameMenu.statusText = String(state.ui.gameMenu.statusText ?? "").trim();

  return state.ui.gameMenu;
}

export function openGameMenu(state) {
  const menu = normalizeGameMenuState(state);
  menu.open = true;
  menu.activeTab = normalizeTab(menu.activeTab);

  const firstPilotId = getVisiblePilotEntries(state)[0]?.id ?? "";
  if (!menu.selectedPilotId && firstPilotId) {
    menu.selectedPilotId = firstPilotId;
  }
}

export function closeGameMenu(state) {
  normalizeGameMenuState(state).open = false;
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
  menu.activeTab = normalizeTab(tabId);
}

export function moveGameMenuTab(state, delta) {
  const menu = normalizeGameMenuState(state);
  const index = Math.max(0, TABS.findIndex((tab) => tab.id === menu.activeTab));
  const nextIndex = (index + delta + TABS.length) % TABS.length;
  menu.activeTab = TABS[nextIndex].id;
}

export function moveGameMenuSelection(state, delta) {
  const menu = normalizeGameMenuState(state);

  if (menu.activeTab === "system") {
    const currentIndex = normalizeSystemIndex(menu.selectedSystemIndex);
    menu.selectedSystemIndex = (currentIndex + Math.sign(delta || 0) + SYSTEM_ACTIONS.length) % SYSTEM_ACTIONS.length;
    return true;
  }

  if (menu.activeTab !== "characters") return false;

  const pilots = getVisiblePilotEntries(state);
  if (!pilots.length) return false;

  const currentIndex = Math.max(0, pilots.findIndex((pilot) => pilot.id === menu.selectedPilotId));
  const nextIndex = (currentIndex + Math.sign(delta || 0) + pilots.length) % pilots.length;
  menu.selectedPilotId = pilots[nextIndex].id;
  return true;
}

export function moveGameMenuStatSelection(state, delta) {
  const menu = normalizeGameMenuState(state);
  if (menu.activeTab !== "characters") return false;

  const currentIndex = Math.max(0, PILOT_STAT_KEYS.findIndex((key) => key === menu.selectedStatKey));
  const nextIndex = (currentIndex + Math.sign(delta || 0) + PILOT_STAT_KEYS.length) % PILOT_STAT_KEYS.length;
  menu.selectedStatKey = PILOT_STAT_KEYS[nextIndex];
  return true;
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

  if (menu.activeTab !== "characters") return { ok: false, reason: "no_confirm_action" };
  return spendPilotStatPoint(state, menu.selectedPilotId, menu.selectedStatKey);
}

export function selectGameMenuPilot(state, pilotId) {
  const id = String(pilotId ?? "").trim();
  if (!id) return false;
  const exists = getVisiblePilotEntries(state).some((entry) => entry.id === id);
  if (!exists) return false;
  normalizeGameMenuState(state).selectedPilotId = id;
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

export function renderGameMenu(state) {
  const menu = normalizeGameMenuState(state);
  if (!menu.open) return "";

  return `
    <div class="game-menu-backdrop" role="dialog" aria-modal="true" aria-label="Game Menu">
      <section class="game-menu-card">
        <header class="game-menu-header">
          <div>
            <div class="game-menu-kicker">Campaign Menu</div>
            <h2 class="game-menu-title">Ars Caelorum</h2>
          </div>
          <button type="button" class="game-menu-close" data-game-menu-action="close">Close (I)</button>
        </header>
        <nav class="game-menu-tabs" aria-label="Campaign menu tabs">
          ${TABS.map((tab) => `
            <button
              type="button"
              class="game-menu-tab ${tab.id === menu.activeTab ? "is-active" : ""}"
              data-game-menu-action="tab"
              data-game-menu-tab="${escapeHtml(tab.id)}"
            >${escapeHtml(tab.label)}</button>
          `).join("")}
        </nav>
        <div class="game-menu-body">
          ${renderActiveTab(state, menu.activeTab)}
        </div>
        <footer class="game-menu-footer">
          <span>I closes menu · Q/E switches tabs · Arrows navigate current tab · Enter confirms</span>
          <span>${menu.activeTab === "system" ? "System actions are keyboard-first." : "Stat changes apply when a mission/map loads."}</span>
        </footer>
      </section>
    </div>
  `;
}

function renderActiveTab(state, tabId) {
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
    <div class="game-menu-grid game-menu-grid--characters">
      <aside class="game-menu-list" aria-label="Pilot list">
        ${pilots.map((pilot) => `
          <button
            type="button"
            class="game-menu-list-row ${pilot.id === selected.id ? "is-selected" : ""}"
            data-game-menu-action="select-pilot"
            data-pilot-id="${escapeHtml(pilot.id)}"
          >
            <span>${escapeHtml(pilot.name)}</span>
            <b>${pilot.available ? "Ready" : "Inactive"} · Lv ${escapeHtml(pilot.level)}</b>
          </button>
        `).join("")}
      </aside>
      <section class="game-menu-detail">
        <div class="game-menu-detail-head">
          <div>
            <h3>${escapeHtml(selected.name)}</h3>
            <p>${escapeHtml(selected.role || "Pilot")}</p>
          </div>
          <div class="game-menu-level-pill">Level ${escapeHtml(selected.level)}</div>
        </div>
        <div class="game-menu-stat-points">Unspent Stat Points: <strong>${escapeHtml(selected.statPoints)}</strong></div>
        <div class="game-menu-stat-grid">
          ${PILOT_STAT_KEYS.map((statKey) => renderStatRow(selected, statKey, menu.selectedStatKey)).join("")}
        </div>
        <div class="game-menu-subpanel">
          <h4>Abilities</h4>
          <p>Ability unlocks and active ability slots are not built yet. Current target: 4 active abilities.</p>
        </div>
      </section>
    </div>
  `;
}

function renderStatRow(pilot, statKey, selectedStatKey) {
  const base = pilot.baseStats[statKey] ?? 0;
  const bonus = pilot.statBonuses[statKey] ?? 0;
  const total = pilot.totalStats[statKey] ?? (base + bonus);
  const cap = PILOT_STAT_CAPS[statKey];
  const capped = Number.isFinite(cap) && bonus >= cap;
  const disabled = pilot.statPoints <= 0 || capped;
  const helper = statKey === "core"
    ? `Runtime Core HP: ${total * 5}`
    : Number.isFinite(cap)
      ? `Cap ${cap}`
      : "Direct value";

  return `
    <div class="game-menu-stat-row ${statKey === selectedStatKey ? "is-selected" : ""}">
      <div>
        <div class="game-menu-stat-name">${escapeHtml(STAT_LABELS[statKey] ?? statKey)}</div>
        <div class="game-menu-stat-help">Base ${escapeHtml(base)} + Bonus ${escapeHtml(bonus)} · ${escapeHtml(helper)}</div>
      </div>
      <div class="game-menu-stat-value">${escapeHtml(total)}</div>
      <button
        type="button"
        class="game-menu-small-button"
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

  return `
    <div class="game-menu-stack">
      <div class="game-menu-subpanel"><h3>Credits</h3><p class="game-menu-big-number">${escapeHtml(credits)}</p></div>
      <div class="game-menu-subpanel"><h3>Items</h3>${renderIdList(items, "No items yet.")}</div>
      <div class="game-menu-subpanel"><h3>Weapons</h3>${renderIdList(weapons, "No stored weapons yet.")}</div>
      <div class="game-menu-subpanel"><h3>Armor</h3>${renderIdList(armor, "No armor inventory yet.")}</div>
    </div>
  `;
}

function renderMissionsTab(state) {
  const campaign = state?.campaign ?? {};
  const completed = Array.isArray(campaign.completedMissions) ? campaign.completedMissions : [];
  const unlocked = Array.isArray(campaign.unlockedMissions) ? campaign.unlockedMissions : [];

  return `
    <div class="game-menu-stack">
      <div class="game-menu-subpanel"><h3>Current Mission</h3><p>${escapeHtml(campaign.currentMissionId ?? state?.mission?.definition?.id ?? "None")}</p></div>
      <div class="game-menu-subpanel"><h3>Unlocked Missions</h3>${renderIdList(unlocked, "No unlocked missions.")}</div>
      <div class="game-menu-subpanel"><h3>Completed Missions</h3>${renderIdList(completed, "No completed missions yet.")}</div>
    </div>
  `;
}

function renderLoreTab() {
  return `
    <div class="game-menu-subpanel">
      <h3>Lore</h3>
      <p>Codex entries will live here: corporations, pilots, Telum, Magi, Aether, mission intel, and world terms.</p>
    </div>
  `;
}

function renderSystemTab(state) {
  const menu = normalizeGameMenuState(state);
  const difficulty = state?.campaign?.difficulty ?? "normal";
  return `
    <div class="game-menu-stack">
      <div class="game-menu-subpanel"><h3>Campaign</h3><p>Difficulty: ${escapeHtml(titleCase(difficulty))}</p><p>Campaign state saves after rewards, stat spending, and manual Save.</p></div>
      <div class="game-menu-subpanel"><h3>Controls</h3><p>Arrow Up/Down chooses an action. Enter confirms. I or Esc closes this menu.</p></div>
      <div class="game-menu-actions game-menu-actions--stack">
        ${SYSTEM_ACTIONS.map((action, index) => `
          <button
            type="button"
            class="game-menu-system-action ${index === menu.selectedSystemIndex ? "is-selected" : ""}"
            data-game-menu-action="system-action"
            data-system-action="${escapeHtml(action.id)}"
          >${escapeHtml(action.label)}</button>
        `).join("")}
      </div>
      ${menu.statusText ? `<div class="game-menu-subpanel game-menu-status">${escapeHtml(menu.statusText)}</div>` : ""}
    </div>
  `;
}

function getVisiblePilotEntries(state) {
  const definitions = Array.isArray(state?.content?.pilots) ? state.content.pilots : [];
  const campaignPilots = state?.campaign?.pilots && typeof state.campaign.pilots === "object" ? state.campaign.pilots : {};

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
        level: Math.max(1, Math.trunc(Number(progress?.level ?? 1) || 1)),
        statPoints: Math.max(0, Math.trunc(Number(progress?.statPoints ?? 0) || 0)),
        baseStats,
        statBonuses,
        totalStats
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
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

function normalizeStatKey(statKey) {
  const key = String(statKey ?? "core").trim();
  return PILOT_STAT_KEYS.includes(key) ? key : PILOT_STAT_KEYS[0];
}

function normalizeTab(tabId) {
  const id = String(tabId ?? "characters").trim().toLowerCase();
  return TABS.some((tab) => tab.id === id) ? id : "characters";
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
