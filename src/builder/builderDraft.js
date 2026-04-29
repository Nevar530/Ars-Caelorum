// src/builder/builderDraft.js
//
// Builder-owned draft package helpers.
// The Mission Builder makes the car to track spec; it does not modify the track.
// Draft data is cloned from runtime truth so future authoring tools can mutate the
// builder draft without touching the live engine state.

function cloneData(value) {
  if (value == null) return null;

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

export function createBuilderDraftFromRuntime(appState) {
  const map = appState?.map ?? null;
  const missionDefinition = appState?.mission?.definition ?? null;
  const mapId = map?.id ?? "runtime-map";
  const missionId = missionDefinition?.id ?? null;

  return {
    source: "runtime-clone",
    sourceMapId: mapId,
    sourceMissionId: missionId,
    packageId: missionId ? `${missionId}_package` : `${mapId}_package`,
    map: cloneData(map),
    mission: cloneData(missionDefinition),
    createdAt: new Date().toISOString(),
    dirty: false,
    mutationLocked: true,
    notes: [
      "Builder draft cloned from current runtime truth.",
      "Mutation is still locked; this pass proves draft isolation only."
    ]
  };
}

export function ensureBuilderDraft(builderState, appState) {
  if (!builderState) return false;

  const mapId = appState?.map?.id ?? "runtime-map";
  const missionId = appState?.mission?.definition?.id ?? null;
  const draft = builderState.draft;

  if (draft?.sourceMapId === mapId && draft?.sourceMissionId === missionId && draft?.map) {
    return false;
  }

  builderState.draft = createBuilderDraftFromRuntime(appState);
  builderState.dirty = false;
  return true;
}

export function getBuilderDraftMap(builderState) {
  return builderState?.draft?.map ?? null;
}

export function getBuilderDraftMission(builderState) {
  return builderState?.draft?.mission ?? null;
}

export function getBuilderDraftSummary(builderState) {
  const draft = builderState?.draft ?? null;
  const map = draft?.map ?? null;
  const mission = draft?.mission ?? null;

  return {
    packageId: draft?.packageId ?? "no-package",
    sourceMapId: draft?.sourceMapId ?? null,
    sourceMissionId: draft?.sourceMissionId ?? null,
    mapName: map?.name ?? map?.id ?? "No draft map",
    missionName: mission?.name ?? mission?.id ?? "No draft mission",
    dirty: Boolean(draft?.dirty),
    mutationLocked: draft?.mutationLocked !== false,
    createdAt: draft?.createdAt ?? null
  };
}

export function createBuilderPreviewAppState(appState, builderState) {
  const draftMap = getBuilderDraftMap(builderState);
  const draftMission = getBuilderDraftMission(builderState);

  if (!draftMap) return appState;

  return {
    ...appState,
    map: draftMap,
    mission: {
      ...(appState?.mission ?? {}),
      definition: draftMission ?? appState?.mission?.definition ?? null
    }
  };
}
