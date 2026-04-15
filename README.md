
# Ars Caelorum

A deterministic, system-first tactical mech strategy engine built around explainable rules, shared map space, and dual-scale play.

## ▶ Play the Game

https://nevar530.github.io/Ars-Caelorum/

---

## Overview

Ars Caelorum is a turn-based tactics engine built to support:

- sprite-based isometric combat
- clear, explainable systems
- deterministic validation and resolution
- shared-map mech and pilot gameplay
- structure and objective play that goes beyond standard mech skirmish combat

The core idea is simple:

**Mechs and pilots exist on the same battlefield, on the same live map, under the same turn system.**

That means a mission can involve:

- mechs fighting for control of the exterior battlefield
- a pilot dismounting and entering a structure
- an objective being completed inside that structure
- the outside fight continuing in real time under the same combat flow

That shared-map, dual-role structure is one of the main design pillars of the project.

---

## Current Engine State

The core tactical engine is functional.

At this moment, Ars Caelorum is not just a rendering or LOS demo. The build already includes:

- map and terrain rendering
- sprite-based unit rendering
- 3x3 mech occupancy
- 1x1 pilot occupancy
- movement and facing flow
- initiative and phase order
- target validation
- to-hit resolution
- damage resolution
- combat text feedback
- a dev layer and map editing layer, though both still need cleanup to match the new engine truth

The current short-term focus is not "make combat exist."
Combat exists.

The current short-term focus is:

1. align dev/editor/camera with the current unit and scale architecture
2. add base ability support
3. establish structure authority and pilot-only interior interaction

---

## Core Systems Already Working

### Movement

Implemented:

- tile-based movement
- preview pathing
- confirm move
- facing lock after movement
- elevation-aware movement cost
- occupancy-aware validation
- footprint-aware traversal

Movement is already using the current footprint and occupancy direction, not old 1x1-only assumptions.

### Facing

Implemented:

- 4-direction facing
- facing preview
- facing confirmation after move

Current design rule:

- facing affects **damage direction**
- facing does **not** affect hit chance

This keeps positioning important without overcomplicating target validation.

### Occupancy / Scale Foundation

Implemented:

- pilot footprint = 1x1
- mech footprint = 3x3
- center-point helpers
- occupied-cell generation
- occupancy map checks
- footprint-aware blocking and movement

This is one of the most important completed layers because it gives the engine a stable truth model for future systems.

### Initiative / Turn Flow

Implemented:

- setup state
- combat start
- round loop
- move phase
- action phase
- initiative reroll each round
- disabled units skipped in order flow

Current order design:

- Move Phase: resolved from move order
- Action Phase: resolved from action order

### Target Validation

Implemented:

- fire arc evaluation
- range validation
- line-of-sight validation
- missile targeting with area logic
- valid target tile generation
- effect tile preview

Current separation is important:

- validation decides whether a target is legal
- hit resolution decides whether the attack lands
- damage resolution decides what the hit does

### Line of Sight

Implemented:

- deterministic line-of-sight checks
- cover evaluation
- visibility result passed into targeting and hit logic
- debug rendering support

LOS is treated as validation truth, not as a vague visual suggestion.

### To-Hit Resolution

Implemented:

- 2d6 roll
- target number calculation
- range modifiers
- cover modifiers
- height modifiers
- targeting / reaction influence
- brace modifiers
- hit / miss result logging

### Damage Resolution

Implemented:

- shield then core flow
- side-hit bonus
- rear-hit shield bypass
- brace damage reduction
- missile splash falloff
- status transitions

### Unit Rendering

Implemented:

- terrain remains geometry-driven for now
- units render as sprites
- unit render anchor is separate from gameplay truth
- debug height pole exists for pilot / mech height sanity

This is the correct current direction:

- terrain can stay geometric during the engine phase
- units move toward final sprite presentation

---

## What Is Built But Not Finished

These systems exist, but still need cleanup or completion.

### Dev Menu

The dev menu works, but it is behind the current engine state.

Problems:

- still leans on old mech-first assumptions
- needs to be aligned to unit-first runtime truth
- needs better support for pilots, structures, and future mixed-unit workflows

### Map Editor

The editor exists, but it is not yet in its final useful form.

Current issue:

- it does not yet reflect the new unit/scale/camera direction cleanly enough for long-term map and structure authoring

### Top-Down / Tactical Editor View

A top-down view exists, but it is not yet the final desired tactical editing view.

What is still needed:

- square-grid tactical view
- same rotation language as the live board
- map-authoring clarity
- reliable structure and interior editing support

### Camera / Zoom

Camera framing exists, but mech-vs-pilot scale feeling still needs to be completed.

The intended direction is:

- mech = wider tactical zoom
- pilot = tighter personal zoom

Zoom will be tied to **effective move value**, not arbitrary art scale.

---

## Near-Term Roadmap

This section is intentionally more detailed because it covers the next real work.

## Phase 1 — Dev / Editor / Camera Alignment

This is the immediate next phase.

### Goals

- make the dev layer reflect current engine truth
- make map editing reliable again
- make camera scale feel correct between mechs and pilots

### Tasks

#### 1. Dev menu cleanup
- move dev tools fully to unit-first runtime handling
- stop leaning on old mech-only assumptions
- clean spawn / remove / select flow for both pilots and mechs
- prepare for future structure placement tools

#### 2. Replace current map-tab behavior
- stop treating the old sidebar as the long-term map editor
- make the map tab a real editing surface

#### 3. Build a square tactical editor view
- square cells, not iso diamonds
- same orientation language as current board rotation
- clicking editor cells maps back to real board coordinates
- show terrain, units, footprints, and facing clearly

