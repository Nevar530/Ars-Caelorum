# Ars Caelorum

**Live Build:** https://nevar530.github.io/Ars-Caelorum/

**Ars Caelorum** is an in-browser 2:1 isometric tactics RPG / tactics-engine prototype built with HTML, CSS, JavaScript, and SVG rendering.

The project is built around a deterministic, readable tactical battlefield where pilots and Telum operate in the same rules space, maps are authored as data, and mission flow comes from board truth rather than hidden scripting.

---

## Current Live Direction

Ars Caelorum now has a real playable shell, functional mission package loading, a fullscreen Mission Builder, combat maps, story/exploration maps, and a graybox cold-opening mission chain.

Current game flow now supports:

```txt
TITLE
-> MISSION SELECT
-> MISSION BRIEFING
-> MAP / PHASE BRIEFING
-> STORY OR COMBAT MAP
-> OBJECTIVES / TRIGGERS / DIALOGUE
-> NEXT MAP PHASE OR MISSION RESULT
-> RETURN TO TITLE
```

Current builder flow:

```txt
MISSION BUILDER
-> MISSION PACKAGE DRAFT
-> MAP PHASES
-> MAP MODE / PHASE BRIEFING
-> STARTS / DEPLOYMENTS
-> OBJECTIVES / TRIGGERS / LOGIC / DIALOGUE
-> VALIDATE
-> TEST MISSION
-> EXPORT PACKAGE
-> REAL RUNTIME LOADER
```

The project has crossed from engine-only testing into mission-authoring and opening-sequence grayboxing.

---

## What Is Working Now

### Runtime Shell

- Title screen
- Mission select screen
- Mission briefing screen
- Full-screen map phase briefing screen
- Mission catalog loading from `data/missions/missionList.json`
- Map catalog support from `data/maps/mapList.json`
- Mission-first loading
- Maps as phases inside missions
- Combat mode maps
- Story / Exploration mode maps
- Mission result / return-to-title flow
- Keyboard-first shell navigation

### Story / Exploration Mode

Story Mode is a map-level mode, not a separate game.

Maps can use:

```json
"mode": "story"
```

Story Mode supports:

- free movement
- no initiative
- no rounds
- no move/action phase split
- no enemy turns unless the map is intentionally combat
- Action / Enter interaction
- authored interact triggers
- dialogue triggers
- zone triggers
- reach/trigger objectives
- enter/exit mech
- load next map

Story Mode uses the same mission package, map data, objectives, triggers, logic, dialogue, validation, and export paths as Combat Mode.

### Phase Briefings

Each map can optionally show a full-screen phase briefing before player control.

Maps can use:

```json
"showPhaseBriefing": true,
"phaseBriefing": {
  "title": "Earth Hospital - Two Weeks Later",
  "subtitle": "EARTH / PRIVATE RECOVERY WARD",
  "text": "Skye wakes in a clean hospital room with the meter already running.",
  "objectives": ["Reach the elevator with Eve."]
}
```

Phase briefings are used as map-to-map interstitials / loading-screen style story cards.

### Core Combat / Battlefield

- Shared pilot/mech battlefield
- Pilot-only initiative
- Mechs as controlled bodies, not initiative actors
- Pilot and mech deployment
- Authored starts through map `startState.deployments`
- PC or CPU control per authored unit start
- CPU player-team allies can fight opposing teams
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
- Grid-style command menu navigation for two-column command layouts

### Tactical HUD

The HUD now uses a tactical RPG layout:

```txt
LEFT: active unit / Telum readout
CENTER: objective + command grid
RIGHT: target readout
ABOVE HUD: turn / initiative popup
```

The active unit and target panels use compact SHD/CORE bars and one-row stat strips. Embarked pilot info is reduced to the vitals needed during mounted play.

### Targeting / LOS

