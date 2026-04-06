// src/los.js

import { getTile } from "./map.js"
import { getUnitHeightProfile, traceRay } from "./losUtils.js"

/**
 * Bresenham line (KEEP — matches your current behavior)
 */
export function getLineTiles(x0, y0, x1, y1) {
  const tiles = []

  let dx = Math.abs(x1 - x0)
  let dy = Math.abs(y1 - y0)
  let sx = x0 < x1 ? 1 : -1
  let sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  let x = x0
  let y = y0

  while (true) {
    tiles.push({ x, y })

    if (x === x1 && y === y1) break

    const e2 = 2 * err

    if (e2 > -dy) {
      err -= dy
      x += sx
    }

    if (e2 < dx) {
      err += dx
      y += sy
    }
  }

  return tiles
}

/**
 * CLEAN LOS ENTRY POINT
 * NO COORD HACKS
 */
export function getLOS(state, attacker, target) {
  const fromTile = getTile(state.map, attacker.x, attacker.y)
  const toTile   = getTile(state.map, target.x, target.y)

  if (!fromTile || !toTile) {
    return {
      visible: false,
      cover: "full",
      reason: "invalid_tile",
      line: [],
      rays: null
    }
  }

  const line = getLineTiles(attacker.x, attacker.y, target.x, target.y)

  // same tile (safety case)
  if (line.length <= 1) {
    return {
      visible: true,
      cover: "none",
      reason: "same_tile",
      line,
      rays: null
    }
  }

  // remove attacker + target tiles
  const tiles = line.slice(1, -1)

  const a = getUnitHeightProfile(attacker, fromTile)
  const t = getUnitHeightProfile(target, toTile)

  const chestBlocked = traceRay(a.fire, t.chest, tiles, state)
  const headBlocked  = traceRay(a.fire, t.head, tiles, state)

  let visible = true
  let cover = "none"
  let reason = "clear"

  if (headBlocked) {
    visible = false
    cover = "full"
    reason = "head_blocked"
  } else if (chestBlocked) {
    cover = "half"
    reason = "chest_blocked"
  }

  return {
    visible,
    cover,
    reason,
    line,
    rays: {
      chest: { blocked: chestBlocked },
      head: { blocked: headBlocked }
    }
  }
}
