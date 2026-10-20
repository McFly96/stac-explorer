import { describe, expect, it } from 'vitest'
import { get as getProjection, transform } from 'ol/proj'
import { ensureProjection, utmDefinition } from './projections'

describe('utmDefinition', () => {
  it('builds north and south UTM zones', () => {
    expect(utmDefinition(32633)).toBe('+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs')
    expect(utmDefinition(32733)).toBe('+proj=utm +zone=33 +south +datum=WGS84 +units=m +no_defs')
  })

  it('rejects other codes', () => {
    expect(utmDefinition(3857)).toBeNull()
    expect(utmDefinition(32661)).toBeNull()
  })
})

describe('ensureProjection', () => {
  it('registers the zone in OpenLayers', () => {
    expect(ensureProjection(32632)).toBe('EPSG:32632')
    expect(getProjection('EPSG:32632')).not.toBeNull()
    // Rome, in UTM 32N
    const [x, y] = transform([12.4964, 41.9028], 'EPSG:4326', 'EPSG:32632')
    expect(x).toBeCloseTo(790_000, -3)
    expect(y).toBeCloseTo(4_645_000, -3)
  })
})
