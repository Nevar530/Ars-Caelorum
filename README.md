# Ars Caelorum

**Live Build:** https://nevar530.github.io/Ars-Caelorum/

**Ars Caelorum** is an in-browser tactical RPG / tactics-engine prototype built with HTML, CSS, JavaScript, and SVG-based 2:1 isometric rendering.

The project is inspired by tactical RPGs, mech combat games, and board-game-style systems. The core design goal is a deterministic, readable battlefield where pilots and mechs operate in the same rules space, maps are authored as data, and combat logic comes from board truth rather than visual tricks.

---

## Current State

Ars Caelorum now has a real game shell and a real fullscreen Mission Builder foundation.

Current game flow:

```txt
TITLE
-> MISSION SELECT
-> BRIEFING
-> MAP LOAD
-> DEPLOYMENT / AUTHORED START
-> COMBAT
-> MISSION END
-> RETURN TO TITLE
```

Current builder flow:

```txt
MISSION BUILDER
-> BUILDER-OWNED MAP DRAFT
-> EXPORT / TEST PACKAGE
-> REAL RUNTIME LOADER
```

The current repo supports:

- Real title screen
- Mission select screen
- Mission briefing screen
- Mission catalog loading from `data/missions/missionList.json`
- Map catalog support from `data/maps/mapList.json`
- Keyboard-first shell navigation
- Authored map start states
- Deployment-capable maps
- Pilot and mech deployment V1
- Shared pilot/mech battlefield
- Pilot-only initiative
- Mechs as controlled bodies
- Embark / disembark
- Occupied mech damage cascade
- Disabled occupied mech behavior
- Move / brace / attack / ability / item / end turn command buckets
- Item / ability runtime path V1
- Baseline CPU movement and attacks
- CPU exit from disabled occupied mechs
- Center-tile direct targeting for mech/body targets
- Missile targeting that can still target open tiles
- Mission result / return flow
- Intro/victory/defeat dialogue hooks
- Round / phase splash receipts
- Structure foundation V1
- New fullscreen Mission Builder
- WYSIWYG builder workspace
- Terrain/elevation painting V1
- Structure cell/edge/room painting V1
- Spawn/deployment authoring V1
- Units tab start assignment V1
- Builder export package V1
- Builder Test Mission bridge V1

---

## Core Design Truths

These rules are locked unless deliberately redesigned:

1. Code is truth.
2. Board truth comes first.
3. Pilots are the only initiative actors.
4. Mechs are controlled bodies, not initiative owners.
5. Runtime unit `x/y` is the unit center tile.
6. Occupancy is authority.
7. Enter Mech / Exit Mech are core contextual actions.
8. Weapons are not generic abilities.
9. Items and abilities share the same broad runtime action path where possible.
10. Start state and deployment are authored data, not fallback hacks.
11. Mission select is catalog-driven.
12. CPU uses real gameplay rules, not cheat rules.
13. Builder writes truth.
14. Engine runs truth.
15. Export packages truth.
16. Validation protects truth.

---

## Structure System V1

Structures are real board authority, not decorative art.

The structure system moved away from blocked-tile thinking.

### Rejected Model

```txt
wall tile = blocked tile
```

That caused problems because walls consumed floor space and made tight interiors hard to use.

### Current Model

```txt
tile height = terrain / floor elevation
edgeHeight = wall / door / barrier height
```

That means:

- Tiles decide standing.
- Edges decide crossing and sight.
- Structure cells can be walkable interior floor.
- Structure edges act as walls, doors, openings, windows, barriers, or other edge features.
- Movement checks edge height when crossing between tiles.
- LOS checks edge height when sight crosses a structure edge.
- Doors/openings are represented by `edgeHeight: 0`.
- Walls are represented by positive `edgeHeight` values.
- Type and sprite are art/editor labels, not gameplay authority.

Do not reintroduce structure `blocksMove` or `blocksLOS` as rule authority.

The clean rule is:

```txt
movement and LOS derive structure behavior from authored edgeHeight
```

---

## Targeting Truth

Direct targeting is now unit-based instead of footprint-square based.

For large units:

- A mech still occupies its full footprint for occupancy and arc checks.
- Direct target selection resolves to the unit center/focus tile.
- A 3x3 mech should not present nine separate direct target squares.
- Fire arc can still consider footprint cells for legality.
- LOS and attack resolution should use the resolved target/focus tile.

Missiles remain different:

- Missile weapons can target open tiles.
- Missile splash/effect is resolved from the chosen tile.
- If a missile is targeted at an occupied unit tile, LOS can use that unit’s focus/center tile.
- Spotter logic exists through missile targeting helpers.

Disabled/destroyed units should not be valid direct targets.

---

## Room / Roof Cutaway System

Structures can support authored interior rooms.

Current structure room behavior:

- Structure cells may have `roomId`.
- Roof cutaway reacts to actual pilot position.
- Roof cutaway reacts to legal move-preview destination before movement is committed.
- Roof cutaway can be room-based.
- Older/no-room structures can fall back to whole-structure cutaway.
- Lower/front wall and visible door art can fade around the active/preview pilot readability zone.

