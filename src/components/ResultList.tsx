import type { Scene } from '../stac/search'
import type { Selection } from './MapView'

interface Props {
  scenes: Scene[]
  matched: number | null
  hoveredId: string | null
  selection: Selection
  onHover: (id: string | null) => void
  onShow: (scene: Scene) => void
  onCompare: (scene: Scene) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export default function ResultList(props: Props) {
  const { scenes, matched, hoveredId, selection, onHover, onShow, onCompare, hasMore, loadingMore, onLoadMore } = props

  if (!scenes.length) return <p className="state">No scene matches these filters. Try a wider area, more dates or more clouds.</p>

  return (
    <section className="results" aria-label="Search results">
      <p className="muted">
        {scenes.length}
        {matched !== null && ` of ${matched}`} scenes, newest first
      </p>
      <ul>
        {scenes.map((scene) => {
          const isLeft = scene.id === selection.left?.id
          const isRight = scene.id === selection.right?.id
          return (
            <li
              key={scene.id}
              className={`scene${scene.id === hoveredId ? ' hovered' : ''}${isLeft ? ' left' : ''}${isRight ? ' right' : ''}`}
              onMouseEnter={() => onHover(scene.id)}
              onMouseLeave={() => onHover(null)}
            >
              {scene.thumbnail ? (
                <img src={scene.thumbnail} alt="" loading="lazy" width={72} height={72} />
              ) : (
                <div className="thumb-placeholder" aria-hidden="true" />
              )}
              <div className="scene-body">
                <h3>{dateFormat.format(new Date(scene.datetime))} UTC</h3>
                <p className="muted">
                  {scene.cloudCover !== null && <span title="Cloud cover">☁ {scene.cloudCover.toFixed(0)}%</span>}
                  {scene.coverage !== null && <span title="Share of the tile with data">▦ {scene.coverage.toFixed(0)}%</span>}
                  {scene.platform && <span>{scene.platform.replace('sentinel-', 'S')}</span>}
                </p>
                <div className="row">
                  <button type="button" aria-pressed={isLeft} onClick={() => onShow(scene)}>
                    {isLeft ? 'Shown' : 'Show'}
                  </button>
                  <button
                    type="button"
                    aria-pressed={isRight}
                    disabled={!selection.left || isLeft}
                    title={selection.left ? 'Compare with the shown scene' : 'Show a scene first'}
                    onClick={() => onCompare(scene)}
                  >
                    {isRight ? 'Comparing' : 'Compare'}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <button type="button" className="load-more" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}
