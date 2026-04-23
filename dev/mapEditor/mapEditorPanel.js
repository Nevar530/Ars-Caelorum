// Ars Caelorum — Map Editor Panel

import { DEFAULT_MOVEMENT_CLASSES, DEFAULT_TERRAIN_PRESETS, MAP_EDITOR_BRUSH_SIZES, MAP_EDITOR_MODES } from './mapEditorState.js';

export function renderMapEditorPanel(root, viewModel = {}) {
  if (!root) return;

  const terrainPresets = Array.isArray(viewModel.terrainPresets) && viewModel.terrainPresets.length
    ? viewModel.terrainPresets
    : DEFAULT_TERRAIN_PRESETS;

  const movementClasses = Array.isArray(viewModel.movementClasses) && viewModel.movementClasses.length
    ? viewModel.movementClasses
    : DEFAULT_MOVEMENT_CLASSES;

  const mapOptions = Array.isArray(viewModel.mapOptions) ? viewModel.mapOptions : [];
  const deploymentOptions = viewModel.deploymentOptions ?? {};
  const deployments = Array.isArray(viewModel.deployments) ? viewModel.deployments : [];
  const editor = viewModel.editor ?? {};
  const selectedTile = viewModel.selectedTile ?? null;
  const selectedSummary = viewModel.selectedSummary ?? null;
  const validation = viewModel.validation ?? { issues: [], warnings: [] };
  const statusMessage = String(viewModel.statusMessage ?? '');
  const statusTone = viewModel.statusTone ?? 'info';
  const brushSummary = buildBrushSummary(editor, terrainPresets);
  const activePreset = terrainPresets.find((entry) => entry.id === editor.selectedTerrainPresetId) ?? terrainPresets[0] ?? null;

  root.innerHTML = `
    <section class="map-editor-panel" style="display:grid; gap:14px;">
      <div style="display:grid; grid-template-columns:minmax(0,1.35fr) minmax(300px,0.95fr); gap:14px; align-items:start;">
        <div style="display:grid; gap:12px;">
          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03);">
            <div style="font-weight:700; margin-bottom:6px;">Authoring</div>
            <div style="opacity:0.82; margin-bottom:6px;">Left click paints the selected value. Right click samples the clicked tile. Hover previews the brush.</div>
            <div style="opacity:0.82; margin-bottom:6px;">Ground layer only in this pass. Structures come later.</div>
            <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08);">
              <div style="font-weight:700; margin-bottom:4px;">Current Brush</div>
              <div style="opacity:0.92;">${escapeHtml(brushSummary)}</div>
            </div>
            ${statusMessage ? `
              <div style="margin-top:10px; padding:8px 10px; border-radius:8px; border:1px solid ${statusTone === 'error' ? 'rgba(220,90,90,0.45)' : statusTone === 'success' ? 'rgba(90,180,120,0.45)' : 'rgba(110,150,220,0.35)'}; background:${statusTone === 'error' ? 'rgba(120,30,30,0.24)' : statusTone === 'success' ? 'rgba(25,80,35,0.24)' : 'rgba(30,50,95,0.22)'};">
                ${escapeHtml(statusMessage)}
              </div>
            ` : ''}
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08);">
            <div style="font-weight:700; margin-bottom:8px;">Map File</div>
            <div style="display:grid; gap:8px; grid-template-columns:1fr auto auto auto auto; align-items:end;">
              <label style="display:block; grid-column:1 / -1;">
                <div>Loaded Map</div>
                <select id="ac-map-editor-map-select" style="width:100%;">
                  ${mapOptions.map((entry) => `<option value="${escapeAttr(entry.id)}" ${entry.id === editor.activeMapId ? 'selected' : ''}>${escapeHtml(entry.label ?? entry.id)}</option>`).join('')}
                </select>
              </label>
              <button type="button" data-map-editor-action="load-selected-map">Load</button>
              <button type="button" data-map-editor-action="export-map">Export</button>
              <button type="button" data-map-editor-action="import-map">Import</button>
              <button type="button" data-map-editor-action="validate-map">Validate</button>
              <input id="ac-map-editor-import-input" type="file" accept="application/json,.json" style="display:none;" />
            </div>
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08);">
            <div style="font-weight:700; margin-bottom:8px;">Brush</div>
            <div style="display:grid; gap:8px; grid-template-columns:repeat(4, 1fr); align-items:end;">
              <label style="display:block;">
                <div>Paint Mode</div>
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

              ${renderModeFields(editor, terrainPresets, movementClasses)}
            </div>

            ${activePreset ? `
              <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); opacity:0.86; display:grid; gap:4px; grid-template-columns:repeat(3, 1fr);">
                <div>Preset: <strong>${escapeHtml(activePreset.label ?? activePreset.id)}</strong></div>
                <div>Sprite Set: <strong>${escapeHtml(activePreset.spriteSetId ?? '-')}</strong></div>
                <div>Default Behavior: <strong>${escapeHtml(activePreset.movementClass ?? 'clear')}</strong></div>
              </div>
            ` : ''}
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08);">
            <div style="font-weight:700; margin-bottom:8px;">Start State · Deployments</div>
            <div style="opacity:0.82; margin-bottom:8px;">Author pilot/mech deployment pairs for this map. This only edits map JSON start-state data.</div>
            <div style="display:grid; gap:10px;">
              ${deployments.length ? deployments.map((deployment, index) => renderDeploymentRow(deployment, index, deploymentOptions)).join('') : `<div style="padding:10px; border:1px dashed rgba(255,255,255,0.16); opacity:0.82;">No deployments authored yet.</div>`}
            </div>
            <div style="margin-top:10px;">
              <button type="button" data-map-editor-action="add-deployment-row">Add Deployment</button>
            </div>
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08);">
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
            <div style="margin-top:8px; opacity:0.76;">Resize safeguards now block changes that would push live units or spawn markers off the board.</div>
          </div>
        </div>

        <div style="display:grid; gap:12px;">
          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02);">
            <div style="font-weight:700; margin-bottom:8px;">Selected Tile</div>
            ${selectedTile ? `
              <div>Tile: <strong>(${selectedTile.x},${selectedTile.y})</strong></div>
              <div>Height: <strong>${escapeHtml(selectedTile.elevation ?? 0)}</strong></div>
              <div>Preset: <strong>${escapeHtml(selectedTile.terrainTypeId ?? 'grass')}</strong></div>
              <div>Behavior: <strong>${escapeHtml(selectedTile.movementClass ?? 'clear')}</strong></div>
              <div>Sprite Set: <strong>${escapeHtml(selectedTile.terrainSpriteId ?? '-')}</strong></div>
              <div>Spawn: <strong>${escapeHtml(selectedTile.spawnId ?? '-')}</strong></div>
              <div>Deploy: <strong>${selectedTile.deploymentCell ? escapeHtml(`${selectedTile.deploymentCell.unitType}/${selectedTile.deploymentCell.controlType}`) : '-'}</strong></div>
              <div style="margin-top:6px; opacity:0.8;">Foot Height ${escapeHtml(selectedSummary?.mechFootElevation ?? '-')} · Enterable ${selectedSummary?.mechEnterable ? 'YES' : 'NO'}</div>
            ` : '<div style="opacity:0.8;">No tile selected.</div>'}
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02);">
            <div style="font-weight:700; margin-bottom:8px;">Map Validation</div>
            ${renderValidation(validation)}
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02);">
            <div style="font-weight:700; margin-bottom:8px;">Legend</div>
            <div style="display:grid; gap:6px;">
              ${terrainPresets.map((preset) => `
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="display:inline-block; width:16px; height:16px; border-radius:3px; background:${escapeAttr(preset.baseColor ?? '#666')}; border:1px solid rgba(255,255,255,0.18);"></span>
                  <span>${escapeHtml(preset.label ?? preset.id)} · ${escapeHtml(preset.spriteSetId ?? '-')}</span>
                </div>
              `).join('')}
            </div>
            <div style="margin-top:10px; display:grid; gap:6px;">
              <div><strong>D</strong> = Difficult</div>
              <div><strong>H</strong> = Hazard</div>
              <div><strong>X</strong> = Impassable</div>
              <div><strong>Blue / Red dot</strong> = Player / Enemy spawn</div>
            </div>
          </div>
        </div>
      </div>

      <div id="ac-map-editor-canvas-slot"></div>
    </section>
  `;
}

