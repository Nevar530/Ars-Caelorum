# Ars Caelorum

**Launch Game:** [Open Ars Caelorum](https://nevar530.github.io/Ars-Caelorum/)

Ars Caelorum is a browser-based tactical mech engine built in HTML, CSS, and JavaScript. It is no longer a loose prototype. The current build has a playable combat loop, a shared mech/pilot battlefield, sprite-based unit rendering, a live dev menu, a working ground-phase map editor, and a clean first-pass pilot/mech embark-disembark system.

The project is being built system-first. Board truth, occupancy, LOS, targeting, terrain, and authored data come before polish. Art and presentation will sit on top of stable runtime rules instead of forcing rewrites later.

---

## Current State

### Core Tactical Engine
- 2:1 isometric battlefield
- shared mech and pilot rules space on one board
- mech footprint: **3x3**
- pilot footprint: **1x1**
- move phase + action phase combat flow
- height-aware movement
- height-aware LOS
- targeting, hit resolution, and damage flow
- sprite-based unit rendering
- iso view and tactical top-down view

### Shared Pilot / Mech System
- **pilots are the only initiative actors**
- pilots control:
  - their own body while on foot
  - their mech body while embarked
- pilots can **Enter Mech**
- pilots can **Exit Mech**
- embark/disembark uses the **action**
- enter/exit is exposed through **Ability**
- boarding uses the **rear hatch**
- exit uses the **single center-rear tile**
- embarked pilots leave board occupancy and are not targetable
- empty mechs remain on the board as real blocking/targetable objects

### Rendering + Readability
- terrain rendering is modularized under `src/render/`
- unit rendering is modularized and sprite-based
- overlays resolve through **tile tinting and edge colors**
- active/focus/move/action previews are integrated into terrain tile styling
- terrain grid lines use darker terrain-derived strokes instead of flat black
- status plates and LOS previews remain separate UI layers where appropriate

### Dev Tools + Authoring
- live dev menu
- live round / unit / map state inspection
- ground-phase map editor wired into runtime
- brush painting for:
  - height
  - terrain preset
  - movement class
  - spawn placement
  - erase
- brush sizes
- map resize
- map import/export
- built-in map load dropdown
- live validation and status feedback

---

## What Works Now

### Gameplay
- start combat from setup
- cycle through move and action phases
- move mechs and pilots on the same battlefield
- preview reachable movement
- preview targeting and LOS
- resolve attacks
- apply shield/core damage
- show combat text markers over impacted units
- enter mechs during action phase
- exit mechs during action phase
- keep empty mechs on the board after disembark

### Map / Terrain Workflow
- maps load from JSON
- maps can be edited live in the dev menu
- terrain presets are data-driven
- movement classes are data-driven
- map definitions can be loaded, imported, exported, and resized
- runtime map state can be replaced cleanly from authored definitions

### Views
- isometric play view
- tactical top-down view
- enlarged editor map view inside the dev menu

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

This is now a genuinely split codebase, not a single-file sandbox.

---

## Recently Completed

### Major Cleanup / Refactor Pass
- render responsibilities split into focused modules
- controller layer split out by responsibility
- map runtime/editor support split into dedicated modules
- shared mech/pilot battlefield preserved through cleanup
- old rendering pressure reduced by moving logic out of monolithic paths

### Overlay Visibility Pass
- separate overlay-layer dependence reduced
- terrain tiles now carry gameplay highlight tint directly
- overlay edges are color-coded on the tile itself
- grid strokes were adjusted away from harsh black toward terrain-derived darker values
- iso readability improved without breaking top-down/editor support

### Embark / Disembark V1
- initiative now belongs to pilots only
- actor/body resolution is active
- move/attack/focus flow routes through the active body
- Enter Mech works
- Exit Mech works
- embarked pilots leave board presence
- hidden embarked pilots are not targetable
- empty mechs remain on the board after exit

---

## Still Not Done

### Cleanup Tail
These are smaller than before, but still real:
- remaining old compatibility inputs and wrappers
- deprecated map/config compatibility keys
- stale bridge comments and outdated docs
- formalizing authored startup state for pilots/mechs

### Gameplay Expansion
- broader ability system v1
- structure authority
- mission/objective layer
- AI behaviors
- scenario/save layer

### Art Expansion
- terrain sprite rendering from sprite sets
- expanded unit sprite coverage / facings
- animation / VFX / polish

---

## Current Direction

Ars Caelorum is now past the “is there a game here?” phase.

The engine has:
- stable board truth
- occupancy-first rules
- real combat flow
- a real pilot/mech shared-body mechanic
- real authoring workflow
- cleaner rendering contracts
- improved overlay readability

The next clean move is to formalize **authored startup state** for pilot/mech pairings, then continue broader abilities and structure rules before the art/polish pass.

---

## Short Status

**Playable combat loop:** yes  
**Shared mech/pilot battlefield:** yes  
**3x3 mech authority:** yes  
**Sprite unit rendering:** yes  
**Pilot-only initiative:** yes  
**Embark/disembark V1:** yes  
**Map editor wired live:** yes  
**Overlay tint + edge-color pass:** yes  
**Major cleanup/refactor pass:** mostly yes  
**Cleanup tail:** still remaining  
**Broader abilities:** not started  
**Structures:** not started as runtime authority  
**AI:** not started
