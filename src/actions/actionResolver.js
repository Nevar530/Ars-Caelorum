// src/actions/actionResolver.js

import { getActiveBody } from "../actors/actorResolver.js";
import { consumeCampaignLoadoutItem } from "../campaign/campaignState.js";
import { getUnitById } from "../mechs.js";

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

function getEffectAmount(target, effect = {}) {
  const amount = clampMinZero(effect.amount ?? 0);
  if (effect.type === "restore_core_percent_max") {
    return Math.ceil(Number(target.maxCore ?? target.core ?? 0) * (amount / 100));
  }
  if (effect.type === "restore_shield_percent_max") {
    return Math.ceil(Number(target.maxShield ?? target.shield ?? 0) * (amount / 100));
  }
  return amount;
}

function applyEffectToUnit(target, effect = {}) {
  const amount = getEffectAmount(target, effect);
  const before = {
    shield: Number(target.shield ?? 0),
    core: Number(target.core ?? 0),
    status: target.status ?? "operational"
  };

  switch (effect.type) {
    case "restore_core":
    case "restore_core_percent_max":
      target.core = Math.min(Number(target.maxCore ?? target.core ?? 0), Number(target.core ?? 0) + amount);
      break;
    case "self_core_damage":
      target.core = Math.max(0, Number(target.core ?? 0) - amount);
      break;
    case "restore_shield":
    case "restore_shield_percent_max":
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

function getSelectedTargetUnit(state, selected = {}) {
  const confirmed = state?.ui?.action?.lastConfirmed;
  const targetId = confirmed?.targetUnitId ?? null;
  if (targetId) return getUnitById(state.units, targetId);

  if (selected.targetType === "self" || selected.target === "self") {
    return getActiveBody(state);
  }

  return null;
}

export function getAbilityCost(selected) {
  return Math.max(0, Math.trunc(Number(selected?.cost ?? selected?.definition?.cost ?? 0) || 0));
}

export function canSpendAbilityPoints(unit, selected) {
  return Number(unit?.abilityPoints ?? 0) >= getAbilityCost(selected);
}

export function spendAbilityPoints(unit, selected) {
  const cost = getAbilityCost(selected);
  if (cost <= 0) return { ok: true, cost, before: Number(unit?.abilityPoints ?? 0), after: Number(unit?.abilityPoints ?? 0) };
  if (!unit || !canSpendAbilityPoints(unit, selected)) {
    return { ok: false, cost, before: Number(unit?.abilityPoints ?? 0), after: Number(unit?.abilityPoints ?? 0) };
  }
  const before = Number(unit.abilityPoints ?? 0);
  unit.abilityPoints = Math.max(0, before - cost);
  return { ok: true, cost, before, after: unit.abilityPoints };
}

function resolveContentAction(state, selected, options = {}) {
  const activeBody = getActiveBody(state);
  const effect = selected?.effect ?? selected?.definition?.effect ?? null;
  if (!activeBody || !selected || !effect) {
    return {
      ok: false,
      log: "Action could not resolve.",
      targetId: activeBody?.instanceId ?? null,
      changes: null
    };
  }

  const target = options.targetUnit ?? getSelectedTargetUnit(state, selected);
  if (!target) {
    return {
      ok: false,
      log: `${selected.label} needs a valid target.`,
      targetId: activeBody.instanceId,
      changes: null
    };
  }

  if (options.spendAp === true) {
    const spend = spendAbilityPoints(activeBody, selected);
    if (!spend.ok) {
      return {
        ok: false,
        log: `${selected.label} needs ${spend.cost} AP.`,
        targetId: target.instanceId,
        changes: null
      };
    }
  }

  const effectResult = applyEffectToUnit(target, effect);
  if (!effectResult.ok) {
    return {
      ok: false,
      log: `${selected.label} effect is not supported yet.`,
      targetId: target.instanceId,
      changes: null
    };
  }

  let campaignConsumption = null;
  if (options.consume === true) {
    const consumed =
      removeFirstMatchingItem(activeBody.inventory?.items, selected.id) ||
      removeFirstMatchingItem(activeBody.loadout?.items, selected.id) ||
      removeFirstMatchingItem(activeBody.items, selected.id);

    if (!consumed) {
      return {
        ok: false,
        log: `${selected.label} was not found in inventory.`,
        targetId: target.instanceId,
        changes: null
      };
    }

    campaignConsumption = consumeCampaignLoadoutItem(state?.campaign, activeBody, selected.id);
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
    log: `${activeBody.name} ${sourceLabel} ${selected.label} on ${target.name}${detailParts.length ? ` (${detailParts.join(", ")})` : ""}.`,
    targetId: target.instanceId,
    changes: {
      shieldDelta: deltaShield,
      coreDelta: deltaCore,
      statusBefore: effectResult.before.status,
      statusAfter: effectResult.after.status,
      consumedItemId: options.consume === true ? selected.id : null,
      campaignConsumption
    }
  };
}

export function resolveSelectedAbility(state, selectedAbility, options = {}) {
  return resolveContentAction(state, selectedAbility, { consume: false, spendAp: true, ...options });
}

export function resolveSelectedItem(state, selectedItem) {
  return resolveContentAction(state, selectedItem, { consume: true, spendAp: false });
}
