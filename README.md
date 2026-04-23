# Ars Caelorum 

**Launch Game:** [Open Ars Caelorum](https://nevar530.github.io/Ars-Caelorum/)

Ars Caelorum is a browser-based tactical mech game engine built in HTML, CSS, and JavaScript.

The project is now past pure prototype status. The combat layer is real, the shared pilot/mech battlefield is real, embark/disembark is real, disabled mech behavior is real, and item/ability runtime paths have begun to exist in actual game flow.

The next major push is no longer “add another isolated mechanic.”
The next major push is to build the real mission loop:

**Mission Select -> Deployment -> Begin Mission -> Play -> Victory/Defeat -> Restart/Return**

---

## Current State

### Done Now
- [x] 2:1 isometric battlefield
- [x] tactical top-down view
- [x] shared mech/pilot rules space on one board
- [x] 3x3 mech occupancy
- [x] 1x1 pilot occupancy
- [x] pilot-only initiative
- [x] actor/body separation
- [x] embark/disembark working
- [x] occupied mech damage cascade working
- [x] disabled occupied mech behavior working
- [x] move + brace + attack + ability + item + end turn command buckets
- [x] combat loop working
- [x] item/ability runtime path V1
- [x] sprite-based unit rendering
- [x] live dev menu
- [x] live map editor
- [x] JSON-backed map workflow
- [x] map catalog loading
- [x] map metadata support for `spawns` and `startState`
- [x] runtime support for `startState.deployments`
- [x] primitive mission result evaluation / restart overlay
- [x] loadout / inventory scaffolding
- [x] weapon lookup moving in a loadout-first direction

---

## Core Rules Locked In

These are not experimental anymore.

- [x] Pilots are the only initiative actors
- [x] Mechs are controlled bodies, not initiative owners
- [x] The active pilot actor is not always the active board body
- [x] Occupancy is authority
- [x] Enter Mech / Exit Mech remain core contextual verbs
- [x] Weapons are not generic abilities
- [x] Items and abilities should share the same broad action pipeline where possible
- [x] Disabled occupied mechs do not get normal mech actions
- [x] Disabled occupied mechs must still keep **Exit Mech** available
- [x] Repair/recovery through items is only allowed when explicitly granted
- [x] Start-state / deployment must become authored data, not another hardcoded test exception

---

## Working Gameplay

### Battlefield + Combat
- [x] shared mech/pilot battlefield
- [x] move phase + action phase flow
- [x] height-aware movement
- [x] height-aware LOS
- [x] targeting and hit resolution
- [x] shield/core damage flow
- [x] combat text feedback over impacted units

### Pilot / Mech Interaction
- [x] pilots control themselves on foot
- [x] pilots control their mech body while embarked
- [x] Enter Mech during action phase
- [x] Exit Mech during action phase
- [x] embarked pilots leave board occupancy
- [x] embarked pilots are not targetable
- [x] empty mechs remain on the board as real blocking/targetable objects

### Disabled Occupied Mech Truth
- [x] no normal move
- [x] no normal attack
- [x] no normal brace
- [x] no normal mech abilities
- [x] Exit Mech remains available when valid
- [x] occupied damage cascade remains:

    Mech Shield -> Mech Core -> Pilot Shield -> Pilot Core

---

## Rendering + Readability

- [x] terrain rendering modularized under `src/render/`
- [x] unit rendering modularized and sprite-based
- [x] overlay readability improved
- [x] tile tinting and edge-color overlays integrated into terrain styling
- [x] terrain-derived grid strokes replacing harsh flat black where applicable
- [x] LOS/status layers still separated where that makes sense

---

## Dev Tools + Authoring

- [x] live dev menu
- [x] live round / unit / map state inspection
- [x] ground-phase map editor wired into runtime
- [x] brush painting for:
  - [x] height
  - [x] terrain preset
  - [x] movement class
  - [x] spawn placement
  - [x] erase
- [x] brush size support
- [x] map resize
- [x] map import/export
- [x] built-in map load dropdown
- [x] validation/status feedback

---

## Data-Driven Content

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

---

## Repo Structure

### Gameplay Runtime
- `src/controllers/` — game, movement, combat, turn flow
- `src/combat/` — hit, damage, combat text
- `src/targeting/` — range, fire arc, targeting logic
- `src/scale/` — occupancy and mech/pilot footprint math
- `src/maps/` — map schema, runtime, mutations, spawns
- `src/render/` — terrain, units, overlays, LOS, projection, scene building
- `src/actors/` — actor/body resolution helpers
- `src/vehicles/` — embark/disembark rules and actions

### Dev / Editor
- `dev/devMenu.js`
- `dev/devMenuModules/`
- `dev/mapEditor/`

---

## Recently Completed

### Cleanup / Refactor Pass
- [x] render responsibilities split into focused modules
- [x] controller responsibilities split more cleanly
- [x] map runtime/editor support separated into dedicated modules
- [x] old monolithic pressure reduced
- [x] shared mech/pilot battlefield preserved through cleanup

### Overlay Visibility Pass
- [x] reduced dependence on separate overlay-only rendering
- [x] terrain tiles carry gameplay tint directly
- [x] edge colors show directly on the tile
- [x] readability improved in active play

### Embark / Disembark + Actor/Body Pass
- [x] pilot-only initiative enforced
- [x] actor/body resolution active
- [x] move/attack flow routed through active body
- [x] Enter Mech works
- [x] Exit Mech works
- [x] embarked pilots leave board presence correctly

### Item / Ability Foundation Pass
- [x] ability command path exists
- [x] item command path exists
- [x] test runtime path is now real
- [x] groundwork exists for broader content expansion
- [x] groundwork exists for later weapon/loadout cleanup

---

## On Deck

## Phase 1 — Mission Start Framework V1
Goal: replace prototype spawn behavior with a real authored mission start flow.

- [ ] mission select entry
- [ ] two default test missions:
  - [ ] Pilot Start Test
  - [ ] Mech Start Test
- [ ] map-authored player deployment slots
- [ ] authored enemy starts
- [ ] Begin Mission gate only after valid deployment

### Locked V1 Deployment Rule
- [ ] fixed deployment slots first
- [ ] no free-roaming FFT-style deployment zone yet
- [ ] player selects **who** goes into **which** legal slot

### Pilot Start Test
- [ ] player deploys Biggs + Wedge as pilots
- [ ] enemy uses Tom + Jerri
- [ ] optional empty mechs can exist on map as authored board objects

### Mech Start Test
- [ ] player deploys Mech A + Mech B
- [ ] enemy uses Mech C + Mech D
- [ ] paired pilots start already embarked

### Default Test Content Rule
All default test units should start from default data/loadout authority, not one-off mission hacks.

#### Pilots
- [ ] Biggs
- [ ] Wedge
- [ ] Tom
- [ ] Jerri

Each should start with:
- [ ] test pilot heal ability
- [ ] test pilot damage ability
- [ ] test spray heal item
- [ ] test spray damage item

#### Mechs
- [ ] Mech A
- [ ] Mech B
- [ ] Mech C
- [ ] Mech D

Each should start with:
- [ ] test mech heal/repair ability
- [ ] test mech damage ability
- [ ] test tube heal item
- [ ] test tube damage item

---

## Next After That

## Phase 2 — Mission End Loop V1
Goal: close the loop so the repo has a real mission shell.

- [ ] victory condition
- [ ] defeat condition
- [ ] mission complete / mission failed overlay cleanup
- [ ] restart mission
- [ ] return to mission select

### V1 Win / Loss
- [ ] victory = all enemy pilot actors out of play
- [ ] defeat = all player pilot actors out of play

---

## Planned After Mission Loop

## Phase 3 — Cleanup Tail / Contract Lock
- [ ] remove hardcoded fallback test-spawn dependence
- [ ] remove stale compatibility paths where safe
- [ ] clean docs/comments to match runtime truth
- [ ] lock one clear authority path for:
  - [ ] mission data
  - [ ] deployment
  - [ ] unit instantiation
  - [ ] mission result

## Phase 4 — Content Expansion
- [ ] more abilities
- [ ] more items
- [ ] targeted effects
- [ ] buffs / debuffs
- [ ] movement utility
- [ ] support actions
- [ ] broader test/faction content
- [ ] mission-specific content grants later

## Phase 5 — Equipment / Frame Authority
- [ ] move farther away from hardwired mech assumptions
- [ ] frames determine move baseline
- [ ] frames determine slot layout
- [ ] frames determine allowed equipment types
- [ ] weapons become fully equipped combat content
- [ ] shield modules become equipment authority
- [ ] core modules become equipment authority
- [ ] final mech state trends toward:
  - [ ] frame
  - [ ] equipped parts
  - [ ] pilot pairing
  - [ ] runtime damage state

## Phase 6 — Structure Authority
- [ ] walls
- [ ] doors
- [ ] interior cells
- [ ] access points
- [ ] movement / LOS / objective interaction on the same board

## Phase 7 — AI System
- [ ] basic move + attack
- [ ] target priority
- [ ] objective awareness
- [ ] mech / pilot role handling
- [ ] structure-aware behavior

## Phase 8 — Scenario / Save Layer
- [ ] scenario definitions
- [ ] objective scripting hooks
- [ ] save/load runtime state
- [ ] map + scenario packaging

## Phase 9 — Art / Polish
- [ ] expanded sprite work
- [ ] terrain sprite-set rendering
- [ ] animation
- [ ] VFX
- [ ] UI polish
- [ ] readability polish

---

## Short Status

**Playable combat core:** yes  
**Shared mech/pilot battlefield:** yes  
**Pilot-only initiative:** yes  
**Embark/disembark:** yes  
**Disabled occupied mech behavior:** yes  
**Item/ability runtime path V1:** yes  
**Live map editor:** yes  
**Mission loop:** not yet complete  
**Mission select/deployment:** next  
**Equipment/frame authority:** planned  
**Structures/AI/scenario:** later  

---

## End State Goal

A deterministic, readable tactics engine where:
- pilots and mechs operate on one battlefield
- deployment is authored and mission-driven
- combat start and end loops are real
- weapons / abilities / items move toward clean content authority
- terrain, structures, and objectives matter
- art and polish sit on top of stable rules instead of forcing rewrites
