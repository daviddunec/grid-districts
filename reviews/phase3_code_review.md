# Phase 3 Code Review — Deterministic Redistricting Engine

Scope: src/{constants,download,geo,grid,score,repair}.js, src/traverse/{accretion,splitline}.js, cli.js
against the frozen docs/INTERFACES.md. Context: passed all 5 mechanical verifiers on CO (single-component,
8 seats, no bridges). This review targets what the verifiers cannot see — scale, latent determinism, and
edge cases not exercised by Colorado.

Severity key: BLOCKER = wrong districts or crash on a real state; MAJOR = wrong/too-slow at 50-state scale,
fine on CO; MINOR = correctness/robustness nit; NIT = cosmetic/contract polish.

---

## BLOCKER findings

### B1 — Math.min(...component) stack overflow on large components — repair.js:78,84,98
repair.js:78 computes mn = Math.min(...comps[ci]) for EVERY component in a district during Pass-1 orphan
reassignment, including the kept main component. Line 84 sorts orphans with Math.min(...a), and line 98
does Math.min(...orphan).

Empirically (this box, V8) Math.min(...arr)/Math.max(...arr) throws "Maximum call stack size exceeded" at
~130k elements (verified: ok at 100k, fails at 130k). The accretion last-district-absorb (accretion.js:62)
dumps ALL remaining unassigned cells into the final district, so on the first repair its largest component
is routinely 100k-400k+ cells on TX (607k in-state) / CA. Splitline likewise produces giant disconnected
halves by design (splitline.js header: "Disconnected halves are allowed -> repair"). The first repair round
therefore calls Math.min(...) over a multi-hundred-k array -> hard crash, non-zero exit, no artifacts. Never
fired on CO because CO is a single component with no orphan splits.

Fix: replace every Math.min(...arr) over cell arrays with an explicit loop:
    const minCell = (a) => { let m = Infinity; for (const v of a) if (v < m) m = v; return m; };
and use it at repair.js:78,84,98 (and defensively geo.js:85, see B2).

### B2 — Math.min(...xs)/Math.max(...xs) over ring vertices in geojson dissolve — geo.js:85
dissolveDistrict hole-assignment maps outers[i].lattice.map(v=>v[0]) then takes
Math.min(...xs)/Math.max(...xs)/Math.min(...ys)/Math.max(...ys). A district outer ring is its traced
perimeter; for a large jagged or comb-shaped district on CA/TX (sprawling absorb/repair district, or a
splitline half) the ring can exceed the ~130k spread limit -> throws and kills geojson emission. Runs only
when a district has >=1 hole, which CO did not have at score time, so CO never tripped it.

Fix: compute the ring bbox in one pass and hoist it out of the per-hole loop (currently recomputed for every
hole x every outer — also O(holes*outers*perim)):
    let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    for (const [x,y] of outers[i].lattice){ if(x<xmin)xmin=x; if(x>xmax)xmax=x; if(y<ymin)ymin=y; if(y>ymax)ymax=y; }

### B3 — At-large states crash the 50-state batch — cli.js:75-117, grid.js:53
requireState recognizes the six at-large states (AK, DE, ND, SD, VT, WY) returning {seats:1, atLarge:true},
and buildGrid THROWS for at-large (grid.js:53). But cli.js has NO at-large branch in any stage. node cli.js
all --state WY (or grid/run) calls buildGrid -> throws -> non-zero exit, ZERO artifacts. INTERFACES says
at-large district = state polygon but defines no artifact contract for them and the CLI never produces one.
For the announced 50-state run this is a guaranteed 6-state failure.

Fix: add an at-large code path in cli.js (and a documented artifact shape in INTERFACES) that emits a
single-district meta/assign/stats/geojson from the state polygon, OR explicitly skip the six with a logged
"at-large: no grid" success so the batch driver does not abort. Either way the contract must state what
at-large outputs are — today it is undefined behavior that crashes.

---

## MAJOR findings (scale — fine on CO, wrong/too-slow at 50-state)

