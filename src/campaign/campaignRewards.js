// src/campaign/campaignRewards.js
//
// Deterministic mission rewards V2.
// Rewards are authored on mission data, applied once per mission/result, and persisted to campaign state.
// Progression uses milestone levels, not XP.

import {
  addPilotLevels,
  getRecruitedPilotFloorLevel,
  markMissionCompleted,
  recruitPilot,
  setCurrentMission,
  setPilotLevelFloor,
  unlockMission
} from "./campaignState.js";

export function applyMissionRewards(campaignState, missionDefinition, missionResult) {
  if (!campaignState || !missionDefinition || !missionResult?.missionId) {
    return buildRewardOutcome({ applied: false, reason: "missing_campaign_or_mission" });
  }

  const result = missionResult.result === "defeat" ? "defeat" : "victory";
  const reward = missionDefinition?.rewards?.[result] ?? null;
  const rewardKey = `${missionResult.missionId}:${result}`;

  if (!reward) {
    if (result === "victory") markMissionCompleted(campaignState, missionResult.missionId);
    return buildRewardOutcome({ applied: false, reason: "no_reward", result });
  }

  if (!campaignState.claimedRewards) campaignState.claimedRewards = {};
  if (campaignState.claimedRewards[rewardKey]) {
    return buildRewardOutcome({ applied: false, reason: "already_claimed", result, reward });
  }

  ensureInventory(campaignState);

  const currency = Math.max(0, Math.trunc(Number(reward.currency ?? 0) || 0));
  const items = normalizeIds(reward.items);
  const unlocks = normalizeIds(reward.unlocks);
  const recruits = uniqueIds([
    ...normalizeIds(missionResult.deployedPlayerPilotIds),
    ...normalizeIds(reward.recruits)
  ]);
  const levelMilestone = result === "victory"
    ? Math.max(0, Math.trunc(Number(reward.levelMilestone ?? 0) || 0))
    : 0;

  campaignState.inventory.currency += currency;
  for (const itemId of items) {
    campaignState.inventory.items.push(itemId);
  }

  for (const pilotId of recruits) {
    recruitPilot(campaignState, pilotId);
  }

  let levelOutcome = {
    levelMilestone,
    activeLevelUps: [],
    reserveCatchUps: [],
    reserveFloor: null
  };

  if (levelMilestone > 0) {
    levelOutcome = applyLevelMilestone(campaignState, missionResult, levelMilestone);
  }

  if (result === "victory") {
    markMissionCompleted(campaignState, missionResult.missionId);
    for (const missionId of unlocks) unlockMission(campaignState, missionId);
    if (unlocks.length) setCurrentMission(campaignState, unlocks[0]);
  }

  campaignState.claimedRewards[rewardKey] = true;

  return buildRewardOutcome({
    applied: true,
    result,
    currency,
    items,
    unlocks,
    recruits,
    ...levelOutcome
  });
}

function applyLevelMilestone(campaignState, missionResult, levelMilestone) {
  const deployedPilotIds = uniqueIds(missionResult?.deployedPlayerPilotIds);
  const activeLevelUps = [];

  for (const pilotId of deployedPilotIds) {
    const outcome = addPilotLevels(campaignState, pilotId, levelMilestone);
    if (outcome?.gained) activeLevelUps.push(outcome);
  }

  const reserveFloor = getRecruitedPilotFloorLevel(campaignState);
  const reserveCatchUps = [];
  const deployedSet = new Set(deployedPilotIds);
  const pilots = campaignState?.pilots && typeof campaignState.pilots === "object" ? campaignState.pilots : {};

  for (const [pilotId, progress] of Object.entries(pilots)) {
    if (!pilotId || deployedSet.has(pilotId) || progress?.recruited === false) continue;
    const outcome = setPilotLevelFloor(campaignState, pilotId, reserveFloor);
    if (outcome?.gained) reserveCatchUps.push(outcome);
  }

  return {
    levelMilestone,
    activeLevelUps,
    reserveCatchUps,
    reserveFloor
  };
}

function buildRewardOutcome({
  applied,
  reason = "",
  result = "victory",
  reward = null,
  currency = 0,
  items = [],
  unlocks = [],
  recruits = [],
  levelMilestone = 0,
  activeLevelUps = [],
  reserveCatchUps = [],
  reserveFloor = null
}) {
  return {
    applied,
    reason,
    result,
    currency: Math.max(0, Math.trunc(Number(currency ?? reward?.currency ?? 0) || 0)),
    items: normalizeIds(items.length ? items : reward?.items),
    unlocks: normalizeIds(unlocks.length ? unlocks : reward?.unlocks),
    recruits: uniqueIds(recruits.length ? recruits : reward?.recruits),
    levelMilestone: Math.max(0, Math.trunc(Number(levelMilestone ?? reward?.levelMilestone ?? 0) || 0)),
    activeLevelUps: Array.isArray(activeLevelUps) ? activeLevelUps : [],
    reserveCatchUps: Array.isArray(reserveCatchUps) ? reserveCatchUps : [],
    reserveFloor
  };
}

function ensureInventory(campaignState) {
  if (!campaignState.inventory) campaignState.inventory = {};
  if (!Array.isArray(campaignState.inventory.weapons)) campaignState.inventory.weapons = [];
  if (!Array.isArray(campaignState.inventory.armor)) campaignState.inventory.armor = [];
  if (!Array.isArray(campaignState.inventory.items)) campaignState.inventory.items = [];
  campaignState.inventory.currency = Math.max(0, Math.trunc(Number(campaignState.inventory.currency ?? 0) || 0));
}

function normalizeIds(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];
}

function uniqueIds(value) {
  return [...new Set(normalizeIds(value))];
}
