// src/campaign/campaignState.js
//
// Persistent campaign authority V2.
// Campaign state is progression/save truth, not runtime map truth.

export const CAMPAIGN_VERSION = 4;
export const PILOT_LEVEL_CAP = 20;
export const PILOT_STAT_CAPS = Object.freeze({
  targeting: 5,
  reaction: 5
});
export const PILOT_STAT_KEYS = Object.freeze(["core", "abilityPoints", "targeting", "reaction"]);
export const STARTING_RECRUIT_IDS = Object.freeze(["pilot_skye"]);

export function createInitialCampaignState({ defaultMissionId = "000_game_state_tester_mission" } = {}) {
  const missionId = cleanId(defaultMissionId) || "000_game_state_tester_mission";

  return {
    version: CAMPAIGN_VERSION,
    currentMissionId: missionId,
    completedMissions: [],
    unlockedMissions: [missionId],
    pilots: buildStartingPilots(),
    difficulty: "normal",
    inventory: buildStartingInventory(),
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
    pilots: normalizePilots({ ...buildStartingPilots(), ...(source.pilots && typeof source.pilots === "object" ? source.pilots : {}) }),
    difficulty: normalizeDifficulty(source.difficulty),
    inventory: normalizeInventory(source.inventory, fallback.inventory),
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
    recruited: existing?.recruited ?? defaults.recruited ?? true,
    available: existing?.available ?? defaults.available ?? true
  });

  return campaignState.pilots[id];
}

export function recruitPilot(campaignState, pilotId, defaults = {}) {
  const progress = ensurePilotProgress(campaignState, pilotId, { ...defaults, recruited: true, available: defaults.available ?? true });
  if (progress) {
    progress.recruited = true;
    if (defaults.available !== false) progress.available = true;
  }
  return progress;
}

export function setPilotRecruitment(campaignState, pilotId, recruited = true, defaults = {}) {
  const progress = ensurePilotProgress(campaignState, pilotId, { ...defaults, recruited: Boolean(recruited), available: Boolean(recruited) });
  if (!progress) return null;
  progress.recruited = Boolean(recruited);
  if (!progress.recruited) progress.available = false;
  return progress;
}

export function setPilotAvailability(campaignState, pilotId, available = true, defaults = {}) {
  const progress = ensurePilotProgress(campaignState, pilotId, { ...defaults, recruited: true, available: Boolean(available) });
  if (!progress) return null;
  progress.recruited = true;
  progress.available = Boolean(available);
  return progress;
}



export function setPilotLoadoutSlot(campaignState, pilotId, slotKey, equipmentId = "", fallbackLoadout = {}) {
  const id = cleanId(pilotId);
  const slot = cleanId(slotKey);
  if (!campaignState || !id || !["armor", "accessory", "primaryWeapon", "secondaryWeapon"].includes(slot)) {
    return { ok: false, reason: "invalid_loadout_slot" };
  }

  const progress = ensurePilotProgress(campaignState, id, { recruited: true });
  if (!progress) return { ok: false, reason: "pilot_not_found" };

  const current = normalizePilotLoadout({
    ...(fallbackLoadout && typeof fallbackLoadout === "object" ? fallbackLoadout : {}),
    ...(progress.loadout && typeof progress.loadout === "object" ? progress.loadout : {})
  });
  current[slot] = cleanId(equipmentId) || "";

  if (slot === "primaryWeapon" && current.primaryWeapon && current.primaryWeapon === current.secondaryWeapon) {
    current.secondaryWeapon = "";
  }

  if (slot === "secondaryWeapon" && current.secondaryWeapon && current.secondaryWeapon === current.primaryWeapon) {
    current.primaryWeapon = "";
  }

  progress.loadout = normalizePilotLoadout(current);
  return { ok: true, pilotId: id, slotKey: slot, equipmentId: progress.loadout[slot] ?? "" };
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

function buildStartingPilots() {
  return Object.fromEntries(STARTING_RECRUIT_IDS.map((pilotId) => [pilotId, normalizePilotProgress({ recruited: true })]));
}

function buildStartingInventory() {
  return {
    currency: 0,
    weapons: ["pilot_pistol_01", "pilot_rifle_01", "pilot_smg_01"],
    armor: ["pilot_armor_light_01", "pilot_armor_standard_01"],
    accessories: ["pilot_accessory_servo_assist_01", "pilot_accessory_targeting_stabilizer_01", "pilot_accessory_reaction_booster_01"],
    items: []
  };
}

function normalizeDifficulty(value) {
  const key = String(value ?? "normal").trim().toLowerCase();
  return ["story", "normal", "hard", "brutal"].includes(key) ? key : "normal";
}

function normalizeInventory(inventory, fallbackInventory = {}) {
  const source = inventory && typeof inventory === "object" ? inventory : {};
  const fallback = fallbackInventory && typeof fallbackInventory === "object" ? fallbackInventory : {};
  return {
    currency: Math.max(0, Math.trunc(Number(source.currency ?? fallback.currency ?? 0) || 0)),
    weapons: uniqueIds([...(fallback.weapons ?? []), ...(source.weapons ?? [])]),
    armor: uniqueIds([...(fallback.armor ?? []), ...(source.armor ?? [])]),
    accessories: uniqueIds([...(fallback.accessories ?? []), ...(source.accessories ?? [])]),
    items: uniqueIds([...(fallback.items ?? []), ...(source.items ?? [])])
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
    loadout: normalizePilotLoadout(source.loadout),
    recruited: source.recruited !== false,
    available: source.available !== false && source.recruited !== false
  };
}


function normalizePilotLoadout(loadout) {
  const source = loadout && typeof loadout === "object" ? loadout : {};
  const weapons = uniqueIds(source.weapons);
  const primaryWeapon = cleanId(source.primaryWeapon) || weapons[0] || "";
  const secondaryWeapon = cleanId(source.secondaryWeapon) || weapons[1] || "";
  const normalizedWeapons = uniqueIds([primaryWeapon, secondaryWeapon]);

  return {
    armor: cleanId(source.armor) || "",
    accessory: cleanId(source.accessory) || "",
    primaryWeapon,
    secondaryWeapon,
    weapons: normalizedWeapons,
    abilities: uniqueIds(source.abilities),
    items: uniqueIds(source.items)
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
