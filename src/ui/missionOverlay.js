export function renderMissionOverlay(state, refs) {
  const overlay = refs?.combatOverlay;
  if (!overlay) return;

  const missionResult = state?.mission?.result ?? null;
  overlay.innerHTML = "";
  overlay.classList.remove("is-visible", "is-clickthrough");

  if (!missionResult) {
    overlay.classList.add("is-clickthrough");
    return;
  }

  const title = missionResult === "victory" ? "Victory" : "Defeat";
  const text = missionResult === "victory"
    ? "Validation pass complete. Restart the mission to run it again."
    : "Mission failed. Restart to validate the flow again.";

  overlay.classList.add("is-visible");

  overlay.innerHTML = `
    <div class="combat-overlay-card" role="dialog" aria-modal="true" aria-label="Mission Result">
      <div class="combat-overlay-title">${title}</div>
      <div class="combat-overlay-text">${text}</div>
      <button
        type="button"
        class="combat-start-button"
        data-combat-overlay-action="restart-mission"
      >
        Restart Mission
      </button>
    </div>
  `;
}
