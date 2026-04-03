// modules/data/dataStore.js
//
// Central content registry for Ars Caelorum.
// Purpose:
// - Load JSON content once
// - Index by ID
// - Provide clean getters for the rest of the game
// - Keep dev tools and combat systems from reaching into raw JSON directly
//
// This module is intentionally logic-light.
// It does NOT own rendering, combat math, movement rules, or UI.
// It only loads and serves data.

const DEFAULT_PATHS = {
  pilots: "../../data/pilots.json",
  mechs: "../../data/mechs.json",
  weapons: "../../data/weapons.json",
  spawnPoints: "../../data/spawnPoints.json"
};

const EMPTY_ARRAY = Object.freeze([]);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizePilot(raw = {}) {
  return {
    id: normalizeString(raw.id),
    name: normalizeString(raw.name, "Unknown Pilot"),
    role: normalizeString(raw.role, "unknown"),
    core: normalizeNumber(raw.core, 0),
    shield: normalizeNumber(raw.shield, 0),
    aether: normalizeNumber(raw.aether, 0),
    move: normalizeNumber(raw.move, 0),
    reaction: normalizeNumber(raw.reaction, 0),
    targeting: normalizeNumber(raw.targeting, 0),
    abilityPoints: normalizeNumber(raw.abilityPoints, 0),
    tabs: toArray(raw.tabs),
    image: raw.image ?? null
  };
}

function normalizeMech(raw = {}) {
  return {
    id: normalizeString(raw.id),
    name: normalizeString(raw.name, "Unknown Mech"),
    variant: normalizeString(raw.variant, ""),
    class: normalizeString(raw.class, "unknown"),
    role: normalizeString(raw.role, "unknown"),
    core: normalizeNumber(raw.core, 0),
    shield: normalizeNumber(raw.shield, 0),
    aether: normalizeNumber(raw.aether, 0),
    move: normalizeNumber(raw.move, 0),
    weapons: toArray(raw.weapons),
    abilities: toArray(raw.abilities),
    tubes: toArray(raw.tubes),
    defaultFacing: normalizeString(raw.defaultFacing, "S"),
    image: raw.image ?? null
  };
}

function normalizeWeapon(raw = {}) {
  return {
    id: normalizeString(raw.id),
    name: normalizeString(raw.name, "Unknown Weapon"),
    category: normalizeString(raw.category, "weapon"),
    type: normalizeString(raw.type, "unknown"),
    shape: normalizeString(raw.shape, "single"),
    range: {
      min: normalizeNumber(raw.range?.min, 0),
      max: normalizeNumber(raw.range?.max, 0)
    },
    losType: normalizeString(raw.losType, "direct"),
    fireArc: normalizeString(raw.fireArc, "forward"),
    coneWidth: normalizeNumber(raw.coneWidth, 0),
    aoeRadius: normalizeNumber(raw.aoeRadius, 0),
    damage: normalizeNumber(raw.damage, 0),
    notes: normalizeString(raw.notes, "")
  };
}

function normalizeSpawnPoint(raw = {}) {
  return {
    id: normalizeString(raw.id),
    label: normalizeString(raw.label, raw.id || "Spawn"),
    x: normalizeNumber(raw.x, 0),
    y: normalizeNumber(raw.y, 0)
  };
}

function buildIndex(items, kind) {
  const map = new Map();

  for (const item of items) {
    if (!item.id) {
      console.warn(`[dataStore] Skipping ${kind} entry with missing id.`, item);
      continue;
    }

    if (map.has(item.id)) {
      console.warn(`[dataStore] Duplicate ${kind} id detected: "${item.id}". Later entry ignored.`);
      continue;
    }

    map.set(item.id, item);
  }

  return map;
}

async function loadJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);

  const response = await fetch(url.href, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`[dataStore] Failed to load "${relativePath}" (${response.status} ${response.statusText})`);
  }

  return response.json();
}

