// src/campaign/campaignState.js
//
// Persistent campaign authority V1.
// Keep this thin: campaign state is progression/save truth, not runtime map truth.

export const CAMPAIGN_VERSION = 1;

export function createInitialCampaignState({ defaultMissionId = "000_game_state_tester_mission" } = {}) {
  const missionId = cleanId(defaultMissionId) || "000_game_state_tester_mission";

  return {
    version: CAMPAIGN_VERSION,
    currentMissionId: missionId,
    completedMissions: [],
    unlockedMissions: [missionId],
    pilots: {},
    inventory: {
      currency: 0,
      weapons: [],
      armor: [],
      items: []
    },
    flags: {},
    claimedRewards: {}
  };
}

export function normalizeCampaignState(rawState, options = {}) {
  const fallback = createInitialCampaignState(options);
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const currentMissionId = cleanId(source.currentMissionId) || fallback.currentMissionId;
  const unlockedMissions = uniqueIds(source.unlockedMissions);
  const completedMissions = uniqueIds(source.completedMissions);

  if (!unlockedMissions.includes(currentMissionId)) {
    unlockedMissions.push(currentMissionId);
  }

  return {
    version: CAMPAIGN_VERSION,
    currentMissionId,
    completedMissions,
    unlockedMissions: unlockedMissions.length ? unlockedMissions : [currentMissionId],
    pilots: normalizeRecord(source.pilots),
    inventory: normalizeInventory(source.inventory),
    flags: normalizeRecord(source.flags),
    claimedRewards: normalizeRecord(source.claimedRewards)
  };
}

export function isMissionUnlocked(campaignState, missionId) {
  const id = cleanId(missionId);
  if (!id) return false;
  return ensureArray(campaignState?.unlockedMissions).includes(id);
}

export function markMissionCompleted(campaignState, missionId) {
  const id = cleanId(missionId);
  if (!campaignState || !id) return false;
  if (!Array.isArray(campaignState.completedMissions)) campaignState.completedMissions = [];
  if (campaignState.completedMissions.includes(id)) return false;
  campaignState.completedMissions.push(id);
  return true;
}

export function unlockMission(campaignState, missionId) {
  const id = cleanId(missionId);
  if (!campaignState || !id) return false;
  if (!Array.isArray(campaignState.unlockedMissions)) campaignState.unlockedMissions = [];
  if (campaignState.unlockedMissions.includes(id)) return false;
  campaignState.unlockedMissions.push(id);
  return true;
}

export function setCurrentMission(campaignState, missionId) {
  const id = cleanId(missionId);
  if (!campaignState || !id) return false;
  unlockMission(campaignState, id);
  campaignState.currentMissionId = id;
  return true;
}

function normalizeInventory(inventory) {
  const source = inventory && typeof inventory === "object" ? inventory : {};
  return {
    currency: Math.max(0, Math.trunc(Number(source.currency ?? 0) || 0)),
    weapons: uniqueIds(source.weapons),
    armor: uniqueIds(source.armor),
    items: uniqueIds(source.items)
  };
}

function normalizeRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

function uniqueIds(value) {
  return [...new Set(ensureArray(value).map(cleanId).filter(Boolean))];
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanId(value) {
  return String(value ?? "").trim();
}
