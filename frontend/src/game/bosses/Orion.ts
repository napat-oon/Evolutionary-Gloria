import Phaser from 'phaser'
import { TEX } from '../core/textures'
import type { BossArena, SpecialAttack } from './BossBase'
import { BossBase } from './BossBase'

export const ORION_TINT = 0xe4556e

/** Dashes to the player and charges a wide horizontal swipe. */
class DashSwipe implements SpecialAttack {
  readonly name = 'dash-swipe'
  readonly cooldownMs = 8000

  execute(boss: BossBase, arena: BossArena): void {
    const scene = boss.scene
    const targetX = arena.player.x
    scene.tweens.add({
      targets: boss,
      x: targetX + (boss.x > targetX ? 70 : -70),
      duration: 260,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        if (!boss.active) return
        // Charge, then a wide horizontal strike.
        scene.time.delayedCall(450, () => {
          if (!boss.active) return
          const dir = Math.sign(arena.player.x - boss.x) || 1
          const slash = scene.add.image(boss.x + dir * 60, boss.y, TEX.scythe)
          slash.setTint(ORION_TINT).setScale(2.4).setFlipX(dir < 0)
          scene.tweens.add({
            targets: slash, angle: dir * 160, duration: 200,
            onComplete: () => slash.destroy(),
          })
          if (Math.abs(arena.player.x - boss.x) < 170 && Math.abs(arena.player.y - boss.y) < 60) {
            arena.hitPlayer(20)
          }
        })
      },
    })
  }
}

/**
 * Shrouds Orion in a red shell (and Sirius in a green one in the other
 * dimension); damaging a shelled boss primes a delayed explosion.
 */
class ExplosiveShell implements SpecialAttack {
  readonly name = 'explosive-shell'
  readonly cooldownMs = 16000
  private static readonly SHELL_MS = 6000

  execute(boss: BossBase, arena: BossArena): void {
    const scene = boss.scene
    const shell = scene.add.image(boss.x, boss.y, TEX.shell)
    shell.setTint(boss.tintColor === ORION_TINT ? 0xff5050 : 0x50ff8a)
    scene.events.emit('boss:shell-on')
    const follow = scene.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => shell.setPosition(boss.x, boss.y),
    })

    const onDamaged = () => {
      scene.time.delayedCall(1200, () => {
        if (!boss.active) return
        const blast = scene.add.image(boss.x, boss.y, TEX.aoe)
        blast.setTint(0xff7a3c).setScale(2.6, 2.2)
        scene.tweens.add({ targets: blast, alpha: 0, duration: 350, onComplete: () => blast.destroy() })
        if (Phaser.Math.Distance.Between(arena.player.x, arena.player.y, boss.x, boss.y) < 150) {
          arena.hitPlayer(22)
        }
      })
    }
    scene.events.on('boss:damaged', onDamaged)

    scene.time.delayedCall(ExplosiveShell.SHELL_MS, () => {
      scene.events.off('boss:damaged', onDamaged)
      scene.events.emit('boss:shell-off')
      follow.remove()
      shell.destroy()
    })
  }
}

/** A small red black hole drifts onward, pulling and grinding the player. */
class BlackHole implements SpecialAttack {
  readonly name = 'black-hole'
  readonly cooldownMs = 15000

  execute(boss: BossBase, arena: BossArena): void {
    const scene = boss.scene
    const dir = Math.sign(arena.player.x - boss.x) || 1
    const hole = scene.physics.add.image(boss.x + dir * 40, boss.y - 40, TEX.blackhole)
    ;(hole.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    hole.setVelocity(dir * 60, -10)
    scene.tweens.add({ targets: hole, angle: 360, repeat: -1, duration: 1200 })

    let lastTick = 0
    const pull = scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const player = arena.player
        const distance = Phaser.Math.Distance.Between(player.x, player.y, hole.x, hole.y)
        if (distance < 220 && player.isControlled) {
          const toHole = new Phaser.Math.Vector2(hole.x - player.x, hole.y - player.y).normalize()
          const body = player.body as Phaser.Physics.Arcade.Body
          body.velocity.x += toHole.x * 14
          body.velocity.y += toHole.y * 8
        }
        if (distance < 46 && scene.time.now - lastTick > 500) {
          lastTick = scene.time.now
          arena.hitPlayer(6)
        }
      },
    })

    scene.time.delayedCall(6000, () => {
      pull.remove()
      scene.tweens.add({ targets: hole, scale: 0, duration: 250, onComplete: () => hole.destroy() })
    })
  }
}

export class Orion extends BossBase {
  readonly bossName = 'Orion'
  readonly starColor = 'crimson' as const

  constructor(scene: Phaser.Scene, x: number, y: number, arena: BossArena) {
    super(scene, x, y, arena, ORION_TINT,
      [new DashSwipe(), new ExplosiveShell(), new BlackHole()])
  }
}
