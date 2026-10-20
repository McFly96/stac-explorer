import type { Selection } from './MapView'
import { RENDER_MODE_KEYS, RENDER_MODES, rampGradient, supportsMode, type RenderMode } from '../map/renderModes'

interface Props {
  selection: Selection
  mode: RenderMode
  onModeChange: (mode: RenderMode) => void
  onClearCompare: () => void
  onClose: () => void
}

export default function DisplayPanel({ selection, mode, onModeChange, onClearCompare, onClose }: Props) {
  const { left, right } = selection
  if (!left) return null
  const info = RENDER_MODES[mode]
  const shown = [left, right].filter((s) => s !== null)

  return (
    <section className="display" aria-label="Display">
      <div className="row spread">
        <h2>Display</h2>
        <button type="button" onClick={onClose} aria-label="Close the scene">
          ✕
        </button>
      </div>

      <div className="modes" role="radiogroup" aria-label="Rendering">
        {RENDER_MODE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={key === mode}
            disabled={!shown.every((s) => supportsMode(s, key))}
            onClick={() => onModeChange(key)}
          >
            {RENDER_MODES[key].label}
          </button>
        ))}
      </div>
      <p className="muted">{info.description}</p>

      {info.index && (
        <div className="legend">
          <div className="ramp" style={{ background: rampGradient(info.index.stops) }} />
          <div className="row spread muted">
            <span>{info.index.stops[0][0]}</span>
            <span>{info.index.stops[info.index.stops.length - 1][0]}</span>
          </div>
          <p className="muted">Hover the image to read the value.</p>
        </div>
      )}

      {right && (
        <div className="compare-info">
          <p>
            <span className="tag left">{left.datetime.slice(0, 10)}</span> vs{' '}
            <span className="tag right">{right.datetime.slice(0, 10)}</span>
          </p>
          <p className="muted">Drag the slider at the bottom of the map to swipe between the two dates.</p>
          <button type="button" onClick={onClearCompare}>
            Stop comparing
          </button>
        </div>
      )}
    </section>
  )
}
