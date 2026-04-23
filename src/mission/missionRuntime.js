import { createMechInstance, createPilotInstance } from "../mechs.js";
import { getMapSpawns } from "../map.js";

function getDefinitionById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => item?.id === id) ?? null;
}

function buildSpawnIndex(map) {
  const index = new Map();
  const spawns = getMapSpawns(map);

  for (const team of ["player", "enemy"]) {
    const entries = Array.isArray(spawns?.[team]) ? spawns[team] : [];
    entries.forEach((spawn, spawnIndex) => {
      if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) return;
      index.set(`${team}_${spawnIndex + 1}`, { x: Number(spawn.x), y: Number(spawn.y) });
    });
  }

  return index;
}

function getSpawnPosition(spawnIndex, entry) {
  const spawnId = entry?.spawnId ?? null;
  const spawn = spawnId ? spawnIndex.get(spawnId) : null;
  return {
    x: Number(entry?.x ?? spawn?.x ?? 0),
    y: Number(entry?.y ?? spawn?.y ?? 0),
    spawnId
  };
}

function normalizeTeam(value) {
  return value === "enemy" ? "enemy" : "player";
}

function normalizeControlType(value) {
  return value === "CPU" ? "CPU" : "PC";
}

export function instantiateMissionUnits(content, map, mission) {
  const missionUnits = Array.isArray(mission?.units) ? mission.units : [];
  if (!missionUnits.length) return [];

  const mechDefinitions = Array.isArray(content?.mechs) ? content.mechs : [];
  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];
  const spawnIndex = buildSpawnIndex(map);
  const units = [];

  for (const entry of missionUnits) {
    const team = normalizeTeam(entry?.team);
    const controlType = normalizeControlType(entry?.controlType);
    const pos = getSpawnPosition(spawnIndex, entry);

    if (entry?.unitType === "pilot") {
      const pilot = getDefinitionById(pilotDefinitions, entry?.definitionId);
      if (!pilot) continue;
      units.push(createPilotInstance(pilot, {
        instanceId: entry?.instanceId ?? `${team}-${pilot.id}`,
        x: pos.x,
        y: pos.y,
        team,
        controlType,
        spawnId: pos.spawnId
      }));
      continue;
    }

    if (entry?.unitType === "mech") {
      const mech = getDefinitionById(mechDefinitions, entry?.definitionId);
      if (!mech) continue;
      units.push(createMechInstance(mech, {
        instanceId: entry?.instanceId ?? `${team}-${mech.id}`,
        x: pos.x,
        y: pos.y,
        team,
        controlType,
        spawnId: pos.spawnId
      }));
      continue;
    }

    if (entry?.unitType === "combined") {
      const pilot = getDefinitionById(pilotDefinitions, entry?.pilotDefinitionId);
      const mech = getDefinitionById(mechDefinitions, entry?.mechDefinitionId);
      if (!pilot || !mech) continue;

      const pilotInstanceId = entry?.pilotInstanceId ?? `${team}-${pilot.id}`;
      const mechInstanceId = entry?.mechInstanceId ?? `${team}-${mech.id}`;
      const startEmbarked = Boolean(entry?.startEmbarked);

      units.push(createPilotInstance(pilot, {
        instanceId: pilotInstanceId,
        x: pos.x,
        y: pos.y,
        team,
        controlType,
        spawnId: pos.spawnId,
        currentMechId: startEmbarked ? mechInstanceId : null,
        embarked: startEmbarked,
        parentMechId: mechInstanceId
      }));

      units.push(createMechInstance(mech, {
        instanceId: mechInstanceId,
        x: pos.x,
        y: pos.y,
        team,
        controlType,
        spawnId: pos.spawnId,
        pilot,
        embarkedPilotId: startEmbarked ? pilotInstanceId : null
      }));
    }
  }

  return units;
}
