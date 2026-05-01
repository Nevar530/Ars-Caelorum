// src/targeting/targetLegality.js
//
// Central attack-target legality helpers.
// This only answers direct target selection legality. Splash/effect resolution
// still resolves from the confirmed target tile and is intentionally separate.

const NON_TARGETABLE_STATUSES = new Set(["disabled", "destroyed"]);

export function isUnitDisabledForTargeting(unit) {
  if (!unit) return true;
  if (NON_TARGETABLE_STATUSES.has(unit.status)) return true;
  return Number(unit.core ?? 1) <= 0;
}

export function isUnitDirectlyTargetable(unit) {
  if (!unit) return false;
  return !isUnitDisabledForTargeting(unit);
}

export function isOccupiedTileBlockedForDirectTargeting(occupantEntry) {
  const unit = occupantEntry?.unit ?? null;
  if (!unit) return false;
  return !isUnitDirectlyTargetable(unit);
}
