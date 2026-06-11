# Chapter — Algorithm Specification

*A deterministic redistricting baseline: how a congressional map is drawn from public census data alone, by a process anyone can re-run and audit.*

This chapter specifies the algorithm completely. It is written to be checked, not just read: every rule below is implemented in public source code, every number is read from output files anyone can regenerate, and the closing box gives the exact commands to reproduce the results. Each term of art is defined on first use.

---

## 1. Design principles

The algorithm is built on six commitments. They are not aspirations layered on after the fact; each is enforced mechanically by the code and checked by independent verifiers.

**Determinism.** *Determinism* here means the same input always produces the same map, byte for byte, so any third party running the same code on the same public data gets the identical result. There is no random seed, wall-clock timestamp, machine-locale dependence, or hidden state anywhere in the pipeline. This is what makes the map *verifiable by anyone*: a reviewer need not trust our run; they reproduce it and compare a single fingerprint — the SHA-256 hash (a 64-character cryptographic checksum that changes if even one bit changes) of the map's canonical assignment file. Two runs match if and only if their hashes match.

**Equal population.** Each district must hold as close to the same number of people as the geography allows. The target for a state is its resident population divided by its seats (the *ideal target*); a district's *deviation* is the signed percentage by which its population differs from that ideal. The gate is tight: ±1% on the Colorado pilot, ±2% nationally.

**Contiguity.** *Contiguity* means each district is a single connected piece — reachable from any part to any other without leaving it. Connections are by *rook adjacency* (sharing an edge, not merely a corner — the way a rook moves in chess), plus a few explicit water *bridges* for islands (Section 3).

**Compactness / squareness.** A good district is geographically compact rather than sprawling or tentacled. This baseline goes further and prefers *square* districts specifically, because a square is the most compact shape that tiles a grid without gaps. Compactness is scored by a normalized Polsby-Popper measure and bounding-box shape tests (Section 7).

**Total transparency.** The data is public and free, the code is public, and every intermediate artifact (the grid, the per-cell assignment, the per-district statistics) is written to disk in plain, documented formats. Nothing about the process is proprietary or hidden.

**No demographic or partisan inputs whatsoever.** This is the load-bearing fairness guarantee. The algorithm never reads or has access to race, ethnicity, party registration, voting history, incumbent addresses, or any individual's address. The *only* attribute it ever sees attached to geography is a population count — how many people live in a square mile. It cannot draw a line to advantage a group it cannot see. This is not a policy we promise to follow; it is a structural fact about the inputs, and Section 2 documents exactly which fields are read so the claim is auditable.

A stated **priority order** governs every trade-off, in this sequence: **(1) accuracy, (2) workflow efficiency, (3) token/compute efficiency.** Correctness is never sacrificed for speed or convenience.

---

## 2. Data inputs

The algorithm consumes exactly one category of data: **public census geography and population counts.** No licensed, purchased, or proprietary data is used anywhere.

**Source.** The 2020 Census **PL 94-171 redistricting data**, delivered through the Census Bureau's **TIGER/Line** geographic files — specifically the **TABBLOCK20** block shapefiles (one per state, by FIPS code) and the cartographic state-boundary file, all free and public. "PL 94-171" is the federal statute (Public Law 94-171) requiring the Bureau to publish, after each decennial census, the small-area counts states use to redistrict. The census *block* is the smallest unit the Bureau publishes — roughly a city block in urban areas, larger in rural ones.

**Fields used — and only these.** From each block record the algorithm reads:

- **`POP20`** — the block's 2020 resident population count (an integer).
- **`INTPTLON20` / `INTPTLAT20`** — the block's *internal point*, a longitude/latitude the Census Bureau guarantees to lie inside the block. This is the block's location.
- **`GEOID20`** — the block's stable identifier, kept only as an audit trail so any cell can be traced back to the exact blocks it contains.

From the boundary file it reads each state's polygon (via FIPS code) to decide which cells lie in-state. **No race table, ethnicity table, voting-age-population breakdown, or party/election field is ever opened** — though those tables ship in the same PL 94-171 release. The block loader reads four fields per block (GEOID, population, longitude, latitude) and nothing else.