- Runtime unit `x/y` is center-tile truth
- Direct targeting is unit-based
- Mech direct targeting resolves to the mech center/focus tile
- 3x3 mech footprint still matters for occupancy and arc checks
- Missile targeting can target open tiles
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
- Compact right-side inspector
- Right inspector scroll reset when switching tabs
- Mission package drafting
- Multiple maps/phases inside one mission package
- Active map switching
- Existing mission/package loading
- Existing map import into a mission package
- Blank map creation
- Existing map resize from Map tab
- Shrinking a map crops data outside the new grid
- Map mode selection: Combat or Story / Exploration
- Per-map phase briefing fields
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
- Unit control authoring: PC or CPU
- Objective authoring
- Trigger authoring
- Logic chain authoring
- Dialogue block authoring
- Dialogue line editing, deletion, and reordering
- Dialogue speaker/portrait authoring
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
Map Mode = combat or story pacing
Phase Briefing = optional map-load story card
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
- Protect Unit / Fail if Down

Protect Unit is used for Skye-must-survive, escort, VIP, convoy-pilot, and rescue maps.

### Triggers Available

Trigger types / timing moments:

- Unit Enters Zone
- Interact / Action Button
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

Mission Start triggers can fire for both combat and story maps after any phase briefing is dismissed.

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

Custom blocks can be called by triggers or logic.

The builder supports editing, deleting, and reordering dialogue lines. Portraits can be manually overridden. Future portrait convention should default to:

```txt
art/pilot/[lowercase_pilot_name]_portrait.png
```

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

### `007_story_mode_demo` / `007_story_mode_demo_mission`

Story Mode receipt:

```txt
Talk to NPC
-> Action Button dialogue
-> walk to rear hatch
-> enter Telum
-> move Telum to exit marker
-> mission complete
```

### `008_cold_opening_flow_mission`

Current graybox opening flow receipt:

```txt
008 Mars Cold Open
-> 009 Earth Hospital
-> 010 Underground Parking Garage Escape
-> 011 Gabrielle Enforcement Agency / Gabe Meeting
-> 012 Gabrielle Mech Bay
-> 013 Practice Sparring
```

This proves the core campaign rhythm:

```txt
combat -> story -> combat -> story -> story/mount -> combat
```

---

## Validation

Validation protects the builder from broken runtime data.

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
- Protect Unit target references
- Trigger data
- Logic chain data
- Dialogue data
- Export/test blocking errors
- Warnings for placeholder/default text and suspicious authoring choices

Warnings do not block. Errors block Test Mission and Export.

---

## Current In Progress

The engine and builder now function well enough to author the opening mission chain.

Active practical focus:

- Build and polish the real cold-opening maps
- Replace graybox terrain with readable environments
- Use phase briefings for map-to-map story flow
- Use Story Mode for hospital / Gabe / locker room / mech bay beats
- Use Combat Mode for Mars, garage escape, and sparring
- Find real authoring pain while building the opening
- Keep HUD and builder UI compact and console-friendly

Known roughness:

- Loading transitions beyond phase briefings are not final
- AI is functional but not objective-smart
- Builder typography can tighten a little more
- Dialogue authoring needs real writing stress-test
- Map/file id `012_gabriel_mech_bay` should eventually be corrected to `012_gabrielle_mech_bay` with references updated
- Item logic is an early mission hook, not a full inventory/equipment system

---

## Still To Come

Near-term:

- Real cold-opening map authoring
- Phase briefing polish
- Dialogue authoring polish after real script work
- Builder compact typography pass
- Map/mission summary improvements
- More mission receipts based on real opening needs

Later:

- Objective-aware AI
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
14. Story Mode is a map pacing mode, not a separate mission system.
15. CPU uses real gameplay rules, not cheat rules.
16. Builder writes truth.
17. Engine runs truth.
18. Export packages truth.
19. Validation protects truth.
20. Simple before clever.
21. No bloated rewrites.

---

## Final Current Verdict

Ars Caelorum currently has a real game shell, real mission package loading, real authored map starts, real deployment, combat maps, story maps, phase briefings, objectives, triggers, logic chains, dialogue authoring, protect-unit fail objectives, validation, and a real fullscreen Mission Builder.

The foundation is ready for opening-sequence mission design. The next work is content, polish, and targeted authoring comfort—not a foundation rescue.
