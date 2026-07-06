import Phaser from 'phaser'
import { TEX } from '../core/textures'
import type { AttackPattern, CastContext } from './AttackPattern'
import { AttackRegistry } from './AttackPattern'

function spawnProjectile(
  ctx: CastContext,
  texture: string,
  x: number,
  y: number,
  velocity: Phaser.Math.Vector2,
  lifeMs: number,
  damage = 10,
): Phaser.Physics.Arcade.Image {
  const projectile = ctx.projectiles.create(x, y, texture) as Phaser.Physics.Arcade.Image
  projectile.setData('damage', damage)
  if (ctx.remote) projectile.setData('remote', true)
  const body = projectile.body as Phaser.Physics.Arcade.Body
  body.setAllowGravity(false)
  projectile.setVelocity(velocity.x, velocity.y)
  projectile.setRotation(velocity.angle())
  ctx.scene.time.delayedCall(lifeMs, () => projectile.destroy())
  return projectile
}

/** Right click standing still: short delay, then a shotgun spread of stars. */
class StarShotgun implements AttackPattern {
  readonly id = 'star-shotgun' as const
  readonly manaCost = 20

  cast(ctx: CastContext): void {
    ctx.player.lockFor(350)
    ctx.scene.time.delayedCall(250, () => {
      if (!ctx.player.active) return
      const baseAngle = ctx.aim.angle()
      for (let i = -2; i <= 2; i++) {
        const angle = baseAngle + i * 0.14
        const velocity = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)).scale(520)
        spawnProjectile(ctx, TEX.star, ctx.player.x, ctx.player.y, velocity, 900, 8)
      }
    })
  }
}

/**
 * Right click while moving: morph into water and rush in that direction,
 * shrinking to ~1/5 size — small enough to slip under the arena walls.
 */
class WaterRush implements AttackPattern {
  readonly id = 'water-rush' as const
  readonly manaCost = 20

  cast(ctx: CastContext): void {
    const dir = ctx.moveDir || ctx.player.facing
    ctx.player.lockFor(320)
    ctx.player.setTint(0x53a8ff)
    ctx.player.setInvulnerable(320)
    ctx.player.setScale(0.2)
    ctx.player.setVelocity(dir * 560, 0)
    const trail = ctx.scene.time.addEvent({
      delay: 40,
      repeat: 6,
      callback: () => {
        const drop = ctx.scene.add.image(ctx.player.x, ctx.player.y, TEX.spark).setTint(0x53a8ff)
        ctx.scene.tweens.add({ targets: drop, alpha: 0, duration: 250, onComplete: () => drop.destroy() })
      },
    })
    ctx.scene.time.delayedCall(320, () => {
      trail.remove()
      ctx.player.clearTint()
      ctx.player.setScale(1)
    })
  }
}

/** Right click + W: dash up, hover charging, then strike diagonally down. */
class ElectricDive implements AttackPattern {
  readonly id = 'electric-dive' as const
  readonly manaCost = 25

  cast(ctx: CastContext): void {
    const player = ctx.player
    player.lockFor(1250)
    player.setVelocity(0, -480)
    ctx.scene.time.delayedCall(240, () => {
      if (!player.active) return
      player.setGravityDisabled(true)
      player.setVelocity(0, 0)
      player.setTint(0xfff35c)
      ctx.scene.time.delayedCall(700, () => {
        if (!player.active) return
        player.setGravityDisabled(false)
        player.clearTint()
        const dir = player.currentMoveDir() || player.facing
        player.setVelocity(dir * 520, 640)
        for (let i = 0; i < 5; i++) {
          ctx.scene.time.delayedCall(i * 50, () => {
            const spark = ctx.scene.add.image(player.x, player.y, TEX.spark)
            ctx.scene.tweens.add({ targets: spark, alpha: 0, duration: 200, onComplete: () => spark.destroy() })
          })
        }
        spawnProjectile(ctx, TEX.spark, player.x, player.y,
          new Phaser.Math.Vector2(dir * 520, 640), 500, 18)
      })
    })
  }
}

/** Right click + S: wreath in fire and plunge down through passable floors. */
class FirePlunge implements AttackPattern {
  readonly id = 'fire-plunge' as const
  readonly manaCost = 25

  cast(ctx: CastContext): void {
    const player = ctx.player
    player.lockFor(220)
    player.setTint(0xff7a3c)
    ctx.scene.time.delayedCall(220, () => {
      if (!player.active) return
      player.beginFirePlunge() // interruptible by any input; keeps momentum
    })
  }
}

