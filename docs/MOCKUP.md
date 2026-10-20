# Mock-up

| Page | Content |
| --- | --- |
| 1 | Landing (search form, placeholder cards while STAC answers) and the user flow |
| 2 | Results: drawn search area, scene footprints, result cards |
| 3 | A scene on the map: rendering modes, NDVI legend, value under the cursor |
| 4 | Before / after compare, error state and mobile layout |

## User journey

1. The user opens the site. The map of Italy shows up and a first search runs on the map view (last 30 days, max 20% clouds).
2. The user draws a box around the place they care about and searches again.
3. The results list the scenes, newest first, with cloud cover and how much of the tile has data. Hovering a card highlights its footprint on the map.
4. The user clicks **Show**: the map zooms to the scene and draws it in true colour.
5. The user switches to NDVI or NDWI and hovers the image to read the value.
6. The user clicks **Compare** on an older date and drags the swipe handle between the two.
7. The user copies the URL: it reopens the same scenes, compared, in the same mode.
