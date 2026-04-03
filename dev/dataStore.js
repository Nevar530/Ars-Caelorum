// src/dev/dataStore.js
//
// Central content registry for Ars Caelorum dev tools.
// Loads JSON data from /data and exposes clean lookup helpers.
//
// Rules:
// - JS stays in src/
// - JSON stays in data/
// - Dev-only helpers stay in src/dev/

const DEFAULT_PATHS = {
  pilots: "../data/pilots.json",
  mechs: "../data/mechs.json",
  weapons: "../data/weapons.json",
  spawnPoints: "../data/spawnPoints.json"
};

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
      console.warn(`[dataStore] Skipping ${kind} with missing id.`, item);
      continue;
    }

    if (map.has(item.id)) {
      console.warn(`[dataStore] Duplicate ${kind} id "${item.id}" ignored.`);
      continue;
    }

    map.set(item.id, item);
  }

  return map;
}

async function loadJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const response = await fetch(url.href);

  if (!response.ok) {
    throw new Error(
      `[dataStore] Failed to load "${relativePath}" (${response.status} ${response.statusText})`
    );
  }

  return response.json();
}

class DataStore {
  constructor() {
    this.initialized = false;
    this.paths = { ...DEFAULT_PATHS };

    this.pilots = [];
    this.mechs = [];
    this.weapons = [];
    this.spawnPoints = [];

    this.pilotIndex = new Map();
    this.mechIndex = new Map();
    this.weaponIndex = new Map();
    this.spawnIndex = new Map();
  }

  async init(customPaths = {}) {
    if (this.initialized) {
      return this;
    }

    this.paths = {
      ...DEFAULT_PATHS,
      ...customPaths
    };

    const [pilotJson, mechJson, weaponJson, spawnJson] = await Promise.all([
      loadJson(this.paths.pilots),
      loadJson(this.paths.mechs),
      loadJson(this.paths.weapons),
      loadJson(this.paths.spawnPoints)
    ]);

    this.pilots = toArray(pilotJson).map(normalizePilot);
    this.mechs = toArray(mechJson).map(normalizeMech);
    this.weapons = toArray(weaponJson).map(normalizeWeapon);
    this.spawnPoints = toArray(spawnJson).map(normalizeSpawnPoint);

    this.pilotIndex = buildIndex(this.pilots, "pilot");
    this.mechIndex = buildIndex(this.mechs, "mech");
    this.weaponIndex = buildIndex(this.weapons, "weapon");
    this.spawnIndex = buildIndex(this.spawnPoints, "spawn point");

    this.initialized = true;

    console.info("[dataStore] Initialized", {
      pilots: this.pilots.length,
      mechs: this.mechs.length,
      weapons: this.weapons.length,
      spawnPoints: this.spawnPoints.length
    });

    return this;
  }

  reset() {
    this.initialized = false;

    this.pilots = [];
    this.mechs = [];
    this.weapons = [];
    this.spawnPoints = [];

    this.pilotIndex = new Map();
    this.mechIndex = new Map();
    this.weaponIndex = new Map();
    this.spawnIndex = new Map();
  }

  getAllPilots() {
    return clone(this.pilots);
  }

  getAllMechs() {
    return clone(this.mechs);
  }

  getAllWeapons() {
    return clone(this.weapons);
  }

  getAllSpawnPoints() {
    return clone(this.spawnPoints);
  }

  getPilot(id) {
    return clone(this.pilotIndex.get(id) || null);
  }

  getMech(id) {
    return clone(this.mechIndex.get(id) || null);
  }

  getWeapon(id) {
    return clone(this.weaponIndex.get(id) || null);
  }

  getSpawnPoint(id) {
    return clone(this.spawnIndex.get(id) || null);
  }

  hasPilot(id) {
    return this.pilotIndex.has(id);
  }

  hasMech(id) {
    return this.mechIndex.has(id);
  }

  hasWeapon(id) {
    return this.weaponIndex.has(id);
  }

  hasSpawnPoint(id) {
    return this.spawnIndex.has(id);
  }

  getWeaponsForMech(mechId) {
    const mech = this.mechIndex.get(mechId);
    if (!mech) return [];

    return mech.weapons
      .map((weaponId) => this.weaponIndex.get(weaponId))
      .filter(Boolean)
      .map(clone);
  }

  validatePilot(id) {
    if (!this.pilotIndex.has(id)) {
      return { valid: false, message: `Pilot "${id}" not found.` };
    }

    return { valid: true, message: null };
  }

  validateMech(id) {
    if (!this.mechIndex.has(id)) {
      return { valid: false, message: `Mech "${id}" not found.` };
    }

    return { valid: true, message: null };
  }

  validateWeapon(id) {
    if (!this.weaponIndex.has(id)) {
      return { valid: false, message: `Weapon "${id}" not found.` };
    }

    return { valid: true, message: null };
  }

  validateSpawnPoint(id) {
    if (!this.spawnIndex.has(id)) {
      return { valid: false, message: `Spawn point "${id}" not found.` };
    }

    return { valid: true, message: null };
  }

  validateMechLoadout(mechId) {
    const mech = this.mechIndex.get(mechId);

    if (!mech) {
      return {
        valid: false,
        missingWeapons: [],
        message: `Mech "${mechId}" not found.`
      };
    }

    const missingWeapons = mech.weapons.filter(
      (weaponId) => !this.weaponIndex.has(weaponId)
    );

    return {
      valid: missingWeapons.length === 0,
      missingWeapons,
      message:
        missingWeapons.length === 0
          ? null
          : `Mech "${mechId}" has missing weapons: ${missingWeapons.join(", ")}`
    };
  }

  validateAllContent() {
    const errors = [];

    for (const mech of this.mechs) {
      const loadoutCheck = this.validateMechLoadout(mech.id);
      if (!loadoutCheck.valid) {
        errors.push(loadoutCheck.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getSummary() {
    return {
      initialized: this.initialized,
      counts: {
        pilots: this.pilots.length,
        mechs: this.mechs.length,
        weapons: this.weapons.length,
        spawnPoints: this.spawnPoints.length
      },
      paths: { ...this.paths }
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
