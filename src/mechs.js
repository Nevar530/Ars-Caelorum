// src/mechs.js

import { getMapSpawns, getMapStartState } from "./map.js";
import { buildRuntimeInventory, buildRuntimeLoadout, getDefaultSlotsForUnit } from "./content/unitLoadout.js";
import { getLoadoutModifiers } from "./content/equipmentModifiers.js";
import { buildEnemyPilotRuntimeOverrides, buildEnemyScalingContext } from "./campaign/enemyScaling.js";
import { getCampaignMechLoadout, getCampaignPilotLoadout } from "./campaign/campaignLoadouts.js";

const PILOT_CORE_MULTIPLIER = 5;
const PILOT_TARGETING_CAP = 5;
const PILOT_REACTION_CAP = 5;

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

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function getAbilityIdsUnlockedByLevel(definition = {}, level = 1) {
  const progression = Array.isArray(definition.abilityProgression) ? definition.abilityProgression : [];
  const currentLevel = Math.max(1, Math.trunc(Number(level ?? 1) || 1));

  return progression
    .filter((entry) => Math.max(1, Math.trunc(Number(entry?.level ?? 1) || 1)) <= currentLevel)
    .map((entry) => entry?.abilityId)
    .filter(Boolean);
}

function getLoadoutGrantedAbilityIds(content = {}, loadout = {}, unitType = "pilot") {
  const gearCatalog = unitType === "pilot"
    ? [...(content.pilotGear ?? []), ...(content.weapons ?? [])]
    : [...(content.mechGear ?? []), ...(content.weapons ?? [])];
  const ids = unitType === "pilot"
    ? [loadout.armor, loadout.accessory, loadout.primaryWeapon, loadout.secondaryWeapon]
    : [loadout.plating, loadout.system, loadout.primaryWeapon, loadout.secondaryWeapon, loadout.supportWeapon];

  const granted = [];
  for (const id of ids) {
    const cleanId = String(id ?? "").trim();
    if (!cleanId) continue;
    const item = gearCatalog.find((entry) => entry?.id === cleanId);
    if (Array.isArray(item?.grantsAbilities)) {
      granted.push(...item.grantsAbilities);
    }
  }

  return uniqueIds(granted);
}

