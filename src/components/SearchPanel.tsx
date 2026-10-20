import type { FormEvent } from 'react'
import type { Bbox } from '../stac/search'

export interface Filters {
  start: string
  end: string
  maxCloud: number
  fullTilesOnly: boolean
}

interface Props {
  filters: Filters
  onChange: (filters: Filters) => void
  area: Bbox | null
  drawing: boolean
  onToggleDraw: () => void
  onClearArea: () => void
  onSubmit: () => void
  busy: boolean
}

const formatBbox = (b: Bbox) => b.map((v) => v.toFixed(2)).join(', ')

export default function SearchPanel({ filters, onChange, area, drawing, onToggleDraw, onClearArea, onSubmit, busy }: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }
  const invalidDates = filters.start > filters.end

  return (
    <form className="search" onSubmit={submit} aria-label="Search Sentinel-2 scenes">
      <fieldset>
        <legend>Area</legend>
        <p className="muted area-label">{area ? `Drawn box: ${formatBbox(area)}` : 'Current map view'}</p>
        <div className="row">
          <button type="button" aria-pressed={drawing} onClick={onToggleDraw}>
            {drawing ? 'Cancel drawing' : 'Draw a box'}
          </button>
          {area && (
            <button type="button" onClick={onClearArea}>
              Use map view
            </button>
          )}
        </div>
      </fieldset>

      <fieldset className="dates">
        <legend>Dates</legend>
        <label>
          From
          <input
            type="date"
            value={filters.start}
            max={filters.end}
            onChange={(e) => onChange({ ...filters, start: e.target.value })}
            required
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.end}
            min={filters.start}
            onChange={(e) => onChange({ ...filters, end: e.target.value })}
            required
          />
        </label>
      </fieldset>

      <label className="cloud">
        <span>
          Max cloud cover <output>{filters.maxCloud}%</output>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.maxCloud}
          onChange={(e) => onChange({ ...filters, maxCloud: Number(e.target.value) })}
        />
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={filters.fullTilesOnly}
          onChange={(e) => onChange({ ...filters, fullTilesOnly: e.target.checked })}
        />
        Skip partial tiles (edge of the satellite swath)
      </label>

      <button type="submit" className="primary" disabled={busy || invalidDates}>
        {busy ? 'Searching…' : 'Search scenes'}
      </button>
    </form>
  )
}
