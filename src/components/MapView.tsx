import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import WebGLTileLayer from 'ol/layer/WebGLTile'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import GeoTIFF from 'ol/source/GeoTIFF'
import GeoJSON from 'ol/format/GeoJSON'
import Feature from 'ol/Feature'
import Draw, { createBox } from 'ol/interaction/Draw'
import { fromExtent } from 'ol/geom/Polygon'
import { Fill, Stroke, Style } from 'ol/style'
import { defaults as defaultControls, ScaleLine } from 'ol/control'
import { fromLonLat, transformExtent } from 'ol/proj'
import { getRenderPixel } from 'ol/render'
import type RenderEvent from 'ol/render/Event'
import 'ol/ol.css'
import type { Bbox, Scene } from '../stac/search'
import { ensureProjection } from '../map/projections'
import { layerConfig, readIndex, RENDER_MODES, type RenderMode } from '../map/renderModes'

const VIEW_PROJECTION = 'EPSG:3857'
const geojson = new GeoJSON({ dataProjection: 'EPSG:4326', featureProjection: VIEW_PROJECTION })

const toLonLat = (extent: number[]) => transformExtent(extent, VIEW_PROJECTION, 'EPSG:4326') as Bbox
const fromLonLatExtent = (bbox: Bbox) => transformExtent(bbox, 'EPSG:4326', VIEW_PROJECTION)

export interface Selection {
  left: Scene | null
  right: Scene | null
}

interface Props {
  scenes: Scene[]
  hoveredId: string | null
  selection: Selection
  mode: RenderMode
  area: Bbox | null
  drawing: boolean
  onHover: (id: string | null) => void
  onPick: (id: string) => void
  onDrawEnd: (bbox: Bbox) => void
  onViewChange: (bbox: Bbox) => void
  onLayerError: (message: string) => void
}

const STYLES = {
  footprint: new Style({ stroke: new Stroke({ color: 'rgba(78,168,255,0.7)', width: 1 }) }),
  hovered: new Style({
    stroke: new Stroke({ color: '#4ea8ff', width: 2.5 }),
    fill: new Fill({ color: 'rgba(78,168,255,0.15)' }),
  }),
  left: new Style({ stroke: new Stroke({ color: '#ffd166', width: 2 }) }),
  right: new Style({ stroke: new Stroke({ color: '#ef8bff', width: 2, lineDash: [6, 4] }) }),
  area: new Style({
    stroke: new Stroke({ color: '#ff8c42', width: 2, lineDash: [6, 4] }),
    fill: new Fill({ color: 'rgba(255,140,66,0.08)' }),
  }),
}

