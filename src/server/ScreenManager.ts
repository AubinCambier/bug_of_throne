export interface ScreenBounds {
  width: number;
  height: number;
}

export class ScreenManager {
  private bounds: ScreenBounds = { width: 0, height: 0 };

  setSize(width: number, height: number): void {
    this.bounds.width = width;
    this.bounds.height = height;
  }

  getBounds(): ScreenBounds {
    return this.bounds;
  }
}
