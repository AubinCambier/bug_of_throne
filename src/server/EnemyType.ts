import type { ScreenBounds } from './ScreenManager';

export interface MobState {
  id: number;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  hp: number;
  maxHp: number;
  hitFlash: boolean;
}

export interface MobBehaviorContext {
  bounds: ScreenBounds;
  deltaMs: number;
  deltaFrames: number;
  speedMultiplier: number;
}

export interface MobRuntimeState extends MobState {
  baseY: number;
  ageMs: number;
  hitFlashTimer: number;
}

export interface MobBehavior {
  update(mob: MobRuntimeState, context: MobBehaviorContext): void;
}

export interface MobTemplate {
  type: MobState['type'];
  weight: number;
  width: number;
  height: number;
  minSpeed: number;
  maxSpeed: number;
  hp: number;
  behavior: MobBehavior;
}