**Dual verification of every state's population.** Population is the one number the whole map balances on, so it is verified two independent ways before a state is allowed to run:

1. **Official-figure check.** Each state's resident population is taken from the Census 2020 Apportionment **Table 2** and stored as a confirmed constant. As a self-check, the 50 state figures sum to **330,759,736**, and adding the District of Columbia (689,545) yields **331,449,281** — exactly the published *total resident population* of the United States. (A separate *apportionment population*, which adds overseas federal personnel — for Colorado, 8,457 extra people — is recorded only to keep the distinction explicit and is **never** a balancing target. Districts balance to resident population, the figure blocks actually sum to.)
2. **Exact block-sum identity.** When a state's grid is built, the algorithm sums `POP20` over every block and **refuses to proceed unless that sum exactly equals the official resident figure** (check "V1"). A one-person discrepancy halts the run, catching a truncated download, duplicated block, or misparsed field before any line is drawn. Colorado, Florida, Maryland, and New York have each passed this exact match.

A state whose population has not been independently confirmed cannot be run — the engine throws rather than guess.

---

## 3. Grid construction

The country is not drawn on a blank map; it is first laid out on a uniform grid of one-square-mile cells. The grid is what makes the process deterministic and demographic-blind: from this point on, the algorithm sees only *cells* and the *population* in each, never blocks, addresses, or people.

**Equal-area projection.** Latitude/longitude is not equal-area — a "square" degree near the southern border covers more ground than one near Canada. So all geometry is done in the **USA Contiguous Albers Equal-Area projection (EPSG:5070)**, in which one square mile is one square mile anywhere in the country. Its canonical definition is stored as a constant and registered at startup; all grid math runs in projected meters, and only the final output is converted back to longitude/latitude for display.

**One-square-mile cells.** The cell size is **`CELL_M = 1609.344` meters** — exactly one international statute mile, so each cell is **1 mi² = 640 acres**. That is small enough to follow real population density and large enough that a full state is tens of thousands of cells, not millions of blocks.

**Deterministic origin snapping.** To guarantee that the same state always lands on the same grid regardless of rounding or input order, the origin (northwest corner) is *snapped to absolute multiples of the cell size* in projected coordinates: the west edge **down** to a multiple of `CELL_M`, the north edge **up**. By convention **row 0 is the northernmost row, column 0 the westernmost column**, and a cell's index is `i = row × cols + col`. Because the origin anchors to absolute projected coordinates rather than the data's bounding box, the grid is translation-invariant — it does not shift if the block list is reordered.

**Block-to-cell assignment via internal points.** Each block is placed into exactly one cell by projecting its **Census internal point** (`INTPTLON20`, `INTPTLAT20`) and taking the cell that point falls in:

```
c = floor( (x − originX)      / CELL_M )      // column
r = floor( (originYTop − y)   / CELL_M )      // row
```

A cell's population is the sum of the blocks whose internal points land in it. The Bureau-supplied internal point is used directly — **no centroid is ever computed** — which keeps placement reproducible and free of any geometric judgment call. A cell is *in-state* if its center falls inside the state polygon **or** at least one block internal point (of any population, including zero) lands in it. Each state writes three artifacts: `meta.json` (dimensions and totals), `grid.json` (dense per-cell in-state flags, populations, and bridges), and `cell_blocks.json` (the cell-to-GEOID audit trail).

**Island handling via deterministic bridges.** Landmasses with no land-adjacent cell — the Florida Keys, Long Island, Michigan's peninsulas, Hawaii — would otherwise be unreachable and break contiguity. The grid builder finds the connected components of in-state cells and, for each minor component, adds one virtual **bridge** (a water connection) to the main landmass: the **minimum-Euclidean-distance pair** of boundary cells between the component and the main body, ties broken deterministically (lowest row, then column, of the minor-component cell). Bridges count as connections for contiguity and repair, but they do **not** erase a district's exposed perimeter when compactness is scored — so a district cannot "look compact" by hopping across open water. For a near-rectangular interior state like Colorado, the bridge list is empty.

