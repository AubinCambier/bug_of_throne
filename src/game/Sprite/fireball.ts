import { Sprite } from './sprite.ts';

export class Fireball extends Sprite {
  id: number;
  speedX: number;

  constructor(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    image: HTMLImageElement,
    speedX = 8
  ) {
    super(x, y, width, height, image);
    this.id = id;
    this.speedX = speedX;
  }

  update(): void {
    this.x += this.speedX;
  }

  isOutOfScreen(canvas: HTMLCanvasElement): boolean {
    return this.x > canvas.width;
  }
}
