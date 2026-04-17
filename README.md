# Ars Caelorum

**Launch Game:** [Open Ars Caelorum](https://nevar530.github.io/Ars-Caelorum/)

Ars Caelorum is a sprite-based isometric tactical mech engine built in HTML, CSS, and JavaScript. The project is focused on a clean gameplay foundation first: occupancy-based movement, height-aware line of sight, tactical facing, mech and pilot scale sharing the same battlefield, and a full data-driven map authoring path that will later support terrain sprites, structures, and scenario design.

The current build already supports playable tactical skirmish flow, a live dev environment, and a real map editor. Mechs use a 3x3 footprint, pilots use 1x1, both exist on the same board, and terrain now has authored presets and movement behavior. The game is still in active development, but it is no longer just a rendering sandbox or proof of concept. It now has a working engine core, a working authoring workflow, and a clear path forward.

---

## Current Engine State

### Tactical Gameplay
- 2:1 isometric tactical board
- Shared battlefield for mech scale and pilot scale
- Mechs use **3x3** occupancy
- Pilots use **1x1** occupancy
- Turn flow, selection, movement, targeting, and combat are active
- Height-aware movement is active
- Height-aware LOS is active
- Range and targeting systems are active
- Damage resolution is active
- Sprite-based unit rendering is active
- Top-down tactical/editor view is active

### Terrain System
- Terrain presets are **data-driven from JSON**
- Current terrain presets:
  - Grass
  - Rock
  - Sand
  - Water
  - Asphalt
  - Concrete
- Terrain behavior classes are active:
  - Clear
  - Difficult
  - Impassable
  - Hazard
- Movement behavior is already hooked in:
  - **Clear** = normal
  - **Difficult** = +1 move cost
  - **Hazard** = +1 move cost
  - **Impassable** = blocked
- For **3x3 mechs**, all 9 occupied tiles are checked
- Live board terrain colors now reflect authored terrain presets
- Terrain sprite groundwork is in place through sprite-set ids for later `_top` / `_face` rendering

### Dev + Authoring Tools
- Dev menu has been reworked into a usable tool surface
- Help/usage support is present in the UI
- Full ground-phase map editor is active
- Map editor supports:
  - Paint height directly
  - Brush sizes
  - Terrain preset painting
  - Terrain behavior painting
  - Spawn placement
  - Map resize
  - Import map JSON
  - Export map JSON
  - Built-in map dropdown via `mapList.json`
  - Validation checks
  - Larger editor workspace
  - Brush preview
  - Stronger spawn markers
  - Better map readability and status feedback

---

## Controls

### Main Gameplay
- The main game is currently **keyboard-driven**
- Movement, facing, turn flow, and combat testing are handled through the current gameplay input setup
- The main game does **not** currently use mouse controls as its primary play input
- Mouse interaction is mainly used inside the dev tools and editor workflow

### Dev Menu
- Open the dev menu from the in-game UI control
- The dev menu includes development utilities and the map editor
- The map editor updates the **live runtime map**

### Map Editor Controls
- Select a **Paint Mode**
- Set the value for that mode
- **Left Click** on the lower editor map to paint live changes
- **Right Click** on the lower editor map to sample a tile where supported
- Brush preview shows the current paint footprint
- Validation panel reports map issues such as missing or overlapping spawns and invalid resize outcomes

---

## What You Can Do Right Now

When the game starts, the current build lets you:

- Load into a playable tactical test state
- Move mechs and pilots on the same board
- Use height-aware movement and LOS
- Target and resolve attacks
- Open the dev menu without breaking out of the game flow
- Open the map editor and author terrain live
- Paint height, terrain presets, terrain behavior, and spawn points
- Resize maps safely
- Import and export map files
- Validate map setup before use

This means the current build already supports:
- engine testing
- combat flow testing
- terrain rules testing
- spawn setup
- level blockout
- early mission-space authoring for ground terrain

---

## Current Data-Driven Content Structure

### Maps
Maps are loaded from JSON and listed through:
- `data/maps/mapList.json`

Map files currently support:
- width
- height
- tile data
- terrain preset id
- terrain sprite id
- movement class
- spawn groups

### Terrain
Terrain options are loaded from JSON:
- `data/terrain/terrainList.json`
- `data/terrain/terrain.json`

This allows new terrain presets to be added without rewriting editor code.

---

## Recently Completed

### Dev + Tooling
- Help/menu support improved
- Dev menu reworked
- Map editor rebuilt into a real authoring tool
- Larger editor layout and better usability pass completed

### Terrain Authoring
- Terrain preset system moved to JSON-driven definitions
- Terrain behavior classes added
- Terrain behavior now impacts movement
- Live board colors now match authored terrain presets

### Top-Down / Editor Readability
- Top-down/editor presentation cleaned up
- Lower editor map enlarged
- Brush preview added
- Spawn markers improved
- Validation feedback added

---

## In Progress / Still Planned

These are still planned but are **not** considered part of the completed ground-phase editor work:

### Engine Cleanup
- Full bridge cleanup to remove remaining old mech/unit compatibility paths
- Render responsibility cleanup and de-bloat pass
- Further contract cleanup between systems where needed

### Gameplay Expansion
- Ability system v1
- Structure authority / structures pass
- Hazard damage/effects beyond current movement cost
- Scenario logic and objectives
- AI behaviors

### Art Expansion
- Terrain sprite rendering using `_top` / `_face`
- Expanded unit sprite coverage
- Later art polish and content passes

---

## Project Direction

Ars Caelorum is being built foundation-first.

The goal is not to fake progress through flashy placeholders. The goal is to build a stable tactical engine where:
- movement truth is clear
- occupancy is authoritative
- terrain matters
- scale matters
- authored maps are real data
- later art can slot into working systems instead of forcing rebuilds

The current state reflects that direction. The engine now has a usable tactical core and a usable ground-terrain authoring workflow. The next phases build outward from that foundation instead of replacing it.

---

## Short Status Summary

**Core tactical engine:** working  
**Unit rendering:** active  
**Ground terrain authoring:** working  
**Terrain movement behavior:** working  
**Top-down/editor workflow:** working  
**Map import/export/load/resize/validate:** working  
**Structures:** not started as gameplay authority  
**Abilities:** not started as full gameplay system  
**Terrain sprite art hookup:** groundwork in place, not yet rendered

---