---

## 4. The production algorithm: recursive splitline

The map that is eligible in every state tested is produced by **recursive splitline** — the well-studied, top-down compactness baseline. It is the production engine precisely *because* it is conservative, fully understood, and provably deterministic; it embodies none of the center-outward "squares" ambition (Section 6), but it never fails the eligibility gates.

**The idea.** To divide a region owed `s` seats, cut it with one straight line into two parts: one owed `a = floor(s/2)` seats, the other `b = s − a`. Choose the cut so populations split as close as possible to that `a : b` ratio, then recurse into each part. When a part is owed one seat, it becomes a district.

**The four cut families.** A "straight line" on the grid is a threshold on one of four *key functions* of a cell's (row, column) — the four families the algorithm considers, in this fixed priority order:

- **V (vertical):** key = `col` — a north-south line.
- **H (horizontal):** key = `row` — an east-west line.
- **D1 (diagonal ↘):** key = `row + col`.
- **D2 (diagonal ↗):** key = `row − col`.

A cut at threshold `t` in family `f` puts every cell with `key(r,c) ≤ t` on side A and the rest on side B. Restricting cuts to these four families keeps the line genuinely straight and the search finite and reproducible.

**The balance objective.** For a region of total population `popR`, the desired side-A population is `want = (a/s) × popR`. Across all four families and all thresholds, the algorithm picks the cut whose side-A population is closest to `want` — minimizing `|popA − want|`.

**The tie-breaking cascade.** Ties are resolved in a strict, fully specified order — this is what guarantees determinism, since nothing is ever left to chance: (1) smallest population error `|popA − want|`; then (2) **shortest cut** (fewest grid edges severed — the more compact boundary); then (3) **family order** `V < H < D1 < D2`; then (4) **lowest threshold** `t`. Because every comparison bottoms out in integer cell indices, two runs always make the identical choice.

**Pseudocode.**

```
function split(cells, s):
    if s == 1:
        assign all `cells` to the next district number   # depth-first, A-side first
        return
    a = floor(s / 2);  b = s - a
    want = (a / s) * population(cells)
    best = argmin over (family in [V,H,D1,D2], threshold t) of:
              key:   |popA(family,t) - want|
              ties:  shortest cut  >  family order  >  lowest t
    A = { cell in cells : key_family(cell) <= best.t }
    B = cells \ A
    split(A, a)          # side A gets a seats
    split(B, b)          # side B gets b seats

split(all_in_state_cells, seats)
```

Two guard cases keep it total: a region with no valid straight cut (every cell shares one key value) falls back to an index-ordered population split; a region with fewer cells than seats hands out one cell per seat while cells last, letting the coverage gate (Section 7) surface the pathology rather than crashing. Districts are numbered depth-first, A-side first, so the numbering is itself deterministic.

