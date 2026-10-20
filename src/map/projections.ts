import proj4 from 'proj4'
import { register } from 'ol/proj/proj4'

/**
 * proj4 definition for a WGS 84 / UTM zone (EPSG:326xx north, 327xx south),
 * the grid Sentinel-2 tiles are delivered in. Other codes are not supported.
 */
export function utmDefinition(epsg: number): string | null {
  const zone = epsg % 100
  const hemisphere = Math.floor(epsg / 100)
  if ((hemisphere !== 326 && hemisphere !== 327) || zone < 1 || zone > 60) return null
  return `+proj=utm +zone=${zone}${hemisphere === 327 ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`
}

/** Makes the projection known to OpenLayers so the COG can be reprojected to the map. */
export function ensureProjection(epsg: number): string | null {
  const code = `EPSG:${epsg}`
  if (proj4.defs(code)) return code
  const definition = utmDefinition(epsg)
  if (!definition) return null
  proj4.defs(code, definition)
  register(proj4)
  return code
}
