# NHL '93 Personal Site Design Doc

## Objectives
- Deliver a GitHub Pages landing experience that feels like skating in NHL '93.
- Provide keyboard-driven navigation on the rink plus standard header links for accessibility.
- Reuse authentic NHL '93 sprite art, rink visuals, and plan for authentic audio cues.
- Lay the groundwork for interactable secondary systems (puck, non-player skaters) so the rink feels alive and future gameplay hooks have clearly defined requirements.

## Page Structure & Layout
- **Global Header Bar**: Fixed at top with standard links (`Home`, `About`, `Projects`, `Contact`, etc.); mirrors GitHub Pages nav for mouse users.
- **Main Rink Canvas**: Full-width section beneath header containing an ice rink graphic rendered on an HTML `<canvas>` (preferred for smooth animation control).
- **Hotspot Labels**: Overlay markers tied to canvas coordinates (e.g., penalty box = `About`, bench = `Projects`, goal crease = `Contact`). MVP ships with these three fixed hotspots, positioned relative to `assets/rink_map_template_no_lines.png` so we can tune coordinates as we refine layout. Because these regions may start off screen while the camera tracks the skater, HUD cues should help players orient toward them. Hotspot visuals rely entirely on the underlying rink art (e.g., goal net), so UI labels only appear once the skater overlaps the zone.
- **Fallback Navigation**: Plain-text list of the same links below the rink for screen readers / non-JS support; the canvas should continue rendering while prompts steer users toward the static link list when keyboard input is unavailable.

## Visual Assets
- **Sprite Sources**: Extract NHL '93 player sprites, rink tiles, and UI elements from ROM resources or community sprite sheets. Initial sprite drops already live under `assets/`, so the MVP can reference them directly before investing in additional extraction tooling.
- **Asset Pipeline**: Normalize sprites into spritesheets (per animation state) using a build script or manual atlas; store under `assets/sprites/`.
- **Scaling Strategy**: Render at 1:1 pixel art on canvas, apply integer scaling via CSS to preserve crisp edges on retina displays.
- **Rink Background**: Use a tiled texture or a pre-baked rink image matching the Sega color palette; align hotspots with precise coordinates.

## Movement & Physics Model
- **Core Goal**: Recreate NHL '93 skating feel—momentum-based acceleration, deceleration, friction, and turning inertia—referencing gameplay footage (https://youtu.be/O0xemrRYMQw?t=16) for tuning when exact physics values aren't available, then iterating via hands-on testing until it "feels right."
- **State Machine**: Track player state (`idle`, `skating`, `turning`, `coasting`). Map arrow keys to desired heading and acceleration.
- **Velocity Handling**: Maintain `velocity` vector updated each frame with acceleration capped at game-like max speed and friction constants tuned to match reference footage.
- **Turning Model**: Introduce turn rate limits so direction changes arc naturally; use angular velocity and easing for directional changes.
- **Animation Sync**: Choose sprite frame based on skating speed and direction (8-direction or more if extracted). Idle frame when below movement threshold.
- **Collision Zones**: Invisible rectangles defining hotspot regions; optionally add simple rink boundaries with bounce or stop behavior.
- **Camera System**: Viewport always follows the skater, revealing only a slice of the rink at a time while clamping at rink boundaries to prevent overruns or jitter when players press against the edges.
- **Multi-Actor Support**: Physics helpers (`updatePlayerPhysics`, `clampPlayerToIce`, etc.) should evolve into reusable math utilities so the puck and static computer players can share friction/acceleration constants without duplicating logic in `main.js`.

## Puck System Goals
- **Purpose**: Introduce a puck sprite that spawns at center ice, can be picked up (stick handling) when the user skates over it, and visually sells the NHL experience even before full gameplay rules ship.
- **Physics**: Treat the puck as a small rigid body with its own `velocity`, friction, and elastic collisions against the boards so it can slide when knocked loose. When attached to the player, it lerps toward a stick offset relative to the player's facing direction.
- **State Tracking**: Define clear states such as `free`, `possessed`, and `shooting`. Transition rules (e.g., pressing `Enter` while in a hotspot shoots the puck down-rink to trigger a link) should be enumerated for future phases.
- **Rendering**: Layer the puck beneath the active skater but above the rink background to keep depth cues believable. Reuse the same `camera` scaling math so no extra canvas transforms are required.
- **Config Driven**: Store puck sprite path, scale, hit radius, and physics constants in `assets/config/puck.json` so designers can tweak feel without editing JS.
- **HUD + Accessibility**: Surface puck possession in the HUD ("Puck ready: Press Enter in the crease") and provide ARIA live messages any time possession changes so screen readers understand why pressing `Enter` does (or does not) work.