function buildBaseRuntimeUnit(definition, overrides = {}, unitType = "mech") {
  const isPilot = unitType === "pilot";
  const slots = getDefaultSlotsForUnit(unitType, definition);
  const loadout = buildRuntimeLoadout(unitType, definition, overrides);
  const inventory = buildRuntimeInventory(definition, overrides);
  const equipmentModifiers = getLoadoutModifiers(overrides.content ?? {}, loadout, unitType);
  const baseShield = Number(overrides.shield ?? definition?.shield ?? definition?.armor ?? (isPilot ? 0 : 10));
  const shield = isPilot && equipmentModifiers.shield > 0
    ? equipmentModifiers.shield
    : Math.max(0, baseShield + equipmentModifiers.shield);
  const coreStat = Math.max(1, Math.trunc(Number(overrides.coreStat ?? definition?.core ?? (isPilot ? 1 : 6)) || (isPilot ? 1 : 6)) + equipmentModifiers.core);
  const core = Number(overrides.core ?? (isPilot
    ? coreStat * PILOT_CORE_MULTIPLIER
    : (definition?.core ?? definition?.structure ?? 6)));
  const weaponIds = loadout.weapons?.length
    ? [...loadout.weapons]
    : (Array.isArray(definition?.weapons) ? [...definition.weapons] : []);
  const move = Math.max(0, Number(overrides.move ?? definition.move ?? (isPilot ? 4 : 4)) + equipmentModifiers.move);
  const unitLevel = Math.max(1, Math.trunc(Number(overrides.level ?? definition.level ?? 1) || 1));
  const maxAbilityPoints = Math.max(0, Math.trunc(Number(overrides.abilityPoints ?? definition.abilityPoints ?? 0) || 0) + equipmentModifiers.abilityPoints);
  const learnedPilotAbilities = isPilot && Array.isArray(overrides.learnedAbilities)
    ? overrides.learnedAbilities
    : null;
  const naturalAbilities = uniqueIds([
    ...(learnedPilotAbilities ?? [
      ...(Array.isArray(definition.abilities) ? definition.abilities : []),
      ...getAbilityIdsUnlockedByLevel(definition, unitLevel)
    ]),
    ...getLoadoutGrantedAbilityIds(overrides.content ?? {}, loadout, unitType)
  ]);

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

    move,
    slots,
    loadout,
    inventory,
    armor: shield,
    structure: core,
    coreStat: isPilot ? coreStat : null,
    coreMultiplier: isPilot ? PILOT_CORE_MULTIPLIER : null,
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

    abilities: naturalAbilities,
    tubes: Array.isArray(definition.tubes) ? [...definition.tubes] : [],
    items: Array.isArray(definition.items) ? [...definition.items] : [],

    pilotId: overrides.pilotId ?? null,
    pilotName: overrides.pilotName ?? null,
    level: unitLevel,
    reaction: clampStat(Number(overrides.reaction ?? definition.reaction ?? 0) + equipmentModifiers.reaction, isPilot ? PILOT_REACTION_CAP : null),
    targeting: clampStat(Number(overrides.targeting ?? definition.targeting ?? 0) + equipmentModifiers.targeting, isPilot ? PILOT_TARGETING_CAP : null),
    abilityPoints: maxAbilityPoints,
    maxAbilityPoints,

    team: overrides.team ?? "player",
    controlType: normalizeControlType(overrides.controlType, overrides.team ?? "player"),
    spawnId: overrides.spawnId ?? null,
    spawnLabel: overrides.spawnLabel ?? null,

    parentMechId: overrides.parentMechId ?? null,
    currentMechId: overrides.currentMechId ?? null,
    embarkedPilotId: overrides.embarkedPilotId ?? null,
    embarked: Boolean(overrides.embarked ?? false),
    boardable: unitType === "mech" ? Boolean(overrides.boardable ?? true) : false,
    locked: Boolean(overrides.locked ?? false),

    hasMoved: false,
    hasActed: false,
    isBraced: false,
    initiative: null,
    lastInitiativeRoll: null,
    status: overrides.status ?? "operational",

    image: definition.image ?? null,
    render: definition.render ?? {},
    enemyScaling: overrides.enemyScaling ?? null
  };
}

