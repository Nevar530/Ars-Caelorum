import { getCurrentDialogueLine, getMissionResultCopy } from "../mission/missionState.js";
import { getUnitById } from "../mechs.js";
import { renderGameMenu } from "./gameMenu.js";
import { getMissionFlowBranch } from "../campaign/campaignFlow.js";

export function renderMissionOverlay(state, refs) {
  const overlay = refs?.combatOverlay;
  if (!overlay) return;

  const missionResult = state?.mission?.result ?? null;
  const phaseBriefingActive = Boolean(state?.ui?.phaseBriefing?.active);
  const dialogueActive = Boolean(state?.ui?.dialogue?.active);
  const splashVisible = Boolean(state?.turn?.splashVisible);
  const splashText = String(state?.turn?.splashText ?? "").trim();
  const splashKind = state?.turn?.splashKind ?? null;

  overlay.innerHTML = "";
  overlay.className = "combat-overlay is-clickthrough";

  if (state?.ui?.gameMenu?.open) {
    overlay.classList.add("is-visible", "is-game-menu-visible");
    overlay.classList.remove("is-clickthrough");
    overlay.innerHTML = renderGameMenu(state);
    return;
  }

  if (phaseBriefingActive) {
    overlay.classList.add("is-visible", "is-phase-briefing-visible");
    overlay.classList.remove("is-clickthrough");
    overlay.innerHTML = renderPhaseBriefingOverlay(state);
    return;
  }

  if (missionResult && !dialogueActive) {
    const copy = getMissionResultCopy(state, missionResult);

    overlay.classList.add("is-visible");
    overlay.classList.remove("is-clickthrough");

    overlay.innerHTML = `
      <div class="combat-overlay-card" role="dialog" aria-modal="true" aria-label="Mission Result">
        <div class="combat-overlay-title">${escapeHtml(copy.title)}</div>
        <div class="combat-overlay-text">${escapeHtml(copy.text)}</div>
        ${renderCampaignRewardSummary(state)}
        ${renderMissionResultActions(state, missionResult)}
      </div>
    `;
    return;
  }

  if (dialogueActive) {
    overlay.classList.add("is-visible", "is-dialogue-visible");
    overlay.classList.remove("is-clickthrough");
    overlay.innerHTML = renderDialogueOverlay(state);
    return;
  }

  if (splashVisible && splashText) {
    const splash = getSplashParts(splashText, splashKind);
    overlay.classList.add("is-visible", "is-clickthrough", "is-splash-visible");
    overlay.innerHTML = `
      <div class="combat-splash-card combat-splash-card--${escapeClassToken(splash.kind)}" aria-live="polite">
        <div class="combat-splash-round">${escapeHtml(splash.topLine)}</div>
        <div class="combat-splash-phase">${escapeHtml(splash.bottomLine)}</div>
      </div>
    `;
    return;
  }

  if (shouldShowTurnPopup(state)) {
    overlay.classList.add("is-visible", "is-clickthrough", "is-turn-visible");
    overlay.innerHTML = renderTurnPopup(state);
    return;
  }
}

function renderMissionResultActions(state, result) {
  const branch = getMissionFlowBranch(state?.mission?.definition, result);
  const missionId = String(branch?.loadMissionId ?? "").trim();

  if (result === "defeat") {
    return `
      <div class="combat-overlay-actions">
        <button type="button" class="combat-start-button" data-combat-overlay-action="mission-result-flow" data-flow-action="restart">Restart Mission</button>
        <button type="button" class="combat-start-button" data-combat-overlay-action="mission-result-flow" data-flow-action="loadMission"${missionId ? ` data-load-mission-id="${escapeHtml(missionId)}"` : ""}>Load Mission</button>
        <button type="button" class="combat-start-button" data-combat-overlay-action="mission-result-flow" data-flow-action="mainMenu">Main Menu</button>
      </div>
    `;
  }

  const continueLabel = missionId ? "Continue" : "Continue";
  return `
    <div class="combat-overlay-actions">
      <button type="button" class="combat-start-button" data-combat-overlay-action="mission-result-flow" data-flow-action="continue"${missionId ? ` data-load-mission-id="${escapeHtml(missionId)}"` : ""}>${escapeHtml(continueLabel)}</button>
      <button type="button" class="combat-start-button" data-combat-overlay-action="mission-result-flow" data-flow-action="restart">Restart Mission</button>
      <button type="button" class="combat-start-button" data-combat-overlay-action="mission-result-flow" data-flow-action="mainMenu">Main Menu</button>
    </div>
  `;
}

