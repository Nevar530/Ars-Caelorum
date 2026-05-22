ARS CAELORUM — REPO README
VERSION: 1.0 TXT
DATE: 2026-05-22
STATUS: COMPLETE UGLY GAME FOUNDATION / CONTENT PRODUCTION NEXT

============================================================
PROJECT
============================================================

Ars Caelorum is an in-browser fixed-isometric tactics RPG built with HTML, CSS, JavaScript, JSON data, and SVG rendering.

Live build:
https://nevar530.github.io/Ars-Caelorum/

Current state:
Ars Caelorum is a complete ugly game framework / graybox campaign build.

It has a working start-to-mission-to-result-to-reward-to-next-mission loop.
It is not content-complete, balanced, polished, or art-complete.

The project is now ready to move from foundation coding into production content:
- missions
- dialogue
- story
- cutscenes
- items
- inventory usefulness
- ability tables
- weapons
- balance
- art
- sound
- UI polish

============================================================
HOW TO RUN LOCALLY
============================================================

Use a local web server.

From the repo root:

python -m http.server 8000

Then open:

http://localhost:8000/

Do not rely on opening index.html directly from the file system.
Browser module/CORS behavior may block loading.

============================================================
CORE PROJECT RULES
============================================================

Code is truth.
Builder writes truth.
Engine runs truth.
Export packages truth.
Validation protects truth.

Do not patch from memory.
Always inspect the latest repo ZIP/current working tree first.

Anything needed for mission/map production must be authorable in the Mission Builder, exported by the builder, and validated by the builder.

Only raw assets/data live outside builder authoring:
- art
- pilots
- Telum/mechs
- weapons
- gear
- items
- abilities
- terrain/art catalogs

After raw data/assets are added, they should flow into builder controls where relevant.

No map magic.
No hidden mission-specific runtime branches.
No hand-authored-only JSON production behavior.

============================================================
CURRENT FOUNDATION FEATURES
============================================================

Runtime:
- title/start flow
- mission loading
- mission briefing
- phase briefing
- mission result flow
- campaignFlow
- campaign state
- save/load foundation

Mission system:
- missions are primary runtime packages
- maps are phases inside missions
- combat maps
- story/exploration maps
- objectives
- triggers
- logic chains
- dialogue
- rewards

Builder:
- fullscreen Mission Builder
- mission package drafting
- map phase authoring
- terrain authoring
- structures authoring
- rooms / edges / props
- spawns
- deployments
- active roster
- objectives
- triggers
- logic
- dialogue
- results
- rewards
- validation
- export/test

Campaign/progression:
- campaign state persistence
- milestone progression
- stat point spending
- level-unlocked learned abilities
- gear/weapon-granted abilities
- pilot/Telum loadout carry
- ship storage
- credits
- owned Telum roster

Combat/story:
- Combat Mode with rounds/initiative/move/action phases
- Story Mode with free movement and interactions
- pilot/Telum shared battlefield
- enter/exit Telum
- item use from assigned slots
- consumed items persist as consumed

Screens/UI:
- normal I menu for review/status/system use
- contextual screens opened by authored interactions
- Pilot Loadout
- Telum Loadout
- Shop
- Mission Board
- Medbay reserved

Rendering:
- fixed authored 2:1 isometric view
- top-down tactical blueprint view
- SVG scene renderer
- room/roof/cutaway support
- footprint props
- unit/Telum rendering
- overlays/LOS overlay

============================================================
REPO SHAPE
============================================================

Root:
- index.html
- script.js
- style.css
- README.md / README.txt

Core source:
- src/

Rendering:
- src/render.js
- src/render/

Campaign:
- src/campaign/

Builder:
- src/builder/

UI:
- src/ui/

Actions/items:
- src/actions/

Data:
- data/
- data/missions/
- data/maps/
- data/pilots.json
- data/mechs.json
- data/weapons.json
- data/pilot_gear.json
- data/mech_gear.json
- data/pilot_items.json
- data/mech_items.json
- data/abilities.json

Art:
- art/menu/
- art/pilot/
- art/mech/
- art/tiles/
- art/structures/
- art/props/

