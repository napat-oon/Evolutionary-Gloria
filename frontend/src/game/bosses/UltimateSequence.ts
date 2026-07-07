import Phaser from 'phaser'
import { debugHitShape } from '../core/hitboxDebug'
import { TEX } from '../core/textures'
import type { BossArena } from './BossBase'
import { BossBase } from './BossBase'
import type { ConstellationTracker } from './ConstellationTracker'
import { ORION_TINT } from './Orion'
import { SIRIUS_TINT } from './Sirius'

const EXPLOSION_DAMAGE = 40
const DIVE_DAMAGE = 14
/** Windup before the map-wide finale blast — long enough to reach a wall. */
const FINALE_DELAY_MS = 2000
/** The dive halts this far from Eevee (radially) before detonating. */
const DIVE_STANDOFF = 100
/** How long the twin holds dead-still at the standoff before the blast. */
const DIVE_PAUSE_MS = 100
/** Dive blast radius, measured from the twin's center (the block source). */
const DIVE_RADIUS = 300
/** Wait between dives; also used to stay in step when the OTHER twin dives.
 *  Must match one full dive: dash 360 + pause 100 + rise 320 + settle 260. */
const DIVE_CYCLE_MS = 1040

/** Everything the sequence needs to know about the room's geometry. */
export interface UltimateLayout {
  worldWidth: number
  worldHeight: number
  groundY: number
  centerX: number
  leftWallX: number
  rightWallX: number
  /** Top edge of the cover walls — cover only counts below this height. */
  wallTopY: number
}

/**
 * The twins' constellation ultimate: Eevee is dragged to the centre of the
 * map, the twins crouch-bounce into the air and float in smoke, then dive
 * once per stored star (newest first) — each dive is performed by the twin
 * whose color matches the consumed star, in its own dimension. Dives cannot
 * be dodged, only blocked. The finale explosion can be neither dodged nor
 * blocked; only crouching behind a cover wall — outside it in X and below
 * its top edge — survives it.
 */
export class UltimateSequence {
  private readonly scene: Phaser.Scene
  private readonly boss: BossBase
  private readonly arena: BossArena
  private readonly tracker: ConstellationTracker
  private readonly layout: UltimateLayout
  private readonly onDone: () => void
  private smoke?: Phaser.GameObjects.Image
  private hover?: Phaser.Time.TimerEvent
  /** True from dash until risen back — the hover lerp must let go, or the
   *  twin drifts toward its float anchor while holding at the standoff. */
  private diving = false

  constructor(scene: Phaser.Scene, boss: BossBase, arena: BossArena,
      tracker: ConstellationTracker, layout: UltimateLayout, onDone: () => void) {
    this.scene = scene
    this.boss = boss
    this.arena = arena
    this.tracker = tracker
    this.layout = layout
    this.onDone = onDone
  }

  start(): void {
    const { scene, boss, layout } = this
    boss.setUltimate(true)
    this.arena.announceWindup()

    // The stars drag Eevee to the centre of the map for the ritual.
    const player = this.arena.player
    if (player.isControlled) {
      player.setPosition(layout.centerX, layout.groundY - 40)
      player.setVelocity(0, 0)
    }

    const float = this.floatTarget()
    scene.tweens.chain({
      targets: boss,
      tweens: [
        { scaleY: 0.7, duration: 180 },
        { scaleY: 1, y: boss.y - 130, angle: 360, duration: 420, ease: 'Cubic.easeOut' },
        { x: float.x, y: float.y, duration: 500, ease: 'Sine.easeInOut' },
      ],
      onComplete: () => this.floatAndTrack(),
    })
  }

  /** Hover anchor pinned to the camera view, so the twin never floats
   *  off-screen while the camera follows the player. */
  private floatTarget(): { x: number; y: number } {
    const view = this.scene.cameras.main.worldView
    return {
      x: this.boss.starColor === 'jade' ? view.left + 170 : view.right - 170,
      y: view.top + 120,
    }
  }

