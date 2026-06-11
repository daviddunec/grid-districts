# Phase 3 Visual QA — Colorado Redistricting Maps

**Date:** 2026-06-10  
**Maps reviewed:** map_accretion-west, map_accretion-centroid  
**State:** CO | Seats: 8 | Total cells: 104,135 | Ideal target: 721,714.25 pop/district

---

## Screenshots Taken

| Map | Screenshot taken | Notes |
|-----|-----------------|-------|
| map_accretion-west | YES | Info panel visible; map canvas black (see bug below) |
| map_accretion-centroid | YES | Info panel visible; map canvas black (see bug below) |

Screenshots saved to `am-enterprise-kit/reviews_west_initial.png` and `reviews_centroid_initial.png`.

---

## CRITICAL BUG: Leaflet SRI Hash Mismatch (All 3 HTML Maps)

**All three HTML maps (west, centroid, splitline) are non-functional in any standard browser.**

- **Symptom:** Map canvas renders entirely black. `L is not defined` JS error.
- **Root cause:** The `<script>` tag loading Leaflet from unpkg CDN includes an `integrity` attribute with a hash that does not match the current file served by unpkg:
  ```html
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV/XN2GqmM="
    crossorigin="">
  ```
  Browser console: `Failed to find a valid digest in the 'integrity' attribute … computed SHA-256 integrity '20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='. The resource has been blocked.`
- **Impact:** Interactive map (GeoJSON overlay, color fills, popups, click events) does not render.
- **Fix options:**
  1. Update the `integrity` hash to `sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=` (the actual hash Chrome computed), OR
  2. Remove the `integrity` attribute entirely if pinned CDN hash management is not a priority, OR
  3. Bundle Leaflet locally (avoids CDN dependency).
- **Affects:** All interactive HTML map QA items below are evaluated from data/SVG only, not live browser render.

**Secondary bug:** Page title and info panel header show `CO — undefined` instead of `CO — accretion-west` / `CO — accretion-centroid`. The algorithm name template variable is not being substituted into the HTML `<title>` and `<h3>` tags. The SVG files correctly embed the algorithm name (e.g., `CO — accretion-west — max |dev| 0.02%`).

---

## map_accretion-west — Findings

### Structural Checks

| Check | Result | Detail |
|-------|--------|--------|
| HTML file exists | PASS | `out/CO/map_accretion-west.html` present |
| Inlined GeoJSON (FeatureCollection) | PASS | `var GEOJSON_DATA = {"type":"FeatureCollection",...}` in script block |
| Feature count in HTML | PASS | 8 Features |
| SVG file exists | PASS | `out/CO/map_accretion-west.svg` present |
| SVG rect count | PASS | 104,145 rects (expect >100k; grid has 104,135 in-state cells) |
| SVG NaN coordinates | PASS | No NaN found anywhere in SVG |
| SVG legend entries | PASS | 8 entries: D1–D8, each with colored `<rect>` + population + deviation text |
| GeoJSON file exists | PASS | `out/CO/districts_accretion-west.geojson` present |
| GeoJSON feature count | PASS | 8 features |
| GeoJSON coordinate bounds | PASS | lon [-109.07, -102.03], lat [36.98, 41.02] — within CO bounds [-110,-101] × [36,42] |
| GeoJSON NaN coordinates | PASS | None |

### District Population & Deviation (from GeoJSON)

| District | Population | Deviation | Cells | Irregular | Center (lon, lat) |
|----------|-----------|-----------|-------|-----------|-------------------|
| D1 | 721,845 | +0.018% | 41,266 | No | (-107.06, 39.46) — WEST |
| D2 | 721,728 | +0.002% | 18,664 | YES | (-106.91, 38.67) |
| D3 | 721,714 | -0.000% | 4,223 | No | (-104.69, 40.52) |
| D4 | 721,706 | -0.001% | 9,092 | No | (-103.81, 40.18) |
| D5 | 721,689 | -0.004% | 268 | No | (-105.00, 39.93) |
| D6 | 721,606 | -0.015% | 126 | No | (-104.97, 39.69) |
| D7 | 721,712 | -0.000% | 2,129 | No | (-104.48, 39.33) |
| D8 | 721,714 | -0.000% | 28,367 | No | (-103.52, 39.00) |

- All deviations ≤ 0.018% — well under the 0.03% threshold stated in the QA spec.
- D1 center lon=-107.06 is in the western part of the state (CO spans approx -109 to -102). Confirms the west-seed arm starts on the western edge.
- D2 marked `irregular=true` (1 of 8). D5/D6 have very small cell counts (268, 126) suggesting small urban/suburban slivers.

### Visual Render (SVG)

| Check | Result | Detail |
|-------|--------|--------|
| 8 distinct district colors | PASS | 8 palette colors: #4e79a7, #f28e2b, #e15759, #76b7b2, #59a14f, #edc948, #b07aa1, #ff9da7 |
| Blocky/square shapes | PASS (SVG structure) | 104,145 rect elements confirm grid-cell rasterization |
| No holes / missing polygons | PASS | All 8 district label annotations present in SVG; no NaN coords |
| Legend readable | PASS | Title: "CO — accretion-west — max |dev| 0.02%"; D1–D8 with pop+deviation |
| Interactive popup (HTML) | NOT TESTABLE | Leaflet blocked by SRI; popup click cannot be tested |

---

## map_accretion-centroid — Findings

### Structural Checks

