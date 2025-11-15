# Implementation Roadmap: NHL '93 Personal Site

## Guiding Goals
- Deliver a GitHub Pages experience that mimics NHL '93 skating while remaining accessible and keyboard-friendly.
- Keep hotspots, layout, and JSON-driven navigation decoupled from rendering so content can evolve independently.
- Ship an MVP without audio, then expand toward richer interactions (AI skaters, puck mini-goals, etc.).

## Phase 0 – Project Scaffolding & Asset Intake
1. **Repo hygiene**: Confirm GitHub Pages deployment target (root vs `docs/`); wire up basic `index.html`, shared CSS, and JS entry point.
2. **Asset audit**: Catalog sprites and rink map under `assets/`; document filenames, frame dimensions, orientation (8-direction?), and hotspot coordinates tied to `assets/rink_map_template.png`.
3. **Config authoring**: Create real `assets/config/sprites.json` and `assets/config/hotspots.json` that follow the design doc schemas so runtime code can stay data-driven.
4. **Build tooling**: Lock in pure vanilla ES modules loaded via `<script type="module">` (no bundlers or frameworks) and add lightweight npm scripts for linting/formatting plus a static file server command for local testing.
5. **Success criteria**: Static page renders header + placeholder canvas; asset paths resolve without 404s; config JSON files validate against their schema.

## Phase 1 – Layout & Accessibility Scaffolding
1. **Header & nav**: Implement fixed global header with `Home`, `About`, `Projects`, `Contact` plus skip link.
2. **Canvas container**: Reserve full-width rink section with retro-styled instructions above it and fallback text links below.
3. **Fallback behavior**: Ensure canvas renders even when keyboard input is unavailable; prompts should guide users to static link list.
4. **Placeholder pages**: Create minimal `about.html`, `projects.html`, `contact.html` sharing header and CSS.
5. **Success criteria**: Manual keyboard-only walkthroughs and quick screen reader spot checks confirm baseline accessibility; navigation functions with mouse & keyboard.

## Phase 2 – Rendering Engine & Asset Loading
1. **Game loop**: Implement `requestAnimationFrame` loop with fixed timestep update + render split for deterministic physics.
2. **Sprite management**: Build loader for rink background, skater spritesheets, and JSON metadata; add loading overlay/state machine.
3. **Camera system**: Track skater position with viewport exposing only a slice of the rink while clamping at rink bounds to avoid jitter.
4. **Scaling strategy**: Render at native pixel resolution, apply integer CSS scaling, and verify crispness on retina displays.
5. **Success criteria**: Canvas shows rink background with centered idle skater that stays sharp at various DPRs.

## Phase 3 – Physics, Controls & Animation
1. **Input handling**: Capture `keydown`/`keyup` for arrows, `Enter`, and `Esc`; prevent default scrolling when canvas focused; manage focus prompts.
2. **Movement model**: Implement acceleration, friction, and max speed tuned to https://youtu.be/O0xemrRYMQw?t=16 footage; iterate with manual playtesting until it feels right.
3. **Turning inertia**: Introduce angular velocity constraints so skater arcs through turns rather than snapping.
4. **State machine & animation**: Map velocity vector to animation states (idle, skating, turning, coasting) and swap sprite frames accordingly.
5. **Success criteria**: Player feels responsive and closely mirrors NHL '93 motion across key scenarios (starting, stopping, turning, coasting).

## Phase 4 – Hotspots, HUD & Navigation
1. **Hotspot config**: Define JSON describing penalty box (`About`), bench (`Projects`), goal crease (`Contact`) coordinates + URLs.
2. **Collision detection**: Implement rectangular overlap checks in world coordinates; support hotspots outside current viewport.
3. **HUD indicators**: Fade in text labels (styled via `labelStyle` metadata) and optional directional cues while skating toward a hotspot—no additional PNG icons beyond the rink art.
4. **Navigation binding**: Trigger `window.location.href` changes on `Enter` while within hotspot; ensure focus/ARIA messaging communicates the transition.
5. **Success criteria**: All three hotspots reachable via skating; cues guide users even when hotspot starts off screen; navigation transitions smoothly.

## Phase 5 – Progressive Enhancement & Accessibility Polish
1. **Announcements**: Provide ARIA live region for instructions/results (e.g., "Skate to the bench for Projects").
2. **Tab management**: Use `tabindex` and focus traps so keyboard users can enter/exit the rink interaction predictably (`Esc` relinquishes control).
3. **Non-JS fallback**: Serve static rink image plus link list when scripts fail; confirm skip link bypasses canvas.
4. **Mobile behavior**: Detect touch-only devices and offer read-only rink view with CTA to fallback navigation.
5. **Success criteria**: Screen reader smoke tests pass; keyboard-only users can navigate without traps; mobile shows graceful fallback.

## Phase 6 – Testing, Performance & Polish
1. **Cross-browser QA**: Test Chrome, Firefox, Safari for frame pacing, input handling, and canvas rendering fidelity.
2. **Performance tuning**: Profile update/render loop; ensure stable 60 FPS on target laptops. Optimize sprite atlases if drops occur.
3. **Content tweaks**: Refine instructions, HUD styling, and retro fonts; ensure color contrast meets WCAG.
4. **Deployment**: Configure GitHub Pages, set custom domain (if any), and add checklist for future asset updates.
5. **Success criteria**: Automated checks + manual QA complete; site deployed publicly with documented release notes.

## Phase 7 – Post-MVP Enhancements (Backlog)
1. **Audio system**: Layer in AudioContext loader, ambient crowd loop, skate SFX tied to speed, confirmation chime, and header mute toggle.
2. **Atmosphere**: Optional AI skaters, puck pickup mini-goals, scoreboard overlay tracking progress.
3. **Gamepad support**: Investigate Gamepad API mapping to replicate Genesis controller feel.
4. **Analytics & telemetry**: Measure which hotspots/users interact with to guide future content.

## Dependencies & Open Items
- Decide on asset optimization pipeline (e.g., automated spritesheet packing vs. manual curation) once MVP needs exceed current `assets/` contents.

## Verification Checklist by Phase
- [ ] Static layout & fallback nav rendered
- [ ] Canvas + asset loader running with idle skater
- [ ] Physics tuned against gameplay footage
- [ ] Hotspot HUD & navigation wired up
- [ ] Accessibility polish + fallback confirmed
- [ ] Cross-browser QA complete
- [ ] Audio & stretch features (post-MVP)
