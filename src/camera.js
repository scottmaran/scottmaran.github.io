import { RINK } from './config.js';

export class Camera {
  constructor() {
    this.viewportWidth = RINK.WIDTH;
    this.viewportHeight = RINK.HEIGHT * RINK.VIEWPORT_FRACTION;
    this.centerX = RINK.WIDTH / 2;
    this.centerY = RINK.HEIGHT / 2;
    this._applyBounds();
  }

  setViewport(aspectRatio) {
    if (aspectRatio <= 0) return;
    this.viewportHeight = RINK.HEIGHT * RINK.VIEWPORT_FRACTION;
    this.viewportWidth = Math.min(RINK.WIDTH, this.viewportHeight * aspectRatio);
    this._applyBounds();
  }

  pan(dx, dy) {
    this.centerX += dx;
    this.centerY += dy;
    this._applyBounds();
  }

  getView() {
    return {
      x: this.centerX - this.viewportWidth / 2,
      y: this.centerY - this.viewportHeight / 2,
      width: this.viewportWidth,
      height: this.viewportHeight,
    };
  }

  centerOn(x, y) {
    this.centerX = x;
    this.centerY = y;
    this._applyBounds();
  }

  _applyBounds() {
    const halfW = this.viewportWidth / 2;
    const halfH = this.viewportHeight / 2;
    this.centerX = clamp(this.centerX, halfW, RINK.WIDTH - halfW);
    this.centerY = clamp(this.centerY, halfH, RINK.HEIGHT - halfH);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
