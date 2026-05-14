// src/campaign/enemyScaling.js
//
// Engine-level enemy stat scaling foundation.
// Mission data may tune/disable it, but the default behavior is engine truth:
// enemy pilot stats are generated at mission start from the current campaign party.

const LEVEL_CAP = 20;
const TARGETING_CAP = 5;
const REACTION_CAP = 5;

const PLAYER_PC_WEIGHT = 1;
const PLAYER_CPU_ALLY_WEIGHT = 0.5;

const DEFAULT_SCALING = Object.freeze({
  enabled: true,
  mode: "partyAverage",
  levelOffset: 0,
  minLevel: 1,
  maxLevel: LEVEL_CAP,
  coreOffset: 0,
  abilityPointsOffset: 0,
  targetingOffset: 0,
  reactionOffset: 0
});

const ROLE_MODIFIERS = Object.freeze({
  grunt: { level: -1, core: 0, abilityPoints: -1, targeting: -1, reaction: -1 },
  balanced: { level: 0, core: 0, abilityPoints: 0, targeting: 0, reaction: 0 },
  ace: { level: 1, core: 0, abilityPoints: 0, targeting: 1, reaction: 1 },
  heavy: { level: 0, core: 1, abilityPoints: -1, targeting: 0, reaction: -1 },
  support: { level: 0, core: -1, abilityPoints: 1, targeting: 0, reaction: 1 },
  medic: { level: 0, core: -1, abilityPoints: 1, targeting: -1, reaction: 1 },
  magi: { level: 0, core: 0, abilityPoints: 2, targeting: -1, reaction: 0 },
  bot: { level: 0, core: 1, abilityPoints: 0, targeting: 0, reaction: 0 },
  boss: { level: 2, core: 2, abilityPoints: 1, targeting: 1, reaction: 1 }
});

const DIFFICULTY_MODIFIERS = Object.freeze({
  story: { core: -1, abilityPoints: 0, targeting: -1, reaction: -1 },
  normal: { core: 0, abilityPoints: 0, targeting: 0, reaction: 0 },
  hard: { core: 1, abilityPoints: 0, targeting: 1, reaction: 1 },
  brutal: { core: 2, abilityPoints: 1, targeting: 1, reaction: 1 }
});

export function buildEnemyScalingContext({ content, map, campaignState } = {}) {
  const pilotDefinitions = Array.isArray(content?.pilots) ? content.pilots : [];
  const deployments = Array.isArray(map?.startState?.deployments) ? map.startState.deployments : [];
  const partyStats = collectPartyStats({ pilotDefinitions, deployments, campaignState });
  const difficulty = normalizeDifficulty(campaignState?.difficulty);
  const forceBalance = calculateForceBalance(deployments);

  return {
    enabled: true,
    difficulty,
    difficultyModifier: DIFFICULTY_MODIFIERS[difficulty] ?? DIFFICULTY_MODIFIERS.normal,
    forceBalance,
    encounterModifier: calculateEncounterModifier(forceBalance),
    party: averageStats(partyStats)
  };
}

