// src/actions/actionResolver.js

import { getActiveBody } from "../actors/actorResolver.js";

function clampMinZero(value) {
  return Math.max(0, Number(value ?? 0));
}

function updateUnitStatus(target) {
  if (target.core <= 0) {
    target.core = 0;
    target.status = "disabled";
    return "disabled";
  }

  if (target.core <= Math.floor(target.maxCore / 2)) {
    target.status = "damaged";
    return "damaged";
  }

  target.status = "operational";
  return "operational";
}

function removeFirstMatchingItem(collection, itemId) {
  if (!Array.isArray(collection)) return false;
  const index = collection.findIndex((entry) => entry === itemId);
  if (index < 0) return false;
  collection.splice(index, 1);
  return true;
}

function applyEffectToUnit(target, effect = {}) {
  const amount = clampMinZero(effect.amount ?? 0);
  const before = {
    shield: Number(target.shield ?? 0),
    core: Number(target.core ?? 0),
    status: target.status ?? "operational"
  };

  switch (effect.type) {
    case "restore_core":
      target.core = Math.min(Number(target.maxCore ?? target.core ?? 0), Number(target.core ?? 0) + amount);
      break;
    case "self_core_damage":
      target.core = Math.max(0, Number(target.core ?? 0) - amount);
      break;
    case "restore_shield":
      target.shield = Math.min(Number(target.maxShield ?? target.shield ?? 0), Number(target.shield ?? 0) + amount);
      break;
    case "self_shield_damage":
      target.shield = Math.max(0, Number(target.shield ?? 0) - amount);
      break;
    default:
      return {
        ok: false,
        reason: "unsupported_effect"
      };
  }

  target.shield = clampMinZero(target.shield);
  target.core = clampMinZero(target.core);
  const statusAfter = updateUnitStatus(target);

  return {
    ok: true,
    amount,
    before,
    after: {
      shield: target.shield,
      core: target.core,
      status: statusAfter
    }
  };
}

function resolveContentAction(state, selected, options = {}) {
  const activeBody = getActiveBody(state);
  if (!activeBody || !selected?.effect) {
    return {
      ok: false,
      log: "Action could not resolve.",
      targetId: activeBody?.instanceId ?? null,
      changes: null
    };
  }

  if ((selected.target ?? "self") !== "self") {
    return {
      ok: false,
      log: `${selected.label} target mode is not supported yet.`,
      targetId: activeBody.instanceId,
      changes: null
    };
  }

  const effectResult = applyEffectToUnit(activeBody, selected.effect);
  if (!effectResult.ok) {
    return {
      ok: false,
      log: `${selected.label} effect is not supported yet.`,
      targetId: activeBody.instanceId,
      changes: null
    };
  }

  if (options.consume === true) {
    const consumed =
      removeFirstMatchingItem(activeBody.inventory?.items, selected.id) ||
      removeFirstMatchingItem(activeBody.loadout?.items, selected.id) ||
      removeFirstMatchingItem(activeBody.items, selected.id);

    if (!consumed) {
      return {
        ok: false,
        log: `${selected.label} was not found in inventory.`,
        targetId: activeBody.instanceId,
        changes: null
      };
    }
  }

  const deltaShield = effectResult.after.shield - effectResult.before.shield;
  const deltaCore = effectResult.after.core - effectResult.before.core;
  const sourceLabel = options.consume === true ? "used" : "activated";

  const detailParts = [];
  if (deltaShield !== 0) {
    detailParts.push(`shield ${effectResult.before.shield} -> ${effectResult.after.shield}`);
  }
  if (deltaCore !== 0) {
    detailParts.push(`core ${effectResult.before.core} -> ${effectResult.after.core}`);
  }
  if (effectResult.before.status !== effectResult.after.status) {
    detailParts.push(`status ${effectResult.before.status} -> ${effectResult.after.status}`);
  }

  return {
    ok: true,
    log: `${activeBody.name} ${sourceLabel} ${selected.label}${detailParts.length ? ` (${detailParts.join(", ")})` : ""}.`,
    targetId: activeBody.instanceId,
    changes: {
      shieldDelta: deltaShield,
      coreDelta: deltaCore,
      statusBefore: effectResult.before.status,
      statusAfter: effectResult.after.status
    }
  };
}

export function resolveSelectedAbility(state, selectedAbility) {
  return resolveContentAction(state, selectedAbility, { consume: false });
}

export function resolveSelectedItem(state, selectedItem) {
  return resolveContentAction(state, selectedItem, { consume: true });
}