Roof and wall fade are render readability systems only. They do not affect movement, LOS, hit chance, or combat truth.

---

## Mission Builder Current State

The new Mission Builder lives under `src/builder/`.

Important files:

```txt
src/builder/missionBuilder.js
src/builder/builderState.js
src/builder/builderAdapters.js
src/builder/builderTerrain.js
src/builder/builderStructures.js
src/builder/builderSpawns.js
src/builder/builderUnits.js
src/builder/builderExport.js
src/builder/builderRuntimeTest.js
src/builder/ui/builderShell.js
src/builder/workspace/wysiwygWorkspace.js
```

Current builder tabs:

- Project
- Map
- Terrain
- Structures
- Spawns
- Units
- Objectives
- Triggers
- Logic
- Dialogue
- Results
- Validate
- Export

Currently working in the builder:

- Fullscreen shell opened with backtick
- Engine-backed WYSIWYG map preview
- Tile selection
- Edge selection with Shift-click
- Selection and hover markers
- Overlays for structure edges, rooms, spawns, deployment cells, and tile heights
- New blank builder-owned map creation
- Current runtime map read-only inspection
- Terrain/elevation/movement painting
- Structure cell/room painting
- Structure edge/wall/door/opening painting
- Spawn placement
- Deployment cell painting
- Unit/start assignment authoring
- Export package zip
- Test Mission bridge through real runtime loader

Current active layer:

```txt
Units tab / start assignment stabilization
```

Known builder gaps:

- Load Existing is staged but not active.
- Validate is placeholder only.
- Objectives authoring is staged.
- Triggers authoring is staged.
- Logic Chains are staged.
- Dialogue authoring is staged.
- Results authoring is staged.
- Mission metadata/package editing is still thin.
- Export/Test do not have validation gates yet.

---

## Current Receipt Maps / Missions

These maps and missions should stay useful as regression receipts.

### `000_test` / `000_test_mission`

- Authored pilot-start reference map

### `001_test` / `001_embarked_test_mission`

- Authored embarked mech-start reference map

### `002_test` / `002_pilot_deployment_mission`

- Pilot deployment V1 reference map

### `003_test` / `003_mech_deployment_mission`

- Mech deployment V1 reference map

### `004_structure_test` / `004_structure_test_mission`

- Structure edge-height movement / LOS receipt map
- Wall edges use `edgeHeight: 2`
- Door/open edge uses `edgeHeight: 0`
- Proves wall edges block movement and LOS
- Proves door/open edges allow crossing and sight

### `005_warehouse_district` / `005_warehouse_district_mission`

- Interior structure / room cutaway receipt map
- Large warehouse structure
- Exterior and interior walls as authored edges
- Front/back access points as `edgeHeight: 0`
- Multiple rooms and hallway through authored `roomId` cells
- Room-based roof cutaway
- Lower/front wall and door fade for pilot readability
- Indoor pilot combat testing

### `006_new_map` / `006_new_map_mission`

- Builder export receipt
- Proves builder package export path exists
- Useful current regression receipt for builder-generated map/mission output

---

## What Is Done

### Core / Engine

- Shared pilot/mech battlefield
- Occupancy truth
- Center-tile unit anchor truth
- Pilot-only initiative
- Actor/body separation
- Embark/disembark
- Occupied damage cascade
- Disabled occupied mech behavior
- Stable combat loop
- Command buckets
- First item/ability runtime path

### Shell / Flow

- Title screen
- Mission select screen
- Briefing screen
- Keyboard shell navigation
- Mission catalog-backed mission list
- Authored map loading through mission definitions
- Mission end return path
- Center-screen round/phase splash
- Intro/victory/defeat dialogue hooks

### Map / Authoring

- Map metadata preservation through clone/reset/load
- Map-authored spawns
- Map-authored `startState.deployments`
- Deployment-capable map schema
- Working add-to-catalog test loop
- Builder export path for map/mission/catalog files

### Deployment V1

- Deployment start mode
- Deployment cells in map data
- Pilot deployment
- Mech deployment
- Authored enemies remain authored
- Player placement count gate
- Begin Mission handoff

### AI Baseline

- CPU move phase participation
- CPU action phase participation
- Legal move destination planning
- Legal attack selection
- Simple range-aware movement preference
- Disabled occupied mech exit behavior for CPU

### Targeting Baseline

- Direct target candidates are unit-based
- Mech direct targeting resolves to center/focus tile
- Footprint cells still support arc legality
- Missile open-tile targeting remains available
- Disabled/destroyed targets are filtered out of direct targeting

### Structure Foundation V1

- Authored structure cells
- Authored structure edges
- `edgeHeight` as structure gameplay authority
- Edge-based walls/doors instead of blocked full tiles
- Movement checks structure edge height
- LOS checks structure edge height
- Door/opening `edgeHeight: 0`
- Wall `edgeHeight: 2` on current structure receipts
- Walkable interior structure cells
- Pilot-enterable buildings
- Preserved `roomId` through structure normalization
- Roof cutaway from current pilot position
- Roof cutaway from legal move-preview destination
- Room-based roof cutaway in warehouse test map
- Lower/front wall and visible door fade for readability

