const BASE_WIDTH = 960;
const BASE_HEIGHT = 600;
const HOTSPOTS = [
  {
    id: 'about',
    label: 'About',
    url: 'about.html',
    rect: { x: 700, y: 260, width: 180, height: 150 }
  },
  {
    id: 'projects',
    label: 'Projects',
    url: 'projects.html',
    rect: { x: 80, y: 260, width: 180, height: 150 }
  },
  {
    id: 'contact',
    label: 'Contact',
    url: 'contact.html',
    rect: { x: 390, y: 120, width: 200, height: 130 }
  }
];

const SKATE_PARAMS = {
  maxSpeed: 280, // px per second
  acceleration: 420,
  friction: 360,
  turnRate: Math.PI * 2.4,
  driftSlowdown: 160
};

const RINK_BOUNDS = {
  minX: 120,
  maxX: BASE_WIDTH - 120,
  minY: 110,
  maxY: BASE_HEIGHT - 60
};

const KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
};

const inputState = {
  up: false,
  down: false,
  left: false,
  right: false
};

const state = {
  ctx: null,
  scale: 1,
  dpr: 1,
  lastTime: 0,
  position: { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 },
  velocity: { x: 0, y: 0 },
  heading: -Math.PI / 2,
  desiredHeading: -Math.PI / 2,
  speed: 0,
  activeHotspot: null,
  hotspotEnteredAt: 0,
  playerSprites: null,
  rinkImage: null,
  focusLocked: false,
  hudStatusEl: null,
  focusIndicatorEl: null,
  audioToggleEl: null,
  audio: {
    prepared: false,
    enabled: false,
    crowd: null,
    glide: null,
    confirm: null
  },
  fallbackSpritePulse: 0
};

class SpriteSheet {
  constructor(image, options) {
    this.image = image;
    this.frameWidth = options.frameWidth;
    this.frameHeight = options.frameHeight;
    this.frames = options.frames;
    this.directions = options.directions || 1;
    this.frameRate = options.frameRate || 12;
    this.anchorX = options.anchorX ?? Math.floor(this.frameWidth / 2);
    this.anchorY = options.anchorY ?? Math.floor(this.frameHeight / 2);
  }

  draw(ctx, directionIndex, frameIndex, x, y) {
    const sx = frameIndex * this.frameWidth;
    const sy = directionIndex * this.frameHeight;
    ctx.drawImage(
      this.image,
      sx,
      sy,
      this.frameWidth,
      this.frameHeight,
      Math.round(x - this.anchorX),
      Math.round(y - this.anchorY),
      this.frameWidth,
      this.frameHeight
    );
  }
}

async function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    img.src = path;
  });
}

async function loadPlayerSprites() {
  try {
    const response = await fetch('assets/metadata/player.json');
    if (!response.ok) throw new Error('Metadata not found');
    const data = await response.json();
    const idleDef = data.sprites?.idle;
    const skateDef = data.sprites?.skate;
    if (!idleDef || !skateDef) throw new Error('Incomplete metadata');

    const [idleImage, skateImage] = await Promise.all([
      loadImage(idleDef.image),
      loadImage(skateDef.image)
    ]);

    return {
      idle: new SpriteSheet(idleImage, idleDef),
      skate: new SpriteSheet(skateImage, skateDef)
    };
  } catch (error) {
    console.warn('Using fallback player sprite. Reason:', error.message);
    return null;
  }
}

async function loadRinkBackground() {
  try {
    return await loadImage('assets/sprites/rink_base.png');
  } catch (error) {
    console.warn('Falling back to procedural rink. Reason:', error.message);
    return null;
  }
}

function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  state.ctx = ctx;

  const initialWidth = canvas.clientWidth || BASE_WIDTH;
  const initialScale = initialWidth / BASE_WIDTH;
  const initialHeight = BASE_HEIGHT * initialScale;
  state.dpr = window.devicePixelRatio || 1;
  state.scale = initialScale;
  canvas.style.height = `${initialHeight}px`;
  canvas.width = Math.round(initialWidth * state.dpr);
  canvas.height = Math.round(initialHeight * state.dpr);

  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const width = entry.contentRect.width || BASE_WIDTH;
      const scale = width / BASE_WIDTH;
      const height = BASE_HEIGHT * scale;
      canvas.style.height = `${height}px`;

      state.dpr = window.devicePixelRatio || 1;
      state.scale = scale;
      canvas.width = Math.round(width * state.dpr);
      canvas.height = Math.round(height * state.dpr);
    }
  });

  resizeObserver.observe(canvas);
}

