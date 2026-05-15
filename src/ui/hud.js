// src/ui/hud.js

import { getMapHeight, getMapWidth, getTile, getTileRenderElevation, tileTypeFromElevation } from "../map.js";
import { getUnitAt, getUnitById } from "../mechs.js";
import { getSelectedAbilityMenuItems, getSelectedAttackMenuItems, getSelectedItemMenuItems, isCommandMenuItemDisabled } from "../action.js";
import { getActiveActor, getActiveBody, getEmbarkedPilotForMech } from "../actors/actorResolver.js";
import { getDeploymentAvailableRoster, getDeploymentPlacedUnitAt, getDeploymentPlacementCount, getDeploymentReady, isDeploymentActive, isDeploymentMenuFocused } from "../deployment/deploymentState.js";
import { getMissionObjectiveStatus } from "../mission/missionObjectives.js";
import { isStoryMode } from "../mode/mapMode.js";
import { getMapStructures, getStructureEdgeParts, getStructureCells, normalizeStructureForMap, STRUCTURE_EDGE_TYPES } from "../structures/structureRules.js";
import { getMapProps, getPropFootprintCells, normalizeProp } from "../props/propRules.js";

/* =========================
   INPUT
========================= */

export function bindHudInput(state, refs, actions) {
  refs.hudRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-hud-action]");
    if (!button || button.disabled) return;

    const action = button.dataset.hudAction;

    switch (action) {
      case "open-menu":
        actions.openCommandMenu();
        break;
      case "move":
        actions.startMove();
        break;
      case "brace":
        actions.waitTurn();
        break;
      case "attack":
        actions.startAttack();
        break;
      case "ability":
        actions.startAbility?.();
        break;
      case "item":
        actions.startItem?.();
        break;
      case "confirm":
        actions.confirmAction();
        break;
      case "cancel":
        actions.cancelAction();
        break;
      case "start-combat":
        actions.startCombat();
        break;
      case "story-interact":
        actions.storyInteract?.();
        break;
      case "open-deployment-list":
        actions.openDeploymentList?.();
        break;
      case "confirm-deployment-placement":
        actions.confirmDeploymentPlacement?.();
        break;
      case "remove-deployment-placement":
        actions.removeDeploymentPlacement?.();
        break;
      case "restart-mission":
        actions.resetMap();
        break;
      case "advance-dialogue":
        actions.advanceDialogue?.();
        break;
      case "menu-select":
        actions.selectMenuAction(button.dataset.menuAction);
        break;
    }
  });
}

/* =========================
   MAIN RENDER
========================= */

export function renderHud(state, refs) {
  refs.hudLeft.innerHTML = renderActivePanel(state);
  refs.hudCenter.innerHTML = renderCenterPanel(state);
  refs.hudRight.innerHTML = renderContextPanel(state);
}

/* =========================
   LEFT PANEL (ACTIVE UNIT)
========================= */

