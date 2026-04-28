export function renderFrontScreen(state, refs) {
  const frontScreen = refs?.frontScreen;
  const main = refs?.main;
  const titleScreen = refs?.titleScreen;
  const missionSelectScreen = refs?.missionSelectScreen;
  const missionBriefingScreen = refs?.missionBriefingScreen;
  const titleStartButton = refs?.titleStartButton;
  const titleMissionSelectButton = refs?.titleMissionSelectButton;
  const missionList = refs?.missionList;
  const missionDescription = refs?.missionDescription;
  const missionStartButton = refs?.missionStartButton;
  const missionBackButton = refs?.missionBackButton;
  const briefingTitle = refs?.briefingTitle;
  const briefingMap = refs?.briefingMap;
  const briefingText = refs?.briefingText;
  const briefingObjectives = refs?.briefingObjectives;
  const briefingBackButton = refs?.briefingBackButton;
  const briefingStartButton = refs?.briefingStartButton;

  if (!frontScreen || !main || !titleScreen || !missionSelectScreen) return;

  const screen = state?.ui?.shell?.screen ?? "game";
  const selectedMissionId = getSelectedMissionId(state);
  const missions = getMissionEntries(state);
  const selectedMission = missions.find((entry) => entry.id === selectedMissionId) ?? missions[0] ?? null;
  const titleMenuIndex = Number.isFinite(Number(state?.ui?.shell?.titleMenuIndex))
    ? Number(state.ui.shell.titleMenuIndex)
    : 0;

  frontScreen.classList.toggle("is-hidden", screen === "game");
  main.classList.toggle("is-hidden", screen !== "game");
  titleScreen.classList.toggle("is-hidden", screen !== "title");
  missionSelectScreen.classList.toggle("is-hidden", screen !== "mission-select");
  missionBriefingScreen?.classList.toggle("is-hidden", screen !== "mission-briefing");

  if (missionBackButton) {
    missionBackButton.disabled = false;
  }

  if (briefingBackButton) {
    briefingBackButton.disabled = false;
  }

  if (titleStartButton) {
    titleStartButton.classList.toggle("is-selected", screen === "title" && titleMenuIndex === 0);
  }

  if (titleMissionSelectButton) {
    titleMissionSelectButton.classList.toggle("is-selected", screen === "title" && titleMenuIndex === 1);
  }

  if (missionList) {
    missionList.innerHTML = missions
      .map((entry) => {
        const isSelected = entry.id === selectedMission?.id;
        return `
          <button
            type="button"
            class="front-screen-list-button${isSelected ? " is-selected" : ""}"
            data-front-screen-mission-id="${escapeHtml(entry.id)}"
          >
            <span class="front-screen-list-title">${escapeHtml(entry.name || entry.id)}</span>
            <span class="front-screen-list-sub">${escapeHtml(entry.id)}</span>
          </button>
        `;
      })
      .join("");
  }

  if (missionDescription) {
    if (selectedMission) {
      missionDescription.innerHTML = `
        <div class="front-screen-card-title">${escapeHtml(selectedMission.name || selectedMission.id)}</div>
        <div class="front-screen-card-text">
          ${escapeHtml(selectedMission.summary || "Load this mission through the mission runtime.")}
        </div>
        <div class="front-screen-card-text" style="margin-top:10px;">
          Mission file: <strong>${escapeHtml(selectedMission.path || "fallback map wrapper")}</strong>
        </div>
      `;
    } else {
      missionDescription.innerHTML = `
        <div class="front-screen-card-title">No Mission Available</div>
        <div class="front-screen-card-text">No missions were found in the current mission catalog.</div>
      `;
    }
  }

  if (missionStartButton) {
    missionStartButton.disabled = !selectedMission;
  }

  const briefingMission = state?.ui?.shell?.briefingMission ?? selectedMission ?? null;
  const briefing = state?.ui?.shell?.briefingDefinition?.briefing ?? null;
  const objectiveLabels = getBriefingObjectiveLabels(state?.ui?.shell?.briefingDefinition, briefing);

  if (briefingTitle) {
    briefingTitle.textContent = briefing?.title || briefingMission?.name || briefingMission?.id || "Mission Briefing";
  }

  if (briefingMap) {
    const mapId = state?.ui?.shell?.briefingDefinition?.mapId || briefingMission?.mapId || "unknown_map";
    briefingMap.textContent = `MAP: ${mapId}`;
  }

  if (briefingText) {
    briefingText.textContent = briefing?.text || briefingMission?.summary || "Review mission details, then start the operation.";
  }

  if (briefingObjectives) {
    briefingObjectives.innerHTML = objectiveLabels.length
      ? objectiveLabels.map((label) => `<li>${escapeHtml(label)}</li>`).join("")
      : `<li>Defeat all enemy pilots.</li>`;
  }

  if (briefingStartButton) {
    briefingStartButton.disabled = !briefingMission;
  }
}

export function getMissionEntries(state) {
  const missions = Array.isArray(state?.content?.missionCatalog?.missions) ? state.content.missionCatalog.missions : [];
  if (missions.length) {
    return missions.map((entry) => ({ ...entry, sourceType: "mission" })).sort(compareMissionEntries);
  }

  const maps = Array.isArray(state?.content?.mapCatalog?.maps) ? state.content.mapCatalog.maps : [];
  return maps.map((entry) => ({
    id: entry.id,
    name: entry.name,
    path: entry.path,
    mapId: entry.id,
    mapPath: entry.path,
    sourceType: "map-fallback",
    summary: "Fallback map entry. No mission catalog was found."
  })).sort(compareMissionEntries);
}

export function getMissionMaps(state) {
  return getMissionEntries(state);
}

function getSelectedMissionId(state) {
  return state?.ui?.shell?.selectedMissionId
    ?? state?.ui?.shell?.selectedMapId
    ?? state?.content?.missionCatalog?.defaultMissionId
    ?? state?.content?.mapCatalog?.defaultMapId
    ?? null;
}

function getBriefingObjectiveLabels(missionDefinition, briefing) {
  const briefingObjectives = Array.isArray(briefing?.objectives) ? briefing.objectives : [];
  if (briefingObjectives.length) return briefingObjectives.map((item) => String(item));

  const objectives = Array.isArray(missionDefinition?.objectives) ? missionDefinition.objectives : [];
  return objectives
    .map((objective) => objective?.label || objective?.id || objective?.type)
    .filter(Boolean);
}

function compareMissionEntries(a, b) {
  const aLabel = String(a?.name || a?.id || "");
  const bLabel = String(b?.name || b?.id || "");
  return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: "base" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
