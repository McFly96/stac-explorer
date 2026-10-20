import { useCallback, useEffect, useRef, useState } from 'react'
import MapView, { type Selection } from './components/MapView'
import SearchPanel, { type Filters } from './components/SearchPanel'
import ResultList from './components/ResultList'
import DisplayPanel from './components/DisplayPanel'
import { fetchPage, fetchScene, searchRequest, type Bbox, type PageRequest, type Scene } from './stac/search'
import { supportsMode, type RenderMode } from './map/renderModes'
import { parseHash, toHash } from './state/urlState'

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

function defaultFilters(): Filters {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 30)
  return { start: isoDate(start), end: isoDate(end), maxCloud: 20, fullTilesOnly: true }
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

export default function App() {
  const [filters, setFilters] = useState(defaultFilters)
  const [viewBbox, setViewBbox] = useState<Bbox | null>(null)
  const [area, setArea] = useState<Bbox | null>(null)
  const [drawing, setDrawing] = useState(false)

  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [scenes, setScenes] = useState<Scene[]>([])
  const [matched, setMatched] = useState<number | null>(null)
  const [next, setNext] = useState<PageRequest | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>({ left: null, right: null })
  // Read once: the hash is rewritten as soon as the selection changes.
  const [shared] = useState(() => parseHash(window.location.hash))
  const [mode, setMode] = useState<RenderMode>(shared.mode)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const searchAbort = useRef<AbortController | null>(null)

  const search = useCallback(
    (bbox: Bbox) => {
      searchAbort.current?.abort()
      const controller = new AbortController()
      searchAbort.current = controller
      setStatus({ kind: 'loading' })
      fetchPage(searchRequest({ bbox, ...filters }), controller.signal)
        .then((page) => {
          setScenes(page.scenes)
          setMatched(page.matched)
          setNext(page.next)
          setStatus({ kind: 'ready' })
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setStatus({ kind: 'error', message: errorMessage(err) })
        })
    },
    [filters],
  )

  const searchBbox = area ?? viewBbox
  const runSearch = () => {
    if (searchBbox) search(searchBbox)
  }

  // First search as soon as the map reports its extent.
  const searchedOnce = useRef(false)
  useEffect(() => {
    if (viewBbox && !searchedOnce.current) {
      searchedOnce.current = true
      search(viewBbox)
    }
  }, [viewBbox, search])

  const loadMore = () => {
    if (!next) return
    setLoadingMore(true)
    fetchPage(next)
      .then((page) => {
        setScenes((current) => [...current, ...page.scenes.filter((s) => !current.some((c) => c.id === s.id))])
        setNext(page.next)
      })
      .catch((err: unknown) => setNotice(errorMessage(err)))
      .finally(() => setLoadingMore(false))
  }

  // Restore a shared view from the URL.
  useEffect(() => {
    const { left, right } = shared
    if (!left) return
    const controller = new AbortController()
    Promise.all([fetchScene(left, controller.signal), right ? fetchScene(right, controller.signal) : null])
      .then(([l, r]) => setSelection({ left: l, right: r }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setNotice(`Could not open the shared scene: ${errorMessage(err)}`)
      })
    return () => controller.abort()
  }, [shared])

  useEffect(() => {
    const hash = toHash({ left: selection.left?.id ?? null, right: selection.right?.id ?? null, mode })
    if (hash !== window.location.hash) history.replaceState(null, '', hash || window.location.pathname)
  }, [selection, mode])

  const select = (next: Selection) => {
    setNotice(null)
    setSelection(next)
    const shown = [next.left, next.right].filter((s) => s !== null)
    if (!shown.every((s) => supportsMode(s, mode))) setMode('true-color')
  }

  const showScene = (scene: Scene) =>
    select({ left: scene, right: selection.right?.id === scene.id ? null : selection.right })

  const pick = (id: string) => {
    const scene = scenes.find((s) => s.id === id)
    if (scene && scene.id !== selection.left?.id && scene.id !== selection.right?.id) showScene(scene)
  }

  return (
    <div className={`app${panelOpen ? '' : ' panel-collapsed'}`}>
      <header className="topbar">
        <button
          type="button"
          className="panel-toggle"
          aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((v) => !v)}
        >
          ☰
        </button>
        <h1>
          STAC Explorer <span className="subtitle">Sentinel-2 L2A · Earth Search</span>
        </h1>
      </header>

      <aside className="sidebar">
        <SearchPanel
          filters={filters}
          onChange={setFilters}
          area={area}
          drawing={drawing}
          onToggleDraw={() => setDrawing((v) => !v)}
          onClearArea={() => setArea(null)}
          onSubmit={runSearch}
          busy={status.kind === 'loading'}
        />

        {notice && (
          <div className="notice" role="alert">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        <DisplayPanel
          selection={selection}
          mode={mode}
          onModeChange={setMode}
          onClearCompare={() => select({ ...selection, right: null })}
          onClose={() => select({ left: null, right: null })}
        />

        {status.kind === 'loading' && (
          <div className="state" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-card" aria-hidden="true" />
            ))}
          </div>
        )}
        {status.kind === 'error' && (
          <div className="state error" role="alert">
            <p>The search failed.</p>
            <p className="muted">{status.message}</p>
            <button type="button" onClick={runSearch}>
              Retry
            </button>
          </div>
        )}
        {status.kind === 'ready' && (
          <ResultList
            scenes={scenes}
            matched={matched}
            hoveredId={hoveredId}
            selection={selection}
            onHover={setHoveredId}
            onShow={showScene}
            onCompare={(scene) => select({ ...selection, right: scene })}
            hasMore={next !== null}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        )}
      </aside>

      <main className="main">
        <MapView
          scenes={scenes}
          hoveredId={hoveredId}
          selection={selection}
          mode={mode}
          area={area}
          drawing={drawing}
          onHover={setHoveredId}
          onPick={pick}
          onDrawEnd={(bbox) => {
            setArea(bbox)
            setDrawing(false)
          }}
          onViewChange={setViewBbox}
          onLayerError={setNotice}
        />
      </main>
    </div>
  )
}