function renderDeploymentRow(deployment, index, options) {
  const pilotOptions = buildOptions(options.pilots, deployment.pilotDefinitionId, '-- pilot --');
  const mechOptions = buildOptions(options.mechs, deployment.mechDefinitionId, '-- mech --');
  const pilotSpawnOptions = buildOptions(options.spawns, deployment.pilotSpawnId, '-- pilot spawn --');
  const mechSpawnOptions = buildOptions(options.spawns, deployment.mechSpawnId, '-- mech spawn --');

  return `
    <div style="padding:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); display:grid; gap:8px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div style="font-weight:700;">Deployment ${index + 1}</div>
        <button type="button" data-map-editor-action="remove-deployment-row" data-deployment-index="${index}">Remove</button>
      </div>
      <div style="display:grid; gap:8px; grid-template-columns:repeat(2, minmax(0,1fr));">
        <label style="display:block;">
          <div>Pilot ID</div>
          <select data-deployment-index="${index}" data-deployment-field="pilotDefinitionId" style="width:100%;">${pilotOptions}</select>
        </label>
        <label style="display:block;">
          <div>Mech ID</div>
          <select data-deployment-index="${index}" data-deployment-field="mechDefinitionId" style="width:100%;">${mechOptions}</select>
        </label>
        <label style="display:block;">
          <div>Pilot Spawn ID</div>
          <select data-deployment-index="${index}" data-deployment-field="pilotSpawnId" style="width:100%;">${pilotSpawnOptions}</select>
        </label>
        <label style="display:block;">
          <div>Mech Spawn ID</div>
          <select data-deployment-index="${index}" data-deployment-field="mechSpawnId" style="width:100%;">${mechSpawnOptions}</select>
        </label>
        <label style="display:block;">
          <div>Team</div>
          <select data-deployment-index="${index}" data-deployment-field="team" style="width:100%;">
            <option value="player" ${deployment.team === 'player' ? 'selected' : ''}>player</option>
            <option value="enemy" ${deployment.team === 'enemy' ? 'selected' : ''}>enemy</option>
          </select>
        </label>
        <label style="display:block;">
          <div>Control</div>
          <select data-deployment-index="${index}" data-deployment-field="controlType" style="width:100%;">
            <option value="PC" ${deployment.controlType === 'PC' ? 'selected' : ''}>PC</option>
            <option value="CPU" ${deployment.controlType === 'CPU' ? 'selected' : ''}>CPU</option>
          </select>
        </label>
        <label style="display:block;">
          <div>Pilot Instance ID</div>
          <input type="text" data-deployment-index="${index}" data-deployment-field="pilotInstanceId" value="${escapeAttr(deployment.pilotInstanceId ?? '')}" style="width:100%;" />
        </label>
        <label style="display:block;">
          <div>Mech Instance ID</div>
          <input type="text" data-deployment-index="${index}" data-deployment-field="mechInstanceId" value="${escapeAttr(deployment.mechInstanceId ?? '')}" style="width:100%;" />
        </label>
      </div>
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" data-deployment-index="${index}" data-deployment-field="startEmbarked" ${deployment.startEmbarked ? 'checked' : ''} />
        <span>Start Embarked</span>
      </label>
    </div>
  `;
}

