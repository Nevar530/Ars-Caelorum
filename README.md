# Ars Caelorum

**Launch Game:** [Open Ars Caelorum](https://nevar530.github.io/Ars-Caelorum/)

Ars Caelorum is a browser-based tactical mech engine built in HTML, CSS, and JavaScript. It is no longer a loose prototype. The current build has a playable combat loop, shared mech/pilot board rules, sprite-based unit rendering, a live dev menu, and a working ground-phase map editor. The project is being built system-first so rules, occupancy, LOS, terrain, and authored map data stay stable while art and content grow on top of that foundation.

The current repo also reflects a major cleanup and render pass. Rendering is split across focused modules, the editor and map runtime are wired into the live game, and overlay readability has been rebuilt around terrain tile tinting and edge-color highlighting instead of a separate overlay layer fighting terrain depth. What remains is a smaller cleanup tail: removing old compatibility paths, trimming stale bridge leftovers, and locking file ownership cleanly before the next major gameplay system.

---

## Current State

### Core Tactical Engine
- 2:1 isometric battlefield
- shared mech and pilot rules space on one board
- mech footprint: **3x3**
- pilot footprint: **1x1**
- turn flow with move and action phases
- targeting, hit resolution, and damage flow
- height-aware movement
- height-aware LOS
- sprite-based unit rendering
- iso view and tactical top-down view

### Rendering + Readability
- terrain rendering is modularized under `src/render/`
- unit rendering is modularized and sprite-based
- overlays now resolve through **tile tinting and edge colors**
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
- shared mech/pilot battlefield preserved through the cleanup
- old rendering pressure reduced by moving logic out of monolithic paths

### Overlay Visibility Pass
- separate overlay-layer dependence reduced
- terrain tiles now carry gameplay highlight tint directly
- overlay edges are color-coded on the tile itself
- grid strokes were adjusted away from harsh black toward terrain-derived darker values
- iso readability improved without breaking top-down/editor view support

### Map Editor Pass
- editor is live in the dev menu
- map load/import/export/resize flow is wired
- terrain and movement-class painting are working
- spawn painting is working
- validation/status feedback is present

---

## Still Not Done

### Cleanup Tail
These are smaller than before, but still real:
- remaining old compatibility inputs and wrappers
- deprecated map/config compatibility keys
- stale bridge comments and outdated docs
- deciding whether a few helper/scaffold files become true authority or get removed

### Gameplay Expansion
- ability system v1
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
- real authoring workflow
- cleaner rendering contracts
- improved overlay readability

The next correct move is to finish the cleanup tail without reopening old snowball problems, then move into **Ability System V1**.

---

## Short Status

**Playable combat loop:** yes  
**Shared mech/pilot battlefield:** yes  
**3x3 mech authority:** yes  
**Sprite unit rendering:** yes  
**Map editor wired live:** yes  
**Overlay tint + edge-color pass:** yes  
**Major cleanup/refactor pass:** mostly yes  
**Cleanup tail:** still remaining  
**Abilities:** not started  
**Structures:** not started as runtime authority  
**AI:** not started
