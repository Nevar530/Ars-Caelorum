# Ars-Caelorum

Ars Caelorum is a turn-based isometric tactics prototype blending mech combat and suppressed arcane systems. The game focuses on positioning, line-of-sight, and information-driven combat, with a dual-scale battlefield where mech warfare and on-foot operations coexist. Built as a modular prototype to explore tactical systems before full production.  
https://nevar530.github.io/Ars-Caelorum/

---

## Current Prototype Controls

- Arrow Keys / WASD: Move board focus  
- M: Enter move mode  
- Enter / Space: Confirm  
- Escape / Backspace: Cancel  
- Q / E: Rotate map  
- R: Toggle Tactical View (Top-Down)  
- Tab: Snap focus to active mech  

Map editor remains mouse-driven for development:
- Left click: Raise elevation  
- Right click: Lower elevation  

---

# Core Systems (Current State)

### Movement System
- Grid-based movement with pathfinding  
- Movement cost = `1 + elevation change`  
- Cannot climb more than +1 elevation  
- Downward movement allowed with cost scaling  
- Movement preview with path + cost display  

### Terrain System
- Block-based elevation (FFT-style)  
- Height directly affects movement and positioning  
- Designed for cube + slope expansion  

### Camera System
- Smooth rotational tween (90° increments)  
- Isometric view (default)  
- Tactical top-down toggle (R key)  
- Shared data model across views  

### Rendering
- SVG-based renderer  
- Depth sorting for terrain + units  
- Overlay system for movement and focus  
- Modular rendering pipeline (ready for replacement later)

---

# Design Pillars

- Readability First – Player should understand outcomes at a glance  
- Positioning Over Stats – Movement and placement drive decisions  
- Systems Over Content – Build mechanics before expanding assets  
- Layered Complexity – Add depth without increasing cognitive load  

---

# Roadmap

## Phase 1 – Core Combat Loop (Next)

### Facing System
- Directional facing after movement  
- Limited facing options (no backward turn)  
- Visual indicator (triangle / arrow mech base)  

### Turn Flow
- Move → Facing → End Turn  
- Multi-unit turn order  
- Initiative system (pilot-based, already designed)  

### Attack System (Prototype)
- Basic single-target attack  
- Range + LOS validation  
- Placeholder damage system  

---

## Phase 2 – Tactical Combat Expansion

### Attack Shapes
- Line, cone, AoE, arc, cross  
- Shape preview before confirm  
- Tile-based targeting system  

### Hit Chance Visualization
- Color-based system:
  - Green = High probability  
  - Yellow = Medium  
  - Red = Low  
- Distance-based falloff  
- Center tile strongest  

### Line of Sight (LOS)
- Blocking terrain removes tiles from attack preview  
- Cover reduces hit probability (future)  
- Visual-first feedback (no hidden math)

---

## Phase 3 – Terrain & Map Systems

### Slopes & Terrain Types
- Slopes remove elevation movement penalty  
- Directional slope logic  
- Terrain cost modifiers  

### Map Building
- Human-scale grid inside mech tiles  
- Block-based map construction (cubes, slopes, partials)  
- Internal map editor tools  

---

## Phase 4 – Unit Identity

### Mech Roles
- Movement differences (cost, constraints)  
- Weapon loadouts define playstyle  

### Pilot System
- Initiative based on pilot skill  
- Leveling system (point-based progression)  
- Separation of mech vs pilot capabilities  

---

## Phase 5 – Dual Scale Gameplay

### On-Foot Mode
- Human-scale combat inside mech grid  
- Interior / tight-space encounters  

### Mech ↔ Pilot Interaction
- Enter/exit mech  
- Mixed-scale encounters  
- Tactical layering between scales  

---

## Phase 6 – Visual & UX Polish

### Camera Improvements
- Enhanced rotation feel (flatten during turn)  
- Quick tactical view toggle/hold  
- Improved depth readability  

### UI/UX
- Cleaner overlays  
- Damage preview  
- Action menus (FFT-style)  

### Animation (Optional Layer)
- Movement animation  
- Attack effects  
- Camera transitions  

---

## Phase 7 – Production Direction

### Rendering Options
- Continue SVG (optimized)  
- OR migrate to WebGL / 3D renderer  

### Content Expansion
- Maps  
- Mechs  
- Weapons  
- Campaign structure  

---

# Long-Term Vision

Ars Caelorum aims to combine:
- FFT-style positioning and clarity  
- Battletech-inspired mech combat depth  
- Modern visual readability (no hidden systems)  

The goal is a tactics system where:
Every decision is visible, understandable, and intentional.
