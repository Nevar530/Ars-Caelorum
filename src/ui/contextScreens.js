// src/ui/contextScreens.js
//
// Contextual interaction screen authority.
// These screens are opened by map/unit/shop triggers, not by the normal I menu.

const SCREEN_ALIASES = Object.freeze({
  loadout: "pilot_loadout",
  pilotloadout: "pilot_loadout",
  pilot_loadout: "pilot_loadout",
  ship_locker: "pilot_loadout",
  locker: "pilot_loadout",
  shop: "shop",
  store: "shop",
  vendor: "shop",
  telum_loadout: "telum_loadout",
  mech_loadout: "telum_loadout",
  mechbay: "telum_loadout",
  mech_bay: "telum_loadout",
  telum_bay: "telum_loadout",
  mission_board: "mission_board",
  missionboard: "mission_board",
  board: "mission_board"
});

const VALID_CONTEXT_SCREENS = new Set([
  "pilot_loadout",
  "telum_loadout",
  "shop",
  "mission_board",
  "medbay"
]);

export function normalizeContextScreenId(screenId = "") {
  const raw = String(screenId ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
  const aliasKey = raw.replace(/_/g, "");
  const id = SCREEN_ALIASES[raw] ?? SCREEN_ALIASES[aliasKey] ?? raw;
  return VALID_CONTEXT_SCREENS.has(id) ? id : "";
}

export function getContextScreenTitle(screenId = "") {
  const id = normalizeContextScreenId(screenId);
  if (id === "pilot_loadout") return "Pilot Loadout";
  if (id === "telum_loadout") return "Telum Loadout";
  if (id === "shop") return "Shop";
  if (id === "mission_board") return "Mission Board";
  if (id === "medbay") return "Medbay";
  return "Terminal";
}

export function getContextScreenTabId(screenId = "") {
  const id = normalizeContextScreenId(screenId);
  if (id === "pilot_loadout") return "loadout";
  return id;
}
