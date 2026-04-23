export function renderFrontScreen(state, refs) {
  const frontScreen = refs?.frontScreen;
  const main = refs?.main;
  const titleScreen = refs?.titleScreen;
  const missionSelectScreen = refs?.missionSelectScreen;
  const titleStartButton = refs?.titleStartButton;
  const titleMissionSelectButton = refs?.titleMissionSelectButton;
  const missionList = refs?.missionList;
  const missionDescription = refs?.missionDescription;
  const missionStartButton = refs?.missionStartButton;
  const missionBackButton = refs?.missionBackButton;

  if (!frontScreen || !main || !titleScreen || !missionSelectScreen) return;

  const screen = state?.ui?.shell?.screen ?? "game";
  const selectedMapId = state?.ui?.shell?.selectedMapId ?? null;
  const maps = getMissionMaps(state);
  const selectedMap = maps.find((entry) => entry.id === selectedMapId) ?? maps[0] ?? null;
  const titleMenuIndex = Number.isFinite(Number(state?.ui?.shell?.titleMenuIndex))
    ? Number(state.ui.shell.titleMenuIndex)
    : 0;

  frontScreen.classList.toggle("is-hidden", screen === "game");
  main.classList.toggle("is-hidden", screen !== "game");
  titleScreen.classList.toggle("is-hidden", screen !== "title");
  missionSelectScreen.classList.toggle("is-hidden", screen !== "mission-select");

  if (missionBackButton) {
    missionBackButton.disabled = false;
  }

  if (titleStartButton) {
    titleStartButton.classList.toggle("is-selected", screen === "title" && titleMenuIndex === 0);
  }

  if (titleMissionSelectButton) {
    titleMissionSelectButton.classList.toggle("is-selected", screen === "title" && titleMenuIndex === 1);
  }

  if (missionList) {
    missionList.innerHTML = maps
      .map((entry) => {
        const isSelected = entry.id === selectedMap?.id;
        return `
          <button
            type="button"
            class="front-screen-list-button${isSelected ? " is-selected" : ""}"
            data-front-screen-map-id="${escapeHtml(entry.id)}"
          >
            <span class="front-screen-list-title">${escapeHtml(entry.name)}</span>
            <span class="front-screen-list-sub">${escapeHtml(entry.id)}</span>
          </button>
        `;
      })
      .join("");
  }

  if (missionDescription) {
    if (selectedMap) {
      missionDescription.innerHTML = `
        <div class="front-screen-card-title">${escapeHtml(selectedMap.name)}</div>
        <div class="front-screen-card-text">
          Load the existing <strong>${escapeHtml(selectedMap.id)}</strong> map using the current stable runtime.
        </div>
      `;
    } else {
      missionDescription.innerHTML = `
        <div class="front-screen-card-title">No Mission Available</div>
        <div class="front-screen-card-text">No playable maps were found in the current map catalog.</div>
      `;
    }
  }

  if (missionStartButton) {
    missionStartButton.disabled = !selectedMap;
  }
}

function getMissionMaps(state) {
  const maps = Array.isArray(state?.content?.mapCatalog?.maps) ? state.content.mapCatalog.maps : [];
  return maps.filter((entry) => entry?.id === "default" || entry?.id === "embark_test");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
