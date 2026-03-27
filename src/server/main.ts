import {
  MovementManager,
  type MovementInput,
  type PlayerMovementState,
} from './MovementManager';
import { ScreenManager } from './ScreenManager';
import { FireballManager, type FireballState } from './FireballManager';
import { EnemyManager, type EnemyState } from './EnemyManager';
import { CollisionManager, type LanceState, type CollisionResult } from './CollisionManager';

export class ServerMovementRuntime {
  private readonly movementManager = new MovementManager();
  private readonly screenManager = new ScreenManager();
  private readonly fireballManager = new FireballManager();
  private readonly enemyManager = new EnemyManager();
  private readonly collisionManager = new CollisionManager();

  setScreenSize(width: number, height: number): void {
    this.screenManager.setSize(width, height);
  }

  setProjectileConfig(fireRate: number, fireballSize: number): void {
    this.fireballManager.setConfig(fireRate, fireballSize);
  }

  setEnemyConfig(enemyWidth: number, enemyHeight: number): void {
    this.enemyManager.setConfig(enemyWidth, enemyHeight);
  }
  updatePlayer(player: PlayerMovementState, input: MovementInput): PlayerMovementState {
    return this.movementManager.updatePlayer(
      player,
      input,
      this.screenManager.getBounds()
    );
  }

  updateProjectiles(player: PlayerMovementState): ReadonlyArray<FireballState> {
    return this.fireballManager.updateProjectiles(player, this.screenManager.getBounds());
  }

  removeProjectilesByIds(ids: number[]): void {
    this.fireballManager.removeProjectilesByIds(ids);
  }

  updateEnemies(): ReadonlyArray<EnemyState> {
    return this.enemyManager.updateEnemies(this.screenManager.getBounds());
  }

  removeEnemiesByIds(ids: number[]): void {
    this.enemyManager.removeEnemiesByIds(ids);
  }

  checkCollisions(
    player: PlayerMovementState,
    playerInvincible: boolean,
    lances: ReadonlyArray<LanceState>
  ): CollisionResult {
    return this.collisionManager.checkCollisions(
      player,
      playerInvincible,
      this.fireballManager.getFireballs(),
      this.enemyManager.getEnemies(),
      lances,
      [],
      this.enemyManager
    );
  }
}
