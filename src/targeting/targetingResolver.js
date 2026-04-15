// src/targeting/targetingResolver.js

import { getUnitById } from "../mechs.js";
import { getLineOfSightResult } from "../los.js";
import { getFireArcTiles, toTileKeySet, DEFAULT_FIRE_ARC_RANGE } from "./fireArc.js";
import {
  getWeaponCandidateTiles,
  getEffectTilesForTarget,
  manhattanDistance,
  DEFAULT_DIRECT_MAX_RANGE,
  DEFAULT_MISSILE_MAX_RANGE
} from "./rangeRules.js";
import { evaluateMissileTargetWithSpotter } from "./missileTargeting.js";

function getActiveUnit(state) {
  return getUnitById(state.units ?? state.mechs, state.turn.activeUnitId ?? state.turn.activeMechId);
}

export function normalizeWeaponToActionProfile(weapon) {
  const type = weapon.type ?? "direct";
  const scale = weapon.scale ?? "mech";
  const range = weapon.range ?? { min: 1, max: 1 };

  if (type === "melee") {
    return {
      id: weapon.id,
      name: weapon.name,
      scale,
      weaponType: "melee",
      fireArc: weapon.fireArc ?? { kind: "fan", range: DEFAULT_FIRE_ARC_RANGE },
      targeting: {
        kind: "cardinal_adjacent",
        minRange: 1,
        maxRange: 1
      },
      effect: weapon.effect ?? { kind: "single" },
      losType: "direct",
      damage: weapon.damage ?? 0
    };
  }

  if (type === "missile") {
    return {
      id: weapon.id,
      name: weapon.name,
      scale,
      weaponType: "missile",
      fireArc: weapon.fireArc ?? { kind: "fan", range: DEFAULT_FIRE_ARC_RANGE },
      targeting: {
        kind: "fire_arc_tile",
        minRange: range.min ?? 1,
        maxRange: range.max ?? DEFAULT_MISSILE_MAX_RANGE
      },
      effect: weapon.effect ?? { kind: "circle", radius: 3 },
      losType: weapon.losType ?? "missile",
      damage: weapon.damage ?? 0,
      splashDamage: weapon.splashDamage ?? {}
    };
  }

  return {
    id: weapon.id,
    name: weapon.name,
    scale,
    weaponType: "direct",
    fireArc: weapon.fireArc ?? { kind: "fan", range: DEFAULT_FIRE_ARC_RANGE },
    targeting: {
      kind: "direct_tile",
      minRange: range.min ?? 1,
      maxRange: range.max ?? DEFAULT_DIRECT_MAX_RANGE
    },
    effect: weapon.effect ?? { kind: "single" },
    losType: weapon.losType ?? "direct",
    damage: weapon.damage ?? 0
  };
}

export function snapFocusToFirstValidTarget(state) {
  const first = state.ui.action.validTargetTiles[0];
  if (!first) return;

  state.focus.x = first.x;
  state.focus.y = first.y;

  const activeUnit = getActiveUnit(state);
  const profile = state.ui.action.selectedAction;

  state.ui.action.effectTiles = getEffectTilesForTarget(
    activeMech,
    profile,
    first.x,
    first.y
  );
}

export function updateActionTargetPreview(state) {
  const activeUnit = getActiveUnit(state);
  const profile = state.ui.action.selectedAction;

  if (!activeMech || !profile) {
    state.ui.action.fireArcTiles = [];
    state.ui.action.evaluatedTargetTiles = [];
    state.ui.action.validTargetTiles = [];
    state.ui.action.effectTiles = [];
    return;
  }

  const fireArcRange = profile.fireArc?.range ?? DEFAULT_FIRE_ARC_RANGE;
  const fireArcTiles = getFireArcTiles(activeMech, fireArcRange);
  const candidateTiles = getWeaponCandidateTiles(state, activeMech, profile);
  const arcFilteredTiles = applyFireArcFilter(profile, fireArcTiles, candidateTiles);
  const evaluatedTiles = evaluateLosForTargets(state, activeMech, profile, arcFilteredTiles);
  const validTiles = evaluatedTiles.filter((tile) => tile.visible === true);

  state.ui.action.fireArcTiles = fireArcTiles;
  state.ui.action.evaluatedTargetTiles = evaluatedTiles;
  state.ui.action.validTargetTiles = validTiles;

  const focusedTile = evaluatedTiles.find(
    (tile) => tile.x === state.focus.x && tile.y === state.focus.y
  );

  if (focusedTile) {
    state.ui.action.effectTiles = getEffectTilesForTarget(
      activeMech,
      profile,
      focusedTile.x,
      focusedTile.y
    );
  } else {
    state.ui.action.effectTiles = [];
  }
}

export function applyFireArcFilter(profile, fireArcTiles, candidateTiles) {
  const targetingKind = profile.targeting?.kind;

  if (targetingKind === "cardinal_adjacent") {
    return candidateTiles;
  }

  const fireArcSet = toTileKeySet(fireArcTiles);

  return candidateTiles.filter((tile) =>
    fireArcSet.has(`${tile.x},${tile.y}`)
  );
}

export function evaluateLosForTargets(state, mech, profile, candidateTiles) {
  const targetingKind = profile.targeting?.kind;
  const isMissile = profile.weaponType === "missile";

  if (targetingKind === "cardinal_adjacent") {
    return candidateTiles.map((tile) => ({
      ...tile,
      visible: true,
      cover: "none",
      los: null,
      distance: manhattanDistance(mech.x, mech.y, tile.x, tile.y)
    }));
  }

  return candidateTiles.map((tile) => {
    const distance = manhattanDistance(mech.x, mech.y, tile.x, tile.y);

    if (isMissile) {
      const missileTarget = evaluateMissileTargetWithSpotter(
        state,
        mech,
        profile,
        tile.x,
        tile.y
      );

      return {
        ...tile,
        visible: missileTarget.visible,
        cover: "none",
        los: missileTarget.los,
        distance,
        missileSource: missileTarget.missileSource,
        spotterId: missileTarget.spotterId,
        spotterPosition: missileTarget.spotterPosition,
        validationReason: missileTarget.validationReason
      };
    }

    const los = getLineOfSightResult(
      state,
      mech.x,
      mech.y,
      tile.x,
      tile.y,
      {
        attackerScale: mech.scale ?? "mech",
        targetScale: tile.targetScale ?? profile.scale ?? "mech"
      }
    );

    return {
      ...tile,
      visible: los.visible === true,
      cover: los.cover,
      los,
      distance
    };
  });
}