## Static Computer Players
- **Goal**: Fill the rink with atmospheric teammates or opponents that stand in fixed locations (bench, goalmouth, blue line) using authentic sprites so the rink never feels empty.
- **Behavior**: Initial version keeps them idle. They occupy hitboxes so the user cannot skate through them, forcing gentle lane changes that mimic weaving around real skaters.
- **Interactivity**: They can optionally display tooltips or trigger copy when approached (e.g., "Coach tips"), but MVP scope is visual presence plus collision.
- **Data-Driven Placement**: Define NPC roster in `assets/config/npcs.json`, including sprite variant ID (reusing the existing sprite sheet definitions), spawn coordinates, facing direction, animation state, bounding shape, and whether the camera should focus/track them.
- **Rendering Order**: Sort drawables by `y` coordinate (painter's algorithm) so down-rink characters overlap properly relative to the puck and the controllable skater.
- **Extensibility**: The config schema should leave room for `aiType` and `route` arrays so we can upgrade static players into patrolling AI without rewriting the data layer.

## Input System
- **Keyboard Controls**: Capture `keydown` / `keyup` for arrow keys and `Enter`; prevent default scrolling behavior when canvas focused.
- **Focus Management**: Click or automatic focus sets keyboard control to rink; provide prompt to press `Esc` to relinquish control.
- **Accessibility Considerations**: Ensure `tabindex` management and ARIA instructions so screen readers understand controls.

## Interaction Flow
- Player spawns center ice in idle pose.
- Arrow keys accelerate the skater toward chosen direction with smooth easing.
- When player enters hotspot bounds, highlight label (e.g., glow, HUD indicator).
- Pressing `Enter` while overlapping a hotspot triggers navigation `window.location.href` transition to the page.
- Optional overlay text to show current hotspot name or "Skate to a section" instructions.
- Puck spawns idle at center ice; the first player to overlap it gains possession, prompting HUD copy that explains how to use it.
- If the puck is free, entering a hotspot could trigger guidance ("Grab the puck to unlock this link"), while possession toggles additional actions such as banking a shot into the crease to open `contact.html`.
- Static computer players populate benches/crease; skating through them is prevented via collision radii, and proximity hints can guide the user toward them if they eventually become interactive.

## Technical Stack
- **HTML/CSS**: Static GitHub Pages layout, custom fonts (retro) via CSS, CSS variables for palette.
- **JavaScript**: Pure vanilla ES6 modules (no frameworks or bundlers) handling game loop, input, and asset loading.
- **Rendering**: Use `requestAnimationFrame` loop to update physics and draw sprites on `<canvas>`.
- **Asset Loading**: Preload spritesheets and JSON metadata; display loading state before gameplay ready.
- **Data Definitions**: JSON config listing hotspot coordinates, labels, destination URLs to keep logic decoupled from visuals.

## Data Schemas
- Store config JSON under `assets/config/` so GitHub Pages serves it statically but outside the JS bundle.
- All coordinates reference the native resolution of `assets/rink_map_template_no_lines.png`; the camera and integer scaling math derive from this canonical size.

### Sprite Atlas (`assets/config/sprites.json`)
```json
{
  "version": 1,
  "sheet": "assets/sprites/skater.png",
  "frameSize": { "width": 48, "height": 48 },
  "origin": { "x": 24, "y": 36 },
  "states": {
    "idle": {
      "directions": {
        "N": { "frames": [0], "frameDurationMs": 250 },
        "NE": { "frames": [1], "frameDurationMs": 250 },
        "E": { "frames": [2], "frameDurationMs": 250 },
        "SE": { "frames": [3], "frameDurationMs": 250 }
      }
    },
    "skating": {
      "directions": {
        "N": { "frames": [4, 5, 6, 7], "frameDurationMs": 90 },
        "NE": { "frames": [8, 9, 10, 11], "frameDurationMs": 90 },
        "E": { "frames": [12, 13, 14, 15], "frameDurationMs": 90 },
        "SE": { "frames": [16, 17, 18, 19], "frameDurationMs": 90 }
      }
    },
    "turning": { "directions": { "N": { "frames": [20, 21], "frameDurationMs": 120 } } },
    "coasting": { "directions": { "N": { "frames": [22, 23], "frameDurationMs": 140 } } }
  }
}
```

- `origin` defines the pivot (blade contact point) used for collision/camera alignment.
- States are extensible; if new sprites arrive we can append eight-direction sets without changing JS.

### Hotspot Map (`assets/config/hotspots.json`)
```json
{
  "version": 1,
  "canvas": { "width": 2048, "height": 1024 },
  "hotspots": [
    {
      "id": "penalty_box",
      "label": "About",
      "destination": "/about.html",
      "rect": { "x": 132, "y": 360, "width": 150, "height": 90 },
      "labelStyle": { "color": "#1D4ED8", "background": "#FFFFFF" }
    },
    {
      "id": "bench",
      "label": "Projects",
      "destination": "/projects.html",
      "rect": { "x": 1560, "y": 370, "width": 180, "height": 80 },
      "labelStyle": { "color": "#1D4ED8", "background": "#FFFFFF" }
    },
    {
      "id": "goal_crease",
      "label": "Contact",
      "destination": "/contact.html",
      "rect": { "x": 940, "y": 240, "width": 120, "height": 70 },
      "labelStyle": { "color": "#1D4ED8", "background": "#FFFFFF" }
    }
  ]
}
```

- `canvas` encodes the base rink size, enabling runtime scaling.
- `rect` uses rink pixels; collision detection compares skater bounds against these coordinates regardless of camera position.
- `labelStyle` metadata controls inline text styling when the hotspot label fades in, keeping art assets limited to the pre-rendered rink.

### Puck Config (`assets/config/puck.json`)
```json
{
  "version": 1,
  "sprite": "assets/general_puck.png",
  "frameSize": { "width": 16, "height": 16 },
  "origin": { "x": 8, "y": 8 },
  "radius": 18,
  "spawn": { "x": 1969, "y": 2810 },
  "physics": {
    "friction": 650,
    "maxSpeed": 1400,
    "stickMagnet": 420
  }
}
```

- `stickMagnet` determines how quickly the puck re-centers on the stick when possessed.
- `radius` is used for both collision checks against the rink bounds and for overlap detection with the player or computer skaters.
- `spawn` can later evolve into an array if multiple puck drop locations are desired.

### NPC Roster (`assets/config/npcs.json`)
```json
{
  "version": 1,
  "players": [
    {
      "id": "bench_left_a",
      "spriteVariant": "nyr",
      "state": "idle",
      "direction": "E",
      "position": { "x": 3200, "y": 2500 },
      "hitbox": { "radius": 60 },
      "interaction": { "type": "none" }
    },
    {
      "id": "crease_goalie",
      "spriteVariant": "ana2",
      "state": "coasting",
      "direction": "N",
      "position": { "x": 1880, "y": 1200 },
      "hitbox": { "width": 90, "height": 140 }
    }
  ]
}
```

- Each entry references a `spriteVariant` already defined in `sprites.json`, guaranteeing shared animation metadata.
- `hitbox` can be circular (`radius`) or rectangular (`width`, `height`); the runtime will pick whichever properties exist.
- `interaction` is intentionally open-ended so future phases can attach copy, tooltips, or scripted behaviors without reshaping the file.

## Audio Plan (Phase Two)
- Source authentic NHL '93 SFX (skate glides, crowd noise, menu blips).
- Use `AudioContext` with decoded buffers for low-latency playback.
- Trigger looped ambient crowd track, footstep loops tied to animation speed, and confirmation chime on `Enter`.
- Provide mute toggle in header for accessibility.

Full audio hook-up is deferred until after the MVP interaction is complete, so no engines or UI toggles are required in the first release beyond planning.

## Multi-Page Setup
- Create placeholder HTML pages (`about.html`, `projects.html`, `contact.html`) with consistent header bar for now; content can stay minimal while we focus on the interactive rink.
- Reuse shared CSS/JS bundles; header nav links point to actual files.
- Ensure GitHub Pages configuration (likely via `docs/` or main branch root) includes all pages and asset directories.

## Accessibility & Progressive Enhancement
- Provide descriptive instructions above the canvas explaining keyboard controls.
- Ensure color contrast in overlays/labels; add focus styles.
- Maintain skip link to bypass interactive rink for keyboard users.
- When JS disabled, show static rink image plus standard link list.

## Testing & QA
- Test keyboard input across desktop browsers (Chrome, Firefox, Safari) and ensure frame rate stability.
- Verify scaling behavior on mobile (fallback to static layout, or disable interaction if keyboard absent).
- Check asset loading times; optimize via compression / lazy loading if necessary.
- Conduct manual accessibility smoke tests (keyboard navigation and screen reader spot checks) once functionality lands.

## Future Enhancements
- Upgrade static computer players into patrolling AI with waypoint graphs and limited steering behaviors so they feel reactive without complex pathfinding.
- Expand puck logic into mini-objectives (bank shots off boards, timed skill challenges) that unlock hidden site sections or easter eggs.
- Integrate score overlay showing visitor progress or fun stats.
- Offer controller support (gamepad API) mirroring original console feel.
