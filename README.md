# Ars Caelorum

**Live Build:** https://nevar530.github.io/Ars-Caelorum/

**Ars Caelorum** is an in-browser 2:1 isometric tactics RPG / tactics-engine prototype built with HTML, CSS, JavaScript, and SVG rendering.

The project is inspired by tactical RPGs, mech combat games, and board-game-style systems. The core design goal is a deterministic, readable battlefield where pilots and mechs operate in the same rules space, maps are authored as data, and combat logic comes from board truth rather than visual tricks.

---

## Current Live Direction

Ars Caelorum now has a real playable shell and a functional fullscreen Mission Builder V1 foundation.

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
-> MISSION PACKAGE DRAFT
-> MAP PHASES
-> OBJECTIVES / TRIGGERS / LOGIC / DIALOGUE
-> VALIDATE
-> TEST MISSION
-> EXPORT PACKAGE
-> REAL RUNTIME LOADER
```

The project has crossed from engine-only testing into mission-authoring territory. The builder is not final UI, but it is functional enough to build real mission sets.

---

## What Is Working Now

### Runtime Shell

- Title screen
- Mission select screen
- Mission briefing screen
- Mission catalog loading from `data/missions/missionList.json`
- Map catalog support from `data/maps/mapList.json`
- Mission-first loading
- Maps as phases inside missions
- Mission end / return-to-title flow
- Intro / victory / defeat dialogue hooks
- Keyboard-first shell navigation

### Core Combat / Battlefield

- Shared pilot/mech battlefield
- Pilot-only initiative
- Mechs as controlled bodies, not initiative actors
- Pilot and mech deployment
- Authored starts through map `startState.deployments`
- Embark / disembark
- Empty mech boarding marker on the rear boarding tile
- Occupied mech damage cascade:
  - Mech Shield
  - Mech Core
  - Pilot Shield
  - Pilot Core
- Disabled occupied mech behavior
- Move / brace / attack / ability / item / end turn command buckets
- Baseline CPU movement and attacks
- CPU exit from disabled occupied mechs

### Targeting / LOS

- Runtime unit `x/y` is center-tile truth
- Direct targeting is unit-based
- Mech direct targeting resolves to the mech center/focus tile
- 3x3 mech footprint still matters for occupancy and arc checks
- Missile targeting can still target open tiles
- Missile target LOS snaps to occupied unit focus/center when relevant
- Disabled/destroyed units are filtered from direct targeting
- Terrain height and structure edge height feed LOS and movement truth

### Structures

Structures are board truth, not decoration.

Current structure model:

```txt
tile height = terrain / floor elevation
edgeHeight = wall / door / barrier height
```

Working structure systems:

- Authored structure cells
- Authored structure edges
- `edgeHeight` as movement/LOS authority
- Walkable interior cells
- Door/opening edges with `edgeHeight: 0`
- Wall/barrier edges with positive `edgeHeight`
- Room IDs
- Room-based roof cutaway
- Lower/front wall and visible door fade for readability

Do not reintroduce structure `blocksMove` or `blocksLOS` as rule authority. Movement and LOS derive structure behavior from authored `edgeHeight`.

---

## Mission Builder V1

The fullscreen Mission Builder lives under:

```txt
src/builder/
```

Important modules:

```txt
src/builder/missionBuilder.js
src/builder/builderState.js
src/builder/builderAdapters.js
src/builder/builderMissionPackage.js
src/builder/builderLoadExisting.js
src/builder/builderMapFactory.js
src/builder/builderTerrain.js
src/builder/builderStructures.js
src/builder/builderSpawns.js
src/builder/builderUnits.js
src/builder/builderObjectives.js
src/builder/builderTriggers.js
src/builder/builderLogic.js
src/builder/builderDialogue.js
src/builder/builderValidation.js
src/builder/builderExport.js
src/builder/builderRuntimeTest.js
src/builder/ui/builderShell.js
src/builder/workspace/wysiwygWorkspace.js
```

Current builder tabs:

- Mission
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

### Builder Capabilities

The builder currently supports:

- Fullscreen builder shell opened with backtick
- Mission package drafting
- Multiple maps/phases inside one mission package
- Active map switching
- Existing mission/package loading
- Existing map import into a mission package
- Blank map creation
- Map duplication/removal
- Engine-backed WYSIWYG map preview
- Tile selection
- Edge selection with Shift-click
- Terrain/elevation/movement painting
- Structure cell/room painting
- Structure edge/wall/door/opening painting
- Spawn placement
- Deployment zone painting
- Unit/start assignment authoring
- Objective authoring
- Trigger authoring
- Logic chain authoring
- Dialogue block authoring
- Result text authoring
- Real validation
- Validation-gated Test Mission
- Validation-gated Export
- Changed mission package export zip

---

## Mission Authoring Grammar

The builder now has a practical mission grammar:

```txt
Mission = package wrapper
Map = mission phase
Objective = why the map matters
Trigger = when something happens
Logic = optional ordered action recipe
Dialogue = keyed story blocks
Results = victory/defeat presentation
```

### Objectives Available

- Defeat All
- Reach Zone
- Hold Zone
- Survive Rounds
- Trigger Event

### Triggers Available

Trigger types / timing moments:

- Unit Enters Zone
- Mission Start
- Round Start
- Round End
- Enter Mech
- Exit Mech
- Hit Target
- Stat Changed

Trigger presets / effects:

- Load Map / Next Map
- Change Unit Stat
- Complete Objective
- End Mission
- Start Dialogue
- Run Logic Chain

Zone triggers fire when a unit moves through a zone, not only when it stops on the final destination tile.

### Logic Available

Logic chains are intentionally small and list-based. They are not a node graph.

Conditions:

- No Condition
- Objective Complete
- Objective Incomplete
- Flag True
- Flag False
- Round At Least

Actions:

- Complete Objective
- Change Unit Stat
- Load Map / Next Map
- End Mission
- Start Dialogue
- Set Flag
- Give Item
- Remove Item

Current item actions are useful for simple mission keys/pickups, but deeper item/equipment authority is later work.

### Dialogue Available

Dialogue is mission-level keyed data. Core blocks:

- `intro`
- `victory`
- `defeat`

Custom blocks can be called by triggers or logic, for example:

```txt
hangar_warning
first_contact
skye_mech_reveal
```

Current note: mission intro is still mission-level. For multi-map missions, use custom dialogue triggers/logic for map-specific story beats.

---

## Validation

Validation now protects the builder from broken runtime data.

Validation checks include:

- Mission id/start map
- Duplicate map ids
- Map dimensions
- Missing/invalid tiles
- Spawn bounds
- Deployment/start assignment errors
- Player pilot presence
- Enemy pilot presence only when a `defeat_all` objective requires enemies
- Deployment cell size/count
- Mech deployment 3x3 fit
- Structure edge/cell bounds
- Duplicate structure edges
- Objective data
- Trigger data
- Logic chain data
- Dialogue data
- Export/test blocking errors
- Warnings for placeholder/default text and suspicious authoring choices

Warnings do not block. Errors block Test Mission and Export.

---

## Current Receipt Maps / Missions

These maps and missions should stay useful as regression receipts:

### `000_test` / `000_test_mission`

Authored pilot-start reference.

### `001_test` / `001_embarked_test_mission`

Authored embarked mech-start reference.

### `002_test` / `002_pilot_deployment_mission`

Pilot deployment V1 reference.

### `003_test` / `003_mech_deployment_mission`

Mech deployment V1 reference.

### `004_structure_test` / `004_structure_test_mission`

Structure edge-height movement / LOS receipt map.

### `005_warehouse_district` / `005_warehouse_district_mission`

Interior structure / room cutaway receipt map.

### `006_new_map` / `006_new_map_mission`

Builder export receipt.

### Cold Opening Trigger Receipt

A working two-map mission pattern has been proven:

```txt
Map 1:
- Skye starts on foot
- Objective: trigger event / reach hangar
- Trigger: load next map

