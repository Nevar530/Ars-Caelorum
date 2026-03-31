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

Map editor remains mouse-driven for development:

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
* Elevation tied to tile height (1/2 tile height rule)
* Clean stacking and readability
* Designed for cube + slope expansion

### Camera System ✅

* Smooth rotational tween (90° increments)
* Isometric view (default)
* Tactical top-down toggle (R key)
* Shared data model across views

### Rendering ✅

* SVG-based renderer
* Depth sorting for terrain + units (fixed layering issues)
* Bottom-center anchoring for units (correct physical placement)
* Overlay system for movement and focus
* Modular rendering pipeline (ready for replacement later)

### HUD / Input System ✅

* Menu-driven action selection (FFT-style)
* Removed hotkey dependency
* Bottom-anchored HUD (no clipping)
* Context-sensitive UI (idle / move / facing states)

---

# Design Pillars

* Readability First – Player should understand outcomes at a glance
* Positioning Over Stats – Movement and placement drive decisions
* Systems Over Content – Build mechanics before expanding assets
* Layered Complexity – Add depth without increasing cognitive load

---

# Roadmap

## Phase 1 – Core Combat Loop (IN PROGRESS)

### Facing System ✅

* Directional facing after movement
* Limited facing options (no backward turn)
* Visual indicator (stripe / arrow system)

### Turn Flow 🔜

* Move → Facing → End Turn
* Multi-unit turn order
* Initiative system (low moves first, high acts first)

### Action Menu System ✅

* Select unit → menu → move / wait
* Structured interaction flow
* Attack reserved for next phase

### Attack System (Prototype) 🔜

* Basic targeting system (no damage yet)
* Range + LOS validation
* Tile-based selection
* Goal: validate targeting before damage systems

---

## Phase 2 – Tactical Combat Expansion

### Attack Shapes 🔜

* Line, cone, AoE, arc, cross
* Shape preview before confirm
* Tile-based targeting system

### Hit Chance Visualization 🔜

* Color-based system:

  * Green = High probability
  * Yellow = Medium
  * Red = Low
* Distance-based falloff
* Center tile strongest

### Line of Sight (LOS) 🔜

* Blocking terrain removes tiles from attack preview
* Cover reduces hit probability (future)
* Visual-first feedback (no hidden math)

---

## Phase 3 – Terrain & Map Systems

### Slopes & Terrain Types 🔜

* Slopes remove elevation movement penalty
* Directional slope logic
* Terrain cost modifiers

### Map Building 🔜

* Block-based map construction (cubes, slopes, partials)
* Internal map editor tools

---

## Phase 4 – Unit Identity

### Mech Roles 🔜

* Movement differences (cost, constraints)
* Weapon loadouts define playstyle

### Pilot System 🧱 (FOUNDATION ONLY)

* Pilot exists as separate entity from mech
* Initiative tied to pilot
* Pilot is fragile (AoE = death rule)
* Pilot not designed for direct combat

---

## Phase 5 – Dual Scale Gameplay (CORE FEATURE)

### Scale System 🧱

* Battlefield supports multiple scales:

  * Mech scale (1 tile)
  * Pilot scale (future: 2x2 per tile)
* Camera zoom transitions between scales

### On-Foot Mode 🔜

* Pilot operates within mech tile space
* Fine movement inside tiles
* Access to locations unreachable by mechs

### Mech ↔ Pilot Interaction 🔜

* Enter / exit mech
* Mech acts as physical object (blocking, cover)
* Pilot interacts with environment

### Environment Interaction 🔜

* Bunkers / turrets usable by pilots
* Structures provide anti-mech capability
* Sabotage mechanics (disable, disrupt, weaken mechs)

---

## Phase 6 – Visual & UX Polish

### Camera Improvements 🔜

* Zoom system (tile-scale multiplier implemented)
* Pilot zoom-in mode (same unit scale visually)
* Improved depth readability

### UI/UX 🔜

* Cleaner overlays
* Damage preview
* Expanded action menus

### Animation (Optional Layer)

* Movement animation
* Attack effects
* Camera transitions

---

## Phase 7 – Production Direction

### Rendering Options 🔜

* Continue SVG (optimized)
* OR migrate to WebGL / 3D renderer

### Content Expansion 🔜

* Maps
* Mechs
* Weapons
* Campaign structure

---

# Long-Term Vision

Ars Caelorum aims to combine:

* FFT-style positioning and clarity
* Battletech-inspired mech combat depth
* Multi-scale tactical gameplay (mech + pilot interaction)

The goal is a tactics system where:
Every decision is visible, understandable, and intentional.

---

# Core Differentiator

Ars Caelorum is not just a mech tactics game.

It is a **dual-scale tactical system** where:

* Mechs control space
* Pilots control interaction
* The battlefield changes meaning depending on scale

This creates:

* asymmetric gameplay
* environmental problem solving
* high-risk, high-reward tactical decisions
