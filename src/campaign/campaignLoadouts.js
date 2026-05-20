// src/campaign/campaignLoadouts.js
//
// Campaign loadout resolver. Campaign state is allowed to override authored
// defaults, but empty saved slots fall back to the pilot definition.

import { normalizePilotLoadout } from "../content/unitLoadout.js";

export function getCampaignPilotLoadout(campaignState, pilotDefinition = {}) {
  const definitionLoadout = {
    ...(pilotDefinition?.loadout && typeof pilotDefinition.loadout === "object" ? pilotDefinition.loadout : {}),
    weapons: pilotDefinition?.loadout?.weapons ?? pilotDefinition?.weapons ?? []
  };
  const progressLoadout = campaignState?.pilots?.[pilotDefinition?.id]?.loadout ?? null;
  return normalizePilotLoadout(progressLoadout, definitionLoadout);
}
