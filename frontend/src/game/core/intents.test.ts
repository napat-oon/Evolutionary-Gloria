import { describe, expect, it } from 'vitest'
import { selectAbility } from './intents'

const base = { ctrl: false, movingX: false, up: false, down: false }

describe('selectAbility', () => {
  it('maps the four plain right-click contexts', () => {
    expect(selectAbility({ ...base })).toBe('star-shotgun')
    expect(selectAbility({ ...base, movingX: true })).toBe('water-rush')
    expect(selectAbility({ ...base, up: true })).toBe('electric-dive')
    expect(selectAbility({ ...base, down: true })).toBe('fire-plunge')
  })

  it('maps the four ctrl contexts', () => {
    expect(selectAbility({ ...base, ctrl: true })).toBe('dark-swing')
    expect(selectAbility({ ...base, ctrl: true, movingX: true })).toBe('leaf-blade')
    expect(selectAbility({ ...base, ctrl: true, up: true })).toBe('twin-ribbons')
    expect(selectAbility({ ...base, ctrl: true, down: true })).toBe('icicle-stomp')
  })

  it('vertical input wins over horizontal movement', () => {
    expect(selectAbility({ ...base, movingX: true, up: true })).toBe('electric-dive')
    expect(selectAbility({ ...base, ctrl: true, movingX: true, down: true })).toBe('icicle-stomp')
  })
})
