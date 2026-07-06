import Phaser from 'phaser'
import { makePlaceholderTextures } from '../core/textures'
import type { TabSync } from '../sync/TabSync'

/**
 * Boots the game. Before starting fresh it asks any already-running session
 * (another tab) for its state, so a late-joining tab adopts the fight in
 * progress instead of resetting everyone back to the intermission.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create(): void {
    makePlaceholderTextures(this)
    this.scene.launch('hud')

    const sync = this.registry.get('tabsync') as TabSync | undefined
    if (!sync) {
      this.scene.start('intermission')
      return
    }

    let started = false
    sync.handlers.onWelcome = (message) => {
      if (started) return
      started = true
      this.registry.set('potions', message.state.vitals.potions)
      this.registry.set('adopted-state', message.state)
      this.scene.start(message.state.scene)
    }
    sync.publishHello()
    // No answer means no session is running — this tab starts one.
    this.time.delayedCall(400, () => {
      if (started) return
      started = true
      this.scene.start('intermission')
    })
  }
}
