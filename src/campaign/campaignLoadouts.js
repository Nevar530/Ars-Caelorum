// src/campaign/campaignLoadouts.js
//
// Campaign loadout resolver. Campaign state is allowed to override authored
// defaults, but empty saved slots fall back to the pilot definition.

import { normalizePilotLoadout } from "../content/unitLoadout.js";

export const PILOT_LOADOUT_SLOT_KEYS = Object.freeze(["armor", "accessory", "primaryWeapon", "secondaryWeapon"]);

export const PILOT_LOADOUT_SLOT_LABELS = Object.freeze({
  armor: "Armor",
  accessory: "Accessory",
  primaryWeapon: "Primary Weapon",
  secondaryWeapon: "Secondary Weapon"
});

export function getCampaignPilotLoadout(campaignState, pilotDefinition = {}) {
  const definitionLoadout = getDefinitionPilotLoadout(pilotDefinition);
  const progressLoadout = campaignState?.pilots?.[pilotDefinition?.id]?.loadout ?? null;
  return normalizePilotLoadout(progressLoadout, definitionLoadout);
}

export function getPilotLoadoutSlotOptions(campaignState, content = {}, pilotDefinition = {}, slotKey = "") {
  const slot = normalizePilotLoadoutSlot(slotKey);
  if (!slot) return [];

  const currentLoadout = getCampaignPilotLoadout(campaignState, pilotDefinition);
  const currentId = cleanId(currentLoadout?.[slot]);
  const inventory = campaignState?.inventory && typeof campaignState.inventory === "object" ? campaignState.inventory : {};
  const ownedIds = getOwnedCandidateIds(inventory, slot);
  const defaultIds = getDefaultCandidateIds(pilotDefinition, slot);
  const candidateIds = uniqueIds([...defaultIds, ...ownedIds, currentId]);

  const options = [];
  if (slot === "accessory") {
    options.push({
      id: "",
      name: "Empty",
      slot,
      empty: true,
      equipped: !currentId,
      description: "No accessory equipped."
    });
  }

  for (const id of candidateIds) {
    const entry = getCompatibleLoadoutEntry(content, id, slot);
    if (!entry) continue;
    if (isWeaponSlot(slot) && isEquippedInOtherWeaponSlot(currentLoadout, slot, id)) continue;

    options.push({
      ...entry,
      id,
      slot,
      equipped: currentId === id
    });
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
  if (cleanId(currentLoadout?.[slot]) === cleanItemId) {
    return { ok: false, reason: "already_equipped" };
  }

  const nextLoadout = normalizePilotLoadout({
    ...currentLoadout,
    [slot]: cleanItemId || null
  }, getDefinitionPilotLoadout(pilotDefinition));

  progress.loadout = nextLoadout;
  return {
    ok: true,
    pilotId,
    slot,
    itemId: cleanItemId,
    itemName: selected?.name ?? (cleanItemId || "Empty"),
    loadout: nextLoadout
  };
}

export function cycleCampaignPilotLoadoutSlot(campaignState, content = {}, pilotDefinition = {}, slotKey = "", direction = 1) {
  const slot = normalizePilotLoadoutSlot(slotKey);
  if (!slot) return { ok: false, reason: "invalid_slot" };

  const options = getPilotLoadoutSlotOptions(campaignState, content, pilotDefinition, slot);
  if (!options.length) return { ok: false, reason: "no_options" };

  const currentId = cleanId(getCampaignPilotLoadout(campaignState, pilotDefinition)?.[slot]);
  const currentIndex = Math.max(0, options.findIndex((option) => cleanId(option?.id) === currentId));
  const step = Math.sign(Number(direction ?? 1) || 1) || 1;
  const nextIndex = (currentIndex + step + options.length) % options.length;
  return setCampaignPilotLoadoutSlot(campaignState, content, pilotDefinition, slot, options[nextIndex]?.id ?? "");
}

export function normalizePilotLoadoutSlot(slotKey = "") {
  const key = cleanId(slotKey);
  return PILOT_LOADOUT_SLOT_KEYS.includes(key) ? key : "";
}

function getDefinitionPilotLoadout(pilotDefinition = {}) {
  return {
    ...(pilotDefinition?.loadout && typeof pilotDefinition.loadout === "object" ? pilotDefinition.loadout : {}),
    weapons: pilotDefinition?.loadout?.weapons ?? pilotDefinition?.weapons ?? []
  };
}

function getOwnedCandidateIds(inventory = {}, slot = "") {
  if (slot === "armor") return Array.isArray(inventory.armor) ? inventory.armor : [];
  if (slot === "accessory") return Array.isArray(inventory.accessories) ? inventory.accessories : [];
  if (isWeaponSlot(slot)) return Array.isArray(inventory.weapons) ? inventory.weapons : [];
  return [];
}

function getDefaultCandidateIds(pilotDefinition = {}, slot = "") {
  const loadout = getDefinitionPilotLoadout(pilotDefinition);
  if (slot === "armor") return [loadout.armor];
  if (slot === "accessory") return [loadout.accessory];
  if (slot === "primaryWeapon") return [loadout.primaryWeapon, ...(Array.isArray(loadout.weapons) ? loadout.weapons : [])];
  if (slot === "secondaryWeapon") return [loadout.secondaryWeapon, ...(Array.isArray(loadout.weapons) ? loadout.weapons : [])];
  return [];
}

function getCompatibleLoadoutEntry(content = {}, itemId = "", slot = "") {
  const id = cleanId(itemId);
  if (!id) return null;

  if (isWeaponSlot(slot)) {
    return (Array.isArray(content.weapons) ? content.weapons : [])
      .find((weapon) => cleanId(weapon?.id) === id && cleanId(weapon?.scale || "pilot") === "pilot") ?? null;
  }

  return (Array.isArray(content.pilotGear) ? content.pilotGear : [])
    .find((gear) => cleanId(gear?.id) === id && cleanId(gear?.scale || "pilot") === "pilot" && cleanId(gear?.slot) === slot) ?? null;
}

function isEquippedInOtherWeaponSlot(loadout = {}, slot = "", itemId = "") {
  if (!isWeaponSlot(slot)) return false;
  const otherSlot = slot === "primaryWeapon" ? "secondaryWeapon" : "primaryWeapon";
  return cleanId(loadout?.[otherSlot]) === cleanId(itemId);
}

function isWeaponSlot(slot = "") {
  return slot === "primaryWeapon" || slot === "secondaryWeapon";
}

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
}

function cleanId(value) {
  return String(value ?? "").trim();
}
