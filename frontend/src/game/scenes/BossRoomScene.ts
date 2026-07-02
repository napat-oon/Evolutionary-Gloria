import Phaser from 'phaser'
import type { BossArena } from '../bosses/BossBase'
import { BossBase } from '../bosses/BossBase'
import { ConstellationTracker } from '../bosses/ConstellationTracker'
import type { StarColor } from '../bosses/ConstellationTracker'
import { Orion, ORION_TINT } from '../bosses/Orion'
import { Sirius, SIRIUS_TINT } from '../bosses/Sirius'
import { UltimateSequence } from '../bosses/UltimateSequence'
import { TEX } from '../core/textures'
import { Player } from '../player/Player'
import { SceneSync } from '../sync/SceneSync'
import type { TabSync } from '../sync/TabSync'

const WIDTH = 960
const HEIGHT = 540
const GROUND_Y = 500
const WALL_X = 680
const BOSS_MAX_HP = 600

type FightPhase = 'intro' | 'fighting' | 'ultimate' | 'victory' | 'defeat'

/** The twins' arena: one boss per dimension, shared HP pool, shared stars. */
export class BossRoomScene extends Phaser.Scene {
  private player!: Player
  private boss!: BossBase
  private tabSync?: TabSync
  private readonly tracker = new ConstellationTracker()
  private bossHp = BOSS_MAX_HP
  private phase: FightPhase = 'intro'
  private bossBarFill!: Phaser.GameObjects.Rectangle
  private starDots: Phaser.GameObjects.Image[] = []
  private sparkles: Phaser.GameObjects.Image[] = []
  private ultimatePending = false

  constructor() {
    super('boss-room')
  }