export function buildEnemyPilotRuntimeOverrides({
  pilotDefinition,
  deployment,
  scalingContext,
  mapScaling = null
} = {}) {
  const team = normalizeTeam(deployment?.team);
  if (team !== "enemy") return null;

  const scaling = normalizeScaling({
    ...DEFAULT_SCALING,
    ...(mapScaling && typeof mapScaling === "object" ? mapScaling : {}),
    ...(deployment?.enemyScaling && typeof deployment.enemyScaling === "object" ? deployment.enemyScaling : {})
  });

  if (scaling.enabled === false || scaling.mode === "fixed") return null;

  const party = scalingContext?.party ?? averageStats([]);
  const difficulty = scalingContext?.difficultyModifier ?? DIFFICULTY_MODIFIERS.normal;
  const encounter = scalingContext?.encounterModifier ?? calculateEncounterModifier(null);
  const forceBalance = scalingContext?.forceBalance ?? calculateForceBalance([]);
  const role = normalizeRole(deployment?.enemyRole ?? pilotDefinition?.enemyRole ?? pilotDefinition?.role);
  const roleModifier = ROLE_MODIFIERS[role] ?? ROLE_MODIFIERS.balanced;

  const level = clamp(
    Math.floor(party.level) + scaling.levelOffset + roleModifier.level,
    scaling.minLevel,
    scaling.maxLevel
  );

  const coreStat = Math.max(1, Math.floor(party.core) + scaling.coreOffset + roleModifier.core + difficulty.core + encounter.core);
  const abilityPoints = Math.max(0, Math.floor(party.abilityPoints) + scaling.abilityPointsOffset + roleModifier.abilityPoints + difficulty.abilityPoints + encounter.abilityPoints);
  const targeting = clamp(
    Math.floor(party.targeting) + scaling.targetingOffset + roleModifier.targeting + difficulty.targeting + encounter.targeting,
    0,
    TARGETING_CAP
  );
  const reaction = clamp(
    Math.floor(party.reaction) + scaling.reactionOffset + roleModifier.reaction + difficulty.reaction + encounter.reaction,
    0,
    REACTION_CAP
  );

  return {
    level,
    coreStat,
    abilityPoints,
    targeting,
    reaction,
    enemyScaling: {
      mode: scaling.mode,
      role,
      difficulty: scalingContext?.difficulty ?? "normal",
      partyAverageLevel: party.level,
      partyAverageCore: party.core,
      partyAverageAbilityPoints: party.abilityPoints,
      partyAverageTargeting: party.targeting,
      partyAverageReaction: party.reaction,
      playerPcUnits: forceBalance.playerPcUnits,
      playerCpuAllyUnits: forceBalance.playerCpuAllyUnits,
      effectivePlayerUnits: forceBalance.effectivePlayerUnits,
      enemyUnits: forceBalance.enemyUnits,
      enemyPressureRatio: forceBalance.enemyPressureRatio,
      encounterModifier: encounter
    }
  };
}

function collectPartyStats({ pilotDefinitions, deployments, campaignState }) {
  const byId = new Map((Array.isArray(pilotDefinitions) ? pilotDefinitions : [])
    .filter((pilot) => pilot?.id)
    .map((pilot) => [pilot.id, pilot]));

  const recruitedIds = Object.entries(campaignState?.pilots ?? {})
    .filter(([, progress]) => progress?.recruited !== false)
    .map(([pilotId]) => pilotId)
    .filter((pilotId) => byId.has(pilotId));

  const ids = recruitedIds.length
    ? recruitedIds
    : (Array.isArray(deployments) ? deployments : [])
      .filter((deployment) => normalizeTeam(deployment?.team) === "player")
      .map((deployment) => String(deployment?.pilotDefinitionId ?? "").trim())
      .filter((pilotId) => byId.has(pilotId));

  return [...new Set(ids)].map((pilotId) => {
    const definition = byId.get(pilotId);
    const progress = campaignState?.pilots?.[pilotId] ?? null;
    const bonuses = progress?.statBonuses && typeof progress.statBonuses === "object" ? progress.statBonuses : {};

    return {
      level: clamp(progress?.level ?? definition?.level ?? 1, 1, LEVEL_CAP),
      core: Math.max(1, numberStat(definition?.core, 1) + numberStat(bonuses.core, 0)),
      abilityPoints: Math.max(0, numberStat(definition?.abilityPoints, 0) + numberStat(bonuses.abilityPoints, 0)),
      targeting: clamp(numberStat(definition?.targeting, 0) + numberStat(bonuses.targeting, 0), 0, TARGETING_CAP),
      reaction: clamp(numberStat(definition?.reaction, 0) + numberStat(bonuses.reaction, 0), 0, REACTION_CAP)
    };
  });
}

