const canvas = document.getElementById('rink-canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
const statusEl = document.querySelector('.canvas-status');
const touchNotice = document.querySelector('.no-keyboard');
const navLinks = document.querySelectorAll('.site-header nav a');

const FIXED_TIME_STEP = 1000 / 60;
const MAX_UPDATES_PER_FRAME = 5;
const CAMERA_VIEW = { width: 1536, height: 1152 };
const PLAYER_SCALE_FACTOR = 3; // manual knob to keep skater readable regardless of camera zoom

let lastTime = 0;
let accumulator = 0;

const game = {
  ready: false,
  world: null,
  hotspots: [],
  camera: null,
  player: null,
  rinkImage: null,
  spriteSheet: null,
};

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

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  const stripped = pathname.replace(/index\.html$/, '').replace(/\/$/, '');
  return stripped || '/';
}

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

function createPlayer(world, spriteSheet) {
  const player = {
    position: {
      x: world.width / 2,
      y: world.height / 2,
    },
    state: 'idle',
    direction: 'N',
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
    position: {
      x: world.width / 2,
      y: world.height / 2,
    },
    view: {
      left: 0,
      top: 0,
    },
  };
}

function clampCamera(camera, world) {
  const halfW = camera.width / 2;
  const halfH = camera.height / 2;

  if (world.width <= camera.width) {
    camera.position.x = world.width / 2;
    camera.view.left = 0;
  } else {
    camera.position.x = Math.min(world.width - halfW, Math.max(halfW, camera.position.x));
    camera.view.left = camera.position.x - halfW;
  }

  if (world.height <= camera.height) {
    camera.position.y = world.height / 2;
    camera.view.top = 0;
  } else {
    camera.position.y = Math.min(world.height - halfH, Math.max(halfH, camera.position.y));
    camera.view.top = camera.position.y - halfH;
  }
}

function updatePlayer(player, spriteSheet, deltaMs) {
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

function update(deltaMs) {
  if (!game.ready) return;
  game.camera.position.x = game.player.position.x;
  game.camera.position.y = game.player.position.y;
  updatePlayer(game.player, game.spriteSheet, deltaMs);
  clampCamera(game.camera, game.world);
}

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
    const [spritesConfig, hotspotsConfig, rinkImage, spriteSheetImage] = await Promise.all([
      loadJSON('assets/config/sprites.json'),
      loadJSON('assets/config/hotspots.json'),
      loadImage('assets/rink_map_template.png'),
      loadImage('assets/sprites/skater.png'),
    ]);

    const spriteSheet = new SpriteSheet(spritesConfig, spriteSheetImage);
    const world = {
      width: hotspotsConfig.canvas.width,
      height: hotspotsConfig.canvas.height,
    };

    game.world = world;
    game.hotspots = hotspotsConfig.hotspots;
    game.rinkImage = rinkImage;
    game.spriteSheet = spriteSheet;
    game.player = createPlayer(world, spriteSheet);
    game.camera = createCamera(world);
    clampCamera(game.camera, world);
    game.ready = true;

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
