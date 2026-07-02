import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('formats minutes, seconds and millis', () => {
    expect(formatDuration(83_456)).toBe('1:23.456')
  })

  it('pads seconds and millis', () => {
    expect(formatDuration(60_005)).toBe('1:00.005')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00.000')
  })

  it('rejects negative and non-finite values', () => {
    expect(formatDuration(-1)).toBe('-')
    expect(formatDuration(Number.NaN)).toBe('-')
  })
})
