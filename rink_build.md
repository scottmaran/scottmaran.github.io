# NHL '93 Rink Build Outline

## 1. Project Bootstrapping
- Set up `main.js` entry that wires the canvas, asset loader, camera, and update loop skeleton.
- Expose a centralized config (`config/rink.js`) defining rink pixel dimensions (3939x5600), target viewport fraction (≈33%), and timing constants.
- Extend HTML shell to include the canvas element plus a lightweight loading overlay while `rink_map_template.png` decodes.

## 2. Asset Preparation
- Import `assets/rink_map_template.png`; verify color profiles and strip embedded text so it renders consistently.
- Generate an optimized export (e.g., WebP/PNG) plus an `ImageBitmap` preloader for the rink background; maintain original resolution for world-space accuracy.
- Author a metadata module describing landmarks: blue lines, benches, penalty boxes, and goal creases with their pixel coords pulled from the template grid.
- Create placeholder spritesheets for the player and UI overlays; ensure they share the same pixel scale so layering over the rink is seamless.

## 3. Canvas & Rendering Pipeline
- Initialize canvas at device pixel ratio using an offscreen buffer sized to the viewport slice (roughly 1313x1866 ≈ one third of the rink) and scale up to CSS pixel size while keeping integer zoom.
- Build a render pipeline: clear, draw the current rink slice via `drawImage` using camera crop coords, render player/UI, then optional debug overlays.
- Include a dev flag to draw the 33% viewport bounds and world axes for debugging camera issues.

## 4. Rink Layout & Scrolling Surface
- Represent the rink as a static world image (`rink_map_template.png`) alongside derived constants (`RINK_WIDTH = 3939`, `RINK_HEIGHT = 5600`).
- Implement a camera object that follows the player, clamping `cameraY` so the viewport never scrolls past the ends while allowing minor horizontal wiggle within the rink boards.
- Use `drawImage(rinkImage, camera.x, camera.y, viewportW, viewportH, 0, 0, viewportW, viewportH)` each frame; cache the rink in an offscreen canvas for better blit performance.
- Add responsive rules to recompute viewport dimensions so wider monitors still map to ~33% of rink height while respecting minimum/maximum zoom limits.

## 5. Player Entity & Movement Mechanics
- Define a `Player` class managing world position (in rink pixels), velocity vector, facing angle, and animation state.
- Apply acceleration toward input heading with top speed tuned in pixels/sec; map friction to taper glide similar to NHL '94.
- When updating the camera, center horizontally on the player but bias vertically ahead of travel direction to reveal space in front.
- Quantize facing angle to sprite directions and trigger animation transitions when speed crosses idle/coast/skating thresholds.

## 6. Input Handling & Focus Management
- Capture keyboard events within a focused game container; translate held keys into desired heading/acceleration cues each frame.
- Support `Esc` to release focus and restore page scroll; show overlay instructions when focus is lost.
- Queue future hooks for Enter-triggered hotspot navigation, using the landmark metadata created earlier.

## 7. Collision & Boundary Enforcement
- Construct axis-aligned world bounds from the rink image; clamp player coordinates slightly inside the boards to avoid clipping crowd art.
- Derive goal creases and benches as AABBs for hotspot checks; highlight them when the player overlaps.
- Optionally add friction zones near the boards by sampling metadata to slow the player subtly as they approach glass.

## 8. Animation & Sprite Sync
- Preload skating spritesheets and map world velocity magnitude to animation frame timing; idle frame when speed falls below threshold.
- Select sprite orientation by converting the player heading into one of eight sectors; flip horizontally when applicable to minimize art needs.
- Align sprite feet to the rink plane by offsetting draw positions so skates stay on the ice texture despite perspective.

## 9. Game Loop & Performance
- Implement a fixed-timestep accumulator (e.g., 16.67 ms) so physics remain stable regardless of frame hiccups.
- Profile canvas blits of the 33% viewport; if needed, scale down the rink image on load to create a mid-res cache for slower devices.
- Add runtime logging hooks (toggled via dev flag) for player velocity, camera position, and hotspot activity.

## 10. Testing & Validation
- Unit-test vector math helpers and camera clamping logic, especially edge cases at the top/bottom boards.
- Manual QA checklist: viewport sizing across screen resolutions, smooth camera follow, bench/crease detection, and idle-to-skate transitions.
- Prepare GitHub Actions workflow running lint/tests and optionally visual regression using a headless browser screenshot of the rink slice.

## 11. Future Considerations
- Evaluate slicing the rink into horizontal strips if performance becomes an issue due to texture size.
- Plan audio cue integration keyed off camera zones (crowd swell near goals, bench chatter near benches).
- Document procedures for updating `rink_map_template.png` or swapping in alternate arenas without touching core code.
