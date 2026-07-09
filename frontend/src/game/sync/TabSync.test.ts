import { describe, expect, it } from 'vitest'
import type { SyncMessage } from './messages'
import { isSyncMessage, otherTab, TAB_BOSS_COLOR } from './messages'
import type { SyncTransport } from './SyncTransport'
import { TabSync } from './TabSync'

/** In-memory transport pair for tests: what one posts, the other receives. */
function makeTransportPair(): [SyncTransport, SyncTransport] {
  const listenersA = new Set<(m: SyncMessage) => void>()
  const listenersB = new Set<(m: SyncMessage) => void>()
  const make = (
    own: Set<(m: SyncMessage) => void>,
    peer: Set<(m: SyncMessage) => void>,
  ): SyncTransport => ({
    post: (message) => peer.forEach((listener) => listener(message)),
    subscribe: (listener) => {
      own.add(listener)
      return () => own.delete(listener)
    },
    close: () => own.clear(),
  })
  return [make(listenersA, listenersB), make(listenersB, listenersA)]
}

describe('messages', () => {
  it('otherTab flips between 1 and 2', () => {
    expect(otherTab(1)).toBe(2)
    expect(otherTab(2)).toBe(1)
  })

  it('isSyncMessage rejects junk and accepts valid messages', () => {
    expect(isSyncMessage(null)).toBe(false)
    expect(isSyncMessage({ type: 'pose' })).toBe(false)
    expect(isSyncMessage({ type: 'nonsense', tab: 1 })).toBe(false)
    expect(isSyncMessage({ type: 'control', tab: 2 })).toBe(true)
  })
})

describe('TabSync control handover', () => {
  it('tab 1 starts in control, focus claim moves it', () => {
    const [transportA, transportB] = makeTransportPair()
    const tab1 = new TabSync(1, transportA)
    const tab2 = new TabSync(2, transportB)
    expect(tab1.hasControl).toBe(true)
    expect(tab2.hasControl).toBe(false)

    tab2.claimControl()
    expect(tab2.hasControl).toBe(true)
    expect(tab1.hasControl).toBe(false)

    tab1.claimControl()
    expect(tab1.hasControl).toBe(true)
    expect(tab2.hasControl).toBe(false)
  })

  it('windup from one tab reaches only the other, with its boss color', () => {
    const [transportA, transportB] = makeTransportPair()
    const tab1 = new TabSync(1, transportA)
    const tab2 = new TabSync(2, transportB)
    const seenBy1: string[] = []
    const seenBy2: string[] = []
    tab1.handlers.onWindup = (m) => seenBy1.push(m.color)
    tab2.handlers.onWindup = (m) => seenBy2.push(m.color)

    tab2.publishWindup() // Orion attacks in tab 2 -> tab 1 glows crimson
    expect(seenBy1).toEqual([TAB_BOSS_COLOR[2]])
    expect(seenBy2).toEqual([])
  })

  it('intro-ready reaches only the other dimension, reply flag intact', () => {
    const [transportA, transportB] = makeTransportPair()
    const tab1 = new TabSync(1, transportA)
    const tab2 = new TabSync(2, transportB)
    const seenBy1: boolean[] = []
    const seenBy2: boolean[] = []
    tab1.handlers.onIntroReady = (m) => seenBy1.push(m.reply ?? false)
    tab2.handlers.onIntroReady = (m) => seenBy2.push(m.reply ?? false)

    tab1.publishIntroReady()
    tab2.publishIntroReady(true)
    expect(seenBy2).toEqual([false])
    expect(seenBy1).toEqual([true])
  })

  it('damage on the puppet tab is forwarded to the controller exactly once', () => {
    const [transportA, transportB] = makeTransportPair()
    const tab1 = new TabSync(1, transportA)
    const tab2 = new TabSync(2, transportB)
    const applied: number[] = []
    tab1.handlers.onDamage = (m) => applied.push(m.amount)

    expect(tab1.reportDamage(10)).toBe(true) // controller applies locally
    expect(tab2.reportDamage(7)).toBe(false) // puppet forwards instead
    expect(applied).toEqual([7])
  })
})

describe('TabSync session handshake and end', () => {
  const state = {
    scene: 'boss-room',
    phase: 'fighting' as const,
    bossHp: 420,
    stars: ['jade' as const],
    vitals: { hp: 80, maxHp: 100, mana: 50, maxMana: 100, potions: 2, healBubbleActive: true },
    x: 512,
    y: 1000,
  }

  it('a late tab is welcomed with the running state', () => {
    const [transportA, transportB] = makeTransportPair()
    const running = new TabSync(1, transportA)
    running.stateProvider = () => state

    // The other dimension joins late.
    const joiner = new TabSync(2, transportB)
    const welcomed: unknown[] = []
    joiner.handlers.onWelcome = (m) => welcomed.push(m.state)
    joiner.publishHello()

    expect(welcomed).toEqual([state])
  })

  it('welcomes the joiner even after it stole control on focus', () => {
    const [transportA, transportB] = makeTransportPair()
    const running = new TabSync(1, transportA)
    running.stateProvider = () => state

    const joiner = new TabSync(2, transportB)
    joiner.claimControl() // the fresh tab is focused before it says hello
    expect(running.hasControl).toBe(false)

    const welcomed: unknown[] = []
    joiner.handlers.onWelcome = (m) => welcomed.push(m.state)
    joiner.publishHello()
    expect(welcomed).toEqual([state]) // still answered by the running scene
  })

  it('hello goes unanswered when no session is running', () => {
    const [transportA, transportB] = makeTransportPair()
    const other = new TabSync(2, transportB) // no stateProvider, no control
    void other
    const joiner = new TabSync(2, transportA)
    const welcomed: unknown[] = []
    joiner.handlers.onWelcome = (m) => welcomed.push(m.state)
    joiner.publishHello()
    expect(welcomed).toEqual([])
  })

  it('ended reaches every other tab (same dimension too) and stops control claims', () => {
    const [transportA, transportB] = makeTransportPair()
    const leaver = new TabSync(1, transportA)
    const mirror = new TabSync(1, transportB) // duplicate of the same dimension
    const reasons: string[] = []
    mirror.handlers.onEnded = (m) => reasons.push(m.reason)

    leaver.publishEnded('left')
    expect(reasons).toEqual(['left'])
    expect(mirror.isEnded).toBe(true)

    mirror.claimControl()
    expect(mirror.hasControl).toBe(false) // sealed tabs cannot take over
  })

  it('forwarded damage keeps its undodgeable flag', () => {
    const [transportA, transportB] = makeTransportPair()
    const controller = new TabSync(1, transportA)
    const puppet = new TabSync(2, transportB)
    const forced: Array<boolean | undefined> = []
    controller.handlers.onDamage = (m) => forced.push(m.force)

    puppet.reportDamage(14, true)
    expect(forced).toEqual([true])
  })
})
