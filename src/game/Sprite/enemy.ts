import { Sprite } from './sprite.ts';

export class Enemy extends Sprite {
  id: number;
  speed: number;
  hp: number;
  maxHp: number;
  shootCooldown: number;
  shootRate: number;

  constructor(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    image: HTMLImageElement,
    speed: number,
    hp: number = 3,
    maxHp: number = 3
  ) {
    super(x, y, width, height, image);
    this.id = id;
    this.speed = speed;
    this.hp = hp;
    this.maxHp = maxHp;
    this.shootRate = 120 + Math.floor(Math.random() * 120);
    this.shootCooldown = this.shootRate;
  }

  readyToShoot(): boolean {
    this.shootCooldown--;
    if (this.shootCooldown <= 0) {
      this.shootCooldown = this.shootRate;
      return true;
    }
    return false;
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x + this.width / 2, this.y + this.height / 2);
    context.scale(-1, 1);
    context.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
    context.restore();

    // Barre de vie au-dessus de l'ennemi
    if (this.hp < this.maxHp) {
      const barWidth = this.width * 0.8;
      const barHeight = 6;
      const barX = this.x + (this.width - barWidth) / 2;
      const barY = this.y - barHeight - 4;
      const hpRatio = Math.max(0, this.hp / this.maxHp);

      // Fond
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fillRect(barX, barY, barWidth, barHeight);

      // HP restants (vert -> jaune -> rouge)
      const r = Math.round(255 * (1 - hpRatio));
      const g = Math.round(255 * hpRatio);
      context.fillStyle = `rgb(${r}, ${g}, 0)`;
      context.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    }
  }

  update(): void {
    this.x -= this.speed;
  }

  isOutOfScreen(): boolean {
    return this.x + this.width < 0;
  }
}
