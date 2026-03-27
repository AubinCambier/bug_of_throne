import type { PlayerMovementState } from './MovementManager';
import type { ScreenBounds } from './ScreenManager';

export type FireMode = 'auto' | 'click';

export interface FireballState {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speedX: number;
  speedY: number;
}

export class FireballManager {
  private fireballs: FireballState[] = [];
  private fireCooldown = 0;
  private fireRate = 30;
  private fireballSize = 1;
  private nextFireballId = 1;
  private readonly projectileSpeed = 8;
  private fireMode: FireMode = 'auto';
  private pendingClickShots: Array<{ x: number; y: number }> = [];

  setConfig(fireRate: number, fireballSize: number): void {
    this.fireRate = Math.max(1, Math.round(fireRate));
    this.fireballSize = Math.max(1, Math.round(fireballSize));
  }

  setFireMode(mode: FireMode): void {
    this.fireMode = mode;
  }

  queueClickShot(targetX: number, targetY: number): void {
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

    this.pendingClickShots.push({ x: targetX, y: targetY });

    // Evite une file infinie si le joueur spamme les clics.
    if (this.pendingClickShots.length > 10) {
      this.pendingClickShots.shift();
    }
  }

  updateProjectiles(
    player: PlayerMovementState,
    bounds: ScreenBounds
  ): ReadonlyArray<FireballState> {
    this.fireCooldown--;

    if (this.fireMode === 'auto') {
      if (this.fireCooldown <= 0) {
        this.spawnFromPlayer(player);
        this.fireCooldown = this.fireRate;
      }
    } else if (this.fireCooldown <= 0 && this.pendingClickShots.length > 0) {
      const target = this.pendingClickShots.shift()!;
      this.spawnTowardTarget(player, target.x, target.y);
      this.fireCooldown = this.fireRate;
    }

    for (const fireball of this.fireballs) {
      fireball.x += fireball.speedX;
      fireball.y += fireball.speedY;
    }

    this.fireballs = this.fireballs.filter((fireball) => (
      fireball.x <= bounds.width &&
      fireball.x + fireball.width >= 0 &&
      fireball.y <= bounds.height &&
      fireball.y + fireball.height >= 0
    ));
    return this.fireballs;
  }

  removeProjectilesByIds(ids: number[]): void {
    if (ids.length === 0) return;

    const idsToRemove = new Set(ids);
    this.fireballs = this.fireballs.filter((fireball) => !idsToRemove.has(fireball.id));
  }

  getFireballs(): ReadonlyArray<FireballState> {
    return this.fireballs;
  }

  private spawnFromPlayer(player: PlayerMovementState): void {
    const origin = this.getSpawnOrigin(player);

    this.fireballs.push({
      id: this.nextFireballId++,
      x: origin.x,
      y: origin.y,
      width: this.fireballSize,
      height: this.fireballSize,
      speedX: this.projectileSpeed,
      speedY: 0,
    });
  }

  private spawnTowardTarget(
    player: PlayerMovementState,
    targetX: number,
    targetY: number
  ): void {
    const origin = this.getSpawnOrigin(player);
    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    const distance = Math.hypot(dx, dy);

    const safeDistance = distance > 0 ? distance : 1;
    const speedX = (dx / safeDistance) * this.projectileSpeed;
    const speedY = (dy / safeDistance) * this.projectileSpeed;

    this.fireballs.push({
      id: this.nextFireballId++,
      x: origin.x,
      y: origin.y,
      width: this.fireballSize,
      height: this.fireballSize,
      speedX,
      speedY,
    });
  }

  private getSpawnOrigin(player: PlayerMovementState): { x: number; y: number } {
    return {
      x: player.x + player.width * 0.6,
      y: player.y + player.height * 0.45 - this.fireballSize / 2,
    };
  }
}
