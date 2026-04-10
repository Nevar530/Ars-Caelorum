// src/scale/scaleMath.js

export const SCALE_RESOLUTION = {
  mech: 1,
  pilot: 2
};

export function normalizeScale(scale) {
  return scale === "pilot" ? "pilot" : "mech";
}

export function getResolutionMultiplier(scale = "mech") {
  return SCALE_RESOLUTION[normalizeScale(scale)] ?? SCALE_RESOLUTION.mech;
}

export function makePositionKey(x, y, scale = "mech") {
  return `${normalizeScale(scale)}:${x},${y}`;
}

export function makeScaleCellKey(scale = "mech", x = 0, y = 0) {
  return makePositionKey(x, y, scale);
}

export function getUnitPrimaryPosition(unit) {
  return {
    x: Number(unit?.x ?? 0),
    y: Number(unit?.y ?? 0),
    scale: normalizeScale(unit?.scale ?? "mech")
  };
}

export function mechTileToPilotCells(x, y) {
  const baseX = Number(x) * 2;
  const baseY = Number(y) * 2;

  return [
    { x: baseX, y: baseY },
    { x: baseX + 1, y: baseY },
    { x: baseX, y: baseY + 1 },
    { x: baseX + 1, y: baseY + 1 }
  ];
}

export function pilotCellToMechTile(x, y) {
  return {
    x: Math.floor(Number(x) / 2),
    y: Math.floor(Number(y) / 2)
  };
}

export function getResolutionCenterPoint(x, y, scale = "mech") {
  const normalizedScale = normalizeScale(scale);

  if (normalizedScale === "pilot") {
    return {
      x: Number(x) + 0.5,
      y: Number(y) + 0.5
    };
  }

  return {
    x: Number(x) + 0.5,
    y: Number(y) + 0.5
  };
}
