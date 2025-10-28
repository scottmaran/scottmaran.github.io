# NHL '93 Personal Site Design Doc

## Objectives
- Deliver a GitHub Pages landing experience that feels like skating in NHL '93.
- Provide keyboard-driven navigation on the rink plus standard header links for accessibility.
- Reuse authentic NHL '94 sprite art, rink visuals, and plan for authentic audio cues.

## Page Structure & Layout
- **Global Header Bar**: Fixed at top with standard links (`Home`, `About`, `Projects`, `Contact`, etc.); mirrors GitHub Pages nav for mouse users.
- **Main Rink Canvas**: Full-width section beneath header containing an ice rink graphic rendered on an HTML `<canvas>` (preferred for smooth animation control).
- **Hotspot Labels**: Overlay markers tied to canvas coordinates (e.g., penalty box = `About`, bench = `Projects`, goal crease = `Contact`). Each hotspot has an associated destination URL.
- **Fallback Navigation**: Plain-text list of the same links below the rink for screen readers / non-JS support.

## Visual Assets
- **Sprite Sources**: Extract NHL '94 player sprites, rink tiles, and UI elements from ROM resources or community sprite sheets.
- **Asset Pipeline**: Normalize sprites into spritesheets (per animation state) using a build script or manual atlas; store under `assets/sprites/`.
- **Scaling Strategy**: Render at 1:1 pixel art on canvas, apply integer scaling via CSS to preserve crisp edges on retina displays.
- **Rink Background**: Use a tiled texture or a pre-baked rink image matching the Sega color palette; align hotspots with precise coordinates.

## Movement & Physics Model
- **Core Goal**: Recreate NHL '94 skating feel—momentum-based acceleration, deceleration, friction, and turning inertia.
- **State Machine**: Track player state (`idle`, `skating`, `turning`, `coasting`). Map arrow keys to desired heading and acceleration.
- **Velocity Handling**: Maintain `velocity` vector updated each frame with acceleration capped at game-like max speed and friction constants tuned to match reference footage.
- **Turning Model**: Introduce turn rate limits so direction changes arc naturally; use angular velocity and easing for directional changes.
- **Animation Sync**: Choose sprite frame based on skating speed and direction (8-direction or more if extracted). Idle frame when below movement threshold.
- **Collision Zones**: Invisible rectangles defining hotspot regions; optionally add simple rink boundaries with bounce or stop behavior.

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

## Technical Stack
- **HTML/CSS**: Static GitHub Pages layout, custom fonts (retro) via CSS, CSS variables for palette.
- **JavaScript**: ES6 module handling game loop, input, asset loading.
- **Rendering**: Use `requestAnimationFrame` loop to update physics and draw sprites on `<canvas>`.
- **Asset Loading**: Preload spritesheets and JSON metadata; display loading state before gameplay ready.
- **Data Definitions**: JSON config listing hotspot coordinates, labels, destination URLs to keep logic decoupled from visuals.

## Audio Plan (Phase Two)
- Source authentic NHL '94 SFX (skate glides, crowd noise, menu blips).
- Use `AudioContext` with decoded buffers for low-latency playback.
- Trigger looped ambient crowd track, footstep loops tied to animation speed, and confirmation chime on `Enter`.
- Provide mute toggle in header for accessibility.

## Multi-Page Setup
- Create placeholder HTML pages (`about.html`, `projects.html`, `contact.html`) with consistent header bar for now.
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
- Conduct accessibility audit (e.g., Lighthouse) once functionality lands.

## Future Enhancements
- Add opponent AI skating around for atmosphere.
- Introduce puck pickup mini-goals leading to deeper page sections.
- Integrate score overlay showing visitor progress or fun stats.
- Offer controller support (gamepad API) mirroring original console feel.