function renderActivePanel(state) {
  const activeBody = getActiveBody(state);
  const activeActor = getActiveActor(state);

  if (!activeBody) {
    return `
      <div class="hud-readout-empty">
        <div class="hud-card-title">Unit</div>
        <div class="hud-empty-state">No active unit</div>
      </div>
    `;
  }

  const mech = activeBody.unitType === "mech" ? activeBody : null;
  const pilot = activeActor?.unitType === "pilot"
    ? activeActor
    : mech
      ? getEmbarkedPilotForMech(state, mech)
      : null;

  const role = activeBody.unitType === "mech" ? "Telum" : "Pilot";
  const sublineParts = [role, activeBody.team].filter(Boolean);
  const disabledMech = mech && activeBody.status === "disabled";

  const stats = [
    ["MV", activeBody.move],
    ["INIT", activeBody.initiative ?? "-"],
    ["REACT", activeBody.reaction],
    ["TARG", activeBody.targeting],
    ["F", facingLabel(activeBody.facing)],
    ["STAT", activeBody.status ?? "-"]
  ];

  return `
    <div class="hud-unit-readout hud-readout-with-portrait">
      ${renderPilotPortrait(pilot ?? activeBody, "Active pilot portrait")}
      <div class="hud-readout-main">
        <div class="hud-unit-topline">
          <div class="hud-unit-titleblock">
            <div class="hud-card-title">${escapeHtml(role)}</div>
            <div class="hud-unit-name-row">
              <div class="hud-unit-name-stack">
                <div class="hud-unit-name">${escapeHtml(activeBody.name)}</div>
                <div class="hud-subline">${escapeHtml(sublineParts.join(" · "))}</div>
              </div>
              <div class="hud-active-vitals">
                ${vitalBar("SHD", activeBody.shield, activeBody.maxShield, "shield")}
                ${vitalBar("CORE", activeBody.core, activeBody.maxCore, "core")}
              </div>
            </div>
          </div>
          <div class="hud-tag">ACTIVE</div>
        </div>

        <div class="hud-stat-strip">
          ${stats.map(([label, value]) => compactStat(label, value)).join("")}
        </div>

        ${mech && pilot ? `
          <div class="hud-embarked-strip ${disabledMech ? "is-warning" : ""}">
            <div class="hud-embarked-name">Pilot: ${escapeHtml(pilot.name)}</div>
            ${vitalBar("P-SHD", pilot.shield, pilot.maxShield, "shield")}
            ${vitalBar("P-CORE", pilot.core, pilot.maxCore, "core")}
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

/* =========================
   CENTER PANEL (FLOW)
========================= */

function renderCenterPanel(state) {
  if (!state.turn.combatStarted) {
    if (isStoryMode(state)) {
      return renderStoryModePanel(state);
    }

    if (isDeploymentActive(state)) {
      const placed = getDeploymentPlacementCount(state);
      const required = Number(state.ui.deployment.requiredCount ?? 0);
      const ready = getDeploymentReady(state);
      const listOpen = Boolean(state.ui.deployment.listOpen);
      const placedUnit = getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y);

      const objectiveHtml = `
        <div class="hud-column-title">Deployment</div>
        <div class="hud-compact-line">${placed}/${required} placed</div>
        <div class="hud-compact-line muted">Cursor to legal cell</div>
      `;

      const commandHtml = listOpen ? `
        <button class="hud-command-button compact" data-hud-action="confirm-deployment-placement">Confirm Unit</button>
      ` : placedUnit ? `
        <button class="hud-command-button compact" data-hud-action="remove-deployment-placement">Remove Unit</button>
      ` : `
        <button class="hud-command-button compact" data-hud-action="open-deployment-list">Open Unit List</button>
      `;

      return renderHudFlowGrid({
        header: "Deployment",
        objectives: objectiveHtml,
        commands: `
          ${commandHtml}
          <button class="hud-command-button compact ${isDeploymentMenuFocused(state) ? 'is-selected' : ''}" data-hud-action="start-combat" ${ready ? '' : 'disabled'}>Begin Mission</button>
        `
      });
    }

    return renderHudFlowGrid({
      header: "Combat Ready",
      objectives: `<div class="hud-compact-line muted">No active combat round.</div>`,
      commands: `<button class="hud-command-button" data-hud-action="start-combat">Start Combat</button>`
    });
  }

  const commandHtml = renderCombatCommandBlock(state);
  return renderHudFlowGrid({
    header: getCombatHeader(state),
    objectives: renderObjectiveSummary(state) || `<div class="hud-compact-line muted">No objectives.</div>`,
    commands: commandHtml
  });
}

function renderCombatCommandBlock(state) {
  if (state.ui.mode === "idle" && state.ui.commandMenu.open) return renderCommandMenu(state);
  if (state.ui.mode === "action-ability-select") return renderAbilityMenu(state);
  if (state.ui.mode === "action-attack-select") return renderAttackMenu(state);
  if (state.ui.mode === "action-item-select") return renderItemMenu(state);
  if (state.ui.mode === "action-target") return renderTargeting(state);
  if (state.ui.mode === "move") return renderMove(state);
  if (state.ui.mode === "face") return renderFacing(state);

  return `
    <div class="hud-command-status hud-command-status--single">
      <button class="hud-command-button" data-hud-action="open-menu">Open Menu</button>
    </div>
  `;
}

