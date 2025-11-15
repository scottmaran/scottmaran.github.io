const statusEl = document.querySelector('.canvas-status');
const canvas = document.getElementById('rink-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

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

function drawRink(rinkImage) {
  const { width, height } = canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  const scale = Math.min(width / rinkImage.width, height / rinkImage.height);
  const drawWidth = rinkImage.width * scale;
  const drawHeight = rinkImage.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  ctx.drawImage(rinkImage, offsetX, offsetY, drawWidth, drawHeight);
}

async function init() {
  try {
    const [sprites, hotspots, rinkImage] = await Promise.all([
      loadJSON('assets/config/sprites.json'),
      loadJSON('assets/config/hotspots.json'),
      loadImage('assets/rink_map_template.png'),
    ]);

    window.__NHL93_CONFIG__ = { sprites, hotspots };
    drawRink(rinkImage);

    statusEl.textContent = 'Ready to skate';
    statusEl.classList.add('is-ready');
    setTimeout(() => statusEl.setAttribute('hidden', 'hidden'), 500);
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message;
    statusEl.classList.remove('is-ready');
  }
}

init();
