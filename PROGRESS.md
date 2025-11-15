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