#### 4. Camera scale pass
- center on true unit center
- pilot zoom uses effective move-based radius
- mech zoom uses effective move-based radius
- maintain dead-zone behavior where possible
- make pilot/mech transition feel meaningful

### Camera rule direction

Current intended rule:

- Pilot radius = move + floor(move / 2)
- Mech radius = move * 2

using **final effective move**, not base move

This allows:

- leveling to affect feel
- gear to affect feel
- movement penalties to affect feel
- mechs and pilots to feel fundamentally different even on the same map

---

## Phase 2 — Base Ability System V1

After dev/editor/camera alignment, the next major phase is abilities.

### Goals

- add ability data
- add ability menu flow
- plug abilities into the same clean resolution architecture as attacks

### Rules for this phase

Abilities must use the same disciplined flow as attacks:

**selection → validation → preview → confirm → resolve → feedback**

No special-case spaghetti.

### Recommended first-pass ability types

Start simple:

- self buff
- target debuff
- movement variant
- tile/area effect
- utility / support effect

Good first examples:

- brace-like defense buff
- short dash / jump
- temporary accuracy buff
- temporary defense break
- area denial tile effect

### Do not overbuild in V1

Avoid in first pass:

- huge combo trees
- deep proc chains
- nested sigil fusion logic
- broad status web
- AI ability behavior

Get one clean ability pipeline working end-to-end first.

---

## Phase 3 — Structure Authority V1

This is where the project starts to become clearly distinct.

Structures are not just decoration.

They are gameplay objects.

### Design goal

Allow missions where:

- mechs secure or contest exterior space
- pilots enter structures
- roofs hide or peel away for readability
- objectives inside structures can be completed while exterior combat continues

### Core rule

Do **not** make interiors a separate map.

Keep:

- one board
- one combat state
- one initiative/turn flow
- one continuous battlefield

### Structure model direction

Structures should become their own map-object authority with:

- footprint
- walls
- doors
- interior cells
- roof state
- movement rules
- LOS rules
- objective sockets

### Early structure rules

#### Mechs
- cannot enter interior cells
- treat building footprint and walls as blocked unless a future breach rule overrides it

#### Pilots
- can enter through valid structure access points
- can move through interior cells
- can interact with objective points inside

#### Roof
- roof visibility is render-only
- roof can hide when interior play matters
- roof visibility must never redefine gameplay truth

### First structure use cases

- safe/document retrieval
- terminal hack
- sabotage placement
- door unlock
- rescue / extraction
- shutdown objective

That layer is one of the clearest things that separates Ars Caelorum from a straight clone of existing mech tactics games.

---

## Phase 4 — Content Expansion

Once abilities and structures exist in stable form, content can widen.

### Content layer goals

- more mechs
- more pilots
- frame identities
- ability packages
- faction differences
- mission variants
- objective-driven scenarios

### This is also where the following become more meaningful

- progression
- gear
- move stat growth
- pilot specialization
- frame specialization

---

## Phase 5 — AI

AI should come after:

- movement truth
- targeting truth
- structures
- abilities

Otherwise AI will be rebuilt repeatedly.

AI phases should likely go:

1. basic move + attack behavior
2. priority targeting
3. objective awareness
4. pilot/mech role awareness
5. structure / extraction / mission logic

---

## Phase 6 — Save / Load / Scenario Authoring

Once systems stabilize, the toolchain should improve.

### Future goals

- save battle state
- load battle state
- authored scenario files
- map export/import
- objective definitions
- structure/objective authoring
- mission scripts

This should happen after structure and ability truth are stable.

---

## Phase 7 — Art / Presentation / Polish

This phase is intentionally later.

Why:

The engine must stay ahead of the art so presentation does not trap core design.

### Later polish goals

- final sprite sets
- additional facings
- unit animation
- VFX
- impact feedback
- improved UI
- structure roof visuals
- interior readability polish
- combat readability polish

---

## Long-Term Design Pillars

These should remain true as the project grows.

### 1. Shared Map Truth
Mechs, pilots, terrain, structures, and objectives all exist on the same battlefield.

### 2. Occupancy Is Authority
Render does not define gameplay truth.

### 3. Validation and Resolution Stay Separate
Do not collapse targeting, hit chance, and damage into one messy system.

### 4. Scale Difference Must Feel Real
Pilot and mech play should feel different, not just look different.

### 5. Structures Must Matter
Structures are not decoration. They are tactical spaces and objective carriers.

### 6. Systems First, Art Second
Art should reinforce the engine, not dictate it prematurely.

---

## Current Status Summary

### What is already strong
- tactical core
- movement
- occupancy
- combat loop
- targeting
- hit
- damage
- phase order
- sprite direction
- dual-scale foundation

### What needs to happen next
- dev/editor/camera alignment
- base abilities
- structure authority
- pilot interior play

### What completes the engine
For the engine to feel "complete" as a full tactics engine, the project still needs:

- accurate dev/editor tools
- finalized camera scale behavior
- abilities
- structures
- mission/objective support
- AI
- scenario/save tooling
- final polish

---

## Final Project Read

Ars Caelorum is already past the prototype stage.

It has a working tactical core.

The next work is not about proving the engine can exist.
The next work is about aligning tools, adding gameplay layers, and completing the systems that give it its own identity.

That identity is not just:

- mechs
- LOS
- elevation
- weapons

It is:

**shared-map mech and pilot tactics with structure-based mission play under one continuous combat state.**

That is the direction to preserve.
