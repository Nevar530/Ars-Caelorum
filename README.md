# Ars Caelorum

Live Build:
https://nevar530.github.io/Ars-Caelorum/

Ars Caelorum is an in-browser fixed-isometric tactics RPG / tactics-engine project built with HTML, CSS, JavaScript, JSON data, and SVG rendering.

The project is built around readable tactical board truth:

- mission-first runtime
- maps as mission phases
- combat and story/exploration maps
- pilots and Telum sharing one battlefield
- Telum as vehicles/platforms, not characters
- builder-authored mission/map truth
- validation before test/export
- fixed authored 2:1 isometric presentation
- top-down tactical blueprint view

The current build is still in the fun-but-ugly phase.
Art, polish, animation, final balance, and production content are not the point yet.
The point is a stable playable foundation.

============================================================
CURRENT PROJECT STATE
============================================================

Current foundation status:
- real title/menu shell
- mission catalog loading
- map catalog loading
- mission briefing
- phase briefing
- mission-first runtime
- maps as phases inside missions
- combat maps
- story/exploration maps
- objectives
- triggers
- logic chains
- dialogue
- mission results
- campaign state foundation
- campaignFlow foundation
- milestone progression
- enemy scaling foundation
- pilot/Telum separation
- enter/exit Telum behavior
- fixed-isometric rendering
- top-down tactical blueprint view
- fullscreen Mission Builder
- builder validation
- builder export/test path
- contextual interaction screens
- Pilot Loadout shell
- Telum Loadout shell
- map-authored Shop shell
- Mission Board shell
- reserved Medbay context
- Wayfarer Hub shell

Recent audit snapshot:
- 109 JS files checked clean with node --check
- 27 JSON files parsed clean

Current main incomplete loop:
Wayfarer Hub -> Mission Board -> selected mission -> results -> campaignFlow returns to hub

The Mission Board exists as a contextual screen, but it still needs the launch flow that actually starts authored missions through the existing mission loading path.

============================================================
HOW TO RUN
============================================================

This is a static browser project.
There is no build step required.

Recommended local run:

```bash
python -m http.server 8000
```

Then open:

```txt
http://localhost:8000/
```

Do not open index.html directly from the file system if browser module/CORS behavior causes loading issues.
Use a local server.

============================================================
REPO SHAPE
============================================================

Key root files:

```txt
index.html
script.js
style.css
README.md
```

Core source:

```txt
src/
```

Data:

```txt
data/
  missions/
  maps/
  terrain/
  pilots.json
  mechs.json
  weapons.json
  pilot_gear.json
  mech_gear.json
```

Art:

```txt
art/
  menu/
  pilot/
  mech/
  tiles/
  structures/
  props/
```

Mission Builder:

```txt
src/builder/
```

Rendering:

```txt
src/render/
src/render.js
```

Campaign systems:

```txt
src/campaign/
```

UI:

```txt
src/ui/
```

============================================================
CORE RUNTIME FLOW
============================================================

Current intended runtime flow:

```txt
TITLE
-> MISSION SELECT / CONTINUE
-> MISSION BRIEFING
-> MAP / PHASE BRIEFING
-> STORY OR COMBAT MAP
-> OBJECTIVES / TRIGGERS / DIALOGUE
-> NEXT MAP PHASE OR MISSION RESULT
-> CAMPAIGN FLOW / HUB / MISSION SELECT
```

The hub is not a fake menu.
The hub should be a real story-mode mission/map.

Current hub:

```txt
014_wayfarer_hub
```

Current hub interaction direction:

```txt
locker -> pilot_loadout
mech bay terminal -> telum_loadout
shop terminal -> shop
Pax -> shop
mission board terminal -> mission_board
Theo -> dialogue
```

============================================================
MISSION BUILDER FLOW
============================================================

The Mission Builder exists to author runtime truth.
It should not create fake builder-only behavior.

Current builder flow:

```txt
MISSION BUILDER
-> MISSION PACKAGE DRAFT
-> MAP PHASES
-> MAP MODE / PHASE BRIEFING
-> STARTS / DEPLOYMENTS
-> OBJECTIVES / TRIGGERS / LOGIC / DIALOGUE
-> CONTEXTUAL SCREEN TRIGGERS
-> VALIDATE
-> TEST MISSION
-> EXPORT PACKAGE
-> REAL RUNTIME LOADER
```

