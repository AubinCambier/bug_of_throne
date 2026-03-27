import { Sprite } from './sprite.ts';

export class Player extends Sprite {
  speedX: number;
  speedY: number;
  acceleration: number;
  friction: number;
  maxSpeed: number;
  lives: number;
  invincible: boolean;
  invincibleTimer: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    image: HTMLImageElement
  ) {
    super(x, y, width, height, image);

    this.speedX = 0;
    this.speedY = 0;
    this.acceleration = 0.8;
    this.friction = 0.92;
    this.maxSpeed = 10;
    this.lives = 3;
    this.invincible = false;
    this.invincibleTimer = 0;
  }

  hit(): void {
    if (this.invincible) return;
    this.lives--;
    this.invincible = true;
    this.invincibleTimer = 120; // ~2 secondes d'invincibilité
  }

  isAlive(): boolean {
    return this.lives > 0;
  }

  draw(context: CanvasRenderingContext2D): void {
    // Clignotement quand invincible
    if (this.invincible && Math.floor(this.invincibleTimer / 6) % 2 === 0) {
      return;
    }
    super.draw(context);
  }

  update(keys: Record<string, boolean>, canvas: HTMLCanvasElement): void {
    if (this.invincible) {
      this.invincibleTimer--;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
      }
    }

    if (keys['ArrowLeft'] || keys['q']) {
      this.speedX -= this.acceleration;
    }

    if (keys['ArrowRight'] || keys['d']) {
      this.speedX += this.acceleration;
    }

    if (keys['ArrowUp'] || keys['z']) {
      this.speedY -= this.acceleration;
    }

    if (keys['ArrowDown'] || keys['s']) {
      this.speedY += this.acceleration;
    }

    this.speedX *= this.friction;
    this.speedY *= this.friction;

    if (this.speedX > this.maxSpeed) this.speedX = this.maxSpeed;
    if (this.speedX < -this.maxSpeed) this.speedX = -this.maxSpeed;
    if (this.speedY > this.maxSpeed) this.speedY = this.maxSpeed;
    if (this.speedY < -this.maxSpeed) this.speedY = -this.maxSpeed;

    this.x += this.speedX;
    this.y += this.speedY;

    if (this.x < 0) {
      this.x = 0;
      this.speedX = 0;
    }

    if (this.y < 0) {
      this.y = 0;
      this.speedY = 0;
    }

    if (this.x + this.width > canvas.width) {
      this.x = canvas.width - this.width;
      this.speedX = 0;
    }

    if (this.y + this.height > canvas.height) {
      this.y = canvas.height - this.height;
      this.speedY = 0;
    }
  }
}