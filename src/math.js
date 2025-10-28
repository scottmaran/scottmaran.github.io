export const EPSILON = 1e-6;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lengthSquared(x, y) {
  return x * x + y * y;
}

export function length(x, y) {
  return Math.hypot(x, y);
}

export function normalize(x, y) {
  const len = length(x, y);
  if (len < EPSILON) {
    return { x: 0, y: 0 };
  }
  return { x: x / len, y: y / len };
}

export function angleFromVector(x, y) {
  return Math.atan2(y, x);
}

export function vectorFromAngle(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function wrapAngle(angle) {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

export function shortestAngleDistance(current, target) {
  const twoPi = Math.PI * 2;
  let delta = wrapAngle(target) - wrapAngle(current);
  if (delta > Math.PI) {
    delta -= twoPi;
  } else if (delta < -Math.PI) {
    delta += twoPi;
  }
  return delta;
}

export function approachAngle(current, target, maxDelta) {
  const delta = shortestAngleDistance(current, target);
  const clamped = clamp(delta, -maxDelta, maxDelta);
  return wrapAngle(current + clamped);
}

export function clampMagnitude(x, y, maxLength) {
  const lenSq = lengthSquared(x, y);
  const maxSq = maxLength * maxLength;
  if (lenSq > maxSq) {
    const len = Math.sqrt(lenSq);
    const scale = maxLength / len;
    return { x: x * scale, y: y * scale };
  }
  return { x, y };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
