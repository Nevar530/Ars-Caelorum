// src/builder/builderRuntimeTest.js
//
// Mission Builder runtime-test bridge.
// This module does not run a fake editor mission. It packages the current
// builder draft into the same map/mission definitions used by export, then
// hands those definitions to the real game runtime loader supplied by script.js.

import {
  buildMapDefinitionForExport,
  buildMissionDefinitionForExport
} from "./builderExport.js";

export function startBuilderRuntimeTest({ builderState, appState, launchMission } = {}) {
  const maps = getRuntimeTestMaps(builderState);
  if (!maps.length) {
    return {
      ok: false,
      message: "No builder-owned map is active. Create or load a builder map before using Test Mission."
    };
  }

  if (typeof launchMission !== "function") {
    return {
      ok: false,
      message: "Test Mission bridge is not wired. Runtime loader callback is missing."
    };
  }

  const mapDefinitions = maps.map(buildMapDefinitionForExport);
  const missionDraft = builderState.authoring.mission;
  const startMapId = missionDraft?.startMapId ?? builderState.authoring.activeMapId ?? mapDefinitions[0]?.id;
  const startMapDefinition = mapDefinitions.find((map) => map.id === startMapId) ?? mapDefinitions[0];
  const missionDefinition = buildMissionDefinitionForExport(startMapDefinition, missionDraft, mapDefinitions);

  const testPackage = {
    mapDefinition: cloneJson(startMapDefinition),
    missionDefinition: {
      ...cloneJson(missionDefinition),
      testSource: "builder-memory"
    },
    packageDefinition: {
      id: missionDefinition.id,
      startMapId: missionDefinition.startMapId ?? missionDefinition.mapId,
      maps: cloneJson(mapDefinitions)
    }
  };

  builderState.testSession = {
    active: true,
    source: "builder-memory",
    mapId: startMapDefinition.id,
    missionId: missionDefinition.id,
    startedAt: new Date().toISOString()
  };
  builderState.status = "TESTING";
  builderState.isOpen = false;

  launchMission(testPackage);

  return {
    ok: true,
    message: `Testing ${missionDefinition.id} from builder memory on start map ${startMapDefinition.id}.`
  };
}

function getRuntimeTestMaps(builderState) {
  const maps = Array.isArray(builderState?.authoring?.maps) ? builderState.authoring.maps : [];
  if (maps.length) {
    const active = builderState?.authoring?.map;
    if (active?.id) {
      const activeIndex = maps.findIndex((map) => map?.id === active.id);
      if (activeIndex >= 0) maps[activeIndex] = active;
    }
    return maps.filter(Boolean);
  }
  return builderState?.authoring?.map ? [builderState.authoring.map] : [];
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}
