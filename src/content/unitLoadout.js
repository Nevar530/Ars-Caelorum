// src/content/unitLoadout.js

export const PILOT_GEAR_SLOTS = Object.freeze(["armor", "accessory", "primaryWeapon", "secondaryWeapon"]);
export const MECH_GEAR_SLOTS = Object.freeze(["plating", "system", "primaryWeapon", "secondaryWeapon", "supportWeapon"]);

const DEFAULT_PILOT_SLOTS = Object.freeze({ armor: 1, accessory: 1, primaryWeapon: 1, secondaryWeapon: 1, ability: 3 });
const DEFAULT_MECH_SLOTS = Object.freeze({ plating: 1, system: 1, primaryWeapon: 1, secondaryWeapon: 1, supportWeapon: 1, ability: 1, item: 2 });

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function cloneIdArray(value) {
  return cloneArray(value).map((id) => cleanId(id)).filter(Boolean);
}

function cloneObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function cleanId(value) {
  const id = String(value ?? "").trim();
  return id || null;
}

function firstId(...values) {
  for (const value of values) {
    const id = cleanId(value);
    if (id) return id;
  }
  return null;
}

export function getDefaultSlotsForUnit(unitType, definition = {}) {
  if (unitType === "pilot") {
    return {
      ...DEFAULT_PILOT_SLOTS,
      ...cloneObject(definition.slots)
    };
  }

  return {
    ...DEFAULT_MECH_SLOTS,
    ...cloneObject(definition.slots)
  };
}

export function normalizePilotLoadout(loadout = {}, fallback = {}) {
  const source = cloneObject(loadout);
  const fallbackSource = cloneObject(fallback);
  const sourceWeapons = cloneArray(source.weapons);
  const fallbackWeapons = cloneArray(fallbackSource.weapons);

  const primaryWeapon = firstId(source.primaryWeapon, sourceWeapons[0], fallbackSource.primaryWeapon, fallbackWeapons[0]);
  const secondaryWeapon = firstId(source.secondaryWeapon, sourceWeapons[1], fallbackSource.secondaryWeapon, fallbackWeapons[1]);
  const weapons = [primaryWeapon, secondaryWeapon].filter(Boolean);

  return {
    armor: firstId(source.armor, fallbackSource.armor),
    accessory: firstId(source.accessory, fallbackSource.accessory),
    primaryWeapon,
    secondaryWeapon,
    weapons,
    abilities: cloneIdArray(source.abilities?.length ? source.abilities : fallbackSource.abilities),
    items: cloneIdArray(source.items?.length ? source.items : fallbackSource.items)
  };
}

export function normalizeMechLoadout(loadout = {}, fallback = {}) {
  const source = cloneObject(loadout);
  const fallbackSource = cloneObject(fallback);
  const sourceWeapons = cloneArray(source.weapons);
  const fallbackWeapons = cloneArray(fallbackSource.weapons);

  const primaryWeapon = firstId(source.primaryWeapon, sourceWeapons[0], fallbackSource.primaryWeapon, fallbackWeapons[0]);
  const secondaryWeapon = firstId(source.secondaryWeapon, sourceWeapons[1], fallbackSource.secondaryWeapon, fallbackWeapons[1]);
  const supportWeapon = firstId(source.supportWeapon, sourceWeapons[2], fallbackSource.supportWeapon, fallbackWeapons[2]);
  const weapons = [primaryWeapon, secondaryWeapon, supportWeapon].filter(Boolean);

  return {
    plating: firstId(source.plating, source.armor, fallbackSource.plating, fallbackSource.armor),
    system: firstId(source.system, fallbackSource.system),
    primaryWeapon,
    secondaryWeapon,
    supportWeapon,
    weapons,
    abilities: cloneIdArray(source.abilities?.length ? source.abilities : fallbackSource.abilities),
    items: cloneIdArray(source.items?.length ? source.items : fallbackSource.items),
    hardpoints: cloneArray(source.hardpoints?.length ? source.hardpoints : fallbackSource.hardpoints)
  };
}

export function buildRuntimeLoadout(unitType, definition = {}, overrides = {}) {
  const definitionLoadout = cloneObject(definition.loadout);
  const overrideLoadout = cloneObject(overrides.loadout);

  if (unitType === "pilot") {
    const legacyDefinitionLoadout = {
      ...definitionLoadout,
      weapons: definitionLoadout.weapons ?? definition.weapons,
      abilities: definitionLoadout.abilities ?? definition.abilities,
      items: definitionLoadout.items ?? []
    };
    return normalizePilotLoadout(overrideLoadout, legacyDefinitionLoadout);
  }

  const legacyDefinitionLoadout = {
    ...definitionLoadout,
    weapons: definitionLoadout.weapons ?? definition.weapons,
    abilities: definitionLoadout.abilities ?? definition.abilities,
    items: definitionLoadout.items ?? []
  };
  return normalizeMechLoadout(overrideLoadout, legacyDefinitionLoadout);
}

export function buildRuntimeInventory(definition = {}, overrides = {}) {
  const definitionInventory = cloneObject(definition.inventory);
  const overrideInventory = cloneObject(overrides.inventory);

  return {
    items: cloneArray(overrideInventory.items ?? definitionInventory.items ?? []),
    weapons: cloneArray(overrideInventory.weapons ?? definitionInventory.weapons ?? []),
    armor: cloneArray(overrideInventory.armor ?? definitionInventory.armor ?? []),
    accessories: cloneArray(overrideInventory.accessories ?? definitionInventory.accessories ?? []),
    abilities: cloneArray(overrideInventory.abilities ?? definitionInventory.abilities ?? [])
  };
}

export function getEquippedWeaponIds(unit) {
  const loadout = unit?.loadout ?? {};
  const slottedWeapons = unit?.unitType === "mech"
    ? [loadout.primaryWeapon, loadout.secondaryWeapon, loadout.supportWeapon].map(cleanId).filter(Boolean)
    : [loadout.primaryWeapon, loadout.secondaryWeapon].map(cleanId).filter(Boolean);
  if (slottedWeapons.length) return slottedWeapons;

  const loadoutWeapons = cloneArray(loadout.weapons).filter(Boolean);
  if (loadoutWeapons.length) return loadoutWeapons;
  return cloneArray(unit?.weapons).filter(Boolean);
}

export function getEquippedAbilityIds(unit) {
  return [...new Set([
    ...cloneArray(unit?.abilities),
    ...cloneArray(unit?.loadout?.abilities)
  ].filter(Boolean))];
}

export function getEquippedItemIds(unit) {
  const inventoryItems = cloneArray(unit?.inventory?.items).filter(Boolean);
  if (inventoryItems.length) return inventoryItems;

  const loadoutItems = cloneArray(unit?.loadout?.items).filter(Boolean);
  if (loadoutItems.length) return loadoutItems;

  return cloneArray(unit?.items).filter(Boolean);
}
