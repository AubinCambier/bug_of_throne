import type { ScreenBounds } from './ScreenManager';
import type { MobBehavior, MobRuntimeState, MobState, MobTemplate } from './EnemyType';

export type EnemyState = MobState;
export type EnemyTemplate = MobTemplate;

export interface EnemyDifficultyConfig {
  minSpawnDelayMs: number;
  maxSpawnDelayMs: number;
  speedMultiplier: number;
}

const DEFAULT_MIN_SPAWN_DELAY_MS = 2000;
const DEFAULT_MAX_SPAWN_DELAY_MS = 3000;
const DEFAULT_ENEMY_SPEED_MIN = 2;
const DEFAULT_ENEMY_SPEED_MAX = 4;
const FRAME_DURATION_MS = 1000 / 60;

const DEFAULT_BEHAVIOR: MobBehavior = {
  update(mob, context) {
    mob.x -= mob.speed * context.speedMultiplier * context.deltaFrames;
  },
};

export class EnemyManager {
  private enemies: MobRuntimeState[] = [];
  private nextEnemyId = 1;
  private templates: EnemyTemplate[] = [{
    type: 'default',
    weight: 1,
    width: 50,
    height: 50,
    hp: 3,
    minSpeed: DEFAULT_ENEMY_SPEED_MIN,
    maxSpeed: DEFAULT_ENEMY_SPEED_MAX,
    behavior: DEFAULT_BEHAVIOR,
  }];
  private minSpawnDelayMs = DEFAULT_MIN_SPAWN_DELAY_MS;
  private maxSpawnDelayMs = DEFAULT_MAX_SPAWN_DELAY_MS;
  private nextSpawnAt = 0;
  private lastUpdateAt = 0;
  private speedMultiplier = 1;

  setConfig(
    enemyWidth: number,
    enemyHeight: number,
    minSpawnDelayMs = DEFAULT_MIN_SPAWN_DELAY_MS,
    maxSpawnDelayMs = DEFAULT_MAX_SPAWN_DELAY_MS
  ): void {
    const baseTemplate = this.templates[0];
    const safeEnemyWidth = Number.isFinite(enemyWidth) && enemyWidth > 0 ? enemyWidth : baseTemplate.width;
    const safeEnemyHeight = Number.isFinite(enemyHeight) && enemyHeight > 0 ? enemyHeight : baseTemplate.height;

    this.setTemplates([
      {
        type: 'default',
        weight: 1,
        width: safeEnemyWidth,
        height: safeEnemyHeight,
        hp: 3,
        minSpeed: DEFAULT_ENEMY_SPEED_MIN,
        maxSpeed: DEFAULT_ENEMY_SPEED_MAX,
        behavior: DEFAULT_BEHAVIOR,
      },
    ]);
    this.setSpawnDelay(minSpawnDelayMs, maxSpawnDelayMs);
  }

  setSpawnDelay(
    minSpawnDelayMs = DEFAULT_MIN_SPAWN_DELAY_MS,
    maxSpawnDelayMs = DEFAULT_MAX_SPAWN_DELAY_MS
  ): void {
    const safeMinSpawnDelayMs =
      Number.isFinite(minSpawnDelayMs) && minSpawnDelayMs > 0 ? minSpawnDelayMs : this.minSpawnDelayMs;
    const safeMaxSpawnDelayMs =
      Number.isFinite(maxSpawnDelayMs) && maxSpawnDelayMs > 0 ? maxSpawnDelayMs : this.maxSpawnDelayMs;

    this.minSpawnDelayMs = Math.max(100, Math.round(safeMinSpawnDelayMs));
    this.maxSpawnDelayMs = Math.max(this.minSpawnDelayMs, Math.round(safeMaxSpawnDelayMs));
    this.nextSpawnAt = 0;
  }

  setDynamicDifficulty(config: EnemyDifficultyConfig, now = Date.now()): void {
    const safeMinSpawnDelayMs =
      Number.isFinite(config.minSpawnDelayMs) && config.minSpawnDelayMs > 0
        ? config.minSpawnDelayMs
        : this.minSpawnDelayMs;
    const safeMaxSpawnDelayMs =
      Number.isFinite(config.maxSpawnDelayMs) && config.maxSpawnDelayMs > 0
        ? config.maxSpawnDelayMs
        : this.maxSpawnDelayMs;
    const safeSpeedMultiplier =
      Number.isFinite(config.speedMultiplier) && config.speedMultiplier > 0
        ? config.speedMultiplier
        : this.speedMultiplier;

    this.minSpawnDelayMs = Math.max(100, Math.round(safeMinSpawnDelayMs));
    this.maxSpawnDelayMs = Math.max(this.minSpawnDelayMs, Math.round(safeMaxSpawnDelayMs));
    this.speedMultiplier = Math.max(0.1, safeSpeedMultiplier);

    if (this.nextSpawnAt !== 0) {
      const remainingMs = Math.max(0, this.nextSpawnAt - now);
      const clampedRemainingMs = this.clamp(remainingMs, 0, this.maxSpawnDelayMs);
      this.nextSpawnAt = now + clampedRemainingMs;
    }
  }