/** Ctrl + Right click standing still: quick charge, dark oval swing around self. */
class DarkSwing implements AttackPattern {
  readonly id = 'dark-swing' as const
  readonly manaCost = 30

  cast(ctx: CastContext): void {
    ctx.player.lockFor(450)
    ctx.scene.time.delayedCall(200, () => {
      if (!ctx.player.active) return
      const aoe = ctx.projectiles.create(ctx.player.x, ctx.player.y, TEX.aoe) as Phaser.Physics.Arcade.Image
      aoe.setData('damage', 24)
      if (ctx.remote) aoe.setData('remote', true)
      aoe.setScale(1.9, 1) // wide swing reaching out to both sides
      ;(aoe.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      ctx.scene.tweens.add({ targets: aoe, alpha: { from: 0.9, to: 0 }, duration: 300 })
      ctx.scene.time.delayedCall(300, () => aoe.destroy())
    })
  }
}

/** Ctrl + Right click moving: float a leaf that does a delayed blade dash. */
class LeafBlade implements AttackPattern {
  readonly id = 'leaf-blade' as const
  readonly manaCost = 25

  cast(ctx: CastContext): void {
    const spawnX = ctx.player.x + (ctx.moveDir || ctx.player.facing) * 60
    const spawnY = ctx.player.y - 40
    const leaf = ctx.scene.physics.add.image(spawnX, spawnY, TEX.leaf)
    ;(leaf.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    ctx.scene.tweens.add({ targets: leaf, y: '-=8', yoyo: true, repeat: 3, duration: 120 })
    // Strike straight at where the mouse pointed, not offset by the leaf's
    // hover height — measured from the leaf itself.
    const target = ctx.aimPoint.clone()
    ctx.scene.time.delayedCall(650, () => {
      if (!leaf.active) return
      leaf.destroy()
      const velocity = new Phaser.Math.Vector2(target.x - spawnX, target.y - spawnY)
      if (velocity.lengthSq() === 0) velocity.set(ctx.player.facing, 0)
      velocity.normalize().scale(620)
      spawnProjectile(ctx, TEX.leaf, spawnX, spawnY, velocity, 600, 22)
    })
  }
}

/** Ctrl + Right click + W: two ribbons stretch and strike upward fast. */
class TwinRibbons implements AttackPattern {
  readonly id = 'twin-ribbons' as const
  readonly manaCost = 25

  cast(ctx: CastContext): void {
    ctx.player.lockFor(300)
    for (const offset of [-12, 12]) {
      const ribbon = ctx.projectiles.create(
        ctx.player.x + offset, ctx.player.y - 30, TEX.ribbon) as Phaser.Physics.Arcade.Image
      ribbon.setData('damage', 14)
      ;(ribbon.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      ribbon.setVelocity(offset * 2, -680)
      ctx.scene.tweens.add({ targets: ribbon, scaleY: 2.2, duration: 250 })
      ctx.scene.time.delayedCall(420, () => ribbon.destroy())
    }
  }
}

/** Ctrl + Right click + S: stomp and rain icicle spears down through the floors. */
class IcicleStomp implements AttackPattern {
  readonly id = 'icicle-stomp' as const
  readonly manaCost = 30

  cast(ctx: CastContext): void {
    const player = ctx.player
    player.lockFor(500)
    player.setVelocity(0, 240)
    ctx.scene.time.delayedCall(250, () => {
      if (!player.active) return
      const startY = player.y + 14
      for (let i = 0; i < 5; i++) {
        const x = player.x - 90 + i * 45
        ctx.scene.time.delayedCall(i * 60, () => {
          const icicle = ctx.projectiles.create(x, startY, TEX.icicle) as Phaser.Physics.Arcade.Image
          icicle.setData('damage', 16)
          if (ctx.remote) icicle.setData('remote', true)
          icicle.setFlipY(true) // point downward
          ;(icicle.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
          icicle.setVelocity(0, 340)
          ctx.scene.time.delayedCall(900, () => icicle.destroy())
        })
      }
    })
  }
}

export function buildAttackRegistry(): AttackRegistry {
  return new AttackRegistry()
    .register(new StarShotgun())
    .register(new WaterRush())
    .register(new ElectricDive())
    .register(new FirePlunge())
    .register(new DarkSwing())
    .register(new LeafBlade())
    .register(new TwinRibbons())
    .register(new IcicleStomp())
}
