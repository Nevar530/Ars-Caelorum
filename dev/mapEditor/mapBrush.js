// Ars Caelorum — Map Brush Helpers
// New module scaffold only. Not wired into runtime yet.

export function getBrushOffsets(brushSize) {
  const offsets = [];
  for (let dy = 0; dy < brushSize; dy += 1) {
    for (let dx = 0; dx < brushSize; dx += 1) {
      offsets.push({ dx, dy });
    }
  }
  return offsets;
}

export function getBrushedTileCoords(originX, originY, brushSize, mapWidth, mapHeight) {
  const coords = [];
  for (const { dx, dy } of getBrushOffsets(brushSize)) {
    const x = originX + dx;
    const y = originY + dy;
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
    coords.push({ x, y });
  }
  return coords;
}
