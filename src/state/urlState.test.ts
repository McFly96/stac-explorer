import { describe, expect, it } from 'vitest'
import { parseHash, toHash } from './urlState'

describe('url state', () => {
  it('round-trips a comparison', () => {
    const state = { left: 'S2A_1', right: 'S2B_2', mode: 'ndvi' as const }
    expect(toHash(state)).toBe('#scene=S2A_1&compare=S2B_2&mode=ndvi')
    expect(parseHash(toHash(state))).toEqual(state)
  })

  it('omits defaults and ignores unknown modes', () => {
    expect(toHash({ left: null, right: 'x', mode: 'ndvi' })).toBe('')
    expect(parseHash('#scene=a&mode=thermal')).toEqual({ left: 'a', right: null, mode: 'true-color' })
    expect(parseHash('#compare=b')).toEqual({ left: null, right: null, mode: 'true-color' })
  })
})
