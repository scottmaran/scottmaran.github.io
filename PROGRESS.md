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
