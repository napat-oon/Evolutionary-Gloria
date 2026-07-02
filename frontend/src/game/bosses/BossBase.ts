import Phaser from 'phaser'
import { TEX } from '../core/textures'
import type { Player } from '../player/Player'
import type { StarColor } from './ConstellationTracker'

/** What a boss needs from its arena; keeps bosses decoupled from the scene. */
export interface BossArena {
  readonly player: Player
  /** Boss attack windup started (drives the other tab's edge glow). */
  announceWindup(): void
  /** Damage the player if not dashing/blocking; routed through the sync layer. */
  hitPlayer(amount: number): void
  /** A special attack fired: try to add a constellation star. */
  addStar(color: StarColor): void
  /** Current multiplier applied to damage the bosses take (Sirius aura). */
  bossDamageMultiplier: number
}

export interface SpecialAttack {
  readonly name: string
  readonly cooldownMs: number
  execute(boss: BossBase, arena: BossArena): void
}

const MELEE_RANGE = 110
const MELEE_DAMAGE = 14
const WAVE_DAMAGE = 10
const MOVE_SPEED = 120

/**
 * Shared behaviour for Sirius and Orion: pursuit, scythe melee, scythe energy
 * waves, and the special-attack scheduler. Specials are injected per twin.
 */
export abstract class BossBase extends Phaser.Physics.Arcade.Sprite {
  abstract readonly bossName: string
  abstract readonly starColor: StarColor
  readonly tintColor: number

  protected readonly arena: BossArena
  private readonly specials: SpecialAttack[]
  private readonly specialCooldowns = new Map<string, number>()
  private nextActionAt = 0
  private acting = false
  private inUltimate = false

  constructor(scene: Phaser.Scene, x: number, y: number, arena: BossArena,
      tintColor: number, specials: SpecialAttack[]) {
    super(scene, x, y, TEX.boss)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setCollideWorldBounds(true)
    this.setTint(tintColor)
    this.tintColor = tintColor
    this.arena = arena
    this.specials = specials
    this.nextActionAt = scene.time.now + 1500
  }

  setUltimate(active: boolean): void {
    this.inUltimate = active
    this.acting = false
    if (active) {
      this.setVelocity(0, 0)
      ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    } else {
      ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(true)
      this.nextActionAt = this.scene.time.now + 1200
    }
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)
    if (!this.active || this.inUltimate || this.acting) return

    const player = this.arena.player
    const distance = Math.abs(player.x - this.x)
    this.setFlipX(player.x < this.x)

    if (time < this.nextActionAt) {
      // Drift toward the player between actions.
      const dir = Math.sign(player.x - this.x)
      this.setVelocityX(distance > 70 ? dir * MOVE_SPEED : 0)
      return
    }

    this.setVelocityX(0)
    const special = this.pickSpecial(time)
    if (special) {
      this.acting = true
      this.specialCooldowns.set(special.name, time + special.cooldownMs)
      this.telegraph(400, () => {
        special.execute(this, this.arena)
        this.arena.addStar(this.starColor)
        this.finishAction(1400)
      })
    } else if (distance <= MELEE_RANGE) {
      this.acting = true
      this.telegraph(350, () => {
        this.scytheSwing()
        this.finishAction(900)
      })
    } else {
      this.acting = true
      this.telegraph(450, () => {
        this.scytheWave()
        this.finishAction(1100)
      })
    }
  }

  /** Flash + windup announcement, then the strike. */
  protected telegraph(ms: number, strike: () => void): void {
    this.arena.announceWindup()
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.45 },
      yoyo: true,
      repeat: Math.max(1, Math.floor(ms / 160)),
      duration: 80,
    })
    this.scene.time.delayedCall(ms, () => {
      if (this.active) strike()
    })
  }

  protected finishAction(recoveryMs: number): void {
    this.acting = false
    this.nextActionAt = this.scene.time.now + recoveryMs
  }

  private pickSpecial(time: number): SpecialAttack | undefined {
    const ready = this.specials.filter(
      (special) => (this.specialCooldowns.get(special.name) ?? 0) <= time,
    )
    if (ready.length === 0) return undefined
    // Specials are preferred but not spammed: 55% chance when one is ready.
    if (Math.random() > 0.55) return undefined
    return ready[Math.floor(Math.random() * ready.length)]
  }

  private scytheSwing(): void {
    const player = this.arena.player
    const dir = Math.sign(player.x - this.x) || 1
    const slash = this.scene.add.image(this.x + dir * 50, this.y, TEX.scythe)
    slash.setFlipX(dir < 0).setScale(1.6).setTint(this.tintColor)
    this.scene.tweens.add({
      targets: slash,
      angle: dir * 120,
      duration: 180,
      onComplete: () => slash.destroy(),
    })
    if (Math.abs(player.x - this.x) <= MELEE_RANGE + 20 && Math.abs(player.y - this.y) < 70) {
      this.arena.hitPlayer(MELEE_DAMAGE)
    }
  }

  private scytheWave(): void {
    const player = this.arena.player
    const aim = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y).normalize()
    const wave = this.scene.physics.add.image(this.x, this.y - 10, TEX.wave)
    wave.setTint(this.tintColor)
    ;(wave.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    wave.setVelocity(aim.x * 360, aim.y * 360)
    wave.setRotation(aim.angle())
    const overlap = this.scene.physics.add.overlap(wave, player, () => {
      wave.destroy()
      this.arena.hitPlayer(WAVE_DAMAGE)
    })
    this.scene.time.delayedCall(2200, () => {
      this.scene.physics.world.removeCollider(overlap)
      if (wave.active) wave.destroy()
    })
  }
}
