// src/ui/helpDrawer.js

import { isDeploymentActive, isDeploymentMenuFocused } from "../deployment/deploymentState.js";
import { isStoryMode } from "../mode/mapMode.js";

function section(title, items) {
  return { title, items };
}

function interfaceSection() {
  return section("Interface", [
    { key: "F1", label: "Toggle help" },
    { key: "Esc", label: "Close help / cancel current mode" },
    { key: "`", label: "Toggle dev menu / builder" }
  ]);
}

function cameraSection() {
  return section("Camera / View", [
    { key: "Q / E", label: "Rotate map left / right" },
    { key: "R", label: "Toggle tactical view" },
    { key: "+ / -", label: "Zoom in / out" }
  ]);
}

function cursorSection(label = "Move cursor") {
  return section("Cursor", [
    { key: "W / A / S / D", label },
    { key: "Arrow Keys", label },
    { key: "Tab", label: "Snap to active unit" }
  ]);
}

function getDialogueSections() {
  return [
    section("Dialogue", [
      { key: "Enter / Space", label: "Advance dialogue" },
      { key: "F1", label: "Toggle help" }
    ]),
    interfaceSection()
  ];
}

function getMissionResultSections() {
  return [
    section("Mission Result", [
      { key: "Mouse", label: "Use result screen buttons" },
      { key: "F1", label: "Toggle help" }
    ]),
    interfaceSection()
  ];
}

function getStorySections(state) {
  const title = state?.turn?.activeBodyId || state?.turn?.activeActorId
    ? "Story / Exploration"
    : "Story / Exploration";

  return [
    section(title, [
      { key: "W / A / S / D", label: "Walk active unit" },
      { key: "Arrow Keys", label: "Walk active unit" },
      { key: "Enter / Space", label: "Interact / talk / enter or exit mech" },
      { key: "Tab", label: "Snap camera to active unit" }
    ]),
    cameraSection(),
    interfaceSection()
  ];
}

function getDeploymentSections(state) {
  if (state?.ui?.deployment?.listOpen) {
    return [
      section("Deployment List", [
        { key: "W / S", label: "Move roster selection" },
        { key: "Arrow Up / Down", label: "Move roster selection" },
        { key: "Enter / Space", label: "Place selected unit" },
        { key: "Esc / Backspace", label: "Close roster" }
      ]),
      cameraSection(),
      interfaceSection()
    ];
  }

  if (isDeploymentMenuFocused(state)) {
    return [
      section("Deployment Ready", [
        { key: "Enter / Space", label: "Begin mission when ready" },
        { key: "W / A / S / D", label: "Return focus to map" },
        { key: "Arrow Keys", label: "Return focus to map" }
      ]),
      interfaceSection()
    ];
  }

  return [
    section("Deployment", [
      { key: "W / A / S / D", label: "Move cursor on deployment cells" },
      { key: "Arrow Keys", label: "Move cursor on deployment cells" },
      { key: "Enter / Space", label: "Open roster / place unit" },
      { key: "Esc / Backspace", label: "Remove placed unit at cursor" }
    ]),
    cameraSection(),
    interfaceSection()
  ];
}

function getSetupSections() {
  return [
    section("Mission Setup", [
      { key: "Enter / Space", label: "Start combat / begin initiative" },
      { key: "W / A / S / D", label: "Move cursor" },
      { key: "Arrow Keys", label: "Move cursor" },
      { key: "Tab", label: "Snap to selected unit" }
    ]),
    cameraSection(),
    interfaceSection()
  ];
}

function getCommandMenuSections() {
  return [
    section("Command Menu", [
      { key: "W / A / S / D", label: "Move command selection in grid" },
      { key: "Arrow Keys", label: "Move command selection in grid" },
      { key: "Enter / Space", label: "Confirm selected command" },
      { key: "Esc", label: "Close command menu" }
    ]),
    interfaceSection()
  ];
}

function getCombatIdleSections(state) {
  const phase = String(state?.turn?.phase ?? "combat");
  const phaseLabel = phase === "move" ? "Move Phase" : phase === "action" ? "Action Phase" : "Combat";

  return [
    section(phaseLabel, [
      { key: "Enter / Space", label: "Open command menu" },
      { key: "Tab", label: "Snap to active unit" },
      { key: "W / A / S / D", label: "Move cursor" },
      { key: "Arrow Keys", label: "Move cursor" }
    ]),
    cameraSection(),
    interfaceSection()
  ];
}

