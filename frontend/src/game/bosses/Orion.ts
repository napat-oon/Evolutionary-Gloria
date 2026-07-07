import Phaser from 'phaser'
import { debugHitShape } from '../core/hitboxDebug'
import { TEX } from '../core/textures'
import type { BossArena, SpecialAttack } from './BossBase'
import { BossBase } from './BossBase'

export const ORION_TINT = 0xe4556e

/** Dashes to the player and charges a huge half-oval swipe in front of him. */
class DashSwipe implements SpecialAttack {
  readonly name = 'dash-swipe'
  readonly cooldownMs = 8000
  /** Half-ellipse hitbox: the flat edge starts on Orion, bulging forward. */
  private static readonly REACH_X = 230
  private static readonly REACH_Y = 90

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
        // Charge, then the half-oval strike.
        scene.time.delayedCall(450, () => {
          if (!boss.active) return
          const dir = Math.sign(arena.player.x - boss.x) || 1
          const area = scene.add.image(boss.x + dir * (DashSwipe.REACH_X / 2), boss.y, TEX.aoe)
          area.setTint(ORION_TINT).setAlpha(0.5)
            .setScale(DashSwipe.REACH_X / 96, (DashSwipe.REACH_Y * 2) / 64)
          scene.tweens.add({
            targets: area, alpha: 0, duration: 260,
            onComplete: () => area.destroy(),
          })
          // Debug: the oval reach, with the flat back edge marked on Orion.
          debugHitShape(scene, (g) => {
            g.strokeEllipse(boss.x, boss.y, DashSwipe.REACH_X * 2, DashSwipe.REACH_Y * 2)
            g.lineBetween(boss.x, boss.y - DashSwipe.REACH_Y, boss.x, boss.y + DashSwipe.REACH_Y)
          })
          const dx = arena.player.x - boss.x
          const dy = arena.player.y - boss.y
          const inFront = Math.sign(dx) === dir || dx === 0
          const inOval =
            (dx / DashSwipe.REACH_X) ** 2 + (dy / DashSwipe.REACH_Y) ** 2 <= 1
          if (inFront && inOval) {
            arena.hitPlayer(20, { x: boss.x, y: boss.y })
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
  private static readonly EXPLOSION_DELAY_MS = 1200
  private static readonly AFTER_EXPLOSION_COOLDOWN_MS = 5000

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

    const dismantle = () => {
      scene.events.off('boss:damaged', onDamaged)
      scene.events.emit('boss:shell-off')
      follow.remove()
      shell.destroy()
    }

    // Only the FIRST hit primes the (single) delayed explosion, and the
    // ability's next use is counted from when that explosion goes off.
    const onDamaged = () => {
      scene.events.off('boss:damaged', onDamaged)
      scene.time.delayedCall(ExplosiveShell.EXPLOSION_DELAY_MS, () => {
        if (shell.active) dismantle()
        boss.setSpecialCooldown(this.name,
          scene.time.now + ExplosiveShell.AFTER_EXPLOSION_COOLDOWN_MS)
        if (!boss.active) return
        const blast = scene.add.image(boss.x, boss.y, TEX.aoe)
        blast.setTint(0xff7a3c).setScale(2.6, 2.2)
        scene.tweens.add({ targets: blast, alpha: 0, duration: 350, onComplete: () => blast.destroy() })
        debugHitShape(scene, (g) => g.strokeCircle(boss.x, boss.y, 150))
        if (Phaser.Math.Distance.Between(arena.player.x, arena.player.y, boss.x, boss.y) < 150) {
          // The shell burst washes around the shield; only distance (or
          // dash i-frames) escapes it.
          arena.hitPlayer(22, { x: boss.x, y: boss.y }, { unblockable: true })
        }
      })
    }
    scene.events.on('boss:damaged', onDamaged)

    scene.time.delayedCall(ExplosiveShell.SHELL_MS, () => {
      if (shell.active) dismantle()
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
        debugHitShape(scene, (g) => {
          g.strokeCircle(hole.x, hole.y, 240) // pull radius
          g.strokeCircle(hole.x, hole.y, 46) // grind radius
        }, 60)
        if (distance < 240 && player.isControlled) {
          const toHole = new Phaser.Math.Vector2(hole.x - player.x, hole.y - player.y).normalize()
          const body = player.body as Phaser.Physics.Arcade.Body
          body.velocity.x += toHole.x * 128
          body.velocity.y += toHole.y * 84
        }
        if (distance < 46 && scene.time.now - lastTick > 500) {
          lastTick = scene.time.now
          // The grind ignores the shield arc; dash i-frames still avoid it.
          arena.hitPlayer(6, { x: hole.x, y: hole.y }, { unblockable: true })
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
