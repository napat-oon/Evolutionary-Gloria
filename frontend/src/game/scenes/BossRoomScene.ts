import Phaser from 'phaser'
import { TEX } from '../core/textures'
import { Player } from '../player/Player'
import { SceneSync } from '../sync/SceneSync'
import type { TabSync } from '../sync/TabSync'

const WIDTH = 960
const HEIGHT = 540
const GROUND_Y = 500

/**
 * The arena. For now a stub: walls (one is cover for the future ultimate),
 * the player kit fully usable, and the way back to the intermission stage.
 * Sirius & Orion arrive in the boss milestone.
 */
export class BossRoomScene extends Phaser.Scene {
  private player!: Player

  constructor() {
    super('boss-room')
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT)
    this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT)
    this.cameras.main.setBackgroundColor('#0d0a1c')

    const solids = this.physics.add.staticGroup()
    for (let x = 32; x < WIDTH; x += 64) {
      solids.create(x, GROUND_Y + 32, TEX.ground)
    }
    // Cover wall — the only safe spot during the twins' final explosion.
    solids.create(680, GROUND_Y - 64, TEX.wall)

    const projectiles = this.physics.add.group()
    this.player = new Player(this, 90, GROUND_Y - 40, projectiles,
      (this.registry.get('potions') as number | undefined) ?? 0)
    this.physics.add.collider(this.player, solids)

    const tabSync = this.registry.get('tabsync') as TabSync | undefined
    if (tabSync) {
      new SceneSync(this, this.player, tabSync)
    }

    const bossName = tabSync?.tab === 2 ? 'ORION' : 'SIRIUS'
    this.add
      .text(WIDTH / 2, 180, `${bossName}\nawaits their cue…`, {
        fontSize: '24px', color: tabSync?.tab === 2 ? '#6b2a3a' : '#2a6b47', align: 'center',
      })
      .setOrigin(0.5)

    // Back to intermission on the left edge
    this.add.image(40, GROUND_Y - 36, TEX.door).setFlipX(true)
    const door = this.add.zone(30, GROUND_Y - 40, 40, 90)
    this.physics.world.enable(door, Phaser.Physics.Arcade.STATIC_BODY)
    this.physics.add.overlap(this.player, door, () => {
      this.registry.set('potions', this.player.vitals.potions)
      this.scene.start('intermission')
    })
  }
}
