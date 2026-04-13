// src/mechs.js
//
// BRIDGE FILE:
// keep the old filename so the rest of the project still imports cleanly,
// but move the runtime thinking to generic units.

import { pilotCellToMechTile } from "./scale/scaleMath.js";

const DEFAULT_ATTACK_PROFILE_MAP = {
  melee_01: "melee_cardinal_01",
  missile_01: "missile_aoe_01",
  rifle_01: "rifle_band_01",
  machinegun_01: "machine_gun_cone_01"
};

function facingToNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return ((value % 4) + 4) % 4;
  }

  switch (value) {
    case "N": return 0;
    case "E": return 1;
    case "S": return 2;
    case "W": return 3;
    default: return 0;
  }
}

function mapWeaponIdsToAttackProfileIds(weaponIds = []) {
  return weaponIds
    .map((weaponId) => DEFAULT_ATTACK_PROFILE_MAP[weaponId] ?? null)
    .filter(Boolean);
}

function getDefinitionById(items, id, fallbackIndex = 0) {
  if (!Array.isArray(items) || !items.length) return null;
  return items.find((item) => item.id === id) ?? items[fallbackIndex] ?? null;
}

function mechTileToBasePilotCell(x, y) {
  return {
    x: Number(x) * 2,
    y: Number(y) * 2
  };
}

export function createMechInstance(definition, overrides = {}) {
  const shield = definition.shield ?? definition.armor ?? 10;
  const core = definition.core ?? definition.structure ?? 6;
  const weaponIds = Array.isArray(definition.weapons) ? [...definition.weapons] : [];
  const attackProfileIds =
    Array.isArray(definition.attackProfileIds) && definition.attackProfileIds.length
      ? [...definition.attackProfileIds]
      : mapWeaponIdsToAttackProfileIds(weaponIds);

  const pilot = overrides.pilot ?? null;
  const pilotName = pilot?.name ?? overrides.pilotName ?? null;
  const reaction = Number(overrides.reaction ?? pilot?.reaction ?? 0);
  const targeting = Number(overrides.targeting ?? pilot?.targeting ?? 0);

  return {
    unitType: "mech",

    instanceId: overrides.instanceId ?? definition.id,
    definitionId: definition.id,
    name: definition.name,
    variant: definition.variant ?? "",
    class: definition.class ?? "",
    role: definition.role ?? "",

    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    facing: facingToNumber(overrides.facing ?? definition.defaultFacing ?? 0),

    footprint: 1,
    humanScaleSize: definition.humanScaleSize ?? 4,
    move: definition.move ?? 4,
    scale: "mech",

    armor: shield,
    structure: core,

    shield,
    maxShield: shield,
    core,
    maxCore: core,
    aether: definition.aether ?? 0,

    weapons: weaponIds,
    attackProfileIds,
    abilities: Array.isArray(definition.abilities) ? [...definition.abilities] : [],
    tubes: Array.isArray(definition.tubes) ? [...definition.tubes] : [],

    pilotId: pilot?.id ?? overrides.pilotId ?? null,
    pilotName,
    reaction,
    targeting,
    abilityPoints: Number(overrides.abilityPoints ?? pilot?.abilityPoints ?? 0),

    team: overrides.team ?? "player",
    controlType: overrides.controlType ?? "PC",
    spawnId: overrides.spawnId ?? null,
    spawnLabel: overrides.spawnLabel ?? null,

    hasMoved: false,
    hasActed: false,
    isBraced: false,
    initiative: null,
    lastInitiativeRoll: null,
    status: overrides.status ?? "operational",

    image: definition.image ?? null,
    render: definition.render ?? {}
  };
}

export function createPilotInstance(definition, overrides = {}) {
  const shield = definition.shield ?? 1;
  const core = definition.core ?? 6;

  return {
    unitType: "pilot",

    instanceId: overrides.instanceId ?? definition.id,
    definitionId: definition.id,
    name: definition.name,
    variant: definition.variant ?? "",
    class: "pilot",
    role: definition.role ?? "",

    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    facing: facingToNumber(overrides.facing ?? 0),

    footprint: 1,
    humanScaleSize: 1,
    move: definition.move ?? 4,
    scale: "pilot",

    armor: shield,
    structure: core,

    shield,
    maxShield: shield,
    core,
    maxCore: core,
    aether: definition.aether ?? 0,

    weapons: Array.isArray(definition.weapons) ? [...definition.weapons] : [],
    attackProfileIds: Array.isArray(definition.attackProfileIds) ? [...definition.attackProfileIds] : [],
    abilities: Array.isArray(definition.abilities) ? [...definition.abilities] : [],
    tubes: [],

    pilotId: definition.id,
    pilotName: definition.name,
    reaction: Number(overrides.reaction ?? definition.reaction ?? 0),
    targeting: Number(overrides.targeting ?? definition.targeting ?? 0),
    abilityPoints: Number(overrides.abilityPoints ?? definition.abilityPoints ?? 0),

    team: overrides.team ?? "player",
    controlType: overrides.controlType ?? "PC",
    spawnId: overrides.spawnId ?? null,
    spawnLabel: overrides.spawnLabel ?? null,

    parentMechId: overrides.parentMechId ?? null,
    embarked: Boolean(overrides.embarked ?? false),

    hasMoved: false,
    hasActed: false,
    isBraced: false,
    initiative: null,
    lastInitiativeRoll: null,
    status: overrides.status ?? "operational",

    image: definition.image ?? null,
    render: definition.render ?? {}
  };
}

export function instantiateTestMechs(content) {
  // kept for compatibility, now returns ALL TEST UNITS
  return instantiateTestUnits(content);
}

