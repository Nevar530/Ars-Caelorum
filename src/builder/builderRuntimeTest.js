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
  if (!builderState?.authoring?.map) {
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

  const mapDefinition = buildMapDefinitionForExport(builderState.authoring.map);
  const missionDefinition = buildMissionDefinitionForExport(mapDefinition, builderState.authoring.mission);

  const testPackage = {
    mapDefinition: cloneJson(mapDefinition),
    missionDefinition: {
      ...cloneJson(missionDefinition),
      testSource: "builder-memory"
    }
  };

  builderState.testSession = {
    active: true,
    source: "builder-memory",
    mapId: mapDefinition.id,
    missionId: missionDefinition.id,
    startedAt: new Date().toISOString()
  };
  builderState.status = "TESTING";
  builderState.isOpen = false;

  launchMission(testPackage);

  return {
    ok: true,
    message: `Testing ${missionDefinition.id} from builder memory through the real runtime loader.`
  };
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}
