# STAC Explorer

Search, view and compare Sentinel-2 imagery in the browser, straight from a
public [STAC](https://stacspec.org) catalogue. There is no tile server: the
Cloud-Optimized GeoTIFFs are read with HTTP range requests and rendered on the
GPU.

- **Stack:** React 19 + TypeScript, OpenLayers 10 (WebGL tiles, GeoTIFF source), proj4, Vite, Vitest + Testing Library
- **Data:** [Earth Search](https://element84.com/earth-search/) STAC API, collection `sentinel-2-l2a` (COGs on AWS Open Data)
- **UX mock-up:** [docs/mockup.pdf](docs/mockup.pdf) (hand-drawn paper prototype, see [docs/MOCKUP.md](docs/MOCKUP.md))

## Features

| | |
| --- | --- |
| **Catalogue search** | STAC item search by area (map view or a drawn box), date range and cloud cover, newest first, with pagination that follows the API's `next` link |
| **Footprints** | Scene outlines on the map, linked to the result list on hover; click an outline to open the scene |
| **COG rendering in the browser** | `ol/source/GeoTIFF` + `WebGLTileLayer`; UTM tiles are reprojected client-side to Web Mercator (proj4 definitions are built on the fly) |
| **Band maths on the GPU** | True colour, false colour (NIR/red/green), NDVI and NDWI, written as OpenLayers style expressions that use each band's `scale`/`offset` from the STAC raster extension |
| **Pixel readout** | Hover the image to read the index value under the cursor |
| **Before / after compare** | Pick a second date and swipe between the two scenes (WebGL scissor test) |
| **Shareable links** | The shown scene, the compared one and the rendering mode live in the URL hash |
| **Partial tiles filter** | Skips tiles the satellite swath only grazes (`s2:nodata_pixel_percentage`) |

## Getting started

Requires Node.js ≥ 20.19.

```bash
npm install
npm run dev        # http://localhost:5173
```

Try a shared link once the dev server runs:
`http://localhost:5173/#scene=S2B_32SMF_20261019_0_L2A&compare=S2B_32SMF_20260820_0_L2A&mode=ndvi`

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check and build into `dist/` (relative base, works from any sub-path) |
| `npm run preview` | Serve the production build |
| `npm test` | Unit and component tests |
| `npm run typecheck` / `npm run lint` | TypeScript / oxlint |

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests and build on every
push; `pages.yml` deploys `dist/` to GitHub Pages from `main`.

## Project structure

```
src/
├── stac/search.ts          # STAC item search, paging, item → Scene parsing
├── map/
│   ├── renderModes.ts      # Band combinations, index formulas, colour ramps
│   └── projections.ts      # UTM zone → proj4 definition, registered in OpenLayers
├── state/urlState.ts       # URL hash ⇄ shown scene / compare / mode
├── components/
│   ├── MapView.tsx         # OpenLayers map: footprints, drawing, COG layers, swipe, readout
│   ├── SearchPanel.tsx     # Filters form
│   ├── ResultList.tsx      # Scene cards (thumbnail, date, clouds, coverage)
│   └── DisplayPanel.tsx    # Rendering mode, legend, compare controls
└── App.tsx                 # State, search lifecycle, layout
```

## Notes on the data

Things worth knowing that the code handles:

- **Band layout.** With `nodata` set on the sources, OpenLayers appends a
  *single* alpha band after all the source bands (`[nir, red, alpha]`), so the
  style expressions address bands by position in that order.
- **Reflectance offset.** Since processing baseline 04.00, L2A digital numbers
  carry a +1000 offset. Earth Search removes it from the pixels on its
  harmonised items (`earthsearch:boa_offset_applied: true`) but still declares
  `offset: -0.1`; applying it a second time would break every index, so it is
  ignored for those items.
- **Projections.** Sentinel-2 tiles come in WGS 84 / UTM (EPSG:326xx/327xx).
  These are defined locally instead of being looked up on epsg.io.

## Roadmap

- [ ] Cloud mask from the `SCL` band (hide clouds and shadows in indices)
- [ ] NDVI difference map between the two compared dates
- [ ] Time series of the index at a clicked point across all results
- [ ] Choice of STAC endpoint/collection (Landsat, Copernicus Data Space)
- [ ] Code-split the GeoTIFF decoders to shrink the initial bundle
- [ ] End-to-end tests (Playwright) against a recorded STAC response