function engageControls(canvas) {
  if (!state.focusLocked) {
    state.focusLocked = true;
    prepareAudio();
    canvas.focus({ preventScroll: true });
    if (state.focusIndicatorEl) state.focusIndicatorEl.hidden = false;
  }
}

function releaseControls(canvas) {
  state.focusLocked = false;
  if (state.focusIndicatorEl) state.focusIndicatorEl.hidden = true;
  canvas.blur();
  Object.keys(inputState).forEach(key => {
    inputState[key] = false;
  });
}

function handleKeyDown(event, canvas) {
  if (event.key === 'Escape' && state.focusLocked) {
    event.preventDefault();
    releaseControls(canvas);
    state.hudStatusEl.textContent = 'Focus released. Click rink or press arrows to skate again.';
    return;
  }

  if (KEY_MAP[event.key]) {
    if (!state.focusLocked) {
      engageControls(canvas);
    }
    event.preventDefault();
    inputState[KEY_MAP[event.key]] = true;
  }

  if (event.key === 'Enter' && state.focusLocked) {
    event.preventDefault();
    if (state.activeHotspot) {
      playConfirmSound();
      window.location.href = state.activeHotspot.url;
    }
  }
}

function handleKeyUp(event) {
  const key = KEY_MAP[event.key];
  if (key) {
    inputState[key] = false;
  }
}

function prepareAudio() {
  if (!state.audioToggleEl || state.audio.prepared) return;

  const crowd = new Audio('assets/audio/crowd_loop.mp3');
  crowd.loop = true;
  crowd.preload = 'auto';
  crowd.volume = 0.35;

  const glide = new Audio('assets/audio/skate_glide.mp3');
  glide.loop = true;
  glide.preload = 'auto';
  glide.volume = 0;

  const confirm = new Audio('assets/audio/menu_confirm.mp3');
  confirm.preload = 'auto';
  confirm.volume = 0.65;

  state.audio = {
    prepared: true,
    enabled: false,
    crowd,
    glide,
    confirm
  };

  const toggle = state.audioToggleEl;
  toggle.hidden = false;
  if (!toggle.dataset.listenerAttached) {
    toggle.addEventListener('click', toggleAudio);
    toggle.dataset.listenerAttached = 'true';
  }
  updateAudioToggleUI(false);
}

function toggleAudio() {
  if (!state.audio?.prepared) return;
  if (state.audio.enabled) {
    disableAudio();
  } else {
    enableAudio();
  }
}

function enableAudio() {
  if (!state.audio?.prepared) return;
  state.audio.enabled = true;
  updateAudioToggleUI(true);

  const { crowd, glide } = state.audio;
  const attempt = audio => {
    if (!audio) return;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(error => {
        console.warn('Audio playback blocked', error);
        disableAudio();
      });
    }
  };
  attempt(crowd);
  if (glide.paused) {
    attempt(glide);
    glide.volume = 0;
  }
}

function disableAudio(skipToggleUpdate = false) {
  if (!state.audio?.prepared) return;
  state.audio.enabled = false;
  if (!skipToggleUpdate) updateAudioToggleUI(false);
  pauseAndReset(state.audio.crowd);
  pauseAndReset(state.audio.glide);
  pauseAndReset(state.audio.confirm);
  if (state.audio.glide) state.audio.glide.volume = 0;
}

function updateAudioToggleUI(enabled) {
  const toggle = state.audioToggleEl;
  if (!toggle) return;
  toggle.textContent = enabled ? '🔊' : '🔇';
  toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  toggle.title = enabled ? 'Mute rink audio' : 'Enable rink audio';
}

function pauseAndReset(audio) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function updateSkateAudio() {
  if (!state.audio?.enabled || !state.audio.glide) return;
  const maxVolume = 0.65;
  const normalized = clamp(state.speed / SKATE_PARAMS.maxSpeed, 0, 1);
  const target = normalized > 0.1 ? normalized * maxVolume : 0;
  const current = state.audio.glide.volume;
  state.audio.glide.volume = current + (target - current) * 0.2;
}

