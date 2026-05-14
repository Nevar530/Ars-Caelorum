// src/campaign/campaignState.js
//
// Persistent campaign authority V2.
// Campaign state is progression/save truth, not runtime map truth.

export const CAMPAIGN_VERSION = 2;
export const PILOT_LEVEL_CAP = 20;
export const PILOT_STAT_CAPS = Object.freeze({
  targeting: 5,
  reaction: 5
});
export const PILOT_STAT_KEYS = Object.freeze(["core", "abilityPoints", "targeting", "reaction"]);

export function createInitialCampaignState({ defaultMissionId = "000_game_state_tester_mission" } = {}) {
  const missionId = cleanId(defaultMissionId) || "000_game_state_tester_mission";

  return {
    version: CAMPAIGN_VERSION,
    currentMissionId: missionId,
    completedMissions: [],
    unlockedMissions: [missionId],
    pilots: {},
    difficulty: "normal",
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
    pilots: normalizePilots(source.pilots),
    difficulty: normalizeDifficulty(source.difficulty),
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

export function ensurePilotProgress(campaignState, pilotId, defaults = {}) {
  const id = cleanId(pilotId);
  if (!campaignState || !id) return null;
  if (!campaignState.pilots || typeof campaignState.pilots !== "object" || Array.isArray(campaignState.pilots)) {
    campaignState.pilots = {};
  }

  const existing = campaignState.pilots[id];
  campaignState.pilots[id] = normalizePilotProgress({
    ...defaults,
    ...(existing && typeof existing === "object" ? existing : {}),
    recruited: existing?.recruited ?? defaults.recruited ?? true
  });

  return campaignState.pilots[id];
}

export function recruitPilot(campaignState, pilotId, defaults = {}) {
  const progress = ensurePilotProgress(campaignState, pilotId, { ...defaults, recruited: true });
  if (progress) progress.recruited = true;
  return progress;
}

export function addPilotLevels(campaignState, pilotId, levels = 1) {
  const progress = ensurePilotProgress(campaignState, pilotId, { recruited: true });
  if (!progress) return null;

  const amount = Math.max(0, Math.trunc(Number(levels ?? 0) || 0));
  if (!amount) return { pilotId: cleanId(pilotId), fromLevel: progress.level, toLevel: progress.level, gained: 0 };

  const fromLevel = progress.level;
  const toLevel = Math.min(PILOT_LEVEL_CAP, fromLevel + amount);
  const gained = Math.max(0, toLevel - fromLevel);

  progress.level = toLevel;
  progress.statPoints += gained;

  return { pilotId: cleanId(pilotId), fromLevel, toLevel, gained };
}

export function setPilotLevelFloor(campaignState, pilotId, floorLevel = 1) {
  const progress = ensurePilotProgress(campaignState, pilotId, { recruited: true });
  if (!progress) return null;

  const targetLevel = clampLevel(floorLevel);
  const fromLevel = progress.level;
  if (fromLevel >= targetLevel) return { pilotId: cleanId(pilotId), fromLevel, toLevel: fromLevel, gained: 0 };

  progress.level = targetLevel;
  const gained = Math.max(0, targetLevel - fromLevel);
  progress.statPoints += gained;

  return { pilotId: cleanId(pilotId), fromLevel, toLevel: targetLevel, gained };
}

export function getRecruitedPilotEntries(campaignState) {
  const pilots = campaignState?.pilots && typeof campaignState.pilots === "object" ? campaignState.pilots : {};
  return Object.entries(pilots)
    .filter(([, progress]) => progress?.recruited !== false)
    .map(([pilotId, progress]) => [pilotId, normalizePilotProgress(progress)]);
}

export function getRecruitedPilotAverageLevel(campaignState) {
  const entries = getRecruitedPilotEntries(campaignState);
  if (!entries.length) return 1;
  const total = entries.reduce((sum, [, progress]) => sum + Math.max(1, Number(progress.level ?? 1) || 1), 0);
  return total / entries.length;
}

export function getRecruitedPilotFloorLevel(campaignState) {
  return clampLevel(Math.floor(getRecruitedPilotAverageLevel(campaignState)));
}

function normalizeDifficulty(value) {
  const key = String(value ?? "normal").trim().toLowerCase();
  return ["story", "normal", "hard", "brutal"].includes(key) ? key : "normal";
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

function normalizePilots(pilots) {
  const source = pilots && typeof pilots === "object" && !Array.isArray(pilots) ? pilots : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([pilotId, progress]) => [cleanId(pilotId), normalizePilotProgress(progress)])
      .filter(([pilotId]) => Boolean(pilotId))
  );
}

export function normalizePilotProgress(progress) {
  const source = progress && typeof progress === "object" ? progress : {};
  return {
    level: clampLevel(source.level ?? 1),
    statPoints: Math.max(0, Math.trunc(Number(source.statPoints ?? 0) || 0)),
    statBonuses: normalizeStatBonuses(source.statBonuses),
    learnedAbilities: uniqueIds(source.learnedAbilities),
    activeAbilities: uniqueIds(source.activeAbilities),
    recruited: source.recruited !== false
  };
}

function normalizeStatBonuses(value) {
  const source = value && typeof value === "object" ? value : {};
  const bonuses = {};
  for (const key of PILOT_STAT_KEYS) {
    let amount = Math.max(0, Math.trunc(Number(source[key] ?? 0) || 0));
    if (Number.isFinite(PILOT_STAT_CAPS[key])) amount = Math.min(PILOT_STAT_CAPS[key], amount);
    bonuses[key] = amount;
  }
  return bonuses;
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

function clampLevel(value) {
  return Math.max(1, Math.min(PILOT_LEVEL_CAP, Math.trunc(Number(value ?? 1) || 1)));
}

function cleanId(value) {
  return String(value ?? "").trim();
}
