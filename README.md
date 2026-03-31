# Ars-Caelorum

Ars Caelorum is a turn-based isometric tactics prototype blending mech combat and suppressed arcane systems. The game focuses on positioning, line-of-sight, and information-driven combat, with a dual-scale battlefield where mech warfare and on-foot operations coexist. Built as a modular prototype to explore tactical systems before full production.
https://nevar530.github.io/Ars-Caelorum/

---

## Current Prototype Controls

* Arrow Keys / WASD: Move board focus
* Enter / Space: Confirm / Open Menu
* Escape / Backspace: Cancel
* Q / E: Rotate map
* R: Toggle Tactical View (Top-Down)
* Tab: Snap focus to active mech

Map editor:

* Left click: Raise elevation
* Right click: Lower elevation

---

# Core Systems (Current State)

### Movement System ✅

* Grid-based movement with pathfinding
* Movement cost = `1 + elevation change`
* Cannot climb more than +1 elevation
* Downward movement allowed with cost scaling
* Movement preview with path + cost display

### Terrain System ✅

* Block-based elevation (FFT-style)
* Elevation = 1/2 tile height (visual consistency rule)
* Clean stacking and readability
* Designed for cube + slope expansion

### Camera System ✅

* Smooth rotational tween (90° increments)
* Isometric view (default)
* Tactical top-down toggle
* Zoom-ready (tile size scaling implemented)

### Rendering ✅

* SVG-based renderer
* Depth sorting (terrain + units corrected)
* Units anchored bottom-center to tile top center
* Proper occlusion with elevation
* Modular render pipeline

### HUD / Input System ✅

* Menu-driven (FFT-style interaction)
* No hotkey dependency for core actions
* Bottom-anchored HUD (no clipping)
* Context-sensitive states (idle / move / facing)

---

# Core Design Rules

### Scale Rules (FOUNDATIONAL)

* 1 tile = 1 mech position
* 1 tile = future 2×2 pilot grid (4 pilot positions)
* Mech occupies full tile
* Pilot occupies sub-tile

### Unit Scale

* Mech ≈ 4× human height (~24 ft equivalent scale)
* Pilot ≈ 1/4 mech height
* Scale chosen for:

  * readability
  * environment interaction
  * dual-scale gameplay

---

# Combat Structure

### Turn Structure (IN PROGRESS)

Each round consists of:

1. Initiative Roll (per unit, pilot-based)

2. Move Phase

   * Lowest initiative moves first
   * Each unit chooses:

     * Move
     * Wait
   * Facing locked after movement

3. Action Phase

   * Highest initiative acts first
   * Actions include:

     * Attack
     * Items
     * Abilities (future)

4. End Round → Re-roll initiative

---

# Core Mechanics

### Facing System ✅

* Directional facing after movement
* No backward facing
* Visual indicator (top stripe)

---

### Attack System 🔜 (Prototype Phase)

* Tile-based targeting
* Range validation
* LOS validation
* No damage system initially
* Goal: validate targeting + interaction first

---

# Dual-Scale Gameplay (CORE FEATURE)

### Mech Layer

* Controls space
* High durability
* Direct combat
* Limited precision

### Pilot Layer

* Controls interaction
* Fragile (AoE = instant death)
* Cannot engage mech directly
* Gains advantage through:

  * positioning
  * environment
  * timing

---

### Scale Transition

* Same battlefield at all times
* No separate maps
* Camera zoom used to change scale context

#### Mech View

* Strategic positioning
* Tile-level movement
* Large-scale awareness

#### Pilot View

* Zoomed-in battlefield
* Sub-tile navigation
* Interaction visibility:

  * doors
  * alleys
  * structures

---

# Environment System (FOUNDATION)

### Structure Types

#### Light Structures (Half-Tile Walls)

* Sized for pilot-scale readability
* Pilot:

  * blocks movement
  * blocks LOS
* Mech:

  * breakable
  * can move through or destroy
* Purpose:

  * interior layout
  * cover system
  * destructible environment

---

#### Heavy Structures

* Pilot:

  * blocks movement
  * blocks LOS
* Mech:

  * blocks movement
  * requires destruction

---

#### Fortified Structures (Bunkers / Turrets)

* Pilot:

  * can enter / operate
* Mech:

  * cannot pass
  * must destroy or avoid

---

### Interaction Rules (PLANNED)

Pilot can:

* Enter / exit mech
* Use structures (turrets, bunkers)
* Sabotage mech

---

### Sabotage System (PLANNED)

* Close-range pilot interaction
* Effects may include:

  * disable mech for 1 turn
  * reduce armor
  * disable weapons
  * delayed damage

---

### Core Combat Rule

* Pilot hit by mech-scale AoE → immediate death
* Ensures:

  * pilot risk
  * no direct combat parity
  * tactical use only

---

# Terrain Interaction Model (FOUNDATION)

All terrain should support:

* blocksPilotMovement
* blocksMechMovement
* blocksLOS
* destructibleByMech

(No implementation required yet — structure defined to prevent future refactor)

---

# Roadmap

## Phase 1 – Core Combat Loop (ACTIVE)

* Facing system ✅
* Movement system ✅
* HUD/menu system ✅

### Next Steps

* Multi-unit turn system
* Initiative queue
* Move phase sequencing
* Action phase sequencing

---

## Phase 2 – Combat Validation

* Targeting system
* Attack shapes (AoE, line, cone)
* LOS system
* Hit validation (no damage yet)

---

## Phase 3 – Terrain Expansion

* Slopes
* Terrain types
* Structure placement
* Map editor expansion

---

## Phase 4 – Pilot Integration (SYSTEM READY)

* Sub-tile grid (2×2 per tile)
* Pilot movement
* Zoom-based interaction
* Structure interaction

---

## Phase 5 – Mech/Pilot Interaction

* Enter / exit mech
* Mixed-scale combat
* Sabotage system
* Environmental gameplay

---

## Phase 6 – Visual Layer

* Sprite replacement for cubes
* Animation layer
* Camera polish

---

## Phase 7 – Production Direction

* Rendering decision (SVG vs WebGL)
* Content expansion
* Campaign structure

---

# Long-Term Vision

Ars Caelorum is a **dual-scale tactics system** where:

* Mechs control space
* Pilots control interaction
* Terrain changes meaning depending on scale

The goal is a system where:

* Every action is visible
* Every outcome is understandable
* Every decision is intentional

---

# Core Identity

This is not just a mech tactics game.

It is a **multi-scale tactical system** built on:

* positioning
* interaction
* environmental problem solving

Fun must exist **before visuals**.
