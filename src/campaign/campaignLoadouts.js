// src/campaign/campaignLoadouts.js
//
// Campaign loadout resolver. Campaign state is allowed to override authored
// defaults, but empty saved slots fall back to the unit definition.

import { normalizeMechLoadout, normalizePilotLoadout } from "../content/unitLoadout.js";

export const PILOT_LOADOUT_SLOT_KEYS = Object.freeze(["armor", "accessory", "primaryWeapon", "secondaryWeapon"]);
export const MECH_LOADOUT_SLOT_KEYS = Object.freeze(["plating", "system", "primaryWeapon", "secondaryWeapon", "supportWeapon"]);

export const PILOT_LOADOUT_SLOT_LABELS = Object.freeze({
  armor: "Armor",
  accessory: "Accessory",
  primaryWeapon: "Primary Weapon",
  secondaryWeapon: "Secondary Weapon"
});

export const MECH_LOADOUT_SLOT_LABELS = Object.freeze({
  plating: "Plating",
  system: "System",
  primaryWeapon: "Primary Weapon",
  secondaryWeapon: "Secondary Weapon",
  supportWeapon: "Support Weapon"
});

export function getCampaignPilotLoadout(campaignState, pilotDefinition = {}) {
  const definitionLoadout = getDefinitionPilotLoadout(pilotDefinition);
  const progressLoadout = campaignState?.pilots?.[pilotDefinition?.id]?.loadout ?? null;
  return normalizePilotLoadout(progressLoadout, definitionLoadout);
}

export function getCampaignMechLoadout(campaignState, mechDefinition = {}) {
  const definitionLoadout = getDefinitionMechLoadout(mechDefinition);
  const progressLoadout = campaignState?.mechs?.[mechDefinition?.id]?.loadout ?? null;
  return normalizeMechLoadout(progressLoadout, definitionLoadout);
}

export function getPilotLoadoutSlotOptions(campaignState, content = {}, pilotDefinition = {}, slotKey = "") {
  const slot = normalizePilotLoadoutSlot(slotKey);
  if (!slot) return [];

  const currentLoadout = getCampaignPilotLoadout(campaignState, pilotDefinition);
  const currentId = cleanId(currentLoadout?.[slot]);
  const inventory = campaignState?.inventory && typeof campaignState.inventory === "object" ? campaignState.inventory : {};
  const ownedIds = getOwnedPilotCandidateIds(inventory, slot);
  const defaultIds = getDefaultPilotCandidateIds(pilotDefinition, slot);
  const candidateIds = uniqueIds([...defaultIds, ...ownedIds, currentId]);

  const options = [];
  if (slot === "accessory") {
    options.push({ id: "", name: "Empty", slot, empty: true, equipped: !currentId, description: "No accessory equipped." });
  }

  for (const id of candidateIds) {
    const entry = getCompatiblePilotLoadoutEntry(content, id, slot);
    if (!entry) continue;
    if (isPilotWeaponSlot(slot) && isEquippedInOtherPilotWeaponSlot(currentLoadout, slot, id)) continue;
    options.push({ ...entry, id, slot, equipped: currentId === id });
  }

  return options;
}

export function getMechLoadoutSlotOptions(campaignState, content = {}, mechDefinition = {}, slotKey = "") {
  const slot = normalizeMechLoadoutSlot(slotKey);
  if (!slot) return [];

  const currentLoadout = getCampaignMechLoadout(campaignState, mechDefinition);
  const currentId = cleanId(currentLoadout?.[slot]);
  const inventory = campaignState?.inventory && typeof campaignState.inventory === "object" ? campaignState.inventory : {};
  const ownedIds = getOwnedMechCandidateIds(inventory, slot);
  const defaultIds = getDefaultMechCandidateIds(mechDefinition, slot);
  const candidateIds = uniqueIds([...defaultIds, ...ownedIds, currentId]);

  const options = [];
  if (slot === "system") {
    options.push({ id: "", name: "Empty", slot, empty: true, equipped: !currentId, description: "No system module equipped." });
  }

  for (const id of candidateIds) {
    const entry = getCompatibleMechLoadoutEntry(content, id, slot);
    if (!entry) continue;
    if (isMechWeaponSlot(slot) && isEquippedInOtherMechWeaponSlot(currentLoadout, slot, id)) continue;
    options.push({ ...entry, id, slot, equipped: currentId === id });
  }

  return options;
}

