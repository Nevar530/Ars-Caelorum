// src/content/equipmentModifiers.js
//
// Small equipment modifier resolver. Campaign/loadout owns what is equipped;
// this file only answers what those equipped ids add to runtime stats.

const MODIFIER_KEYS = Object.freeze(["shield", "move", "core", "abilityPoints", "targeting", "reaction"]);
const PILOT_GEAR_SLOT_KEYS = Object.freeze(["armor", "accessory"]);

export function getLoadoutModifiers(content = {}, loadout = {}, unitType = "pilot") {
  const modifiers = createEmptyModifiers();
  const catalog = buildEquipmentCatalog(content, unitType);

  for (const gearId of getEquippedGearIds(loadout, unitType)) {
    const gear = catalog.get(gearId);
    if (!gear) continue;
    addModifiers(modifiers, gear.modifiers);
  }

  return modifiers;
}

export function getEquipmentById(content = {}, equipmentId, unitType = "pilot") {
  const id = String(equipmentId ?? "").trim();
  if (!id) return null;
  return buildEquipmentCatalog(content, unitType).get(id) ?? null;
}

function buildEquipmentCatalog(content = {}, unitType = "pilot") {
  const entries = unitType === "pilot"
    ? [
        ...(Array.isArray(content.pilotGear) ? content.pilotGear : []),
        ...(Array.isArray(content.weapons) ? content.weapons : [])
      ]
    : [
        ...(Array.isArray(content.mechGear) ? content.mechGear : []),
        ...(Array.isArray(content.weapons) ? content.weapons : [])
      ];

  return new Map(entries
    .filter((entry) => entry && typeof entry === "object" && entry.id)
    .map((entry) => [String(entry.id), entry]));
}

function getEquippedGearIds(loadout = {}, unitType = "pilot") {
  if (unitType !== "pilot") {
    return [loadout.armor, loadout.core, loadout.accessory].map(cleanId).filter(Boolean);
  }

  return PILOT_GEAR_SLOT_KEYS.map((slot) => cleanId(loadout?.[slot])).filter(Boolean);
}

function addModifiers(target, source = {}) {
  if (!source || typeof source !== "object") return target;
  for (const key of MODIFIER_KEYS) {
    target[key] += Math.trunc(Number(source[key] ?? 0) || 0);
  }
  return target;
}

function createEmptyModifiers() {
  return Object.fromEntries(MODIFIER_KEYS.map((key) => [key, 0]));
}

function cleanId(value) {
  const id = String(value ?? "").trim();
  return id || null;
}
