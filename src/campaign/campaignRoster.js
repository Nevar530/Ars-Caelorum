// src/campaign/campaignRoster.js
//
// Campaign roster helpers. Mission/map starts can introduce player-team pilots to
// the campaign roster, but this module only mutates campaign progress records. It
// does not touch runtime units, pilot definitions, or map data.

import { recruitPilot } from "./campaignState.js";

export function recruitPlayerTeamDeployments(campaignState, mapDefinition) {
  if (!campaignState || !mapDefinition) return [];

  const deployedPilotIds = getPlayerTeamDeploymentPilotIds(mapDefinition);
  const recruited = [];

  for (const pilotId of deployedPilotIds) {
    const before = campaignState?.pilots?.[pilotId]?.recruited === true;
    const progress = recruitPilot(campaignState, pilotId);
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
