import { getMissionCatalog, getMissionDefinitionById } from "../mission/missionCatalog.js";

function renderMainMenu(overlay) {
  overlay.classList.add("is-visible");
  overlay.innerHTML = `
    <div class="combat-overlay-card" role="dialog" aria-modal="true" aria-label="Main Menu">
      <div class="combat-overlay-title">Ars Caelorum</div>
      <div class="combat-overlay-text">Mission shell foundation is now live. Start from mission select instead of dropping straight into the old test bootstrap.</div>
      <div class="combat-overlay-actions">
        <button type="button" class="combat-start-button" data-combat-overlay-action="open-mission-select">Mission Select</button>
      </div>
    </div>
  `;
}

function renderMissionSelect(state, overlay) {
  const catalog = getMissionCatalog(state.content);
  const selectedMissionId = state?.mission?.selectedMissionId ?? catalog.defaultMissionId ?? null;
  const selectedMission = getMissionDefinitionById(state.content, selectedMissionId) ?? catalog.missions[0] ?? null;

  overlay.classList.add("is-visible");

  const missionButtons = catalog.missions.map((mission) => `
    <button
      type="button"
      class="combat-start-button combat-start-button--stacked ${mission.id === selectedMission?.id ? "is-selected" : ""}"
      data-combat-overlay-action="select-mission"
      data-mission-id="${mission.id}"
    >
      ${mission.name}
    </button>
  `).join("");

  overlay.innerHTML = `
    <div class="combat-overlay-card combat-overlay-card--wide" role="dialog" aria-modal="true" aria-label="Mission Select">
      <div class="combat-overlay-title">Mission Select</div>
      <div class="combat-overlay-text">Choose a mission. For this pass, mission selection is the startup authority.</div>
      <div class="combat-overlay-shell-grid">
        <div class="combat-overlay-mission-list">${missionButtons}</div>
        <div class="combat-overlay-mission-detail">
          <div class="combat-overlay-detail-title">${selectedMission?.name ?? "No Mission Selected"}</div>
          <div class="combat-overlay-detail-meta">Type: ${selectedMission?.missionType ?? "-"}</div>
          <div class="combat-overlay-detail-text">${selectedMission?.description ?? "Pick a mission to load its map and authored runtime setup."}</div>
        </div>
      </div>
      <div class="combat-overlay-actions">
        <button type="button" class="combat-start-button combat-start-button--secondary" data-combat-overlay-action="return-main-menu">Back</button>
        <button type="button" class="combat-start-button" data-combat-overlay-action="start-selected-mission" ${selectedMission ? "" : "disabled"}>Load Mission</button>
      </div>
    </div>
  `;
}

function renderMissionResult(state, overlay) {
  const missionResult = state?.mission?.result ?? null;
  const title = missionResult === "victory" ? "Victory" : "Defeat";
  const text = missionResult === "victory"
    ? "Mission complete. Restart the current mission or return to mission select."
    : "Mission failed. Restart the current mission or return to mission select.";

  overlay.classList.add("is-visible");
  overlay.innerHTML = `
    <div class="combat-overlay-card" role="dialog" aria-modal="true" aria-label="Mission Result">
      <div class="combat-overlay-title">${title}</div>
      <div class="combat-overlay-text">${text}</div>
      <div class="combat-overlay-actions">
        <button type="button" class="combat-start-button combat-start-button--secondary" data-combat-overlay-action="return-main-menu">Main Menu</button>
        <button type="button" class="combat-start-button combat-start-button--secondary" data-combat-overlay-action="return-mission-select">Mission Select</button>
        <button type="button" class="combat-start-button" data-combat-overlay-action="restart-mission">Restart Mission</button>
      </div>
    </div>
  `;
}

export function renderMissionOverlay(state, refs) {
  const overlay = refs?.combatOverlay;
  if (!overlay) return;

  const shellScreen = state?.ui?.shell?.screen ?? "in-mission";
  const missionResult = state?.mission?.result ?? null;
  overlay.innerHTML = "";
  overlay.classList.remove("is-visible", "is-clickthrough");

  if (missionResult) {
    renderMissionResult(state, overlay);
    return;
  }

  if (shellScreen === "main-menu") {
    renderMainMenu(overlay);
    return;
  }

  if (shellScreen === "mission-select") {
    renderMissionSelect(state, overlay);
    return;
  }

  overlay.classList.add("is-clickthrough");
}
