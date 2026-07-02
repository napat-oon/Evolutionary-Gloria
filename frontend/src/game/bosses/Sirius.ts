import Phaser from 'phaser'
import { TEX } from '../core/textures'
import type { BossArena, SpecialAttack } from './BossBase'
import { BossBase } from './BossBase'

export const SIRIUS_TINT = 0x5ad08a

/** Throws the scythe at the player; it boomerangs back. */
class BoomerangScythe implements SpecialAttack {
  readonly name = 'boomerang-scythe'
  readonly cooldownMs = 9000

  execute(boss: BossBase, arena: BossArena): void {
    const scene = boss.scene
    const scythe = scene.physics.add.image(boss.x, boss.y - 10, TEX.scythe)
    scythe.setTint(SIRIUS_TINT).setScale(1.4)
    ;(scythe.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    const target = new Phaser.Math.Vector2(arena.player.x, arena.player.y)
    let hitDone = false
    const overlap = scene.physics.add.overlap(scythe, arena.player, () => {
      if (hitDone) return
      hitDone = true
      arena.hitPlayer(16)
    })
    scene.tweens.add({ targets: scythe, angle: 1080, duration: 1600 })
    scene.tweens.add({
      targets: scythe,
      x: target.x,
      y: target.y,
      duration: 700,
      ease: 'Sine.easeOut',
      yoyo: true, // boomerang back
      onYoyo: () => {
        hitDone = false // it can clip you on the way back too
      },
      onComplete: () => {
        scene.physics.world.removeCollider(overlap)
        scythe.destroy()
      },
    })
  }
}

/** Seven jade stars hover in a half circle, then fire one by one. */
class StarVolley implements SpecialAttack {
  readonly name = 'star-volley'
  readonly cooldownMs = 14000

  execute(boss: BossBase, arena: BossArena): void {
    const scene = boss.scene
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI + (i / 6) * Math.PI // half circle above the boss
      const offset = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)).scale(70)
      const star = scene.physics.add.image(boss.x + offset.x, boss.y + offset.y - 20, TEX.star)
      star.setTint(SIRIUS_TINT)
      ;(star.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)

      scene.time.delayedCall(600 + i * 350, () => {
        if (!star.active) return
        const aim = new Phaser.Math.Vector2(
          arena.player.x - star.x, arena.player.y - star.y).normalize()
        star.setVelocity(aim.x * 430, aim.y * 430)
        const overlap = scene.physics.add.overlap(star, arena.player, () => {
          star.destroy()
          arena.hitPlayer(8)
        })
        scene.time.delayedCall(1800, () => {
          scene.physics.world.removeCollider(overlap)
          if (star.active) star.destroy()
        })
      })
    }
  }
}

/** Lingering circle that halves damage the twins take while Sirius holds it. */
class WardingCircle implements SpecialAttack {
  readonly name = 'warding-circle'
  readonly cooldownMs = 18000
  private static readonly DURATION_MS = 6500

  execute(boss: BossBase, arena: BossArena): void {
    const scene = boss.scene
    const circle = scene.add.image(boss.x, boss.y + 12, TEX.aoe)
    circle.setTint(SIRIUS_TINT).setAlpha(0.4).setScale(2.2, 1.4)
    arena.bossDamageMultiplier = 0.5
    scene.tweens.add({ targets: circle, alpha: 0.25, yoyo: true, repeat: -1, duration: 500 })
    scene.time.delayedCall(WardingCircle.DURATION_MS, () => {
      arena.bossDamageMultiplier = 1
      circle.destroy()
    })
  }
}

export class Sirius extends BossBase {
  readonly bossName = 'Sirius'
  readonly starColor = 'jade' as const

  constructor(scene: Phaser.Scene, x: number, y: number, arena: BossArena) {
    super(scene, x, y, arena, SIRIUS_TINT,
      [new BoomerangScythe(), new StarVolley(), new WardingCircle()])
  }
}