function buildOptions(entries, currentValue, placeholderLabel) {
  const normalized = Array.isArray(entries) ? entries : [];
  const current = String(currentValue ?? '');
  const hasCurrent = current && normalized.some((entry) => String(entry?.id ?? '') === current);
  const list = [];

  list.push(`<option value="">${escapeHtml(placeholderLabel)}</option>`);
  if (current && !hasCurrent) {
    list.push(`<option value="${escapeAttr(current)}" selected>${escapeHtml(`${current} (missing)`)}</option>`);
  }

  for (const entry of normalized) {
    const value = String(entry?.id ?? '');
    if (!value) continue;
    const label = entry?.label ?? value;
    list.push(`<option value="${escapeAttr(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`);
  }

  return list.join('');
}

function renderModeFields(editor, terrainPresets, movementClasses) {
  switch (editor.mode) {
    case MAP_EDITOR_MODES.HEIGHT:
      return `
        <label style="display:block; grid-column: span 2;">
          <div>Height</div>
          <input id="ac-map-editor-height-input" type="number" min="0" max="12" step="1" value="${escapeAttr(editor.selectedHeight ?? 0)}" style="width:100%;" />
        </label>
      `;
    case MAP_EDITOR_MODES.TERRAIN_PRESET:
      return `
        <label style="display:block; grid-column: span 2;">
          <div>Terrain Preset</div>
          <select id="ac-map-editor-terrain-preset" style="width:100%;">
            ${terrainPresets.map((type) => `<option value="${escapeAttr(type.id)}" ${type.id === editor.selectedTerrainPresetId ? 'selected' : ''}>${escapeHtml(type.label ?? type.id)}</option>`).join('')}
          </select>
        </label>
        <label style="display:block;">
          <div>Behavior Override</div>
          <select id="ac-map-editor-movement-class" style="width:100%;">
            ${movementClasses.map((entry) => `<option value="${escapeAttr(entry.id)}" ${entry.id === editor.selectedMovementClass ? 'selected' : ''}>${escapeHtml(entry.label ?? entry.id)}</option>`).join('')}
          </select>
        </label>
      `;
    case MAP_EDITOR_MODES.MOVEMENT_CLASS:
      return `
        <label style="display:block; grid-column: span 2;">
          <div>Tile Behavior</div>
          <select id="ac-map-editor-movement-class" style="width:100%;">
            ${movementClasses.map((entry) => `<option value="${escapeAttr(entry.id)}" ${entry.id === editor.selectedMovementClass ? 'selected' : ''}>${escapeHtml(entry.label ?? entry.id)}</option>`).join('')}
          </select>
        </label>
      `;
    case MAP_EDITOR_MODES.SPAWN:
      return `
        <label style="display:block; grid-column: span 2;">
          <div>Spawn Brush</div>
          <select id="ac-map-editor-spawn-brush" style="width:100%;">
            ${['player_1','player_2','player_3','player_4','enemy_1','enemy_2','enemy_3','enemy_4'].map((spawnId) => {
              const [team, rawIndex] = spawnId.split('_');
              const selected = team === editor.selectedSpawnTeam && (Number(rawIndex) - 1) === editor.selectedSpawnIndex;
              return `<option value="${spawnId}" ${selected ? 'selected' : ''}>${escapeHtml(spawnId)}</option>`;
            }).join('')}
          </select>
        </label>
      `;
    case MAP_EDITOR_MODES.DEPLOYMENT:
      return `
        <label style="display:block; grid-column: span 2;">
          <div>Deploy Brush</div>
          <select id="ac-map-editor-deployment-unit-type" style="width:100%;">
            <option value="pilot" ${editor.selectedDeploymentUnitType === 'pilot' ? 'selected' : ''}>pilot / PC</option>
            <option value="mech" ${editor.selectedDeploymentUnitType === 'mech' ? 'selected' : ''}>mech / PC</option>
          </select>
        </label>
      `;
    case MAP_EDITOR_MODES.ERASE:
      return `
        <div style="grid-column: span 2; opacity:0.82; align-self:end; padding-bottom:8px;">Erase resets the tile to grass / clear and removes any spawn marker or deploy marker.</div>
      `;
    default:
      return '';
  }
}

