const root = document.documentElement;
const canvas = document.querySelector('#ice-canvas');
const context = canvas.getContext('2d');
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

function randomGenerator(seed) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let output = Math.imul(value ^ (value >>> 15), 1 | value);
    output =
      (output + Math.imul(output ^ (output >>> 7), 61 | output)) ^ output;
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function drawBranch(random, startX, startY, angle, length, depth) {
  if (depth <= 0 || length < 8) return;

  const segments = Math.max(3, Math.round(length / 28));
  let x = startX;
  let y = startY;

  context.beginPath();
  context.moveTo(x, y);

  for (let index = 0; index < segments; index += 1) {
    angle += (random() - 0.5) * 0.42;
    const distance = length / segments;
    x += Math.cos(angle) * distance;
    y += Math.sin(angle) * distance;
    context.lineTo(x, y);

    if (depth > 1 && random() > 0.64) {
      const direction = random() > 0.5 ? 1 : -1;
      drawBranch(
        random,
        x,
        y,
        angle + direction * (0.52 + random() * 0.72),
        length * (0.25 + random() * 0.2),
        depth - 1
      );
    }
  }

  context.stroke();
}

function drawIce() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const random = randomGenerator(2430);

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  gradient.addColorStop(0.45, 'rgba(124, 176, 184, 0.16)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.lineCap = 'round';
  for (let crack = 0; crack < 15; crack += 1) {
    context.strokeStyle =
      crack % 3 === 0 ? 'rgba(36, 88, 98, 0.25)' : 'rgba(255, 255, 255, 0.58)';
    context.lineWidth = crack % 3 === 0 ? 0.7 : 1.1;
    drawBranch(
      random,
      random() * width,
      random() * height,
      random() * Math.PI * 2,
      110 + random() * Math.min(width, 360),
      3
    );
  }

  for (let mark = 0; mark < 38; mark += 1) {
    const x = random() * width;
    const y = random() * height;
    const length = 30 + random() * 150;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(
      x + length * 0.45,
      y + (random() - 0.5) * 12,
      x + length,
      y + (random() - 0.5) * 24
    );
    context.strokeStyle = 'rgba(34, 84, 94, 0.055)';
    context.lineWidth = 1 + random();
    context.stroke();
  }
}

function updateScrollProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const percentage = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  root.style.setProperty('--scroll', `${percentage}%`);
}

let pointerFrame;
function updatePointer(event) {
  if (reduceMotion) return;
  if (pointerFrame) cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => {
    root.style.setProperty('--pointer-x', `${event.clientX}px`);
    root.style.setProperty('--pointer-y', `${event.clientY}px`);
  });
}

const revealTargets = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );
  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add('is-visible'));
}

drawIce();
updateScrollProgress();
window.addEventListener('resize', drawIce);
window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('pointermove', updatePointer, { passive: true });
