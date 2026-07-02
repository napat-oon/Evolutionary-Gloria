import { describe, expect, it } from 'vitest'
import { ConstellationTracker } from './ConstellationTracker'

describe('ConstellationTracker', () => {
  it('accepts stars up to two of the same color in a row', () => {
    const tracker = new ConstellationTracker()
    expect(tracker.add('jade')).toBe(true)
    expect(tracker.add('jade')).toBe(true)
    expect(tracker.add('jade')).toBe(false) // third in a row refused
    expect(tracker.add('crimson')).toBe(true)
    expect(tracker.add('jade')).toBe(true) // streak broken, jade fine again
    expect(tracker.list()).toEqual(['jade', 'jade', 'crimson', 'jade'])
  })

  it('is FIFO at capacity: the 8th star evicts the oldest', () => {
    const tracker = new ConstellationTracker()
    const sequence = ['jade', 'crimson', 'jade', 'crimson', 'jade', 'crimson', 'jade'] as const
    for (const color of sequence) tracker.add(color)
    expect(tracker.isFull).toBe(true)

    expect(tracker.add('crimson')).toBe(true)
    expect(tracker.count).toBe(7)
    expect(tracker.list()).toEqual([
      'crimson', 'jade', 'crimson', 'jade', 'crimson', 'jade', 'crimson',
    ])
  })

  it('the in-a-row rule looks at the newest stars even after eviction', () => {
    const tracker = new ConstellationTracker()
    for (const color of ['jade', 'crimson', 'jade', 'crimson', 'jade', 'crimson', 'crimson'] as const) {
      tracker.add(color)
    }
    expect(tracker.add('crimson')).toBe(false) // would be third crimson in a row
    expect(tracker.add('jade')).toBe(true)
  })

  it('consumes newest-first and clears', () => {
    const tracker = new ConstellationTracker()
    tracker.add('jade')
    tracker.add('crimson')
    expect(tracker.consumeNewest()).toBe('crimson')
    expect(tracker.consumeNewest()).toBe('jade')
    expect(tracker.consumeNewest()).toBeUndefined()

    tracker.add('jade')
    tracker.clear()
    expect(tracker.count).toBe(0)
    expect(tracker.isFull).toBe(false)
  })
})
