const DIRECTIONAL_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
]);

export class InputManager {
  constructor(focusElement) {
    this.focusElement = focusElement;
    this.active = false;
    this.keys = new Set();
    this.pendingEnter = false;

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
    this._handleFocus = this._handleFocus.bind(this);
    this._handleBlur = this._handleBlur.bind(this);

    document.addEventListener('keydown', this._handleKeyDown, { passive: false });
    document.addEventListener('keyup', this._handleKeyUp, { passive: false });
    focusElement.addEventListener('focus', this._handleFocus);
    focusElement.addEventListener('blur', this._handleBlur);
    focusElement.addEventListener('pointerdown', () => {
      focusElement.focus({ preventScroll: true });
    });
  }

  destroy() {
    document.removeEventListener('keydown', this._handleKeyDown);
    document.removeEventListener('keyup', this._handleKeyUp);
    this.focusElement.removeEventListener('focus', this._handleFocus);
    this.focusElement.removeEventListener('blur', this._handleBlur);
  }

  isActive() {
    return this.active;
  }

  getDirection() {
    let x = 0;
    let y = 0;
    if (!this.active) {
      return { x, y };
    }

    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;

    if (x === 0 && y === 0) {
      return { x: 0, y: 0 };
    }
    const magnitude = Math.hypot(x, y);
    return { x: x / magnitude, y: y / magnitude };
  }

  consumeEnter() {
    if (!this.pendingEnter) return false;
    this.pendingEnter = false;
    return true;
  }

  _handleFocus() {
    this.active = true;
    this.keys.clear();
    this.pendingEnter = false;
  }

  _handleBlur() {
    this.active = false;
    this.keys.clear();
    this.pendingEnter = false;
  }

  _handleKeyDown(event) {
    if (!this.active) return;

    if (DIRECTIONAL_CODES.has(event.code)) {
      this.keys.add(event.code);
      event.preventDefault();
      return;
    }

    if (event.code === 'Enter') {
      this.pendingEnter = true;
      event.preventDefault();
      return;
    }

    if (event.code === 'Escape') {
      this.focusElement.blur();
      event.preventDefault();
    }
  }

  _handleKeyUp(event) {
    if (!this.active) return;

    if (DIRECTIONAL_CODES.has(event.code)) {
      this.keys.delete(event.code);
      event.preventDefault();
    }
  }
}