function getCombatHeader(state) {
  const phaseLabel = state.turn.phase === "move"
    ? "Move"
    : state.turn.phase === "action"
      ? "Action"
      : "Combat";
  return `Round ${state.turn.round} · ${phaseLabel}`;
}

function renderHudFlowGrid({ header, objectives, commands }) {
  const head = header
    ? `<div class="hud-flow-head"><span>${escapeHtml(header)}</span></div>`
    : "";

  return `
    ${head}
    <div class="hud-flow-grid ${header ? "" : "hud-flow-grid--full"}">
      <div class="hud-flow-column hud-flow-column--objectives">
        <div class="hud-column-title">Objective</div>
        <div class="hud-column-body">${objectives}</div>
      </div>
      <div class="hud-flow-column hud-flow-column--commands">
        <div class="hud-column-body">${commands}</div>
      </div>
    </div>
  `;
}

function renderStoryModePanel(state) {
  return renderHudFlowGrid({
    header: "",
    objectives: renderObjectiveSummary(state) || `<div class="hud-compact-line muted">Explore the area.</div>`,
    commands: `
      <div class="hud-command-status hud-command-status--single">
        <button class="hud-command-button" data-hud-action="story-interact">Interact</button>
      </div>
    `
  });
}

/* =========================
   TURN SUMMARY (CORE FIX)
========================= */

function renderTurnSummary(state) {
  if (!state.turn.combatStarted) return "";

  const phaseLabel = state.turn.phase === "move"
    ? "Move"
    : state.turn.phase === "action"
      ? "Action"
      : "Combat";

  return `
    <div class="hud-flow-head">
      <span>Round ${escapeHtml(state.turn.round)} · ${escapeHtml(phaseLabel)}</span>
      <b>${escapeHtml(state.ui.mode ?? "idle")}</b>
    </div>

    ${renderObjectiveSummary(state)}
  `;
}