Map 2:
- Skye starts from authored Map 2 start truth
- Objective: reach zone or defeat enemy
- Mission ends normally
```

---

## Current In Progress

The engine and builder function well enough to author missions. The next work is not broad new systems. The next work is mission content and small comfort passes discovered through use.

Active practical focus:

- Build small mission sets
- Find real authoring pain
- Compact the right-side builder UI
- Move repeated tab help text into better places
- Improve result/map/mission summary presentation
- Keep validation useful but not noisy

Known roughness:

- Builder right-side UI is functional but chunky
- Bottom help/status text repeats too much
- Some text explains architecture instead of helping author missions
- Mission intro is mission-level, not map-phase-specific
- Flags are currently best treated as map/phase memory unless explicitly carried later
- Item logic is an early mission hook, not a full inventory/equipment system

---

## Still To Come

Near-term:

- Builder UI compression / readability pass
- More mission authoring receipts
- Map/mission summary improvements
- Result/export information cleanup
- Dialogue/result polish
- More content data as missions require it

Later:

- Stronger AI objective awareness
- Structure/door/interior-aware AI
- Ability/item system expansion
- Equipment/frame authority
- Pre-mission loadout
- Campaign/save/persistence layer
- Better movement presentation / animation polish
- Art/music/sound polish
- Menus and campaign hub

---

## Core Design Truths

These are locked unless deliberately redesigned:

1. Code is truth.
2. Board truth comes first.
3. Pilots are the only initiative actors.
4. Mechs are controlled bodies, not initiative owners.
5. Runtime unit `x/y` is the unit center tile.
6. Occupancy is authority.
7. Enter Mech / Exit Mech are core contextual actions.
8. Weapons are not generic abilities.
9. Items and abilities share broad runtime paths where possible.
10. Start state and deployment are authored data, not fallback hacks.
11. Mission select is catalog-driven.
12. Mission is the primary load unit.
13. Maps are phases inside missions.
14. CPU uses real gameplay rules, not cheat rules.
15. Builder writes truth.
16. Engine runs truth.
17. Export packages truth.
18. Validation protects truth.
19. Simple before clever.
20. No bloated rewrites.

---

## Final Current Verdict

Ars Caelorum currently has a real game shell, real mission package loading, real authored map starts, real deployment, real objectives, real triggers, real logic chains, real dialogue authoring, real validation, and a real fullscreen Mission Builder.

The builder is functionally ready to design missions. It needs UI love, not a foundation rescue.
