# Ars Caelorum

**Launch Game:** [Open Ars Caelorum](https://nevar530.github.io/Ars-Caelorum/)

Ars Caelorum is a browser-based tactical mech game built in HTML, CSS, and JavaScript.

It now has a real playable shell:

**Title -> Mission Select -> Map Load -> Deployment or Authored Start -> Combat -> Mission End -> Return**

This repo is no longer just proving combat. It now has a usable game flow, authored map loading, deployment starts, authored starts, baseline CPU turns, and readable round/phase transition receipts.

---

## Current Status

### Working Now
- [x] title screen
- [x] mission select screen
- [x] keyboard-first shell navigation
- [x] map catalog loading from `data/maps/mapList.json`
- [x] alphabetical mission listing
- [x] authored map loading from mission select
- [x] shared mech/pilot battlefield
- [x] 3x3 mech occupancy
- [x] 1x1 pilot occupancy
- [x] pilot-only initiative
- [x] actor/body separation
- [x] embark / disembark
- [x] occupied mech damage cascade
- [x] disabled occupied mech behavior
- [x] move + brace + attack + ability + item + end turn command buckets
- [x] combat loop
- [x] item / ability runtime path V1
- [x] authored start-state support
- [x] pilot deployment V1
- [x] mech deployment V1
- [x] authored CPU enemies
- [x] baseline CPU move + attack turns
- [x] center-screen round / phase splash
- [x] mission result / restart / return flow
- [x] live dev menu
- [x] live map editor
- [x] JSON-backed map workflow
- [x] loadout / inventory scaffolding
- [x] weapon lookup trending loadout-first

### Not Done Yet
- [ ] stronger AI behavior and better movement readability
- [ ] structures as real board authority
- [ ] scenario / objective layer
- [ ] broader ability / item expansion
- [ ] full equipment / frame authority
- [ ] persistent menus tied to real systems
- [ ] save / campaign layer
- [ ] final art / music / sound polish

---

## Code Truth

These are locked design rules now.

- [x] Pilots are the only initiative actors
- [x] Mechs are controlled bodies, not initiative owners
- [x] Occupancy is authority
- [x] Enter Mech / Exit Mech remain core contextual verbs
- [x] Move / Brace / Attack / Ability / Item / End Turn remain the command buckets
- [x] Weapons are not generic abilities
- [x] Items and abilities should share the same broad action pipeline where possible
- [x] Disabled occupied mechs do not get normal mech actions
- [x] Disabled occupied mechs must still keep **Exit Mech** available
- [x] Start-state and deployment are authored map data, not fallback hacks
- [x] Map catalog is mission-list authority
- [x] Authored starts and deployment starts are both valid map-driven truths
- [x] Round / phase UI should come from real turn state
- [x] CPU behavior should build on the same rules the player uses

---

## Gameplay State

### Battlefield / Combat
- [x] shared mech/pilot battlefield
- [x] move phase + action phase structure
- [x] height-aware movement
- [x] height-aware LOS
- [x] targeting and hit resolution
- [x] shield/core damage handling
- [x] combat text feedback

### Pilot / Mech Interaction
- [x] pilots act on foot
- [x] embarked pilots control mech bodies
- [x] Enter Mech during action phase
- [x] Exit Mech during action phase
- [x] embarked pilots leave board occupancy
- [x] embarked pilots are not targetable
- [x] empty mechs remain real board objects

### Disabled Occupied Mech Truth
- [x] no normal move
- [x] no normal attack
- [x] no normal brace
- [x] no normal mech abilities
- [x] Exit Mech remains available when valid
- [x] occupied damage cascade remains:

```text
Mech Shield -> Mech Core -> Pilot Shield -> Pilot Core
```

---

## Shell / Mission Flow

### Current Shell Path
```text
Title -> Mission Select -> Map Load -> Deployment/Start -> Combat -> Mission End -> Return
```

### Start Modes That Now Exist

#### 1. Authored Start
Units begin where the map/startState says they begin.

Good for:
- fixed test maps
- tutorials
- story setups
- ambushes
- embarked starts

#### 2. Deployment Start
The map provides legal deployment cells and the player places valid units before combat begins.

Good for:
- player-controlled pre-combat setup
- testing roster filtering
- validating placement rules cleanly through authored map data

Important:
These are both correct. They should stay as two clean map-driven start truths, not get collapsed into one messy exception system.

---

## Current Test Maps

### `000_test`
- authored on-foot start receipt
- stable pilot reference map

### `001_test`
- authored embarked mech start receipt
- stable embarked reference map

### `002_test`
- pilot deployment V1 receipt
- player deploys pilots against authored CPU enemies

### `003_test`
- mech deployment V1 receipt
- player deploys mechs using footprint-aware placement rules

These maps are the current receipts for shell truth.

---

## CPU / AI Baseline

The repo now has real CPU turns.

### Working Now
- [x] CPU move phase turns
- [x] CPU action phase turns
- [x] legal move destination planning
- [x] legal attack selection
- [x] attack scoring by basic tactical value
- [x] simple range-aware movement preference
- [x] real turn-controller kickoff

### Still Needs Work
- [ ] smoother tile-to-tile movement presentation
- [ ] stronger range discipline
- [ ] better target priority
- [ ] objective awareness
- [ ] mech / pilot role handling
- [ ] structure-aware behavior

---

## Round / Phase Readability

The game now presents round and phase changes in the center of the screen.

### Working Now
- [x] round / phase truth comes from the real turn controller
- [x] center-screen phase splash exists
- [x] splash shows round + phase
- [x] move phase and action phase transitions are readable in live play

This is a readability layer on top of real game state, not a fake UI timer.

---

## Dev Tools / Authoring

- [x] live dev menu
- [x] live runtime inspection
- [x] live map editor
- [x] brush painting for map authoring
- [x] spawn placement authoring
- [x] deployment cell authoring
- [x] map resize
- [x] import / export
- [x] validation / status feedback

### Current Map Workflow
1. Build or edit a map in the editor
2. Export JSON
3. Place the map in `data/maps/`
4. Add the map to `data/maps/mapList.json`
5. Launch through mission select
6. Test in runtime

---

## Data / Content Direction

### Runtime Data
- `data/mechs.json`
- `data/pilots.json`
- `data/weapons.json`
- `data/attacks.json`
- `data/sigils.json`
- `data/maps/mapList.json`
- `data/maps/*.json`
- `data/terrain/terrain.json`
- `data/terrain/terrainList.json`

### Current Terrain Presets
- Grass
- Rock
- Sand
- Water
- Asphalt
- Concrete

### Current Movement Classes
- Clear
- Difficult
- Impassable
- Hazard

### Direction Locked In
- weapons = equipped combat content
- abilities = granted non-weapon actions
- items = consumable actions
- frames should later determine move baseline + slot layout + allowed equipment types
- final mech state should eventually come from:
  - frame
  - equipped parts
  - pilot pairing
  - runtime damage state

---

## Repo Structure

### Gameplay Runtime
- `src/controllers/` — game, turn flow, shell/runtime control
- `src/combat/` — hit, damage, combat text
- `src/targeting/` — range, fire arc, targeting logic
- `src/scale/` — occupancy and mech/pilot footprint math
- `src/maps/` — map schema, runtime, mutations, spawns
- `src/render/` — terrain, units, overlays, LOS, projection, scene building
- `src/actors/` — actor/body resolution helpers
- `src/vehicles/` — embark / disembark rules and actions
- `src/ui/` — shell and overlay UI

### Dev / Editor
- `dev/devMenu.js`
- `dev/devMenuModules/`
- `dev/mapEditor/`

---

## What Changed Recently

### Game Shell Pass
- [x] title screen added
- [x] mission select added
- [x] catalog-backed mission loading added
- [x] boot no longer leaks units under the title screen

### Deployment Pass
- [x] pilot deployment V1 works
- [x] mech deployment V1 works
- [x] deployment cells are authored in map data
- [x] Begin Mission gates on required placement count

### CPU Baseline Pass
- [x] CPU moves during its turns
- [x] CPU attacks during its turns
- [x] CPU can seek legal attack positions
- [x] CPU can try to respect preferred weapon distance

### Phase Readability Pass
- [x] center-screen round / phase splash added
- [x] transitions now read clearly in live play

---

## On Deck

### 1. Cleanup Tail / Contract Lock
Goal: freeze current shell/start/deployment/AI truths so later work builds on bedrock.

- [ ] update docs/comments to match code truth
- [ ] remove stale wording and stale assumptions where safe
- [ ] keep one clear authority path for:
  - [ ] mission list
  - [ ] map load
  - [ ] startState
  - [ ] deployment
  - [ ] unit instantiation
  - [ ] mission result
  - [ ] CPU turn kickoff

### 2. Structure Authority
Goal: make the board matter more than open terrain.

- [ ] walls
- [ ] doors
- [ ] interior cells
- [ ] access points
- [ ] movement / LOS / objective interaction on the same board

### 3. AI System Growth
Goal: make AI feel intentional instead of merely functional.

- [ ] smoother movement readability
- [ ] stronger range discipline
- [ ] target priority
- [ ] objective awareness
- [ ] mech / pilot role handling
- [ ] structure-aware behavior

### 4. Scenario / Mission Layer
Goal: move beyond raw map/startState truth into authored mission behavior.

- [ ] scenario definitions
- [ ] objective scripting hooks
- [ ] mission-specific rules and win/loss truth
- [ ] escort / survive / reach exit / kill-all mission support

### 5. Abilities / Items Expansion
- [ ] more abilities
- [ ] more items
- [ ] targeted effects
- [ ] buffs / debuffs
- [ ] movement utility
- [ ] support actions
- [ ] faction/test content
- [ ] mission-specific grants later

### 6. Equipment / Frame Authority
- [ ] move speed baseline to frames
- [ ] slot layout to frames
- [ ] allowed equipment types to frames
- [ ] weapons as fully equipped combat content
- [ ] shield/core modules as equipment authority

### 7. Menus / Persistent UX
- [ ] controls/help polish
- [ ] inventory menu when inventory authority is real
- [ ] journal/log when mission state is real
- [ ] save/load entry points when persistence exists

### 8. Save / Campaign Layer
- [ ] save/load runtime state
- [ ] scenario persistence
- [ ] campaign progression

### 9. Art / Music / Sound
- [ ] expanded sprite work
- [ ] terrain sprite rendering
- [ ] animation
- [ ] VFX
- [ ] UI polish
- [ ] sound effects
- [ ] music / ambience

---

## Short Status

**Playable shell:** yes
**Shared mech/pilot battlefield:** yes
**Pilot-only initiative:** yes
**Embark/disembark:** yes
**Authored starts:** yes
**Pilot deployment:** yes
**Mech deployment:** yes
**CPU turns:** yes
**Mission loop shell:** yes
**Scenario layer:** not yet
**Structures:** not yet
**Equipment/frame authority:** planned
**Persistence:** planned
**Final presentation pass:** later

---

## End State Goal

A deterministic, readable tactics game where:
- pilots and mechs operate on one battlefield
- maps are authored and launched through the real shell
- starts can be authored or deployment-based depending on map truth
- CPU units follow the same gameplay rules as the player
- structures, terrain, and objectives make the board matter
- weapons / abilities / items move toward clean content authority
- menus and persistence sit on top of real systems
- art and polish sit on top of stable rules instead of forcing rewrites
