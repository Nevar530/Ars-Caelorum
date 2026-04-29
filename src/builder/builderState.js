// src/builder/builderState.js
//
// Mission Builder state container.
// This belongs to the new fullscreen WYSIWYG Mission Builder system.
// It intentionally does not reuse the old dev menu state shape.

export const BUILDER_TABS = [
  { id: "project", label: "Project" },
  { id: "map", label: "Map" },
  { id: "terrain", label: "Terrain" },
  { id: "structures", label: "Structures" },
  { id: "spawns", label: "Spawns" },
  { id: "units", label: "Units" },
  { id: "objectives", label: "Objectives" },
  { id: "triggers", label: "Triggers" },
  { id: "logic", label: "Logic" },
  { id: "dialogue", label: "Dialogue" },
  { id: "results", label: "Results" },
  { id: "validate", label: "Validate" },
  { id: "export", label: "Export" }
];

export function createBuilderState() {
  return {
    isOpen: false,
    activeTab: "project",
    workspaceMode: "landing",
    dirty: false,
    selected: {
      type: "builder-menu",
      id: "new-load",
      label: "New / Load"
    },
    hover: null,
    overlays: {
      structureEdges: false,
      rooms: false,
      spawns: true,
      deployment: true,
      tileHeights: false
    },
    status: "BUILDER MENU",
    runtimeMapId: null,
    validation: {
      errors: [],
      warnings: [],
      info: [
        {
          code: "BUILDER_READ_ONLY_FOUNDATION",
          message: "Mission Builder is in read-only foundation mode. Selection, overlays, and inspection are active only when a current loaded map is being inspected."
        }
      ]
    },
    log: [
      "Mission Builder menu ready.",
      "Choose New/Load from the builder menu, or open from an active map to inspect current runtime truth.",
      "Builder remains read-only until authoring adapters are deliberately unlocked."
    ]
  };
}

export function canUseCurrentRuntimeMap(appState) {
  return appState?.ui?.shell?.screen === "game" && Boolean(appState?.map);
}

export function prepareBuilderLaunch(builderState, appState) {
  if (!builderState) return;

  if (canUseCurrentRuntimeMap(appState)) {
    builderState.workspaceMode = "current-map";
    builderState.status = "READ ONLY";
    builderState.activeTab = "map";
    syncBuilderRuntimeMap(builderState, appState);
    pushBuilderLog(builderState, "Opened current loaded map in read-only builder workspace.");
    return;
  }

  builderState.workspaceMode = "landing";
  builderState.status = "BUILDER MENU";
  builderState.activeTab = "project";
  builderState.hover = null;
  builderState.selected = {
    type: "builder-menu",
    id: "new-load",
    label: "New / Load"
  };
  pushBuilderLog(builderState, "Opened builder New / Load menu.");
}

export function setBuilderWorkspaceMode(builderState, mode, appState = null) {
  if (!builderState) return;

  if (mode === "current-map" && canUseCurrentRuntimeMap(appState)) {
    builderState.workspaceMode = "current-map";
    builderState.status = "READ ONLY";
    builderState.activeTab = "map";
    syncBuilderRuntimeMap(builderState, appState);
    pushBuilderLog(builderState, "Using current loaded map for read-only inspection.");
    return;
  }

  builderState.workspaceMode = "landing";
  builderState.status = "BUILDER MENU";
  builderState.activeTab = "project";
  builderState.hover = null;
  builderState.selected = {
    type: "builder-menu",
    id: "new-load",
    label: "New / Load"
  };
}

export function isBuilderWorkspaceCurrentMap(builderState) {
  return builderState?.workspaceMode === "current-map";
}

export function getBuilderTab(tabId) {
  return BUILDER_TABS.find((tab) => tab.id === tabId) ?? BUILDER_TABS[0];
}

export function setBuilderOpen(builderState, isOpen) {
  builderState.isOpen = Boolean(isOpen);
}

export function setBuilderTab(builderState, tabId) {
  if (!BUILDER_TABS.some((tab) => tab.id === tabId)) return;
  builderState.activeTab = tabId;
}

export function pushBuilderLog(builderState, message) {
  if (!message) return;
  builderState.log = [String(message), ...(builderState.log ?? [])].slice(0, 12);
}

export function toggleBuilderOverlay(builderState, overlayId) {
  if (!builderState?.overlays || !(overlayId in builderState.overlays)) return false;
  builderState.overlays[overlayId] = !builderState.overlays[overlayId];
  return builderState.overlays[overlayId];
}

export function syncBuilderRuntimeMap(builderState, appState) {
  if (!builderState) return false;

  const map = appState?.map ?? null;
  const nextMapId = map?.id ?? "runtime-map";

  if (builderState.runtimeMapId === nextMapId) return false;

  builderState.runtimeMapId = nextMapId;
  builderState.hover = null;
  builderState.selected = {
    type: "map",
    id: nextMapId,
    label: map?.name ?? map?.id ?? "Runtime Map",
    mapId: nextMapId
  };

  pushBuilderLog(builderState, `Builder synced to map ${map?.name ?? nextMapId}.`);
  return true;
}

export function getBuilderSelectionSummary(builderState) {
  const selected = builderState?.selected;
  const hover = builderState?.hover;
  const selectedLabel = selected?.label ?? "New / Load";
  const hoverLabel = hover?.type === "tile" ? `Hover ${hover.x}, ${hover.y}` : "Hover none";
  const modeLabel = builderState?.workspaceMode === "current-map" ? "Current Map" : "Builder Menu";

  return `${modeLabel} · ${selectedLabel} · ${hoverLabel}`;
}
