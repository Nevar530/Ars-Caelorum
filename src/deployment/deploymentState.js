import { createMechInstance, createPilotInstance } from "../mechs.js";
import { getOccupantsAt, canUnitOccupyCells } from "../scale/occupancy.js";

function getStartState(map) {
  const startState = map?.startState;
  if (!startState || typeof startState !== "object") {
    return { deployments: [], deploymentCells: [], playerDeployment: null, startMode: "authored" };
  }

  return {
    ...startState,
    deployments: Array.isArray(startState.deployments) ? startState.deployments : [],
    deploymentCells: Array.isArray(startState.deploymentCells) ? startState.deploymentCells : []
  };
}

function getPilotDefinition(content, id) {
  const pilots = Array.isArray(content?.pilots) ? content.pilots : [];
  return pilots.find((pilot) => pilot?.id === id) ?? null;
}

function getMechDefinition(content, id) {
  const mechs = Array.isArray(content?.mechs) ? content.mechs : [];
  return mechs.find((mech) => mech?.id === id) ?? null;
}

function normalizeCell(cell = {}) {
  return {
    x: Number(cell?.x ?? 0),
    y: Number(cell?.y ?? 0),
    unitType: cell?.unitType === "mech" ? "mech" : "pilot",
    controlType: cell?.controlType === "CPU" ? "CPU" : "PC"
  };
}

function normalizeDeployment(entry = {}) {
  return {
    pilotDefinitionId: String(entry?.pilotDefinitionId ?? ""),
    pilotInstanceId: String(entry?.pilotInstanceId ?? ""),
    mechDefinitionId: String(entry?.mechDefinitionId ?? ""),
    mechInstanceId: String(entry?.mechInstanceId ?? ""),
    startEmbarked: Boolean(entry?.startEmbarked),
    team: entry?.team === "enemy" ? "enemy" : "player",
    controlType: entry?.controlType === "CPU" ? "CPU" : "PC"
  };
}

export function createDeploymentUiState() {
  return {
    active: false,
    unitType: "pilot",
    requiredCount: 0,
    cells: [],
    roster: [],
    listOpen: false,
    listIndex: 0,
    selectedCellKey: null,
    menuFocus: "map"
  };
}

export function resetDeploymentState(state) {
  state.ui.deployment = createDeploymentUiState();
}

export function initializeDeploymentState(state) {
  const startState = getStartState(state.map);
  if (startState.startMode !== "deployment") {
    resetDeploymentState(state);
    return state.ui.deployment;
  }

  const playerDeployment = startState.playerDeployment ?? {};
  const unitType = playerDeployment?.unitType === "mech" ? "mech" : "pilot";
  const requiredCount = Math.max(0, Number(playerDeployment?.requiredCount ?? 0));
  const cells = startState.deploymentCells
    .map(normalizeCell)
    .filter((cell) => cell.controlType === "PC" && cell.unitType === unitType);
  const roster = startState.deployments
    .map(normalizeDeployment)
    .filter((entry) => entry.controlType === "PC" && entry.team === "player")
    .map((entry, index) => {
      const pilotDefinition = getPilotDefinition(state.content, entry.pilotDefinitionId);
      const mechDefinition = entry.mechDefinitionId
        ? getMechDefinition(state.content, entry.mechDefinitionId)
        : null;

      if (unitType === "mech") {
        if (!pilotDefinition || !mechDefinition) return null;

        const pilotInstanceId = entry.pilotInstanceId || `player-pilot-${index + 1}`;
        const mechInstanceId = entry.mechInstanceId || `player-mech-${index + 1}`;

        return {
          ...entry,
          definition: mechDefinition,
          pilotDefinition,
          mechDefinition,
          instanceId: pilotInstanceId,
          pilotInstanceId,
          mechInstanceId,
          linkedInstanceIds: [pilotInstanceId, mechInstanceId],
          displayName: `${mechDefinition.name} / ${pilotDefinition.name}`,
          unitType: "mech"
        };
      }

      if (!pilotDefinition) return null;

      const pilotInstanceId = entry.pilotInstanceId || `player-pilot-${index + 1}`;
      return {
        ...entry,
        definition: pilotDefinition,
        pilotDefinition,
        instanceId: pilotInstanceId,
        pilotInstanceId,
        mechInstanceId: null,
        linkedInstanceIds: [pilotInstanceId],
        displayName: pilotDefinition.name,
        unitType: "pilot"
      };
    })
    .filter(Boolean);

  state.ui.deployment = {
    active: Boolean(cells.length && requiredCount > 0 && roster.length),
    unitType,
    requiredCount,
    cells,
    roster,
    listOpen: false,
    listIndex: 0,
    selectedCellKey: null,
    menuFocus: "map"
  };

  if (state.ui.deployment.active) {
    const firstCell = cells[0];
    state.focus.x = firstCell.x;
    state.focus.y = firstCell.y;
    state.focus.scale = unitType;
  }

  return state.ui.deployment;
}

export function isDeploymentActive(state) {
  return Boolean(state?.ui?.deployment?.active) && !state?.turn?.combatStarted;
}

export function getDeploymentCells(state) {
  return Array.isArray(state?.ui?.deployment?.cells) ? state.ui.deployment.cells : [];
}

export function isDeploymentCell(state, x, y) {
  return getDeploymentCells(state).some((cell) => cell.x === x && cell.y === y);
}

function isRosterEntryPlaced(state, entry) {
  const linkedIds = Array.isArray(entry?.linkedInstanceIds) ? entry.linkedInstanceIds : [entry?.instanceId];
  return linkedIds.some((instanceId) => (state?.units ?? []).some((unit) => unit?.instanceId === instanceId));
}

