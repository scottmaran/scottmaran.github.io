# NHL '93 Personal Site

## Using the Site
1. **Engage controls**: Click the rink (or press `Tab` until the canvas is focused). The HUD will display which hotspot you are near.
2. **Skate**: Use the arrow keys (or WASD) to build momentum around the ice. Turning has inertia—just like NHL '93.
3. **Navigate**: When the dashed outline and HUD prompt show a hotspot (About, Projects, Contact), press `Enter` to open that section. Press `Esc` to release the controls and return to normal page navigation.
4. **Fallback**: If you are on a touch device or prefer standard navigation, use the fallback links under the rink—they always point to the same destinations.

### Hotspot Config Reference (`assets/config/hotspots.json`)
- `version`: Schema version for future migrations.
- `canvas`: Native size of `rink_map_template.png`. The runtime uses this to scale coordinates.
- `hotspots`: Array of definitions, each with:
  - `id`: Stable identifier (used for debugging/analytics).
  - `label`: Text shown in the HUD and prompts.
  - `destination`: URL opened when the player presses `Enter` inside the region.
  - `rect`: `{ x, y, width, height }` in rink pixels defining the hotspot bounds.
  - `labelStyle`: Visual hints for the HUD (`color` controls prompt/beacon accents, `background` is available for future styling).

## Code Structure
### Top-Level Layout
- `index.html` – Primary page with fixed header, instructions, `<canvas>` rink, HUD container, and fallback links.
- `about.html`, `projects.html`, `contact.html` – Simple placeholders that share the header/skip-link scaffolding.
- `styles.css` – Retro theme, canvas wrapper styling, HUD look-and-feel, instructions, and fallback link styles.
- `assets/` – Art, sprites, and configuration.
  - `rink_map_template.png` – Native rink graphic (3939×5600) used for world coordinates.
  - `sprites/` – Packed player spritesheet (`skater.png`).
  - `config/` – JSON files (`sprites.json`, `hotspots.json`) that drive rendering/interaction.

### Runtime (main.js)
`main.js` is intentionally verbose and grouped into documented sections:
1. **DOM Wiring & Constants** – References to the canvas, HUD elements, status overlay, plus physics constants (acceleration, friction, turn-rate, max speed) and camera/sprite scaling knobs.
2. **Utilities** – Path normalization, clamping helpers, angular math, and vector helpers shared across systems.
3. **SpriteSheet Helper** – Loads the spritesheet JSON + image, exposes frame lookup by state/direction, and hands back frame rectangles for rendering.
4. **Input System** – Tracks whether the canvas currently owns the keyboard, listens for Arrow/WASD + Enter/Esc, maintains a normalized input vector, and exposes `enterTriggered` for navigation.
5. **Runtime Factories** – Builders for the player (position, velocity, heading, animation) and camera, plus clamps to keep everything inside `ICE_BOUNDS`.
6. **Physics/Animation** – Applies acceleration/friction, limits speed, blends toward the target heading, updates animation state (idle/skating/turning/coasting), quantizes facing directions, and advances frames.
7. **Hotspot System** – `HotspotManager` normalizes hotspot data, tracks the active region, and emits direction hints sorted by distance. `HotspotHud` consumes that data to update the DOM, while the render loop also draws a dashed outline directly on the canvas.
8. **Rendering** – Renders the rink slice based on the camera, outlines the active hotspot, and draws the scaled sprite with pixel-perfect filtering disabled.
9. **Update Loop** – Fixed-timestep accumulator that updates physics, camera, hotspots, HUD hints, and handles Enter navigation inside the same deterministic loop.
10. **Bootstrap** – Loads JSON + images in parallel, seeds the world/camera/player, registers the hotspot manager, exposes config for debugging, and fades out the loading overlay.

### Tooling & Scripts
- `package.json` – Provides `npm run dev` (Python HTTP server), `npm run lint` (ESLint with browser globals), and `npm run format` (Prettier) scripts.
- `eslint.config.js` / `.prettierrc` – Keep the vanilla ES module codebase consistent.

### Adding or Editing Hotspots
1. Update `assets/config/hotspots.json` with the new `rect`, `label`, and `destination`. The `canvas.width/height` values should stay aligned with `rink_map_template.png`.
2. No JS changes are required—`HotspotManager` ingests the JSON at load time and the HUD adapts automatically.
3. If you adjust colors or background styles, the HUD will pick them up via `labelStyle`.

This structure keeps the playful skating experience easy to iterate on: art and gameplay constants live in one place, while the modular hotspot/HUD system makes content tweaks fast and predictable.
