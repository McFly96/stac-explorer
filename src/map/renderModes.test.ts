import { describe, expect, it } from 'vitest'
import { layerConfig, rampGradient, readIndex, supportsMode } from './renderModes'
import { parseItem } from '../stac/search'
import { makeItem } from '../test/fixtures/items'

const scene = parseItem(makeItem())

describe('layerConfig', () => {
  it('uses the TCI file for true colour', () => {
    const config = layerConfig(scene, 'true-color')!
    expect(config.sources).toEqual([{ url: expect.stringContaining('TCI.tif'), nodata: 0 }])
    expect(config.normalize).toBe(true)
  })

  it('stretches the false-colour bands to 0–0.4 reflectance, taking the offset into account', () => {
    const config = layerConfig(scene, 'false-color')!
    expect(config.sources.map((s) => s.url)).toEqual([
      expect.stringContaining('B08'),
      expect.stringContaining('B04'),
      expect.stringContaining('B03'),
    ])
    expect(config.sources[0].min).toBeCloseTo(1000)
    expect(config.sources[0].max).toBeCloseTo(5000)
  })

  it('reads raw values for the indices', () => {
    const config = layerConfig(scene, 'ndvi')!
    expect(config.normalize).toBe(false)
    expect(config.sources.map((s) => s.url)).toEqual([expect.stringContaining('B08'), expect.stringContaining('B04')])
  })

  it('returns null when a band is missing', () => {
    const noNir = { ...scene, assets: { ...scene.assets, nir: undefined } }
    expect(supportsMode(noNir, 'ndvi')).toBe(false)
    expect(layerConfig(noNir, 'ndvi')).toBeNull()
  })
})

describe('readIndex', () => {
  // Data tile layout: [nir, red, alpha]; reflectance = DN / 10000 - 0.1
  it('computes NDVI from the digital numbers', () => {
    // nir 0.5, red 0.1 → (0.5 - 0.1) / (0.5 + 0.1)
    expect(readIndex([6000, 2000, 255], scene, 'ndvi')).toBeCloseTo(0.4 / 0.6)
  })

  it('ignores no-data and RGB modes', () => {
    expect(readIndex([0, 0, 0], scene, 'ndvi')).toBeNull()
    expect(readIndex([6000, 2000, 255], scene, 'true-color')).toBeNull()
    expect(readIndex(null, scene, 'ndvi')).toBeNull()
  })
})

describe('rampGradient', () => {
  it('places the stops along the bar', () => {
    expect(rampGradient([
      [0, [0, 0, 0]],
      [1, [255, 255, 255]],
    ])).toBe('linear-gradient(to right, rgb(0 0 0) 0.0%, rgb(255 255 255) 100.0%)')
  })
})
