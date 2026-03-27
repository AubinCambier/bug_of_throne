import type { FireballState } from './FireballManager';
import type { EnemyState, EnemyManager } from './EnemyManager';
import type { PlayerMovementState } from './MovementManager';

interface Hitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LanceState {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Nouveau: état d'un coeur ramassable
export interface HeartState {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollisionResult {
  removedFireballIds: number[];
  removedEnemyIds: number[];
  removedLanceIndices: number[];
  removedHeartIds: number[];
  playerHit: boolean;
}

export class CollisionManager {
  // Facteur de réduction des hitbox (0.6 = 60% de la taille réelle)
  private readonly playerHitboxFactor = 0.5;
  private readonly enemyHitboxFactor = 0.6;
  private readonly fireballHitboxFactor = 0.8;
  private readonly lanceHitboxFactor = 0.7;
  private readonly heartHitboxFactor = 0.75;

  checkCollisions(
    player: PlayerMovementState,
    playerInvincible: boolean,
    fireballs: ReadonlyArray<FireballState>,
    enemies: ReadonlyArray<EnemyState>,
    lances: ReadonlyArray<LanceState>,
    hearts: ReadonlyArray<HeartState>,
    enemyManager?: EnemyManager
  ): CollisionResult {
    const removedFireballIds: number[] = [];
    const removedEnemyIds: number[] = [];
    const removedLanceIndices: number[] = [];
    const removedHeartIds: number[] = [];
    let playerHit = false;

    const fireballIdsRemoved = new Set<number>();

    // Collision fireball <-> enemy (retire 1 HP par fireball)
    for (const fireball of fireballs) {
      if (fireballIdsRemoved.has(fireball.id)) continue;

      const fbHitbox = this.shrinkHitbox(fireball, this.fireballHitboxFactor);

      for (const enemy of enemies) {
        if (removedEnemyIds.includes(enemy.id)) continue;

        const enHitbox = this.shrinkHitbox(enemy, this.enemyHitboxFactor);

        if (this.aabbCollision(fbHitbox, enHitbox)) {
          removedFireballIds.push(fireball.id);
          fireballIdsRemoved.add(fireball.id);

          // Retirer 1 HP à l'ennemi, le tuer si HP <= 0
          if (enemyManager) {
            const isDead = enemyManager.damageEnemy(enemy.id, 1);
            if (isDead) {
              removedEnemyIds.push(enemy.id);
            }
          } else {
            removedEnemyIds.push(enemy.id);
          }
          break;
        }
      }
    }

    // Collision player <-> enemy
    if (!playerInvincible) {
      const playerHitbox = this.shrinkHitbox(player, this.playerHitboxFactor);

      for (const enemy of enemies) {
        if (removedEnemyIds.includes(enemy.id)) continue;

        const enHitbox = this.shrinkHitbox(enemy, this.enemyHitboxFactor);

        if (this.aabbCollision(playerHitbox, enHitbox)) {
          removedEnemyIds.push(enemy.id);
          playerHit = true;
          break;
        }
      }
    }

    // Collision player <-> lance
    if (!playerInvincible && !playerHit) {
      const playerHitbox = this.shrinkHitbox(player, this.playerHitboxFactor);

      for (let i = 0; i < lances.length; i++) {
        const lanceHitbox = this.shrinkHitbox(lances[i], this.lanceHitboxFactor);

        if (this.aabbCollision(playerHitbox, lanceHitbox)) {
          removedLanceIndices.push(i);
          playerHit = true;
          break;
        }
      }
    }

    // Collision player <-> heart (ramassage)
    // Les coeurs sont ramassables même si le joueur est invincible
    if (!playerHit) {
      const playerHitbox = this.shrinkHitbox(player, this.playerHitboxFactor);
      for (const heart of hearts) {
        if (removedHeartIds.includes(heart.id)) continue;
        const heartHitbox = this.shrinkHitbox(heart, this.heartHitboxFactor);
        if (this.aabbCollision(playerHitbox, heartHitbox)) {
          removedHeartIds.push(heart.id);
          // Ne break pas: un joueur peut ramasser plusieurs coeurs en théorie
        }
      }
    }

    return { removedFireballIds, removedEnemyIds, removedLanceIndices, removedHeartIds, playerHit };
  }

  // Réduit la hitbox en la centrant sur le sprite
  private shrinkHitbox(rect: { x: number; y: number; width: number; height: number }, factor: number): Hitbox {
    const diffW = rect.width * (1 - factor);
    const diffH = rect.height * (1 - factor);
    return {
      x: rect.x + diffW / 2,
      y: rect.y + diffH / 2,
      width: rect.width * factor,
      height: rect.height * factor,
    };
  }

  private aabbCollision(a: Hitbox, b: Hitbox): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }
}
