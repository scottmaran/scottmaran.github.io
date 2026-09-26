const root = document.documentElement;
const body = document.body;
const story = document.querySelector('.rink-story');
const routePath = document.querySelector('#minimal-route-path');
const routeSvg = routePath.ownerSVGElement;
const revealTargets = document.querySelectorAll('.reveal');
const playButtons = [
  document.querySelector('#play-game'),
  document.querySelector('#header-play'),
];
const playLabel = document.querySelector('#play-label');
const closeButton = document.querySelector('#close-minimal-game');
const gameStage = document.querySelector('#minimal-game');
const canvas = document.querySelector('#rink-canvas');
const gameStateLabel = document.querySelector('#game-state-label');
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

let enginePromise;
let gameVisible = false;
let lastScroll = window.scrollY;
let puckRotation = 0;
let ticking = false;
let returnFocusTarget;

function updateRoute() {
  const storyBounds = story.getBoundingClientRect();
  const storyTop = window.scrollY + storyBounds.top;
  const scrollable = Math.max(story.offsetHeight - window.innerHeight, 1);
  const storyScroll = window.scrollY - storyTop;
  const progress = Math.min(Math.max(storyScroll / scrollable, 0), 1);
  const length = routePath.getTotalLength();
  const point = routePath.getPointAtLength(length * progress);
  const bounds = routeSvg.getBoundingClientRect();
  const x = bounds.left + (point.x / 1000) * bounds.width;
  const y = bounds.top + (point.y / 1000) * bounds.height;
  const scrollDelta = window.scrollY - lastScroll;

  puckRotation += scrollDelta * 0.45;
  root.style.setProperty('--route-progress', `${progress * 100}`);
  root.style.setProperty('--puck-x', `${x}px`);
  root.style.setProperty('--puck-y', `${y}px`);
  root.style.setProperty('--puck-rotation', `${puckRotation}deg`);

  lastScroll = window.scrollY;
  ticking = false;
}

function requestRouteUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(updateRoute);
}

async function loadGame() {
  if (!enginePromise) {
    enginePromise = import('../shared/nhl93-game.js');
  }
  await enginePromise;
}

async function openGame(event) {
  if (gameVisible) return;

  gameVisible = true;
  returnFocusTarget = event.currentTarget;
  gameStage.hidden = false;
  playButtons.forEach((button) => {
    button.setAttribute('aria-pressed', 'true');
  });
  playLabel.textContent = 'Game active';
  gameStateLabel.textContent = 'Game active';

  requestAnimationFrame(() => body.classList.add('is-playing'));
  await loadGame();
  requestAnimationFrame(() => canvas.focus({ preventScroll: true }));
}

async function closeGame() {
  if (!gameVisible) return;

  if (document.fullscreenElement === gameStage) {
    await document.exitFullscreen();
  }

  gameVisible = false;
  canvas.blur();
  body.classList.remove('is-playing');
  playButtons.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
  });
  playLabel.textContent = 'Enter game mode';
  gameStateLabel.textContent = 'Rink ready';

  window.setTimeout(
    () => {
      if (!gameVisible) {
        gameStage.hidden = true;
        returnFocusTarget?.focus({ preventScroll: true });
      }
    },
    reduceMotion ? 0 : 420
  );
}

if ('IntersectionObserver' in window && !reduceMotion) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '-12% 0px -12% 0px', threshold: 0.15 }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add('is-visible'));
}

playButtons.forEach((button) => button.addEventListener('click', openGame));
closeButton.addEventListener('click', closeGame);

updateRoute();
window.addEventListener('scroll', requestRouteUpdate, { passive: true });
window.addEventListener('resize', requestRouteUpdate);
