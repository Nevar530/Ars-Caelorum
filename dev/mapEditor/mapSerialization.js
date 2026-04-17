// Ars Caelorum — Map Serialization
// New module scaffold only. Not wired into runtime yet.

export function serializeMapDefinition(mapDefinition) {
  return JSON.stringify(mapDefinition, null, 2);
}

export function parseMapDefinition(text) {
  return JSON.parse(text);
}

export function downloadMapDefinition(filename, mapDefinition) {
  const blob = new Blob([serializeMapDefinition(mapDefinition)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