**Why this guarantees determinism.** There is no randomness, no floating-point ordering not ultimately broken by integer indices, and no dependence on block read-order. The `--shuffle` flag *proves* it: it deterministically permutes the block records before binning, and the contract requires byte-identical output to the unshuffled run. Splitline also never has a "leftover" problem (Section 5's remainder), because it balances populations *before* assigning cells — which is exactly why it is eligible everywhere despite producing wedge-shaped rather than square districts.

---

## 5. The repair & balance stage

Both production and research engines can leave two kinds of imperfection that this stage exists to fix: a district split into disconnected pieces (an *orphan*), and districts that drift above or below the population target. Repair runs in three passes over the *district adjacency graph* — the graph whose nodes are districts and whose edges connect districts that touch.

**Pass 1 — orphan reattachment.** A district may end up as several disconnected components (e.g., a top-down cut that severed a peninsula). The rule: **keep the component with the highest *population***, not the most cells or an arbitrary first piece. Every other component is an orphan. A small orphan is moved wholesale into the adjacent district with the lowest population. A *populous* orphan (more than 10% of an ideal district, bordering two or more districts) is not dumped into one neighbor — that is exactly what produced the worst deviations on Maryland's and Florida's coasts. Instead it is **pop-aware split**: divided among all neighboring districts, each absorbing a share proportional to its population *deficit*, grown as a connected region from its own border by a budgeted, deterministic breadth-first search. Pass 1 repeats until no district has more than one component.

**Pass 2 — local rebalance.** Single boundary cells move from over-target to adjacent under-target districts, but only when a move **strictly reduces** the total imbalance `Σ|pop_d − ideal|` by at least one person *and* leaves the donor connected. Because the objective is a bounded integer that strictly decreases on every move, the pass is guaranteed to terminate. A *corridor move* handles a subtle case: across a wall of zero-population cells (open water, empty desert) a normal one-cell move has zero population effect and never qualifies, so the algorithm tunnels a shortest path of empty donor cells plus one populated endpoint and moves the whole corridor atomically.

**Pass 3 — chain-flow rebalance, and why local swaps are insufficient.** This pass encodes the project's single most important structural insight. **Local cell swaps cannot fix an imbalance when the over- and under-populated districts are not adjacent.** Population would have to flow *through* a balanced district in the middle, but every intermediate hop has a near-zero effect on the objective, so the strictly-improving local rule forbids the first step and the imbalance is frozen in place. The fix is to stop thinking in local swaps and **treat rebalancing as flow on the district adjacency graph**: find the worst-surplus and worst-deficit districts, find a *path* between them through intermediaries, and transfer population pairwise along the whole chain at once. Each transfer moves a **connected blob** of cells (grown deterministically from the receiving district's border, sized to the needed amount), not one cell at a time. If a link fails because the donor would fragment, that graph edge is banned and the algorithm **routes around it via an alternate path**. Critically, the pass uses a **round-level revert**: every move in a round is journaled, and if the round did not strictly improve the worst deviation, the entire round is undone — the map is never left worse than the round found it. This combination (graph-flow chains, alternate paths, round-level revert) took one Florida configuration from 3.13% down to 0.107% and is what makes splitline eligible everywhere. It fires only above 0.9% deviation, so an already-balanced state (Colorado) is left byte-for-byte unchanged.

The repair stage was grown one documented root cause at a time. A key finding — project rule "PR-7" — is that five successive repair upgrades each fixed one state and relocated the failure to another. That pattern signaled that the *remaining* defect (Section 6) is **strategy-level, not repair-level**, and patching was deliberately stopped.

---

## 6. The research arm: center-out square accretion

The repair stage can balance any map, but it cannot make a top-down map *square*. The research arm is the project's compactness-maximizing direction, under active development: it builds districts that are square-by-construction and grow outward from the center of the state.

**The idea.** *Accretion* grows each district one neighboring cell at a time. The growth rule *is* the squareness mechanism: at each step, among all cells on the district's frontier, add the one that **keeps the district's bounding box most square** (smallest resulting maximum side length), with Chebyshev distance from the seed and then cell index as tie-breakers. Growth stops when the next cell would carry the district past its population target. Two seeding variants were tested:

- **`accretion-west`** seeds districts in a boustrophedon (back-and-forth) sweep from the west edge.
- **`accretion-centroid`** seeds district 1 at the **state's geometric center** and lets districts radiate outward — squares-first *and* center-outward in one mechanism. This is the design's intended evolution, independently flagged by 4 of 5 reviewers as the truest expression of the goal.

