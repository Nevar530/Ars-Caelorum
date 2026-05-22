// src/campaign/campaignState.js
//
// Persistent campaign authority V2.
// Campaign state is progression/save truth, not runtime map truth.

export const CAMPAIGN_VERSION = 7;
export const PILOT_LEVEL_CAP = 20;
export const PILOT_STAT_CAPS = Object.freeze({
  targeting: 5,
  reaction: 5
});
export const PILOT_STAT_KEYS = Object.freeze(["core", "abilityPoints", "targeting", "reaction"]);
export const STARTING_RECRUIT_IDS = Object.freeze(["pilot_skye"]);
export const STARTING_MECH_IDS = Object.freeze(["telum_skye", "telum_eve"]);

export function getPilotAbilityUnlockIds(pilotDefinition = {}, level = 1) {
  const currentLevel = clampLevel(level);
  const directAbilities = uniqueIds(pilotDefinition?.abilities);
  const progressionAbilities = (Array.isArray(pilotDefinition?.abilityProgression) ? pilotDefinition.abilityProgression : [])
    .filter((entry) => clampLevel(entry?.level ?? 1) <= currentLevel)
    .map((entry) => cleanId(entry?.abilityId))
    .filter(Boolean);

  return uniqueIds([...directAbilities, ...progressionAbilities]);
}

export function syncCampaignPilotAbilities(campaignState, content = {}) {
  if (!campaignState || !campaignState.pilots || typeof campaignState.pilots !== "object") {
    return { changed: false, pilots: [] };
  }

  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];
  const knownAbilityIds = getKnownAbilityIdSet(content);
  const changedPilots = [];

  for (const [pilotId, progress] of Object.entries(campaignState.pilots)) {
    if (!pilotId || progress?.recruited === false) continue;
    const definition = pilotDefinitions.find((pilot) => cleanId(pilot?.id) === pilotId) ?? null;
    if (!definition) continue;

    const before = uniqueIds(progress.learnedAbilities);
    const levelUnlocks = getPilotAbilityUnlockIds(definition, progress.level);
    const after = uniqueIds([
      ...before,
      ...levelUnlocks.filter((abilityId) => !knownAbilityIds.size || knownAbilityIds.has(abilityId))
    ]);

    if (after.length !== before.length || after.some((abilityId, index) => abilityId !== before[index])) {
      progress.learnedAbilities = after;
      changedPilots.push({ pilotId, learnedAbilities: after });
    }
  }

  return { changed: changedPilots.length > 0, pilots: changedPilots };
}

export function spendPilotStatPoint(campaignState, pilotId, statKey) {
  const id = cleanId(pilotId);
  const key = cleanId(statKey);
  if (!campaignState || !id || !PILOT_STAT_KEYS.includes(key)) return { ok: false, reason: "invalid_stat" };

  const progress = ensurePilotProgress(campaignState, id, { recruited: true });
  if (!progress || progress.recruited === false) return { ok: false, reason: "pilot_not_recruited" };

  const points = Math.max(0, Math.trunc(Number(progress.statPoints ?? 0) || 0));
  if (points <= 0) return { ok: false, reason: "no_points" };

  const current = Math.max(0, Math.trunc(Number(progress.statBonuses?.[key] ?? 0) || 0));
  const cap = PILOT_STAT_CAPS[key];
  if (Number.isFinite(cap) && current >= cap) return { ok: false, reason: "stat_capped" };

  progress.statBonuses = normalizeStatBonuses({ ...progress.statBonuses, [key]: current + 1 });
  progress.statPoints = points - 1;

  return { ok: true, pilotId: id, statKey: key, value: progress.statBonuses[key], remaining: progress.statPoints };
}

export function consumeCampaignLoadoutItem(campaignState, unit = {}, itemId = "") {
  const id = cleanId(itemId);
  if (!campaignState || !id) return { ok: false, reason: "invalid_item" };

  const isMech = unit?.unitType === "mech";
  const bucket = isMech ? campaignState.mechs : campaignState.pilots;
  const ownerId = cleanId(unit?.definitionId ?? unit?.pilotId ?? unit?.id);
  const progress = bucket && ownerId ? bucket[ownerId] : null;
  if (!progress || typeof progress !== "object") return { ok: false, reason: "missing_progress" };

  let removedFromLoadout = false;
  if (progress.loadout && typeof progress.loadout === "object") {
    const items = normalizeInventoryIds(progress.loadout.items);
    removedFromLoadout = removeFirstInventoryId(items, id);
    progress.loadout.items = items;
  }

  let removedFromStorage = false;
  if (campaignState.inventory && typeof campaignState.inventory === "object") {
    const items = normalizeInventoryIds(campaignState.inventory.items);
    removedFromStorage = removeFirstInventoryId(items, id);
    campaignState.inventory.items = items;
  }

  return { ok: removedFromLoadout || removedFromStorage, removedFromLoadout, removedFromStorage, ownerId, itemId: id };
}

