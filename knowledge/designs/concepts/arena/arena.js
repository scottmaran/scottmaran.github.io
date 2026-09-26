const root = document.documentElement;
const timeElement = document.querySelector('#arena-time');
const playerCard = document.querySelector('.player-card');
const revealTargets = document.querySelectorAll('.reveal');
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

function updateArenaTime() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  timeElement.textContent = `${formatter.format(new Date())} ET`;
}

let pointerFrame;
function updatePointer(event) {
  if (reduceMotion) return;
  if (pointerFrame) cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => {
    root.style.setProperty('--arena-x', `${event.clientX}px`);
    root.style.setProperty('--arena-y', `${event.clientY}px`);
  });
}

function tiltPlayerCard(event) {
  if (reduceMotion || window.innerWidth < 760) return;
  const bounds = playerCard.getBoundingClientRect();
  const relativeX = (event.clientX - bounds.left) / bounds.width - 0.5;
  const relativeY = (event.clientY - bounds.top) / bounds.height - 0.5;
  playerCard.style.setProperty('--card-rotate-y', `${relativeX * 8}deg`);
  playerCard.style.setProperty('--card-rotate-x', `${relativeY * -7}deg`);
}

function resetPlayerCard() {
  playerCard.style.setProperty('--card-rotate-y', '-4deg');
  playerCard.style.setProperty('--card-rotate-x', '2deg');
}

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

updateArenaTime();
window.setInterval(updateArenaTime, 1000);
window.addEventListener('pointermove', updatePointer, { passive: true });
playerCard.addEventListener('pointermove', tiltPlayerCard);
playerCard.addEventListener('pointerleave', resetPlayerCard);
