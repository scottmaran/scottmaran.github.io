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
const hudBeacons = document.querySelector('.hud__beacons');
const instructionsOverlay = document.getElementById('instructions-overlay');
const spriteSelect = document.getElementById('sprite-select');

// --- Simulation constants ---------------------------------------------------
const FIXED_TIME_STEP = 1000 / 60; // target 60 FPS update cadence (in ms)
const MAX_UPDATES_PER_FRAME = 5; // prevent spiraling if a frame stalls
const CAMERA_VIEW = { width: 1536, height: 1152 }; // slice of the rink we show
const PLAYER_SCALE_FACTOR = 3; // manual knob to keep skater readable
const PLAYER_COLLISION_RADIUS = 42; // rough hit area around the sprite torso

// Hard-coded ice bounds derived from `assets/rink_map_template.png`. The rink
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
  },
};

let lastTime = 0;
let accumulator = 0;
let spriteVariantLoadToken = 0;

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

function resetPlayerAnimation(player, spriteSheet) {
  if (!player || !spriteSheet) return;
  player.animation.frameIndex = 0;
  player.animation.elapsed = 0;
  const dir = spriteSheet.getDirection(player.state, player.direction);
  if (dir && dir.frames.length > 0) {
    player.animation.currentFrame = dir.frames[0];
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
  if (key === 'enter') return; // handled on keydown only
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

async function setSpriteVariantById(variantId) {
  if (!game.spriteVariants || game.spriteVariants.length === 0) return;
  const variant = game.spriteVariants.find((entry) => entry.id === variantId);
  if (!variant || game.spriteVariant?.id === variant.id) return;

  const requestId = ++spriteVariantLoadToken;
  try {
    const image = await loadImage(variant.sheet);
    if (requestId !== spriteVariantLoadToken) return;
    game.spriteSheet = new SpriteSheet(variant, image);
    game.spriteVariant = variant;
    resetPlayerAnimation(game.player, game.spriteSheet);
  } catch (error) {
    console.error(error);
    if (statusEl) {
      statusEl.textContent = 'Failed to load sprite variant';
      statusEl.removeAttribute('hidden');
    }
  }
}

// --- Runtime object factories ----------------------------------------------
function createPlayer(world, spriteSheet) {
  const player = {
    position: { x: world.width / 2, y: world.height / 2 },
    velocity: { x: 0, y: 0 },
    heading: -Math.PI / 2, // facing up rink
    targetHeading: -Math.PI / 2,
    state: 'idle',
    direction: 'N',
    radius: PLAYER_COLLISION_RADIUS,
    animation: {
      frameIndex: 0,
      elapsed: 0,
      currentFrame: 0,
    },
  };

  const dir = spriteSheet.getDirection(player.state, player.direction);
  if (dir && dir.frames.length > 0) {
    player.animation.currentFrame = dir.frames[0];
  }

  return player;
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

function clampPlayerToIce(player, bounds) {
  const leftLimit = bounds.left + player.radius;
  const rightLimit = bounds.right - player.radius;
  const topLimit = bounds.top + player.radius;
  const bottomLimit = bounds.bottom - player.radius;

  player.position.x = clamp(player.position.x, leftLimit, rightLimit);
  player.position.y = clamp(player.position.y, topLimit, bottomLimit);
}

// --- Physics & animation ----------------------------------------------------
function updatePlayerPhysics(player, inputVector, deltaSeconds) {
  const isInputActive = inputVector.x !== 0 || inputVector.y !== 0;

  if (isInputActive) {
    player.targetHeading = Math.atan2(inputVector.y, inputVector.x);
    const angleDiff = normalizeAngle(player.targetHeading - player.heading);
    const maxTurn = PLAYER_PHYSICS.TURN_RATE * deltaSeconds;
    const turnAmount = clamp(angleDiff, -maxTurn, maxTurn);
    player.heading = normalizeAngle(player.heading + turnAmount);

    const accel = PLAYER_PHYSICS.ACCELERATION * deltaSeconds;
    player.velocity.x += Math.cos(player.heading) * accel;
    player.velocity.y += Math.sin(player.heading) * accel;
  }

  const speed = vectorMagnitude(player.velocity);
  if (speed > PLAYER_PHYSICS.MAX_SPEED) {
    const ratio = PLAYER_PHYSICS.MAX_SPEED / speed;
    player.velocity.x *= ratio;
    player.velocity.y *= ratio;
  }

  if (!isInputActive && speed > 0) {
    const drag = PLAYER_PHYSICS.FRICTION * deltaSeconds;
    const newSpeed = Math.max(0, speed - drag);
    const ratio = newSpeed / speed;
    player.velocity.x *= ratio;
    player.velocity.y *= ratio;
  }

  player.position.x += player.velocity.x * deltaSeconds;
  player.position.y += player.velocity.y * deltaSeconds;
}

function updatePlayerState(player, inputVector) {
  const speed = vectorMagnitude(player.velocity);
  const isInputActive = inputVector.x !== 0 || inputVector.y !== 0;
  const facingAngle = speed > PLAYER_PHYSICS.MIN_SPEED ? Math.atan2(player.velocity.y, player.velocity.x) : player.heading;
  const headingDelta = Math.abs(normalizeAngle(player.targetHeading - player.heading));

  if (speed < PLAYER_PHYSICS.MIN_SPEED && !isInputActive) {
    player.state = 'idle';
  } else if (isInputActive && headingDelta > PLAYER_PHYSICS.TURNING_THRESHOLD) {
    player.state = 'turning';
  } else if (isInputActive) {
    player.state = 'skating';
  } else {
    player.state = 'coasting';
  }

  player.direction = quantizeDirection(facingAngle);
}

function updatePlayerAnimation(player, spriteSheet, deltaMs) {
  const dir = spriteSheet.getDirection(player.state, player.direction);
  if (!dir || dir.frames.length === 0) return;
  player.animation.elapsed += deltaMs;
  const frameDuration = dir.frameDurationMs || 100;
  if (player.animation.elapsed >= frameDuration) {
    player.animation.elapsed -= frameDuration;
    player.animation.frameIndex = (player.animation.frameIndex + 1) % dir.frames.length;
    player.animation.currentFrame = dir.frames[player.animation.frameIndex];
  }
}

// --- Hotspot system ---------------------------------------------------------
function radiansToEmoji(angleRad) {
  const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;
  if (angleDeg >= 315 || angleDeg < 45) return '→';
  if (angleDeg >= 45 && angleDeg < 135) return '↑';
  if (angleDeg >= 135 && angleDeg < 225) return '←';
  return '↓';
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
  constructor({ root, prompt, label, beacons }) {
    this.root = root;
    this.promptEl = prompt;
    this.labelEl = label;
    this.beaconsEl = beacons;
  }

  update(activeHotspot, hints) {
    if (!this.promptEl || !this.labelEl || !this.beaconsEl) return;

    if (activeHotspot) {
      this.labelEl.textContent = activeHotspot.label;
      this.labelEl.style.color = activeHotspot.labelStyle.color;
      this.promptEl.style.borderColor = activeHotspot.labelStyle.color;
      this.promptEl.hidden = false;
    } else {
      this.promptEl.hidden = true;
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
  const destination = game.activeHotspot.destination;
  if (!destination) return;

  if (statusEl) {
    statusEl.textContent = `Opening ${game.activeHotspot.label}`;
    statusEl.removeAttribute('hidden');
  }

  window.location.href = destination;
}

const hotspotManager = new HotspotManager();
const hotspotHud = new HotspotHud({
  root: hudRoot,
  prompt: hudPrompt,
  label: hudLabel,
  beacons: hudBeacons,
});

// --- Rendering --------------------------------------------------------------
function render() {
  if (!game.ready || !canvas || !ctx) return;
  const { camera, rinkImage, spriteSheet, player } = game;
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

  if (spriteSheet && player) {
    const dir = spriteSheet.getDirection(player.state, player.direction);
    const frameIndex = player.animation.currentFrame ?? dir?.frames?.[0] ?? 0;
    const { sx, sy, sw, sh } = spriteSheet.getFrameRect(frameIndex);
    const screenX = (player.position.x - camera.view.left) * scale + offsetX;
    const screenY = (player.position.y - camera.view.top) * scale + offsetY;
    const playerScale = scale * PLAYER_SCALE_FACTOR;
    const drawX = screenX - spriteSheet.origin.x * playerScale;
    const drawY = screenY - spriteSheet.origin.y * playerScale;
    ctx.drawImage(
      spriteSheet.image,
      sx,
      sy,
      sw,
      sh,
      drawX,
      drawY,
      sw * playerScale,
      sh * playerScale
    );
  }

  ctx.restore();
  hotspotHud.update(game.activeHotspot, game.hotspotHints);
}

// --- Update loop ------------------------------------------------------------
function update(deltaMs) {
  if (!game.ready) return;
  const deltaSeconds = deltaMs / 1000;
  updatePlayerPhysics(game.player, inputState.vector, deltaSeconds);
  clampPlayerToIce(game.player, game.iceBounds);
  updatePlayerState(game.player, inputState.vector);
  updatePlayerAnimation(game.player, game.spriteSheet, deltaMs);

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

  if (inputState.actions.enterPressed) {
    inputState.actions.enterPressed = false;
    inputState.actions.enterTriggered = true;
  }

  handleHotspotActivation();
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
    const [spritesConfig, hotspotsConfig, rinkImage] = await Promise.all([
      loadJSON('assets/config/sprites.json'),
      loadJSON('assets/config/hotspots.json'),
      loadImage('assets/rink_map_template.png'),
    ]);

    const spriteVariants = normalizeSpriteVariants(spritesConfig);
    if (spriteVariants.length === 0) {
      throw new Error('No sprite variants defined.');
    }
    game.spriteVariants = spriteVariants;
    const initialVariant = spriteVariants[0];
    const spriteSheetImage = await loadImage(initialVariant.sheet);
    const spriteSheet = new SpriteSheet(initialVariant, spriteSheetImage);
    const world = {
      width: hotspotsConfig.canvas.width,
      height: hotspotsConfig.canvas.height,
    };

    hotspotManager.setHotspots(hotspotsConfig.hotspots);
    game.hotspotManager = hotspotManager;
    game.world = world;
    game.rinkImage = rinkImage;
    game.spriteSheet = spriteSheet;
    game.spriteVariant = initialVariant;
    game.player = createPlayer(world, spriteSheet);
    game.camera = createCamera(world);
    clampCamera(game.camera, world);
    game.ready = true;

    if (spriteSelect) {
      populateSpriteSelect(spriteVariants);
      spriteSelect.value = initialVariant.id;
    }

    window.__NHL93_CONFIG__ = { sprites: spritesConfig, hotspots: hotspotsConfig };

    statusEl.textContent = 'Ready to skate';
    statusEl.classList.add('is-ready');
    setTimeout(() => statusEl.setAttribute('hidden', 'hidden'), 500);
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message;
    statusEl.classList.remove('is-ready');
  }
}

bootstrap();
requestAnimationFrame(gameLoop);
