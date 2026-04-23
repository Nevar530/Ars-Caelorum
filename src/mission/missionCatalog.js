import { normalizeMapDefinition } from "../map.js";

export function getMissionCatalog(content) {
  const missions = Array.isArray(content?.missionCatalog?.missions)
    ? content.missionCatalog.missions
    : [];

  return {
    defaultMissionId: content?.missionCatalog?.defaultMissionId ?? missions[0]?.id ?? null,
    missions
  };
}

export function getMissionDefinitionById(content, missionId) {
  const catalog = getMissionCatalog(content);
  return catalog.missions.find((mission) => mission?.id === missionId) ?? null;
}

export function getDefaultMissionDefinition(content) {
  const catalog = getMissionCatalog(content);
  return getMissionDefinitionById(content, catalog.defaultMissionId) ?? catalog.missions[0] ?? null;
}

export function getMapCatalogEntryById(content, mapId) {
  const maps = Array.isArray(content?.mapCatalog?.maps) ? content.mapCatalog.maps : [];
  return maps.find((entry) => entry?.id === mapId) ?? null;
}

export function getMissionMapDefinition(content, mission) {
  const mapId = mission?.mapId ?? null;
  if (!mapId) return content?.defaultMap ? normalizeMapDefinition(content.defaultMap) : null;

  const entry = getMapCatalogEntryById(content, mapId);
  if (!entry?.definition) return content?.defaultMap ? normalizeMapDefinition(content.defaultMap) : null;
  return normalizeMapDefinition(entry.definition);
}
