import Phaser from 'phaser'
import { makePlaceholderTextures } from '../core/textures'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create(): void {
    makePlaceholderTextures(this)
    this.scene.start('intermission')
    this.scene.launch('hud')
  }
}
