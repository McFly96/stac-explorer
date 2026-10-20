import { RENDER_MODE_KEYS, type RenderMode } from '../map/renderModes'

/** What the URL hash keeps, so a view can be shared as a link. */
export interface UrlState {
  left: string | null
  right: string | null
  mode: RenderMode
}

export function parseHash(hash: string): UrlState {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const mode = params.get('mode') as RenderMode | null
  const left = params.get('scene')
  return {
    left,
    right: left ? params.get('compare') : null,
    mode: mode && RENDER_MODE_KEYS.includes(mode) ? mode : 'true-color',
  }
}

export function toHash({ left, right, mode }: UrlState): string {
  if (!left) return ''
  const params = new URLSearchParams({ scene: left })
  if (right) params.set('compare', right)
  if (mode !== 'true-color') params.set('mode', mode)
  return `#${params}`
}
