# Authentic Audio Guidance

You can add that classic NHL ’94 atmosphere once the art is in. To build the library:

- **Community packs**: The NHLPA ’93 / NHL ’94 fan archives (same site: `https://nhlpa93.nhl94.com/multimedia/downloads/downloads.php`) occasionally host zipped SFX/Music collections ripped from the Genesis ROMs.
- **ROM ripping**: If a ready-made pack isn’t available, rip audio yourself:
  - Use an emulator like Kega Fusion or Gens with a VGM logger to record in-game music/SFX into `.vgm` files.
  - Convert `.vgm` to `.wav` or `.ogg` using VGMToolbox or vgm2wav.
  - For one-off effects (skate glides, menu chime), capture short loops directly from emulator recordings and trim/tile in Audacity.
- **Crowd ambience**: Layer longer crowd loops from gameplay captures. Normalize levels so they sit around -18 LUFS and export as `crowd_loop.mp3` (or `.ogg` if you prefer) for looping playback.

Target files for this directory:
- `crowd_loop.mp3` – looping background ambience
- `skate_glide.mp3` – triggered while the player is moving
- `menu_confirm.mp3` – confirmation sting on Enter

Keep an eye on usage rights: community rips are usually fine for personal sites, but avoid redistributing commercial soundtrack material. Once files are ready, hook them into the audio loader in `js/rink.js` (toggle button already present).

## Current build
- `crowd_loop.mp3`, `skate_glide.mp3`, and `menu_confirm.mp3` are sourced from the NHLPA93 SFX pack (see `assets/nhlpa93_tunes_mp3`). Feel free to swap in higher-fidelity loops—just keep the same filenames so the loader continues to work.

