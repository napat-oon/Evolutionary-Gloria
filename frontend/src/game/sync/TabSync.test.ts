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
