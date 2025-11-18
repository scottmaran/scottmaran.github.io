/**
 * NHL '93 Rink Runtime
 * ---------------------
 * This module keeps the entire skating experience in one place so it is easy to
 * reason about from a "Python brain". The file is organized in four layers:
 *   1. DOM references + configuration constants
 *   2. Small helper utilities (loading assets, math, input plumbing)
 *   3. Core simulation objects (player, camera, hotspots)
 *   4. The fixed-timestep update + render loop
 */

// --- DOM references ---------------------------------------------------------
const canvas = document.getElementById('rink-canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
const statusEl = document.querySelector('.canvas-status');
const touchNotice = document.querySelector('.no-keyboard');
const navLinks = document.querySelectorAll('.site-header nav a');
const hudRoot = document.querySelector('.hud');
const hudPrompt = document.querySelector('.hud__prompt');
const hudLabel = document.querySelector('.hud__label');
const hudAction = document.querySelector('.hud__action');
const hudBeacons = document.querySelector('.hud__beacons');
const instructionsOverlay = document.getElementById('instructions-overlay');
const spriteSelect = document.getElementById('sprite-select');
const npcCountSelect = document.getElementById('npc-count');
const npcSpriteSelect = document.getElementById('npc-sprite-select');
const scorePlayerEl = document.getElementById('score-player');
const scoreOpponentEl = document.getElementById('score-opponent');

// --- Simulation constants ---------------------------------------------------
const FIXED_TIME_STEP = 1000 / 60; // target 60 FPS update cadence (in ms)
const MAX_UPDATES_PER_FRAME = 5; // prevent spiraling if a frame stalls
const CAMERA_VIEW = { width: 1536, height: 1152 }; // slice of the rink we show
const PLAYER_SCALE_FACTOR = 3; // manual knob to keep skater readable
const PLAYER_COLLISION_RADIUS = 42; // rough hit area around the sprite torso
const PUCK_DEFAULT_SCALE = 0.55; // eyeballed so the puck feels proportional to skaters
const PUCK_STICK_OFFSET = 50; // distance (px) from player center to stick blade
const PUCK_RELEASE_SPEED = 900; // px / s impulse when casually dropping the puck
const PUCK_SHOT_SPEED = 1850; // px / s impulse when firing a shot
const PUCK_HINT_COLOR = '#FFA851';
const GOAL_ZONES = [
  { id: 'north', rect: { x: 1700, y: 750, width: 600, height: 120 }, scorer: 'player' },
  { id: 'south', rect: { x: 1790, y: 5100, width: 540, height: 120 }, scorer: 'opponent' },
];
const MAX_NPC_COUNT = 12;
const GOAL_RESPAWN_DELAY = 1000; // ms pause before resetting after a goal
const NPC_HIT_MIN_SPEED = 260; // px / s before a collision counts as a body check
const NPC_HIT_IMPULSE_SCALE = 0.85; // converts player speed into NPC knockback speed
const NPC_HIT_FRICTION = 950; // px / s^2 slowdown applied to knocked NPCs
const NPC_HIT_MIN_VELOCITY = 8; // below this NPCs snap back to their idle pose
const NPC_SEPARATION_RATIO = 0.4; // share of the overlap distance applied to NPC displacement

// Hard-coded ice bounds derived from `assets/rink_map_template_no_lines.png`. The rink
// image includes benches/crowd art outside the boards, but we want the player
// confined to the actual playable ice surface.
const ICE_BOUNDS = {
  left: 850,
  right: 3275,
  top: 600,
  bottom: 5350,
};

// Physics numbers are tuned by hand while watching NHL '93 footage.
const PLAYER_PHYSICS = {
  ACCELERATION: 1400, // px / s^2 when pressing a direction
  FRICTION: 900, // px / s^2 subtracted when coasting
  MAX_SPEED: 950, // px / s top speed
  TURN_RATE: Math.PI * 1.8, // radians / s the skater can redirect velocity
  MIN_SPEED: 40, // below this we treat the player as idle
  TURNING_THRESHOLD: Math.PI / 8, // when to enter the turning animation
};

// Directional controls map to both arrow keys and WASD to aid muscle memory.
const KEY_TO_DIRECTION = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

// Track keyboard state so physics can stay deterministic.
const inputState = {
  engaged: false,
  keys: { up: false, down: false, left: false, right: false },
  vector: { x: 0, y: 0 },
  actions: {
    enterPressed: false,
    enterTriggered: false,
    spacePressed: false,
    spaceTriggered: false,
    shootPressed: false,
    shootTriggered: false,
  },
};

const ZERO_VECTOR = Object.freeze({ x: 0, y: 0 });

let lastTime = 0;
let accumulator = 0;
let spriteVariantLoadToken = 0;
const spriteSheetCache = new Map();

// Bundle runtime state into one object for easier debugging.
const game = {
  ready: false,
  world: null,
  hotspotHints: [],
  activeHotspot: null,
  camera: null,
  player: null,
  rinkImage: null,
  spriteSheet: null,
  iceBounds: ICE_BOUNDS,
  hotspotManager: null,
  spriteVariants: [],
  spriteVariant: null,
  skaters: [],
  puckConfig: null,
  npcConfig: null,
  puck: null,
  allNpcs: [],
  npcs: [],
  spriteVariantsById: {},
  currentNpcVariantId: null,
  score: { player: 0, opponent: 0 },
  lastPuckShooter: null,
  celebratingGoal: false,
  goalCelebrationTimer: 0,
};

// --- Asset helpers ----------------------------------------------------------
async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image ${src}`));
    img.src = src;
  });
}

function alignRinkImageToWorld(image, world) {
  if (!image || !world) return image;
  if (image.width === world.width && image.height === world.height) {
    return image;
  }
  const buffer = document.createElement('canvas');
  buffer.width = world.width;
  buffer.height = world.height;
  const ctx2d = buffer.getContext('2d');
  if (!ctx2d) return image;
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.drawImage(image, 0, 0, world.width, world.height);
  if (typeof console !== 'undefined') {
    console.info(
      `Scaled rink image from ${image.width}x${image.height} to ${world.width}x${world.height} to match hotspot coordinates.`
    );
  }
  return buffer;
}

let statusHideTimer = null;
function flashStatus(message, duration = 1200, { emphasize = false } = {}) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.removeAttribute('hidden');
  if (emphasize) {
    statusEl.classList.add('is-ready');
  }
  if (statusHideTimer) {
    clearTimeout(statusHideTimer);
  }
  statusHideTimer = setTimeout(() => {
    statusEl.setAttribute('hidden', 'hidden');
    if (statusEl) {
      statusEl.classList.remove('is-ready');
    }
  }, duration);
}

// --- General utilities ------------------------------------------------------
function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  const stripped = pathname.replace(/index\.html$/, '').replace(/\/$/, '');
  return stripped || '/';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  let result = angle;
  while (result <= -Math.PI) result += Math.PI * 2;
  while (result > Math.PI) result -= Math.PI * 2;
  return result;
}

function quantizeDirection(angleRad) {
  const degrees = ((angleRad * 180) / Math.PI + 360) % 360;
  if (degrees >= 45 && degrees < 135) return 'NE';
  if (degrees >= 135 && degrees < 225) return 'N';
  if (degrees >= 225 && degrees < 315) return 'SE';
  return 'E';
}

function vectorMagnitude(vector) {
  return Math.hypot(vector.x, vector.y);
}

// --- Sprite Sheet Helper ----------------------------------------------------
class SpriteSheet {
  constructor(config, image) {
    this.config = config;
    this.image = image;
    this.frameWidth = config.frameSize.width;
    this.frameHeight = config.frameSize.height;
    this.origin = config.origin;
    this.states = config.states;
    this.framesPerRow = Math.max(1, Math.floor(image.width / this.frameWidth));
  }

  getDirection(stateKey, directionKey) {
    const state = this.states[stateKey];
    if (!state) return null;
    return (
      state.directions[directionKey] ||
      state.directions.N ||
      state.directions.E ||
      Object.values(state.directions)[0]
    );
  }

  getFrameRect(frameIndex) {
    const sx = (frameIndex % this.framesPerRow) * this.frameWidth;
    const sy = Math.floor(frameIndex / this.framesPerRow) * this.frameHeight;
    return { sx, sy, sw: this.frameWidth, sh: this.frameHeight };
  }
}

function normalizeSpriteVariants(config) {
  if (Array.isArray(config.variants) && config.variants.length > 0) {
    return config.variants.map((variant, index) => ({
      id: variant.id || `variant-${index}`,
      label: variant.label || `Variant ${index + 1}`,
      sheet: variant.sheet,
      frameSize: variant.frameSize,
      origin: variant.origin,
      states: variant.states,
    }));
  }

  return [
    {
      id: 'default',
      label: 'Default',
      sheet: config.sheet,
      frameSize: config.frameSize,
      origin: config.origin,
      states: config.states,
    },
  ];
}

function createSingleFramePuckConfig(baseConfig, puckImage) {
  const clonedStates = {};
  Object.entries(baseConfig.states).forEach(([stateKey, stateValue]) => {
    const directions = {};
    Object.entries(stateValue.directions).forEach(([dirKey, dirValue]) => {
      directions[dirKey] = {
        ...dirValue,
        frames: [0],
      };
    });
    clonedStates[stateKey] = {
      ...stateValue,
      directions,
    };
  });

  return {
    ...baseConfig,
    frameSize: { width: puckImage.width, height: puckImage.height },
    origin: {
      x: Math.min(baseConfig.origin.x, puckImage.width),
      y: Math.min(baseConfig.origin.y, puckImage.height),
    },
    states: clonedStates,
  };
}

function derivePuckSpritePath(sheetPath) {
  if (!sheetPath) return null;
  if (sheetPath.includes('assets/sprites/')) {
    return sheetPath.replace('assets/sprites/', 'assets/puck_sprites/');
  }
  const parts = sheetPath.split('/');
  const filename = parts[parts.length - 1];
  return `assets/puck_sprites/${filename}`;
}

async function loadSpriteSheetsForVariant(variant) {
  const baseImage = await loadImage(variant.sheet);
  const baseSheet = new SpriteSheet(variant, baseImage);
  let puckSheet = null;
  const puckPath = derivePuckSpritePath(variant.sheet);
  if (puckPath) {
    try {
      const puckImage = await loadImage(puckPath);
      const needsSingleFrame =
        puckImage.width < variant.frameSize.width || puckImage.height < variant.frameSize.height;
      const puckConfig = needsSingleFrame ? createSingleFramePuckConfig(variant, puckImage) : variant;
      puckSheet = new SpriteSheet(puckConfig, puckImage);
    } catch (error) {
      console.warn(
        `No puck sprite found for variant "${variant.id}" at ${puckPath}. Defaulting to base sheet.`,
        error
      );
    }
  }
  return { base: baseSheet, puck: puckSheet };
}

async function getVariantSpriteSheets(variant) {
  if (!variant) return null;
  if (spriteSheetCache.has(variant.id)) {
    return spriteSheetCache.get(variant.id);
  }
  const sheets = await loadSpriteSheetsForVariant(variant);
  spriteSheetCache.set(variant.id, sheets);
  return sheets;
}

function reportMissingNpcVariants(npcConfig, spriteVariants) {
  if (!npcConfig || !Array.isArray(npcConfig.players) || !spriteVariants) {
    return [];
  }
  const available = new Set(spriteVariants.map((variant) => variant.id));
  const missing = npcConfig.players
    .filter((npc) => npc.spriteVariant && !available.has(npc.spriteVariant))
    .map((npc) => ({ id: npc.id, spriteVariant: npc.spriteVariant }));
  if (missing.length > 0) {
    console.warn('NPC config references sprite variants that do not exist:', missing);
  }
  return missing;
}

function resetSkaterAnimation(skater, spriteSheetOverride) {
  if (!skater) return;
  const sheet = spriteSheetOverride || skater.spriteSheet;
  if (!sheet) return;
  skater.animation.frameIndex = 0;
  skater.animation.elapsed = 0;
  const dir = sheet.getDirection(skater.state, skater.direction);
  if (dir && dir.frames.length > 0) {
    skater.animation.currentFrame = dir.frames[0];
  }
}

// --- Input plumbing ---------------------------------------------------------
function setControlsEngaged(active) {
  inputState.engaged = active;
  if (!active) {
    Object.keys(inputState.keys).forEach((key) => {
      inputState.keys[key] = false;
    });
    inputState.vector.x = 0;
    inputState.vector.y = 0;
  }
}

function updateInputVector() {
  const x = (inputState.keys.right ? 1 : 0) - (inputState.keys.left ? 1 : 0);
  const y = (inputState.keys.down ? 1 : 0) - (inputState.keys.up ? 1 : 0);
  const length = Math.hypot(x, y);
  if (length === 0) {
    inputState.vector.x = 0;
    inputState.vector.y = 0;
  } else {
    inputState.vector.x = x / length;
    inputState.vector.y = y / length;
  }
}

function handleDirectionalKey(key, isDown) {
  const direction = KEY_TO_DIRECTION[key];
  if (!direction) return false;
  inputState.keys[direction] = isDown;
  updateInputVector();
  return true;
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (!inputState.engaged) {
    return;
  }

  let handled = false;
  if (key === 'escape') {
    setControlsEngaged(false);
    if (canvas) canvas.blur();
    handled = true;
  } else if (key === 'enter') {
    inputState.actions.enterPressed = true;
    handled = true;
  } else if (key === ' ' || key === 'space') {
    inputState.actions.spacePressed = true;
    handled = true;
  } else if (key === 'p') {
    inputState.actions.shootPressed = true;
    handled = true;
  } else {
    handled = handleDirectionalKey(key, true);
  }

  if (handled) {
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  if (!inputState.engaged) return;
  if (key === 'enter' || key === ' ' || key === 'space' || key === 'p') return; // handled on keydown only
  if (handleDirectionalKey(key, false)) {
    event.preventDefault();
  }
}

if (canvas) {
  canvas.addEventListener('focus', () => setControlsEngaged(true));
  canvas.addEventListener('blur', () => setControlsEngaged(false));
}
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

function primeCanvasFocus() {
  if (!canvas) return;
  setControlsEngaged(true);
  canvas.focus({ preventScroll: true });
}

if (document.readyState === 'complete') {
  primeCanvasFocus();
} else {
  window.addEventListener('load', primeCanvasFocus, { once: true });
}

function toggleInstructionsOverlay(forceState) {
  if (!instructionsOverlay) return;
  const shouldMinimize =
    typeof forceState === 'boolean'
      ? forceState
      : !instructionsOverlay.classList.contains('minimized');
  instructionsOverlay.classList.toggle('minimized', shouldMinimize);
}

if (instructionsOverlay) {
  instructionsOverlay.addEventListener('click', (event) => {
    const isClose = event.target.classList.contains('instructions-overlay__close');
    if (instructionsOverlay.classList.contains('minimized')) {
      toggleInstructionsOverlay(false);
      return;
    }
    if (isClose) {
      toggleInstructionsOverlay(true);
      event.stopPropagation();
    } else {
      toggleInstructionsOverlay(true);
    }
  });
}

function populateSpriteSelect(variants) {
  if (!spriteSelect || !variants) return;
  spriteSelect.innerHTML = '';
  variants.forEach((variant) => {
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.label;
    spriteSelect.appendChild(option);
  });

  spriteSelect.addEventListener('change', (event) => {
    setSpriteVariantById(event.target.value);
  });
}

function populateNpcCountSelect(totalNpcCount) {
  if (!npcCountSelect) return;
  const initialValue = parseInt(npcCountSelect.value, 10);
  if (Number.isNaN(initialValue)) {
    npcCountSelect.value = String(Math.min(totalNpcCount, MAX_NPC_COUNT));
  }
  const handler = () => {
    const count = parseInt(npcCountSelect.value, 10);
    applyNpcLimit(count);
  };
  if (!npcCountSelect.dataset.bound) {
    npcCountSelect.dataset.bound = 'true';
    npcCountSelect.addEventListener('change', handler);
  }
  handler();
}

function populateNpcSpriteSelect(variants) {
  if (!npcSpriteSelect || !variants) return;
  npcSpriteSelect.innerHTML = '';
  variants.forEach((variant) => {
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.label;
    npcSpriteSelect.appendChild(option);
  });
  npcSpriteSelect.addEventListener('change', () => {
    const variantId = npcSpriteSelect.value;
    updateNpcSprites(variantId);
  });
}

function updateScoreboard() {
  if (scorePlayerEl) {
    scorePlayerEl.textContent = String(game.score.player);
  }
  if (scoreOpponentEl) {
    scoreOpponentEl.textContent = String(game.score.opponent);
  }
}

async function setSpriteVariantById(variantId) {
  if (!game.spriteVariants || game.spriteVariants.length === 0) return;
    const variant = game.spriteVariants.find((entry) => entry.id === variantId);
  if (!variant || game.spriteVariant?.id === variant.id) return;

  const requestId = ++spriteVariantLoadToken;
  try {
    const { base, puck } = await getVariantSpriteSheets(variant);
    if (requestId !== spriteVariantLoadToken) return;
    game.spriteSheet = base;
    game.spriteVariant = variant;
    if (game.player) {
      game.player.spriteSheet = base;
      game.player.puckSpriteSheet = puck;
      resetSkaterAnimation(game.player, game.spriteSheet);
    }
    if (game.npcs && game.npcs.length) {
      game.npcs.forEach((npc) => {
        const npcVariant = variant.id === npc.variantId ? variant : game.spriteVariantsById?.[npc.variantId];
        if (!npcVariant) return;
        getVariantSpriteSheets(npcVariant).then((sheets) => {
          npc.spriteSheet = sheets.base;
          resetSkaterAnimation(npc, npc.spriteSheet);
        });
      });
    }
  } catch (error) {
    console.error(error);
    if (statusEl) {
      statusEl.textContent = 'Failed to load sprite variant';
      statusEl.removeAttribute('hidden');
    }
  }
}

// --- Runtime object factories ----------------------------------------------
function createSkater({
  id = 'skater',
  world,
  spriteSheet,
  puckSpriteSheet = null,
  controlSource,
  physics = PLAYER_PHYSICS,
  radius = PLAYER_COLLISION_RADIUS,
  scale = PLAYER_SCALE_FACTOR,
  behavior = 'player',
  hitbox = null,
  bounds = ICE_BOUNDS,
}) {
  const skater = {
    id,
    type: 'skater',
    position: { x: world.width / 2, y: world.height / 2 },
    velocity: { x: 0, y: 0 },
    heading: -Math.PI / 2, // facing up rink
    targetHeading: -Math.PI / 2,
    state: 'idle',
    direction: 'N',
    radius,
    scale,
    controlSource: controlSource || (() => ZERO_VECTOR),
    spriteSheet,
    puckSpriteSheet,
    physics,
    behavior,
    hitbox,
    bounds,
    animation: {
      frameIndex: 0,
      elapsed: 0,
      currentFrame: 0,
    },
  };

  if (spriteSheet) {
    const dir = spriteSheet.getDirection(skater.state, skater.direction);
    if (dir && dir.frames.length > 0) {
      skater.animation.currentFrame = dir.frames[0];
    }
  }

  clampEntityToBounds(skater, bounds);
  return skater;
}

function resolveSkaterSpriteSheet(skater) {
  if (!skater) return null;
  if (
    skater === game.player &&
    game.puck &&
    game.puck.state === 'possessed' &&
    game.puck.owner === game.player &&
    skater.puckSpriteSheet
  ) {
    return skater.puckSpriteSheet;
  }
  return skater.spriteSheet;
}

async function loadNpcSkaters(npcConfig, variantIndex, world, bounds) {
  if (!npcConfig || !Array.isArray(npcConfig.players)) return [];
  const skaters = [];
  for (const npcDef of npcConfig.players) {
    const variant = variantIndex[npcDef.spriteVariant];
    if (!variant) {
      console.warn(`NPC "${npcDef.id}" references missing sprite variant "${npcDef.spriteVariant}".`);
      continue;
    }
    try {
      const sheets = await getVariantSpriteSheets(variant);
      const npc = createSkater({
        id: npcDef.id,
        world,
        spriteSheet: sheets.base,
        puckSpriteSheet: null,
        controlSource: () => ZERO_VECTOR,
        radius: npcDef.hitbox?.radius ?? PLAYER_COLLISION_RADIUS,
        behavior: 'npc-static',
        hitbox: npcDef.hitbox || null,
        bounds,
      });
      npc.position.x = npcDef.position?.x ?? npc.position.x;
      npc.position.y = npcDef.position?.y ?? npc.position.y;
      npc.state = npcDef.state || npc.state;
      npc.direction = npcDef.direction || npc.direction;
      npc.baseState = npc.state;
      npc.baseDirection = npc.direction;
      npc.variantId = npcDef.spriteVariant;
      clampEntityToBounds(npc, bounds || ICE_BOUNDS);
      resetSkaterAnimation(npc, npc.spriteSheet);
      skaters.push(npc);
    } catch (error) {
      console.error(`Failed to load NPC sprite for ${npcDef.id}:`, error);
    }
  }
  return skaters;
}

function createCamera(world) {
  return {
    width: CAMERA_VIEW.width,
    height: CAMERA_VIEW.height,
    position: { x: world.width / 2, y: world.height / 2 },
    view: { left: 0, top: 0 },
  };
}

function clampCamera(camera, world) {
  const halfW = camera.width / 2;
  const halfH = camera.height / 2;

  if (world.width <= camera.width) {
    camera.position.x = world.width / 2;
    camera.view.left = 0;
  } else {
    camera.position.x = clamp(camera.position.x, halfW, world.width - halfW);
    camera.view.left = camera.position.x - halfW;
  }

  if (world.height <= camera.height) {
    camera.position.y = world.height / 2;
    camera.view.top = 0;
  } else {
    camera.position.y = clamp(camera.position.y, halfH, world.height - halfH);
    camera.view.top = camera.position.y - halfH;
  }
}

function clampSkaterToBounds(skater, bounds) {
  const radius = skater.radius ?? PLAYER_COLLISION_RADIUS;
  const leftLimit = bounds.left + radius;
  const rightLimit = bounds.right - radius;
  const topLimit = bounds.top + radius;
  const bottomLimit = bounds.bottom - radius;

  skater.position.x = clamp(skater.position.x, leftLimit, rightLimit);
  skater.position.y = clamp(skater.position.y, topLimit, bottomLimit);
}

function clampEntityToBounds(entity, bounds) {
  if (!entity || !bounds) return;
  const radius = entity.radius ?? PLAYER_COLLISION_RADIUS;
  entity.position.x = clamp(entity.position.x, bounds.left + radius, bounds.right - radius);
  entity.position.y = clamp(entity.position.y, bounds.top + radius, bounds.bottom - radius);
}

function keepPlayerOutOfGoals(player, goals = GOAL_ZONES) {
  if (!player) return;
  goals.forEach((goal) => {
    const rect = goal.rect;
    const radius = player.radius || PLAYER_COLLISION_RADIUS;
    const closestX = clamp(player.position.x, rect.x, rect.x + rect.width);
    const closestY = clamp(player.position.y, rect.y, rect.y + rect.height);
    const dx = player.position.x - closestX;
    const dy = player.position.y - closestY;
    const distance = Math.hypot(dx, dy);
    if (distance < radius) {
      let nx;
      let ny;
      if (distance === 0) {
        const distTop = Math.abs(player.position.y - rect.y);
        const distBottom = Math.abs(rect.y + rect.height - player.position.y);
        const distLeft = Math.abs(player.position.x - rect.x);
        const distRight = Math.abs(rect.x + rect.width - player.position.x);
        const min = Math.min(distTop, distBottom, distLeft, distRight);
        if (min === distTop) {
          nx = 0;
          ny = -1;
        } else if (min === distBottom) {
          nx = 0;
          ny = 1;
        } else if (min === distLeft) {
          nx = -1;
          ny = 0;
        } else {
          nx = 1;
          ny = 0;
        }
      } else {
        nx = dx / distance;
        ny = dy / distance;
      }
      const overlap = radius - distance || radius;
      player.position.x += nx * overlap;
      player.position.y += ny * overlap;
      const dot = player.velocity.x * nx + player.velocity.y * ny;
      if (dot < 0) {
        player.velocity.x -= dot * nx;
        player.velocity.y -= dot * ny;
      }
    }
  });
}

// --- Physics & animation ----------------------------------------------------
function updateSkaterPhysics(skater, inputVector, deltaSeconds, physics = PLAYER_PHYSICS) {
  const isInputActive = inputVector.x !== 0 || inputVector.y !== 0;

  if (isInputActive) {
    skater.targetHeading = Math.atan2(inputVector.y, inputVector.x);
    const angleDiff = normalizeAngle(skater.targetHeading - skater.heading);
    const maxTurn = physics.TURN_RATE * deltaSeconds;
    const turnAmount = clamp(angleDiff, -maxTurn, maxTurn);
    skater.heading = normalizeAngle(skater.heading + turnAmount);

    const accel = physics.ACCELERATION * deltaSeconds;
    skater.velocity.x += Math.cos(skater.heading) * accel;
    skater.velocity.y += Math.sin(skater.heading) * accel;
  }

  const speed = vectorMagnitude(skater.velocity);
  if (speed > physics.MAX_SPEED) {
    const ratio = physics.MAX_SPEED / speed;
    skater.velocity.x *= ratio;
    skater.velocity.y *= ratio;
  }

  if (!isInputActive && speed > 0) {
    const drag = physics.FRICTION * deltaSeconds;
    const newSpeed = Math.max(0, speed - drag);
    const ratio = newSpeed / speed;
    skater.velocity.x *= ratio;
    skater.velocity.y *= ratio;
  }

  skater.position.x += skater.velocity.x * deltaSeconds;
  skater.position.y += skater.velocity.y * deltaSeconds;
}

function updateSkaterState(skater, inputVector, physics = PLAYER_PHYSICS) {
  const speed = vectorMagnitude(skater.velocity);
  const isInputActive = inputVector.x !== 0 || inputVector.y !== 0;
  const facingAngle = speed > physics.MIN_SPEED ? Math.atan2(skater.velocity.y, skater.velocity.x) : skater.heading;
  const headingDelta = Math.abs(normalizeAngle(skater.targetHeading - skater.heading));

  if (speed < physics.MIN_SPEED && !isInputActive) {
    skater.state = 'idle';
  } else if (isInputActive && headingDelta > physics.TURNING_THRESHOLD) {
    skater.state = 'turning';
  } else if (isInputActive) {
    skater.state = 'skating';
  } else {
    skater.state = 'coasting';
  }

  skater.direction = quantizeDirection(facingAngle);
}

function updateSkaterAnimation(skater, deltaMs) {
  const spriteSheet = resolveSkaterSpriteSheet(skater);
  if (!spriteSheet) return;
  const dir = spriteSheet.getDirection(skater.state, skater.direction);
  if (!dir || dir.frames.length === 0) return;
  skater.animation.elapsed += deltaMs;
  const frameDuration = dir.frameDurationMs || 100;
  if (skater.animation.elapsed >= frameDuration) {
    skater.animation.elapsed -= frameDuration;
    skater.animation.frameIndex = (skater.animation.frameIndex + 1) % dir.frames.length;
    skater.animation.currentFrame = dir.frames[skater.animation.frameIndex];
  }
}

function updateStaticNpc(npc, deltaSeconds, deltaMs) {
  if (!npc) return;
  const speed = vectorMagnitude(npc.velocity);
  if (speed > NPC_HIT_MIN_VELOCITY) {
    npc.position.x += npc.velocity.x * deltaSeconds;
    npc.position.y += npc.velocity.y * deltaSeconds;
    const drag = NPC_HIT_FRICTION * deltaSeconds;
    const newSpeed = Math.max(0, speed - drag);
    const ratio = newSpeed / speed;
    npc.velocity.x *= ratio;
    npc.velocity.y *= ratio;
    clampSkaterToBounds(npc, npc.bounds || game.iceBounds);
    npc.state = 'skating';
    npc.direction = quantizeDirection(Math.atan2(npc.velocity.y, npc.velocity.x));
  } else {
    npc.velocity.x = 0;
    npc.velocity.y = 0;
    npc.state = npc.baseState || npc.state;
    npc.direction = npc.baseDirection || npc.direction;
    resetSkaterAnimation(npc, npc.spriteSheet);
  }
  updateSkaterAnimation(npc, deltaMs);
}

function applyNpcHitFromPlayer(npc, player) {
  if (!npc || !player) return;
  const speed = vectorMagnitude(player.velocity);
  if (speed < NPC_HIT_MIN_SPEED) return;
  const impulse = Math.min(speed, PLAYER_PHYSICS.MAX_SPEED) * NPC_HIT_IMPULSE_SCALE;
  if (impulse <= 0) return;
  const dirX = player.velocity.x / speed;
  const dirY = player.velocity.y / speed;
  npc.velocity.x = dirX * impulse;
  npc.velocity.y = dirY * impulse;
  npc.state = 'skating';
  npc.direction = quantizeDirection(Math.atan2(dirY, dirX));
}

// --- Puck system ------------------------------------------------------------
function createPuck(puckConfig, puckImage, world) {
  if (!puckConfig || !puckImage || !world) return null;
  const frameSize = puckConfig.frameSize || { width: puckImage.width, height: puckImage.height };
  const origin = puckConfig.origin || { x: frameSize.width / 2, y: frameSize.height / 2 };
  const spawn = puckConfig.spawn || { x: world.width / 2, y: world.height / 2 };

  return {
    type: 'puck',
    position: { x: spawn.x, y: spawn.y },
    velocity: { x: 0, y: 0 },
    radius: puckConfig.radius ?? 20,
    state: 'free',
    owner: null,
    image: puckImage,
    width: frameSize.width,
    height: frameSize.height,
    origin,
    physics: {
      friction: puckConfig.physics?.friction ?? 600,
      maxSpeed: puckConfig.physics?.maxSpeed ?? 1400,
      stickMagnet: puckConfig.physics?.stickMagnet ?? 420,
      elasticity: puckConfig.physics?.elasticity ?? 0.35,
    },
    scale: puckConfig.scale ?? PUCK_DEFAULT_SCALE,
    stickOffset: puckConfig.stickOffset ?? PUCK_STICK_OFFSET,
  };
}

function possessPuck(puck, owner, { announce = true } = {}) {
  if (!puck || !owner) return;
  if (puck.state === 'possessed' && puck.owner === owner) return;
  puck.state = 'possessed';
  puck.owner = owner;
  const anchor = getStickAnchorPosition(owner, puck);
  puck.position.x = anchor.x;
  puck.position.y = anchor.y;
  puck.velocity.x = 0;
  puck.velocity.y = 0;
  if (owner.puckSpriteSheet) {
    resetSkaterAnimation(owner, owner.puckSpriteSheet);
  }
  if (announce) {
    flashStatus('Puck collected! Skate to a hotspot and press Enter.', 1600);
  }
}

function releasePuck(puck, owner, speed = PUCK_RELEASE_SPEED, headingOverride = null) {
  if (!puck) return;
  const hasOwner = Boolean(owner);
  puck.state = 'free';
  puck.owner = null;
  if (hasOwner) {
    const anchor = getStickAnchorPosition(owner, puck);
    puck.position.x = anchor.x;
    puck.position.y = anchor.y;
    const heading = headingOverride ?? owner.heading;
    puck.velocity.x = Math.cos(heading) * speed;
    puck.velocity.y = Math.sin(heading) * speed;
    if (owner.spriteSheet) {
      resetSkaterAnimation(owner, owner.spriteSheet);
    }
    game.lastPuckShooter = owner.id || null;
  }
}

function updatePuck(puck, player, deltaSeconds, bounds) {
  if (!puck || !bounds) return;

  if (puck.state === 'possessed' && player) {
    puck.owner = player;
    const anchor = getStickAnchorPosition(player, puck);
    puck.position.x = anchor.x;
    puck.position.y = anchor.y;
    puck.velocity.x = 0;
    puck.velocity.y = 0;
    return;
  }

  const speed = vectorMagnitude(puck.velocity);
  if (speed > puck.physics.maxSpeed) {
    const ratio = puck.physics.maxSpeed / speed;
    puck.velocity.x *= ratio;
    puck.velocity.y *= ratio;
  }

  if (speed > 0) {
    const drag = puck.physics.friction * deltaSeconds;
    const newSpeed = Math.max(0, speed - drag);
    const ratio = newSpeed / (speed || 1);
    puck.velocity.x *= ratio;
    puck.velocity.y *= ratio;
  }

  puck.position.x += puck.velocity.x * deltaSeconds;
  puck.position.y += puck.velocity.y * deltaSeconds;

  const minX = bounds.left + puck.radius;
  const maxX = bounds.right - puck.radius;
  const minY = bounds.top + puck.radius;
  const maxY = bounds.bottom - puck.radius;
  const bounce = Math.max(0, Math.min(1, puck.physics.elasticity ?? 0.25));

  if (puck.position.x < minX) {
    puck.position.x = minX;
    puck.velocity.x = Math.abs(puck.velocity.x) * bounce;
  } else if (puck.position.x > maxX) {
    puck.position.x = maxX;
    puck.velocity.x = -Math.abs(puck.velocity.x) * bounce;
  }

  if (puck.position.y < minY) {
    puck.position.y = minY;
    puck.velocity.y = Math.abs(puck.velocity.y) * bounce;
  } else if (puck.position.y > maxY) {
    puck.position.y = maxY;
    puck.velocity.y = -Math.abs(puck.velocity.y) * bounce;
  }

}

function getStickAnchorPosition(player, puck) {
  const offsetX = Math.cos(player.heading) * puck.stickOffset;
  const offsetY = Math.sin(player.heading) * puck.stickOffset;
  return {
    x: player.position.x + offsetX,
    y: player.position.y + offsetY,
  };
}

function playerCanCatchPuck(puck, player) {
  if (!puck || !player) return false;
  const dx = player.position.x - puck.position.x;
  const dy = player.position.y - puck.position.y;
  const distance = Math.hypot(dx, dy);
  const pickupRadius = (player.radius || PLAYER_COLLISION_RADIUS) + puck.radius;
  return distance <= pickupRadius;
}

function buildPuckDirectionHint(player, puck) {
  if (!puck || !player) return null;
  if (puck.state === 'possessed' && puck.owner === player) return null;
  const dx = puck.position.x - player.position.x;
  const dy = puck.position.y - player.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 5) return null;
  const angle = Math.atan2(dy, dx);
  return {
    id: 'puck-direction',
    label: 'Puck',
    color: PUCK_HINT_COLOR,
    emoji: radiansToEmoji(angle),
    distance,
  };
}

function resetPuckToCenter() {
  if (!game.puck || !game.world) return;
  const center = game.puckConfig?.spawn || { x: game.world.width / 2, y: game.world.height / 2 };
  game.puck.state = 'free';
  game.puck.owner = null;
  game.puck.position.x = center.x;
  game.puck.position.y = center.y;
  game.puck.velocity.x = 0;
  game.puck.velocity.y = 0;
  game.lastPuckShooter = null;
}

function resetPlayerToCenter() {
  if (!game.player || !game.world) return;
  const center = {
    x: game.world.width / 2,
    y: game.world.height / 2,
  };
  game.player.position.x = center.x;
  game.player.position.y = center.y;
  game.player.velocity.x = 0;
  game.player.velocity.y = 0;
  game.player.state = 'idle';
  game.player.heading = -Math.PI / 2;
  game.player.targetHeading = -Math.PI / 2;
  resetSkaterAnimation(game.player, resolveSkaterSpriteSheet(game.player));
}

function resolvePlayerNpcCollisions(player, npcs) {
  if (!player || !Array.isArray(npcs)) return;
  npcs.forEach((npc) => {
    const radius = getNpcCollisionRadius(npc);
    const dx = player.position.x - npc.position.x;
    const dy = player.position.y - npc.position.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const minDistance = (player.radius || PLAYER_COLLISION_RADIUS) + radius;
    if (distance < minDistance) {
      const overlap = minDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      player.position.x += nx * overlap;
      player.position.y += ny * overlap;
      const velocityDot = player.velocity.x * nx + player.velocity.y * ny;
      if (velocityDot < 0) {
        player.velocity.x -= velocityDot * nx;
        player.velocity.y -= velocityDot * ny;
      }
      if (overlap > 0) {
        const npcPush = overlap * NPC_SEPARATION_RATIO;
        npc.position.x -= nx * npcPush;
        npc.position.y -= ny * npcPush;
        clampSkaterToBounds(npc, npc.bounds || game.iceBounds);
      }
      applyNpcHitFromPlayer(npc, player);
    }
  });
}

async function updateNpcSprites(variantId) {
  if (!variantId || !game.allNpcs) return;
  game.currentNpcVariantId = variantId;
  const variant = game.spriteVariantsById?.[variantId];
  if (!variant) return;
  try {
    const sheets = await getVariantSpriteSheets(variant);
    game.allNpcs.forEach((npc) => {
      npc.spriteSheet = sheets.base;
      npc.variantId = variantId;
      resetSkaterAnimation(npc, npc.spriteSheet);
    });
    applyNpcLimit(parseInt(npcCountSelect?.value, 10) || game.npcs.length);
  } catch (error) {
    console.error('Failed to update NPC sprite variant:', error);
  }
}

function resolvePuckNpcCollisions(puck, npcs) {
  if (!puck || !Array.isArray(npcs)) return;
  npcs.forEach((npc) => {
    const radius = getNpcCollisionRadius(npc);
    const dx = puck.position.x - npc.position.x;
    const dy = puck.position.y - npc.position.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const minDistance = puck.radius + radius;
    if (distance < minDistance) {
      const overlap = minDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      puck.position.x += nx * overlap;
      puck.position.y += ny * overlap;
      const velocityDot = puck.velocity.x * nx + puck.velocity.y * ny;
      puck.velocity.x -= 2 * velocityDot * nx;
      puck.velocity.y -= 2 * velocityDot * ny;
      puck.velocity.x *= puck.physics.elasticity;
      puck.velocity.y *= puck.physics.elasticity;
    }
  });
}

function getNpcCollisionRadius(npc) {
  if (npc?.hitbox?.radius) return npc.hitbox.radius;
  if (npc?.hitbox?.width && npc?.hitbox?.height) {
    return Math.max(npc.hitbox.width, npc.hitbox.height) / 2;
  }
  return npc?.radius || PLAYER_COLLISION_RADIUS;
}

function cloneNpc(template, duplicateIndex = 0) {
  if (!template || !game.world) return null;
  const npc = createSkater({
    id: `${template.id}__${duplicateIndex}`,
    world: game.world,
    spriteSheet: template.spriteSheet,
    controlSource: () => ZERO_VECTOR,
    radius: template.radius,
    scale: template.scale,
    behavior: 'npc-static',
    hitbox: template.hitbox,
    bounds: game.iceBounds,
  });
  npc.variantId = template.variantId;
  npc.state = template.state;
  npc.direction = template.direction;
  npc.baseState = template.baseState || template.state;
  npc.baseDirection = template.baseDirection || template.direction;
  npc.position.x = template.position.x + duplicateIndex * 30 * (duplicateIndex % 2 === 0 ? 1 : -1);
  npc.position.y = template.position.y + duplicateIndex * 45;
  clampSkaterToBounds(npc, game.iceBounds);
  resetSkaterAnimation(npc, npc.spriteSheet);
  return npc;
}

function detectGoal(puck) {
  if (!puck) return;
  if (game.celebratingGoal) return;
  const { x, y } = puck.position;
  const zone = GOAL_ZONES.find((entry) => pointInRect(x, y, entry.rect));
  if (!zone) return;
  if (zone.scorer === 'player' && game.lastPuckShooter !== 'player') return;
  handleGoal(zone.scorer);
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

function handleGoal(team) {
  if (!game.score[team]) {
    game.score[team] = 0;
  }
  game.score[team] += 1;
  updateScoreboard();
  flashStatus('GOAL!', 2000, { emphasize: true });
  startGoalCelebration();
}

function startGoalCelebration() {
  if (game.celebratingGoal) return;
  game.celebratingGoal = true;
  game.goalCelebrationTimer = GOAL_RESPAWN_DELAY;
  if (game.player) {
    game.player.velocity.x = 0;
    game.player.velocity.y = 0;
    game.player.state = 'idle';
    resetSkaterAnimation(game.player, resolveSkaterSpriteSheet(game.player));
  }
  if (game.puck) {
    game.puck.velocity.x = 0;
    game.puck.velocity.y = 0;
  }
}

function updateGoalCelebration(deltaMs) {
  if (!game.celebratingGoal) return;
  game.goalCelebrationTimer -= deltaMs;
  if (game.goalCelebrationTimer <= 0) {
    finishGoalCelebration();
  }
}

function finishGoalCelebration() {
  game.celebratingGoal = false;
  game.goalCelebrationTimer = 0;
  resetPuckToCenter();
  resetPlayerToCenter();
}

function drainActionQueue() {
  const actions = inputState.actions;
  if (!actions) return;
  actions.enterPressed = false;
  actions.enterTriggered = false;
  actions.spacePressed = false;
  actions.spaceTriggered = false;
  actions.shootPressed = false;
  actions.shootTriggered = false;
}

// --- Hotspot system ---------------------------------------------------------
function radiansToEmoji(angleRad) {
  const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;
  if (angleDeg >= 315 || angleDeg < 45) return '→';
  if (angleDeg >= 45 && angleDeg < 135) return '↓';
  if (angleDeg >= 135 && angleDeg < 225) return '←';
  return '↑';
}

class HotspotManager {
  constructor(initialHotspots = []) {
    this.hotspots = [];
    this.active = null;
    this.setHotspots(initialHotspots);
  }

  setHotspots(hotspots = []) {
    this.hotspots = hotspots.map((spot) => ({
      ...spot,
      rect: { ...spot.rect },
      labelStyle: {
        background: 'rgba(0,0,0,0.7)',
        color: '#ffffff',
        ...(spot.labelStyle || {}),
      },
    }));
  }

  update(player) {
    if (!player) {
      this.active = null;
      return null;
    }
    const px = player.position.x;
    const py = player.position.y;
    this.active = this.hotspots.find((spot) => {
      const rect = spot.rect;
      return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
    }) || null;
    return this.active;
  }

  getDirectionHints(player) {
    if (!player) return [];
    const hints = [];
    this.hotspots.forEach((spot) => {
      if (spot === this.active) return;
      const cx = spot.rect.x + spot.rect.width / 2;
      const cy = spot.rect.y + spot.rect.height / 2;
      const dx = cx - player.position.x;
      const dy = cy - player.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) return;
      const angle = Math.atan2(dy, dx);
      hints.push({
        id: spot.id,
        label: spot.label,
        color: spot.labelStyle.color,
        emoji: radiansToEmoji(angle),
        distance,
      });
    });
    return hints.sort((a, b) => a.distance - b.distance);
  }
}

class HotspotHud {
  constructor({ root, prompt, label, action, beacons }) {
    this.root = root;
    this.promptEl = prompt;
    this.labelEl = label;
    this.actionEl = action;
    this.beaconsEl = beacons;
  }

  update(activeHotspot, hints, { canActivate = true } = {}) {
    if (!this.promptEl || !this.labelEl || !this.beaconsEl) return;

    if (activeHotspot) {
      this.labelEl.textContent = activeHotspot.label;
      this.labelEl.style.color = activeHotspot.labelStyle.color;
      this.promptEl.style.borderColor = activeHotspot.labelStyle.color;
      this.promptEl.hidden = false;
      if (this.actionEl) {
        this.actionEl.textContent = canActivate ? 'Press Enter to open' : 'Grab the puck to activate';
      }
    } else {
      this.promptEl.hidden = true;
      if (this.actionEl) {
        this.actionEl.textContent = 'Skate to a hotspot';
      }
    }

    const fragment = document.createDocumentFragment();
    (hints || []).forEach((hint) => {
      const beacon = document.createElement('div');
      beacon.className = 'hud__beacon';
      beacon.style.color = hint.color;
      beacon.textContent = `${hint.label} ${hint.emoji}`;
      fragment.appendChild(beacon);
    });
    this.beaconsEl.innerHTML = '';
    this.beaconsEl.appendChild(fragment);
  }
}

function handleHotspotActivation() {
  if (!inputState.actions.enterTriggered || !game.activeHotspot) return;
  inputState.actions.enterTriggered = false;
  if (game.puck && game.puck.state !== 'possessed') {
    flashStatus('Grab the puck to activate this hotspot.', 1500);
    return;
  }
  const destination = game.activeHotspot.destination;
  if (!destination) return;

  if (statusEl) {
    statusEl.textContent = `Opening ${game.activeHotspot.label}`;
    statusEl.removeAttribute('hidden');
  }

  window.location.href = destination;
}

function handlePuckControl() {
  if (!inputState.actions.spaceTriggered) return;
  inputState.actions.spaceTriggered = false;
  if (!game.puck || !game.player) return;

  if (game.puck.state === 'possessed') {
    releasePuck(game.puck, game.player, PUCK_RELEASE_SPEED);
    flashStatus('Puck released.', 900);
    return;
  }

  if (playerCanCatchPuck(game.puck, game.player)) {
    possessPuck(game.puck, game.player);
  } else {
    flashStatus('Skate closer to grab the puck.', 1200);
  }
}

function handlePuckShot() {
  if (!inputState.actions.shootTriggered) return;
  inputState.actions.shootTriggered = false;
  if (!game.puck || !game.player) return;
  if (game.puck.state !== 'possessed') {
    flashStatus('Grab the puck before shooting.', 1200);
    return;
  }

  const player = game.player;
  const speedVectorLength = vectorMagnitude(player.velocity);
  const heading = speedVectorLength > PLAYER_PHYSICS.MIN_SPEED ? Math.atan2(player.velocity.y, player.velocity.x) : player.heading;
  releasePuck(game.puck, player, PUCK_SHOT_SPEED, heading);
  flashStatus('Shot fired!', 1000, { emphasize: true });
}

function applyNpcLimit(count) {
  if (!Array.isArray(game.allNpcs)) {
    game.npcs = [];
    game.skaters = [game.player];
    return;
  }
  const base = game.allNpcs;
  if (!base.length || !game.world) {
    game.npcs = [];
    game.skaters = [game.player];
    return;
  }
  const requestedRaw = Number.isFinite(count) ? count : base.length;
  const requested = clamp(Math.round(requestedRaw), 0, MAX_NPC_COUNT);
  const clones = [];
  for (let i = 0; i < requested; i += 1) {
    const template = base[i % base.length];
    const duplicateIndex = Math.floor(i / base.length);
    const clone = cloneNpc(template, duplicateIndex);
    if (clone) clones.push(clone);
  }
  game.npcs = clones;
  game.skaters = [game.player, ...clones];
}

const hotspotManager = new HotspotManager();
const hotspotHud = new HotspotHud({
  root: hudRoot,
  prompt: hudPrompt,
  label: hudLabel,
  action: hudAction,
  beacons: hudBeacons,
});

// --- Rendering --------------------------------------------------------------
function render() {
  if (!game.ready || !canvas || !ctx) return;
  const { camera, rinkImage } = game;
  const viewWidth = Math.min(camera.width, game.world.width);
  const viewHeight = Math.min(camera.height, game.world.height);
  const scaleX = canvas.width / viewWidth;
  const scaleY = canvas.height / viewHeight;
  const scale = Math.min(scaleX, scaleY);
  const drawWidth = viewWidth * scale;
  const drawHeight = viewHeight * scale;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, drawWidth, drawHeight);
  ctx.clip();
  ctx.drawImage(
    rinkImage,
    camera.view.left,
    camera.view.top,
    viewWidth,
    viewHeight,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );

  if (game.activeHotspot) {
    const { rect, labelStyle } = game.activeHotspot;
    const color = labelStyle?.color || '#ffffff';
    const screenX = (rect.x - camera.view.left) * scale + offsetX;
    const screenY = (rect.y - camera.view.top) * scale + offsetY;
    ctx.fillStyle = `${color}33`;
    ctx.fillRect(screenX, screenY, rect.width * scale, rect.height * scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX, screenY, rect.width * scale, rect.height * scale);
  }

  if (game.puck) {
    renderPuck(ctx, game.puck, camera, scale, offsetX, offsetY);
  }

  const sortedSkaters = [...game.skaters].sort((a, b) => a.position.y - b.position.y);
  sortedSkaters.forEach((skater) => {
    renderSkater(ctx, skater, camera, scale, offsetX, offsetY);
  });

  ctx.restore();

  ctx.restore();
  const canActivateHotspot = !game.puck || game.puck.state === 'possessed';
  hotspotHud.update(game.activeHotspot, game.hotspotHints, { canActivate: canActivateHotspot });
}

function renderSkater(ctx, skater, camera, scale, offsetX, offsetY) {
  const spriteSheet = resolveSkaterSpriteSheet(skater);
  if (!skater || !spriteSheet) return;
  const dir = spriteSheet.getDirection(skater.state, skater.direction);
  const frameIndex = skater.animation.currentFrame ?? dir?.frames?.[0] ?? 0;
  const { sx, sy, sw, sh } = spriteSheet.getFrameRect(frameIndex);
  const screenX = (skater.position.x - camera.view.left) * scale + offsetX;
  const screenY = (skater.position.y - camera.view.top) * scale + offsetY;
  const drawScale = scale * (skater.scale || PLAYER_SCALE_FACTOR);
  const drawX = screenX - spriteSheet.origin.x * drawScale;
  const drawY = screenY - spriteSheet.origin.y * drawScale;
  ctx.drawImage(
    spriteSheet.image,
    sx,
    sy,
    sw,
    sh,
    drawX,
    drawY,
    sw * drawScale,
    sh * drawScale
  );
}

function renderPuck(ctx, puck, camera, scale, offsetX, offsetY) {
  if (!puck || !puck.image) return;
  const screenX = (puck.position.x - camera.view.left) * scale + offsetX;
  const screenY = (puck.position.y - camera.view.top) * scale + offsetY;
  const drawScale = scale * (puck.scale || PUCK_DEFAULT_SCALE);
  const drawX = screenX - puck.origin.x * drawScale;
  const drawY = screenY - puck.origin.y * drawScale;
  ctx.drawImage(
    puck.image,
    0,
    0,
    puck.width,
    puck.height,
    drawX,
    drawY,
    puck.width * drawScale,
    puck.height * drawScale
  );
}

// --- Update loop ------------------------------------------------------------
function update(deltaMs) {
  if (!game.ready) return;
  const deltaSeconds = deltaMs / 1000;

  if (game.celebratingGoal) {
    updateGoalCelebration(deltaMs);
    drainActionQueue();
    return;
  }

  game.skaters.forEach((skater) => {
    if (skater.behavior === 'npc-static') {
      updateStaticNpc(skater, deltaSeconds, deltaMs);
      return;
    }
    const controlVector = skater.controlSource ? skater.controlSource() : ZERO_VECTOR;
    updateSkaterPhysics(skater, controlVector, deltaSeconds, skater.physics);
    clampSkaterToBounds(skater, game.iceBounds);
    updateSkaterState(skater, controlVector, skater.physics);
    updateSkaterAnimation(skater, deltaMs);
  });

  if (game.puck) {
    updatePuck(game.puck, game.player, deltaSeconds, game.iceBounds);
  }

  keepPlayerOutOfGoals(game.player, GOAL_ZONES);
  resolvePlayerNpcCollisions(game.player, game.npcs);
  if (game.puck && game.puck.state === 'free') {
    resolvePuckNpcCollisions(game.puck, game.npcs);
    detectGoal(game.puck);
  }

  game.camera.position.x = game.player.position.x;
  game.camera.position.y = game.player.position.y;
  clampCamera(game.camera, game.world);

  if (game.hotspotManager) {
    game.activeHotspot = game.hotspotManager.update(game.player);
    game.hotspotHints = game.hotspotManager.getDirectionHints(game.player);
  } else {
    game.activeHotspot = null;
    game.hotspotHints = [];
  }

  const puckHint = buildPuckDirectionHint(game.player, game.puck);
  if (puckHint) {
    game.hotspotHints = [puckHint, ...(game.hotspotHints || [])];
  }

  if (inputState.actions.enterPressed) {
    inputState.actions.enterPressed = false;
    inputState.actions.enterTriggered = true;
  }

  if (inputState.actions.spacePressed) {
    inputState.actions.spacePressed = false;
    inputState.actions.spaceTriggered = true;
  }

  if (inputState.actions.shootPressed) {
    inputState.actions.shootPressed = false;
    inputState.actions.shootTriggered = true;
  }

  handleHotspotActivation();
  handlePuckControl();
  handlePuckShot();
}

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);
  if (!game.ready) return;
  if (!lastTime) {
    lastTime = timestamp;
  }
  let frameTime = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += frameTime;

  let updates = 0;
  while (accumulator >= FIXED_TIME_STEP && updates < MAX_UPDATES_PER_FRAME) {
    update(FIXED_TIME_STEP);
    accumulator -= FIXED_TIME_STEP;
    updates += 1;
  }

  render();
}

// --- Bootstrap --------------------------------------------------------------
function updateNavCurrent() {
  if (!navLinks.length) return;
  const current = normalizePath(window.location.pathname);
  navLinks.forEach((link) => {
    const linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
    if (linkPath === current) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function updateKeyboardNotice() {
  if (!touchNotice) return;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const limitedKeyboard = coarsePointer || navigator.maxTouchPoints > 0;
  touchNotice.hidden = !limitedKeyboard;
}

async function bootstrap() {
  updateNavCurrent();
  updateKeyboardNotice();

  if (window.matchMedia) {
    const mq = window.matchMedia('(pointer: coarse)');
    if (mq.addEventListener) {
      mq.addEventListener('change', updateKeyboardNotice);
    } else if (mq.addListener) {
      mq.addListener(updateKeyboardNotice);
    }
  }

  if (!canvas || !ctx || !statusEl) {
    return;
  }

  try {
    const [spritesConfig, hotspotsConfig, puckConfig, npcConfig] = await Promise.all([
      loadJSON('assets/config/sprites.json'),
      loadJSON('assets/config/hotspots.json'),
      loadJSON('assets/config/puck.json'),
      loadJSON('assets/config/npcs.json'),
    ]);

    const [rinkImage, puckImage] = await Promise.all([
      loadImage('assets/rink_map_template_no_lines.png'),
      loadImage(puckConfig.sprite),
    ]);

    const spriteVariants = normalizeSpriteVariants(spritesConfig);
    if (spriteVariants.length === 0) {
      throw new Error('No sprite variants defined.');
    }
    game.spriteVariants = spriteVariants;
    const variantIndex = spriteVariants.reduce((acc, entry) => {
      acc[entry.id] = entry;
      return acc;
    }, {});
    game.spriteVariantsById = variantIndex;

    const initialVariant = spriteVariants[0];
    const { base: spriteSheet, puck: puckSpriteSheet } = await getVariantSpriteSheets(initialVariant);
    const world = {
      width: hotspotsConfig.canvas.width,
      height: hotspotsConfig.canvas.height,
    };

    hotspotManager.setHotspots(hotspotsConfig.hotspots);
    game.hotspotManager = hotspotManager;
    game.world = world;
    game.rinkImage = alignRinkImageToWorld(rinkImage, world);
    game.spriteSheet = spriteSheet;
    game.spriteVariant = initialVariant;
    game.puckConfig = puckConfig;
    game.npcConfig = npcConfig;
    const player = createSkater({
      id: 'player',
      world,
      spriteSheet,
      puckSpriteSheet,
      controlSource: () => inputState.vector,
    });
    game.player = player;
    let allNpcs = [];
    try {
      allNpcs = await loadNpcSkaters(npcConfig, variantIndex, world, ICE_BOUNDS);
    } catch (error) {
      console.error('Failed to load NPC skaters:', error);
    }
    game.allNpcs = allNpcs;
    applyNpcLimit(parseInt(npcCountSelect?.value, 10) || allNpcs.length);
    const puck = createPuck(puckConfig, puckImage, world);
    game.puck = puck;
    game.camera = createCamera(world);
    clampCamera(game.camera, world);
    game.ready = true;

    reportMissingNpcVariants(npcConfig, spriteVariants);

    if (spriteSelect) {
      populateSpriteSelect(spriteVariants);
      spriteSelect.value = initialVariant.id;
    }
    if (npcCountSelect) {
      populateNpcCountSelect(game.allNpcs.length || 0);
    }
    if (npcSpriteSelect) {
      populateNpcSpriteSelect(spriteVariants);
      npcSpriteSelect.value = game.allNpcs[0]?.variantId || initialVariant.id;
      updateNpcSprites(npcSpriteSelect.value);
    }

    updateScoreboard();

    window.__NHL93_CONFIG__ = {
      sprites: spritesConfig,
      hotspots: hotspotsConfig,
      puck: puckConfig,
      npcs: npcConfig,
    };

    flashStatus('Ready to skate', 700, { emphasize: true });
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message;
    statusEl.classList.remove('is-ready');
  }
}

bootstrap();
requestAnimationFrame(gameLoop);