============================================================
CURRENT CATALOGS
============================================================

Visible missions:
- 000_game_state_tester_mission
- new_map_mission / Structure Render Test Map
- 014_wayfarer_hub / Wayfarer Hub - Bridge Shell

Map catalog includes:
- 008_mars_cold_open
- 009_earth_hospital
- 010_hospital_garage_escape
- 011_gabe_office
- 012_gabriel_mech_bay
- 013_practice_sparring
- 014_wayfarer_hub
- new_map

Starting owned Telum:
- telum_skye / Skye's Telum
- telum_eve / Eve's Telum

Known spelling note:
- display/story language should use Gabrielle Enforcement Agency
- current map/file id uses 012_gabriel_mech_bay
- do not casually rename it; renaming needs a careful dedicated pass across maps, catalogs, mission refs, exports, and saved refs

============================================================
CURRENT OPENING FLOW
============================================================

The opening structure is:

008 Mars Cold Open - Aether Core Leak
-> 009 Earth Hospital - Two Weeks Later
-> 010 Underground Parking Garage Escape
-> 011 Gabrielle Enforcement Agency - Gabe Meeting
-> 012 Gabrielle Mech Bay - Mount Up
-> 013 Practice Sparring

Intended rhythm:

combat
-> story
-> combat
-> story
-> story/mount-up
-> combat

============================================================
PILOTS AND TELUM
============================================================

Pilots are characters.
Telum are vehicles/platforms/bodies.

Do not treat Telum as characters.
Do not give Telum character-style progression.

Pilots own:
- identity
- level
- stat growth
- learned abilities
- natural role progression

Telum own:
- platform/body
- mounted state
- footprint
- equipment
- Telum AP
- equipment-granted abilities

============================================================
LOADOUT / STORAGE RULES
============================================================

Ship Storage is persistent party inventory truth.

Pilot item slots:
- item1 through item5

Telum item slots:
- item1 through item10

Loadouts assign from ship storage.
Assigned/equipped items are locked from shop selling.
Used consumables clear their assigned slot and decrement storage.
Item slots must not collapse or shift after item use.

Gear swapping is only allowed in safe contextual spaces:
- Wayfarer
- lockers
- shops
- Telum bay terminals
- authored prep contexts

No mid-mission gear swapping.

============================================================
ABILITY / LEVELING RULES
============================================================

Abilities are mostly gained by character level.

Campaign state stores learned abilities.
Level-up sync adds newly unlocked abilities to campaign truth.

Gear/accessories/weapons may grant temporary abilities while equipped.
Remove the equipment, remove the granted ability.

Pilot AP and Telum AP are separate.
On foot uses pilot AP.
In Telum uses Telum AP.

Next design work:
- define each pilot's level table in pilots.json
- list ability unlocks by level
- define role identity for each character
- expand ability catalog only as needed for real missions

============================================================
FIXED ISO RULES
============================================================

The game is fixed authored iso.

No player-facing map rotation.
No map turning.
No four-direction environment art requirement.

Top-down remains tactical blueprint view.

Unit facing and directional unit art remain.

============================================================
CURRENT DEVELOPMENT SNAPSHOT
============================================================

Latest audited ZIP state:
- 109 JavaScript files syntax clean
- 28 JSON files parse clean

The foundation is stable enough to begin production content.

============================================================
NEXT WORK
============================================================

Take a short break before the production load.

Then begin:

PHASE 14 — Opening Content Production

1. Mars Cold Open
2. Earth Hospital
3. Garage Escape
4. Gabe Office
5. Mech Bay Mount-Up
6. Practice Sparring

Goal:
A playable first 30 minutes that proves Ars Caelorum's identity.

============================================================
NON-GOALS RIGHT NOW
============================================================

Do not build yet:
- full shop economy bloat
- salvage/crafting/rarity treadmill
- giant ability tree
- class/job system
- full world map
- visual node graph
- one-off driving system
- destructive wall system
- automated building generator
- map rotation
- true 3D
- true multi-floor simulation
- massive AI rewrite before real missions demand it

============================================================
FINAL NOTE
============================================================

The project has reached potato.

The next phase is shepherd's pie.

END FILE
