// src/mission/missionTriggerRuntime.js
//
// Runtime side-effects for mission trigger results.
// Keeps script.js as boot/wiring while trigger loading/effects stay in mission modules.

import { normalizeMapDefinition } from "../map.js";
import { resolveOnUnitEnterZoneTriggers } from "./missionTriggers.js";

export function createMissionTriggerRuntime({
  state,
  gameController,
  loadMapDefinitionByPath,
  logDev = () => {}
}) {
  async function loadMissionMapById(mapId) {
    const cleanMapId = String(mapId ?? "").trim();
    if (!cleanMapId) return null;

    const missionDefinition = state?.mission?.definition ?? null;
    const packageMaps = missionDefinition?.packageDefinition?.maps;
    if (Array.isArray(packageMaps)) {
      const packageMap = packageMaps.find((map) => String(map?.id ?? "") === cleanMapId);
      if (packageMap) return normalizeMapDefinition(packageMap);
    }

    const missionMaps = Array.isArray(missionDefinition?.maps) ? missionDefinition.maps : [];
    const missionMapEntry = missionMaps.find((entry) => String(entry?.id ?? entry?.mapId ?? "") === cleanMapId);
    const path = missionMapEntry?.mapPath ?? missionMapEntry?.path ?? (missionMapEntry ? `./data/maps/${cleanMapId}.json` : null);
    if (path) return loadMapDefinitionByPath(path);

    const catalogMaps = Array.isArray(state?.content?.mapCatalog?.maps) ? state.content.mapCatalog.maps : [];
    const catalogEntry = catalogMaps.find((entry) => String(entry?.id ?? "") === cleanMapId);
    if (catalogEntry?.path) return loadMapDefinitionByPath(catalogEntry.path);

    return loadMapDefinitionByPath(`./data/maps/${cleanMapId}.json`).catch(() => null);
  }

  function handleUnitEnteredZone(unit) {
    const triggerResult = resolveOnUnitEnterZoneTriggers(state, unit);
    if (!triggerResult?.ok) return false;

    const results = Array.isArray(triggerResult.results) ? triggerResult.results : [triggerResult];
    logTriggerResults(results);

    const endMissionResult = results.find((result) => result?.preset === "end_mission");
    if (endMissionResult?.missionResult) {
      gameController.endMission(endMissionResult.missionResult);
      return true;
    }

    const loadMapResult = results.find((result) => result?.preset === "load_map");
    if (loadMapResult) {
      loadNextMapFromTrigger(loadMapResult);
      return true;
    }

    gameController.render();
    return true;
  }

  function logTriggerResults(results) {
    for (const result of results) {
      if (result?.preset === "change_unit_stat") {
        logDev(`Trigger ${result.triggerId} changed ${result.unitId ?? "unit"} ${result.stat} by ${result.value}.`);
      } else if (result?.preset === "complete_objective") {
        logDev(`Trigger ${result.triggerId} completed objective ${result.completeObjectiveId}.`);
      } else if (result?.preset === "set_flag") {
        logDev(`Trigger ${result.triggerId} set flag ${result.flagId} to ${result.value}.`);
      } else if (result?.preset === "give_item" || result?.preset === "remove_item") {
        logDev(`Trigger ${result.triggerId} ${result.preset} ${result.itemId} for ${result.unitId ?? "unit"}.`);
      } else if (result?.preset === "run_logic" && result.skipped) {
        logDev(`Trigger ${result.triggerId} skipped logic ${result.logicChainId}; conditions were not met.`);
      }
    }
  }

  function loadNextMapFromTrigger(loadMapResult) {
    logDev(`Trigger ${loadMapResult.triggerId} loading map ${loadMapResult.nextMapId}.`);

    loadMissionMapById(loadMapResult.nextMapId)
      .then((mapDefinition) => {
        if (!mapDefinition) {
          logDev(`Trigger ${loadMapResult.triggerId} failed: map ${loadMapResult.nextMapId} could not be loaded.`);
          gameController.render();
          return;
        }

        gameController.loadMapAndUnits(mapDefinition, state?.mission?.definition ?? null);
      })
      .catch((error) => {
        console.error(error);
        logDev(`Trigger ${loadMapResult.triggerId} failed while loading ${loadMapResult.nextMapId}.`);
        gameController.render();
      });
  }

  return {
    handleUnitEnteredZone
  };
}
