// src/ui/helpDrawer.js

function getHelpSections(state) {
  const sections = [
    {
      title: "Cursor",
      items: [
        { key: "W / A / S / D", label: "Move cursor" },
        { key: "Arrow Keys", label: "Move cursor" },
        { key: "Tab", label: "Snap to active unit" }
      ]
    },
    {
      title: "Camera",
      items: [
        { key: "Q", label: "Rotate left" },
        { key: "E", label: "Rotate right" },
        { key: "R", label: "Toggle tactical view" }
      ]
    },
    {
      title: "Command",
      items: [
        { key: "Enter / Space", label: "Open / confirm command" },
        { key: "Esc", label: "Cancel / close" }
      ]
    },
    {
      title: "Interface",
      items: [
        { key: "F1", label: "Toggle help" },
        { key: "`", label: "Toggle dev menu" }
      ]
    }
  ];

  if (state.ui.mode === "face") {
    sections.push({
      title: "Facing",
      items: [
        { key: "W / A / S / D", label: "Choose facing" },
        { key: "Arrow Keys", label: "Choose facing" },
        { key: "Enter / Space", label: "Confirm facing" },
        { key: "Esc", label: "Cancel facing" }
      ]
    });
  }

  if (state.ui.mode === "move") {
    sections.push({
      title: "Move",
      items: [
        { key: "W / A / S / D", label: "Move cursor" },
        { key: "Arrow Keys", label: "Move cursor" },
        { key: "Enter / Space", label: "Confirm move" },
        { key: "Esc", label: "Cancel move" }
      ]
    });
  }


  if (state.ui.mode === "action-target") {
    sections.push({
      title: "Targeting",
      items: [
        { key: "W / A / S / D", label: "Move target cursor" },
        { key: "Arrow Keys", label: "Move target cursor" },
        { key: "Enter / Space", label: "Confirm target" },
        { key: "Esc", label: "Cancel targeting" }
      ]
    });
  }

  if (state.ui.mode === "action-attack-select") {
    sections.push({
      title: "Attack Select",
      items: [
        { key: "W / S", label: "Move selection" },
        { key: "Arrow Up / Down", label: "Move selection" },
        { key: "Enter / Space", label: "Confirm attack" },
        { key: "Esc", label: "Cancel attack" }
      ]
    });
  }

  return sections;
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
