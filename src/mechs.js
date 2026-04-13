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

function buildBaseRuntimeUnit(definition, overrides = {}, unitType = "mech") {
  const isPilot = unitType === "pilot";
  const shield = Number(definition?.shield ?? definition?.armor ?? (isPilot ? 1 : 10));
  const core = Number(definition?.core ?? definition?.structure ?? (isPilot ? 6 : 6));
  const weaponIds = Array.isArray(definition?.weapons) ? [...definition.weapons] : [];

  return {
    unitType,
    instanceId: overrides.instanceId ?? definition.id,
    definitionId: definition.id,

    name: definition.name,
    variant: definition.variant ?? "",
    class: definition.class ?? (isPilot ? "pilot" : ""),
    role: definition.role ?? "",

    x: Number(overrides.x ?? 0),
    y: Number(overrides.y ?? 0),
    facing: facingToNumber(overrides.facing ?? definition.defaultFacing ?? 0),
    anchorType: "center",

    footprintWidth: isPilot ? 2 : 4,
    footprintHeight: isPilot ? 2 : 4,
    scale: unitType,

    move: Number(definition.move ?? (isPilot ? 6 : 4)),
    armor: shield,
    structure: core,
    shield,
    maxShield: shield,
    core,
    maxCore: core,
    aether: Number(definition.aether ?? 0),

    weapons: weaponIds,
    attackProfileIds:
      Array.isArray(definition.attackProfileIds) && definition.attackProfileIds.length
        ? [...definition.attackProfileIds]
        : mapWeaponIdsToAttackProfileIds(weaponIds),

    abilities: Array.isArray(definition.abilities) ? [...definition.abilities] : [],
    tubes: Array.isArray(definition.tubes) ? [...definition.tubes] : [],

    pilotId: overrides.pilotId ?? null,
    pilotName: overrides.pilotName ?? null,
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

export function createMechInstance(definition, overrides = {}) {
  const pilot = overrides.pilot ?? null;

  return buildBaseRuntimeUnit(definition, {
    ...overrides,
    pilotId: pilot?.id ?? overrides.pilotId ?? null,
    pilotName: pilot?.name ?? overrides.pilotName ?? null,
    reaction: overrides.reaction ?? pilot?.reaction ?? 0,
    targeting: overrides.targeting ?? pilot?.targeting ?? 0,
    abilityPoints: overrides.abilityPoints ?? pilot?.abilityPoints ?? 0
  }, "mech");
}

export function createPilotInstance(definition, overrides = {}) {
  return buildBaseRuntimeUnit(definition, overrides, "pilot");
}

export function instantiateTestMechs(content) {
  return instantiateTestUnits(content);
}

export function instantiateTestUnits(content) {
  const mechDefinitions = Array.isArray(content?.mechs) ? content.mechs : [];
  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];

  if (!mechDefinitions.length || !pilotDefinitions.length) {
    return [];
  }

  const setup = [
    {
      unitType: "pilot",
      definitionId: "pilot_biggs",
      instanceId: "player-pilot-1",
      x: 30,
      y: 30,
      team: "player",
      controlType: "PC"
    },
    {
      unitType: "mech",
      definitionId: "mech_a",
      pilotId: "pilot_biggs",
      instanceId: "player-mech-1",
      x: 34,
      y: 30,
      team: "player",
      controlType: "PC"
    },
    {
      unitType: "pilot",
      definitionId: "pilot_tom",
      instanceId: "enemy-pilot-1",
      x: 10,
      y: 10,
      team: "enemy",
      controlType: "CPU"
    },
    {
      unitType: "mech",
      definitionId: "mech_c",
      pilotId: "pilot_tom",
      instanceId: "enemy-mech-1",
      x: 14,
      y: 10,
      team: "enemy",
      controlType: "CPU"
    }
  ];

  return setup
    .map((entry) => {
      if (entry.unitType === "pilot") {
        const pilot = getDefinitionById(pilotDefinitions, entry.definitionId, 0);
        if (!pilot) return null;

        return createPilotInstance(pilot, {
          instanceId: entry.instanceId,
          x: entry.x,
          y: entry.y,
          team: entry.team,
          controlType: entry.controlType
        });
      }

      const mech = getDefinitionById(mechDefinitions, entry.definitionId, 0);
      const pilot = getDefinitionById(pilotDefinitions, entry.pilotId, 0);
      if (!mech) return null;

      return createMechInstance(mech, {
        instanceId: entry.instanceId,
        x: entry.x,
        y: entry.y,
        team: entry.team,
        controlType: entry.controlType,
        pilot
      });
    })
    .filter(Boolean);
}

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

  unit.x = Number(x);
  unit.y = Number(y);
  return true;
}

export function setUnitFacing(units, instanceId, facing) {
  const unit = getUnitById(units, instanceId);
  if (!unit) return false;

  unit.facing = facingToNumber(facing);
  return true;
}

export function getUnitScenePosition(unit) {
  const unitType = unit?.unitType ?? "mech";

  if (unitType === "pilot") {
    return {
      mechX: Number(unit?.x ?? 0),
      mechY: Number(unit?.y ?? 0),
      pilotX: Number(unit?.x ?? 0),
      pilotY: Number(unit?.y ?? 0),
      sceneX: Number(unit?.x ?? 0),
      sceneY: Number(unit?.y ?? 0),
      sceneSize: 1
    };
  }

  return {
    mechX: Number(unit?.x ?? 0),
    mechY: Number(unit?.y ?? 0),
    pilotX: Number(unit?.x ?? 0),
    pilotY: Number(unit?.y ?? 0),
    sceneX: Number(unit?.x ?? 0),
    sceneY: Number(unit?.y ?? 0),
    sceneSize: 1
  };
}

// Bridge wrappers retained for older controllers.
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