export function getDeployedPlayerUnits(state) {
  return (state?.ui?.deployment?.roster ?? []).filter((entry) => isRosterEntryPlaced(state, entry));
}

export function getDeploymentPlacementCount(state) {
  return getDeployedPlayerUnits(state).length;
}

export function getDeploymentReady(state) {
  if (!isDeploymentActive(state)) return false;
  return getDeploymentPlacementCount(state) >= Math.max(0, Number(state.ui.deployment.requiredCount ?? 0));
}

export function isDeploymentMenuFocused(state) {
  return state?.ui?.deployment?.menuFocus === "start";
}

export function getDeploymentAvailableRoster(state) {
  return (state?.ui?.deployment?.roster ?? []).filter((entry) => !isRosterEntryPlaced(state, entry));
}

export function getDeploymentPlacedUnitAt(state, x, y) {
  const roster = state?.ui?.deployment?.roster ?? [];
  const occupants = getOccupantsAt(state, x, y);

  for (const occupant of occupants) {
    const unitId = occupant?.unit?.instanceId;
    if (!unitId) continue;

    const entry = roster.find((candidate) => (candidate?.linkedInstanceIds ?? []).includes(unitId));
    if (!entry) continue;

    return occupant.unit;
  }

  return null;
}

export function openDeploymentListAtFocus(state) {
  if (!isDeploymentActive(state)) return false;
  if (!isDeploymentCell(state, state.focus.x, state.focus.y)) return false;
  if (getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y)) return false;
  const available = getDeploymentAvailableRoster(state);
  if (!available.length) return false;

  state.ui.deployment.listOpen = true;
  state.ui.deployment.listIndex = Math.max(0, Math.min(state.ui.deployment.listIndex ?? 0, available.length - 1));
  state.ui.deployment.selectedCellKey = `${state.focus.x},${state.focus.y}`;
  state.ui.deployment.menuFocus = "map";
  return true;
}

export function closeDeploymentList(state) {
  if (!state?.ui?.deployment) return;
  state.ui.deployment.listOpen = false;
  state.ui.deployment.listIndex = 0;
  state.ui.deployment.selectedCellKey = null;
}

export function moveDeploymentListSelection(state, delta) {
  const available = getDeploymentAvailableRoster(state);
  if (!state?.ui?.deployment?.listOpen || !available.length) return false;
  const count = available.length;
  const current = Number.isFinite(Number(state.ui.deployment.listIndex)) ? Number(state.ui.deployment.listIndex) : 0;
  state.ui.deployment.listIndex = (current + delta + count) % count;
  return true;
}

export function confirmDeploymentPlacement(state) {
  if (!state?.ui?.deployment?.listOpen) return false;
  const available = getDeploymentAvailableRoster(state);
  if (!available.length) {
    closeDeploymentList(state);
    return false;
  }

  const selected = available[Math.max(0, Math.min(state.ui.deployment.listIndex ?? 0, available.length - 1))];
  if (!selected?.definition) return false;

  const [rawX, rawY] = String(state.ui.deployment.selectedCellKey ?? "").split(",");
  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !isDeploymentCell(state, x, y)) return false;
  if (getDeploymentPlacedUnitAt(state, x, y)) return false;

  if (selected.unitType === "mech") {
    const mechUnit = createMechInstance(selected.mechDefinition, {
      instanceId: selected.mechInstanceId,
      x,
      y,
      team: "player",
      controlType: "PC",
      pilot: selected.pilotDefinition,
      spawnId: null,
      embarkedPilotId: selected.pilotInstanceId
    });

    if (!canUnitOccupyCells(state, mechUnit)) {
      return false;
    }

    const pilotUnit = createPilotInstance(selected.pilotDefinition, {
      instanceId: selected.pilotInstanceId,
      x,
      y,
      team: "player",
      controlType: "PC",
      spawnId: null,
      currentMechId: selected.mechInstanceId,
      embarked: true,
      parentMechId: selected.mechInstanceId
    });

    state.units.push(pilotUnit, mechUnit);
    state.selection.unitId = pilotUnit.instanceId;
    state.focus.x = x;
    state.focus.y = y;
    state.focus.scale = "mech";
  } else {
    const pilotUnit = createPilotInstance(selected.pilotDefinition, {
      instanceId: selected.instanceId,
      x,
      y,
      team: "player",
      controlType: "PC",
      spawnId: null,
      currentMechId: null,
      embarked: false,
      parentMechId: null
    });

    if (!canUnitOccupyCells(state, pilotUnit)) {
      return false;
    }

    state.units.push(pilotUnit);
    state.selection.unitId = pilotUnit.instanceId;
    state.focus.x = x;
    state.focus.y = y;
    state.focus.scale = "pilot";
  }

  closeDeploymentList(state);
  state.ui.deployment.menuFocus = getDeploymentReady(state) ? "start" : "map";
  return true;
}

export function removeDeploymentPlacementAtFocus(state) {
  const unit = getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y);
  if (!unit) return false;

  const rosterEntry = (state?.ui?.deployment?.roster ?? []).find((entry) =>
    (entry?.linkedInstanceIds ?? []).includes(unit.instanceId)
  );
  const removeIds = new Set(rosterEntry?.linkedInstanceIds ?? [unit.instanceId]);

  state.units = state.units.filter((entry) => !removeIds.has(entry?.instanceId));
  if (removeIds.has(state.selection.unitId)) {
    state.selection.unitId = null;
  }
  if (state?.ui?.deployment) {
    state.ui.deployment.menuFocus = "map";
  }
  return true;
}