function playConfirmSound() {
  if (!state.audio?.enabled || !state.audio.confirm) return;
  state.audio.confirm.currentTime = 0;
  const playPromise = state.audio.confirm.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function updateHud(activeHotspot) {
  if (!state.hudStatusEl) return;
  if (activeHotspot) {
    state.hudStatusEl.textContent = `Press Enter to open ${activeHotspot.label}`;
  } else {
    state.hudStatusEl.textContent = 'Skate to a section.';
  }
}

function applyPhysics(dt) {
  const inputVector = {
    x: (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0),
    y: (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0)
  };

  const inputActive = inputVector.x !== 0 || inputVector.y !== 0;

  if (inputActive) {
    const len = Math.hypot(inputVector.x, inputVector.y);
    inputVector.x /= len;
    inputVector.y /= len;
    state.desiredHeading = Math.atan2(inputVector.y, inputVector.x);

    const angleDiff = shortestAngle(state.heading, state.desiredHeading);
    const maxTurn = SKATE_PARAMS.turnRate * dt;
    const turnAmount = clamp(angleDiff, -maxTurn, maxTurn);
    state.heading += turnAmount;

    state.velocity.x += Math.cos(state.heading) * SKATE_PARAMS.acceleration * dt;
    state.velocity.y += Math.sin(state.heading) * SKATE_PARAMS.acceleration * dt;
  } else {
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    if (speed > 0) {
      const slow = Math.min(speed, SKATE_PARAMS.friction * dt);
      const ratio = (speed - slow) / speed;
      state.velocity.x *= ratio;
      state.velocity.y *= ratio;
    }
  }

  const speed = Math.hypot(state.velocity.x, state.velocity.y);
  if (speed > SKATE_PARAMS.maxSpeed) {
    const scale = SKATE_PARAMS.maxSpeed / speed;
    state.velocity.x *= scale;
    state.velocity.y *= scale;
  }

  state.speed = Math.hypot(state.velocity.x, state.velocity.y);
  state.position.x += state.velocity.x * dt;
  state.position.y += state.velocity.y * dt;

  clampPositionToBounds();
}

function shortestAngle(current, target) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampPositionToBounds() {
  const { position, velocity } = state;
  if (position.x < RINK_BOUNDS.minX) {
    position.x = RINK_BOUNDS.minX;
    if (velocity.x < 0) velocity.x = 0;
  } else if (position.x > RINK_BOUNDS.maxX) {
    position.x = RINK_BOUNDS.maxX;
    if (velocity.x > 0) velocity.x = 0;
  }

  if (position.y < RINK_BOUNDS.minY) {
    position.y = RINK_BOUNDS.minY;
    if (velocity.y < 0) velocity.y = 0;
  } else if (position.y > RINK_BOUNDS.maxY) {
    position.y = RINK_BOUNDS.maxY;
    if (velocity.y > 0) velocity.y = 0;
  }
}

function detectHotspots(time) {
  const { position } = state;
  let active = null;
  for (const hotspot of HOTSPOTS) {
    const { x, y, width, height } = hotspot.rect;
    if (position.x >= x && position.x <= x + width && position.y >= y && position.y <= y + height) {
      active = hotspot;
      if (state.activeHotspot?.id !== hotspot.id) {
        state.hotspotEnteredAt = time;
      }
      break;
    }
  }
  state.activeHotspot = active;
  updateHud(active);
}

function render(timestamp) {
  const ctx = state.ctx;
  if (!ctx) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();

  const scale = state.scale * state.dpr;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  drawRink(ctx);
  drawHotspots(ctx, timestamp);
  drawPlayer(ctx, timestamp);
}

function drawRink(ctx) {
  if (state.rinkImage) {
    ctx.drawImage(state.rinkImage, 0, 0, BASE_WIDTH, BASE_HEIGHT);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
  gradient.addColorStop(0, '#e3f0ff');
  gradient.addColorStop(1, '#c5ddff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(40, 40, BASE_WIDTH - 80, BASE_HEIGHT - 80, 160);
  ctx.stroke();

  ctx.strokeStyle = '#d81e05';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(BASE_WIDTH / 2, 40);
  ctx.lineTo(BASE_WIDTH / 2, BASE_HEIGHT - 40);
  ctx.stroke();

  ctx.strokeStyle = '#0038a8';
  ctx.lineWidth = 4;
  const blueLineOffset = 170;
  ctx.beginPath();
  ctx.moveTo(40 + blueLineOffset, 40);
  ctx.lineTo(40 + blueLineOffset, BASE_HEIGHT - 40);
  ctx.moveTo(BASE_WIDTH - 40 - blueLineOffset, 40);
  ctx.lineTo(BASE_WIDTH - 40 - blueLineOffset, BASE_HEIGHT - 40);
  ctx.stroke();

  ctx.strokeStyle = '#d81e05';
  ctx.beginPath();
  ctx.arc(BASE_WIDTH / 2, BASE_HEIGHT / 2, 60, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHotspots(ctx, timestamp) {
  ctx.font = '22px "NHL94", "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const hotspot of HOTSPOTS) {
    const { x, y, width, height } = hotspot.rect;
    const isActive = state.activeHotspot?.id === hotspot.id;
    const pulse = isActive ? (1 + Math.sin((timestamp - state.hotspotEnteredAt) / 110)) / 2 : 0;
    const glow = isActive ? 0.55 + pulse * 0.25 : 0.35;

    ctx.save();
    ctx.globalAlpha = isActive ? 0.85 + glow * 0.1 : 0.85;
    ctx.fillStyle = isActive ? 'rgba(8, 12, 32, 0.95)' : 'rgba(12, 18, 38, 0.8)';
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = isActive ? '#ffd166' : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = isActive ? 5 : 3;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    ctx.restore();

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(x + 20, y + height - 18);
    ctx.lineTo(x + width - 20, y + height - 18);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = isActive ? '#ffd166' : '#f8fafc';
    ctx.shadowColor = isActive ? '#ffd166' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = isActive ? 10 + glow * 12 : 4;
    ctx.fillText(hotspot.label, x + width / 2, y + height / 2);
    ctx.restore();
  }
}

function drawPlayer(ctx, timestamp) {
  const { position, speed, playerSprites } = state;
  const directionIndex = headingToDirectionIndex(state.heading);
  const animate = speed > 20;

  if (playerSprites) {
    const sprite = animate ? playerSprites.skate : playerSprites.idle;
    const frameCount = animate ? sprite.frames : 1;
    const frameRate = animate ? sprite.frameRate : 1;
    const frame = animate ? Math.floor((timestamp / (1000 / frameRate)) % frameCount) : 0;
    const dirIndex = animate ? directionIndex % sprite.directions : 0;
    sprite.draw(ctx, dirIndex, frame, position.x, position.y);
  } else {
    // Simple fallback marker if sprites are missing
    state.fallbackSpritePulse += (state.speed > 10 ? 0.3 : 0.1);
    const bob = Math.sin(state.fallbackSpritePulse) * (state.speed > 10 ? 4 : 2);
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.ellipse(position.x, position.y + 18, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(position.x, position.y + bob);
    ctx.rotate(state.heading + Math.PI / 2);
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-16, 18);
    ctx.lineTo(16, 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-6, -24, 12, 18);
    ctx.restore();
  }
}

function headingToDirectionIndex(angle) {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const octant = Math.round(normalized / (Math.PI / 4)) % 8;
  return octant;
}

function tick(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.033);
  state.lastTime = timestamp;

  if (state.focusLocked) {
    applyPhysics(dt);
  } else {
    // Apply light drift decay when not focused so player gently slows down
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    if (speed > 0) {
      const slow = Math.min(speed, SKATE_PARAMS.driftSlowdown * dt);
      const ratio = (speed - slow) / speed;
      state.velocity.x *= ratio;
      state.velocity.y *= ratio;
      state.position.x += state.velocity.x * dt;
      state.position.y += state.velocity.y * dt;
      clampPositionToBounds();
      state.speed = Math.hypot(state.velocity.x, state.velocity.y);
    }
  }

  updateSkateAudio();
  detectHotspots(timestamp);
  render(timestamp);
  requestAnimationFrame(tick);
}

async function init() {
  const canvas = document.getElementById('rink-canvas');
  const hudStatus = document.getElementById('hud-status');
  const focusIndicator = document.getElementById('focus-indicator');
  const audioToggle = document.querySelector('.audio-toggle');

  canvas.setAttribute('tabindex', '0');

  state.hudStatusEl = hudStatus;
  state.focusIndicatorEl = focusIndicator;
  state.audioToggleEl = audioToggle;

  setupCanvas(canvas);

  state.playerSprites = await loadPlayerSprites();
  state.rinkImage = await loadRinkBackground();

  canvas.addEventListener('pointerdown', () => {
    prepareAudio();
    engageControls(canvas);
  });

  canvas.addEventListener('focus', () => {
    engageControls(canvas);
    state.hudStatusEl.textContent = 'You have control. Skate with arrow keys!';
  });

  canvas.addEventListener('blur', () => {
    state.focusLocked = false;
    if (state.focusIndicatorEl) state.focusIndicatorEl.hidden = true;
  });

  window.addEventListener('keydown', event => handleKeyDown(event, canvas));
  window.addEventListener('keyup', handleKeyUp);

  requestAnimationFrame(tick);
}

window.addEventListener('DOMContentLoaded', init);
