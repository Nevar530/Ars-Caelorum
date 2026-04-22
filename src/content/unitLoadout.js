// src/content/unitLoadout.js

const DEFAULT_PILOT_SLOTS = Object.freeze({ weapon: 2, armor: 1, ability: 3 });
const DEFAULT_MECH_SLOTS = Object.freeze({ weapon: 0, ability: 1, item: 2 });

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function cloneObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
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
    weapon: Array.isArray(definition.weapons) ? definition.weapons.length : DEFAULT_MECH_SLOTS.weapon,
    ...cloneObject(definition.slots)
  };
}

export function buildRuntimeLoadout(unitType, definition = {}, overrides = {}) {
  const definitionLoadout = cloneObject(definition.loadout);
  const overrideLoadout = cloneObject(overrides.loadout);

  return {
    weapons: cloneArray(overrideLoadout.weapons ?? definitionLoadout.weapons ?? definition.weapons),
    armor: overrideLoadout.armor ?? definitionLoadout.armor ?? null,
    abilities: cloneArray(overrideLoadout.abilities ?? definitionLoadout.abilities ?? definition.abilities),
    items: cloneArray(overrideLoadout.items ?? definitionLoadout.items ?? []),
    ...(unitType === "mech" ? { hardpoints: cloneArray(overrideLoadout.hardpoints ?? definitionLoadout.hardpoints ?? []) } : {})
  };
}

export function buildRuntimeInventory(definition = {}, overrides = {}) {
  const definitionInventory = cloneObject(definition.inventory);
  const overrideInventory = cloneObject(overrides.inventory);

  return {
    items: cloneArray(overrideInventory.items ?? definitionInventory.items ?? []),
    weapons: cloneArray(overrideInventory.weapons ?? definitionInventory.weapons ?? []),
    armor: cloneArray(overrideInventory.armor ?? definitionInventory.armor ?? []),
    abilities: cloneArray(overrideInventory.abilities ?? definitionInventory.abilities ?? [])
  };
}

export function getEquippedWeaponIds(unit) {
  const loadoutWeapons = cloneArray(unit?.loadout?.weapons).filter(Boolean);
  if (loadoutWeapons.length) return loadoutWeapons;
  return cloneArray(unit?.weapons).filter(Boolean);
}
