# Project Progress

## Phase 0 – Project Scaffolding & Asset Intake ✅
- Repo now contains baseline `index.html`, shared `styles.css`, and `main.js` with a `<canvas>` placeholder that loads rink art plus JSON configs.
- Added npm tooling (`npm run dev|lint|format`) built around vanilla ES modules and a simple `python3 -m http.server` dev server.
- Created `assets/config/sprites.json` and `assets/config/hotspots.json` following the schemas from `design_doc.md`; initial coordinates and sprite metadata are in place so runtime code can stay data-driven.
- Catalogued sprite and rink assets under `assets/`; kept heavyweight ROM-extracted sprite sheets outside lint/format passes for performance.
- Manual lint pass (`npm run lint`) succeeds, confirming the scaffolding is consistent and ready for further development.

### Notes
- Hotspot rectangles use first-pass coordinates derived from `assets/rink_map_template.png`; we can tune them once the camera and HUD rendering reveal the precise feel we want.
- Sprite metadata currently references `ANA.gif` frames uniformly for all directions; once we derive orientation-specific sheets we can extend the JSON without touching code.

## Phase 1 – Layout & Accessibility Scaffolding ✅
- Added the retro NHL font to `styles.css` and applied it to the header brand + nav highlights; skip link, `aria-current` styling, and `kbd` tokens now match the design doc tone.
- Expanded `index.html` instructions with IDs/ARIA wiring, `tabindex="0"` on the canvas, and descriptive copy so keyboard users know how to focus the rink and fire hotspots.
- Hooked nav links up to `aria-current` server-side and in `main.js`, ensuring active-state focus works across GitHub Pages paths; placeholder pages share the same header/skip link treatment.
- Script now detects coarse pointer / touch-only devices to reveal the fallback message automatically, while still drawing the rink and exposing asset configs once they load.
- Manual checklist: Tab order confirmed (skip link → header → main → fallback list) and VoiceOver/Quick Nav reminders noted for a future live accessibility audit.
## Phase 2 – Rendering Engine & Asset Loading ✅
- Added a GIF-to-spritesheet build step (Python/Pillow) and now source skater art from `assets/sprites/skater.png`, keeping JSON metadata untouched while enabling deterministic frame sampling.
- Rebuilt `main.js` around a fixed-timestep `requestAnimationFrame` loop with accumulator protection, plus lightweight `SpriteSheet`, `player`, and `camera` helpers.
- The camera tracks the player’s world coordinates (native rink pixels), clamps to rink bounds, and renders only a 1024×576 slice to the canvas with pixel-perfect scaling.
- Sprite animation advances using the JSON-defined frame durations, and the rink plus placeholder skater render once assets + configs finish loading; `window.__NHL93_CONFIG__` still exposes raw config data for debugging.
- Toolchain check: `npm run lint` remains green after the refactor, confirming the new modules meet our vanilla-JS conventions.

## Phase 3 – Physics, Controls & Animation ✅
- Rewrote `main.js` with generous inline commentary, a dedicated input subsystem (canvas focus toggles, arrow/WASD, Enter/Esc handling), and normalized direction vectors.
- Added acceleration, friction, turning inertia, and fixed-top-speed constraints expressed in rink pixels/second so the skater eases into movement like the reference footage.
- State machine + animation wiring now respond to physics (idle/skating/turning/coasting) and quantized headings so sprite frames roughly match the current trajectory.
- Camera still follows the player, but we now clamp the skater to rink bounds and detect which hotspot rectangle the player occupies—Phase 4 can hook into this for HUD/navigation prompts.
- Manual sniff test: keyboard focus stays trapped on the canvas while engaged, Esc releases control, and `npm run lint` remains clean after the large rewrite.

## Phase 4 – Hotspots, HUD & Navigation ✅
- Layered a canvas HUD: active hotspot gets an on-rink dashed outline plus a textual prompt, while off-screen goals show directional beacons with color-coded dots.
- `main.js` now computes directional deltas to each hotspot, uses `Enter` to trigger navigation (with a status announcement for assistive tech), and keeps prompts synced with control focus.
- Added a dedicated `.hud` subtree in `index.html`/`styles.css` for the overlay, ensuring it remains pointer-agnostic and accessible via ARIA live regions.
- Enter actions respect the active hotspot bounds, preventing accidental navigation while still letting the instructions fallback handle touch users.
- Confirmed lint passes and manual QA shows the player constrained to the boards with visual cues guiding the next destination.

## Next Up – Phase 5
1. Introduce ARIA live messaging for hotspot entry/exit plus better announcements for control changes.
2. Flesh out non-JS fallback (static rink image) and skip-link behavior for accessibility audits.
3. Add mobile/touch detection to disable controls gracefully and ensure fallback navigation is obvious.
4. Begin drafting accessibility test notes ahead of the Phase 6 QA push.
