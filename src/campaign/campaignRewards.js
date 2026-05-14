// src/campaign/campaignRewards.js
//
// Deterministic mission rewards V2.
// Rewards are authored on mission data, applied once per mission/result, and persisted to campaign state.
// Progression uses milestone levels, not XP.

import {
  clampPilotLevel,
  ensurePilotProgress,
  getRecruitedPilotIds,
  markMissionCompleted,
  setCurrentMission,
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

  const currency = Math.max(0, Math.trunc(Number(reward.currency ?? reward.credits ?? 0) || 0));
  const items = normalizeIds(reward.items);
  const unlocks = normalizeIds(reward.unlocks);
  const recruitedPilots = normalizeIds(reward.recruits ?? reward.recruitedPilots);

  campaignState.inventory.currency += currency;
  for (const itemId of items) campaignState.inventory.items.push(itemId);
  for (const pilotId of recruitedPilots) ensurePilotProgress(campaignState, pilotId, { recruited: true });

  const progression = result === "victory"
    ? applyMilestoneLevelReward(campaignState, reward, missionResult)
    : buildEmptyProgressionOutcome();

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
    recruitedPilots,
    progression
  });
}

function applyMilestoneLevelReward(campaignState, reward, missionResult) {
  const deployedPilotIds = normalizeIds(missionResult.deployedPilots);
  const milestoneLevels = getMilestoneLevels(reward);

  for (const pilotId of deployedPilotIds) ensurePilotProgress(campaignState, pilotId, { recruited: true });

  const activeLevelUps = [];
  if (milestoneLevels > 0) {
    for (const pilotId of deployedPilotIds) {
      const progress = ensurePilotProgress(campaignState, pilotId, { recruited: true });
      if (!progress) continue;

      const before = progress.level;
      const after = clampPilotLevel(before + milestoneLevels);
      progress.level = after;
      progress.statPoints = Math.max(0, Math.trunc(Number(progress.statPoints ?? 0) || 0)) + Math.max(0, after - before);

      if (after > before) {
        activeLevelUps.push({ pilotId, from: before, to: after, statPointsGained: after - before });
      }
    }
  }

  const reserveOutcome = applyReserveAverageCatchUp(campaignState, deployedPilotIds);

  return {
    milestoneLevels,
    deployedPilots: deployedPilotIds,
    activeLevelUps,
    reserveCatchUps: reserveOutcome.catchUps,
    reserveFloor: reserveOutcome.floor
  };
}

function applyReserveAverageCatchUp(campaignState, deployedPilotIds) {
  const deployedSet = new Set(deployedPilotIds);
  const floor = calculateRosterAverageFloor(campaignState);
  if (floor <= 1) return { floor, catchUps: [] };

  const catchUps = [];
  for (const pilotId of getRecruitedPilotIds(campaignState)) {
    if (deployedSet.has(pilotId)) continue;
    const progress = ensurePilotProgress(campaignState, pilotId, { recruited: true });
    if (!progress || progress.level >= floor) continue;

    const before = progress.level;
    progress.level = floor;
    progress.statPoints = Math.max(0, Math.trunc(Number(progress.statPoints ?? 0) || 0)) + Math.max(0, floor - before);
    catchUps.push({ pilotId, from: before, to: floor, statPointsGained: floor - before });
  }

  return { floor, catchUps };
}

function calculateRosterAverageFloor(campaignState) {
  const recruitedIds = getRecruitedPilotIds(campaignState);
  if (!recruitedIds.length) return 1;

  const total = recruitedIds.reduce((sum, pilotId) => {
    const level = clampPilotLevel(campaignState?.pilots?.[pilotId]?.level ?? 1);
    return sum + level;
  }, 0);

  return clampPilotLevel(Math.floor(total / recruitedIds.length));
}

function getMilestoneLevels(reward) {
  if (reward?.levelMilestone === true || reward?.milestoneLevel === true) return 1;
  return Math.max(0, Math.trunc(Number(reward?.levelMilestone ?? reward?.milestoneLevel ?? reward?.levels ?? 0) || 0));
}

function buildEmptyProgressionOutcome() {
  return {
    milestoneLevels: 0,
    deployedPilots: [],
    activeLevelUps: [],
    reserveCatchUps: [],
    reserveFloor: 1
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
  recruitedPilots = [],
  progression = null
}) {
  return {
    applied,
    reason,
    result,
    currency: Math.max(0, Math.trunc(Number(currency ?? reward?.currency ?? reward?.credits ?? 0) || 0)),
    items: normalizeIds(items.length ? items : reward?.items),
    unlocks: normalizeIds(unlocks.length ? unlocks : reward?.unlocks),
    recruitedPilots: normalizeIds(recruitedPilots.length ? recruitedPilots : (reward?.recruits ?? reward?.recruitedPilots)),
    progression: progression ?? buildEmptyProgressionOutcome()
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
    ? [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))]
    : [];
}