class DataStore {
  constructor() {
    this._initialized = false;
    this._paths = { ...DEFAULT_PATHS };

    this._pilots = [];
    this._mechs = [];
    this._weapons = [];
    this._spawnPoints = [];

    this._pilotIndex = new Map();
    this._mechIndex = new Map();
    this._weaponIndex = new Map();
    this._spawnIndex = new Map();
  }

  async init(customPaths = {}) {
    if (this._initialized) {
      return this;
    }

    this._paths = {
      ...DEFAULT_PATHS,
      ...customPaths
    };

    const [pilotJson, mechJson, weaponJson, spawnJson] = await Promise.all([
      loadJson(this._paths.pilots),
      loadJson(this._paths.mechs),
      loadJson(this._paths.weapons),
      loadJson(this._paths.spawnPoints)
    ]);

    this._pilots = toArray(pilotJson).map(normalizePilot);
    this._mechs = toArray(mechJson).map(normalizeMech);
    this._weapons = toArray(weaponJson).map(normalizeWeapon);
    this._spawnPoints = toArray(spawnJson).map(normalizeSpawnPoint);

    this._pilotIndex = buildIndex(this._pilots, "pilot");
    this._mechIndex = buildIndex(this._mechs, "mech");
    this._weaponIndex = buildIndex(this._weapons, "weapon");
    this._spawnIndex = buildIndex(this._spawnPoints, "spawn point");

    this._initialized = true;

    console.info("[dataStore] Initialized.", {
      pilots: this._pilots.length,
      mechs: this._mechs.length,
      weapons: this._weapons.length,
      spawnPoints: this._spawnPoints.length
    });

    return this;
  }

  isInitialized() {
    return this._initialized;
  }

  reset() {
    this._initialized = false;

    this._pilots = [];
    this._mechs = [];
    this._weapons = [];
    this._spawnPoints = [];

    this._pilotIndex = new Map();
    this._mechIndex = new Map();
    this._weaponIndex = new Map();
    this._spawnIndex = new Map();
  }

  // --------------------------------------------------
  // Bulk getters
  // --------------------------------------------------

  getAllPilots() {
    return clone(this._pilots);
  }

  getAllMechs() {
    return clone(this._mechs);
  }

  getAllWeapons() {
    return clone(this._weapons);
  }

  getAllSpawnPoints() {
    return clone(this._spawnPoints);
  }

  // --------------------------------------------------
  // Single getters
  // --------------------------------------------------

  getPilot(id) {
    return clone(this._pilotIndex.get(id) || null);
  }

  getMech(id) {
    return clone(this._mechIndex.get(id) || null);
  }

  getWeapon(id) {
    return clone(this._weaponIndex.get(id) || null);
  }

  getSpawnPoint(id) {
    return clone(this._spawnIndex.get(id) || null);
  }

  // --------------------------------------------------
  // Existence helpers
  // --------------------------------------------------

  hasPilot(id) {
    return this._pilotIndex.has(id);
  }

  hasMech(id) {
    return this._mechIndex.has(id);
  }

  hasWeapon(id) {
    return this._weaponIndex.has(id);
  }

  hasSpawnPoint(id) {
    return this._spawnIndex.has(id);
  }

  // --------------------------------------------------
  // Mech helper expansion
  // --------------------------------------------------

  getWeaponsForMech(mechId) {
    const mech = this._mechIndex.get(mechId);
    if (!mech) return [];

    return mech.weapons
      .map((weaponId) => this._weaponIndex.get(weaponId))
      .filter(Boolean)
      .map(clone);
  }

  // --------------------------------------------------
  // Validation helpers
  // --------------------------------------------------

  validatePilot(id) {
    const pilot = this._pilotIndex.get(id);
    if (!pilot) {
      return {
        valid: false,
        message: `Pilot "${id}" not found.`
      };
    }

    return {
      valid: true,
      message: null
    };
  }

