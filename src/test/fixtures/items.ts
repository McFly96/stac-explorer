import type { StacItem } from '../../stac/search'

const S2 = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/33/T/TG/2026/9/S2B_33TTG_20260912_0_L2A'
const reflectance = { 'raster:bands': [{ nodata: 0, data_type: 'uint16', scale: 0.0001, offset: -0.1 }] }

/** Shaped like an Earth Search v1 `sentinel-2-l2a` item, trimmed to what the app reads. */
export function makeItem(id = 'S2B_33TTG_20260912_0_L2A', overrides: Partial<StacItem['properties']> = {}): StacItem {
  return {
    id,
    collection: 'sentinel-2-l2a',
    bbox: [11.66, 41.45, 12.98, 42.44],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [11.66, 41.45],
          [12.98, 41.45],
          [12.98, 42.44],
          [11.66, 42.44],
          [11.66, 41.45],
        ],
      ],
    },
    properties: {
      datetime: '2026-09-12T10:07:21.024000Z',
      platform: 'sentinel-2b',
      'eo:cloud_cover': 3.4,
      's2:nodata_pixel_percentage': 2,
      'proj:epsg': 32633,
      ...overrides,
    },
    assets: {
      thumbnail: { href: `${S2}/thumbnail.jpg` },
      visual: { href: `${S2}/TCI.tif` },
      red: { href: `${S2}/B04.tif`, ...reflectance },
      green: { href: `${S2}/B03.tif`, ...reflectance },
      blue: { href: `${S2}/B02.tif`, ...reflectance },
      nir: { href: `${S2}/B08.tif`, ...reflectance },
      scl: { href: `${S2}/SCL.tif` },
    },
  } as StacItem
}
