# Ars Caelorum

**Live Build:** https://nevar530.github.io/Ars-Caelorum/

**Ars Caelorum** is an in-browser tactical RPG / tactics-engine prototype built with HTML, CSS, JavaScript, and SVG-based 2:1 isometric rendering.

The project is inspired by tactical RPGs, mech combat games, and board-game-style systems. The core design goal is a deterministic, readable battlefield where pilots and mechs operate in the same rules space, maps are authored as data, and combat logic comes from board truth rather than visual tricks.

---

## Current State

Ars Caelorum is no longer just a combat test harness.

The current game flow is:

```txt
TITLE
-> MISSION SELECT
-> MAP LOAD
-> DEPLOYMENT / AUTHORED START
-> COMBAT
-> MISSION END
-> RETURN TO TITLE
```

The project currently supports:

- Real title screen
- Mission select screen
- Catalog-backed map loading from `data/maps/mapList.json`
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
- Mission result / return flow
- Round / phase splash receipts
- Live dev menu
- Live map editor
- JSON-backed map workflow
- Structure foundation V1

---

## Core Design Truths

These rules are locked unless deliberately redesigned:

1. Pilots are the only initiative actors.
2. Mechs are controlled bodies, not initiative owners.
3. Occupancy is authority.
4. Enter Mech / Exit Mech are core contextual actions.
5. Weapons are not generic abilities.
6. Items and abilities share the same broad runtime action path where possible.
7. Start state and deployment are authored map data, not fallback hacks.
8. Mission select is catalog-driven.
9. CPU uses real gameplay rules, not cheat rules.
10. Code is truth.

---

## Structure System V1

Structures are now real board authority, not decorative art.

The structure system moved away from blocked tile thinking.

### Rejected Model

```txt
wall tile = blocked tile
```

This caused problems because walls consumed floor space and made tight interiors hard to use.

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

## Room / Roof Cutaway System

Structures can now support authored interior rooms.

Current structure room behavior:

- Structure cells may have `roomId`.
- Roof cutaway reacts to actual pilot position.
- Roof cutaway reacts to legal move-preview destination before movement is committed.
- Roof cutaway can be room-based.
- Older/no-room structures can fall back to whole-structure cutaway.
- Lower/front wall and visible door art can fade around the active/preview pilot readability zone.

Roof and wall fade are render readability systems only. They do not affect movement, LOS, hit chance, or combat truth.

---

## Current Receipt Maps

These maps should stay useful as regression receipts.

### `000_test`

- Authored pilot-start reference map

### `001_test`

- Authored embarked mech-start reference map

### `002_test`

- Pilot deployment V1 reference map

### `003_test`

- Mech deployment V1 reference map

### `004_structure_test`

- Structure edge-height movement / LOS receipt map
- Two pilots for testing LOS and combat through structure edges
- Wall edges use `edgeHeight: 2`
- Door/open edge uses `edgeHeight: 0`
- Proves wall edges block movement and LOS
- Proves door/open edges allow crossing and sight

### `005_warehouse_district`

- Interior structure / room cutaway receipt map
- Large warehouse structure
- Exterior and interior walls as authored edges
- Front/back access points as `edgeHeight: 0`
- Multiple rooms and hallway through authored `roomId` cells
- Room-based roof cutaway
- Lower/front wall and door fade for pilot readability
- Two on-foot pilots with sidearms for indoor combat tests

---

## What Is Done

### Core / Engine

- Shared pilot/mech battlefield
- Occupancy truth
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
- Keyboard shell navigation
- Map catalog-backed mission list
- Authored map loading from selected catalog entry
- Mission end return path
- Center-screen round/phase splash

### Map / Authoring

- Map metadata preservation through clone/reset/load
- Map-authored spawns
- Map-authored `startState.deployments`
- Deployment-capable map schema
- Editor export of runtime-usable map JSON
- Working add-to-catalog test loop

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

---

## Current Active Layer

The project is currently in:

```txt
STRUCTURE AUTHORING / VALIDATION + POST-STRUCTURE CLEANUP
```

The structure rules work. The next major job is making the map editor author the same data shape that the hand-authored receipt maps currently prove.

---

## Next Required Work

### 1. Cleanup / Contract Lock

- Update docs/comments to match current repo truth
- Keep one clear authority path for:
  - mission list
  - map load
  - startState
  - deployment
  - unit instantiation
  - mission result
  - CPU turn kickoff
  - structure edgeHeight
  - roomId / roof cutaway
- Remove stale assumptions where safe

### 2. Structure Editor Tools

- Edge paint / edge select mode
- Raise/lower selected `edgeHeight` with keys
- Wall / door / window / opening presets
- Structure cell paint mode
- RoomId / zoneId paint mode
- Roof/cell room assignment tools
- Debug overlay for edgeHeight and roomId
- Preserve structure cells/edges/roomId/roof data through import/export

### 3. Structure Validation Tools

Add warnings for:

- Visible wall art with `edgeHeight: 0`
- Visible door art with positive `edgeHeight` when not intended
- `edgeHeight > 0` with no visible structure art
- Roofed structure cells missing `roomId`
- Roof/room mismatch
- Room with no entrance/opening
- Interior cells disconnected from access points
- Deployment/spawn cells blocked by structure geometry
- Overlapping or duplicate edge definitions

### 4. AI Growth

- Better movement readability
- Stronger range discipline
- Target priority and threat value
- Objective awareness
- Mech / pilot role handling
- Structure-aware behavior
- Room/interior pathing
- Doorway awareness
- LOS-aware indoor positioning

### 5. Scenario / Mission Layer

- Scenario definitions
- Objective scripting hooks
- Mission-specific win/loss rules
- Escort / survive / reach exit / kill-all style mission truth
- Interior objectives such as secure room, reach terminal, extract pilot

### 6. Abilities / Items Expansion

- More abilities
- More items
- Targeted effects
- Buffs / debuffs
- Movement utility
- Support actions
- Mission-specific content grants later

### 7. Equipment / Frame Authority

Frames should determine:

- Speed / move baseline
- Slot layout
- Allowed equipment types

Equipment should determine:

- Weapons
- Shield modules
- Core modules
- Utility/system modules

### 8. Menus / Persistence

- Controls/help menu polish
- Mission/objective panel
- Inventory menu
- Journal/log
- Save/load entry points
- Campaign persistence later

### 9. Art / Music / Sound

Presentation comes after the rules shell is stable enough to deserve it.

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

1. Map validity
2. Structure data consistency
3. Editor tools lagging behind runtime structure truth
4. AI not yet structure-aware
5. Rendering/cutaway edge cases under rotation
6. Scenario layer still thin

---

## Build Order

Current practical build order:

```txt
1. Cleanup / doc lock
2. Structure editor tools
3. Structure validation tools
4. AI growth and tuning, including structure awareness
5. Scenario / mission layer
6. Abilities / items expansion
7. Equipment / frame authority
8. Menus / persistent UX
9. Save / campaign layer
10. Art / music / sound
```

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
- Real catalog-backed map loading
- Real authored start-state authority
- Real deployment V1
- Real CPU participation
- Real mission-end flow
- Readable round/phase receipts
- A working editor-to-runtime test loop
- Real structure edge-height movement blocking
- Real structure edge-height LOS blocking
- Pilot-enterable interiors
- Room-based roof cutaway
- Lower/front wall and door fade for readability
- Structure receipt maps proving the foundation

The project is now proving not only open-field combat, but indoor/outdoor tactical board authority.
