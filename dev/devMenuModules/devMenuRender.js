import {
  formatSummaryValue,
  getUnitDisplayName,
  getUnitFootprintLabel,
  getUnitScale,
  safeUpper
} from "./devMenuUtils.js";

export function renderRuntimeStateHtml({ units, appState, activeUnit, selectedUnit, viewLabel, rotationValue }) {
  const activeText = activeUnit
    ? `${activeUnit.name} / ${activeUnit.pilotName ?? "No Pilot"}`
    : "None";

  const selectedText = selectedUnit
    ? `${selectedUnit.name} / ${selectedUnit.pilotName ?? "No Pilot"}`
    : "None";

  const focus = appState?.focus ?? {};
  const commandMenu = appState?.ui?.commandMenu ?? {};
  const actionProfile = appState?.ui?.action?.selectedAction ?? null;

  return `
    <div>Units: <strong>${units.length}</strong></div>
    <div>Mode: <strong>${safeUpper(appState?.ui?.mode ?? "idle")}</strong></div>
    <div>Active Unit: <strong>${activeText}</strong></div>
    <div>Selected Unit: <strong>${selectedText}</strong></div>
    <div>Focus: <strong>(${focus.x ?? 0},${focus.y ?? 0})</strong> [${focus.scale ?? "-"}]</div>
    <div>Selection Action: <strong>${appState?.selection?.action ?? "-"}</strong></div>
    <div>Action Profile: <strong>${actionProfile?.name ?? actionProfile?.id ?? "-"}</strong></div>
    <div>Command Menu: <strong>${commandMenu.open ? "OPEN" : "CLOSED"}</strong></div>
    <div>View: <strong>${viewLabel}</strong></div>
    <div>Rotation: <strong>${rotationValue}</strong></div>
  `;
}

export function renderRoundPhaseHtml(turn) {
  return `
    <div>Round: <strong>${turn.round}</strong></div>
    <div>Phase: <strong>${safeUpper(turn.phase)}</strong></div>
    <div>Combat Started: <strong>${turn.combatStarted ? "YES" : "NO"}</strong></div>
    <div>Move Index: <strong>${turn.moveIndex}</strong></div>
    <div>Action Index: <strong>${turn.actionIndex}</strong></div>
  `;
}

export function renderPhaseOrderHtml({ units, turn }) {
  if (!units.length) {
    return `<div style="opacity:0.7;">No units on map.</div>`;
  }

  const moveOrder = Array.isArray(turn.moveOrder) ? turn.moveOrder : [];
  const actionOrder = Array.isArray(turn.actionOrder) ? turn.actionOrder : [];

  const resolveRow = (label, order, currentIndex, isCurrentPhase) => {
    const orderedUnits = order
      .map((instanceId) => units.find((unit) => unit.instanceId === instanceId))
      .filter(Boolean);

    if (!orderedUnits.length) {
      return `
        <div style="margin-bottom:8px;">
          <div style="font-weight:700; margin-bottom:4px;">${label}</div>
          <div style="opacity:0.7;">No order built.</div>
        </div>
      `;
    }

    return `
      <div style="margin-bottom:8px;">
        <div style="font-weight:700; margin-bottom:4px;">
          ${label} ${isCurrentPhase ? "(current)" : ""}
        </div>
        ${orderedUnits.map((unit, index) => {
          const isActive = isCurrentPhase && index === currentIndex;
          const isComplete = isCurrentPhase && index < currentIndex;
          return `
            <div style="
              padding:4px 0;
              border-bottom:1px solid rgba(255,255,255,0.06);
              opacity:${isComplete ? "0.45" : isCurrentPhase ? "1" : "0.7"};
              color:${isActive ? "#f0b000" : "inherit"};
            ">
              ${index + 1}. ${unit.name} / ${unit.pilotName ?? "No Pilot"}
              <span style="opacity:0.7;">(Init ${unit.initiative ?? "-"})</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  };

  return `
    ${resolveRow("Move", moveOrder, turn.moveIndex, turn.phase === "move")}
    ${resolveRow("Action", actionOrder, turn.actionIndex, turn.phase === "action")}
  `;
}