  validateMech(id) {
    const mech = this._mechIndex.get(id);
    if (!mech) {
      return {
        valid: false,
        message: `Mech "${id}" not found.`
      };
    }

    return {
      valid: true,
      message: null
    };
  }

  validateWeapon(id) {
    const weapon = this._weaponIndex.get(id);
    if (!weapon) {
      return {
        valid: false,
        message: `Weapon "${id}" not found.`
      };
    }

    return {
      valid: true,
      message: null
    };
  }

  validateSpawnPoint(id) {
    const spawnPoint = this._spawnIndex.get(id);
    if (!spawnPoint) {
      return {
        valid: false,
        message: `Spawn point "${id}" not found.`
      };
    }

    return {
      valid: true,
      message: null
    };
  }

  validateMechLoadout(mechId) {
    const mech = this._mechIndex.get(mechId);

    if (!mech) {
      return {
        valid: false,
        missingWeapons: [],
        message: `Mech "${mechId}" not found.`
      };
    }

    const missingWeapons = mech.weapons.filter((weaponId) => !this._weaponIndex.has(weaponId));

    return {
      valid: missingWeapons.length === 0,
      missingWeapons,
      message:
        missingWeapons.length === 0
          ? null
          : `Mech "${mechId}" references missing weapons: ${missingWeapons.join(", ")}`
    };
  }

  validateAllContent() {
    const errors = [];

    for (const mech of this._mechs) {
      const loadoutCheck = this.validateMechLoadout(mech.id);
      if (!loadoutCheck.valid) {
        errors.push(loadoutCheck.message);
      }
    }

    for (const spawnPoint of this._spawnPoints) {
      if (!spawnPoint.id) {
        errors.push("Spawn point missing id.");
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // --------------------------------------------------
  // Debug snapshot
  // --------------------------------------------------

  getSummary() {
    return {
      initialized: this._initialized,
      counts: {
        pilots: this._pilots.length,
        mechs: this._mechs.length,
        weapons: this._weapons.length,
        spawnPoints: this._spawnPoints.length
      },
      paths: { ...this._paths }
    };
  }
}

const dataStore = new DataStore();

export default dataStore;

export async function initializeDataStore(customPaths = {}) {
  return dataStore.init(customPaths);
}

export function resetDataStore() {
  dataStore.reset();
}

export function isDataStoreInitialized() {
  return dataStore.isInitialized();
}

export function getAllPilots() {
  return dataStore.getAllPilots();
}

export function getAllMechs() {
  return dataStore.getAllMechs();
}

export function getAllWeapons() {
  return dataStore.getAllWeapons();
}

export function getAllSpawnPoints() {
  return dataStore.getAllSpawnPoints();
}

export function getPilot(id) {
  return dataStore.getPilot(id);
}

export function getMech(id) {
  return dataStore.getMech(id);
}

export function getWeapon(id) {
  return dataStore.getWeapon(id);
}

export function getSpawnPoint(id) {
  return dataStore.getSpawnPoint(id);
}

export function hasPilot(id) {
  return dataStore.hasPilot(id);
}

export function hasMech(id) {
  return dataStore.hasMech(id);
}

export function hasWeapon(id) {
  return dataStore.hasWeapon(id);
}

export function hasSpawnPoint(id) {
  return dataStore.hasSpawnPoint(id);
}

export function getWeaponsForMech(mechId) {
  return dataStore.getWeaponsForMech(mechId);
}

export function validatePilot(id) {
  return dataStore.validatePilot(id);
}

export function validateMech(id) {
  return dataStore.validateMech(id);
}

export function validateWeapon(id) {
  return dataStore.validateWeapon(id);
}

export function validateSpawnPoint(id) {
  return dataStore.validateSpawnPoint(id);
}

export function validateMechLoadout(mechId) {
  return dataStore.validateMechLoadout(mechId);
}

export function validateAllContent() {
  return dataStore.validateAllContent();
}

export function getDataStoreSummary() {
  return dataStore.getSummary();
}