export function createMechInstance(definition, overrides = {}) {
  const pilot = overrides.pilot ?? null;

  return buildBaseRuntimeUnit(definition, {
    ...overrides,
    pilotId: pilot?.id ?? overrides.pilotId ?? null,
    pilotName: pilot?.name ?? overrides.pilotName ?? null,
    reaction: overrides.reaction ?? pilot?.reaction ?? 0,
    targeting: overrides.targeting ?? pilot?.targeting ?? 0
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

  for (const team of ["player", "enemy", "neutral"]) {
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

function normalizeControlType(value, team = "player") {
  if (value === "CPU") return "CPU";
  if (value === "PC") return "PC";
  return team === "player" ? "PC" : "CPU";
}

function normalizeTeam(value) {
  if (value === "enemy") return "enemy";
  if (value === "neutral") return "neutral";
  return "player";
}

function clampStat(value, cap = null) {
  const amount = Math.max(0, Math.trunc(Number(value ?? 0) || 0));
  return Number.isFinite(cap) ? Math.min(cap, amount) : amount;
}

function getPilotCampaignProgress(campaignState, pilotId) {
  if (!campaignState?.pilots || !pilotId) return null;
  const progress = campaignState.pilots[pilotId];
  return progress && typeof progress === "object" ? progress : null;
}

function buildPilotRuntimeOverrides(pilotDefinition, campaignState) {
  const progress = getPilotCampaignProgress(campaignState, pilotDefinition?.id);
  const bonuses = progress?.statBonuses && typeof progress.statBonuses === "object" ? progress.statBonuses : {};

  return {
    level: Math.max(1, Math.trunc(Number(progress?.level ?? pilotDefinition?.level ?? 1) || 1)),
    coreStat: Math.max(1, Math.trunc(Number(pilotDefinition?.core ?? 1) || 1)) + Math.max(0, Math.trunc(Number(bonuses.core ?? 0) || 0)),
    abilityPoints: Math.max(0, Math.trunc(Number(pilotDefinition?.abilityPoints ?? 0) || 0)) + Math.max(0, Math.trunc(Number(bonuses.abilityPoints ?? 0) || 0)),
    targeting: clampStat((Number(pilotDefinition?.targeting ?? 0) || 0) + (Number(bonuses.targeting ?? 0) || 0), PILOT_TARGETING_CAP),
    reaction: clampStat((Number(pilotDefinition?.reaction ?? 0) || 0) + (Number(bonuses.reaction ?? 0) || 0), PILOT_REACTION_CAP),
    loadout: getCampaignPilotLoadout(campaignState, pilotDefinition),
    learnedAbilities: Array.isArray(progress?.learnedAbilities) ? [...progress.learnedAbilities] : null
  };
}

function buildMechRuntimeOverrides(mechDefinition, campaignState) {
  return {
    loadout: getCampaignMechLoadout(campaignState, mechDefinition)
  };
}

function pickPilotControlStats(overrides = {}) {
  return {
    reaction: overrides.reaction,
    targeting: overrides.targeting
  };
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
  const campaignState = options.campaignState ?? null;
  const enemyScalingContext = buildEnemyScalingContext({ content, map, campaignState });
  const mapScaling = map?.enemyScaling ?? options.missionDefinition?.enemyScaling ?? null;

  for (const deployment of deployments) {
    const team = normalizeTeam(deployment?.team);
    const controlType = normalizeControlType(deployment?.controlType, team);
    const startEmbarked = Boolean(deployment?.startEmbarked);

    if (!includePlayerDeployments && controlType === "PC") continue;

    const pilot = deployment?.pilotDefinitionId
      ? getDefinitionById(pilotDefinitions, deployment?.pilotDefinitionId, 0)
      : null;
    const mech = deployment?.mechDefinitionId
      ? getDefinitionById(mechDefinitions, deployment?.mechDefinitionId, 0)
      : null;

    if (!pilot && !mech) continue;

    const playerPilotRuntimeOverrides = pilot ? buildPilotRuntimeOverrides(pilot, campaignState) : {};
    const enemyPilotRuntimeOverrides = pilot ? buildEnemyPilotRuntimeOverrides({
      pilotDefinition: pilot,
      deployment,
      scalingContext: enemyScalingContext,
      mapScaling
    }) : null;
    const pilotRuntimeOverrides = enemyPilotRuntimeOverrides ?? playerPilotRuntimeOverrides;
    const mechRuntimeOverrides = mech && team === "player" ? buildMechRuntimeOverrides(mech, campaignState) : {};
    const pilotControlStats = pickPilotControlStats(pilotRuntimeOverrides);

    const pilotInstanceId = pilot
      ? (deployment?.pilotInstanceId ?? `${team}-pilot-${pilot.id}`)
      : null;
    const mechInstanceId = mech
      ? (deployment?.mechInstanceId ?? `${team}-mech-${mech.id}`)
      : null;

    const pilotSpawnId = deployment?.pilotSpawnId ?? null;
    const mechSpawnId = deployment?.mechSpawnId ?? null;
    const pilotPos = pilotSpawnId ? atSpawn(pilotSpawnId) : null;
    const mechPos = mechSpawnId ? atSpawn(mechSpawnId) : null;

    if (!pilot && mech) {
      if (!mechPos) {
        console.warn("Skipping empty mech deployment with missing map spawn.", {
          mechSpawnId,
          deployment
        });
        continue;
      }

      const mechUnit = createMechInstance(mech, {
        ...mechRuntimeOverrides,
        instanceId: mechInstanceId,
        content,
        x: mechPos.x,
        y: mechPos.y,
        team,
        controlType,
        spawnId: mechSpawnId,
        pilotId: null,
        pilotName: null,
        embarkedPilotId: null,
        boardable: deployment?.boardable !== false,
        locked: Boolean(deployment?.locked ?? false)
      });

      units.push(mechUnit);
      continue;
    }

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
        ...pilotRuntimeOverrides,
        content,
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
      ...pilotControlStats,
      ...mechRuntimeOverrides,
      content,
      instanceId: mechInstanceId,
      x: mechPos.x,
      y: mechPos.y,
      team,
      controlType,
      pilot,
      spawnId: mechSpawnId,
      embarkedPilotId: startEmbarked ? pilotInstanceId : null,
      boardable: deployment?.boardable !== false,
      locked: Boolean(deployment?.locked ?? false)
    });

    const pilotUnit = createPilotInstance(pilot, {
      ...pilotRuntimeOverrides,
      content,
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
