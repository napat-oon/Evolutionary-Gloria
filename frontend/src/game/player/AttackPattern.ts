import type Phaser from 'phaser'
import type { AbilityId } from '../core/intents'
import type { Player } from './Player'

/** Everything an ability needs at cast time. */
export interface CastContext {
  scene: Phaser.Scene
  player: Player
  /** Normalised direction from the player toward the mouse. */
  aim: Phaser.Math.Vector2
  /** The mouse position in world coordinates at cast time. */
  aimPoint: Phaser.Math.Vector2
  /** Horizontal input at cast time: -1, 0 or 1. */
  moveDir: -1 | 0 | 1
  /** Physics group that player attacks spawn into (collides with enemies). */
  projectiles: Phaser.Physics.Arcade.Group
  /** True when replaying the other tab's cast — visuals only, no boss damage. */
  remote: boolean
}

/**
 * One elemental ability. New abilities are added by implementing this
 * interface and registering the class — no changes to Player or scenes.
 */
export interface AttackPattern {
  readonly id: AbilityId
  readonly manaCost: number
  cast(ctx: CastContext): void
}

export class AttackRegistry {
  private readonly patterns = new Map<AbilityId, AttackPattern>()

  register(pattern: AttackPattern): this {
    this.patterns.set(pattern.id, pattern)
    return this
  }

  get(id: AbilityId): AttackPattern | undefined {
    return this.patterns.get(id)
  }
}