export function instantiateTestUnits(content) {
  const mechDefinitions = Array.isArray(content?.mechs) ? content.mechs : [];
  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];
  const spawnPoints = Array.isArray(content?.spawnPoints) ? content.spawnPoints : [];

  if (!mechDefinitions.length || !pilotDefinitions.length || spawnPoints.length < 4) {
    return [];
  }

  const mechLoadout = [
    {
      mechId: "mech_a",
      pilotId: "pilot_biggs",
      instanceId: "player-1",
      team: "player",
      controlType: "PC",
      spawnId: "spawn_3",
      fallbackSpawnIndex: 2
    },
    {
      mechId: "mech_b",
      pilotId: "pilot_wedge",
      instanceId: "player-2",
      team: "player",
      controlType: "PC",
      spawnId: "spawn_4",
      fallbackSpawnIndex: 3
    },
    {
      mechId: "mech_c",
      pilotId: "pilot_tom",
      instanceId: "enemy-1",
      team: "enemy",
      controlType: "CPU",
      spawnId: "spawn_1",
      fallbackSpawnIndex: 0
    },
    {
      mechId: "mech_d",
      pilotId: "pilot_jerri",
      instanceId: "enemy-2",
      team: "enemy",
      controlType: "CPU",
      spawnId: "spawn_2",
      fallbackSpawnIndex: 1
    }
  ];

  const mechUnits = mechLoadout
    .map((entry) => {
      const mech = getDefinitionById(mechDefinitions, entry.mechId, entry.fallbackSpawnIndex);
      const pilot = getDefinitionById(pilotDefinitions, entry.pilotId, entry.fallbackSpawnIndex);
      const spawn =
        spawnPoints.find((point) => point.id === entry.spawnId) ??
        spawnPoints[entry.fallbackSpawnIndex] ??
        null;

      if (!mech || !pilot || !spawn) return null;

      return createMechInstance(mech, {
        instanceId: entry.instanceId,
        x: spawn.x,
        y: spawn.y,
        facing: facingToNumber(mech.defaultFacing),
        team: entry.team,
        controlType: entry.controlType,
        pilot,
        spawnId: spawn.id,
        spawnLabel: spawn.label
      });
    })
    .filter(Boolean);

  // TEST SCAFFOLD:
  // add one pilot unit per team so movement / focus / targeting can be tested
  // before exit-mech is wired.
  const pilotLoadout = [
    {
      pilotId: "pilot_biggs",
      instanceId: "player-pilot-1",
      team: "player",
      controlType: "PC",
      spawnId: "spawn_3",
      offsetX: 0,
      offsetY: 0
    },
    {
      pilotId: "pilot_tom",
      instanceId: "enemy-pilot-1",
      team: "enemy",
      controlType: "CPU",
      spawnId: "spawn_1",
      offsetX: 1,
      offsetY: 1
    }
  ];

  const pilotUnits = pilotLoadout
    .map((entry) => {
      const pilot = getDefinitionById(pilotDefinitions, entry.pilotId, 0);
      const spawn = spawnPoints.find((point) => point.id === entry.spawnId) ?? null;
      if (!pilot || !spawn) return null;

      const baseCell = mechTileToBasePilotCell(spawn.x, spawn.y);

      return createPilotInstance(pilot, {
        instanceId: entry.instanceId,
        x: baseCell.x + entry.offsetX,
        y: baseCell.y + entry.offsetY,
        team: entry.team,
        controlType: entry.controlType,
        spawnId: spawn.id,
        spawnLabel: `${spawn.label} Pilot`
      });
    })
    .filter(Boolean);

  return [...mechUnits, ...pilotUnits];
}

// GENERIC UNIT QUERIES

export function getUnitById(units, instanceId) {
  return (Array.isArray(units) ? units : []).find((unit) => unit.instanceId === instanceId) ?? null;
}

export function getUnitsAt(units, x, y, scale = null) {
  return (Array.isArray(units) ? units : []).filter((unit) => {
    if (!unit) return false;
    if (scale && unit.scale !== scale) return false;
    return unit.x === x && unit.y === y;
  });
}

export function moveUnitTo(units, instanceId, x, y) {
  const unit = getUnitById(units, instanceId);
  if (!unit) return false;

  unit.x = x;
  unit.y = y;
  return true;
}

export function setUnitFacing(units, instanceId, facing) {
  const unit = getUnitById(units, instanceId);
  if (!unit) return false;

  unit.facing = facingToNumber(facing);
  return true;
}

// BRIDGE WRAPPERS

export function getMechAt(units, x, y) {
  return getUnitsAt(units, x, y).find(Boolean) ?? null;
}

export function getMechById(units, instanceId) {
  return getUnitById(units, instanceId);
}

export function moveMechTo(units, instanceId, x, y) {
  return moveUnitTo(units, instanceId, x, y);
}

export function setMechFacing(units, instanceId, facing) {
  return setUnitFacing(units, instanceId, facing);
}

export function getUnitScreenAnchorPosition(unit) {
  if (!unit) {
    return { x: 0, y: 0, mechX: 0, mechY: 0, scale: "mech" };
  }

  if (unit.scale === "pilot") {
    const mechTile = pilotCellToMechTile(unit.x, unit.y);
    return {
      x: unit.x,
      y: unit.y,
      mechX: mechTile.x,
      mechY: mechTile.y,
      scale: "pilot"
    };
  }

  return {
    x: unit.x,
    y: unit.y,
    mechX: unit.x,
    mechY: unit.y,
    scale: "mech"
  };
}
