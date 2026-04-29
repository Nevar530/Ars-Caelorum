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
    dirty: false,
    selected: {
      type: "map",
      id: "runtime-map",
      label: "Runtime Map"
    },
    hover: null,
    overlays: {
      structureEdges: false,
      rooms: false,
      spawns: true,
      deployment: true,
      tileHeights: false
    },
    status: "READY",
    validation: {
      errors: [],
      warnings: [],
      info: [
        {
          code: "BUILDER_WORKSPACE_CORE_V1",
          message: "Fullscreen Mission Builder shell has read-only WYSIWYG selection and inspection. Editing remains locked."
        }
      ]
    },
    log: [
      "Mission Builder workspace core ready.",
      "Click a tile to inspect runtime map truth.",
      "Shift-click selects the nearest tile edge.",
      "Overlay buttons are builder-only read layers."
    ]
  };
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
