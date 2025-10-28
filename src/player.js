import { PLAYER, BOUNDS } from './config.js';
import {
  clamp,
  clampMagnitude,
  length,
  angleFromVector,
  vectorFromAngle,
  approachAngle,
  shortestAngleDistance,
} from './math.js';

const TWO_PI = Math.PI * 2;

export class Player {
  constructor() {
    this.position = { x: PLAYER.START_X, y: PLAYER.START_Y };
    this.velocity = { x: 0, y: 0 };
    this.heading = -Math.PI / 2;
    this.state = 'idle';
    this.animationTimer = 0;
    this.frameToggle = false;
  }

  update(direction, deltaSeconds) {
    const hasInput = Math.abs(direction.x) > 0 || Math.abs(direction.y) > 0;
    const speedBefore = length(this.velocity.x, this.velocity.y);

    if (hasInput) {
      const desiredHeading = angleFromVector(direction.x, direction.y);
      this.heading = approachAngle(
        this.heading,
        desiredHeading,
        PLAYER.TURN_RATE * deltaSeconds,
      );
      const forward = vectorFromAngle(this.heading);
      this.velocity.x += forward.x * PLAYER.ACCELERATION * deltaSeconds;
      this.velocity.y += forward.y * PLAYER.ACCELERATION * deltaSeconds;
    }

    const limited = clampMagnitude(this.velocity.x, this.velocity.y, PLAYER.MAX_SPEED);
    this.velocity.x = limited.x;
    this.velocity.y = limited.y;

    this._applyFriction(deltaSeconds);
    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;
    this._constrainToBounds();

    const speed = length(this.velocity.x, this.velocity.y);
    this._updateState(hasInput, speed, direction);
    this._updateAnimation(deltaSeconds, speedBefore, speed);
  }

  _applyFriction(deltaSeconds) {
    const speed = length(this.velocity.x, this.velocity.y);
    if (speed <= 0) return;

    const deceleration = PLAYER.FRICTION * deltaSeconds;
    const newSpeed = Math.max(0, speed - deceleration);
    if (newSpeed === speed) return;
    const scale = newSpeed / speed;
    this.velocity.x *= scale;
    this.velocity.y *= scale;
  }

  _constrainToBounds() {
    let clamped = false;
    if (this.position.x - PLAYER.RADIUS < BOUNDS.LEFT) {
      this.position.x = BOUNDS.LEFT + PLAYER.RADIUS;
      this.velocity.x = Math.max(0, this.velocity.x);
      clamped = true;
    } else if (this.position.x + PLAYER.RADIUS > BOUNDS.RIGHT) {
      this.position.x = BOUNDS.RIGHT - PLAYER.RADIUS;
      this.velocity.x = Math.min(0, this.velocity.x);
      clamped = true;
    }

    if (this.position.y - PLAYER.RADIUS < BOUNDS.TOP) {
      this.position.y = BOUNDS.TOP + PLAYER.RADIUS;
      this.velocity.y = Math.max(0, this.velocity.y);
      clamped = true;
    } else if (this.position.y + PLAYER.RADIUS > BOUNDS.BOTTOM) {
      this.position.y = BOUNDS.BOTTOM - PLAYER.RADIUS;
      this.velocity.y = Math.min(0, this.velocity.y);
      clamped = true;
    }

    if (clamped && length(this.velocity.x, this.velocity.y) < PLAYER.IDLE_THRESHOLD) {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }
  }

  _updateState(hasInput, speed, direction) {
    if (speed < PLAYER.IDLE_THRESHOLD) {
      this.state = 'idle';
      return;
    }

    if (!hasInput) {
      this.state = 'coasting';
      return;
    }

    const desiredHeading = angleFromVector(direction.x, direction.y);
    const turnDelta = Math.abs(shortestAngleDistance(this.heading, desiredHeading));

    if (turnDelta > Math.PI / 4 && speed > PLAYER.COAST_THRESHOLD) {
      this.state = 'turning';
    } else {
      this.state = 'skating';
    }
  }

  _updateAnimation(deltaSeconds, speedBefore, speedAfter) {
    const targetRate = clamp(speedAfter / PLAYER.MAX_SPEED, 0, 1);
    const animationSpeed = 6 + targetRate * 12;
    this.animationTimer += deltaSeconds * animationSpeed;
    if (this.animationTimer >= 1) {
      this.animationTimer %= 1;
      this.frameToggle = !this.frameToggle;
    }
  }

  getSpeed() {
    return length(this.velocity.x, this.velocity.y);
  }

  getRenderDescriptor() {
    return {
      position: { ...this.position },
      heading: this.heading,
      state: this.state,
      frameToggle: this.frameToggle,
    };
  }
}
