export function renderMissionOverlay(state, refs) {
  const overlay = refs?.combatOverlay;
  if (!overlay) return;

  const missionResult = state?.mission?.result ?? null;
  const splashVisible = Boolean(state?.turn?.splashVisible);
  const splashText = String(state?.turn?.splashText ?? "").trim();
  const splashKind = state?.turn?.splashKind ?? null;

  overlay.innerHTML = "";
  overlay.classList.remove("is-visible", "is-clickthrough", "is-splash-visible");

  if (missionResult) {
    const title = missionResult === "victory" ? "Victory" : "Defeat";
    const text = missionResult === "victory"
      ? "Mission complete. Return to the title screen to choose another mission."
      : "Mission failed. Return to the title screen to try again.";

    overlay.classList.add("is-visible");

    overlay.innerHTML = `
      <div class="combat-overlay-card" role="dialog" aria-modal="true" aria-label="Mission Result">
        <div class="combat-overlay-title">${title}</div>
        <div class="combat-overlay-text">${text}</div>
        <button
          type="button"
          class="combat-start-button"
          data-combat-overlay-action="return-title"
        >
          Return to Title Screen
        </button>
      </div>
    `;
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

  overlay.classList.add("is-clickthrough");
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