  private floatAndTrack(): void {
    const { scene, boss } = this
    this.smoke = scene.add.image(boss.x, boss.y, TEX.smoke)
      .setTint(boss.tintColor).setScale(1.6).setDepth(4)
    scene.tweens.add({
      targets: this.smoke, alpha: { from: 0.9, to: 0.4 }, yoyo: true, repeat: -1, duration: 350,
    })
    // Stay glued to the camera view edge while floating.
    this.hover = scene.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        if (this.diving) {
          this.smoke?.setPosition(boss.x, boss.y)
          return
        }
        const target = this.floatTarget()
        boss.x = Phaser.Math.Linear(boss.x, target.x, 0.12)
        boss.y = Phaser.Math.Linear(boss.y, target.y, 0.12)
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
    // Each star is dived by the twin of that color — in ITS dimension. The
    // other dimension's twin keeps floating for one cycle so both tabs stay
    // in step.
    if (star !== this.boss.starColor) {
      this.scene.time.delayedCall(DIVE_CYCLE_MS, () => this.diveNext())
      return
    }
    const { scene, boss } = this
    const player = this.arena.player
    // The dash pulls up short of Eevee: the twin stops dead on the standoff
    // circle around them (whatever the approach angle), holds, then the
    // blast erupts from the twin's own center — so the shield arc has a
    // clear direction to catch it from.
    const dx = player.x - boss.x
    const dy = player.y - boss.y
    const approach = Math.hypot(dx, dy) || 1
    const targetX = player.x - (dx / approach) * DIVE_STANDOFF
    const targetY = player.y - (dy / approach) * DIVE_STANDOFF
    const flash = scene.add.image(boss.x, boss.y, TEX.spark)
      .setTint(star === 'jade' ? SIRIUS_TINT : ORION_TINT).setScale(3)
    scene.tweens.add({ targets: flash, alpha: 0, duration: 250, onComplete: () => flash.destroy() })

    this.diving = true
    scene.tweens.add({
      targets: boss,
      x: targetX,
      y: targetY,
      duration: 360,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        scene.time.delayedCall(DIVE_PAUSE_MS, () => {
          const blast = scene.add.image(boss.x, boss.y, TEX.aoe)
            .setTint(boss.tintColor)
            .setScale((DIVE_RADIUS * 2) / 96, (DIVE_RADIUS * 2) / 64)
          scene.tweens.add({ targets: blast, alpha: 0, duration: 300, onComplete: () => blast.destroy() })
          debugHitShape(scene, (g) => g.strokeCircle(boss.x, boss.y, DIVE_RADIUS))
          if (Phaser.Math.Distance.Between(
              player.x, player.y, boss.x, boss.y) < DIVE_RADIUS) {
            // Undodgable — only the shield arc (or a wall) helps.
            this.arena.hitPlayer(DIVE_DAMAGE, { x: boss.x, y: boss.y }, { undodgeable: true })
          }
          scene.tweens.add({
            targets: boss,
            y: this.floatTarget().y,
            duration: 320,
            ease: 'Sine.easeOut',
            onComplete: () => {
              this.diving = false // back on the float — drift resumes
              scene.time.delayedCall(260, () => this.diveNext())
            },
          })
        })
      },
    })
  }

  private finale(): void {
    const { scene, boss, layout } = this
    this.hover?.remove()
    // Clash where the player can see it: the middle of the camera view,
    // brought down near the ground instead of high in the sky.
    const view = scene.cameras.main.worldView
    const centerX = view.centerX
    const centerY = Math.max(view.top + 150, layout.groundY - 240)

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
        scene.time.delayedCall(FINALE_DELAY_MS, () => {
          const blast = scene.add.rectangle(
            layout.worldWidth / 2, layout.worldHeight / 2,
            layout.worldWidth, layout.worldHeight, 0xfff3d6, 0.9).setDepth(9)
          scene.tweens.add({ targets: blast, alpha: 0, duration: 600, onComplete: () => blast.destroy() })
          scene.cameras.main.shake(400, 0.02)
          const player = this.arena.player
          // Cover only counts when actually ducked behind a wall: outside
          // the walls in X AND below their top edge — the blast sails over
          // anyone hovering above wall height.
          debugHitShape(scene, (g) => {
            g.strokeRect(
              layout.leftWallX - 18, 0,
              layout.rightWallX + 18 - (layout.leftWallX - 18), layout.worldHeight)
            g.strokeRect(0, 0, layout.leftWallX - 18, layout.wallTopY)
            g.strokeRect(
              layout.rightWallX + 18, 0,
              layout.worldWidth - (layout.rightWallX + 18), layout.wallTopY)
          }, 900, 0xff3030)
          const behindWall =
            player.x < layout.leftWallX - 18 || player.x > layout.rightWallX + 18
          const shielded = behindWall && player.y > layout.wallTopY
          if (!shielded) {
            this.arena.hitPlayer(EXPLOSION_DAMAGE, undefined,
              { undodgeable: true, unblockable: true })
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
      y: this.layout.groundY - 70,
      duration: 400,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        boss.setUltimate(false)
        this.onDone()
      },
    })
  }
}