Current major builder tabs:

```txt
Mission
Map
Terrain
Structures
Spawns
Units
Objectives
Triggers
Logic
Dialogue
Results
Validate
Export
```

Structures has sub-tabs:

```txt
Rooms
Edges
Props
```

Builder rules:
- Builder writes truth.
- Engine runs truth.
- Export packages truth.
- Validation protects truth.
- Anything needed for mission production must be authorable in the builder.
- No map magic.
- No hand-authored-only JSON behavior for production systems.

============================================================
COMBAT MODE
============================================================

Combat maps use:
- rounds
- initiative
- move phase
- action phase
- player turns
- CPU turns
- tactical HUD
- objectives
- combat targeting
- LOS
- movement rules

Pilots are the initiative actors.
Telum are controlled platforms/bodies.

============================================================
STORY / EXPLORATION MODE
============================================================

Story Mode is a map-level pacing mode, not a separate game.

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
- enter/exit Telum
- load next map

Story Mode uses the same mission package, map data, objectives, triggers, logic, dialogue, validation, and export paths as Combat Mode.

============================================================
FIXED ISOMETRIC RENDERING
============================================================

Ars Caelorum is now a fixed authored 2:1 isometric game.

Map turning / camera rotation is not part of the player-facing game.

This is intentional.
The game uses 2D art pretending to have depth, not true 3D.
Locked iso makes map art, structures, props, roofs, and authoring more stable.

Current rendering truth:
- fixed authored iso view
- top-down tactical blueprint view remains
- unit facing remains
- directional unit art remains
- environment art does not need four rotated versions
- renderer should be reviewed for old rotation-era assumptions

Near-term renderer work:
- inspect SVG group/layer ordering
- inspect terrain/face sorting
- inspect structures/roof/cutaway sorting
- inspect prop footprint rendering
- inspect unit/Telum sorting
- inspect overlays and LOS overlay layers
- inspect top-down tactical view
- remove stale rotation assumptions only where safe

Renderer review should not rewrite combat, LOS, movement, targeting, or mission flow.

============================================================
TOP-DOWN TACTICAL VIEW
============================================================

Top-down view is not a second art camera.
It is a tactical blueprint/data view.

Top-down should prioritize readability:
- terrain with tactical tint
- darker higher terrain
- rooms as readable footprint areas
- room labels
- walls as blueprint lines
- doors/windows as clear markers
- props as footprint rectangles
- units/cursor/overlays on top

Iso view is for authored scene readability.
Top-down is for tactical clarity.

============================================================
PILOTS AND TELUM
============================================================

Core rule:
Pilots are characters.
Telum are vehicles/platforms/bodies.

Do not treat Telum as characters.
Do not give Telum character-style ability progression.

Pilots own:
- identity
- progression
- stat points
- abilities
- role identity

Telum own:
- platform/body
- footprint
- mounted state
- equipment/platform slots
- shield/core body state

Current gear foundation:

Pilot gear:
- armor
- accessory
- primary weapon
- secondary weapon

Telum gear:
- plating
- system
- primary weapon
- secondary weapon
- support weapon

Gear swapping should only happen in safe contextual spaces:
- Wayfarer
- shop
- locker
- mech bay terminal
- other authored prep contexts

Gear swapping should not happen during active missions.

============================================================
CONTEXTUAL SCREENS
============================================================

Contextual screens are standalone interaction screens opened from map/unit/terminal triggers.
They are not normal I-menu tabs.

Current context screen IDs:

```txt
pilot_loadout
telum_loadout
shop
mission_board
medbay
```

Current status:
- pilot_loadout exists
- telum_loadout exists
- shop exists as shell with map-authored stock
- mission_board exists as shell, launch flow needed
- medbay reserved, not functional

Preferred UI style:
- compact terminal-like menus
- dense columns
- clean borders
- small text
- highlighted selected row
- keyboard-first nested selection
- no bubble/card web dashboard styling
- no oversized spacing

Normal I menu remains review/status/system oriented.
Context screens handle active prep interaction.

