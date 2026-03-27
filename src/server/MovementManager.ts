import type { ScreenBounds } from './ScreenManager';

export interface MovementInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  // mode souris 
  mouseX?: number;
  mouseY?: number;
  useMouse?: boolean;
}

export interface PlayerMovementState {
  x: number;
  y: number;
  width: number;
  height: number;
  speedX: number;
  speedY: number;
}

export class MovementManager {
  private readonly acceleration = 0.8;
  private readonly friction = 0.92;
  private readonly maxSpeed = 10;

  updatePlayer(
    player: PlayerMovementState,
    input: MovementInput,
    bounds: ScreenBounds
  ): PlayerMovementState {
    let speedX = player.speedX;
    let speedY = player.speedY;

    if (input.useMouse && input.mouseX !== undefined && input.mouseY !== undefined) {
      // mode souris
      const playerCenterX = player.x + player.width / 2;
      const playerCenterY = player.y + player.height / 2;
      const dx = input.mouseX - playerCenterX;
      const dy = input.mouseY - playerCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 10) {
        // Vitesse proportionnelle à la distance 
        const factor = Math.min(dist / 100, 1) * this.acceleration * 3;
        speedX += (dx / dist) * factor;
        speedY += (dy / dist) * factor;
      }
    } else {
      // Mode clavier
      if (input.left) speedX -= this.acceleration;
      if (input.right) speedX += this.acceleration;
      if (input.up) speedY -= this.acceleration;
      if (input.down) speedY += this.acceleration;
    }

    speedX *= this.friction;
    speedY *= this.friction;

    if (speedX > this.maxSpeed) speedX = this.maxSpeed;
    if (speedX < -this.maxSpeed) speedX = -this.maxSpeed;
    if (speedY > this.maxSpeed) speedY = this.maxSpeed;
    if (speedY < -this.maxSpeed) speedY = -this.maxSpeed;

    let nextX = player.x + speedX;
    let nextY = player.y + speedY;

    if (nextX < 0) {
      nextX = 0;
      speedX = 0;
    }

    if (nextY < 0) {
      nextY = 0;
      speedY = 0;
    }

    if (nextX + player.width > bounds.width) {
      nextX = bounds.width - player.width;
      speedX = 0;
    }

    if (nextY + player.height > bounds.height) {
      nextY = bounds.height - player.height;
      speedY = 0;
    }

    return {
      ...player,
      x: nextX,
      y: nextY,
      speedX,
      speedY,
    };
  }
}
