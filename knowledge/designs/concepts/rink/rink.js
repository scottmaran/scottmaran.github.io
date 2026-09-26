const root = document.documentElement;
const routePath = document.querySelector('#route-path');
const shiftClock = document.querySelector('#shift-clock');
const zoneLabel = document.querySelector('#zone-label');
const periodLabel = document.querySelector('#period-label');
const stages = document.querySelectorAll('.rink-stage');
const revealTargets = document.querySelectorAll('.reveal');
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

let lastScroll = window.scrollY;
let puckRotation = 0;
let ticking = false;

function updateRoute() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress =
    scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
  const routeLength = routePath.getTotalLength();
  const point = routePath.getPointAtLength(routeLength * progress);
  const svg = routePath.ownerSVGElement;
  const bounds = svg.getBoundingClientRect();
  const x = bounds.left + (point.x / 1000) * bounds.width;
  const y = bounds.top + (point.y / 1000) * bounds.height;
  const scrollDelta = window.scrollY - lastScroll;

  puckRotation += scrollDelta * 0.45;
  root.style.setProperty('--route-progress', `${progress * 100}`);
  root.style.setProperty('--puck-x', `${x}px`);
  root.style.setProperty('--puck-y', `${y}px`);
  root.style.setProperty('--puck-rotation', `${puckRotation}deg`);

  const elapsedSeconds = Math.round(progress * 20 * 60);
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  shiftClock.textContent = `${minutes}:${seconds}`;

  lastScroll = window.scrollY;
  ticking = false;
}

function requestRouteUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(updateRoute);
}

if ('IntersectionObserver' in window) {
  const stageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        zoneLabel.textContent = entry.target.dataset.zone;
        periodLabel.textContent = entry.target.dataset.period;
      });
    },
    { rootMargin: '-42% 0px -42% 0px' }
  );

  stages.forEach((stage) => stageObserver.observe(stage));

  if (!reduceMotion) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach((target) => revealObserver.observe(target));
  } else {
    revealTargets.forEach((target) => target.classList.add('is-visible'));
  }
} else {
  revealTargets.forEach((target) => target.classList.add('is-visible'));
}

updateRoute();
window.addEventListener('scroll', requestRouteUpdate, { passive: true });
window.addEventListener('resize', requestRouteUpdate);