### M1 — donorStaysConnected floods the whole grid per candidate, per iteration — repair.js:132-148,150-184
Pass-2 rebalance: each iteration (cap = 500 + 5*orphanCells, can be thousands on TX) builds a candidate list
by scanning all n cells, then for each tried candidate calls donorStaysConnected, which ITERATES ALL n CELLS
(for (let i=0;i<n;i++)) just to collect the donor district cells, then floods. On TX n~607k; worst case is
O(iterations * candidatesTried * n) ~ 10^11+ — effectively a hang. Tolerable on CO (n~70k, few rebalance
moves) only by accident of scale.

Fix: maintain a Set of cells per district incrementally (update on each accepted move) instead of the
full-grid rescan in both the candidate builder and donorStaysConnected; flood only over the donor cell set,
seeded from the anchor. Drops each connectivity check to O(|district|) not O(n).

### M2 — Bridge finding is pairwise O(|minor|*|main|) — grid.js:131-139
Each minor component finds its minimum-Euclidean bridge pair via a full double loop over compCells[ci] x
compCells[mainIdx]. CO has one component (loop never runs), but MI (UP/LP split), HI and other multi-island
states make |main| hundreds of thousands and |minor| tens of thousands -> 10^9+ distance evals.

Fix: only BOUNDARY cells of each component can be a nearest pair on a grid — restrict both loops to edge
cells (>=1 non-in-state or out-of-grid rook neighbor), or use a coarse spatial bucket. Preserve the exact
tie rule (lowest row, then col of the minor-component cell).

### M3 — bestCut cutLen recomputation is O(families * keys * cells) per node — splitline.js:30-66
For every split node, each of 4 families loops over every candidate threshold ki and, inside, re-scans ALL
region cells with a 4-neighbor probe to count cut length (splitline.js:48-57). At the CA root (cells ~160k,
distinct keys/family ~10^3) this is ~4*10^3*1.6*10^5 ~ 6*10^8 ops at the root alone, repeated down the tree
(52 leaves). CO (8 seats, ~70k) survives; CA/TX become minutes-or-worse per arm.

Fix: cutLen only needs the count of in-region rook pairs straddling threshold t for one family. Bucket each
in-region rook edge by the (min,max) of its endpoints family-keys once per family, then sweep thresholds
with a running tally — O(cells + keys) per family instead of O(keys*cells). Keep the exact tie-break order
(err < cutLen < famIdx < t).

### M4 — Splitline can recurse on empty/under-celled regions — splitline.js:80-97
Recursion depth (~log2(52)=6) is safe. But the degenerate fallback index-split (splitline.js:84-87) and any
region with fewer cells than s can yield split([], b) -> a leaf district with 0 CELLS (see E1). Not reachable
on CO; reachable on pathological tiny multi-component remnants at national scale.

Fix: guard split() for cells.length < s (assign one seat per available cell, remainder to repair) and never
call split with an empty array.

---

## MINOR findings

### m1 — geojson properties carry extra fields vs the enumerated contract — score.js:73 vs INTERFACES.md:66
INTERFACES line 66 says properties = "the district stats_<arm> entry verbatim" AND THEN enumerates
(district, pop, deviationPct, cells, ppn, irregular) — six fields. score.js:73 does properties: { ...ds },
which also emits bboxAspect and bboxFill. The contract is internally ambiguous (verbatim vs the 6-field
list), but a verifier reading the enumerated list sees drift. Fix: trim to the six, or amend INTERFACES to
say "full stats entry" — make src and doc agree.

### m2 — Pass-2 candidate builder takes the FIRST under-ideal neighbor, not the best — repair.js:158-167
For an over-ideal boundary cell the loop breaks on the first under-ideal neighbor (repair.js:166), so a cell
bordering two under-ideal districts only ever proposes the move to whichever is enumerated first (N,S,W,E then
bridges). The later candidate sort picks globally-best delta, so this is SUBOPTIMAL not non-deterministic, but
can leave a strictly-better move unconsidered. Note the early break-after-first-connected-candidate (line 179)
is CORRECT: candidates are sorted best-delta-first and the outer loop re-derives each iteration, so skipping a
disconnecting candidate for the next-best connected one does not permanently skip a better move.

### m3 — Rebalance termination rests on the strict-decrease invariant, not the cap — repair.js:150-184
Every applied candidate has delta <= -1 and dPop is updated by exactly that delta, so objective() strictly
drops by >=1 per applied iteration; bounded below by 0 => terminates. The cap and if (objective() >= before)
break (line 183) are dead-but-harmless guards. The header comment calls the cap "a pure guard" while the real
terminator is the invariant — keep delta===0 moves out of the candidate set or the invariant (and
termination) breaks under a future edit.