  create(): void {
    this.phase = 'intro'
    this.bossHp = BOSS_MAX_HP
    this.tracker.clear()
    this.ultimatePending = false
    this.tabSync = this.registry.get('tabsync') as TabSync | undefined

    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT)
    this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT)
    this.cameras.main.setBackgroundColor(this.tabSync?.tab === 2 ? '#160a12' : '#0a1612')

    const solids = this.physics.add.staticGroup()
    for (let x = 32; x < WIDTH; x += 64) {
      solids.create(x, GROUND_Y + 32, TEX.ground)
    }
    // Cover wall — the only safe spot during the twins' final explosion.
    solids.create(WALL_X, GROUND_Y - 64, TEX.wall)

    const projectiles = this.physics.add.group()
    this.player = new Player(this, 90, GROUND_Y - 40, projectiles,
      (this.registry.get('potions') as number | undefined) ?? 0)
    this.physics.add.collider(this.player, solids)

    if (this.tabSync) {
      new SceneSync(this, this.player, this.tabSync)
      this.attachBossSyncHandlers(this.tabSync)
    }

    const arena = this.buildArena()
    const isOrionDimension = this.tabSync?.tab === 2
    this.boss = isOrionDimension
      ? new Orion(this, WIDTH - 200, -60, arena)
      : new Sirius(this, WIDTH - 200, -60, arena)
    this.boss.setUltimate(true) // frozen until the intro finishes
    this.physics.add.collider(this.boss, solids)

    // Player attacks damage the shared pool (counted on the controlling tab).
    this.physics.add.overlap(projectiles, this.boss, (_boss, projectileObj) => {
      const projectile = projectileObj as Phaser.Physics.Arcade.Image
      if (!projectile.active || this.phase === 'victory' || this.phase === 'defeat') return
      const damage = (projectile.getData('damage') as number | undefined) ?? 8
      if (projectile.getData('melee')) {
        this.player.vitals.restoreManaFromHit()
      }
      projectile.destroy()
      if (!this.tabSync || this.tabSync.hasControl) {
        this.damageBoss(damage * arena.bossDamageMultiplier)
      }
      this.tweens.add({ targets: this.boss, alpha: { from: 0.5, to: 1 }, duration: 120 })
      this.events.emit('boss:damaged')
    })

    this.buildFightUi()
    this.events.on('player:death', () => this.endFight(false, true))
    this.events.on('constellation:changed', () => this.renderConstellation())
    this.events.on('player:potion', (remaining: number) => {
      this.game.events.emit('potions:used', remaining)
    })

    this.runIntro()
  }

  private buildArena(): BossArena {
    const scene = this
    return {
      player: this.player,
      bossDamageMultiplier: 1,
      announceWindup: () => this.tabSync?.publishWindup(),
      hitPlayer: (amount: number) => {
        if (scene.phase === 'victory' || scene.phase === 'defeat') return
        if (scene.player.isInvulnerable) return // dash-block
        if (!scene.tabSync || scene.tabSync.reportDamage(amount)) {
          scene.player.takeDamage(amount)
        }
      },
      addStar: (color: StarColor) => this.addStar(color, true),
    }
  }

  private attachBossSyncHandlers(sync: TabSync): void {
    // SceneSync owns the core handlers; the boss fight adds its own on top.
    sync.handlers.onStar = (message) => this.addStar(message.color, false)
    sync.handlers.onBossHp = (message) => {
      this.bossHp = message.hp
      this.updateBossBar()
      if (message.hp <= 0) this.endFight(true, false)
    }
    sync.handlers.onFight = (message) => {
      if (message.phase === 'victory') this.endFight(true, false)
      if (message.phase === 'defeat') this.endFight(false, false)
      if (message.phase === 'ultimate') this.startUltimate(false)
    }
  }

  private runIntro(): void {
    this.player.lockFor(2600)
    const title = this.add
      .text(WIDTH / 2, 150, 'SIRIUS & ORION', {
        fontSize: '34px', color: '#e8e6f0', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0)
    const subtitle = this.add
      .text(WIDTH / 2, 190, 'The Twin Constellations', { fontSize: '16px', color: '#9aa0b8' })
      .setOrigin(0.5)
      .setAlpha(0)

    this.tweens.add({ targets: [title, subtitle], alpha: 1, duration: 500 })
    this.tweens.add({ targets: this.boss, y: GROUND_Y - 52, duration: 900, ease: 'Bounce.easeOut', delay: 300 })
    this.time.delayedCall(2400, () => {
      this.tweens.add({
        targets: [title, subtitle], alpha: 0, duration: 400,
        onComplete: () => {
          title.destroy()
          subtitle.destroy()
        },
      })
      this.phase = 'fighting'
      this.boss.setUltimate(false)
      // Tab 1 owns the server-side match lifecycle.
      if (!this.tabSync || this.tabSync.tab === 1) {
        this.game.events.emit('match:start')
      }
    })
  }

  private buildFightUi(): void {
    const bossName = this.tabSync?.tab === 2 ? 'ORION' : 'SIRIUS'
    this.add.rectangle(WIDTH / 2, 26, 424, 16, 0x000000, 0.55).setDepth(8)
    this.bossBarFill = this.add
      .rectangle(WIDTH / 2 - 210, 26, 420, 10, this.tabSync?.tab === 2 ? ORION_TINT : SIRIUS_TINT)
      .setOrigin(0, 0.5)
      .setDepth(8)
    this.add
      .text(WIDTH / 2, 44, `${bossName} — shared twin health`, { fontSize: '11px', color: '#9aa0b8' })
      .setOrigin(0.5)
      .setDepth(8)

    for (let i = 0; i < ConstellationTracker.CAPACITY; i++) {
      this.starDots.push(
        this.add.image(WIDTH / 2 - 90 + i * 30, 66, TEX.starDot).setDepth(8).setAlpha(0.18),
      )
    }
    this.renderConstellation()
  }

  private renderConstellation(): void {
    const stars = this.tracker.list()
    this.starDots.forEach((dot, index) => {
      const star = stars[index]
      if (star) {
        dot.setAlpha(1).setTint(star === 'jade' ? SIRIUS_TINT : ORION_TINT)
      } else {
        dot.setAlpha(0.18).clearTint()
      }
    })

    const full = this.tracker.isFull
    if (full && this.sparkles.length === 0) {
      for (let i = 0; i < 10; i++) {
        const sparkle = this.add
          .image(WIDTH / 2 - 130 + Math.random() * 260, 56 + Math.random() * 24, TEX.starDot)
          .setScale(0.4)
          .setDepth(8)
        this.tweens.add({
          targets: sparkle, alpha: { from: 1, to: 0.2 }, yoyo: true, repeat: -1,
          duration: 300 + Math.random() * 300,
        })
        this.sparkles.push(sparkle)
      }
    } else if (!full && this.sparkles.length > 0) {
      this.sparkles.forEach((sparkle) => sparkle.destroy())
      this.sparkles = []
    }
  }

  private addStar(color: StarColor, broadcast: boolean): void {
    if (this.phase !== 'fighting') return
    if (!this.tracker.add(color)) return
    if (broadcast) this.tabSync?.publishStar(color)
    this.renderConstellation()
    if (this.tracker.isFull && !this.ultimatePending) {
      this.time.delayedCall(900, () => this.startUltimate(true))
    }
  }

  private startUltimate(broadcast: boolean): void {
    if (this.phase !== 'fighting' || this.ultimatePending) return
    this.ultimatePending = true
    this.phase = 'ultimate'
    if (broadcast) this.tabSync?.publishFight('ultimate')
    new UltimateSequence(this, this.boss, this.buildArena(), this.tracker, WALL_X, () => {
      if (this.phase === 'ultimate') {
        this.phase = 'fighting'
        this.ultimatePending = false
      }
    }).start()
  }

  private damageBoss(amount: number): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return
    this.bossHp = Math.max(0, this.bossHp - amount)
    this.tabSync?.publishBossHp(this.bossHp, BOSS_MAX_HP)
    this.updateBossBar()
    if (this.bossHp === 0) {
      this.endFight(true, true)
    }
  }

  private updateBossBar(): void {
    this.bossBarFill.width = Math.max(0, (this.bossHp / BOSS_MAX_HP) * 420)
  }

  private endFight(victory: boolean, broadcast: boolean): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return
    this.phase = victory ? 'victory' : 'defeat'
    if (broadcast) this.tabSync?.publishFight(victory ? 'victory' : 'defeat')

    if (victory) {
      this.boss.setUltimate(true)
      this.tweens.add({
        targets: this.boss, alpha: 0, angle: 90, y: '+=40', duration: 1200,
        onComplete: () => this.boss.destroy(),
      })
    }
    // Tab 1 reports the outcome to the server.
    if (!this.tabSync || this.tabSync.tab === 1) {
      this.game.events.emit('match:finished', victory)
    }
  }
}