function renderCampaignRewardSummary(state) {
  const reward = state?.mission?.campaignReward ?? null;
  const receipt = state?.mission?.resultReceipt ?? null;
  if (!reward && !receipt) return "";

  const rows = [];
  if (receipt) {
    rows.push(`<div><strong>Mission:</strong> ${escapeHtml(receipt.missionId)}</div>`);
    rows.push(`<div><strong>Rounds:</strong> ${escapeHtml(receipt.roundsTaken)}</div>`);
  }

  if (reward) {
    if (reward.applied) {
      if (reward.levelMilestone) rows.push(`<div><strong>Level Milestone:</strong> +${escapeHtml(reward.levelMilestone)}</div>`);
      rows.push(`<div><strong>Credits:</strong> ${escapeHtml(reward.currency)}</div>`);
      if (reward.activeLevelUps?.length) rows.push(`<div><strong>Active Level Ups:</strong> ${escapeHtml(formatPilotLevelChanges(reward.activeLevelUps))}</div>`);
      if (Number.isFinite(Number(reward.reserveFloor))) rows.push(`<div><strong>Reserve Training:</strong> Pilots below Level ${escapeHtml(reward.reserveFloor)} trained up</div>`);
      if (reward.reserveCatchUps?.length) rows.push(`<div><strong>Reserve Level Gains:</strong> ${escapeHtml(formatPilotLevelChanges(reward.reserveCatchUps))}</div>`);
      if (reward.recruits?.length) rows.push(`<div><strong>Recruited:</strong> ${escapeHtml(reward.recruits.join(", "))}</div>`);
      if (reward.items?.length) rows.push(`<div><strong>Items:</strong> ${escapeHtml(reward.items.join(", "))}</div>`);
      if (reward.unlocks?.length) rows.push(`<div><strong>Unlocked:</strong> ${escapeHtml(reward.unlocks.join(", "))}</div>`);
    } else if (reward.reason === "already_claimed") {
      rows.push(`<div><strong>Rewards:</strong> Already claimed</div>`);
    } else {
      rows.push(`<div><strong>Rewards:</strong> None</div>`);
    }
  }

  return rows.length
    ? `<div class="combat-overlay-text combat-overlay-reward-summary">${rows.join("")}</div>`
    : "";
}

function formatPilotLevelChanges(changes = []) {
  return (Array.isArray(changes) ? changes : [])
    .filter((entry) => entry?.gained)
    .map((entry) => `${entry.pilotId} ${entry.fromLevel}->${entry.toLevel}`)
    .join(", ");
}