function renderValidation(validation) {
  const issues = Array.isArray(validation?.issues) ? validation.issues : [];
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];

  if (!issues.length && !warnings.length) {
    return '<div style="color:#86d49a;">No issues found.</div>';
  }

  return `
    ${issues.length ? `
      <div style="margin-bottom:8px;">
        <div style="font-weight:700; color:#ff9999; margin-bottom:4px;">Issues</div>
        <ul style="margin:0; padding-left:18px;">${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    ` : ''}
    ${warnings.length ? `
      <div>
        <div style="font-weight:700; color:#f2cd73; margin-bottom:4px;">Warnings</div>
        <ul style="margin:0; padding-left:18px;">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    ` : ''}
  `;
}

function formatModeLabel(mode) {
  switch (mode) {
    case 'terrainPreset': return 'Terrain Preset';
    case 'movementClass': return 'Tile Behavior';
    case 'deployment': return 'Deployment';
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

function buildBrushSummary(editor, terrainPresets) {
  const mode = editor?.mode ?? 'height';
  const brushSize = Number(editor?.brushSize ?? 1);
  const presetLabel = terrainPresets.find((entry) => entry.id === editor?.selectedTerrainPresetId)?.label ?? (editor?.selectedTerrainPresetId ?? 'Grass');

  switch (mode) {
    case MAP_EDITOR_MODES.HEIGHT:
      return `Painting Height = ${editor?.selectedHeight ?? 0} with ${brushSize}x${brushSize} brush`;
    case MAP_EDITOR_MODES.TERRAIN_PRESET:
      return `Painting Preset = ${presetLabel} (${editor?.selectedMovementClass ?? 'clear'}) with ${brushSize}x${brushSize} brush`;
    case MAP_EDITOR_MODES.MOVEMENT_CLASS:
      return `Painting Behavior = ${editor?.selectedMovementClass ?? 'clear'} with ${brushSize}x${brushSize} brush`;
    case MAP_EDITOR_MODES.SPAWN:
      return `Painting Spawn = ${(editor?.selectedSpawnTeam ?? 'player')}_${(Number(editor?.selectedSpawnIndex ?? 0) + 1)} with ${brushSize}x${brushSize} brush`;
    case MAP_EDITOR_MODES.ERASE:
      return `Erasing to Grass / Clear with ${brushSize}x${brushSize} brush`;
    default:
      return `Painting with ${brushSize}x${brushSize} brush`;
  }
}
