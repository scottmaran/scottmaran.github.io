# NHL '94 Sprite Guidance

To keep the rink experience authentic, you’ll want to pull real NHL ’94 era pixel art. A few reliable options:

- **Community downloads**: The NHLPA ’93 / NHL ’94 preservation hub hosts pre-ripped sprite sheets and rink tiles. Start here: `https://nhlpa93.nhl94.com/multimedia/downloads/downloads.php` (look under Sprites and Graphics Packs).
- **ROM extraction**: If you prefer custom poses, grab the NHL ’94 Genesis ROM and open it with Tile Molester, YY-CHR, or Retro Graphics Toolkit. Set the codec to Sega Genesis 4bpp planar, adjust the tile arrangement, and export frames manually.
- **Sprite clean-up**: After downloading, convert loose frames into atlases—one idle frame (`player_idle.png`) and one multi-row sheet for 8-direction skating (`player_skate.png`). Keep each frame consistent (current build expects 57x110) and align the skater’s skates near the bottom so the anchor points in `../metadata/player.json` stay correct.
- **Rink background**: Many packs include full rink screenshots. For a crisp base, use a 960x600 rink that aligns with NHL ’94 markings. If you only have a smaller screenshot, upscale it with integer scaling (2x/3x) in Aseprite, Photoshop, etc., and trim to 960x600.

Once sourced, drop the files in this folder:
- `player_idle.png`
- `player_skate.png`
- `rink_base.png`
- Optional overlays (e.g., hotspot highlight) should match the canvas palette.

Always double-check the licensing/usage notes from the source. Reach out to the NHL94.com community forums if you need help locating specific teams or color swaps.
## Current build
- `player_idle.png` + `player_skate.png` come from the Anaheim animation strip (`ANA.gif`) in the NHLPA93 sprite pack. Frames are 57x110 with eight poses arranged horizontally.
- `rink_base.png` is the resized `gameplay_example.png` reference (scaled to 960x600 with nearest-neighbour).

To swap teams, export the desired player GIF to PNG the same way and overwrite these files. Update `assets/metadata/player.json` only if your frame dimensions change.

