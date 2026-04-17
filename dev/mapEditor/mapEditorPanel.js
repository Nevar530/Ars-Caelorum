// Ars Caelorum — Map Editor Panel
// New module scaffold only. Not wired into runtime yet.

export function renderMapEditorPanel(root, viewModel = {}) {
  if (!root) return;
  root.innerHTML = `
    <section class="map-editor-panel">
      <h3>Map Editor</h3>
      <p>This is the new panel scaffold. Wiring comes in the next pass.</p>
      <pre>${escapeHtml(JSON.stringify(viewModel, null, 2))}</pre>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
