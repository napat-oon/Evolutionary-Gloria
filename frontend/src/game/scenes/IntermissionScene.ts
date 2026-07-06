import Phaser from 'phaser'
import { setupHitboxDebug } from '../core/hitboxDebug'
import { TEX } from '../core/textures'
import { Player } from '../player/Player'
import { SceneSync } from '../sync/SceneSync'
import type { TabSync } from '../sync/TabSync'

const WORLD_WIDTH = 1920
const WORLD_HEIGHT = 540
const GROUND_Y = 500
/** How long a training-dummy DPS run lasts after the last hit. */
const DPS_WINDOW_MS = 5000

/**
 * The stage between the lobby and the boss room: buy potions on the shop pad,
 * practice on the dummy, take the corridor on the right into the boss room.
 */
export class IntermissionScene extends Phaser.Scene {
  private player!: Player
  private projectiles!: Phaser.Physics.Arcade.Group
  private shopZone!: Phaser.GameObjects.Zone
  private shopHint!: Phaser.GameObjects.Text
  private interactKey!: Phaser.Input.Keyboard.Key

  // Training-dummy DPS meter: damage since the first hit, with a 5-second
  // pie that empties clockwise after each hit and resets the run.
  private dpsDamage = 0
  private dpsFirstHitAt = 0
  private dpsLastHitAt = 0
  private dpsText!: Phaser.GameObjects.Text
  private dpsPie!: Phaser.GameObjects.Graphics
  private leavingToBossRoom = false

  constructor() {
    super('intermission')
  }

