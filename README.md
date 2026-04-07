# Ars Caelorum

A deterministic, system-first tactical mech strategy game.

## ▶ Play the Game
https://nevar530.github.io/Ars-Caelorum/

---

## Overview

Ars Caelorum is a turn-based tactics engine built around:

- clear, explainable mechanics  
- deterministic outcomes  
- positioning-driven gameplay  
- layered system design  

The game combines:
- mech-based combat  
- pilot-driven stats  
- terrain and elevation tactics  
- future dual-scale gameplay (mech ↔ pilot)  

---

## Core Systems (Current Build)

### Movement
- tile-based movement
- elevation-aware pathing
- preview → confirm → facing lock

### Facing
- 4-direction system (N, E, S, W)
- locked after movement
- affects **damage**, not hit chance

### LOS (Line of Sight) — COMPLETE
- dual-ray system (chest + head)
- deterministic terrain blocking
- outputs:
  - clear
  - half cover
  - full block

Rules:
- half cover = valid target (+TN)
- full block = invalid target

### Targeting — COMPLETE (Validation Layer)
Flow:
1. fire arc check  
2. range check  
3. LOS check  
4. valid target  

Weapons:
- melee
- rifle (direct)
- missile (tile + splash)
- machine gun (cone)

### Initiative & Turn System — COMPLETE
- roll: 2d6 + reaction
- Move Phase: low → high
- Action Phase: high → low
- full round loop implemented

### Dev Systems — COMPLETE
- dev menu (spawn, assign, test)
- map editor (integrated)
- debug log (last actions)

---

## Systems Designed (Next Layer)

### To-Hit System (V2 — Locked Design)
- 2d6 roll ≥ Target Number (TN)
- TN based on:
  - range
  - cover (from LOS)
  - height difference
  - pilot stats (reaction / targeting)
  - brace modifiers

Important:
- LOS = VALIDITY  
- TN = DIFFICULTY  

### Damage System (V1 — Locked Design)
- fixed damage (no randomness)
- applied on hit only

Features:
- shield → core system
- side hits: +2 damage
- rear hits: bypass shield
- brace: -2 damage taken
- missile splash with falloff
- shield recharge (delayed to next round)

---

## Architecture Principles

- validation is separate from resolution  
- no hidden systems  
- no conflicting mechanics  
- everything must be explainable  

Combat layers:

1. Validation (LOS, targeting)  
2. Hit Resolution (To-Hit)  
3. Damage Resolution  

---

## Scale System (Planned — Critical)

The game uses a **single consistent grid**.

Scale differences are handled by:
- footprint (tile occupancy)
- height profiles (LOS)
- interaction rules

NOT by changing grid size.

### Planned Scale

- Mech → standard unit  
- Pilot → smaller unit (on-foot gameplay)  
- Structures → multi-tile (2x2, 4x4, etc.)  

### Implementation Order (Important)

1. Footprint / multi-tile occupancy  
2. Structure placement  
3. Pilot unit type  
4. Exit / enter mech  

This prevents:
- LOS inconsistencies  
- targeting bugs  
- movement conflicts  

---

## Roadmap (Current State)

### Engine
✔ Movement, facing, LOS  
✔ Multi-unit system  
✔ Initiative + round flow  

### Combat (Next)
→ To-Hit system  
→ Damage system  

### Architecture
→ Footprint / multi-tile support  
→ Unit abstraction (mech + pilot)  

### Tools
→ Map editor expansion  
→ Save / load / export  

### Systems
→ Abilities & items  
→ AI behavior  

### Content
→ factions  
→ missions  
→ campaign  

### Final
→ sprites & layering  
→ animation & VFX  
→ UI polish  

---

## Key Design Rule

The engine is built in layers:

**Engine → Validation → Resolution → Scale → Content → Art**

Nothing skips layers.

---

## Project Status

The core tactical engine is stable and functional.

Current focus:
- implementing To-Hit  
- implementing Damage  
- preparing for scale expansion  

---

## Goal

Build a complete, fully functional tactics engine first.

Then layer:
- systems  
- scale  
- content  
- art  

In that order.
