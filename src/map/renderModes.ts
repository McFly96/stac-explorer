import type { SourceInfo } from 'ol/source/GeoTIFF'
import type { Style } from 'ol/layer/WebGLTile'
import type { BandAsset, BandKey, Scene } from '../stac/search'

export type RenderMode = 'true-color' | 'false-color' | 'ndvi' | 'ndwi'

/** Colour ramp stop: value → RGB. */
export type Stop = [value: number, color: [number, number, number]]

interface ModeInfo {
  label: string
  description: string
  bands: BandKey[]
  /** Set for normalised-difference indices: (a - b) / (a + b). */
  index?: { a: BandKey; b: BandKey; stops: Stop[] }
}

export const RENDER_MODES: Record<RenderMode, ModeInfo> = {
  'true-color': {
    label: 'True colour',
    description: 'What the eye would see (TCI product).',
    bands: ['visual'],
  },
  'false-color': {
    label: 'False colour',
    description: 'NIR · red · green: healthy vegetation shows up bright red.',
    bands: ['nir', 'red', 'green'],
  },
  ndvi: {
    label: 'NDVI',
    description: 'Vegetation index (NIR − red) / (NIR + red).',
    bands: ['nir', 'red'],
    index: {
      a: 'nir',
      b: 'red',
      stops: [
        [-0.2, [44, 62, 92]],
        [0, [196, 178, 140]],
        [0.2, [237, 229, 151]],
        [0.4, [134, 189, 92]],
        [0.6, [46, 139, 61]],
        [0.8, [0, 84, 38]],
      ],
    },
  },
  ndwi: {
    label: 'NDWI',
    description: 'Water index (green − NIR) / (green + NIR).',
    bands: ['green', 'nir'],
    index: {
      a: 'green',
      b: 'nir',
      stops: [
        [-0.6, [125, 96, 64]],
        [-0.2, [214, 205, 176]],
        [0, [180, 222, 235]],
        [0.3, [57, 140, 204]],
        [0.6, [8, 48, 107]],
      ],
    },
  },
}

export const RENDER_MODE_KEYS = Object.keys(RENDER_MODES) as RenderMode[]

export function supportsMode(scene: Scene, mode: RenderMode): boolean {
  return RENDER_MODES[mode].bands.every((band) => scene.assets[band])
}

export interface LayerConfig {
  sources: SourceInfo[]
  normalize: boolean
  style: Style
}

// Sentinel-2 L2A no-data value. With `nodata` set, OpenLayers appends a single
// alpha band after all the source bands: the data tile layout is
// [band1, band2, …, alpha].
const NODATA = 0
const band = (i: number) => ['band', i + 1]

// Reflectance window used to stretch the false-colour composite.
const REFLECTANCE_MAX = 0.4

export function layerConfig(scene: Scene, mode: RenderMode): LayerConfig | null {
  if (!supportsMode(scene, mode)) return null
  const info = RENDER_MODES[mode]
  const assets = info.bands.map((key) => scene.assets[key]!)

  if (mode === 'true-color') {
    // TCI is an already-stretched 8-bit RGB file: 3 bands + alpha.
    return {
      sources: [{ url: assets[0].href, nodata: NODATA }],
      normalize: true,
      style: { color: ['array', ['band', 1], ['band', 2], ['band', 3], ['band', 4]] },
    }
  }

  if (info.index) {
    const [a, b] = assets.map((asset, i) => reflectance(band(i), asset))
    const value = ['/', ['-', a, b], ['+', a, b]]
    const ramp = info.index.stops.flatMap(([v, c]) => [v, [...c, 1]])
    return {
      sources: assets.map((asset) => ({ url: asset.href, nodata: NODATA })),
      normalize: false,
      style: {
        color: ['case', ['==', ['band', 1], NODATA], [0, 0, 0, 0], ['interpolate', ['linear'], value, ...ramp]],
      },
    }
  }

  // Composite of single-band reflectance files, stretched to 0–REFLECTANCE_MAX.
  return {
    sources: assets.map((asset) => ({
      url: asset.href,
      nodata: NODATA,
      min: dnFor(0, asset),
      max: dnFor(REFLECTANCE_MAX, asset),
    })),
    normalize: true,
    style: { color: ['array', band(0), band(1), band(2), band(3)] },
  }
}

function reflectance(expr: unknown[], { scale, offset }: BandAsset): unknown[] {
  return ['+', ['*', expr, scale], offset]
}

function dnFor(value: number, { scale, offset }: BandAsset): number {
  return (value - offset) / scale
}

/**
 * Index value under the cursor, from the raw data returned by
 * `WebGLTileLayer#getData` (layout as described above). Null for no-data or
 * for RGB modes.
 */
export function readIndex(data: ArrayLike<number> | null, scene: Scene, mode: RenderMode): number | null {
  const info = RENDER_MODES[mode]
  if (!info.index || !data || !supportsMode(scene, mode)) return null
  const rawA = data[0]
  const rawB = data[1]
  if (rawA === NODATA || rawB === NODATA || rawA === undefined || rawB === undefined) return null
  const a = rawA * scene.assets[info.index.a]!.scale + scene.assets[info.index.a]!.offset
  const b = rawB * scene.assets[info.index.b]!.scale + scene.assets[info.index.b]!.offset
  return a + b === 0 ? null : (a - b) / (a + b)
}

export function rampGradient(stops: Stop[]): string {
  const min = stops[0][0]
  const max = stops[stops.length - 1][0]
  const parts = stops.map(([v, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${(((v - min) / (max - min)) * 100).toFixed(1)}%`)
  return `linear-gradient(to right, ${parts.join(', ')})`
}