export function setCampaignPilotLoadoutSlot(campaignState, content = {}, pilotDefinition = {}, slotKey = "", itemId = "") {
  const slot = normalizePilotLoadoutSlot(slotKey);
  const pilotId = cleanId(pilotDefinition?.id);
  if (!campaignState || !pilotId || !slot) return { ok: false, reason: "invalid_request" };

  const progress = campaignState?.pilots?.[pilotId];
  if (!progress || progress.recruited === false) return { ok: false, reason: "pilot_not_recruited" };

  const cleanItemId = cleanId(itemId);
  if (!cleanItemId && slot !== "accessory") return { ok: false, reason: "required_slot" };

  const options = getPilotLoadoutSlotOptions(campaignState, content, pilotDefinition, slot);
  const selected = options.find((option) => cleanId(option?.id) === cleanItemId);
  if (!selected) return { ok: false, reason: "item_not_available" };

  const currentLoadout = getCampaignPilotLoadout(campaignState, pilotDefinition);
  if (cleanId(currentLoadout?.[slot]) === cleanItemId) return { ok: false, reason: "already_equipped" };

  const nextLoadout = normalizePilotLoadout({ ...currentLoadout, [slot]: cleanItemId || null }, getDefinitionPilotLoadout(pilotDefinition));
  progress.loadout = nextLoadout;
  return { ok: true, pilotId, slot, itemId: cleanItemId, itemName: selected?.name ?? (cleanItemId || "Empty"), loadout: nextLoadout };
}

export function setCampaignMechLoadoutSlot(campaignState, content = {}, mechDefinition = {}, slotKey = "", itemId = "") {
  const slot = normalizeMechLoadoutSlot(slotKey);
  const mechId = cleanId(mechDefinition?.id);
  if (!campaignState || !mechId || !slot) return { ok: false, reason: "invalid_request" };

  if (!campaignState.mechs || typeof campaignState.mechs !== "object") campaignState.mechs = {};
  const progress = campaignState.mechs[mechId] ?? { unlocked: true, loadout: {} };
  campaignState.mechs[mechId] = progress;
  if (progress.unlocked === false) return { ok: false, reason: "mech_locked" };

  const cleanItemId = cleanId(itemId);
  if (!cleanItemId && slot !== "system") return { ok: false, reason: "required_slot" };

  const options = getMechLoadoutSlotOptions(campaignState, content, mechDefinition, slot);
  const selected = options.find((option) => cleanId(option?.id) === cleanItemId);
  if (!selected) return { ok: false, reason: "item_not_available" };

  const currentLoadout = getCampaignMechLoadout(campaignState, mechDefinition);
  if (cleanId(currentLoadout?.[slot]) === cleanItemId) return { ok: false, reason: "already_equipped" };

  const nextLoadout = normalizeMechLoadout({ ...currentLoadout, [slot]: cleanItemId || null }, getDefinitionMechLoadout(mechDefinition));
  progress.loadout = nextLoadout;
  return { ok: true, mechId, slot, itemId: cleanItemId, itemName: selected?.name ?? (cleanItemId || "Empty"), loadout: nextLoadout };
}

export function normalizePilotLoadoutSlot(slotKey = "") {
  const key = cleanId(slotKey);
  return PILOT_LOADOUT_SLOT_KEYS.includes(key) ? key : "";
}

export function normalizeMechLoadoutSlot(slotKey = "") {
  const key = cleanId(slotKey);
  return MECH_LOADOUT_SLOT_KEYS.includes(key) ? key : "";
}

function getDefinitionPilotLoadout(pilotDefinition = {}) {
  return {
    ...(pilotDefinition?.loadout && typeof pilotDefinition.loadout === "object" ? pilotDefinition.loadout : {}),
    weapons: pilotDefinition?.loadout?.weapons ?? pilotDefinition?.weapons ?? []
  };
}

function getDefinitionMechLoadout(mechDefinition = {}) {
  return {
    ...(mechDefinition?.loadout && typeof mechDefinition.loadout === "object" ? mechDefinition.loadout : {}),
    weapons: mechDefinition?.loadout?.weapons ?? mechDefinition?.weapons ?? []
  };
}

