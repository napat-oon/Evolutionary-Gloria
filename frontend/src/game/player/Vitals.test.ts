import { describe, expect, it } from 'vitest'
import { Vitals } from './Vitals'

function damagedVitals(potions = 1): Vitals {
  const vitals = new Vitals(100, 100, potions)
  vitals.takeDamage(50)
  return vitals
}

describe('Vitals', () => {
  it('heals slowly only after the bubble recovers from damage', () => {
    const vitals = damagedVitals()
    expect(vitals.healBubbleActive).toBe(false)

    vitals.update(Vitals.BUBBLE_POP_SECONDS) // bubble recovering, no heal yet
    expect(vitals.hp).toBe(50)

    vitals.update(1)
    expect(vitals.hp).toBeCloseTo(50 + Vitals.HEAL_PER_SECOND)
    expect(vitals.healBubbleActive).toBe(true)
  })

  it('taking damage pops the bubble again', () => {
    const vitals = damagedVitals()
    vitals.update(Vitals.BUBBLE_POP_SECONDS + 1)
    expect(vitals.healBubbleActive).toBe(true)
    vitals.takeDamage(5)
    expect(vitals.healBubbleActive).toBe(false)
  })

  it('does not heal at full hp or when dead', () => {
    const full = new Vitals(100, 100, 0)
    full.update(10)
    expect(full.hp).toBe(100)
    expect(full.healBubbleActive).toBe(false)

    const dead = new Vitals(100, 100, 0)
    dead.takeDamage(200)
    expect(dead.hp).toBe(0)
    dead.update(10)
    expect(dead.hp).toBe(0)
  })

  it('potion heals, consumes and respects cooldown', () => {
    const vitals = damagedVitals(2)
    expect(vitals.drinkPotion()).toBe(true)
    expect(vitals.hp).toBe(90)
    expect(vitals.potions).toBe(1)
    expect(vitals.drinkPotion()).toBe(false) // cooldown

    vitals.update(Vitals.POTION_COOLDOWN_SECONDS)
    vitals.takeDamage(30)
    expect(vitals.drinkPotion()).toBe(true)
    expect(vitals.potions).toBe(0)
  })

  it('mana spending fails when insufficient and hits restore mana', () => {
    const vitals = new Vitals(100, 30, 0)
    expect(vitals.spendMana(20)).toBe(true)
    expect(vitals.spendMana(20)).toBe(false)
    vitals.restoreManaFromHit()
    expect(vitals.mana).toBe(10 + Vitals.ATTACK_MANA_RESTORE)
  })

  it('reports death exactly once through the callback', () => {
    let deaths = 0
    const vitals = new Vitals(10, 0, 0, { onDeath: () => deaths++ })
    vitals.takeDamage(10)
    vitals.takeDamage(5)
    expect(deaths).toBe(1)
  })
})
