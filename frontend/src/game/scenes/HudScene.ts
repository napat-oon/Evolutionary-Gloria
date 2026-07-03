import Phaser from 'phaser'
import type { VitalsSnapshot } from '../player/Vitals'

const BAR_WIDTH = 220

/** Overlay scene: HP/mana bars and potion count, driven by the registry. */
export class HudScene extends Phaser.Scene {
  private hpFill!: Phaser.GameObjects.Rectangle
  private manaFill!: Phaser.GameObjects.Rectangle
  private potionText!: Phaser.GameObjects.Text

  constructor() {
    super('hud')
  }

  create(): void {
    // Bottom-left corner; the React UI owns the top corners.
    const baseY = Number(this.game.config.height) - 52
    this.add.rectangle(20 + BAR_WIDTH / 2, baseY, BAR_WIDTH + 4, 18, 0x000000, 0.5)
    this.hpFill = this.add.rectangle(22, baseY, BAR_WIDTH, 12, 0xe4556e).setOrigin(0, 0.5)
    this.add.rectangle(20 + BAR_WIDTH / 2, baseY + 20, BAR_WIDTH + 4, 14, 0x000000, 0.5)
    this.manaFill = this.add.rectangle(22, baseY + 20, BAR_WIDTH, 8, 0x5cc8ff).setOrigin(0, 0.5)
    this.potionText = this.add.text(22, baseY + 32, '', { fontSize: '14px', color: '#e8e6f0' })
  }

  update(): void {
    const vitals = this.registry.get('vitals') as VitalsSnapshot | undefined
    if (!vitals) return
    this.hpFill.width = Math.max(0, (vitals.hp / vitals.maxHp) * BAR_WIDTH)
    this.manaFill.width = Math.max(0, (vitals.mana / vitals.maxMana) * BAR_WIDTH)
    this.potionText.setText(`🧪 ${vitals.potions}   (R to drink)`)
  }
}
