# Roadmap: Puck & Static Computer Players

This roadmap translates the updated `design_doc.md` goals into actionable milestones so we can introduce a puck object and background computer skaters without destabilizing the existing navigation experience.

## Guiding Principles
- Keep the current keyboard navigation + hotspot UX fully functional at every checkpoint.
- Lean on JSON configs for any new entity (puck, NPCs) so designers can tweak values without JS changes.
- Prefer incremental rendering/physics hooks over a one-off rewrite—the current `game` runtime should simply learn new tricks.

## Phase 0 – Foundation Hardening (Current Sprint)
1. **Inventory Assets & Code**: Confirm available puck sprites and catalog all NPC sprite variants we can re-use from `assets/nhlpa93_94_sprites`.
2. **Refactor Helpers**: Extract any player-specific helpers in `main.js` (e.g., clamp/physics utilities) into reusable functions so future entities can share them.
3. **Document Expectations**: Finish updating `design_doc.md` (done) and ensure README references remain accurate once new controls or HUD copy ship.

_Exit Criteria_: We have clarity on art + helper structure, and no code paths assume "only one entity" anymore.

## Phase 1 – Data & Asset Plumbing
1. **Create Configs**: Add `assets/config/puck.json` and `assets/config/npcs.json` per the schemas outlined in the design doc.
2. **Loader Updates**: Extend `bootstrap()` to fetch/validate the new configs alongside sprites/hotspots.
3. **Sprite Variant Mapping**: Ensure NPC entries can reference existing sprite variants (including `ana`, `nyr`, etc.); add logging if variants are missing so debugging stays friendly.

_Exit Criteria_: Runtime has parsed puck + NPC data and exposes them on `window.__NHL93_CONFIG__` for quick inspection.

## Phase 2 – Puck Runtime
1. **Runtime Object**: Create `game.puck` with state machine (`free`, `possessed`, `shooting`) and integrate friction/velocity updates each frame.
2. **Collision / Possession**: Detect overlap between the skater and the puck; when possessed, lock the puck to a stick offset relative to the player's facing direction. Release possession when the player exits the rink bounds or triggers a shot.
3. **Rendering + HUD**: Draw the puck beneath the player sprite, and add HUD/status text (plus ARIA live messaging) that explains whether the player currently has the puck.
4. **Hotspot Hooks**: Decide initial MVP behavior (e.g., puck required to trigger contact hotspot) and gate Enter actions accordingly.

_Exit Criteria_: The puck visibly spawns, can be acquired/dropped, and the HUD reflects its state without breaking navigation.

## Phase 3 – Static Computer Players
1. **Instantiation**: Spawn NPCs from `npcs.json`, reusing the SpriteSheet animation data so they can idle or loop short animations.
2. **Collision Bounds**: Add simple circular/rectangular hitboxes that prevent the human skater (and puck) from clipping through NPCs.
3. **Rendering Order**: Sort drawables by their `y` coordinate before drawing so foreground/background layering feels authentic.
4. **Optional Interactions**: Display subtle HUD hints when the player is near an NPC (even if they are non-interactive) to signal future expansion potential.

_Exit Criteria_: Benches/crease feel populated, collisions behave sanely, and the visual stack still hits 60 FPS.

## Phase 4 – Polish & QA
1. **UX Polish**: Iterate on puck/NPC accessibility copy, ensure the instructions overlay calls out the new mechanic, and add any necessary settings to the customization panel (e.g., pick a puck skin).
2. **Performance & Stability**: Profile the render loop after adding new drawables; optimize sprite loading or animation updates if frame times regress.
3. **Regression Pass**: Manually verify hotspots, fallback navigation, and sprite selection still behave as before. Document new test cases in README or a lightweight QA checklist.
4. **Future Hooks**: Capture follow-up ideas (AI patrol routes, puck-based minigames) so the next roadmap iteration has a head start.

_Exit Criteria_: Feature-complete puck + NPC experience with clear documentation and no regressions in the original MVP behaviors.

## Validation Checklist
- [ ] JSON configs validated in the console (or via a lint script) before deployment.
- [ ] Keyboard navigation + Enter-to-navigate works both with/without puck possession.
- [ ] Instructions overlay, HUD, and fallback text mention the new mechanics.
- [ ] NPC collisions feel fair and do not trap the player against the boards.
- [ ] No new asset requests block GitHub Pages (all files live under `/assets`).