function calculateForceBalance(deployments) {
  const list = Array.isArray(deployments) ? deployments : [];
  const counts = list.reduce((sum, deployment) => {
    if (!deployment?.pilotDefinitionId) return sum;
    const team = normalizeTeam(deployment?.team);
    const controlType = normalizeControlType(deployment?.controlType, team);

    if (team === "enemy") {
      sum.enemyUnits += 1;
      return sum;
    }

    if (team === "player" && controlType === "CPU") {
      sum.playerCpuAllyUnits += 1;
      sum.effectivePlayerUnits += PLAYER_CPU_ALLY_WEIGHT;
      return sum;
    }

    if (team === "player") {
      sum.playerPcUnits += 1;
      sum.effectivePlayerUnits += PLAYER_PC_WEIGHT;
    }

    return sum;
  }, {
    playerPcUnits: 0,
    playerCpuAllyUnits: 0,
    enemyUnits: 0,
    effectivePlayerUnits: 0
  });

  const safeEffectivePlayers = Math.max(1, counts.effectivePlayerUnits);
  const enemyPressureRatio = counts.enemyUnits / safeEffectivePlayers;

  return {
    ...counts,
    effectivePlayerUnits: safeEffectivePlayers,
    enemyPressureRatio
  };
}

function calculateEncounterModifier(forceBalance) {
  const ratio = Number(forceBalance?.enemyPressureRatio ?? 0) || 0;

  if (ratio >= 3) {
    return { core: -2, abilityPoints: -1, targeting: -2, reaction: -2 };
  }

  if (ratio >= 2) {
    return { core: -1, abilityPoints: 0, targeting: -1, reaction: -1 };
  }

  if (ratio >= 1.5) {
    return { core: 0, abilityPoints: 0, targeting: -1, reaction: -1 };
  }

  return { core: 0, abilityPoints: 0, targeting: 0, reaction: 0 };
}

function averageStats(entries) {
  const list = Array.isArray(entries) && entries.length ? entries : [{ level: 1, core: 2, abilityPoints: 1, targeting: 1, reaction: 1 }];
  const total = list.reduce((sum, entry) => ({
    level: sum.level + numberStat(entry.level, 1),
    core: sum.core + numberStat(entry.core, 2),
    abilityPoints: sum.abilityPoints + numberStat(entry.abilityPoints, 1),
    targeting: sum.targeting + numberStat(entry.targeting, 1),
    reaction: sum.reaction + numberStat(entry.reaction, 1)
  }), { level: 0, core: 0, abilityPoints: 0, targeting: 0, reaction: 0 });

  return {
    level: total.level / list.length,
    core: total.core / list.length,
    abilityPoints: total.abilityPoints / list.length,
    targeting: total.targeting / list.length,
    reaction: total.reaction / list.length
  };
}

function normalizeScaling(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    enabled: source.enabled !== false,
    mode: source.mode === "fixed" ? "fixed" : "partyAverage",
    levelOffset: numberStat(source.levelOffset, 0),
    minLevel: clamp(source.minLevel ?? 1, 1, LEVEL_CAP),
    maxLevel: clamp(source.maxLevel ?? LEVEL_CAP, 1, LEVEL_CAP),
    coreOffset: numberStat(source.coreOffset, 0),
    abilityPointsOffset: numberStat(source.abilityPointsOffset, 0),
    targetingOffset: numberStat(source.targetingOffset, 0),
    reactionOffset: numberStat(source.reactionOffset, 0)
  };
}

function normalizeDifficulty(value) {
  const key = String(value ?? "normal").trim().toLowerCase();
  return DIFFICULTY_MODIFIERS[key] ? key : "normal";
}

function normalizeRole(value) {
  const key = String(value ?? "balanced").trim().toLowerCase();
  return ROLE_MODIFIERS[key] ? key : "balanced";
}

function normalizeTeam(value) {
  if (value === "enemy") return "enemy";
  if (value === "neutral") return "neutral";
  return "player";
}

function normalizeControlType(value, team = "player") {
  if (value === "CPU") return "CPU";
  if (value === "PC") return "PC";
  return team === "player" ? "PC" : "CPU";
}

function numberStat(value, fallback = 0) {
  return Math.trunc(Number(value ?? fallback) || fallback);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.trunc(Number(value ?? min) || min)));
}
