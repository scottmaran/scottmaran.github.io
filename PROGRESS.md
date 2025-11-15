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

## Next Up – Phase 1
1. Build the fixed header + skip link UX called for in the design doc (styling groundwork already exists, but we’ll wire up focus management and retro typography).
2. Flesh out the instruction overlay copy and ensure fallback link list is fully accessible (ARIA labels, heading hierarchy).
3. Stand up the placeholder `about.html`, `projects.html`, and `contact.html` content blocks so navigation has real targets (shell pages are live but still carry placeholder messaging).
4. Verify keyboard-only walkthroughs and a quick VoiceOver/NVDA spot check to satisfy the “manual accessibility” success criteria before entering Phase 2.

---

## Phase 1 – Layout & Accessibility Scaffolding ✅
- Added the retro NHL font to `styles.css` and applied it to the header brand + nav highlights; skip link, `aria-current` styling, and `kbd` tokens now match the design doc tone.
- Expanded `index.html` instructions with IDs/ARIA wiring, `tabindex="0"` on the canvas, and descriptive copy so keyboard users know how to focus the rink and fire hotspots.
- Hooked nav links up to `aria-current` server-side and in `main.js`, ensuring active-state focus works across GitHub Pages paths; placeholder pages share the same header/skip link treatment.
- Script now detects coarse pointer / touch-only devices to reveal the fallback message automatically, while still drawing the rink and exposing asset configs once they load.
- Manual checklist: Tab order confirmed (skip link → header → main → fallback list) and VoiceOver/Quick Nav reminders noted for a future live accessibility audit.

## Next Up – Phase 2
1. Stand up the requestAnimationFrame loop plus deterministic update/render pipeline with a placeholder player sprite anchored center ice.
2. Wire in the config loaders (already returning data) to create sprite/animation managers and ensure the rink background renders at native resolution with integer scaling.
3. Implement the camera scaffold that tracks the player position (even if movement is stubbed for now) while clamping inside the rink bounds.
4. Keep verifying lint/format + basic manual walkthroughs so each phase remains stable before layering on physics.

---

## Phase 2 – Rendering Engine & Asset Loading ✅
- Added a GIF-to-spritesheet build step (Python/Pillow) and now source skater art from `assets/sprites/skater.png`, keeping JSON metadata untouched while enabling deterministic frame sampling.
- Rebuilt `main.js` around a fixed-timestep `requestAnimationFrame` loop with accumulator protection, plus lightweight `SpriteSheet`, `player`, and `camera` helpers.
- The camera tracks the player’s world coordinates (native rink pixels), clamps to rink bounds, and renders only a 1024×576 slice to the canvas with pixel-perfect scaling.
- Sprite animation advances using the JSON-defined frame durations, and the rink plus placeholder skater render once assets + configs finish loading; `window.__NHL93_CONFIG__` still exposes raw config data for debugging.
- Toolchain check: `npm run lint` remains green after the refactor, confirming the new modules meet our vanilla-JS conventions.

## Next Up – Phase 3
1. Implement keyboard input plumbing to capture arrow keys/Esc/Enter without interfering with page scroll.
2. Flesh out the movement model (acceleration, friction, capped velocity) using the gameplay footage as tuning reference.
3. Layer on turning inertia + state transitions so animation states/directions line up with the physics vectors.
4. Begin prepping hotspot collision scaffolding so Phase 4 can focus on HUD + navigation rather than core physics.
