import { createPilotInstance, getUnitAt } from "../mechs.js";

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
      const definition = getPilotDefinition(state.content, entry.pilotDefinitionId);
      return {
        ...entry,
        definition,
        instanceId: entry.pilotInstanceId || `player-pilot-${index + 1}`,
        unitType: "pilot"
      };
    })
    .filter((entry) => entry.definition);

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

export function getDeployedPlayerUnits(state) {
  const rosterIds = new Set((state?.ui?.deployment?.roster ?? []).map((entry) => entry.instanceId));
  return (Array.isArray(state?.units) ? state.units : []).filter((unit) => rosterIds.has(unit?.instanceId));
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
  const placed = new Set(getDeployedPlayerUnits(state).map((unit) => unit.instanceId));
  return (state?.ui?.deployment?.roster ?? []).filter((entry) => !placed.has(entry.instanceId));
}

export function getDeploymentPlacedUnitAt(state, x, y) {
  const rosterIds = new Set((state?.ui?.deployment?.roster ?? []).map((entry) => entry.instanceId));
  const unit = getUnitAt(state.units, x, y, "pilot");
  return rosterIds.has(unit?.instanceId) ? unit : null;
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

  const pilotUnit = createPilotInstance(selected.definition, {
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

  state.units.push(pilotUnit);
  state.selection.unitId = pilotUnit.instanceId;
  state.focus.x = x;
  state.focus.y = y;
  state.focus.scale = "pilot";
  closeDeploymentList(state);
  state.ui.deployment.menuFocus = getDeploymentReady(state) ? "start" : "map";
  return true;
}

export function removeDeploymentPlacementAtFocus(state) {
  const unit = getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y);
  if (!unit) return false;
  state.units = state.units.filter((entry) => entry?.instanceId !== unit.instanceId);
  if (state.selection.unitId === unit.instanceId) {
    state.selection.unitId = null;
  }
  if (state?.ui?.deployment) {
    state.ui.deployment.menuFocus = "map";
  }
  return true;
}