  setTemplates(templates: ReadonlyArray<EnemyTemplate>): void {
    const normalizedTemplates = templates
      .map((template) => this.normalizeTemplate(template))
      .filter((template): template is EnemyTemplate => template !== null);

    if (normalizedTemplates.length === 0) {
      return;
    }

    this.templates = normalizedTemplates;
    this.nextSpawnAt = 0;
  }

  updateEnemies(bounds: ScreenBounds, now = Date.now()): ReadonlyArray<EnemyState> {
    if (this.nextSpawnAt === 0) {
      this.scheduleNextSpawn(now);
    }

    if (this.lastUpdateAt === 0) {
      this.lastUpdateAt = now;
    }

    const deltaMs = Math.max(1, now - this.lastUpdateAt);
    const deltaFrames = deltaMs / FRAME_DURATION_MS;
    this.lastUpdateAt = now;

    if (now >= this.nextSpawnAt) {
      this.spawnEnemy(bounds);
      this.scheduleNextSpawn(now);
    }

    for (const enemy of this.enemies) {
      enemy.ageMs += deltaMs;
      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer--;
      }
      const template = this.getTemplate(enemy.type);
      template.behavior.update(enemy, { bounds, deltaMs, deltaFrames, speedMultiplier: this.speedMultiplier });
      enemy.y = this.clamp(enemy.y, 0, Math.max(0, bounds.height - enemy.height));
    }

    this.enemies = this.enemies.filter((enemy) => enemy.x + enemy.width >= 0);
    return this.getEnemies();
  }

  removeEnemiesByIds(ids: number[]): void {
    if (ids.length === 0) return;

    const idsToRemove = new Set(ids);
    this.enemies = this.enemies.filter((enemy) => !idsToRemove.has(enemy.id));
  }

  getEnemies(): ReadonlyArray<EnemyState> {
    return this.enemies.map((enemy) => ({
      id: enemy.id,
      type: enemy.type,
      x: enemy.x,
      y: enemy.y,
      width: enemy.width,
      height: enemy.height,
      speed: enemy.speed,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      hitFlash: enemy.hitFlashTimer > 0,
    }));
  }

  damageEnemy(id: number, damage: number): boolean {
    const enemy = this.enemies.find((e) => e.id === id);
    if (!enemy) return false;
    enemy.hp -= damage;
    enemy.hitFlashTimer = 12; // ~200ms à 60fps
    return enemy.hp <= 0;
  }

  private spawnEnemy(bounds: ScreenBounds): void {
    const template = this.pickTemplate();
    const yMax = Math.max(0, bounds.height - template.height);
    const baseY = Math.random() * yMax;

    this.enemies.push({
      id: this.nextEnemyId++,
      type: template.type,
      x: bounds.width,
      y: baseY,
      width: template.width,
      height: template.height,
      speed: this.randomBetween(template.minSpeed, template.maxSpeed),
      hp: template.hp,
      maxHp: template.hp,
      hitFlash: false,
      hitFlashTimer: 0,
      baseY,
      ageMs: 0,
    });
  }

  private getTemplate(type: EnemyTemplate['type']): EnemyTemplate {
    return this.templates.find((template) => template.type === type) ?? this.templates[0]!;
  }

  private pickTemplate(): EnemyTemplate {
    const totalWeight = this.templates.reduce((sum, template) => sum + template.weight, 0);
    if (totalWeight <= 0) {
      return this.templates[0]!;
    }

    let cursor = Math.random() * totalWeight;
    for (const template of this.templates) {
      cursor -= template.weight;
      if (cursor <= 0) {
        return template;
      }
    }

    return this.templates[this.templates.length - 1]!;
  }

  private scheduleNextSpawn(now: number): void {
    const delay = this.randomBetween(this.minSpawnDelayMs, this.maxSpawnDelayMs);
    this.nextSpawnAt = now + delay;
  }

  private normalizeTemplate(template: EnemyTemplate): EnemyTemplate | null {
    if (typeof template.behavior?.update !== 'function') {
      return null;
    }

    const safeWeight = Number.isFinite(template.weight) ? template.weight : 0;
    const safeWidth = Number.isFinite(template.width) ? template.width : 0;
    const safeHeight = Number.isFinite(template.height) ? template.height : 0;
    const safeMinSpeed = Number.isFinite(template.minSpeed) ? template.minSpeed : DEFAULT_ENEMY_SPEED_MIN;
    const safeMaxSpeed = Number.isFinite(template.maxSpeed) ? template.maxSpeed : DEFAULT_ENEMY_SPEED_MAX;

    if (safeWeight <= 0 || safeWidth <= 0 || safeHeight <= 0) {
      return null;
    }

    const minSpeed = Math.max(0.1, safeMinSpeed);
    const maxSpeed = Math.max(minSpeed, safeMaxSpeed);

    const safeHp = Number.isFinite(template.hp) && template.hp > 0 ? template.hp : 3;

    return {
      type: template.type,
      weight: safeWeight,
      width: Math.max(1, Math.round(safeWidth)),
      height: Math.max(1, Math.round(safeHeight)),
      hp: safeHp,
      minSpeed,
      maxSpeed,
      behavior: template.behavior,
    };
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
}
