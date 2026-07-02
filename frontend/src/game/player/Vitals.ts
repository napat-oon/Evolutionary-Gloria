export interface VitalsSnapshot {
  hp: number
  maxHp: number
  mana: number
  maxMana: number
  potions: number
  healBubbleActive: boolean
}

export interface VitalsEvents {
  onChange?: (snapshot: VitalsSnapshot) => void
  onDeath?: () => void
}

/**
 * Player health/mana/potion state with the psychic-bubble passive heal.
 * Pure logic (advance by delta-time) so it is unit-testable and can be
 * mirrored across tabs by the sync layer later.
 */
export class Vitals {
  static readonly HEAL_PER_SECOND = 4
  static readonly BUBBLE_POP_SECONDS = 3
  static readonly POTION_HEAL = 40
  static readonly POTION_COOLDOWN_SECONDS = 10
  static readonly ATTACK_MANA_RESTORE = 12

  readonly maxHp: number
  readonly maxMana: number
  hp: number
  mana: number
  potions: number

  private bubblePoppedFor = 0
  private potionCooldown = 0
  private readonly events: VitalsEvents

  constructor(maxHp: number, maxMana: number, potions: number, events: VitalsEvents = {}) {
    this.maxHp = maxHp
    this.maxMana = maxMana
    this.hp = maxHp
    this.mana = maxMana
    this.potions = potions
    this.events = events
  }

  get healBubbleActive(): boolean {
    return this.hp > 0 && this.hp < this.maxHp && this.bubblePoppedFor <= 0
  }

  get potionReady(): boolean {
    return this.potions > 0 && this.potionCooldown <= 0 && this.hp > 0 && this.hp < this.maxHp
  }

  update(deltaSeconds: number): void {
    if (this.hp <= 0) return
    if (this.bubblePoppedFor > 0) {
      this.bubblePoppedFor -= deltaSeconds
    } else if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + Vitals.HEAL_PER_SECOND * deltaSeconds)
      this.emit()
    }
    if (this.potionCooldown > 0) {
      this.potionCooldown -= deltaSeconds
    }
  }

  takeDamage(amount: number): void {
    if (this.hp <= 0 || amount <= 0) return
    this.hp = Math.max(0, this.hp - amount)
    this.bubblePoppedFor = Vitals.BUBBLE_POP_SECONDS
    this.emit()
    if (this.hp === 0) {
      this.events.onDeath?.()
    }
  }

  /** @returns true when the potion was drunk */
  drinkPotion(): boolean {
    if (!this.potionReady) return false
    this.potions -= 1
    this.potionCooldown = Vitals.POTION_COOLDOWN_SECONDS
    this.hp = Math.min(this.maxHp, this.hp + Vitals.POTION_HEAL)
    this.emit()
    return true
  }

  /** @returns true when there was enough mana */
  spendMana(amount: number): boolean {
    if (this.mana < amount) return false
    this.mana -= amount
    this.emit()
    return true
  }

  restoreManaFromHit(): void {
    this.mana = Math.min(this.maxMana, this.mana + Vitals.ATTACK_MANA_RESTORE)
    this.emit()
  }

  /** Overwrites local state from the controlling tab's snapshot (single writer). */
  applySnapshot(snapshot: VitalsSnapshot): void {
    this.hp = snapshot.hp
    this.mana = snapshot.mana
    this.potions = snapshot.potions
    this.bubblePoppedFor = snapshot.healBubbleActive ? 0 : Math.max(this.bubblePoppedFor, 0.05)
    this.emit()
  }

  snapshot(): VitalsSnapshot {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      mana: this.mana,
      maxMana: this.maxMana,
      potions: this.potions,
      healBubbleActive: this.healBubbleActive,
    }
  }

  private emit(): void {
    this.events.onChange?.(this.snapshot())
  }
}
