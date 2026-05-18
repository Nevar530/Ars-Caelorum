// src/campaign/campaignRoster.js
//
// Campaign roster helpers. Mission/map starts can introduce player-team pilots to
// the campaign roster, but this module only mutates campaign progress records. It
// does not touch runtime units, pilot definitions, or map data.

import { recruitPilot, setPilotAvailability, setPilotRecruitment } from "./campaignState.js";

export function recruitPlayerTeamDeployments(campaignState, mapDefinition) {
  if (!campaignState || !mapDefinition) return [];

  const deployedPilotIds = getPlayerTeamDeploymentPilotIds(mapDefinition);
  const recruited = [];

  for (const pilotId of deployedPilotIds) {
    const before = campaignState?.pilots?.[pilotId]?.recruited === true;
    const preserveUnavailable = campaignState?.pilots?.[pilotId]?.available === false;
    const progress = recruitPilot(campaignState, pilotId, { available: !preserveUnavailable });
    if (progress && preserveUnavailable) progress.available = false;
    if (progress && !before) recruited.push(pilotId);
  }

  return recruited;
}

export function getPlayerTeamDeploymentPilotIds(mapDefinition) {
  const deployments = Array.isArray(mapDefinition?.startState?.deployments)
    ? mapDefinition.startState.deployments
    : [];

  return [...new Set(deployments
    .filter((deployment) => String(deployment?.team ?? "player").trim().toLowerCase() === "player")
    .map((deployment) => deployment?.pilotDefinitionId ?? deployment?.pilotId ?? null)
    .map((pilotId) => String(pilotId ?? "").trim())
    .filter(Boolean))];
}


export function applyMissionRosterState(campaignState, missionDefinition, content = null) {
  if (!campaignState || !missionDefinition) return [];
  const roster = normalizeMissionActiveRoster(missionDefinition.activeRoster);
  const pilotEntries = roster.pilots;
  const changed = [];

  for (const [pilotId, state] of Object.entries(pilotEntries)) {
    if (!isKnownCampaignPilot(content, pilotId)) continue;

    if (state.recruited === false) {
      const progress = setPilotRecruitment(campaignState, pilotId, false);
      if (progress) changed.push(pilotId);
      continue;
    }

    if (state.recruited === true || state.available === true) {
      const progress = setPilotAvailability(campaignState, pilotId, state.available !== false);
      if (progress) changed.push(pilotId);
      continue;
    }

    if (state.available === false && campaignState.pilots?.[pilotId]?.recruited !== false) {
      const progress = setPilotAvailability(campaignState, pilotId, false);
      if (progress) changed.push(pilotId);
    }
  }

  return changed;
}

export function isPilotAvailableInCampaign(campaignState, pilotId) {
  const id = String(pilotId ?? "").trim();
  if (!id) return false;
  const progress = campaignState?.pilots?.[id];
  return Boolean(progress && progress.recruited !== false && progress.available !== false);
}

export function getAvailableCampaignPilotIds(campaignState) {
  const pilots = campaignState?.pilots && typeof campaignState.pilots === "object" ? campaignState.pilots : {};
  return Object.entries(pilots)
    .filter(([, progress]) => progress?.recruited !== false && progress?.available !== false)
    .map(([pilotId]) => pilotId);
}

function normalizeMissionActiveRoster(activeRoster) {
  const source = activeRoster && typeof activeRoster === "object" ? activeRoster : {};
  const pilots = source.pilots && typeof source.pilots === "object" && !Array.isArray(source.pilots)
    ? source.pilots
    : {};

  return {
    pilots: Object.fromEntries(Object.entries(pilots)
      .map(([pilotId, value]) => [String(pilotId ?? "").trim(), normalizeRosterPilotState(value)])
      .filter(([pilotId]) => Boolean(pilotId)))
  };
}

function normalizeRosterPilotState(value) {
  const source = value && typeof value === "object" ? value : {};
  const recruited = source.recruited === true ? true : source.recruited === false ? false : null;
  const available = source.available === true ? true : source.available === false ? false : null;
  return { recruited, available };
}

function isKnownCampaignPilot(content, pilotId) {
  const pilots = Array.isArray(content?.pilots) ? content.pilots : [];
  if (!pilots.length) return true;
  const found = pilots.find((pilot) => String(pilot?.id ?? "").trim() === pilotId);
  return Boolean(found?.campaignRoster === true || found);
}