export function renderUnitsHtml({ units, activeUnitId, selectedUnitId }) {
  if (!units.length) {
    return `<div style="opacity:0.7;">No units on map.</div>`;
  }

  return units.map((unit) => {
    const { frame, pilot } = getUnitDisplayName(unit);
    const scale = getUnitScale(unit);
    const footprint = getUnitFootprintLabel(unit);
    const isActive = unit.instanceId === activeUnitId;
    const isSelected = unit.instanceId === selectedUnitId;

    return `
      <div
        data-instance-id="${unit.instanceId}"
        style="
          padding:8px;
          margin-bottom:8px;
          border:1px solid ${isActive ? "rgba(240,176,0,0.7)" : "rgba(255,255,255,0.08)"};
          background:${isSelected ? "rgba(255,255,255,0.04)" : "transparent"};
        "
      >
        <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
          <div>
            <div><strong>${frame}</strong></div>
            <div style="opacity:0.78;">Pilot: ${pilot}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:${isActive ? "#f0b000" : "#9fb3c8"};">${isActive ? "ACTIVE" : isSelected ? "SELECTED" : scale.toUpperCase()}</div>
            <div style="opacity:0.65;">${footprint}</div>
          </div>
        </div>

        <div style="opacity:0.8;">Team ${unit.team ?? "-"} | Control ${unit.controlType ?? "-"} | Spawn ${unit.spawnId ?? "-"}</div>
        <div style="opacity:0.8;">Pos (${unit.x},${unit.y}) | Facing ${unit.facing ?? 0} | Scale ${scale}</div>
        <div style="opacity:0.8;">Shield ${unit.shield ?? unit.armor ?? "-"} | Core ${unit.core ?? unit.structure ?? "-"} | Move ${unit.move ?? "-"}</div>
        <div style="opacity:0.8;">Reaction ${unit.reaction ?? "-"} | Targeting ${unit.targeting ?? "-"}</div>
        <div style="opacity:0.8;">Init ${unit.initiative ?? "-"} | Status ${unit.status ?? "operational"}</div>
        <div style="opacity:0.8;">Moved ${unit.hasMoved ? "Y" : "N"} | Acted ${unit.hasActed ? "Y" : "N"} | Braced ${unit.isBraced ? "Y" : "N"}</div>

        <div style="margin-top:6px;">
          <button type="button" class="ac-dev-remove-unit-btn">Remove</button>
        </div>
      </div>
    `;
  }).join("");
}

export function renderMapStateHtml({
  viewLabel,
  rotationValue,
  mapWidth,
  mapHeight,
  focus,
  selectedUnit,
  selected,
  tile,
  summary
}) {
  return `
    <div>View: <strong>${viewLabel}</strong></div>
    <div>Rotation: <strong>${rotationValue}</strong></div>
    <div>Map Size: <strong>${mapWidth}x${mapHeight}</strong></div>
    <div>Focus Tile: <strong>(${focus.x ?? 0},${focus.y ?? 0})</strong></div>
    <div>Selected Unit: <strong>${selectedUnit ? `${selectedUnit.name} / ${selectedUnit.pilotName ?? "No Pilot"}` : "None"}</strong></div>
    <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:8px;">
      <div>Selected Tile: <strong>(${selected.x},${selected.y})</strong></div>
      <div>Base Height: <strong>${tile?.elevation ?? "-"}</strong></div>
      <div>Preset: <strong>${tile?.terrainTypeId ?? '-'}</strong></div>
      <div>Behavior: <strong>${tile?.movementClass ?? 'clear'}</strong></div>
      <div>Spawn: <strong>${tile?.spawnId ?? '-'}</strong></div>
      <div>Min Height: <strong>${formatSummaryValue(summary?.minElevation)}</strong></div>
      <div>Max Height: <strong>${formatSummaryValue(summary?.maxElevation)}</strong></div>
      <div>Foot Height: <strong>${formatSummaryValue(summary?.mechFootElevation)}</strong></div>
      <div>Detail Shape: <strong>${summary?.hasDetailShape ? "YES" : "NO"}</strong></div>
      <div>Mech Enterable: <strong>${summary?.mechEnterable ? "YES" : "NO"}</strong></div>
    </div>
  `;
}

export function renderLogHtml(entries) {
  if (!entries.length) {
    return `<div style="opacity:0.7;">No log entries.</div>`;
  }

  return entries.map((entry) => `
    <div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06); word-break:break-word;">
      ${entry}
    </div>
  `).join("");
}