export default function MapView(props: Props) {
  const { scenes, hoveredId, selection, mode, area, drawing } = props
  const targetRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<OlMap | null>(null)
  const footprintsRef = useRef(new VectorSource())
  const areaRef = useRef(new VectorSource())
  const leftLayerRef = useRef<WebGLTileLayer | null>(null)
  const rightLayerRef = useRef<WebGLTileLayer | null>(null)
  const swipeRef = useRef(50)
  // Latest props for the OpenLayers listeners, which are bound only once.
  const latest = useRef(props)
  useLayoutEffect(() => {
    latest.current = props
  })

  const [swipe, setSwipe] = useState(50)
  const [pendingTiles, setPendingTiles] = useState(0)
  const [readout, setReadout] = useState<string | null>(null)

  useEffect(() => {
    const footprints = new VectorLayer({
      source: footprintsRef.current,
      zIndex: 20,
      style: (feature) => {
        const id = feature.getId()
        const { hoveredId, selection } = latest.current
        if (id === hoveredId) return STYLES.hovered
        if (id === selection.left?.id) return STYLES.left
        if (id === selection.right?.id) return STYLES.right
        return STYLES.footprint
      },
    })
    const map = new OlMap({
      target: targetRef.current!,
      layers: [
        new TileLayer({ source: new OSM(), zIndex: 0 }),
        footprints,
        new VectorLayer({ source: areaRef.current, style: STYLES.area, zIndex: 30 }),
      ],
      view: new View({ projection: VIEW_PROJECTION, center: fromLonLat([12.5, 42]), zoom: 6 }),
      controls: defaultControls().extend([new ScaleLine()]),
    })
    mapRef.current = map

    map.on('moveend', () => {
      const extent = map.getView().calculateExtent(map.getSize())
      latest.current.onViewChange(toLonLat(extent))
    })

    map.on('pointermove', (event) => {
      if (event.dragging) return
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f, { layerFilter: (l) => l === footprints })
      const id = (feature?.getId() as string | undefined) ?? null
      if (id !== latest.current.hoveredId) latest.current.onHover(id)
      targetRef.current!.style.cursor = id ? 'pointer' : ''

      // Index value of the scene under the cursor (right scene past the swipe line).
      const { selection, mode } = latest.current
      const width = map.getSize()?.[0] ?? 0
      const onRight = rightLayerRef.current && event.pixel[0] > (width * swipeRef.current) / 100
      const layer = onRight ? rightLayerRef.current : leftLayerRef.current
      const scene = onRight ? selection.right : selection.left
      const value = layer && scene ? readIndex(layer.getData(event.pixel) as ArrayLike<number> | null, scene, mode) : null
      setReadout(value === null ? null : `${RENDER_MODES[mode].label} ${value.toFixed(2)}`)
    })

    map.on('singleclick', (event) => {
      if (latest.current.drawing) return
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f, { layerFilter: (l) => l === footprints })
      if (feature) latest.current.onPick(feature.getId() as string)
    })

    return () => {
      map.setTarget(undefined)
      mapRef.current = null
    }
  }, [])

  // Footprints of the search results.
  useEffect(() => {
    const source = footprintsRef.current
    source.clear()
    source.addFeatures(
      scenes.map((scene) => {
        const feature = new Feature(geojson.readGeometry(scene.geometry) ?? undefined)
        feature.setId(scene.id)
        return feature
      }),
    )
  }, [scenes])

  // Restyle on hover / selection changes.
  useEffect(() => {
    footprintsRef.current.changed()
  }, [hoveredId, selection])

  // Search area.
  useEffect(() => {
    const source = areaRef.current
    source.clear()
    if (area) source.addFeature(new Feature(fromExtent(fromLonLatExtent(area))))
  }, [area])

  // Box drawing.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !drawing) return
    const draw = new Draw({ source: areaRef.current, type: 'Circle', geometryFunction: createBox(), freehand: true })
    draw.on('drawstart', () => areaRef.current.clear())
    draw.on('drawend', (event) => {
      latest.current.onDrawEnd(toLonLat(event.feature.getGeometry()!.getExtent()))
    })
    map.addInteraction(draw)
    return () => {
      map.removeInteraction(draw)
    }
  }, [drawing])

  // Scene imagery: one WebGL layer per side, rebuilt when the scene or mode changes.
  const leftId = selection.left?.id
  const rightId = selection.right?.id
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layers: WebGLTileLayer[] = []

    const add = (scene: Scene, side: 'left' | 'right', zIndex: number) => {
      const config = layerConfig(scene, mode)
      const projection = scene.epsg === null ? null : ensureProjection(scene.epsg)
      if (!config || !projection) {
        latest.current.onLayerError(`${scene.id} cannot be shown in ${RENDER_MODES[mode].label}.`)
        return null
      }
      const source = new GeoTIFF({ sources: config.sources, normalize: config.normalize, projection })
      source.on('tileloadstart', () => setPendingTiles((n) => n + 1))
      source.on(['tileloadend', 'tileloaderror'], () => setPendingTiles((n) => Math.max(0, n - 1)))
      source.on('change', () => {
        if (source.getState() === 'error') latest.current.onLayerError(`Could not open the imagery of ${scene.id}.`)
      })
      // A distinct class name gives each side its own canvas: WebGL layers that
      // share one would also share the swipe's scissor test.
      const layer = new WebGLTileLayer({ source, style: config.style, zIndex, className: `ol-layer scene-${side}` })
      map.addLayer(layer)
      layers.push(layer)
      return layer
    }

    const { left, right } = latest.current.selection
    leftLayerRef.current = left ? add(left, 'left', 10) : null
    const rightLayer = right ? add(right, 'right', 11) : null
    rightLayerRef.current = rightLayer
    if (rightLayer) {
      // Swipe: only draw the right scene past the slider (WebGL scissor test).
      rightLayer.on('prerender', (event: RenderEvent) => {
        const gl = event.context as WebGL2RenderingContext
        const [width, height] = map.getSize()!
        const bottomLeft = getRenderPixel(event, [(width * swipeRef.current) / 100, height])
        const topRight = getRenderPixel(event, [width, 0])
        gl.enable(gl.SCISSOR_TEST)
        gl.scissor(bottomLeft[0], bottomLeft[1], Math.round(topRight[0] - bottomLeft[0]), Math.round(topRight[1] - bottomLeft[1]))
      })
      rightLayer.on('postrender', (event: RenderEvent) => {
        const gl = event.context as WebGL2RenderingContext
        gl.disable(gl.SCISSOR_TEST)
      })
    }

    return () => {
      for (const layer of layers) {
        map.removeLayer(layer)
        layer.dispose()
      }
      setPendingTiles(0)
      setReadout(null)
    }
  }, [leftId, rightId, mode])

  // Zoom to the scene when a new one is opened.
  useEffect(() => {
    const scene = latest.current.selection.left
    if (scene) mapRef.current?.getView().fit(fromLonLatExtent(scene.bbox), { padding: [40, 40, 40, 40], duration: 400 })
  }, [leftId])

  const onSwipe = (value: number) => {
    swipeRef.current = value
    setSwipe(value)
    mapRef.current?.render()
  }

  return (
    <div className="map-wrapper">
      <div ref={targetRef} className="map" data-testid="map" />
      {selection.right && (
        <>
          <div className="swipe-line" style={{ left: `${swipe}%` }} aria-hidden="true" />
          <div className="swipe-labels" aria-hidden="true">
            <span className="tag left">{selection.left?.datetime.slice(0, 10)}</span>
            <span className="tag right">{selection.right.datetime.slice(0, 10)}</span>
          </div>
          <input
            className="swipe"
            type="range"
            min={0}
            max={100}
            value={swipe}
            aria-label="Compare: move the swipe line"
            onChange={(e) => onSwipe(Number(e.target.value))}
          />
        </>
      )}
      {drawing && <div className="map-hint">Drag on the map to draw the search area</div>}
      {readout && <div className="readout">{readout}</div>}
      {pendingTiles > 0 && (
        <div className="map-loading" role="status">
          Loading imagery…
        </div>
      )}
    </div>
  )
}
