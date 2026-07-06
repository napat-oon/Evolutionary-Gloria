import Phaser from 'phaser'
import { debugHitShape } from '../core/hitboxDebug'
import { TEX } from '../core/textures'
import type { Player } from '../player/Player'
import type { StarColor } from './ConstellationTracker'

/** How a hit may be avoided; the arena resolves dodge/block against these. */
export interface HitOptions {
  /** Ignores dash/dodge i-frames (the twins' ultimate dives and finale). */
  undodgeable?: boolean
  /** Ignores the mouse-aimed shield arc (only cover walls help). */
  unblockable?: boolean
}

/** What a boss needs from its arena; keeps bosses decoupled from the scene. */
export interface BossArena {
  readonly player: Player
  /** Boss attack windup started (drives the other tab's edge glow). */
  announceWindup(): void
  /**
   * Damage the player if not dashing/blocking; routed through the sync layer.
   * `source` is where the hit comes from — the shield arc blocks by angle.
   */
  hitPlayer(amount: number, source?: { x: number; y: number }, options?: HitOptions): void
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
/** Turn-start swoop toward Eevee: fast, but stops at a standoff distance. */
const APPROACH_SPEED = 360
const APPROACH_STANDOFF = 100
const APPROACH_MS = 900
/** The twins take turns in random 5–8s slots. Both tabs derive the same
 *  slot schedule from the machine's wall clock, so no sync messages are
 *  needed (see turnParityAt). */
const TURN_MIN_MS = 5000
const TURN_MAX_MS = 8000
const HOUR_MS = 3600000
const RETREAT_Y = 150
const RETREAT_SPEED_X = 150
const RETREAT_SPEED_Y = 220

/** Stable hash → [0, 1): the same (hour, slot) gives the same duration. */
function slotDuration(hour: number, slot: number): number {
  let a = (Math.imul(hour, 374761393) + Math.imul(slot, 668265263)) >>> 0
  a = Math.imul(a ^ (a >>> 13), 1274126177) >>> 0
  const r = ((a ^ (a >>> 16)) >>> 0) / 4294967296
  return TURN_MIN_MS + r * (TURN_MAX_MS - TURN_MIN_MS)
}

/**
 * Whose turn is it at wall-clock `now`? Slot boundaries are the cumulative
 * pseudo-random durations from the top of the hour, so every tab on the
 * machine computes the identical schedule with no messages exchanged.
 */
function turnParityAt(now: number): 0 | 1 {
  const hour = Math.floor(now / HOUR_MS)
  let boundary = hour * HOUR_MS
  let slot = 0
  for (;;) {
    const duration = slotDuration(hour, slot)
    if (boundary + duration > now) break
    boundary += duration
    slot++
  }
  return ((hour + slot) % 2) as 0 | 1
}

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
  private retreating = false
  private approachUntil = 0

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

  /** Alternating turns: Sirius on even wall-clock slots, Orion on odd. */
  private get isMyTurn(): boolean {
    return this.starColor === (turnParityAt(Date.now()) === 0 ? 'jade' : 'crimson')
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)
    if (!this.active || this.inUltimate || this.acting) return

    const player = this.arena.player
    const distance = Math.abs(player.x - this.x)
    this.setFlipX(player.x < this.x)

    // Off turn: float away from the player and hold fire.
    if (!this.isMyTurn) {
      if (!this.retreating) {
        this.retreating = true
        ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      }
      const away = Math.sign(this.x - player.x) || 1
      this.setVelocity(
        distance < 420 ? away * RETREAT_SPEED_X : 0,
        Phaser.Math.Clamp((RETREAT_Y - this.y) * 3, -RETREAT_SPEED_Y, RETREAT_SPEED_Y),
      )
      return
    }
    if (this.retreating) {
      this.retreating = false
      ;(this.body as Phaser.Physics.Arcade.Body).setAllowGravity(true)
      this.nextActionAt = time + 700 // a beat to swoop back in
      this.approachUntil = time + APPROACH_MS
    }

    if (time < this.nextActionAt) {
      const dir = Math.sign(player.x - this.x)
      if (time < this.approachUntil && distance > APPROACH_STANDOFF) {
        // Turn start: dash into Eevee's vicinity, stopping at a standoff.
        this.setVelocityX(dir * APPROACH_SPEED)
      } else {
        // Drift toward the player between actions.
        this.setVelocityX(distance > 70 ? dir * MOVE_SPEED : 0)
      }
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

  /** Lets a special override its cooldown (e.g. counted from its explosion). */
  setSpecialCooldown(name: string, readyAtMs: number): void {
    this.specialCooldowns.set(name, readyAtMs)
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
    debugHitShape(this.scene, (g) =>
      g.strokeRect(this.x - (MELEE_RANGE + 20), this.y - 70, (MELEE_RANGE + 20) * 2, 140))
    if (Math.abs(player.x - this.x) <= MELEE_RANGE + 20 && Math.abs(player.y - this.y) < 70) {
      this.arena.hitPlayer(MELEE_DAMAGE, { x: this.x, y: this.y })
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
      const source = { x: wave.x, y: wave.y }
      wave.destroy()
      this.arena.hitPlayer(WAVE_DAMAGE, source)
    })
    this.scene.time.delayedCall(2200, () => {
      this.scene.physics.world.removeCollider(overlap)
      if (wave.active) wave.destroy()
    })
  }
}
