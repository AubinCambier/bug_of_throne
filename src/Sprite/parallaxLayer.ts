interface ParallaxLayerProps {
  image: HTMLImageElement;
  speed: number;
  y: number;
  height: number;
}

export class ParallaxLayer {
  image: HTMLImageElement;
  speed: number;
  y: number;
  height: number;
  x: number;

  constructor({ image, speed, y, height }: ParallaxLayerProps) {
    this.image = image;
    this.speed = speed;
    this.y = y;
    this.height = height;
    this.x = 0;
  }

  update(): void {
    this.x -= this.speed;
    // Calcul de la largeur affichée en gardant le ratio de l'image
    const ratio = this.image.naturalWidth / this.image.naturalHeight;
    const displayWidth = this.height * ratio;
    if (this.x <= -displayWidth) {
      this.x += displayWidth;
    }
  }

  draw(context: CanvasRenderingContext2D, canvasWidth: number): void {
    const ratio = this.image.naturalWidth / this.image.naturalHeight;
    const displayWidth = this.height * ratio;

    // Dessine l'image en boucle pour couvrir tout le canvas
    let drawX = this.x % displayWidth;
    if (drawX > 0) drawX -= displayWidth;

    while (drawX < canvasWidth) {
      context.drawImage(this.image, drawX, this.y, displayWidth, this.height);
      drawX += displayWidth;
    }
  }
}