function renderPhaseBriefingOverlay(state) {
  const briefing = state?.ui?.phaseBriefing ?? {};
  const objectives = Array.isArray(briefing.objectives) ? briefing.objectives : [];
  return `
    <div class="phase-briefing-card" role="dialog" aria-modal="true" aria-label="Phase Briefing">
      <div class="phase-briefing-kicker">Mission Update</div>
      <div class="phase-briefing-title">${escapeHtml(briefing.title || "Mission Update")}</div>
      ${briefing.subtitle ? `<div class="phase-briefing-subtitle">${escapeHtml(briefing.subtitle)}</div>` : ""}
      <div class="phase-briefing-text">${escapeHtml(briefing.text || "Review the current phase objectives, then continue.")}</div>
      <div class="phase-briefing-objectives-title">Objectives</div>
      <ul class="phase-briefing-objectives">
        ${objectives.length ? objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li>Complete the current phase.</li>`}
      </ul>
      <button type="button" class="combat-start-button" data-combat-overlay-action="continue-phase-briefing">Continue</button>
    </div>
  `;
}

function renderDialogueOverlay(state) {
  const line = getCurrentDialogueLine(state);
  const dialogue = state?.ui?.dialogue ?? {};
  const lines = Array.isArray(dialogue.lines) ? dialogue.lines : [];
  const index = Math.max(0, Number(dialogue.index ?? 0));
  const speakerName = String(line?.name ?? "Unknown");
  const missionLabel = dialogue.key ? String(dialogue.key).replaceAll("_", " ") : "mission";
  const options = Array.isArray(line?.options) ? line.options : [];
  const optionIndex = Math.max(0, Math.min(Number(dialogue.optionIndex ?? 0), Math.max(0, options.length - 1)));

  return `
    <div class="dialogue-rise dialogue-rise--active-only" role="dialog" aria-label="Dialogue">
      ${renderSpeakerCard({
        side: "left",
        label: speakerName,
        line,
        active: true,
        fallbackName: speakerName
      })}

      <div class="dialogue-center-card">
        <div class="dialogue-kicker">${escapeHtml(missionLabel)}</div>
        <div class="dialogue-speaker-name">${escapeHtml(speakerName)}</div>
        <div class="dialogue-line-text">${escapeHtml(line?.text || "")}</div>
        ${options.length ? renderDialogueOptions(options, optionIndex) : ""}
        <div class="dialogue-footer">
          <span>Line ${Math.min(index + 1, lines.length)} / ${lines.length}</span>
          ${options.length
            ? `<span>Arrow keys select · Enter confirms</span>`
            : `<button type="button" class="dialogue-continue-button" data-combat-overlay-action="advance-dialogue">Continue</button>`}
        </div>
      </div>
    </div>
  `;
}

function renderDialogueOptions(options, selectedIndex) {
  return `
    <div class="dialogue-options" role="listbox" aria-label="Dialogue choices">
      ${options.map((option, index) => `
        <button type="button" class="dialogue-option-button ${index === selectedIndex ? "is-selected" : ""}" data-combat-overlay-action="select-dialogue-option" data-dialogue-option-index="${index}">
          ${escapeHtml(option.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderSpeakerCard({ side, label, line, active, fallbackName }) {
  const name = line?.name || fallbackName || label || "?";
  const initial = String(name).trim().charAt(0).toUpperCase() || "?";
  const portrait = line?.portrait
    ? `<img src="${escapeHtml(line.portrait)}" alt="${escapeHtml(name)} portrait" onerror="this.onerror=null;this.src='art/pilot/blank_portrait.png';" />`
    : escapeHtml(initial);

  return `
    <div class="dialogue-speaker-card dialogue-speaker-card--${escapeClassToken(side)} ${active ? "is-active" : "is-muted"}">
      <div class="dialogue-speaker-portrait">${portrait}</div>
      <div class="dialogue-speaker-label">${escapeHtml(name)}</div>
    </div>
  `;
}

function findSkyeLine(lines) {
  return lines.find((entry) => {
    const id = String(entry?.speakerId ?? "").toLowerCase();
    const name = String(entry?.name ?? "").toLowerCase();
    return id === "skye" || name.includes("skye");
  }) ?? null;
}

function findOtherLine(lines) {
  return lines.find((entry) => {
    const id = String(entry?.speakerId ?? "").toLowerCase();
    const name = String(entry?.name ?? "").toLowerCase();
    return id !== "skye" && !name.includes("skye");
  }) ?? null;
}

function shouldShowTurnPopup(state) {
  if (!state?.turn?.combatStarted) return false;
  if (state?.mission?.result) return false;
  const phase = String(state?.turn?.phase ?? "");
  return phase === "move" || phase === "action";
}

function renderTurnPopup(state) {
  const isMove = state.turn.phase === "move";
  const order = isMove ? state.turn.moveOrder : state.turn.actionOrder;
  const index = isMove ? state.turn.moveIndex : state.turn.actionIndex;
  const activeId = Array.isArray(order) && index >= 0 ? order[index] : null;
  const activeUnit = activeId ? getUnitById(state.units, activeId) : null;
  const next = getNextTurnEntries(state, order, index, 3);
  const initText = activeUnit ? getInitiativeText(state, activeUnit.instanceId) : "-";

  return `
    <div class="turn-rise" aria-live="polite">
      <div class="turn-rise-topline">Round ${escapeHtml(state.turn.round)} · ${isMove ? "Move Phase" : "Action Phase"}</div>
      <div class="turn-rise-active">
        <span>${escapeHtml(activeUnit?.name ?? "No Active Unit")}</span>
        <b>INIT ${escapeHtml(initText)}</b>
      </div>
      <div class="turn-rise-next">
        <span>${isMove ? "Next to move" : "Next to act"}</span>
        ${next.length ? next.map((entry) => `
          <div class="turn-rise-next-row">
            <span>${escapeHtml(entry.name)}</span>
            <b>${escapeHtml(entry.init)}</b>
          </div>
        `).join("") : `<div class="turn-rise-next-row"><span>Phase ending</span><b>-</b></div>`}
      </div>
    </div>
  `;
}

function getNextTurnEntries(state, order, index, count) {
  if (!Array.isArray(order)) return [];
  const entries = [];
  for (let i = index + 1; i < order.length && entries.length < count; i += 1) {
    const unit = getUnitById(state.units, order[i]);
    if (!unit || unit.status === "disabled") continue;
    entries.push({
      name: unit.name,
      init: getInitiativeText(state, unit.instanceId)
    });
  }
  return entries;
}

function getInitiativeText(state, instanceId) {
  const roll = Array.isArray(state?.turn?.lastInitiativeRolls)
    ? state.turn.lastInitiativeRolls.find((entry) => entry.instanceId === instanceId)
    : null;
  if (!roll) {
    const unit = getUnitById(state.units, instanceId);
    return unit?.initiative ?? "-";
  }
  const dice = Array.isArray(roll.dice) && roll.dice.length === 2
    ? `${roll.dice[0]}+${roll.dice[1]}+${roll.reaction}`
    : `${roll.initiative}`;
  return `${roll.initiative} (${dice})`;
}

function getSplashParts(text, kind) {
  const normalized = String(text ?? "").trim();
  const [first, ...rest] = normalized.split("—");
  const topLine = first?.trim() || normalized || "ROUND";
  const bottomLine = rest.join("—").trim() || normalized || "PHASE";

  return {
    kind: kind || "round-phase",
    topLine,
    bottomLine
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeClassToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}
