import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSearchBody, fetchPage, nextRequest, parseEpsg, parseItem, searchRequest, STAC_API } from './search'
import { makeItem } from '../test/fixtures/items'

const params = {
  bbox: [12, 41, 13, 42] as [number, number, number, number],
  start: '2026-09-01',
  end: '2026-09-30',
  maxCloud: 20,
  fullTilesOnly: false,
}

describe('buildSearchBody', () => {
  it('turns the filters into an item-search body', () => {
    expect(buildSearchBody(params)).toEqual({
      collections: ['sentinel-2-l2a'],
      bbox: [12, 41, 13, 42],
      datetime: '2026-09-01T00:00:00Z/2026-09-30T23:59:59Z',
      limit: 20,
      query: { 'eo:cloud_cover': { lte: 20 } },
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
    })
  })

  it('can skip partial tiles', () => {
    expect(buildSearchBody({ ...params, fullTilesOnly: true }).query).toEqual({
      'eo:cloud_cover': { lte: 20 },
      's2:nodata_pixel_percentage': { lte: 10 },
    })
  })
})

describe('parseItem', () => {
  it('keeps the bands with their scale and offset', () => {
    const scene = parseItem(makeItem())
    expect(scene).toMatchObject({
      id: 'S2B_33TTG_20260912_0_L2A',
      cloudCover: 3.4,
      coverage: 98,
      platform: 'sentinel-2b',
      epsg: 32633,
      thumbnail: expect.stringContaining('thumbnail.jpg'),
    })
    expect(scene.assets.red).toEqual({ href: expect.stringContaining('B04.tif'), scale: 0.0001, offset: -0.1 })
    expect(scene.assets.visual).toEqual({ href: expect.stringContaining('TCI.tif'), scale: 1, offset: 0 })
    expect(scene.assets.swir16).toBeUndefined()
  })

  it('drops the offset when Earth Search already removed it from the pixels', () => {
    const scene = parseItem(makeItem('x', { 'earthsearch:boa_offset_applied': true }))
    expect(scene.assets.red).toMatchObject({ scale: 0.0001, offset: 0 })
  })

  it('reads the projection from proj:code too', () => {
    const scene = parseItem(makeItem('x', { 'proj:epsg': undefined, 'proj:code': 'EPSG:32733' }))
    expect(scene.epsg).toBe(32733)
  })
})

describe('parseEpsg', () => {
  it.each([
    [32633, 32633],
    ['EPSG:4326', 4326],
    ['OGC:CRS84', null],
    [undefined, null],
  ])('%s → %s', (input, expected) => expect(parseEpsg(input)).toBe(expected))
})

describe('nextRequest', () => {
  const previous = searchRequest(params)

  it('merges a POST token into the previous body', () => {
    const next = nextRequest([{ rel: 'next', href: `${STAC_API}/search`, method: 'POST', merge: true, body: { next: 'abc' } }], previous)
    expect(next).toEqual({ href: `${STAC_API}/search`, method: 'POST', body: { ...(previous.body as object), next: 'abc' } })
  })

  it('follows GET links as they are', () => {
    expect(nextRequest([{ rel: 'next', href: 'https://x/search?page=2' }], previous)).toEqual({ href: 'https://x/search?page=2', method: 'GET' })
  })

  it('returns null on the last page', () => {
    expect(nextRequest([{ rel: 'self', href: 'https://x' }], previous)).toBeNull()
  })
})

describe('fetchPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs the search and parses the page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ type: 'FeatureCollection', numberMatched: 42, features: [makeItem()], links: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const page = await fetchPage(searchRequest(params))

    expect(fetchMock).toHaveBeenCalledWith(`${STAC_API}/search`, expect.objectContaining({ method: 'POST', body: JSON.stringify(buildSearchBody(params)) }))
    expect(page.matched).toBe(42)
    expect(page.scenes).toHaveLength(1)
    expect(page.next).toBeNull()
  })

  it('surfaces the API error description', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ description: 'bbox is invalid' }, { status: 400 })))
    await expect(fetchPage(searchRequest(params))).rejects.toThrow('STAC API responded 400: bbox is invalid')
  })
})
