import Phaser from 'phaser'
import { TEX } from '../core/textures'
import { Player } from '../player/Player'

const WORLD_WIDTH = 1920
const WORLD_HEIGHT = 540
const GROUND_Y = 500

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

  constructor() {
    super('intermission')
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setBackgroundColor('#0b0d17')

    // Ground and platforms
    const solids = this.physics.add.staticGroup()
    for (let x = 32; x < WORLD_WIDTH; x += 64) {
      solids.create(x, GROUND_Y + 32, TEX.ground)
    }
    const platforms = this.physics.add.staticGroup()
    platforms.create(430, 400, TEX.platform)
    platforms.create(620, 320, TEX.platform)
    for (const platform of platforms.getChildren()) {
      const body = (platform as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.StaticBody
      body.checkCollision.down = false
      body.checkCollision.left = false
      body.checkCollision.right = false
    }

    this.projectiles = this.physics.add.group()
    this.player = new Player(this, 120, GROUND_Y - 40, this.projectiles,
      (this.registry.get('potions') as number | undefined) ?? 0)

    this.physics.add.collider(this.player, solids)
    this.physics.add.collider(this.player, platforms, undefined,
      () => !this.player.passesThroughPlatforms, this)

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

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
      this.tweens.add({ targets: dummy, alpha: { from: 0.4, to: 1 }, duration: 150 })
      image.destroy()
    })
    this.add.text(760, GROUND_Y - 70, 'DUMMY', { fontSize: '11px', color: '#8b93b8' }).setOrigin(0.5)

    // Corridor and boss door on the far right
    this.add.image(WORLD_WIDTH - 80, GROUND_Y - 36, TEX.door)
    this.add
      .text(WORLD_WIDTH - 80, GROUND_Y - 96, 'BOSS ROOM →', { fontSize: '12px', color: '#cabfff' })
      .setOrigin(0.5)
    const door = this.add.zone(WORLD_WIDTH - 80, GROUND_Y - 40, 60, 90)
    this.physics.world.enable(door, Phaser.Physics.Arcade.STATIC_BODY)
    this.physics.add.overlap(this.player, door, () => {
      this.registry.set('potions', this.player.vitals.potions)
      this.scene.start('boss-room')
    })

    this.add
      .text(120, 340, 'A/D move · SPACE jump · SHIFT dash · LMB combo\nRMB elemental (hold W/S/move or CTRL for variants) · R potion',
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
  }

  /** Called from React after a successful purchase. */
  setPotions(potions: number): void {
    this.player.vitals.potions = potions
    this.registry.set('vitals', this.player.vitals.snapshot())
    this.registry.set('potions', potions)
  }
}
