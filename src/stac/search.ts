// Minimal STAC API client for the Sentinel-2 L2A collection of Earth Search.
// https://github.com/radiantearth/stac-api-spec/tree/main/item-search

import type { Geometry } from 'geojson'

export const STAC_API = 'https://earth-search.aws.element84.com/v1'
export const COLLECTION = 'sentinel-2-l2a'

export type Bbox = [west: number, south: number, east: number, north: number]

export type BandKey = 'visual' | 'red' | 'green' | 'blue' | 'nir' | 'swir16'
export const BAND_KEYS: BandKey[] = ['visual', 'red', 'green', 'blue', 'nir', 'swir16']

export interface BandAsset {
  href: string
  /** Reflectance = DN * scale + offset (STAC raster extension). */
  scale: number
  offset: number
}

export interface Scene {
  id: string
  collection: string
  datetime: string
  cloudCover: number | null
  /** Share of the tile footprint that holds data, in %. */
  coverage: number | null
  platform: string | null
  epsg: number | null
  bbox: Bbox
  geometry: Geometry
  thumbnail: string | null
  assets: Partial<Record<BandKey, BandAsset>>
}

export interface SearchParams {
  bbox: Bbox
  /** Inclusive dates, `YYYY-MM-DD`. */
  start: string
  end: string
  maxCloud: number
  /** Skip tiles that the satellite swath only partly covers. */
  fullTilesOnly: boolean
  limit?: number
}

// Max share of no-data pixels for a tile to count as full.
const FULL_TILE_MAX_NODATA = 10

/** A request the server told us to make to get the next page (STAC `next` link). */
export interface PageRequest {
  href: string
  method: 'GET' | 'POST'
  body?: unknown
}

export interface SearchPage {
  scenes: Scene[]
  matched: number | null
  next: PageRequest | null
}

export function buildSearchBody({ bbox, start, end, maxCloud, fullTilesOnly, limit = 20 }: SearchParams) {
  const query: Record<string, { lte: number }> = { 'eo:cloud_cover': { lte: maxCloud } }
  if (fullTilesOnly) query['s2:nodata_pixel_percentage'] = { lte: FULL_TILE_MAX_NODATA }
  return {
    collections: [COLLECTION],
    bbox,
    datetime: `${start}T00:00:00Z/${end}T23:59:59Z`,
    limit,
    query,
    sortby: [{ field: 'properties.datetime', direction: 'desc' }],
  }
}

export function searchRequest(params: SearchParams): PageRequest {
  return { href: `${STAC_API}/search`, method: 'POST', body: buildSearchBody(params) }
}

export async function fetchPage(request: PageRequest, signal?: AbortSignal): Promise<SearchPage> {
  const json = (await fetchJson(request, signal)) as StacItemCollection
  return {
    scenes: json.features.map(parseItem),
    matched: json.numberMatched ?? json.context?.matched ?? null,
    next: nextRequest(json.links, request),
  }
}

export async function fetchScene(id: string, signal?: AbortSignal): Promise<Scene> {
  const href = `${STAC_API}/collections/${COLLECTION}/items/${encodeURIComponent(id)}`
  return parseItem((await fetchJson({ href, method: 'GET' }, signal)) as StacItem)
}

async function fetchJson({ href, method, body }: PageRequest, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(href, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().then((j: { description?: string }) => j.description, () => undefined)
    throw new Error(`STAC API responded ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return res.json()
}

/**
 * Turns the `next` link into a request. POST links may carry only the changed
 * fields (e.g. a page token) with `merge: true`, in which case they extend the
 * previous body.
 */
export function nextRequest(links: StacLink[] | undefined, previous: PageRequest): PageRequest | null {
  const link = links?.find((l) => l.rel === 'next')
  if (!link) return null
  if ((link.method ?? 'GET') === 'GET') return { href: link.href, method: 'GET' }
  const body = link.merge ? { ...(previous.body as object), ...link.body } : link.body
  return { href: link.href, method: 'POST', body }
}

export function parseItem(item: StacItem): Scene {
  const props = item.properties
  // Earth Search harmonises baseline ≥ 04.00 scenes by removing the +1000 DN
  // offset from the pixels, but still advertises `offset: -0.1` on the bands.
  const offsetApplied = props['earthsearch:boa_offset_applied'] === true
  const assets: Scene['assets'] = {}
  for (const key of BAND_KEYS) {
    const asset = item.assets[key]
    if (!asset) continue
    const band = asset['raster:bands']?.[0]
    assets[key] = { href: asset.href, scale: band?.scale ?? 1, offset: offsetApplied ? 0 : (band?.offset ?? 0) }
  }
  return {
    id: item.id,
    collection: item.collection ?? COLLECTION,
    datetime: props.datetime,
    cloudCover: props['eo:cloud_cover'] ?? null,
    coverage: props['s2:nodata_pixel_percentage'] === undefined ? null : 100 - props['s2:nodata_pixel_percentage'],
    platform: props.platform ?? null,
    epsg: parseEpsg(props['proj:code'] ?? props['proj:epsg']),
    bbox: item.bbox,
    geometry: item.geometry,
    thumbnail: item.assets.thumbnail?.href ?? null,
    assets,
  }
}

/** Accepts both `proj:epsg` (projection extension v1) and `proj:code` (v2). */
export function parseEpsg(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return value
  const match = value?.match(/^EPSG:(\d+)$/i)
  return match ? Number(match[1]) : null
}

// Just the parts of the STAC spec this app reads.
interface StacLink {
  rel: string
  href: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  merge?: boolean
}

interface StacAsset {
  href: string
  'raster:bands'?: { scale?: number; offset?: number }[]
}

export interface StacItem {
  id: string
  collection?: string
  bbox: Bbox
  geometry: Geometry
  properties: {
    datetime: string
    platform?: string
    'eo:cloud_cover'?: number
    's2:nodata_pixel_percentage'?: number
    'proj:epsg'?: number
    'proj:code'?: string
    'earthsearch:boa_offset_applied'?: boolean
  }
  assets: Record<string, StacAsset>
}

interface StacItemCollection {
  features: StacItem[]
  links?: StacLink[]
  numberMatched?: number
  context?: { matched?: number }
}
