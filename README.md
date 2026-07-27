# Scott Maran Personal Site

## Using the Site

The homepage scrolls goal line to goal line through the site’s About, Projects,
Game, and Contact sections. The same ice-rink visual system continues across the
dedicated About, Projects, and Contact pages.

Choose **Play** from the homepage header or game chapter to open the NHL
'93-inspired game without leaving the page:

1. **Engage controls**: Click the rink or focus it with the keyboard.
2. **Grab the puck**: Skate to center ice and press <kbd>Space</kbd>.
3. **Skate**: Use the arrow keys or WASD. Turning has inertia.
4. **Throw a hit**: Colliding with computer players at speed body-checks them.
5. **Navigate**: Carry the puck into an About, Projects, or Contact hotspot and
   press <kbd>Enter</kbd>.
6. **Shoot**: Press <kbd>P</kbd> while carrying the puck.
7. **Customize**: Use the Customize menu to select sprites and NPC count.

### Hotspot Config Reference (`assets/config/hotspots.json`)

- `version`: Schema version for future migrations.
- `canvas`: Native size of `rink_map_template_no_lines.png`. The runtime uses this to scale coordinates.
- `hotspots`: Array of definitions, each with:
  - `id`: Stable identifier (used for debugging/analytics).
  - `label`: Text shown in the HUD and prompts.
  - `destination`: URL opened when the player presses `Enter` inside the region.
  - `rect`: `{ x, y, width, height }` in rink pixels defining the hotspot bounds.
  - `labelStyle`: Visual hints for the HUD (`color` controls prompt/beacon accents, `background` is available for future styling).

## Code Structure

### Top-Level Layout

- `index.html` – Scroll-led homepage and embedded game dialog.
- `about.html`, `projects.html`, `contact.html` – Dedicated content pages using
  the shared rink visual system.
- `styles.css` – Shared rink, typography, navigation, content, and responsive
  styles.
- `game.css` – Embedded game HUD, scoreboard, toolbar, and canvas styles.
- `main.js` – Shared scroll route, reveal, mobile-navigation, and game-dialog
  controller.
- `game.js` – NHL '93 game runtime, loaded only when Game Mode opens.
- `assets/` – Art, sprites, and configuration.
  - `rink_map_template_no_lines.png` – Native rink graphic (3939×5600) used for world coordinates.
  - `sprites/` – Packed player spritesheets for general skating.
  - `puck_sprites/` – Matching sprite sheets that include puck-on-stick art, swapped in automatically when you possess the puck.
- `assets/config/` – JSON files (`sprites.json`, `hotspots.json`, `puck.json`,
  `npcs.json`) that drive rendering and interaction.

### Game Runtime (`game.js`)

`game.js` is grouped into documented sections:

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

1. Update `assets/config/hotspots.json` with the new `rect`, `label`, and `destination`. The `canvas.width/height` values should stay aligned with `rink_map_template_no_lines.png`.
2. No JS changes are required—`HotspotManager` ingests the JSON at load time and the HUD adapts automatically.
3. If you adjust colors or background styles, the HUD will pick them up via `labelStyle`.

This structure keeps the playful skating experience easy to iterate on: art and gameplay constants live in one place, while the modular hotspot/HUD system makes content tweaks fast and predictable.
