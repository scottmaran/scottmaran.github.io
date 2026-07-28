const root = document.documentElement;
const body = document.body;
const story = document.querySelector('.rink-story');
const routePath = document.querySelector('[data-route-path]');
const routeSvg = routePath?.ownerSVGElement;
const revealTargets = document.querySelectorAll('.reveal');
const mobileNavigation = document.querySelector('.mobile-nav');
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

let routeTicking = false;

function updateRoute() {
  if (!story || !routePath || !routeSvg) return;

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

  root.style.setProperty('--route-progress', `${progress * 100}`);
  root.style.setProperty('--puck-x', `${x}px`);
  root.style.setProperty('--puck-y', `${y}px`);

  routeTicking = false;
}

function requestRouteUpdate() {
  if (routeTicking) return;
  routeTicking = true;
  requestAnimationFrame(updateRoute);
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

if (mobileNavigation) {
  mobileNavigation
    .querySelectorAll('a, button')
    .forEach((control) =>
      control.addEventListener('click', () =>
        mobileNavigation.removeAttribute('open')
      )
    );

  document.addEventListener('click', (event) => {
    if (!mobileNavigation.open || mobileNavigation.contains(event.target)) {
      return;
    }
    mobileNavigation.removeAttribute('open');
  });

  mobileNavigation.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !mobileNavigation.open) return;
    mobileNavigation.removeAttribute('open');
    mobileNavigation.querySelector('summary')?.focus();
  });
}

const gameStage = document.querySelector('.game-stage');
const canvas = document.querySelector('#rink-canvas');
const openGameButtons = document.querySelectorAll('[data-open-game]');
const closeGameButton = document.querySelector('#close-game');
const playLabel = document.querySelector('#play-label');
const gameStateLabel = document.querySelector('#game-state-label');

let gameEnginePromise;
let gameVisible = false;
let returnFocusTarget;

async function loadGameEngine() {
  if (!gameEnginePromise) {
    gameEnginePromise = import('./game.js');
  }
  await gameEnginePromise;
}

async function openGame(trigger) {
  if (!gameStage || gameVisible) return;

  gameVisible = true;
  if (trigger instanceof HTMLElement) {
    returnFocusTarget = trigger.closest('.mobile-nav')
      ? document.querySelector('#play-game')
      : trigger;
  }
  gameStage.hidden = false;
  openGameButtons.forEach((button) =>
    button.setAttribute('aria-pressed', 'true')
  );
  if (playLabel) playLabel.textContent = 'Game active';
  if (gameStateLabel) gameStateLabel.textContent = 'Game active';

  requestAnimationFrame(() => body.classList.add('is-playing'));
  await loadGameEngine();
  requestAnimationFrame(() => canvas?.focus({ preventScroll: true }));
}

async function closeGame() {
  if (!gameStage || !gameVisible) return;

  if (document.fullscreenElement === gameStage) {
    await document.exitFullscreen();
  }

  gameVisible = false;
  canvas?.blur();
  body.classList.remove('is-playing');
  openGameButtons.forEach((button) =>
    button.setAttribute('aria-pressed', 'false')
  );
  if (playLabel) playLabel.textContent = 'Enter game mode';
  if (gameStateLabel) gameStateLabel.textContent = 'Rink ready';

  window.setTimeout(
    () => {
      if (gameVisible) return;
      gameStage.hidden = true;
      returnFocusTarget?.focus({ preventScroll: true });
    },
    reduceMotion ? 0 : 420
  );
}

openGameButtons.forEach((button) =>
  button.addEventListener('click', (event) => openGame(event.currentTarget))
);
closeGameButton?.addEventListener('click', closeGame);

if (
  gameStage &&
  new URLSearchParams(window.location.search).get('play') === '1'
) {
  window.history.replaceState(null, '', `${window.location.pathname}#play`);
  openGame();
}

updateRoute();
window.addEventListener('scroll', requestRouteUpdate, { passive: true });
window.addEventListener('resize', requestRouteUpdate);
