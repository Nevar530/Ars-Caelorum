// Ars Caelorum — Map Editor Panel

import { DEFAULT_TERRAIN_TYPES, MAP_EDITOR_BRUSH_SIZES, MAP_EDITOR_FLAG_KEYS, MAP_EDITOR_MODES } from './mapEditorState.js';

export function renderMapEditorPanel(root, viewModel = {}) {
  if (!root) return;

  const terrainTypes = Array.isArray(viewModel.terrainTypes) && viewModel.terrainTypes.length
    ? viewModel.terrainTypes
    : DEFAULT_TERRAIN_TYPES;

  const mapOptions = Array.isArray(viewModel.mapOptions) ? viewModel.mapOptions : [];
  const editor = viewModel.editor ?? {};
  const selectedTile = viewModel.selectedTile ?? null;
  const selectedSummary = viewModel.selectedSummary ?? null;

  root.innerHTML = `
    <section class="map-editor-panel" style="display:grid; gap:12px;">
      <div style="padding:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03);">
        <div style="font-weight:700; margin-bottom:6px;">Authoring</div>
        <div style="opacity:0.82; margin-bottom:6px;">Left click paints the selected value. Right click samples the clicked tile.</div>
        <div style="opacity:0.82;">Ground layer only in this pass. Structures come later.</div>
      </div>

      <div style="padding:8px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-weight:700; margin-bottom:8px;">Map File</div>
        <div style="display:grid; gap:8px; grid-template-columns:1fr auto auto auto; align-items:end;">
          <label style="display:block; grid-column:1 / span 4;">
            <div>Loaded Map</div>
            <select id="ac-map-editor-map-select" style="width:100%;">
              ${mapOptions.map((entry) => `<option value="${escapeAttr(entry.id)}" ${entry.id === editor.activeMapId ? 'selected' : ''}>${escapeHtml(entry.label ?? entry.id)}</option>`).join('')}
            </select>
          </label>
          <button type="button" data-map-editor-action="load-selected-map">Load Selected</button>
          <button type="button" data-map-editor-action="export-map">Export</button>
          <button type="button" data-map-editor-action="import-map">Import</button>
          <input id="ac-map-editor-import-input" type="file" accept="application/json,.json" style="display:none;" />
        </div>
      </div>

      <div style="padding:8px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-weight:700; margin-bottom:8px;">Brush</div>
        <div style="display:grid; gap:8px; grid-template-columns:repeat(3, 1fr);">
          <label style="display:block;">
            <div>Mode</div>
            <select id="ac-map-editor-mode-select" style="width:100%;">
              ${Object.values(MAP_EDITOR_MODES).map((mode) => `<option value="${mode}" ${mode === editor.mode ? 'selected' : ''}>${formatModeLabel(mode)}</option>`).join('')}
            </select>
          </label>

          <label style="display:block;">
            <div>Brush Size</div>
            <select id="ac-map-editor-brush-size" style="width:100%;">
              ${MAP_EDITOR_BRUSH_SIZES.map((size) => `<option value="${size}" ${size === editor.brushSize ? 'selected' : ''}>${size}x${size}</option>`).join('')}
            </select>
          </label>

          <label style="display:block;">
            <div>Height</div>
            <input id="ac-map-editor-height-input" type="number" min="0" max="12" step="1" value="${escapeAttr(editor.selectedHeight ?? 0)}" style="width:100%;" />
          </label>

          <label style="display:block; grid-column:1 / span 2;">
            <div>Terrain Type</div>
            <select id="ac-map-editor-terrain-type" style="width:100%;">
              ${terrainTypes.map((type) => `<option value="${escapeAttr(type.id)}" ${type.id === editor.selectedTerrainTypeId ? 'selected' : ''}>${escapeHtml(type.label ?? type.id)}</option>`).join('')}
            </select>
          </label>

          <label style="display:block;">
            <div>Terrain Sprite Id</div>
            <input id="ac-map-editor-terrain-sprite" type="text" value="${escapeAttr(editor.selectedTerrainSpriteId ?? '')}" placeholder="grass_001_top" style="width:100%;" />
          </label>

          <label style="display:block;">
            <div>Flag</div>
            <select id="ac-map-editor-flag-key" style="width:100%;">
              ${MAP_EDITOR_FLAG_KEYS.map((flagKey) => `<option value="${flagKey}" ${flagKey === editor.selectedFlagKey ? 'selected' : ''}>${escapeHtml(flagKey)}</option>`).join('')}
            </select>
          </label>

          <label style="display:block;">
            <div>Flag Value</div>
            <select id="ac-map-editor-flag-value" style="width:100%;">
              <option value="true" ${editor.selectedFlagValue ? 'selected' : ''}>true</option>
              <option value="false" ${!editor.selectedFlagValue ? 'selected' : ''}>false</option>
            </select>
          </label>

          <label style="display:block;">
            <div>Spawn Brush</div>
            <select id="ac-map-editor-spawn-brush" style="width:100%;">
              ${['player_1','player_2','player_3','player_4','enemy_1','enemy_2','enemy_3','enemy_4'].map((spawnId) => {
                const [team, rawIndex] = spawnId.split('_');
                const selected = team === editor.selectedSpawnTeam && (Number(rawIndex) - 1) === editor.selectedSpawnIndex;
                return `<option value="${spawnId}" ${selected ? 'selected' : ''}>${escapeHtml(spawnId)}</option>`;
              }).join('')}
            </select>
          </label>
        </div>
      </div>

      <div style="padding:8px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-weight:700; margin-bottom:8px;">Resize</div>
        <div style="display:grid; gap:8px; grid-template-columns:1fr 1fr auto; align-items:end;">
          <label style="display:block;">
            <div>Width</div>
            <input id="ac-map-editor-resize-width" type="number" min="1" step="1" value="${escapeAttr(editor.pendingResize?.width ?? 32)}" style="width:100%;" />
          </label>
          <label style="display:block;">
            <div>Height</div>
            <input id="ac-map-editor-resize-height" type="number" min="1" step="1" value="${escapeAttr(editor.pendingResize?.height ?? 32)}" style="width:100%;" />
          </label>
          <button type="button" data-map-editor-action="apply-resize">Apply Resize</button>
        </div>
      </div>

      <div style="padding:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02);">
        <div style="font-weight:700; margin-bottom:8px;">Selected Tile</div>
        ${selectedTile ? `
          <div>Tile: <strong>(${selectedTile.x},${selectedTile.y})</strong></div>
          <div>Height: <strong>${escapeHtml(selectedTile.elevation ?? 0)}</strong></div>
          <div>Type: <strong>${escapeHtml(selectedTile.terrainTypeId ?? 'clear')}</strong></div>
          <div>Sprite: <strong>${escapeHtml(selectedTile.terrainSpriteId ?? '-')}</strong></div>
          <div>Flags: <strong>${formatFlags(selectedTile.flags)}</strong></div>
          <div>Spawn: <strong>${escapeHtml(selectedTile.spawnId ?? '-')}</strong></div>
          <div style="margin-top:6px; opacity:0.8;">Foot Height ${escapeHtml(selectedSummary?.mechFootElevation ?? '-')} · Enterable ${selectedSummary?.mechEnterable ? 'YES' : 'NO'}</div>
        ` : '<div style="opacity:0.8;">No tile selected.</div>'}
      </div>

      <div id="ac-map-editor-canvas-slot"></div>
    </section>
  `;
}

function formatFlags(flags) {
  const enabled = Object.entries(flags ?? {}).filter(([, value]) => Boolean(value)).map(([key]) => key);
  return enabled.length ? enabled.join(', ') : '-';
}

function formatModeLabel(mode) {
  switch (mode) {
    case 'terrainType': return 'Terrain Type';
    case 'terrainSprite': return 'Terrain Sprite';
    default: return mode.charAt(0).toUpperCase() + mode.slice(1);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}