function getMoveSections() {
  return [
    section("Move", [
      { key: "W / A / S / D", label: "Move destination cursor" },
      { key: "Arrow Keys", label: "Move destination cursor" },
      { key: "Enter / Space", label: "Confirm move" },
      { key: "Esc / Backspace", label: "Cancel move" }
    ]),
    cameraSection(),
    interfaceSection()
  ];
}

function getFacingSections() {
  return [
    section("Facing", [
      { key: "W / A / S / D", label: "Choose facing" },
      { key: "Arrow Keys", label: "Choose facing" },
      { key: "Enter / Space", label: "Confirm facing" },
      { key: "Esc / Backspace", label: "Cancel facing" }
    ]),
    cameraSection(),
    interfaceSection()
  ];
}

function getTargetingSections() {
  return [
    section("Targeting", [
      { key: "W / A / S / D", label: "Move target cursor" },
      { key: "Arrow Keys", label: "Move target cursor" },
      { key: "Enter / Space", label: "Confirm target" },
      { key: "Esc / Backspace", label: "Back to attack select" }
    ]),
    cameraSection(),
    interfaceSection()
  ];
}

function getAttackSelectSections() {
  return [
    section("Attack Select", [
      { key: "W / S", label: "Move weapon selection" },
      { key: "Arrow Up / Down", label: "Move weapon selection" },
      { key: "Enter / Space", label: "Confirm weapon" },
      { key: "Esc / Backspace", label: "Cancel attack" }
    ]),
    interfaceSection()
  ];
}

function getAbilitySelectSections() {
  return [
    section("Ability / Mech Action", [
      { key: "W / S", label: "Move ability selection" },
      { key: "Arrow Up / Down", label: "Move ability selection" },
      { key: "Enter / Space", label: "Confirm ability / enter or exit mech" },
      { key: "Esc / Backspace", label: "Cancel ability" }
    ]),
    interfaceSection()
  ];
}

function getItemSelectSections() {
  return [
    section("Item", [
      { key: "W / S", label: "Move item selection" },
      { key: "Arrow Up / Down", label: "Move item selection" },
      { key: "Enter / Space", label: "Use selected item" },
      { key: "Esc / Backspace", label: "Cancel item" }
    ]),
    interfaceSection()
  ];
}

function getHelpSections(state) {
  if (state?.ui?.dialogue?.active) return getDialogueSections();
  if (state?.mission?.result) return getMissionResultSections();

  if (isStoryMode(state) && !state?.turn?.combatStarted) {
    return getStorySections(state);
  }

  if (isDeploymentActive(state)) {
    return getDeploymentSections(state);
  }

  const mode = state?.ui?.mode ?? "idle";

  if (mode === "move") return getMoveSections();
  if (mode === "face") return getFacingSections();
  if (mode === "action-target") return getTargetingSections();
  if (mode === "action-attack-select") return getAttackSelectSections();
  if (mode === "action-ability-select" || mode === "action-exit-select") return getAbilitySelectSections();
  if (mode === "action-item-select") return getItemSelectSections();

  if (state?.ui?.commandMenu?.open && mode === "idle") {
    return getCommandMenuSections();
  }

  if (!state?.turn?.combatStarted) {
    return getSetupSections();
  }

  return getCombatIdleSections(state);
}

export function renderHelpDrawer(state, refs) {
  if (!refs.helpDrawer) return;

  const open = !!state.ui.helpDrawer?.open;
  const sections = getHelpSections(state);

  refs.helpDrawer.classList.toggle("is-open", open);
  refs.helpDrawer.setAttribute("aria-hidden", open ? "false" : "true");

  refs.helpDrawer.innerHTML = `
    <div class="help-drawer-body">
      ${sections.map(section => `
        <div class="help-section">
          <div class="help-section-title">${section.title}</div>
          <div class="help-list">
            ${section.items.map(item => `
              <div class="help-row">
                <div class="help-key">${item.key}</div>
                <div class="help-label">${item.label}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>

    <div class="help-drawer-header">
      <div class="help-drawer-title">HELP</div>
      <div class="help-drawer-hotkey">F1</div>
    </div>
  `;
}
