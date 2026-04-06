// src/losUtils.js

// Height profiles are DATA, not logic
const HEIGHT_PROFILES = {
  mech: {
    fire: 1,
    chest: 1,
    head: 2
  },
  pilot: {
    fire: 0.25,
    chest: 0.125,
    head: 0.25
  }
}

export function getUnitHeightProfile(unit, tile) {
  const base = tile?.elevation ?? 0

  const profile = HEIGHT_PROFILES[unit?.scale || "mech"]

  return {
    fire: base + profile.fire,
    chest: base + profile.chest,
    head: base + profile.head
  }
}

// Pure ray vs terrain
export function traceRay(z1, z2, tiles, state) {
  const D = tiles.length

  for (let i = 0; i < D; i++) {
    const t = i / D
    const rayHeight = z1 + (z2 - z1) * t

    const pos = tiles[i]
    const tile = state.map[pos.y]?.[pos.x]

    if (!tile) return true

    // hard blockers (walls / buildings)
    if (tile.blocksLOS) return true

    const terrain = tile.elevation ?? 0

    if (terrain >= rayHeight) {
      return true
    }
  }

  return false
}
