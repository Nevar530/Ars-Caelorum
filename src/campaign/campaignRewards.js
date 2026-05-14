// src/campaign/campaignRewards.js
//
// Deterministic mission rewards V1.
// Rewards are authored on mission data, applied once per mission/result, and persisted to campaign state.

import { markMissionCompleted, setCurrentMission, unlockMission } from "./campaignState.js";

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

  const xp = Math.max(0, Math.trunc(Number(reward.xp ?? 0) || 0));
  const currency = Math.max(0, Math.trunc(Number(reward.currency ?? 0) || 0));
  const items = normalizeIds(reward.items);
  const unlocks = normalizeIds(reward.unlocks);

  campaignState.inventory.currency += currency;
  for (const itemId of items) {
    campaignState.inventory.items.push(itemId);
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
    xp,
    currency,
    items,
    unlocks
  });
}

function buildRewardOutcome({ applied, reason = "", result = "victory", reward = null, xp = 0, currency = 0, items = [], unlocks = [] }) {
  return {
    applied,
    reason,
    result,
    xp: Math.max(0, Math.trunc(Number(xp ?? reward?.xp ?? 0) || 0)),
    currency: Math.max(0, Math.trunc(Number(currency ?? reward?.currency ?? 0) || 0)),
    items: normalizeIds(items.length ? items : reward?.items),
    unlocks: normalizeIds(unlocks.length ? unlocks : reward?.unlocks)
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