function getOwnedPilotCandidateIds(inventory = {}, slot = "") {
  if (slot === "armor") return Array.isArray(inventory.armor) ? inventory.armor : [];
  if (slot === "accessory") return Array.isArray(inventory.accessories) ? inventory.accessories : [];
  if (isPilotWeaponSlot(slot)) return Array.isArray(inventory.weapons) ? inventory.weapons : [];
  return [];
}

function getOwnedMechCandidateIds(inventory = {}, slot = "") {
  if (slot === "plating" || slot === "system") return Array.isArray(inventory.mechGear) ? inventory.mechGear : [];
  if (isMechWeaponSlot(slot)) return Array.isArray(inventory.mechWeapons) ? inventory.mechWeapons : [];
  return [];
}

function getDefaultPilotCandidateIds(pilotDefinition = {}, slot = "") {
  const loadout = getDefinitionPilotLoadout(pilotDefinition);
  if (slot === "armor") return [loadout.armor];
  if (slot === "accessory") return [loadout.accessory];
  if (slot === "primaryWeapon") return [loadout.primaryWeapon, ...(Array.isArray(loadout.weapons) ? loadout.weapons : [])];
  if (slot === "secondaryWeapon") return [loadout.secondaryWeapon, ...(Array.isArray(loadout.weapons) ? loadout.weapons : [])];
  return [];
}

function getDefaultMechCandidateIds(mechDefinition = {}, slot = "") {
  const loadout = getDefinitionMechLoadout(mechDefinition);
  if (slot === "plating") return [loadout.plating, loadout.armor];
  if (slot === "system") return [loadout.system];
  if (slot === "primaryWeapon") return [loadout.primaryWeapon, ...(Array.isArray(loadout.weapons) ? loadout.weapons : [])];
  if (slot === "secondaryWeapon") return [loadout.secondaryWeapon, ...(Array.isArray(loadout.weapons) ? loadout.weapons : [])];
  if (slot === "supportWeapon") return [loadout.supportWeapon, ...(Array.isArray(loadout.weapons) ? loadout.weapons : [])];
  return [];
}

function getCompatiblePilotLoadoutEntry(content = {}, itemId = "", slot = "") {
  const id = cleanId(itemId);
  if (!id) return null;
  if (isPilotWeaponSlot(slot)) {
    return (Array.isArray(content.weapons) ? content.weapons : []).find((weapon) => cleanId(weapon?.id) === id && cleanId(weapon?.scale || "pilot") === "pilot") ?? null;
  }
  return (Array.isArray(content.pilotGear) ? content.pilotGear : []).find((gear) => cleanId(gear?.id) === id && cleanId(gear?.scale || "pilot") === "pilot" && cleanId(gear?.slot) === slot) ?? null;
}

function getCompatibleMechLoadoutEntry(content = {}, itemId = "", slot = "") {
  const id = cleanId(itemId);
  if (!id) return null;
  if (isMechWeaponSlot(slot)) {
    return (Array.isArray(content.weapons) ? content.weapons : []).find((weapon) => cleanId(weapon?.id) === id && cleanId(weapon?.scale || "mech") === "mech") ?? null;
  }
  return (Array.isArray(content.mechGear) ? content.mechGear : []).find((gear) => cleanId(gear?.id) === id && cleanId(gear?.scale || "mech") === "mech" && cleanId(gear?.slot) === slot) ?? null;
}

function isEquippedInOtherPilotWeaponSlot(loadout = {}, slot = "", itemId = "") {
  if (!isPilotWeaponSlot(slot)) return false;
  const otherSlot = slot === "primaryWeapon" ? "secondaryWeapon" : "primaryWeapon";
  return cleanId(loadout?.[otherSlot]) === cleanId(itemId);
}

function isEquippedInOtherMechWeaponSlot(loadout = {}, slot = "", itemId = "") {
  if (!isMechWeaponSlot(slot)) return false;
  return ["primaryWeapon", "secondaryWeapon", "supportWeapon"].some((otherSlot) => otherSlot !== slot && cleanId(loadout?.[otherSlot]) === cleanId(itemId));
}

function isPilotWeaponSlot(slot = "") {
  return slot === "primaryWeapon" || slot === "secondaryWeapon";
}

function isMechWeaponSlot(slot = "") {
  return slot === "primaryWeapon" || slot === "secondaryWeapon" || slot === "supportWeapon";
}

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
}

function cleanId(value) {
  return String(value ?? "").trim();
}
