// src/mechs.js

import { getMapSpawns, getMapStartState } from "./map.js";
import { buildRuntimeInventory, buildRuntimeLoadout, getDefaultSlotsForUnit } from "./content/unitLoadout.js";

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
  const slots = getDefaultSlotsForUnit(unitType, definition);
  const loadout = buildRuntimeLoadout(unitType, definition, overrides);
  const inventory = buildRuntimeInventory(definition, overrides);

  return {
    unitType,
    instanceId: overrides.instanceId ?? definition.id,
    definitionId: definition.id,

    name: definition.name,
    variant: definition.variant ?? "",
    class: definition.class ?? (isPilot ? "pilot" : ""),
    role: definition.role ?? "",

    // RUNTIME x/y IS THE CENTER TILE.
    x: Number(overrides.x ?? 0),
    y: Number(overrides.y ?? 0),
    facing: facingToNumber(overrides.facing ?? definition.defaultFacing ?? 0),
    anchorType: "center",

    footprintWidth: isPilot ? 1 : 3,
    footprintHeight: isPilot ? 1 : 3,
    scale: unitType,

    move: Number(definition.move ?? (isPilot ? 6 : 4)),
    slots,
    loadout,
    inventory,
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
    items: Array.isArray(definition.items) ? [...definition.items] : [],

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
    currentMechId: overrides.currentMechId ?? null,
    embarkedPilotId: overrides.embarkedPilotId ?? null,
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

function buildRuntimeSpawnIndex(map = null) {
  const index = new Map();
  const mapSpawns = getMapSpawns(map);

  for (const team of ["player", "enemy"]) {
    const entries = Array.isArray(mapSpawns?.[team]) ? mapSpawns[team] : [];
    entries.forEach((spawn, spawnIndex) => {
      if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) return;
      index.set(`${team}_${spawnIndex + 1}`, {
        id: `${team}_${spawnIndex + 1}`,
        x: Number(spawn.x),
        y: Number(spawn.y)
      });
    });
  }

  return index;
}

function normalizeControlType(value) {
  return value === "CPU" ? "CPU" : "PC";
}

function normalizeTeam(value) {
  return value === "enemy" ? "enemy" : "player";
}

function buildUnitsFromStartState(content, map, spawnIndex, options = {}) {
  const mechDefinitions = Array.isArray(content?.mechs) ? content.mechs : [];
  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];
  const startState = getMapStartState(map);
  const deployments = Array.isArray(startState?.deployments) ? startState.deployments : [];

  if (!deployments.length) {
    return null;
  }

  const units = [];

  const atSpawn = (spawnId) => {
    const spawn = spawnIndex.get(spawnId);
    return spawn
      ? {
          x: Number(spawn.x),
          y: Number(spawn.y)
        }
      : null;
  };

  const includePlayerDeployments = options.includePlayerDeployments !== false;

  for (const deployment of deployments) {
    const team = normalizeTeam(deployment?.team);
    const controlType = normalizeControlType(deployment?.controlType);
    const startEmbarked = Boolean(deployment?.startEmbarked);

    if (!includePlayerDeployments && controlType === "PC") continue;

    const pilot = getDefinitionById(pilotDefinitions, deployment?.pilotDefinitionId, 0);
    const mech = deployment?.mechDefinitionId
      ? getDefinitionById(mechDefinitions, deployment?.mechDefinitionId, 0)
      : null;
    if (!pilot) continue;

    const pilotInstanceId = deployment?.pilotInstanceId ?? `${team}-pilot-${pilot.id}`;
    const mechInstanceId = mech
      ? (deployment?.mechInstanceId ?? `${team}-mech-${mech.id}`)
      : null;

    const pilotSpawnId = deployment?.pilotSpawnId ?? null;
    const mechSpawnId = deployment?.mechSpawnId ?? null;
    const pilotPos = pilotSpawnId ? atSpawn(pilotSpawnId) : null;
    const mechPos = mechSpawnId ? atSpawn(mechSpawnId) : null;

    if (!pilotPos) {
      console.warn("Skipping deployment with missing map spawn.", {
        pilotSpawnId,
        mechSpawnId,
        deployment
      });
      continue;
    }

    if (!mech) {
      const pilotUnit = createPilotInstance(pilot, {
        instanceId: pilotInstanceId,
        x: pilotPos.x,
        y: pilotPos.y,
        team,
        controlType,
        spawnId: pilotSpawnId,
        currentMechId: null,
        embarked: false,
        parentMechId: null
      });

      units.push(pilotUnit);
      continue;
    }

    if (!mechPos) {
      console.warn("Skipping deployment with missing map spawn.", {
        pilotSpawnId,
        mechSpawnId,
        deployment
      });
      continue;
    }

    const mechUnit = createMechInstance(mech, {
      instanceId: mechInstanceId,
      x: mechPos.x,
      y: mechPos.y,
      team,
      controlType,
      pilot,
      spawnId: mechSpawnId,
      embarkedPilotId: startEmbarked ? pilotInstanceId : null
    });

    const pilotUnit = createPilotInstance(pilot, {
      instanceId: pilotInstanceId,
      x: startEmbarked ? mechPos.x : pilotPos.x,
      y: startEmbarked ? mechPos.y : pilotPos.y,
      team,
      controlType,
      spawnId: pilotSpawnId,
      currentMechId: startEmbarked ? mechInstanceId : null,
      embarked: startEmbarked,
      parentMechId: mechInstanceId
    });

    units.push(pilotUnit, mechUnit);
  }

  return units.length ? units : null;
}

export function instantiateTestUnits(content, map = null, options = {}) {
  const mechDefinitions = Array.isArray(content?.mechs) ? content.mechs : [];
  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];

  if (!mechDefinitions.length || !pilotDefinitions.length) {
    return [];
  }

  const runtimeMap = map ?? content?.defaultMap ?? null;
  const spawnIndex = buildRuntimeSpawnIndex(runtimeMap);
  const startStateUnits = buildUnitsFromStartState(content, runtimeMap, spawnIndex, options);
  if (Array.isArray(startStateUnits) && startStateUnits.length) {
    return startStateUnits;
  }

  console.warn("No valid map-authored startState.deployments found for map.", {
    mapId: runtimeMap?.id ?? null
  });
  return [];


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

export function getUnitAt(units, x, y, scale = null) {
  return getUnitsAt(units, x, y, scale).find(Boolean) ?? null;
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
