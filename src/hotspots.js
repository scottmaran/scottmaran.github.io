import { RINK, PLAYER } from './config.js';
import { clamp, lengthSquared } from './math.js';

export const HOTSPOTS = [
  {
    id: 'home',
    label: 'Home',
    url: 'index.html',
    bounds: {
      x: RINK.WIDTH / 2 - 340,
      y: RINK.HEIGHT / 2 - 320,
      width: 680,
      height: 620,
    },
    color: 'rgba(255, 255, 255, 0.35)',
  },
  {
    id: 'projects',
    label: 'Projects',
    url: 'projects.html',
    bounds: {
      x: 330,
      y: RINK.HEIGHT / 2 - 720,
      width: 420,
      height: 1420,
    },
    color: 'rgba(44, 167, 255, 0.35)',
  },
  {
    id: 'about',
    label: 'About',
    url: 'about.html',
    bounds: {
      x: RINK.WIDTH - 750,
      y: RINK.HEIGHT / 2 - 620,
      width: 420,
      height: 1240,
    },
    color: 'rgba(255, 120, 196, 0.35)',
  },
  {
    id: 'contact',
    label: 'Contact',
    url: 'contact.html',
    bounds: {
      x: RINK.WIDTH / 2 - 260,
      y: 260,
      width: 520,
      height: 560,
    },
    color: 'rgba(255, 216, 0, 0.35)',
  },
];

export function resolveHotspot(position) {
  for (const hotspot of HOTSPOTS) {
    if (circleIntersectsRect(position, PLAYER.RADIUS, hotspot.bounds)) {
      return hotspot;
    }
  }
  return null;
}

function circleIntersectsRect(position, radius, rect) {
  const closestX = clamp(position.x, rect.x, rect.x + rect.width);
  const closestY = clamp(position.y, rect.y, rect.y + rect.height);
  const dx = position.x - closestX;
  const dy = position.y - closestY;
  return lengthSquared(dx, dy) <= radius * radius;
}
