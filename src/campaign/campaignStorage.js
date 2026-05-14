// src/campaign/campaignStorage.js
//
// localStorage wrapper for Campaign State V1.
// Stores only persistent campaign data. Never store runtime units, maps, UI, or render state.

import { createInitialCampaignState, normalizeCampaignState } from "./campaignState.js";

const STORAGE_KEY = "ars_caelorum_campaign_v1";

export function loadCampaignState(options = {}) {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return createInitialCampaignState(options);
    return normalizeCampaignState(JSON.parse(raw), options);
  } catch (error) {
    console.warn("Failed to load campaign state; starting a clean campaign.", error);
    return createInitialCampaignState(options);
  }
}

export function saveCampaignState(campaignState, options = {}) {
  const normalized = normalizeCampaignState(campaignState, options);
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn("Failed to save campaign state.", error);
  }
  return normalized;
}

export function resetStoredCampaignState(options = {}) {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear campaign state.", error);
  }
  return createInitialCampaignState(options);
}

export function hasStoredCampaignState() {
  try {
    return Boolean(window.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}
