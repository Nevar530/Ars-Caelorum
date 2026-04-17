// Ars Caelorum — Map Brush Helpers

export function getBrushOffsets(brushSize) {
  const size = Math.max(1, Number(brushSize) || 1);
  const offsets = [];
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
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
