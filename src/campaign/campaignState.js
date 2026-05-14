// src/campaign/campaignState.js
//
// Persistent campaign authority V2.
// Campaign state is progression/save truth, not runtime map truth.

export const CAMPAIGN_VERSION = 2;
export const MAX_PILOT_LEVEL = 20;

export const PILOT_STAT_KEYS = [
  "core",
  "abilityPoints",
  "targeting",
  "reaction",
  "movement"
];

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
    pilots: normalizePilotProgressRecord(source.pilots),
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

export function createPilotProgress({ level = 1, statPoints = 0, recruited = true } = {}) {
  return {
    level: clampPilotLevel(level),
    statPoints: Math.max(0, Math.trunc(Number(statPoints ?? 0) || 0)),
    statBonuses: createEmptyStatBonuses(),
    learnedAbilities: [],
    activeAbilities: [],
    recruited: Boolean(recruited)
  };
}

export function ensurePilotProgress(campaignState, pilotId, options = {}) {
  const id = cleanId(pilotId);
  if (!campaignState || !id) return null;
  if (!campaignState.pilots || typeof campaignState.pilots !== "object" || Array.isArray(campaignState.pilots)) {
    campaignState.pilots = {};
  }

  const existing = campaignState.pilots[id];
  const normalized = normalizePilotProgress(existing, options);
  normalized.recruited = options.recruited === false ? false : true;
  campaignState.pilots[id] = normalized;
  return normalized;
}

export function getRecruitedPilotIds(campaignState) {
  const pilots = campaignState?.pilots;
  if (!pilots || typeof pilots !== "object" || Array.isArray(pilots)) return [];
  return Object.keys(pilots).filter((pilotId) => pilots[pilotId]?.recruited !== false);
}

export function clampPilotLevel(value) {
  return Math.min(MAX_PILOT_LEVEL, Math.max(1, Math.trunc(Number(value ?? 1) || 1)));
}

function normalizePilotProgressRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result = {};
  for (const [pilotId, progress] of Object.entries(value)) {
    const id = cleanId(pilotId);
    if (!id) continue;
    result[id] = normalizePilotProgress(progress);
  }
  return result;
}

function normalizePilotProgress(value, options = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fallbackLevel = options.level ?? 1;
  const normalized = createPilotProgress({
    level: source.level ?? fallbackLevel,
    statPoints: source.statPoints ?? 0,
    recruited: source.recruited !== false
  });

  normalized.statBonuses = normalizeStatBonuses(source.statBonuses);
  normalized.learnedAbilities = uniqueIds(source.learnedAbilities);
  normalized.activeAbilities = uniqueIds(source.activeAbilities);
  normalized.recruited = source.recruited !== false;
  return normalized;
}

function normalizeStatBonuses(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const result = createEmptyStatBonuses();
  for (const key of PILOT_STAT_KEYS) {
    result[key] = Math.max(0, Math.trunc(Number(source[key] ?? 0) || 0));
  }
  return result;
}

function createEmptyStatBonuses() {
  return PILOT_STAT_KEYS.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {});
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
