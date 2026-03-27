import { Sprite } from './sprite.ts';

export class Lance extends Sprite {
  speedX: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    image: HTMLImageElement
  ) {
    super(x, y, width, height, image);
    this.speedX = -7;
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x + this.width / 2, this.y + this.height / 2);
    context.rotate(Math.PI); // pointe vers la gauche
    context.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
    context.restore();
  }

  update(): void {
    this.x += this.speedX;
  }

  isOutOfScreen(): boolean {
    return this.x + this.width < 0;
  }
}