============================================================
MISSION BOARD NEXT WORK
============================================================

Mission Board is the next key hub-loop pass.

Goal:

```txt
Wayfarer Hub
-> prep screens
-> Mission Board
-> selected authored mission
-> results
-> campaignFlow return
-> Wayfarer Hub
```

Mission Board should:
- open from authored context triggers
- list available/unlocked missions
- use campaign state and mission catalog
- respect completed/unlocked state where available
- use existing mission loading/deployment flow
- not create a parallel mission loader
- not become a world map
- not become a node graph
- not become a normal I-menu tab
- stay compact and keyboard-first

Expected controls:
- Up/Down select mission
- Enter detail/confirm or launch
- Left backs out if detail exists
- I/Esc closes to map

============================================================
CURRENT STORY / CONTENT FLOW
============================================================

Current opening campaign grammar:

```txt
008 Mars Cold Open - Aether Core Leak
-> 009 Earth Hospital - Two Weeks Later
-> 010 Underground Parking Garage Escape
-> 011 Gabrielle Enforcement Agency - Gabe Meeting
-> 012 Gabrielle Mech Bay - Mount Up
-> 013 Practice Sparring
```

This proves the intended rhythm:

```txt
combat
-> story
-> combat
-> story
-> story/mount
-> combat
```

Current content is still graybox/testbed.
The foundation is the priority before final map art and polish.

============================================================
VALIDATION
============================================================

Validation protects the builder from broken runtime data.

Validation should cover:
- mission id/start map
- duplicate map ids
- map dimensions
- missing/invalid tiles
- spawn bounds
- deployment/start assignment errors
- player pilot presence
- enemy pilot presence only when required by objective
- deployment cell size/count
- mech deployment 3x3 fit
- structure edge/cell bounds
- duplicate structure edges
- prop bounds and footprint sanity
- objective data
- protect unit target references
- trigger data
- context screen IDs
- shop refs/stock
- logic chain data
- dialogue data
- campaignFlow mission references
- export/test blocking errors
- warnings for placeholder/default text and suspicious authoring choices

Warnings do not block.
Errors block Test Mission and Export.

============================================================
DEVELOPMENT RULES
============================================================

- Use the latest repo ZIP as code truth.
- Do not patch from memory.
- Do not assume prior generated ZIPs are current.
- If expected files/features are missing, check whether the latest ZIP was opened.
- Keep passes bounded but not absurdly tiny.
- Prefer changed-files ZIPs, not full repo ZIPs, unless explicitly requested.
- Include a short summary, test checklist, and known risks for code passes.
- Do not break stable combat/movement/LOS/targeting/mission flow while adding UI.
- Keep UI compact and keyboard-first.
- Simple before clever.

============================================================
CURRENT KNOWN ROUGHNESS
============================================================

- Mission Board launch flow is not complete.
- Renderer should be reviewed for locked fixed-iso SVG assumptions now that map turning is gone.
- Shop is a shell, not a full economy.
- Medbay is reserved only.
- Ability framework is not built.
- Real opening maps/content are mostly graybox.
- AI is functional but not objective-smart.
- Builder can still tighten typography and reduce static help.
- 012_gabriel_mech_bay spelling should not be casually renamed; it needs a careful dedicated pass.

============================================================
NEXT PRACTICAL PASSES
============================================================

1. Mission Board Launch Flow
2. Fixed-Iso SVG Renderer Review
3. Mission Board Builder/Validation Hardening if needed
4. Game Menu Missions Tab upgrade for status/intel
5. Shop shell usability pass
6. Active Roster data + builder tab
7. Ability framework
8. Real opening content authoring

============================================================
FINAL CURRENT VERDICT
============================================================

Ars Caelorum has a stable game foundation and can continue.

It is not finished.
It is not polished.
It is not content-complete.

But the foundation is real:
- mission-first runtime
- builder-authored maps/missions
- combat/story mode split
- campaign-state foundation
- fixed iso direction
- contextual interaction screens
- Wayfarer hub shell

The next major unlock is the Mission Board launch flow.
After that, the renderer should be reviewed so the fixed-iso SVG pipeline is clean, stable, and no longer carrying unnecessary map-rotation baggage.