### Mission Builder V1 Foundation

- Fullscreen builder shell
- WYSIWYG workspace
- Builder adapter layer
- Terrain/elevation tools
- Structure cell/edge tools
- Spawn/deployment tools
- Units tab start assignment tools
- Export package V1
- Test Mission bridge V1

---

## Current Active Layer

The project is currently in:

```txt
MISSION BUILDER — UNITS TAB / START ASSIGNMENT STABILIZATION
```

This means the next work should focus on:

- pilot-only fixed starts
- pilot+mech embarked fixed starts
- empty mech fixed starts
- player deployment roster entries
- CPU/enemy authored starts
- exported `startState.deployments`
- Test Mission from builder
- copied export running from Mission Select

---

## Next Required Work

### 1. Units Tab Lock / Start Assignment Receipts

- Test pilot fixed start
- Test pilot+mech fixed start
- Test empty mech fixed start
- Test player deployment roster pilot-only
- Test player deployment roster pilot+mech
- Test CPU enemy starts
- Test remove/re-add behavior
- Test exported package from Mission Select

### 2. Validation System V1

Add real errors/warnings for:

- Missing ids
- Missing spawn references
- Invalid pilot/mech references
- Invalid startEmbarked combinations
- Deployment required count impossible
- Mech deployment zone too small
- Duplicate structure edges
- Structure art/edgeHeight mismatch
- Room/roof mismatch
- Placeholder mission fields

### 3. Load Existing / Package Draft Flow

- Load existing map as builder-owned draft
- Clone existing map/mission
- Preserve structures/spawns/startState
- Keep current runtime map read-only

### 4. Mission Package Core

- Mission id/name editing
- Briefing editing
- Result text editing
- Catalog entry preview
- Export summary

### 5. Objectives V1

- Defeat all
- Survive rounds
- Reach tile/zone/room later
- Protect/extract/interact later

### 6. Triggers + Logic Chains V1

- Trigger data model
- Simple list/chain editor
- Tile/zone triggers
- Dialogue effects
- Objective effects
- Victory/defeat effects
- Animation effect placeholder

### 7. Dialogue Authoring

- Intro/victory/defeat line editor
- Speaker name/id
- Text
- Optional portrait path

### 8. Results Authoring

- Victory title/text
- Defeat title/text
- Result dialogue link later

### 9. AI Growth

- Better movement readability
- Stronger range discipline
- Target priority and threat value
- Objective awareness
- Mech/pilot role handling
- Structure/door/interior awareness

---

## Build Order

Current practical build order:

```txt
1. Units tab lock / start assignment receipts
2. Validation system V1
3. Load Existing / package draft flow
4. Mission package core fields
5. Objectives V1
6. Triggers + Logic Chains V1
7. Dialogue authoring
8. Results authoring
9. Export/Test validation gates
10. AI growth and structure/objective awareness
11. Abilities/items expansion
12. Equipment/frame authority
13. Pre-mission loadout
14. Menus/persistence/save/campaign
15. Art/music/sound polish
```

---

## Important Future Notes

### Mech Interiors

Normal building interiors should default to pilot-scale spaces.

Mech entry should be authored as a special case only:

- hangars
- freight doors
- breached walls
- loading docks
- mech garages

A mech should only enter if the map intentionally supports:

- 3x3 footprint space
- wide enough access
- ceiling/roof readability
- clear art support

Do not turn normal buildings into a general door-width simulator.

### Windows / Half Walls

`edgeHeight: 1` may later become:

- low barrier
- half wall
- window-height object
- cover source
- partial LOS feature

This is not fully locked yet.

---

## Biggest Current Risks

1. Validation is not real yet.
2. Units tab needs smoke-test receipts.
3. Load Existing is staged.
4. Mission objective runtime is still thin.
5. Export works before validation gates.
6. AI is functional but not objective/structure smart.
7. Old dev menu/editor files still exist as legacy code.
8. `src/combat/targetingResolver.js` looks legacy/placeholder-style; current targeting authority appears to be `src/targeting/targetingResolver.js`.

---

## Development Philosophy

- Board truth first.
- Systems before polish.
- Simple before clever.
- Small, testable passes.
- No hidden fallback spawn logic.
- No duplicated rule authority.
- No map-name hardcoding.
- Rendering should reflect board truth, not create it.
- Editor-authored data should be the same data runtime uses.
- Code remains truth.

---

## Final Current Verdict

Ars Caelorum currently has:

- A real game shell
- Real mission catalog loading
- Real authored start-state authority
- Real deployment V1
- Real CPU participation
- Real mission-end flow
- Readable round/phase receipts
- Real structure edge-height movement blocking
- Real structure edge-height LOS blocking
- Pilot-enterable interiors
- Room-based roof cutaway
- Lower/front wall and door fade for readability
- Center-tile direct targeting for mechs/large units
- A real fullscreen Mission Builder foundation
- Terrain, structure, spawn/deployment, and unit-start authoring V1
- Builder export package V1
- Builder Test Mission bridge V1

The current active layer is Units tab stabilization.
After that, build real validation.
