// src/builder/builderRoster.js

import { ensureMissionPackageDraft } from "./builderMissionPackage.js";

export function ensureRosterToolSettings(builderState) {
  const mission = ensureMissionPackageDraft(builderState);
  if (!mission.activeRoster || typeof mission.activeRoster !== "object") {
    mission.activeRoster = { pilots: {} };
  }
  if (!mission.activeRoster.pilots || typeof mission.activeRoster.pilots !== "object" || Array.isArray(mission.activeRoster.pilots)) {
    mission.activeRoster.pilots = {};
  }
  return mission.activeRoster;
}

export function getCampaignRosterRows(builderState, appState = null) {
  const roster = ensureRosterToolSettings(builderState);
  const definitions = getCampaignRosterPilotDefinitions(appState, roster);
  const rows = definitions.map((pilot) => {
    const state = roster.pilots[pilot.id] ?? getDefaultPilotRosterState(pilot.id);
    const recruited = state.recruited === true;
    const available = recruited && state.available !== false;
    return {
      id: pilot.id,
      name: pilot.name || pilot.id,
      role: pilot.role || "",
      recruited,
      available
    };
  });
  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

export function readRosterFields(builderState, root, appState = null) {
  const roster = ensureRosterToolSettings(builderState);
  const rows = getCampaignRosterRows(builderState, appState);
  const next = {};

  for (const row of rows) {
    const recruited = Boolean(root?.querySelector?.(`[data-builder-field="roster-recruited"][data-pilot-id="${cssEscape(row.id)}"]`)?.checked);
    const available = recruited && Boolean(root?.querySelector?.(`[data-builder-field="roster-available"][data-pilot-id="${cssEscape(row.id)}"]`)?.checked);
    next[row.id] = { recruited, available };
  }

  roster.pilots = next;
  builderState.dirty = true;
  return roster;
}

export function getAvailableRosterPilotIds(builderState) {
  const roster = ensureRosterToolSettings(builderState);
  return Object.entries(roster.pilots)
    .filter(([, state]) => state?.recruited === true && state?.available !== false)
    .map(([pilotId]) => pilotId);
}

export function isPilotAvailableForBuilderRoster(builderState, pilotId) {
  const id = String(pilotId ?? "").trim();
  if (!id) return false;
  const roster = ensureRosterToolSettings(builderState);
  const state = roster.pilots[id] ?? getDefaultPilotRosterState(id);
  return state.recruited === true && state.available !== false;
}

function getCampaignRosterPilotDefinitions(appState, roster) {
  const pilots = Array.isArray(appState?.content?.pilots) ? appState.content.pilots : [];
  const explicitIds = new Set(Object.keys(roster?.pilots ?? {}));

  return pilots
    .filter((pilot) => pilot?.campaignRoster === true || explicitIds.has(String(pilot?.id ?? "").trim()))
    .map((pilot) => ({
      id: String(pilot?.id ?? "").trim(),
      name: String(pilot?.name ?? pilot?.id ?? "Pilot").trim(),
      role: String(pilot?.role ?? "").trim()
    }))
    .filter((pilot) => pilot.id);
}

function getDefaultPilotRosterState(pilotId) {
  const id = String(pilotId ?? "").trim();
  const starting = id === "pilot_skye";
  return { recruited: starting, available: starting };
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value ?? ""));
  return String(value ?? "").replaceAll('"', "\\\"");
}