### m4 — Math.min for the kept component is wasted even after B1 — repair.js:78
mn is only needed to tie-break equal-pop/equal-cell components — computing it for the giant kept component
every round is pure overhead. Compute lazily only when the (p,len) tie is actually contested.

### m5 — loadStatePolygon linear-scans the national shapefile per state — grid.js:12-21
Functionally fine; at 50-state scale it re-parses cb_2020_us_state_500k.shp 50 times. A batch driver should
cache the parsed FeatureCollection. Flagged for the national run.

---

## NIT findings

### n1 — buildBridgeMapLookup is redundant indirection — repair.js:158,188-190
neighborsOf(...).concat(buildBridgeMapLookup(bridgeMap, i)) where the helper just returns
bridgeMap.get(i) || [] — every other site uses that inline. Drop the helper for consistency.

### n2 — sealed_<arm>.log artifact is undocumented in INTERFACES — cli.js:57-58
The engine writes sealed_<arm>.log when accretion seals a district early; not in the frozen contract.
Harmless (verifiers ignore unknown files) but should be listed or suppressed for contract completeness.

### n3 — Determinism posture is otherwise sound (positive note)
All Map/Set iteration that feeds output is explicitly sorted before use: dissolveDistrict edge keys
(geo.js:38), cellBlocks keys (grid.js:165), districtStats district keys (score.js:40), splitline byKey
(splitline.js:38). Float centroid/rho values only feed integer-tie-broken sorts. reduce over Int32Array
returns a JS Number, so CA/TX (~39M/29M) population sums do not truncate (verified). No Date/random/locale
anywhere. FP accumulation order is fixed by index iteration. These are the right invariants — keep them.

---

## Cross-cutting: why CO passed but the contract is not yet 50-state-safe
Colorado is the easy case on every axis here: one connected component (B1/M2 never fire), no holed districts
at score time (B2 never fires), small n (M1/M3 merely slow-tolerable), 8 seats (M4/E1 unreachable), not
at-large (B3 unreachable). The five verifiers confirm CO is INTERNALLY CONSISTENT; they cannot exercise the
spread-overflow, the O(n^2)/O(n*iter) hot paths, the at-large branch, or the empty-region recursion — all
latent until CA/TX/MI/HI/the at-large six.

---

## Edge-case appendix

- E1 — 0-cell districts (splitline degenerate / over-seated remnant): can be produced (M4); districtStats
  silently omits them (per never gets the key) so stats.districts.length !== meta.seats -> G4-coverage
  flagged, no crash — but anchors[d-1] is Infinity, which donorStaysConnected (repair.js:138) would use as a
  flood seed (never matches a real cell => falls to cells[0], tolerable). Still, a zero-cell district is a
  wrong outcome, not just a flagged one.
- E2 — accretion empty frontier / sealed district: handled (accretion.js:100) — seals, logs, continues;
  repair rebalances. Correct.
- E3 — last-district absorb contiguity: intentionally disconnected, repaired in Pass-1 by keeping the
  largest-POPULATION component (FL-004 fix, repair.js:74-82) — correct and the right tie key.
- E4 — bridges in repair vs score consistency: repair/contiguity count bridges as edges (repair.js:40,143;
  score.js:108) while ppn exposure deliberately does NOT remove bridge edges (score.js:37) — matches
  INTERFACES lines 16 and 58. Consistent.

---

VERDICT: FAIL

Justification: The engine is determinism-clean and internally consistent on Colorado, but it is not safe for
the announced 50-state run. Three BLOCKERs each guarantee a hard crash on real states: Math.min(...component)
spreads overflow the V8 call stack at ~130k elements and the accretion absorb / splitline halves routinely
exceed that on TX/CA (B1); the same spread pattern crashes geojson dissolve on any holed big-state district
(B2); and the six at-large states have no CLI path at all, so cli.js all aborts on them (B3). Beyond crashes,
M1-M3 turn repair and splitline into effective hangs at TX/CA scale. None are reachable on CO, which is
exactly why the verifiers passed. Fixes are mechanical and localized (replace spreads with loops, add an
at-large branch, make connectivity checks district-local) — re-review after those land before any national
batch.
