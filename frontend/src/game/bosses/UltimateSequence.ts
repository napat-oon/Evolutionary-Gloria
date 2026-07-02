import Phaser from 'phaser'
import { TEX } from '../core/textures'
import type { BossArena } from './BossBase'
import { BossBase } from './BossBase'
import type { ConstellationTracker } from './ConstellationTracker'
import { ORION_TINT } from './Orion'
import { SIRIUS_TINT } from './Sirius'

const EXPLOSION_DAMAGE = 60
const DIVE_DAMAGE = 14

/**
 * The twins' constellation ultimate: crouch-bounce into the air, float in
 * smoke while tracking the player, dive once per stored star (newest first),
 * then meet in the centre for the scythe clash and the map-wide explosion
 * that only the cover wall blocks.
 */
export class UltimateSequence {
  private readonly scene: Phaser.Scene
  private readonly boss: BossBase
  private readonly arena: BossArena
  private readonly tracker: ConstellationTracker
  private readonly wallX: number
  private readonly onDone: () => void
  private smoke?: Phaser.GameObjects.Image
  private hover?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, boss: BossBase, arena: BossArena,
      tracker: ConstellationTracker, wallX: number, onDone: () => void) {
    this.scene = scene
    this.boss = boss
    this.arena = arena
    this.tracker = tracker
    this.wallX = wallX
    this.onDone = onDone
  }

  start(): void {
    const { scene, boss } = this
    boss.setUltimate(true)
    this.arena.announceWindup()

    const floatX = boss.starColor === 'jade' ? 200 : 760 // Sirius left, Orion right
    scene.tweens.chain({
      targets: boss,
      tweens: [
        { scaleY: 0.7, duration: 180 },
        { scaleY: 1, y: boss.y - 130, angle: 360, duration: 420, ease: 'Cubic.easeOut' },
        { x: floatX, y: 140, duration: 500, ease: 'Sine.easeInOut' },
      ],
      onComplete: () => this.floatAndTrack(),
    })
  }

  private floatAndTrack(): void {
    const { scene, boss } = this
    this.smoke = scene.add.image(boss.x, boss.y, TEX.smoke)
      .setTint(boss.tintColor).setScale(1.6).setDepth(4)
    scene.tweens.add({
      targets: this.smoke, alpha: { from: 0.9, to: 0.4 }, yoyo: true, repeat: -1, duration: 350,
    })
    // Track the player's x while floating.
    this.hover = scene.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        boss.x = Phaser.Math.Linear(boss.x, this.arena.player.x, 0.03)
        this.smoke?.setPosition(boss.x, boss.y)
      },
    })
    scene.time.delayedCall(1500, () => this.diveNext())
  }

  private diveNext(): void {
    const star = this.tracker.consumeNewest()
    this.scene.events.emit('constellation:changed')
    if (star === undefined) {
      this.finale()
      return
    }
    const { scene, boss } = this
    const targetX = this.arena.player.x
    const targetY = this.arena.player.y
    const returnY = 140
    // Dive colored by the consumed star, in a random slanted angle feel.
    const flash = scene.add.image(boss.x, boss.y, TEX.spark)
      .setTint(star === 'jade' ? SIRIUS_TINT : ORION_TINT).setScale(3)
    scene.tweens.add({ targets: flash, alpha: 0, duration: 250, onComplete: () => flash.destroy() })

    scene.tweens.add({
      targets: boss,
      x: targetX + Phaser.Math.Between(-40, 40),
      y: targetY,
      duration: 360,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        if (Phaser.Math.Distance.Between(
            this.arena.player.x, this.arena.player.y, boss.x, boss.y) < 75) {
          this.arena.hitPlayer(DIVE_DAMAGE)
        }
        scene.tweens.add({
          targets: boss,
          y: returnY,
          duration: 320,
          ease: 'Sine.easeOut',
          onComplete: () => scene.time.delayedCall(260, () => this.diveNext()),
        })
      },
    })
  }

  private finale(): void {
    const { scene, boss } = this
    this.hover?.remove()
    const centerX = 480
    const centerY = 200

    // The twin from the other dimension appears for the clash.
    const ghostTint = boss.starColor === 'jade' ? ORION_TINT : SIRIUS_TINT
    const ghost = scene.add.image(centerX + 120, centerY, TEX.boss)
      .setTint(ghostTint).setAlpha(0.85).setFlipX(true)

    scene.tweens.add({ targets: ghost, x: centerX + 40, angle: 360, duration: 700 })
    scene.tweens.add({
      targets: boss,
      x: centerX - 40,
      y: centerY,
      angle: -360,
      duration: 700,
      onComplete: () => {
        // Clash, pull back, then the punch that levels the map.
        const clash = scene.add.image(centerX, centerY, TEX.spark).setScale(5)
        scene.tweens.add({ targets: clash, alpha: 0, duration: 300, onComplete: () => clash.destroy() })
        this.arena.announceWindup()
        scene.time.delayedCall(1000, () => {
          const blast = scene.add.rectangle(480, 270, 960, 540, 0xfff3d6, 0.9).setDepth(9)
          scene.tweens.add({ targets: blast, alpha: 0, duration: 600, onComplete: () => blast.destroy() })
          scene.cameras.main.shake(400, 0.02)
          const player = this.arena.player
          const shielded = player.x > this.wallX + 18 // behind the cover wall
          if (!shielded) {
            this.arena.hitPlayer(EXPLOSION_DAMAGE)
          }
          ghost.destroy()
          this.cleanup()
        })
      },
    })
  }

  private cleanup(): void {
    this.hover?.remove()
    this.smoke?.destroy()
    this.tracker.clear()
    this.scene.events.emit('constellation:changed')
    const boss = this.boss
    this.scene.tweens.add({
      targets: boss,
      y: 430,
      duration: 400,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        boss.setUltimate(false)
        this.onDone()
      },
    })
  }
}