  create(): void {
    // Late-join adoption: keep the player where the session already is, and
    // drop the state so a later boss-room entry doesn't mistake it for a
    // running fight.
    const adopted = this.registry.get('adopted-state') as
      { scene: string; x: number; y: number } | undefined
    this.registry.remove('adopted-state')
    this.dpsDamage = 0
    this.dpsFirstHitAt = 0
    this.dpsLastHitAt = 0
    this.leavingToBossRoom = false
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setBackgroundColor('#0b0d17')
    setupHitboxDebug(this)

    // Ground and platforms
    const solids = this.physics.add.staticGroup()
    for (let x = 32; x < WORLD_WIDTH; x += 64) {
      solids.create(x, GROUND_Y + 32, TEX.ground)
    }
    // Low platforms — a default jump (no electric dive) clears them.
    const platforms = this.physics.add.staticGroup()
    for (const x of [430, 620]) {
      const platform = platforms.create(x, 410, TEX.platform) as Phaser.Physics.Arcade.Image
      platform.setScale(1.5, 1).refreshBody()
    }
    for (const platform of platforms.getChildren()) {
      const body = (platform as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.StaticBody
      body.checkCollision.down = false
      body.checkCollision.left = false
      body.checkCollision.right = false
    }

    this.projectiles = this.physics.add.group()
    const spawn = adopted?.scene === 'intermission'
      ? { x: adopted.x, y: adopted.y }
      : { x: 120, y: GROUND_Y - 40 }
    this.player = new Player(this, spawn.x, spawn.y, this.projectiles,
      (this.registry.get('potions') as number | undefined) ?? 0)

    this.physics.add.collider(this.player, solids)
    this.physics.add.collider(this.player, platforms, undefined,
      () => !this.player.passesThroughPlatforms, this)

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

    const tabSync = this.registry.get('tabsync') as TabSync | undefined
    if (tabSync) {
      new SceneSync(this, this.player, tabSync)
    }

    // Shop pad
    this.add.image(300, GROUND_Y - 5, TEX.shopPad)
    this.add.text(300, GROUND_Y - 60, 'POTION SHOP', { fontSize: '12px', color: '#f0c34e' }).setOrigin(0.5)
    this.shopZone = this.add.zone(300, GROUND_Y - 20, 90, 60)
    this.physics.world.enable(this.shopZone, Phaser.Physics.Arcade.STATIC_BODY)
    this.shopHint = this.add
      .text(300, GROUND_Y - 80, 'Press E to shop', { fontSize: '12px', color: '#9aa0b8' })
      .setOrigin(0.5)
      .setVisible(false)
    this.interactKey = this.input.keyboard!.addKey('E')

    // Training dummy: hitting it restores mana, like real combat will.
    const dummy = this.physics.add.staticImage(760, GROUND_Y - 20, TEX.dummy)
    this.physics.add.overlap(this.projectiles, dummy, (_dummyObj, projectile) => {
      const image = projectile as Phaser.Physics.Arcade.Image
      if (image.getData('melee')) {
        this.player.vitals.restoreManaFromHit()
      }
      const now = this.time.now
      if (this.dpsFirstHitAt === 0) this.dpsFirstHitAt = now
      this.dpsLastHitAt = now
      this.dpsDamage += (image.getData('damage') as number | undefined) ?? 8
      ;(image.getData('onHit') as (() => void) | undefined)?.()
      this.tweens.add({ targets: dummy, alpha: { from: 0.4, to: 1 }, duration: 150 })
      image.destroy()
    })
    this.add.text(760, GROUND_Y - 70, 'DUMMY', { fontSize: '11px', color: '#8b93b8' }).setOrigin(0.5)
    this.dpsText = this.add
      .text(760, GROUND_Y - 108, '', { fontSize: '12px', color: '#f0c34e' })
      .setOrigin(0.5)
    this.dpsPie = this.add.graphics()

    // Corridor and boss door on the far right
    this.add.image(WORLD_WIDTH - 80, GROUND_Y - 36, TEX.door)
    this.add
      .text(WORLD_WIDTH - 80, GROUND_Y - 96, 'BOSS ROOM →', { fontSize: '12px', color: '#cabfff' })
      .setOrigin(0.5)
    const door = this.add.zone(WORLD_WIDTH - 80, GROUND_Y - 40, 60, 90)
    this.physics.world.enable(door, Phaser.Physics.Arcade.STATIC_BODY)
    this.physics.add.overlap(this.player, door, () => {
      // Only the controlling tab walks through the door — puppet tabs follow
      // via the pose stream. The overlap fires every step, so start once.
      if (!this.player.isControlled || this.leavingToBossRoom) return
      this.leavingToBossRoom = true
      this.registry.set('potions', this.player.vitals.potions)
      this.scene.start('boss-room')
    })

    this.add
      .text(120, 340, 'A/D move · SPACE jump · S+SPACE drop · SHIFT dash · LMB combo · mouse aims the shield arc\nRMB elemental (hold W/S/move for variants, V for the second set) · R potion',
        { fontSize: '12px', color: '#5b6180', align: 'left' })

    this.events.on('player:potion', (remaining: number) => {
      this.game.events.emit('potions:used', remaining)
    })
  }

  update(): void {
    const touchingShop = this.physics.overlap(this.player, this.shopZone)
    this.shopHint.setVisible(touchingShop)
    if (touchingShop && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.game.events.emit('shop:open')
    }
    this.updateDpsMeter()
  }

  private updateDpsMeter(): void {
    this.dpsPie.clear()
    if (this.dpsLastHitAt === 0) {
      this.dpsText.setText('')
      return
    }
    const now = this.time.now
    const remaining = 1 - (now - this.dpsLastHitAt) / DPS_WINDOW_MS
    if (remaining <= 0) {
      // The pie ran out: the run is over, DPS resets.
      this.dpsDamage = 0
      this.dpsFirstHitAt = 0
      this.dpsLastHitAt = 0
      this.dpsText.setText('')
      return
    }
    // Divide by at least 1s — the first fraction of a second showed a burst
    // as double its real DPS before settling.
    const elapsedSeconds = (now - this.dpsFirstHitAt) / 1000
    const dps = this.dpsDamage / Math.max(1, elapsedSeconds)
    this.dpsText.setText(`DPS ${dps.toFixed(1)} · ${elapsedSeconds.toFixed(1)}s`)
    // The 5s pie empties clockwise from 12 o'clock.
    const start = -Math.PI / 2 + (1 - remaining) * Math.PI * 2
    this.dpsPie.fillStyle(0xf0c34e, 0.9)
    this.dpsPie.slice(820, GROUND_Y - 108, 9, start, -Math.PI / 2 + Math.PI * 2)
    this.dpsPie.fillPath()
  }

  /** Called from React after a successful purchase. */
  setPotions(potions: number): void {
    this.player.vitals.potions = potions
    this.registry.set('vitals', this.player.vitals.snapshot())
    this.registry.set('potions', potions)
  }
}
