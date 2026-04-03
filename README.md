# Ars-Caelorum

Ars Caelorum is an FFT-inspired isometric mech tactics prototype built to validate combat systems before full production. The current build is focused on movement, targeting flow, debug tooling, and multi-mech testing rather than damage math or content depth.

Live build: https://nevar530.github.io/Ars-Caelorum/

---

## Current State

The prototype currently supports:

- isometric SVG map rendering
- elevation-based movement and path preview
- mech movement confirmation
- facing confirmation after movement
- action phase attack selection and target confirmation
- multiple mechs on the map for testing
- dev menu with unit spawning and debug tools
- map editor housed inside the dev menu
- debug log for movement, facing, attack flow, phase changes, and round changes

The game is **not yet on full multi-unit initiative order**.  
It is currently in the bridge phase between single-active-mech combat flow and true initiative-driven turn order.

---

## Controls

### General
- **Arrow Keys / WASD**: Move board focus
- **Enter / Space**: Confirm / Open Menu
- **Escape / Backspace**: Cancel
- **Q / E**: Rotate map
- **R**: Toggle Tactical View
- **Tab**: Snap focus to active mech
- **`**: Toggle Dev Menu

### Map Editor
The map editor is now housed inside the **Map** tab of the dev menu.

- **Left Click**: Raise elevation
- **Right Click**: Lower elevation

---

## Current Gameplay Flow

### Move Phase
- Select active mech
- Open command menu
- Choose **Move** or **Brace**
- Confirm destination
- Confirm facing

### Action Phase
- Open command menu
- Choose **Attack**
- Select attack profile
- Confirm target tile or mech
- Advance round

This flow is currently validated around one active mech at a time, even though multiple mechs can now be placed on the field for testing.

---

## Dev Menu

The dev menu is now a core testing tool.

### Units Tab
- spawn mech
- assign pilot
- assign team
- assign PC / CPU ownership
- select spawn slot
- replace unit already occupying that spawn slot
- remove units
- reroll initiative for testing
- reset units
- view debug log

### Map Tab
- contains the current map editor
- keeps terrain editing inside the same dev workflow as unit testing

---

## Debug Logging

The debug log currently records:

- mech selection
- movement start
- movement confirm
- facing confirm
- attack entry
- attack selection
- target confirmation
- phase change
- round advancement
- dev spawn / remove / reset actions

This is intended to support combat validation before damage resolution is added.

---

## Data Structure

### `data/`
Holds JSON content:

- `mechs.json`
- `weapons.json`
- `attacks.json`
- `sigils.json`
- `pilots.json`
- `spawnPoints.json`

### `src/`
Holds core gameplay systems:

- state
- map
- movement
- rendering
- HUD
- input
- actions
- LOS
- data loading

### `dev/`
Holds dev-only tools:

- dev menu
- logger
- runtime helpers
- data store helpers

---

## Current Design Rules

Locked naming:

### Mech-side stats
- `core`
- `shield`
- `aether`
- `move`

### Pilot-side stats
- `reaction`
- `targeting`

Other locked rules:
- one pilot per mech
- code overrules notes if notes fall behind
- Move / Brace is the forward wording
- dev tools stay separated from core systems

---

## Current Technical Status

### Working
- map rendering
- camera rotation
- top-down tactical toggle
- movement preview
- move confirmation
- facing confirmation
- attack profile selection
- target confirmation
- multiple mech spawning
- cursor mech selection while idle
- dev menu + map tab integration
- logging instrumentation

### In Progress
- initiative and turn order
- multi-unit phase sequencing
- full LOS code lock against latest design notes
- hit validation polish

### Not Done Yet
- damage resolution
- status effects
- abilities / item systems
- AI turn behavior
- pilot-scale gameplay
- mixed-scale combat
- campaign content

---

## Next Priority

### 1. Initiative + Turn Order
- initiative roll per mech / pilot pair
- move phase order: low to high
- action phase order: high to low
- active unit advance
- round reset / reroll

### 2. LOS + Target Validation Lock
- align code to latest LOS design
- clean cover state handling
- improve target feedback

### 3. Hit Validation
- reaction / targeting integration
- brace modifiers
- facing modifiers
- target info polish

### 4. Damage Layer
- shield / core interaction
- disable states
- status hooks

---

## Project Goal

Ars Caelorum is being built as a readable tactical system first.

The goal is:

- every action is visible
- every outcome is understandable
- every decision is intentional

Fun and clarity come before polish.
