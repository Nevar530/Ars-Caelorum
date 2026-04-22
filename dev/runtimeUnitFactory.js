// dev/runtimeUnitFactory.js
//
// Dev-only runtime combat unit factory.
// This file creates spawned mech+pivot runtime units for testing.
// It is intentionally isolated from core gameplay files so dev tooling
// can be removed later without ripping apart main systems.

import {
  getPilot,
  getMech,
  getSpawnPoint,
  validatePilot,
  validateMech,
  validateSpawnPoint
} from "./dataStore.js";

let runtimeUnitCounter = 0;

function nextRuntimeUnitId() {
  runtimeUnitCounter += 1;
  return `unit_${String(runtimeUnitCounter).padStart(4, "0")}`;
}

function normalizeControlType(controlType) {
  return controlType === "CPU" ? "CPU" : "PC";
}

function normalizeTeam(team) {
  return team === "enemy" ? "enemy" : "player";
}

function normalizeFacing(facing) {
  const valid = ["N", "E", "S", "W"];
  return valid.includes(facing) ? facing : "S";
}

export function createRuntimeUnit({
  mechId,
  pilotId,
  spawnId,
  controlType = "PC",
  team = "player"
}) {
  const mechCheck = validateMech(mechId);
  if (!mechCheck.valid) {
    throw new Error(mechCheck.message);
  }

  const pilotCheck = validatePilot(pilotId);
  if (!pilotCheck.valid) {
    throw new Error(pilotCheck.message);
  }

  const spawnCheck = validateSpawnPoint(spawnId);
  if (!spawnCheck.valid) {
    throw new Error(spawnCheck.message);
  }

  const mech = getMech(mechId);
  const pilot = getPilot(pilotId);
  const spawnPoint = getSpawnPoint(spawnId);

  const unit = {
    runtimeUnitId: nextRuntimeUnitId(),

    mechId: mech.id,
    mechName: mech.name,
    mechVariant: mech.variant,

    pilotId: pilot.id,
    pilotName: pilot.name,

    controlType: normalizeControlType(controlType),
    team: normalizeTeam(team),

    spawnId: spawnPoint.id,
    x: spawnPoint.x,
    y: spawnPoint.y,
    facing: normalizeFacing(mech.defaultFacing || "S"),

    core: mech.core,
    shield: mech.shield,
    aether: mech.aether,
    move: mech.move,

    reaction: pilot.reaction,
    targeting: pilot.targeting,

    slots: mech.slots ? { ...mech.slots } : { weapon: Array.isArray(mech.weapons) ? mech.weapons.length : 0, ability: 1, item: 2 },
    loadout: {
      weapons: Array.isArray(mech.loadout?.weapons) ? [...mech.loadout.weapons] : (Array.isArray(mech.weapons) ? [...mech.weapons] : []),
      armor: mech.loadout?.armor ?? null,
      abilities: Array.isArray(mech.loadout?.abilities) ? [...mech.loadout.abilities] : (Array.isArray(mech.abilities) ? [...mech.abilities] : []),
      items: Array.isArray(mech.loadout?.items) ? [...mech.loadout.items] : []
    },
    inventory: {
      items: Array.isArray(mech.inventory?.items) ? [...mech.inventory.items] : [],
      weapons: Array.isArray(mech.inventory?.weapons) ? [...mech.inventory.weapons] : [],
      armor: Array.isArray(mech.inventory?.armor) ? [...mech.inventory.armor] : [],
      abilities: Array.isArray(mech.inventory?.abilities) ? [...mech.inventory.abilities] : []
    },
    weapons: Array.isArray(mech.weapons) ? [...mech.weapons] : [],
    abilities: Array.isArray(mech.abilities) ? [...mech.abilities] : [],
    tubes: Array.isArray(mech.tubes) ? [...mech.tubes] : [],
    items: Array.isArray(mech.items) ? [...mech.items] : [],

    hasMoved: false,
    hasActed: false,
    isBraced: false,
    isActive: false,
    initiative: null,

    status: "operational"
  };

  return unit;
}

export function replaceUnitAtSpawn(units, newUnit) {
  if (!Array.isArray(units)) {
    throw new Error("replaceUnitAtSpawn expected units to be an array.");
  }

  return [
    ...units.filter((unit) => unit.spawnId !== newUnit.spawnId),
    newUnit
  ];
}

export function removeUnitByRuntimeId(units, runtimeUnitId) {
  if (!Array.isArray(units)) {
    throw new Error("removeUnitByRuntimeId expected units to be an array.");
  }

  return units.filter((unit) => unit.runtimeUnitId !== runtimeUnitId);
}

export function getUnitAtSpawn(units, spawnId) {
  if (!Array.isArray(units)) {
    return null;
  }

  return units.find((unit) => unit.spawnId === spawnId) || null;
}

export function resetUnitRoundFlags(unit) {
  return {
    ...unit,
    hasMoved: false,
    hasActed: false,
    isBraced: false,
    isActive: false,
    initiative: null
  };
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollUnitInitiative(unit) {
  const roll = rollD6() + rollD6();

  return {
    ...unit,
    initiative: roll + (unit.reaction || 0)
  };
}

export function rollAllInitiative(units) {
  if (!Array.isArray(units)) {
    throw new Error("rollAllInitiative expected units to be an array.");
  }

  return units.map(rollUnitInitiative);
}

export function sortMovePhaseOrder(units) {
  if (!Array.isArray(units)) {
    throw new Error("sortMovePhaseOrder expected units to be an array.");
  }

  return [...units].sort((a, b) => {
    const aInit = a.initiative ?? -999;
    const bInit = b.initiative ?? -999;

    if (aInit !== bInit) {
      return aInit - bInit; // low to high
    }

    return a.runtimeUnitId.localeCompare(b.runtimeUnitId);
  });
}

export function sortActionPhaseOrder(units) {
  if (!Array.isArray(units)) {
    throw new Error("sortActionPhaseOrder expected units to be an array.");
  }

  return [...units].sort((a, b) => {
    const aInit = a.initiative ?? -999;
    const bInit = b.initiative ?? -999;

    if (aInit !== bInit) {
      return bInit - aInit; // high to low
    }

    return a.runtimeUnitId.localeCompare(b.runtimeUnitId);
  });
}