function renderObjectiveSummary(state) {
  const objectives = getMissionObjectiveStatus(state);
  if (!objectives.length) return "";

  return `
    <div class="hud-objectives-compact">
      ${objectives.map((objective) => {
        const done = objective.completed;
        const progress = objective.required > 1 ? ` ${objective.progress}/${objective.required}` : "";
        return `
          <div class="hud-objective-line ${done ? "is-done" : ""}">
            <span>${done ? "✓" : "□"} ${escapeHtml(objective.label)}</span>
            ${progress.trim() ? `<b>${escapeHtml(progress.trim())}</b>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* =========================
   RIGHT PANEL (TARGET/TILE)
========================= */

function renderContextPanel(state) {
  if (isDeploymentActive(state)) {
    return renderDeploymentPanel(state);
  }

  const focusedUnit = getUnitAt(state.units, state.focus.x, state.focus.y);
  const activeBody = getActiveBody(state);

  if (focusedUnit && focusedUnit.instanceId !== activeBody?.instanceId) {
    const targetPilot = focusedUnit.unitType === "mech"
      ? getEmbarkedPilotForMech(state, focusedUnit)
      : null;

    const role = focusedUnit.unitType === "mech" ? "Target Telum" : "Target Pilot";
    const stats = [
      ["MV", focusedUnit.move],
      ["INIT", focusedUnit.initiative ?? "-"],
      ["REACT", focusedUnit.reaction],
      ["TARG", focusedUnit.targeting],
      ["F", facingLabel(focusedUnit.facing)],
      ["STAT", focusedUnit.status ?? "-"]
    ];

    const portraitPilot = targetPilot ?? (focusedUnit.unitType === "pilot" ? focusedUnit : null);

    return `
      <div class="hud-target-readout hud-readout-with-portrait">
        ${renderPilotPortrait(portraitPilot, "Target pilot portrait")}
        <div class="hud-readout-main">
          <div class="hud-target-topline">
            <div class="hud-unit-titleblock">
              <div class="hud-card-title">${escapeHtml(role)}</div>
              <div class="hud-target-name-row">
                <div class="hud-unit-name-stack">
                  <div class="hud-unit-name">${escapeHtml(focusedUnit.name)}</div>
                  <div class="hud-subline">${escapeHtml(focusedUnit.team ?? "")}</div>
                </div>
                <div class="hud-active-vitals">
                  ${vitalBar("SHD", focusedUnit.shield, focusedUnit.maxShield, "shield")}
                  ${vitalBar("CORE", focusedUnit.core, focusedUnit.maxCore, "core")}
                </div>
              </div>
            </div>
          </div>

          <div class="hud-stat-strip">
            ${stats.map(([label, value]) => compactStat(label, value)).join("")}
          </div>

          ${targetPilot ? `
            <div class="hud-embarked-strip">
              <div class="hud-embarked-name">Pilot: ${escapeHtml(targetPilot.name)}</div>
              ${vitalBar("P-SHD", targetPilot.shield, targetPilot.maxShield, "shield")}
              ${vitalBar("P-CORE", targetPilot.core, targetPilot.maxCore, "core")}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  return renderTacticalScanPanel(state);
}


function renderPilotPortrait(pilot, altText = "Pilot portrait") {
  const src = getPilotPortraitPath(pilot);

  return `
    <div class="hud-pilot-portrait-box">
      <img
        class="hud-pilot-portrait"
        src="${escapeAttr(src)}"
        alt="${escapeAttr(altText)}"
        onerror="this.onerror=null;this.src='art/pilot/blank_portrait.png';"
      >
    </div>
  `;
}

function getPilotPortraitPath(pilot) {
  const explicit = String(pilot?.portrait ?? pilot?.imagePortrait ?? pilot?.render?.portrait ?? "").trim();
  if (explicit) return explicit;

  const rawId = String(pilot?.definitionId ?? pilot?.id ?? pilot?.pilotId ?? "").trim();
  const rawName = String(pilot?.name ?? pilot?.pilotName ?? "").trim();
  const key = normalizePortraitKey(rawId || rawName);

  return key ? `art/pilot/${key}_portrait.png` : "art/pilot/blank_portrait.png";
}

function normalizePortraitKey(value) {
  let key = String(value ?? "").trim().toLowerCase();
  key = key.replace(/^pilot[_-]/, "");
  key = key.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key || "blank";
}

function renderTacticalScanPanel(state) {
  return `
    <div class="hud-scan-readout">
      ${renderTacticalScanSvg(state)}
      <div class="hud-scan-prompt">Press <b>R</b> for full tactical map</div>
    </div>
  `;
}

function renderTacticalScanSvg(state) {
  const width = 520;
  const height = 74;
  const cols = 14;
  const rows = 5;
  const cell = Math.min(width / cols, height / rows);
  const activeBody = getActiveBody(state);
  const focus = activeBody
    ? { x: Number(activeBody.x ?? 0), y: Number(activeBody.y ?? 0) }
    : { x: Number(state.focus?.x ?? 0), y: Number(state.focus?.y ?? 0) };
  const startX = Math.round(focus.x - (cols / 2));
  const startY = Math.round(focus.y - (rows / 2));
  const mapWidth = getMapWidth(state.map);
  const mapHeight = getMapHeight(state.map);
  const originX = (width - (cols * cell)) / 2;
  const originY = (height - (rows * cell)) / 2;
  const px = (x) => originX + ((x - startX) * cell);
  const py = (y) => originY + ((y - startY) * cell);

  const pieces = [];

  pieces.push(`<svg class="hud-scan-map" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">`);
  pieces.push(`<rect x="0" y="0" width="${width}" height="${height}" class="hud-scan-bg"/>`);

  for (let y = startY; y < startY + rows; y += 1) {
    for (let x = startX; x < startX + cols; x += 1) {
      if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
      const tile = getTile(state.map, x, y);
      const elevation = getTileRenderElevation(tile) ?? tile?.elevation ?? 0;
      const terrainClass = `hud-scan-cell--${tileTypeFromElevation(elevation)}`;
      pieces.push(`<rect x="${fmt(px(x))}" y="${fmt(py(y))}" width="${fmt(cell)}" height="${fmt(cell)}" class="hud-scan-cell ${terrainClass}"/>`);
    }
  }

  pieces.push(renderScanRooms(state, startX, startY, cols, rows, cell, px, py));
  pieces.push(renderScanEdges(state, startX, startY, cols, rows, cell, px, py));
  pieces.push(renderScanProps(state, startX, startY, cols, rows, cell, px, py));
  pieces.push(renderScanUnits(state, startX, startY, cols, rows, cell, px, py));
  pieces.push(renderScanFocus(state, startX, startY, cols, rows, cell, px, py));

  pieces.push(`</svg>`);
  return pieces.join("");
}

function renderScanRooms(state, startX, startY, cols, rows, cell, px, py) {
  const parts = [];
  for (const raw of getMapStructures(state.map)) {
    const structure = normalizeStructureForMap(state, raw);
    if (!structure) continue;

    for (const structureCell of getStructureCells(structure)) {
      const x = Number(structureCell.x);
      const y = Number(structureCell.y);
      if (!isInScanBounds(x, y, startX, startY, cols, rows)) continue;
      parts.push(`<rect x="${fmt(px(x))}" y="${fmt(py(y))}" width="${fmt(cell)}" height="${fmt(cell)}" class="hud-scan-room"/>`);
    }
  }
  return parts.join("");
}

function renderScanEdges(state, startX, startY, cols, rows, cell, px, py) {
  const parts = [];
  for (const raw of getMapStructures(state.map)) {
    const structure = normalizeStructureForMap(state, raw);
    if (!structure) continue;

    for (const edge of getStructureEdgeParts(structure)) {
      const x = Number(edge.x);
      const y = Number(edge.y);
      if (!isInScanBounds(x, y, startX, startY, cols, rows)) continue;
      const line = getScanEdgeLine(x, y, edge.edge, cell, px, py);
      if (!line) continue;
      const type = String(edge.type ?? STRUCTURE_EDGE_TYPES.WALL).toLowerCase();
      const cssClass = type === STRUCTURE_EDGE_TYPES.DOOR
        ? "hud-scan-edge hud-scan-edge--door"
        : type === STRUCTURE_EDGE_TYPES.WINDOW
          ? "hud-scan-edge hud-scan-edge--window"
          : "hud-scan-edge";
      parts.push(`<line x1="${fmt(line.x1)}" y1="${fmt(line.y1)}" x2="${fmt(line.x2)}" y2="${fmt(line.y2)}" class="${cssClass}"/>`);
    }
  }
  return parts.join("");
}

function renderScanProps(state, startX, startY, cols, rows, cell, px, py) {
  const parts = [];
  for (const raw of getMapProps(state.map)) {
    const prop = normalizeProp(raw);
    if (!prop) continue;
    const cells = getPropFootprintCells(prop).filter((coord) => isInScanBounds(coord.x, coord.y, startX, startY, cols, rows));
    if (!cells.length) continue;

    const minX = Math.min(...cells.map((coord) => coord.x));
    const minY = Math.min(...cells.map((coord) => coord.y));
    const maxX = Math.max(...cells.map((coord) => coord.x));
    const maxY = Math.max(...cells.map((coord) => coord.y));
    const cssClass = prop.blocksMovement ? "hud-scan-prop hud-scan-prop--blocking" : "hud-scan-prop";
    parts.push(`<rect x="${fmt(px(minX))}" y="${fmt(py(minY))}" width="${fmt(((maxX - minX) + 1) * cell)}" height="${fmt(((maxY - minY) + 1) * cell)}" class="${cssClass}"/>`);
  }
  return parts.join("");
}

function renderScanUnits(state, startX, startY, cols, rows, cell, px, py) {
  const parts = [];
  const activeBody = getActiveBody(state);
  const units = Array.isArray(state.units) ? state.units : [];

  for (const unit of units) {
    if (unit.embarked === true) continue;
    const x = Number(unit.x ?? 0);
    const y = Number(unit.y ?? 0);
    if (!isInScanBounds(x, y, startX, startY, cols, rows)) continue;

    const isActive = activeBody?.instanceId === unit.instanceId;
    const centerX = px(x) + (cell / 2);
    const centerY = py(y) + (cell / 2);
    const radius = Math.max(4, cell * (unit.unitType === "mech" ? 0.38 : 0.28));
    const cssClass = [
      "hud-scan-unit",
      unit.team === "enemy" ? "hud-scan-unit--enemy" : "hud-scan-unit--player",
      isActive ? "hud-scan-unit--active" : ""
    ].filter(Boolean).join(" ");

    if (unit.unitType === "mech") {
      const size = cell * 0.82;
      parts.push(`<rect x="${fmt(centerX - (size / 2))}" y="${fmt(centerY - (size / 2))}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(cell * 0.14)}" class="${cssClass}"/>`);
    } else {
      parts.push(`<circle cx="${fmt(centerX)}" cy="${fmt(centerY)}" r="${fmt(radius)}" class="${cssClass}"/>`);
    }

    if (isActive) {
      parts.push(`<text x="${fmt(centerX)}" y="${fmt(Math.max(8, centerY - radius - 4))}" class="hud-scan-label">${escapeHtml(unit.pilotName ?? unit.name ?? "Active")}</text>`);
    }
  }

  return parts.join("");
}

function renderScanFocus(state, startX, startY, cols, rows, cell, px, py) {
  const x = Number(state.focus?.x ?? NaN);
  const y = Number(state.focus?.y ?? NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
  if (!isInScanBounds(x, y, startX, startY, cols, rows)) return "";

  return `<rect x="${fmt(px(x) + 2)}" y="${fmt(py(y) + 2)}" width="${fmt(Math.max(0, cell - 4))}" height="${fmt(Math.max(0, cell - 4))}" class="hud-scan-focus"/>`;
}

function getScanEdgeLine(x, y, edge, cell, px, py) {
  const left = px(x);
  const top = py(y);
  const right = left + cell;
  const bottom = top + cell;

  switch (String(edge ?? "").toLowerCase()) {
    case "ne": return { x1: left, y1: top, x2: right, y2: top };
    case "se": return { x1: right, y1: top, x2: right, y2: bottom };
    case "sw": return { x1: left, y1: bottom, x2: right, y2: bottom };
    case "nw": return { x1: left, y1: top, x2: left, y2: bottom };
    default: return null;
  }
}

function isInScanBounds(x, y, startX, startY, cols, rows) {
  return x >= startX && y >= startY && x < startX + cols && y < startY + rows;
}

function fmt(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

/* =========================
   SUB VIEWS
========================= */

function renderCommandMenu(state) {
  const menu = state.ui.commandMenu;

  return `
    <div class="hud-menu-grid">
    ${menu.items.map((item, i) => {
      const isDisabled = isCommandMenuItemDisabled(state, item);
      return `
      <button 
        class="hud-menu-button ${i === menu.index ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}" 
        data-hud-action="menu-select"
        data-menu-action="${item}"
        ${isDisabled ? "disabled" : ""}>
        ${i === menu.index ? "▶ " : ""}${item}
      </button>
    `;
    }).join("")}
    </div>
  `;
}

function renderAbilityMenu(state) {
  const items = getSelectedAbilityMenuItems(state);

  return `
    <div class="hud-card-title">Ability</div>
    <div class="hud-menu-grid">
      ${items.map((a, i) => {
        const isSelected = i === state.ui.action.menuIndex;
        const isDisabled = a.enabled === false;
        return `
          <button
            class="hud-menu-button ${isSelected ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}"
            ${isDisabled ? "disabled" : ""}
          >
            ${isSelected ? "▶ " : ""}${escapeHtml(a.label)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderAttackMenu(state) {
  const items = getSelectedAttackMenuItems(state);

  return `
    <div class="hud-card-title">Attack</div>
    <div class="hud-menu-grid">
      ${items.map((a, i) => `
        <button class="hud-menu-button ${i === state.ui.action.menuIndex ? "is-selected" : ""}">
          ${i === state.ui.action.menuIndex ? "▶ " : ""}${escapeHtml(a.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderItemMenu(state) {
  const items = getSelectedItemMenuItems(state);

  return `
    <div class="hud-card-title">Item</div>
    <div class="hud-menu-grid">
      ${items.map((a, i) => {
        const isSelected = i === state.ui.action.menuIndex;
        const isDisabled = a.enabled === false;
        return `
          <button
            class="hud-menu-button ${isSelected ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}"
            ${isDisabled ? "disabled" : ""}
          >
            ${isSelected ? "▶ " : ""}${escapeHtml(a.label)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderTargeting() {
  return `
    <div class="hud-card-title">Targeting</div>
    <div class="hud-prompt-pill">Select target</div>
  `;
}

function renderMove() {
  return `
    <div class="hud-card-title">Move</div>
    <div class="hud-prompt-pill">Select tile</div>
  `;
}

function renderFacing() {
  return `
    <div class="hud-card-title">Facing</div>
    <div class="hud-prompt-pill">Choose direction</div>
  `;
}

/* =========================
   HELPERS
========================= */

function stat(label, value) {
  return `
    <div class="hud-inline-stat">
      <div class="hud-inline-stat-label">${escapeHtml(label)}</div>
      <div class="hud-inline-stat-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function compactStat(label, value) {
  return `
    <div class="hud-compact-stat">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function vitalBar(label, value, maxValue, kind) {
  const current = Number(value ?? 0);
  const max = Math.max(1, Number(maxValue ?? value ?? 1));
  const percent = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  return `
    <div class="hud-vital hud-vital--${escapeClassToken(kind || label)}">
      <div class="hud-vital-top"><span>${escapeHtml(label)}</span><b>${escapeHtml(`${current}/${max}`)}</b></div>
      <div class="hud-vital-track"><i style="width:${percent}%"></i></div>
    </div>
  `;
}

function facingLabel(f) {
  return ["N", "E", "S", "W"][f] ?? "?";
}

function renderDeploymentPanel(state) {
  const available = getDeploymentAvailableRoster(state);
  const selectedIndex = Math.max(0, Math.min(Number(state.ui.deployment.listIndex ?? 0), Math.max(0, available.length - 1)));
  const placedUnit = getDeploymentPlacedUnitAt(state, state.focus.x, state.focus.y);

  if (state.ui.deployment.listOpen) {
    return `
      <div class="hud-section-title">Available Units</div>
      <div class="hud-mini-card" style="margin-bottom:8px;">Select ${state.ui.deployment.unitType} for (${state.focus.x}, ${state.focus.y})</div>
      ${available.length ? available.map((entry, index) => `
        <button class="hud-menu-button ${index === selectedIndex ? "is-selected" : ""}">
          ${index === selectedIndex ? "▶ " : ""}${entry.displayName ?? entry.definition?.name ?? entry.pilotDefinitionId}
        </button>
      `).join("") : `<div class="hud-mini-card">No available units.</div>`}
    `;
  }

  if (placedUnit) {
    return `
      <div class="hud-section-title">Placed Unit</div>
      <div class="hud-mini-card">
        <div>${placedUnit.name}</div>
        <div style="opacity:.7;">Press Esc to remove</div>
      </div>
      <div class="hud-stat-grid">
        ${stat("SHD", placedUnit.shield)}
        ${stat("CORE", placedUnit.core)}
        ${stat("MV", placedUnit.move)}
        ${stat("CTRL", placedUnit.controlType)}
      </div>
    `;
  }

  return `
    <div class="hud-section-title">Deploy Tile</div>
    <div class="hud-mini-card">(${state.focus.x}, ${state.focus.y})</div>
    <div class="hud-mode-box">
      <div class="hud-mode-title">Available ${state.ui.deployment.unitType === "mech" ? "Mechs" : "Pilots"}</div>
      <div class="hud-mode-text">${available.length} remaining</div>
    </div>
  `;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeClassToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}
