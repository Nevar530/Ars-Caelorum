// src/builder/builderRoster.js

import { ensureMissionPackageDraft } from "./builderMissionPackage.js";

export function ensureRosterToolSettings(builderState) {
  const mission = ensureMissionPackageDraft(builderState);
  if (!mission.activeRoster || typeof mission.activeRoster !== "object") {
    mission.activeRoster = { pilots: {}, mechs: {} };
  }
  if (!mission.activeRoster.pilots || typeof mission.activeRoster.pilots !== "object" || Array.isArray(mission.activeRoster.pilots)) {
    mission.activeRoster.pilots = {};
  }
  if (!mission.activeRoster.mechs || typeof mission.activeRoster.mechs !== "object" || Array.isArray(mission.activeRoster.mechs)) {
    mission.activeRoster.mechs = {};
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



export function getCampaignMechRows(builderState, appState = null) {
  const roster = ensureRosterToolSettings(builderState);
  const definitions = getCampaignMechDefinitions(appState, roster);
  const rows = definitions.map((mech) => {
    const state = roster.mechs[mech.id] ?? getDefaultMechRosterState(mech.id);
    const owned = state.owned === true;
    return {
      id: mech.id,
      name: mech.name || mech.id,
      role: mech.role || "",
      className: mech.className || "",
      owned
    };
  });
  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}
export function readRosterFields(builderState, root, appState = null) {
  const roster = ensureRosterToolSettings(builderState);
  const rows = getCampaignRosterRows(builderState, appState);
  const mechRows = getCampaignMechRows(builderState, appState);
  const next = {};
  const nextMechs = {};

  for (const row of rows) {
    const recruited = Boolean(root?.querySelector?.(`[data-builder-field="roster-recruited"][data-pilot-id="${cssEscape(row.id)}"]`)?.checked);
    const available = recruited && Boolean(root?.querySelector?.(`[data-builder-field="roster-available"][data-pilot-id="${cssEscape(row.id)}"]`)?.checked);
    next[row.id] = { recruited, available };
  }

  for (const row of mechRows) {
    const owned = Boolean(root?.querySelector?.(`[data-builder-field="roster-mech-owned"][data-mech-id="${cssEscape(row.id)}"]`)?.checked);
    nextMechs[row.id] = { owned };
  }

  roster.pilots = next;
  roster.mechs = nextMechs;
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

export function getOwnedRosterMechIds(builderState) {
  const roster = ensureRosterToolSettings(builderState);
  return Object.entries(roster.mechs)
    .filter(([, state]) => state?.owned === true)
    .map(([mechId]) => mechId);
}

export function isMechOwnedForBuilderRoster(builderState, mechId) {
  const id = String(mechId ?? "").trim();
  if (!id) return false;
  const roster = ensureRosterToolSettings(builderState);
  const state = roster.mechs[id] ?? getDefaultMechRosterState(id);
  return state.owned === true;
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

function getCampaignMechDefinitions(appState, roster) {
  const mechs = Array.isArray(appState?.content?.mechs) ? appState.content.mechs : [];
  const explicitIds = new Set(Object.keys(roster?.mechs ?? {}));

  return mechs
    .filter((mech) => mech?.campaignMech === true || explicitIds.has(String(mech?.id ?? "").trim()))
    .map((mech) => ({
      id: String(mech?.id ?? "").trim(),
      name: String(mech?.name ?? mech?.id ?? "Telum").trim(),
      role: String(mech?.role ?? "").trim(),
      className: String(mech?.class ?? "").trim()
    }))
    .filter((mech) => mech.id);
}

function getDefaultPilotRosterState(pilotId) {
  const id = String(pilotId ?? "").trim();
  const starting = id === "pilot_skye";
  return { recruited: starting, available: starting };
}

function getDefaultMechRosterState(mechId) {
  const id = String(mechId ?? "").trim();
  const starting = id === "telum_skye" || id === "telum_eve";
  return { owned: starting };
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value ?? ""));
  return String(value ?? "").replaceAll('"', "\\\"");
}
