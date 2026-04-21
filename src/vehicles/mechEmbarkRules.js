// src/vehicles/mechEmbarkRules.js
//
// Rear-hatch embark / disembark rule helpers.
// Pass 6 adds rule truth only; no command exposure yet.

import { getTile, isTileMechEnterable } from "../map.js";
import { getUnitById } from "../mechs.js";
import { canUnitOccupyCells } from "../scale/occupancy.js";
import { getUnitOccupiedCells, isCellWithinBoard } from "../scale/scaleMath.js";

const STATUS_BLOCKED = new Set(["destroyed", "disabled"]);

function normalizeFacing(facing) {
  const value = Number(facing ?? 0);
  if (!Number.isFinite(value)) return 0;
  return ((value % 4) + 4) % 4;
}

function makePilotPreview(pilot, x, y) {
  return {
    ...pilot,
    x: Number(x),
    y: Number(y),
    unitType: "pilot",
    footprintWidth: 1,
    footprintHeight: 1,
    embarked: false
  };
}

function isTileStandableForPilot(state, x, y) {
  if (!isCellWithinBoard(x, y)) return false;

  const tile = getTile(state?.map, x, y);
  if (!tile) return false;
  if (!isTileMechEnterable(tile)) return false;

  return String(tile.movementClass ?? "clear") !== "impassable";
}

function canPilotStandAt(state, pilot, x, y, options = {}) {
  if (!pilot) return false;
  if (!isTileStandableForPilot(state, x, y)) return false;

  const previewPilot = makePilotPreview(pilot, x, y);

  return canUnitOccupyCells(state, previewPilot, {
    ignoreUnitId: options.ignoreUnitId ?? pilot.instanceId
  });
}

function getRearDirection(facing) {
  return (normalizeFacing(facing) + 2) % 4;
}

function getRearCenterTile(mech) {
  const x = Number(mech?.x ?? 0);
  const y = Number(mech?.y ?? 0);
  const rear = getRearDirection(mech?.facing ?? 0);

  switch (rear) {
    case 0:
      return { x, y: y - 2 };
    case 1:
      return { x: x + 2, y };
    case 2:
      return { x, y: y + 2 };
    case 3:
      return { x: x - 2, y };
    default:
      return { x, y: y + 2 };
  }
}

export function isUsableMech(mech) {
  if (!mech || mech.unitType !== "mech") return false;
  return !STATUS_BLOCKED.has(String(mech.status ?? "operational"));
}

export function isEmptyMech(mech) {
  return Boolean(mech && !mech.embarkedPilotId);
}

export function getRearHatchBoardingTile(mech) {
  return getRearCenterTile(mech);
}

export function getRearExitTiles(mech) {
  if (!mech) return [];

  const center = getRearCenterTile(mech);
  const rear = getRearDirection(mech.facing ?? 0);

  switch (rear) {
    case 0:
    case 2:
      return [
        { x: center.x - 1, y: center.y },
        { x: center.x, y: center.y },
        { x: center.x + 1, y: center.y }
      ];
    case 1:
    case 3:
      return [
        { x: center.x, y: center.y - 1 },
        { x: center.x, y: center.y },
        { x: center.x, y: center.y + 1 }
      ];
    default:
      return [center];
  }
}

export function isPilotOnRearHatchBoardingTile(pilot, mech) {
  if (!pilot || !mech) return false;
  const hatchTile = getRearHatchBoardingTile(mech);
  return Number(pilot.x) === hatchTile.x && Number(pilot.y) === hatchTile.y;
}

export function canPilotBoardMech(state, pilot, mech) {
  if (!pilot || pilot.unitType !== "pilot") return false;
  if (!mech || mech.unitType !== "mech") return false;
  if (pilot.embarked) return false;
  if (!isUsableMech(mech)) return false;
  if (!isEmptyMech(mech)) return false;
  if (!isPilotOnRearHatchBoardingTile(pilot, mech)) return false;

  return true;
}

export function getValidRearExitTiles(state, pilot, mech) {
  if (!pilot || pilot.unitType !== "pilot") return [];
  if (!mech || mech.unitType !== "mech") return [];
  if (!pilot.embarked) return [];
  if (pilot.currentMechId && pilot.currentMechId !== mech.instanceId) return [];
  if (!isUsableMech(mech)) return [];

  return getRearExitTiles(mech).filter((tile) =>
    canPilotStandAt(state, pilot, tile.x, tile.y)
  );
}

export function canEmbarkedPilotExitMech(state, pilot, mech) {
  return getValidRearExitTiles(state, pilot, mech).length > 0;
}

export function getMechForEmbarkedPilot(state, pilot) {
  if (!pilot?.currentMechId) return null;
  return getUnitById(state?.units ?? [], pilot.currentMechId);
}

export function getEmbarkedPilotForMech(state, mech) {
  if (!mech?.embarkedPilotId) return null;
  return getUnitById(state?.units ?? [], mech.embarkedPilotId);
}

export function getBoardingDebugSnapshot(state, pilot, mech) {
  return {
    pilotId: pilot?.instanceId ?? null,
    mechId: mech?.instanceId ?? null,
    rearHatchTile: getRearHatchBoardingTile(mech),
    rearExitTiles: getRearExitTiles(mech),
    validRearExitTiles: getValidRearExitTiles(state, pilot, mech),
    canBoard: canPilotBoardMech(state, pilot, mech),
    canExit: canEmbarkedPilotExitMech(state, pilot, mech)
  };
}
