// src/mechs.js

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
    case "N":
      return 0;
    case "E":
      return 1;
    case "S":
      return 2;
    case "W":
      return 3;
    default:
      return 0;
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

export function instantiateTestMechs(content) {
  const mechDefinitions = Array.isArray(content?.mechs) ? content.mechs : [];
  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];
  const spawnPoints = Array.isArray(content?.spawnPoints) ? content.spawnPoints : [];

  if (!mechDefinitions.length || !pilotDefinitions.length || spawnPoints.length < 4) {
    return [];
  }

  const loadout = [
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

  return loadout
    .map((entry) => {
      const mech = getDefinitionById(mechDefinitions, entry.mechId, entry.fallbackSpawnIndex);
      const pilot = getDefinitionById(pilotDefinitions, entry.pilotId, entry.fallbackSpawnIndex);
      const spawn =
        spawnPoints.find((point) => point.id === entry.spawnId) ??
        spawnPoints[entry.fallbackSpawnIndex] ??
        null;

      if (!mech || !pilot || !spawn) {
        return null;
      }

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
    unitType: overrides.unitType ?? definition.unitType ?? "mech",

    instanceId: overrides.instanceId ?? definition.id,
    definitionId: definition.id,
    name: definition.name,
    variant: definition.variant ?? "",
    class: definition.class ?? "",
    role: definition.role ?? "",

    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    facing: facingToNumber(overrides.facing ?? definition.defaultFacing ?? 0),

    footprint: definition.footprint ?? 1,
    humanScaleSize: definition.humanScaleSize ?? 4,
    move: definition.move ?? 4,
    scale: overrides.scale ?? definition.scale ?? "mech",

    // compatibility
    armor: shield,
    structure: core,

    // current runtime names
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

export function getMechAt(mechs, x, y) {
  return mechs.find((mech) => mech.x === x && mech.y === y) ?? null;
}

export function getMechById(mechs, instanceId) {
  return mechs.find((mech) => mech.instanceId === instanceId) ?? null;
}

export function moveMechTo(mechs, instanceId, x, y) {
  const mech = getMechById(mechs, instanceId);
  if (!mech) return false;

  mech.x = x;
  mech.y = y;
  return true;
}

export function setMechFacing(mechs, instanceId, facing) {
  const mech = getMechById(mechs, instanceId);
  if (!mech) return false;

  mech.facing = facingToNumber(facing);
  return true;
}