A *seal-and-reseed* rule (documented fix "FL-008") handles a district that runs out of frontier before hitting its target: rather than close a starved district (which created zero-population districts on Maryland's Chesapeake pockets), it keeps its accumulated population and continues from the next available seed.

**Current status — stated honestly.** Of four stress states, the centroid arm passes **three of four**:

| Arm | Colorado (8) | Maryland (8) | Florida (28) | New York (26, flagged) | Eligible everywhere? |
|---|---|---|---|---|---|
| **accretion-centroid** (vision) | ✅ 0.024% (2 irregular) | ✅ 0.082% (6) | ❌ **37.05%** (19) | ✅ⓕ 3.42% (14) | No — fails only FL |
| **accretion-west** | ✅ 0.018% (1) | ❌ 2.04% (4) | ❌ 7.95% (18) | ✅ⓕ 6.28% (17) | No — fails MD + FL |
| **splitline** (production) | ✅ 0.017% (5) | ✅ 0.281% (8) | ✅ 0.855% (25) | ✅ⓕ 4.08% (20) | **Yes** |

(Numbers are read directly from each state's `scores.csv`; "ⓕ" marks New York as a flagged-not-failed hot-cell state, explained in Section 7. The centroid arm produces the fewest irregular districts overall — its squares-first growth is doing exactly what it was designed to do.)

**The remainder problem.** The centroid arm fails **only Florida**, for a precise, well-understood reason (logged as "FL-011"). Because accretion assigns cells as it grows, the *last* district to form must absorb whatever geography is left over. Colorado, Maryland, and New York have no scattered leftover, so the arm passes. In Florida the leftover is the **panhandle, the Keys, and scattered coast simultaneously** — a single ~800,000-person "district" smeared across the whole state that no after-the-fact rebalancing can cleanly redraw. This is a structural property of bottom-up growth, not a flaw in the squareness rule or repair: the multi-pocket remainder exists *before* repair ever runs.

**The hybrid-finish path.** The remedy is surgical and bounded: keep centroid accretion as the engine for districts 1 through *n−k* — the squares-first, center-outward districts — and finish the last *k* "remainder" seats with **splitline's top-down balancing**, which is provably good at exactly the scattered-multi-pocket case accretion is bad at and never has a remainder problem (Section 4). This grafts the production baseline's one strength onto the research arm at precisely its one failure point, leaving the states where it already passes untouched. The expected outcome: a single engine that is squares-first *and* center-outward *and* eligible everywhere. (A previously built space-filling-curve method, Hilbert ordering, was carried as a contingency but eliminated by the data — it dumped orphan piles of thousands of cells on Maryland and New York that overwhelmed repair.)

---

## 7. Quality gates & scoring

Every map a state produces is judged twice: first against **four eligibility gates** that it must pass to be valid at all, then by **compactness metrics** that *rank* the eligible arms. The metrics are re-derived from scratch by an independent verifier (Section 8), so the scores are not self-reported.

**The four eligibility gates.**

1. **Population (G1).** Maximum absolute deviation must be within gate: **±1% for the Colorado pilot, ±2% nationally.** Four high-density states (New York, California, Illinois, New Jersey) are **flagged-not-failed**: a single Manhattan-density square mile can hold more people than an entire district's fair share, so a breach in these states is reported and flagged for the v2 hot-cell refinement rather than disqualifying the map. The flag is honest — it appears in the score table — but does not kill eligibility.
2. **Contiguity (G2).** Every district must be exactly one connected piece under rook adjacency (water bridges counting as connections), checked by an independent flood-fill.
3. **Determinism (G3).** The map must be byte-identical across re-runs, **including the shuffled-input proof**: re-running with `--shuffle` (which permutes block records before binning) must yield the identical SHA-256 fingerprint. Order-independence is demonstrated, not assumed.
4. **Coverage (G4).** Every in-state cell is assigned to exactly one district, and the district count equals the state's seat count — no cell dropped, none double-counted.

**Squareness metrics.** Eligible arms are ranked, in order, by **fewest *irregular* districts → highest mean squareness → fewest repair moves.** Squareness is the **normalized Polsby-Popper score (PPn)**. Classic Polsby-Popper compares a shape's area to a circle of equal perimeter; on a grid, with cell count for area and exposed cell edges for perimeter, that is `4π·cells / exposed²`. A circle scores 1.0 and a square about 0.785, so the score is **normalized by π/4** to put a perfect square at **1.0** — the natural reference for a grid map. (An *exposed edge* is any cell side whose rook neighbor is a different district or out of state; bridges do not remove exposed edges, so over-water hops cannot inflate compactness.)

**What "irregular" means.** A district is **irregular** if it fails any of three shape tests: **PPn < 0.45** (too tentacled), **bounding-box aspect > 2.0** (more than twice as long as wide), or **bounding-box fill < 0.45** (it fills less than 45% of its own bounding rectangle). The stated quality goal is **two to four or fewer irregular districts per state.** Irregular count leads the ranking precisely because it captures the squares-first intent: across the stress states the centroid research arm produces fewer irregular districts than the splitline production arm (42 vs. 58) — the quantitative case for finishing the hybrid.

---

## 8. Computational profile

**Speed.** The approach is engineered to run a full state — and at scale, the full country — **in minutes on a commodity laptop.** The grid reduces a state from millions of blocks to tens of thousands of cells, and every stage is built for that scale: the splitline cut search is a single linear pass per family (not a quadratic rescan); the island-bridge search is restricted to boundary cells to avoid a pairwise blowup on multi-island states; and repair maintains per-district cell sets incrementally, so a connectivity check costs work proportional to one district, never the whole grid. Deliberate choices (avoiding `Math.min(...spread)` over large cell arrays, which would hit the JavaScript engine's argument-count limit on a state the size of Texas) keep the largest states within reach of ordinary hardware.

**No proprietary dependencies.** The pipeline is plain JavaScript on Node.js, its only substantive external pieces a coordinate-projection library and a shapefile reader — both free and open source. There is **no commercial GIS suite, licensed dataset, paid API, or cloud service** required. The independent verifier scripts deliberately import *nothing* from the production code, so they are a true second opinion: they read only the documented output files and the raw census data and re-derive every figure.

**Public data, public code.** Both halves of the reproducibility claim hold: the input is the free Census TIGER/Line release, and the code that turns it into a map is public. Any reviewer — congressional staffer, election-law expert, journalist, opposing party — can download the same data, run the same commands, and obtain the identical map down to the SHA-256 hash. That is the point of a deterministic baseline: it does not ask to be trusted, it asks to be checked.

---

> ### Reproducing these results
>
> All commands run from the project root, on Node.js (no proprietary tools, no network access beyond the one-time public TIGER/Line download). `<ST>` is a state postal code, e.g. `CO`.
>
> ```bash
> # 1. Build the 1-mi² grid (downloads public TIGER/Line block + boundary data on first run,
> #    then verifies Σ POP20 === the official resident population before proceeding)
> node cli.js grid  --state CO
>
> # 2. Run an arm: traverse + repair + per-district stats + canonical CSV + GeoJSON
> node cli.js run   --state CO --arm splitline
> node cli.js run   --state CO --arm accretion-centroid
> node cli.js run   --state CO --arm accretion-west
>
> # 3. Prove determinism: shuffled input must reproduce the identical map, byte for byte
> node cli.js run   --state CO --arm splitline --shuffle --outdir out/CO-shuffled
> node scripts/verify/check-determinism.js out/CO/assign_splitline.csv out/CO-shuffled/assign_splitline.csv
>
> # 4. Score all arms into the A/B decision table (out/CO/scores.csv)
> node cli.js score --state CO
>
> # 5. Or do everything at once (grid + all arms + score + render maps)
> node cli.js all   --state CO
>
> # 6. Independent verification (these scripts import NOTHING from src/ — a true second opinion)
> node scripts/verify/check-population.js  CO     # exact population conservation + ≤ gate
> node scripts/verify/check-coverage.js    CO     # every in-state cell assigned exactly once
> node scripts/verify/check-contiguity.js  CO     # one connected component per district
> node scripts/verify/score-compactness.js CO     # re-derives every PPn / shape metric
> ```
>
> The fingerprint of any map is the SHA-256 of its `out/<ST>/assign_<arm>.csv`. Two runs are identical
> if and only if those hashes match. Live, reproducible numbers per state are in `out/<ST>/scores.csv`;
> rendered maps are in `out/<ST>/map_<arm>.html`.

---

Reviewed by: __________  Date: __________
