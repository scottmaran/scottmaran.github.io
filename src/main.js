import { Camera } from './camera.js';
import { RINK, CAMERA } from './config.js';

const canvas = document.getElementById('rinkCanvas');
const loadingEl = document.getElementById('loading');
const hudEl = document.getElementById('hud');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;

const camera = new Camera();
const activeKeys = new Set();

let rinkBitmap = null;
let lastTimestamp = 0;
let devicePixelRatioCached = window.devicePixelRatio || 1;

init().catch((error) => {
  console.error('Failed to initialize rink preview', error);
  loadingEl.textContent = 'Failed to load rink asset.';
});

async function init() {
  resizeCanvas();
  await loadRink();
  loadingEl.hidden = true;
  camera.centerOn(RINK.WIDTH / 2, RINK.HEIGHT / 2);
  lastTimestamp = performance.now();
  requestAnimationFrame(loop);
}

async function loadRink() {
  const image = new Image();
  image.decoding = 'async';
  image.src = RINK.IMAGE_SOURCE;

  await image.decode();
  rinkBitmap = typeof createImageBitmap === 'function' ? await createImageBitmap(image) : image;
}

function resizeCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  devicePixelRatioCached = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * devicePixelRatioCached);
  canvas.height = Math.round(height * devicePixelRatioCached);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(devicePixelRatioCached, devicePixelRatioCached);

  const aspect = width / height || 1;
  camera.setViewport(aspect);
  updateHud(aspect);
}

function updateHud(aspect) {
  const { width, height } = camera.getView();
  hudEl.textContent = `Viewport ≈ ${(height / RINK.HEIGHT * 100).toFixed(1)}% of rink height (${width.toFixed(0)}×${height.toFixed(0)} world px) • Aspect ${aspect.toFixed(2)}`;
}

function loop(timestamp) {
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  update(delta);
  render();
  requestAnimationFrame(loop);
}

function update(deltaSeconds) {
  if (!activeKeys.size) return;

  let x = 0;
  let y = 0;

  if (activeKeys.has('ArrowUp') || activeKeys.has('KeyW')) y -= 1;
  if (activeKeys.has('ArrowDown') || activeKeys.has('KeyS')) y += 1;
  if (activeKeys.has('ArrowLeft') || activeKeys.has('KeyA')) x -= 1;
  if (activeKeys.has('ArrowRight') || activeKeys.has('KeyD')) x += 1;

  if (!x && !y) return;

  const length = Math.hypot(x, y);
  const normalX = x / length;
  const normalY = y / length;
  const { height } = camera.getView();
  const speed = height * CAMERA.PAN_SPEED_FACTOR;

  camera.pan(normalX * speed * deltaSeconds, normalY * speed * deltaSeconds);
}

function render() {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;

  context.clearRect(0, 0, cssWidth, cssHeight);

  if (!rinkBitmap) return;

  const view = camera.getView();
  context.drawImage(
    rinkBitmap,
    view.x,
    view.y,
    view.width,
    view.height,
    0,
    0,
    cssWidth,
    cssHeight,
  );
}

window.addEventListener('resize', () => {
  resizeCanvas();
});

document.addEventListener('keydown', (event) => {
  if (isDirectionalKey(event.code)) {
    activeKeys.add(event.code);
    event.preventDefault();
  }
});

document.addEventListener('keyup', (event) => {
  if (isDirectionalKey(event.code)) {
    activeKeys.delete(event.code);
    event.preventDefault();
  }
});

function isDirectionalKey(code) {
  return code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD';
}
