// src/campaign/campaignProgression.js
//
// Campaign progression helpers V1.
// Keep mission unlock rules data-authored through mission rewards for now.

import { isMissionUnlocked } from "./campaignState.js";

export function getPlayableMissionEntries(campaignState, missionEntries = []) {
  return (Array.isArray(missionEntries) ? missionEntries : []).map((entry) => ({
    ...entry,
    locked: !isMissionUnlocked(campaignState, entry?.id)
  }));
}

export function getCurrentMissionEntry(campaignState, missionEntries = []) {
  const entries = Array.isArray(missionEntries) ? missionEntries : [];
  const currentId = campaignState?.currentMissionId ?? null;
  return entries.find((entry) => entry?.id === currentId)
    ?? entries.find((entry) => !entry?.locked)
    ?? entries[0]
    ?? null;
}
