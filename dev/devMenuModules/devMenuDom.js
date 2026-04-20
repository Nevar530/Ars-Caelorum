export function createDevMenuDom() {
  const root = document.createElement("div");
  root.id = "ac-dev-root";
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.right = "0";
  root.style.height = "100vh";
  root.style.zIndex = "9999";
  root.style.pointerEvents = "none";

  const panel = document.createElement("div");
  panel.id = "ac-dev-panel";
  panel.style.width = "760px";
  panel.style.height = "100%";
  panel.style.background = "rgba(10, 12, 18, 0.96)";
  panel.style.color = "#d8e1ea";
  panel.style.borderLeft = "1px solid rgba(255,255,255,0.12)";
  panel.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.35)";
  panel.style.fontFamily = "monospace";
  panel.style.fontSize = "12px";
  panel.style.display = "none";
  panel.style.pointerEvents = "auto";
  panel.style.overflowY = "auto";
  panel.style.padding = "12px";
  panel.style.boxSizing = "border-box";

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div style="font-size:14px; font-weight:bold;">DEV MENU</div>
      <button id="ac-dev-close-btn" type="button">Close</button>
    </div>

    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <button id="ac-dev-tab-units" type="button">Units</button>
      <button id="ac-dev-tab-map" type="button">Map</button>
    </div>

    <div id="ac-dev-tab-panel-units">
      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Spawn / Replace Unit</div>

        <label style="display:block; margin-bottom:6px;">
          <div>Frame</div>
          <select id="ac-dev-frame-select" style="width:100%;"></select>
        </label>

        <label style="display:block; margin-bottom:6px;">
          <div>Pilot</div>
          <select id="ac-dev-pilot-select" style="width:100%;"></select>
        </label>

        <label style="display:block; margin-bottom:6px;">
          <div>Spawn Point</div>
          <select id="ac-dev-spawn-select" style="width:100%;"></select>
        </label>

        <label style="display:block; margin-bottom:6px;">
          <div>Control</div>
          <select id="ac-dev-control-select" style="width:100%;">
            <option value="PC">PC</option>
            <option value="CPU">CPU</option>
          </select>
        </label>

        <label style="display:block; margin-bottom:10px;">
          <div>Team</div>
          <select id="ac-dev-team-select" style="width:100%;">
            <option value="player">player</option>
            <option value="enemy">enemy</option>
          </select>
        </label>

        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="ac-dev-spawn-btn" type="button">Spawn / Replace Unit</button>
          <button id="ac-dev-reset-btn" type="button">Reset Units</button>
          <button id="ac-dev-reroll-btn" type="button">Reroll Initiative</button>
          <button id="ac-dev-clearlog-btn" type="button">Clear Log</button>
        </div>
      </div>

      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Runtime State</div>
        <div id="ac-dev-runtime-state"></div>
      </div>

      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Round / Phase</div>
        <div id="ac-dev-round-phase"></div>
        <div id="ac-dev-phase-order" style="margin-top:8px;"></div>
      </div>

      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Units On Map</div>
        <div id="ac-dev-unit-list"></div>
      </div>

      <div>
        <div style="font-weight:bold; margin-bottom:8px;">Debug Log</div>
        <div id="ac-dev-log-list"></div>
      </div>
    </div>

    <div id="ac-dev-tab-panel-map" style="display:none;">
      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Map State</div>
        <div id="ac-dev-map-state"></div>
      </div>

      <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:bold; margin-bottom:8px;">Map Controls</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="ac-dev-map-rotate-left" type="button">⟲ Rotate Left</button>
          <button id="ac-dev-map-rotate-right" type="button">⟳ Rotate Right</button>
          <button id="ac-dev-map-toggle-view" type="button">Toggle Tactical (R)</button>
          <button id="ac-dev-map-reset" type="button">Reset Map</button>
        </div>
      </div>

      <div id="ac-dev-map-editor-host"></div>
    </div>
  `;

  root.appendChild(panel);
  document.body.appendChild(root);

  return {
    root,
    panel,
    refs: {
      unitsTabButtonEl: panel.querySelector("#ac-dev-tab-units"),
      mapTabButtonEl: panel.querySelector("#ac-dev-tab-map"),
      unitsTabEl: panel.querySelector("#ac-dev-tab-panel-units"),
      mapTabEl: panel.querySelector("#ac-dev-tab-panel-map"),
      logListEl: panel.querySelector("#ac-dev-log-list"),
      unitListEl: panel.querySelector("#ac-dev-unit-list"),
      phaseOrderEl: panel.querySelector("#ac-dev-phase-order"),
      roundPhaseEl: panel.querySelector("#ac-dev-round-phase"),
      runtimeStateEl: panel.querySelector("#ac-dev-runtime-state"),
      mapStateEl: panel.querySelector("#ac-dev-map-state"),
      frameSelectEl: panel.querySelector("#ac-dev-frame-select"),
      pilotSelectEl: panel.querySelector("#ac-dev-pilot-select"),
      spawnSelectEl: panel.querySelector("#ac-dev-spawn-select"),
      controlSelectEl: panel.querySelector("#ac-dev-control-select"),
      teamSelectEl: panel.querySelector("#ac-dev-team-select"),
      mapRotateLeftEl: panel.querySelector("#ac-dev-map-rotate-left"),
      mapRotateRightEl: panel.querySelector("#ac-dev-map-rotate-right"),
      mapToggleViewEl: panel.querySelector("#ac-dev-map-toggle-view"),
      mapResetEl: panel.querySelector("#ac-dev-map-reset"),
      mapEditorHostEl: panel.querySelector("#ac-dev-map-editor-host")
    }
  };
}
