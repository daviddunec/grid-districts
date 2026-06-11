# INTERFACES.md — FROZEN data contracts (Phase 2)

Post-freeze changes require a logged change-control entry here and re-issue to every consumer.

## Change control
- **CC-1 (2026-06-10, post code-review):** (a) GeoJSON Feature properties are EXACTLY the six
  enumerated fields (district, pop, deviationPct, cells, ppn, irregular) — the "verbatim" wording
  is superseded. (b) `out/<ST>/sealed_<arm>.log` is a documented optional artifact (written only
  when accretion seals a district early; absence = zero seals). (c) At-large states (AK DE ND SD
  VT WY): every CLI stage writes only `meta.json` `{state, fips, seats:1, atLarge:true, note}` and
  exits 0 — no grid/assign/stats/geojson by design. (d) stats_<arm>.json floats are full precision
  (FL-005); the 1e-9 verifier tolerance stands. Consumers re-issued: render-svg, render-leaflet,
  scripts/verify (no changes required — verified compatible).
All paths relative to project root. All JSON/CSV written **LF-only, UTF-8 no BOM**. All integers
formatted without separators or exponents. Determinism: no Date/random/locale anywhere.

## Grid geometry (the one coordinate convention)

- Projection: Albers (`PROJ_5070` from `src/constants.js`, registered via `proj4.defs`). All grid math in projected meters; GeoJSON/Leaflet output inverse-projected to lon/lat (EPSG:4326).
- Cell size `CELL_M = 1609.344` m (1 mi²).
- **row 0 = NORTHERNMOST row; col 0 = WESTERNMOST col.** Index `i = row * cols + col`.
- Grid anchored at `originX` (west edge, snapped DOWN to a multiple of CELL_M in absolute EPSG:5070 x) and `originYTop` (north edge, snapped UP to a multiple of CELL_M in absolute y).
- Cell (r,c) center: `x = originX + (c + 0.5) * CELL_M`, `y = originYTop - (r + 0.5) * CELL_M`.
- Block → cell: project `parseFloat(INTPTLON20), parseFloat(INTPTLAT20)`; `c = floor((x - originX)/CELL_M)`, `r = floor((originYTop - y)/CELL_M)`. TIGER internal points ONLY — no centroid computation anywhere.
- In-state rule: cell center (inverse-projected) inside state polygon OR ≥1 block internal point (any POP20, including 0) lands in the cell.
- Adjacency: **rook (4-neighbor)** everywhere — engine, repair, verifiers. Plus `bridges` (below), which count as edges for contiguity and repair.

## `out/<ST>/meta.json`

```json
{ "state": "CO", "fips": "08", "seats": 8, "residentPop": 5773714, "idealTarget": 721714.25,
  "originX": 0.0, "originYTop": 0.0, "rows": 0, "cols": 0, "cellSizeM": 1609.344,
  "inStateCells": 0, "populatedCells": 0, "blocks": 0, "populatedBlocks": 0 }
```

## `out/<ST>/grid.json`

```json
{ "rows": R, "cols": C,
  "inState": [0|1, ... R*C dense, row-major],
  "pop":     [int, ... R*C dense, row-major],
  "bridges": [[i1, i2], ...] }
```
`bridges`: virtual edges connecting island components to the main component — the minimum-Euclidean
cell pair (tie: lowest row, then col of the minor-component cell). Colorado: expected `[]`.

## `out/<ST>/cell_blocks.json`

`{ "r,c": ["GEOID20", ...], ... }` — populated cells only. Audit trail + v2 hot-cell splitting.

## `out/<ST>/assign_<arm>.csv` — THE canonical, hashed artifact

- Arms: `accretion-west`, `accretion-centroid`, `splitline`.
- Header exactly `row,col,district,pop`; one line per **in-state** cell; sorted by (row, then col);
  `district` ∈ 1..seats; LF line endings; final newline present.
- SHA-256 of the raw bytes is the determinism fingerprint.

## `out/<ST>/stats_<arm>.json`

```json
{ "arm": "", "districts": [ { "district": 1, "pop": 0, "cells": 0, "deviationPct": 0.0,
    "ppn": 0.0, "bboxAspect": 0.0, "bboxFill": 0.0, "irregular": false } ],
  "repair": { "orphanComponentsMoved": 0, "orphanCellsMoved": 0, "rebalanceMoves": 0 },
  "sha256": "" }
```
- `deviationPct = (pop - idealTarget) / idealTarget * 100` (signed; gates use |value|).
- `ppn = (4π·cells / exposedEdges²) / (π/4)`; exposed edge = cell side whose rook neighbor is a
  different district or out-of-state/out-of-grid. Bridges do NOT remove exposed edges.
- `irregular := ppn < 0.45 OR bboxAspect > 2.0 OR bboxFill < 0.45` (per frozen ab-metrics.md).
- `bboxAspect = max(w,h)/min(w,h)`, `bboxFill = cells/(w*h)` of the district's row/col bounding box.

## `out/<ST>/districts_<arm>.geojson`

FeatureCollection; one Feature per district; geometry = (Multi)Polygon from **grid edge tracing**
(stitch exposed edges into rings, inverse-project corners to lon/lat). Properties = the district's
stats_<arm> entry verbatim (district, pop, deviationPct, cells, ppn, irregular).

## `out/<ST>/scores.csv` — the A/B decision table

Header: `arm,eligible,gateFailures,maxAbsDevPct,meanAbsDevPct,irregularCount,meanPpn,repairMoves,sha256`
One row per arm. `eligible` = all four ab-metrics gates pass. Ranking (frozen in ab-metrics.md):
eligible → fewest irregular → highest meanPpn → fewest repairMoves → lowest maxAbsDevPct.

## CLI contract (`cli.js`)

```
node cli.js grid     --state CO                       # builds meta/grid/cell_blocks
node cli.js run      --state CO --arm <arm> [--shuffle] [--outdir out/CO]   # traverse+repair+stats+csv+geojson
node cli.js score    --state CO                       # aggregates stats_*.json -> scores.csv
node cli.js render   --state CO --arm <arm>           # svg + html from csv/geojson
node cli.js all      --state CO                       # grid + all arms + score + render
```
`--shuffle`: deterministically permutes block record order after load (fixed LCG, seed 1) BEFORE
binning — output artifacts MUST be byte-identical to the unshuffled run (order-independence proof).
Exit code 0 on success; non-zero + stderr message on any failure.

## Verifier scripts (`scripts/verify/`) — authored INDEPENDENTLY of src/

Consume ONLY: this document, `out/<ST>/*.{json,csv,geojson}`, `data/raw/<fips>/*.dbf`, and
`research/verdicts.json` values. **Must not import/require anything from `src/`** (enforced by grep).
Each prints PASS/FAIL lines and exits 0 only if all checks pass.

1. `check-population.js <ST>` — (a) conservation: Σ csv pop === Σ district pops === meta.residentPop
   (exact integers); (b) equality: max |deviationPct| ≤ 1.0 for CO (read gate from ab-metrics: ±1% pilot).
2. `check-coverage.js <ST>` — CSV rows are exactly the in-state cells of grid.json, each once, sorted.
3. `check-contiguity.js <ST>` — rook flood-fill per district over CSV cells (+bridges) = 1 component each.
4. `check-determinism.js <csvA> <csvB>` — SHA-256 byte equality of two artifacts.
5. `score-compactness.js <ST>` — independently re-derives every stats_<arm>.json district metric from
   the CSV + grid.json and reports any mismatch (tolerance: exact for ints, 1e-9 for ratios).
```
