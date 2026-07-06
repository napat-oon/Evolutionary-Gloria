import Phaser from 'phaser'
import type { Player } from '../player/Player'
import type { TabSync } from './TabSync'

/**
 * Binds one scene's player to the tab-sync session: publishes poses and
 * attacks while this tab controls, replays the other tab's actions while
 * it doesn't, and follows scene changes so both dimensions stay in step.
 */
export class SceneSync {
  private readonly scene: Phaser.Scene
  private readonly player: Player
  private readonly sync: TabSync
  private readonly debugWindupKey?: Phaser.Input.Keyboard.Key
  /** Poses stream ~60/s; only the FIRST one may trigger the scene follow,
   *  or the target scene restarts once per queued message. */
  private followingScene = false

  constructor(scene: Phaser.Scene, player: Player, sync: TabSync) {
    this.scene = scene
    this.player = player
    this.sync = sync

    player.setControlled(sync.hasControl)

    sync.handlers = {
      onControlChange: (hasControl) => {
        if (!player.active) return
        player.setControlled(hasControl)
      },
      onPose: (message) => {
        if (!player.active) return
        if (message.scene !== scene.scene.key) {
          // The controller moved to another room; follow it (once).
          if (this.followingScene) return
          this.followingScene = true
          scene.registry.set('potions', message.vitals.potions)
          scene.scene.start(message.scene)
          return
        }
        if (!sync.hasControl) {
          player.applyRemotePose(message.x, message.y, message.facing)
          player.vitals.applySnapshot(message.vitals)
        }
      },
      onCast: (message) => {
        if (player.active && !sync.hasControl) {
          player.castRemote(message.ability, message.aim, message.aimPoint, message.moveDir)
        }
      },
      onMelee: (message) => {
        if (player.active && !sync.hasControl) {
          player.meleeRemote(message.aim, message.comboStep)
        }
      },
      onWindup: (message) => {
        scene.game.events.emit('sync:windup', message.color)
      },
      onDamage: (message) => {
        if (player.active) {
          player.takeDamage(message.amount, message.force ?? false)
        }
      },
      onEnded: (message) => {
        scene.game.events.emit('session:ended', message.reason)
      },
    }

    // Baseline session state for late-joining tabs; the boss room replaces
    // this with one that includes the fight state.
    sync.stateProvider = () => ({
      scene: scene.scene.key,
      phase: 'fighting',
      bossHp: 0,
      stars: [],
      vitals: player.vitals.snapshot(),
      x: player.x,
      y: player.y,
    })

    player.onCastPerformed = (ability, aim, aimPoint, moveDir) =>
      sync.publishCast(ability, aim, aimPoint, moveDir)
    player.onMeleePerformed = (aim, comboStep) => sync.publishMelee(aim, comboStep)

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.publishPose, this)

    // Debug helper until the bosses land: T fakes a windup on this tab.
    this.debugWindupKey = scene.input.keyboard?.addKey('T')

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.publishPose, this)
      player.onCastPerformed = undefined
      player.onMeleePerformed = undefined
      sync.handlers = {}
      sync.stateProvider = undefined
    })
  }

  private publishPose(): void {
    if (this.debugWindupKey && Phaser.Input.Keyboard.JustDown(this.debugWindupKey)) {
      this.sync.publishWindup()
    }
    if (!this.sync.hasControl || !this.player.active) return
    this.sync.publishPose(
      this.scene.scene.key,
      this.player.x,
      this.player.y,
      this.player.facing,
      this.player.vitals.snapshot(),
    )
  }
}