const EQUIPMENT_ID_ALIASES = Object.freeze({
  pilot_accessory_servo_assist_01: "pilot_accessory_servo_01",
  pilot_accessory_targeting_stabilizer_01: "pilot_accessory_targeting_01",
  pilot_accessory_reaction_booster_01: "pilot_accessory_reaction_01"
});

export function createInitialCampaignState({ defaultMissionId = "000_game_state_tester_mission" } = {}) {
  const missionId = cleanId(defaultMissionId) || "000_game_state_tester_mission";

  return {
    version: CAMPAIGN_VERSION,
    currentMissionId: missionId,
    completedMissions: [],
    unlockedMissions: [missionId],
    pilots: buildStartingPilots(),
    mechs: buildStartingMechs(),
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
    mechs: normalizeMechs({ ...buildStartingMechs(), ...(source.mechs && typeof source.mechs === "object" ? source.mechs : {}) }),
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



export function ensureMechProgress(campaignState, mechId, defaults = {}) {
  const id = cleanId(mechId);
  if (!campaignState || !id) return null;
  if (!campaignState.mechs || typeof campaignState.mechs !== "object" || Array.isArray(campaignState.mechs)) {
    campaignState.mechs = {};
  }

  const existing = campaignState.mechs[id];
  campaignState.mechs[id] = normalizeMechProgress({
    ...defaults,
    ...(existing && typeof existing === "object" ? existing : {}),
    owned: existing?.owned ?? defaults.owned ?? false
  });

  return campaignState.mechs[id];
}

export function setMechOwnership(campaignState, mechId, owned = true, defaults = {}) {
  const progress = ensureMechProgress(campaignState, mechId, { ...defaults, owned: Boolean(owned) });
  if (!progress) return null;
  progress.owned = Boolean(owned);
  progress.unlocked = progress.owned;
  return progress;
}

export function setPilotLoadoutSlot(campaignState, pilotId, slotKey, equipmentId = "", fallbackLoadout = {}) {
  const id = cleanId(pilotId);
  const slot = cleanId(slotKey);
  if (!campaignState || !id || !isPilotLoadoutSlot(slot)) {
    return { ok: false, reason: "invalid_loadout_slot" };
  }

  const progress = ensurePilotProgress(campaignState, id, { recruited: true });
  if (!progress) return { ok: false, reason: "pilot_not_found" };

  const current = normalizePilotLoadout({
    ...(fallbackLoadout && typeof fallbackLoadout === "object" ? fallbackLoadout : {}),
    ...(progress.loadout && typeof progress.loadout === "object" ? progress.loadout : {})
  });
  if (slot.startsWith("item")) {
    const index = Math.max(0, Math.min(4, Math.trunc(Number(slot.replace("item", "")) || 1) - 1));
    const items = normalizeItemIds(current.items);
    while (items.length <= index) items.push("");
    items[index] = cleanId(equipmentId) || "";
    current.items = items.filter(Boolean);
  } else {
    current[slot] = cleanId(equipmentId) || "";
  }

  progress.loadout = normalizePilotLoadout(current);
  return { ok: true, pilotId: id, slotKey: slot, equipmentId: progress.loadout[slot] ?? "" };
}

export function setMechLoadoutSlot(campaignState, mechId, slotKey, equipmentId = "", fallbackLoadout = {}) {
  const id = cleanId(mechId);
  const slot = cleanId(slotKey);
  if (!campaignState || !id || !isMechLoadoutSlot(slot)) {
    return { ok: false, reason: "invalid_mech_loadout_slot" };
  }

  const progress = ensureMechProgress(campaignState, id, { owned: true });
  if (!progress) return { ok: false, reason: "mech_not_found" };

  const current = normalizeMechLoadout({
    ...(fallbackLoadout && typeof fallbackLoadout === "object" ? fallbackLoadout : {}),
    ...(progress.loadout && typeof progress.loadout === "object" ? progress.loadout : {})
  });
  if (slot.startsWith("item")) {
    const index = Math.max(0, Math.min(9, Math.trunc(Number(slot.replace("item", "")) || 1) - 1));
    const items = normalizeItemIds(current.items);
    while (items.length <= index) items.push("");
    items[index] = cleanId(equipmentId) || "";
    current.items = items.filter(Boolean);
  } else {
    current[slot] = cleanId(equipmentId) || "";
  }

  progress.loadout = normalizeMechLoadout(current);
  return { ok: true, mechId: id, slotKey: slot, equipmentId: progress.loadout[slot] ?? "" };
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

  return { pilotId: cleanId(pilotId), fromLevel, toLevel, gained, statPointsGained: gained };
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

  return { pilotId: cleanId(pilotId), fromLevel, toLevel: targetLevel, gained, statPointsGained: gained };
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

function buildStartingMechs() {
  return Object.fromEntries(STARTING_MECH_IDS.map((mechId) => [mechId, normalizeMechProgress({ owned: true })]));
}

function buildStartingInventory() {
  return {
    currency: 0,
    weapons: ["pilot_pistol_01", "pilot_rifle_01", "pilot_smg_01"],
    armor: ["pilot_armor_light_01", "pilot_armor_standard_01"],
    accessories: ["pilot_accessory_servo_01", "pilot_accessory_targeting_01", "pilot_accessory_reaction_01"],
    mechWeapons: ["machinegun_01", "melee_01", "srm_01", "lrm_01", "cannon_01"],
    mechGear: ["telum_plating_light_01", "telum_plating_standard_01", "telum_plating_heavy_01", "telum_system_mobility_01", "telum_system_stabilizer_01"],
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
  const useSourceBucket = (bucket) => Object.prototype.hasOwnProperty.call(source, bucket);
  return {
    currency: Math.max(0, Math.trunc(Number(source.currency ?? fallback.currency ?? 0) || 0)),
    weapons: normalizeInventoryIds(useSourceBucket("weapons") ? source.weapons : fallback.weapons),
    armor: normalizeInventoryIds(useSourceBucket("armor") ? source.armor : fallback.armor),
    accessories: normalizeInventoryIds(useSourceBucket("accessories") ? source.accessories : fallback.accessories),
    mechWeapons: normalizeInventoryIds(useSourceBucket("mechWeapons") ? source.mechWeapons : fallback.mechWeapons),
    mechGear: normalizeInventoryIds(useSourceBucket("mechGear") ? source.mechGear : fallback.mechGear),
    items: normalizeInventoryIds(useSourceBucket("items") ? source.items : fallback.items)
  };
}

function normalizeInventoryIds(ids) {
  const counts = new Map();
  const output = [];
  for (const rawId of Array.isArray(ids) ? ids : []) {
    const id = cleanId(rawId);
    if (!id) continue;
    const nextCount = (counts.get(id) ?? 0) + 1;
    if (nextCount > 99) continue;
    counts.set(id, nextCount);
    output.push(id);
  }
  return output;
}

function normalizeItemIds(ids) {
  return normalizeInventoryIds(ids);
}

function normalizePilots(pilots) {
  const source = pilots && typeof pilots === "object" && !Array.isArray(pilots) ? pilots : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([pilotId, progress]) => [cleanId(pilotId), normalizePilotProgress(progress)])
      .filter(([pilotId]) => Boolean(pilotId))
  );
}

function normalizeMechs(mechs) {
  const source = mechs && typeof mechs === "object" && !Array.isArray(mechs) ? mechs : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([mechId, progress]) => [cleanId(mechId), normalizeMechProgress(progress)])
      .filter(([mechId]) => Boolean(mechId))
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

export function normalizeMechProgress(progress) {
  const source = progress && typeof progress === "object" ? progress : {};
  return {
    loadout: normalizeMechLoadout(source.loadout),
    owned: source.owned === true,
    unlocked: source.owned === true
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
    items: normalizeItemIds(source.items)
  };
}

function isPilotLoadoutSlot(slot) {
  return ["armor", "accessory", "primaryWeapon", "secondaryWeapon", "item1", "item2", "item3", "item4", "item5"].includes(slot);
}

function normalizeMechLoadout(loadout) {
  const source = loadout && typeof loadout === "object" ? loadout : {};
  const weapons = uniqueIds(source.weapons);
  const primaryWeapon = cleanId(source.primaryWeapon) || weapons[0] || "";
  const secondaryWeapon = cleanId(source.secondaryWeapon) || weapons[1] || "";
  const supportWeapon = cleanId(source.supportWeapon) || weapons[2] || "";
  const normalizedWeapons = uniqueIds([primaryWeapon, secondaryWeapon, supportWeapon]);

  return {
    plating: cleanId(source.plating) || cleanId(source.armor) || "",
    system: cleanId(source.system) || "",
    primaryWeapon,
    secondaryWeapon,
    supportWeapon,
    weapons: normalizedWeapons,
    abilities: uniqueIds(source.abilities),
    items: normalizeItemIds(source.items)
  };
}

function isMechLoadoutSlot(slot) {
  return [
    "plating",
    "system",
    "primaryWeapon",
    "secondaryWeapon",
    "supportWeapon",
    "item1",
    "item2",
    "item3",
    "item4",
    "item5",
    "item6",
    "item7",
    "item8",
    "item9",
    "item10"
  ].includes(slot);
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

function getKnownAbilityIdSet(content = {}) {
  const ids = [
    ...(Array.isArray(content.abilities) ? content.abilities : []),
    ...(Array.isArray(content.pilotAbilities) ? content.pilotAbilities : []),
    ...(Array.isArray(content.mechAbilities) ? content.mechAbilities : [])
  ].map((ability) => cleanId(ability?.id)).filter(Boolean);
  return new Set(ids);
}

function removeFirstInventoryId(items, itemId) {
  const id = cleanId(itemId);
  if (!Array.isArray(items) || !id) return false;
  const index = items.findIndex((entry) => cleanId(entry) === id);
  if (index < 0) return false;
  items.splice(index, 1);
  return true;
}

function clampLevel(value) {
  return Math.max(1, Math.min(PILOT_LEVEL_CAP, Math.trunc(Number(value ?? 1) || 1)));
}

function cleanId(value) {
  const id = String(value ?? "").trim();
  return EQUIPMENT_ID_ALIASES[id] ?? id;
}
