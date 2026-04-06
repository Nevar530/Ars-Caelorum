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

export function instantiateTestMechs(content) {
  const mechDefinitions = Array.isArray(content?.mechs) ? content.mechs : [];

  if (!mechDefinitions.length) {
    return [];
  }

  const mechA =
    mechDefinitions.find((mech) => mech.id === "mech_a") ?? mechDefinitions[0];

  if (!mechA) {
    return [];
  }

  return [
    createMechInstance(mechA, {
      instanceId: "hero-1",
      x: 5,
      y: 7,
      facing: facingToNumber(mechA.defaultFacing)
    })
  ];
}

export function createMechInstance(definition, overrides = {}) {
  const shield = definition.shield ?? definition.armor ?? 10;
  const core = definition.core ?? definition.structure ?? 6;
  const weaponIds = Array.isArray(definition.weapons) ? [...definition.weapons] : [];
  const attackProfileIds =
    Array.isArray(definition.attackProfileIds) && definition.attackProfileIds.length
      ? [...definition.attackProfileIds]
      : mapWeaponIdsToAttackProfileIds(weaponIds);

  return {
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

    // LOS / scale system
    scale: overrides.scale ?? definition.scale ?? "mech",

    // Compatibility with existing app code
    armor: shield,
    structure: core,

    // Forward naming for newer systems
    shield,
    core,
    aether: definition.aether ?? 0,

    weapons: weaponIds,
    attackProfileIds,

    abilities: Array.isArray(definition.abilities) ? [...definition.abilities] : [],
    tubes: Array.isArray(definition.tubes) ? [...definition.tubes] : [],

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
