# PROGRESS

## Phase 0 – Foundation Hardening
### Completed
- **Asset Survey**: Confirmed puck artwork lives at `assets/general_puck.png` (111×79 RGBA). NPC-ready sprite variants already live under `assets/sprites/` (ANA, NYR, BOS, etc.) sourced from `assets/nhlpa93_94_sprites/players/*.gif`, so every team jersey we need for bench/crease skaters already has a pre-converted PNG counterpart (see list below).
- **Runtime Prep**: Refactored `main.js` so the simulation manages a `game.skaters` collection plus reusable helpers (`createSkater`, `updateSkaterPhysics`, `renderSkater`, etc.). Nothing in the loop assumes "single actor" anymore, which clears the path for puck + NPC injection without rewrites.
- **Docs**: Puck schema in `design_doc.md` now references the real PNG asset, keeping planning artifacts aligned with the art drop.

### Sprite Variants Ready for NPCs
`assets/sprites/` currently exposes these PNGs (one-per team/variant):
`ana, ana2, bhgs, bhgs2, bhgs3, bos, bos2, buf, buf2, cal, cal2, chi, chi2, dal, dal2, det, det2, edm, edm2, fla, fla2, har, har2, la, la2, la3, mon, mtl2, nj, nj2, nyi, nyi2, nyr, nyr2, ott, ott2, phi, phi2, pit, pit2, que, que2, sj, sj2, skater, skater_ana2, skater_nyr, skater_nyr2, stl, stl2, stl3, tb, tb2, tor, tor2, van, van2, van3, was, was2, wpg, wpg2`

### Next Up (Phase 1 Preview)
- Add `assets/config/puck.json` + `assets/config/npcs.json` files using the schemas from the design doc.
- Teach `bootstrap()` to load/validate the new configs so runtime state includes puck/NPC definitions and exposes them under `window.__NHL93_CONFIG__`.
- Wire friendly logging/guards if a referenced sprite variant is missing, keeping tweaker UX predictable.

## Phase 1 – Data & Asset Plumbing
### Completed
- **Config Files**: Authored `assets/config/puck.json` (points at `assets/general_puck.png`, defines spawn, radius, and physics) and `assets/config/npcs.json` (three seed NPCs with bench + goalie placements). These track the schemas laid out in the design doc so later phases can consume them directly.
- **Bootstrap Loading**: `main.js` now fetches the puck + NPC configs alongside sprites/hotspots, storing them on `game.puckConfig` / `game.npcConfig` and exposing everything via `window.__NHL93_CONFIG__` for quick inspection.
- **Validation Guardrail**: Added a `reportMissingNpcVariants` helper that logs any NPC entries referencing absent sprite variants, giving instant feedback if authors mistype an ID.

### Next Up (Phase 2 Preview)
- Instantiate a `game.puck` object that uses the newly loaded config for sprite/physics values, then wire it into the update/render loops.
- Use the puck state to gate hotspot activations (e.g., require possession) and surface HUD / ARIA messages when pickup/drop events occur.
- Begin scaffolding NPC instantiation so static players can start showing up in Phase 3 without additional loader work.

## Phase 2 – Runtime Puck
### Completed
- **Puck Runtime**: Added `createPuck`, `updatePuck`, and `renderPuck` helpers so the puck spawns from `assets/config/puck.json`, glides with its own physics, snaps to the player when collected, and draws beneath the skater layer. The puck’s sprite is now loaded alongside other assets during bootstrap and stored on `game.puck`.
- **Interaction Gating**: Hotspots only activate when the puck is possessed. Players must tap <kbd>Space</kbd> to pick up or drop the puck; attempting to press `Enter` without possession triggers an ARIA live message (`.canvas-status`), and the HUD action text flips between “Press Enter to open” and “Grab the puck to activate.”
- **Shoot Action**: Added a dedicated <kbd>P</kbd> input so once the puck is captured the user can fire it in their current skating direction. Shots launch with a faster impulse than standard drops and emit their own status message.
- **Accessibility/HUD Copy**: Instructions, README, and HUD messaging now mention the puck requirement so users know to pick it up before navigating. The status overlay also announces when the puck is collected, and the HUD beacons persist while showing the new action hint.

### Next Up (Phase 3 Preview)
- Instantiate NPC skaters from `assets/config/npcs.json`, ensuring each entry reuses the existing sprite variants and clamps to the rink.
- Render NPCs alongside the player (with painter’s-order sorting already in place) and block the player/puck from clipping through their hitboxes.
- Add subtle HUD cues or labels for NPC proximity to prepare for future interactions.