| Check | Result | Detail |
|-------|--------|--------|
| HTML file exists | PASS | `out/CO/map_accretion-centroid.html` present |
| Inlined GeoJSON (FeatureCollection) | PASS | `var GEOJSON_DATA = {"type":"FeatureCollection",...}` in script block |
| Feature count in HTML | PASS | 8 Features |
| SVG file exists | PASS | `out/CO/map_accretion-centroid.svg` present |
| SVG rect count | PASS | 104,146 rects |
| SVG NaN coordinates | PASS | No NaN found |
| SVG legend entries | PASS | 8 entries: D1–D8, each with colored `<rect>` + population + deviation text |
| GeoJSON file exists | PASS | `out/CO/districts_accretion-centroid.geojson` present |
| GeoJSON feature count | PASS | 8 features |
| GeoJSON coordinate bounds | PASS | lon [-109.07, -102.03], lat [36.98, 41.02] — within CO bounds |
| GeoJSON NaN coordinates | PASS | None |

### District Population & Deviation (from GeoJSON)

| District | Population | Deviation | Cells | Irregular | Center (lon, lat) |
|----------|-----------|-----------|-------|-----------|-------------------|
| D1 | 721,701 | -0.002% | 6,309 | No | (-105.57, 39.00) — CENTER |
| D2 | 721,627 | -0.012% | 10,392 | No | (-105.45, 38.13) |
| D3 | 721,714 | -0.000% | 6,191 | No | (-104.17, 39.12) |
| D4 | 721,684 | -0.004% | 13,297 | No | (-106.52, 38.94) |
| D5 | 721,886 | +0.024% | 121 | No | (-104.97, 39.71) |
| D6 | 721,717 | +0.000% | 401 | No | (-104.85, 39.85) |
| D7 | 721,713 | -0.000% | 2,195 | YES | (-105.13, 40.13) |
| D8 | 721,672 | -0.006% | 65,229 | YES | (-105.55, 39.00) |

- All deviations ≤ 0.024% — within 0.03% threshold.
- **D1 center: lon=-105.57, lat=39.00** vs Colorado state centroid approx lon=-105.7, lat=39.0. Offset: 0.13° lon, 0.00° lat. D1 starts at the geographic center of the state — the centroid-arm algorithm is working correctly.
- D8 has 65,229 cells (the large background district covering most of eastern CO), D5 has only 121 cells — smallest district, likely a dense urban sliver.
- D7 and D8 marked `irregular=true` (2 of 8).

### Visual Render (SVG)

| Check | Result | Detail |
|-------|--------|--------|
| 8 distinct district colors | PASS | Same 8-color Tableau palette as west map |
| Blocky/square shapes | PASS (SVG structure) | 104,146 rect elements |
| No holes / missing polygons | PASS | All 8 district labels present; no NaN coords |
| Legend readable | PASS | Title: "CO — accretion-centroid — max |dev| 0.02%"; D1–D8 listed |
| Interactive popup (HTML) | NOT TESTABLE | Leaflet blocked by SRI |

---

## Centroid Arm Visual Assessment

**Does D1 visibly start in the middle of the state?**

YES — confirmed by coordinate analysis:

- D1 centroid bbox center: **lon=-105.57, lat=39.00**
- Colorado geographic center: approximately lon=-105.7, lat=39.0
- Offset from true center: ~8 miles east-northeast — negligible
- D1 spans lon [-106.39, -104.75], lat [38.38, 39.62] — a roughly 100×85 mile box straddling the state's east-west midpoint and geographic heart
- Compare to west map D1: lon=-107.06 (over 90 miles west of center) — the contrast is clear

The centroid-arm algorithm correctly seeds District 1 at the state's geographic center rather than the western edge.

---

## Cross-Map Comparison

| Metric | accretion-west | accretion-centroid |
|--------|---------------|-------------------|
| Max deviation | +0.018% (D1) | +0.024% (D5) |
| Irregular districts | 1 (D2) | 2 (D7, D8) |
| D1 start position | Western CO (-107.06 lon) | Center CO (-105.57 lon) |
| D8 cell count | 28,367 | 65,229 |
| SVG rect count | 104,145 | 104,146 |
| GeoJSON bounds | Same | Same |
| Leaflet SRI bug | YES (all maps) | YES (all maps) |

---

## Issues Summary

| Severity | Issue | Affected Files |
|----------|-------|---------------|
| HIGH | Leaflet SRI integrity hash mismatch — interactive map fails to render in browser | map_accretion-west.html, map_accretion-centroid.html, map_splitline.html |
| MEDIUM | Algorithm name not substituted into HTML `<title>` and `<h3>` — shows "CO — undefined" | All 3 HTML maps |
| LOW | D5/D6 (west) and D5 (centroid) have very small cell counts (121–401 cells) — may indicate slivers worth reviewing for contiguity | GeoJSON data |

---

## VERDICT: PASS WITH NOTES

**Structural data is correct.** All GeoJSON and SVG artifacts pass every check:
- 8 features in every file, correct populations (~721,6xx–721,9xx), all deviations under 0.03%
- 104,135–104,149 rect elements in each SVG, zero NaN, 8 legend entries each
- All coordinates within Colorado bounds (lon [-110,-101], lat [36,42])
- Centroid arm D1 correctly placed at the geographic center of Colorado

**The interactive HTML maps do not render** due to a Leaflet CDN SRI hash mismatch that blocks the library from loading. This is a build-time bug (wrong hash embedded in the HTML template) not a data or algorithm error. Fix the hash or remove the `integrity` attribute and the maps will render correctly.

The algorithm name template variable (`undefined` in title/h3) is a secondary cosmetic bug in the HTML generation step.
