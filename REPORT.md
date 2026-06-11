# Deterministic Grid Redistricting: A Transparent, Reproducible Baseline for Congressional Maps

## Report to Lawmakers — Executive Summary

This report documents a deterministic, demographics-blind redistricting algorithm and proposes that
its output be published each cycle as a neutral benchmark, against which states disclose and justify
deviations in their enacted congressional plans. The algorithm was run on all fifty states; the
results, the method's limitations, and the legal posture follow.

**The problem.** In most states, congressional district lines are drawn by officials with a direct
stake in where those lines fall. The Supreme Court has held that federal courts cannot police
partisan gerrymandering (*Rucho v. Common Cause*, 2019), and recent decisions have narrowed the
remaining federal checks. Reform proposals routinely stall on a single question: who can be trusted
to draw the lines? This report examines an alternative framing — a benchmark that requires no trust,
because it removes discretion from the *reference point* rather than from the states.

**The approach.** The algorithm receives one input: how many people live in each square mile,
from official Census block data. It receives no race, no party registration, no election results,
and no addresses. It is deterministic — the same input produces the same map, byte for byte, on any
computer, run by anyone — and fully open source, so no person or institution controls it and any
claim about it can be independently re-derived.

**What was built and verified.** This is a working system, not a concept paper:

- All 50 states were districted; all 435 districts drawn, with zero failed runs.
- The 330,759,736 residents of the 50 states were assigned to districts in an exact match to the
  official Census total, verified two independent ways: against the Census Bureau's published
  apportionment tables, and against the block-by-block sum of each state's own census data — a
  build-time gate that all fifty states passed.
- The typical state's worst district deviates from a perfectly equal share by well under one
  percent. One state (New York) exceeds the report's two-percent reporting gate, at 4.08%, and is
  disclosed as flagged; the dense-city refinement that addresses this is specified in Chapter 6.
- Re-running the engine — including with deliberately shuffled input — produces byte-identical
  maps, verified by cryptographic hash on a four-state sample spanning the largest (TX, CA) and
  island/peninsula geographies (HI, MI).
- The development process used independent verification code written against a published data
  contract, internal blind multi-reviewer evaluation of the candidate methods, and a published
  defect log (eleven issues, each with root cause and fix). **No external expert review has yet
  been conducted; obtaining one — from GAO or the Census Bureau — is this report's explicit ask.**

**What this output is, and is not.** The one-square-mile output is a *benchmark*, not an enactable
map: enacted congressional plans are held to near-zero population deviation (*Karcher v. Daggett*),
which requires a block-level refinement step that is specified but not part of this build (Chapter
5, §3.3). Congress is not asked to enact any algorithm-drawn district. It is asked to adopt a
*disclosure standard*.

**What the draft bill requires (Appendix A, ~two pages).** Four mechanics:

1. A designated custodian computes and publishes the baseline map for each state from the open
   specification after each census.
2. Each enacted congressional plan is published alongside its state's baseline with a standardized
   metrics comparison.
3. Material deviations are publicly justified in writing.
4. An explicit Voting Rights Act savings clause; the baseline binds no one and preempts nothing.

**The historical demonstration.** Chapter 4 applies the same engine to all eight apportionment
cycles since 1950, using each decade's actual seat counts and county-level census populations
(coverage detailed in Chapter 4's table; the maps are labeled approximations, since block-level
data predates digital records). The demonstration's point is narrow but important: the process is
indifferent to era and to whoever held power — nothing in the loop can respond to politics.

**The legal posture, honestly stated (Chapter 5).** A demographics-blind algorithm cannot by itself
guarantee the majority-minority districts the Voting Rights Act requires in some circumstances.
The baseline posture is designed for exactly that reality: states keep drawing their maps under
existing law, §2-driven choices are documented as justified departures, and the benchmark adds no
new conflict. Chapter 5 also addresses the predictable objection that a blind process can still
carry partisan consequences through geography — and why a published, measurable baseline makes that
question *more* answerable, not less (Appendix B).

**The ask.** A hearing; a technical review by GAO or the Census Bureau; and consideration of the
baseline-disclosure standard for the post-2030 cycle. Every claim in this report can be re-derived
from the public repository by any congressional staffer with a laptop.

---

*Chapter 2: full algorithm specification. Chapter 3: 2020 results. Chapter 4: the 1950–2020
demonstration. Chapter 5: legal context and limitations. Chapter 6: implementation pathways.
Appendix A: the draft bill. Appendix B: objections and responses. Appendix C: one-page brief.*


---

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
2. **Exact block-sum identity.** When a state's grid is built, the algorithm sums `POP20` over every block and **refuses to proceed unless that sum exactly equals the official resident figure** (check "V1"). A one-person discrepancy halts the run, catching a truncated download, duplicated block, or misparsed field before any line is drawn. All fifty states passed this exact identity at grid build — a state that fails cannot produce a map at all. (One development note for the record: an early version of the post-hoc audit script also re-checked leftover research-arm artifacts and recorded misleading failure entries for three states; the audit is now scoped to the production arm, the ledger was regenerated, and the episode is logged as FL-012 in the public failure log. The build-time identity itself was never violated.)

A state whose population has not been independently confirmed cannot be run — the engine throws rather than guess.

---

## 3. Grid construction

Before any line is drawn, each state is laid out on a uniform grid of one-square-mile cells. The grid is what makes the process deterministic and demographic-blind: from here on, the algorithm sees only *cells* and the *population* in each — never blocks, addresses, or people.

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

Both engines can leave two imperfections this stage fixes: a district split into disconnected pieces (an *orphan*), and districts that drift above or below the population target. Repair runs in three passes over the *district adjacency graph* — nodes are districts, edges connect districts that touch.

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

**What "irregular" means.** A district is **irregular** if it fails any of three shape tests: **PPn < 0.45** (too tentacled), **bounding-box aspect > 2.0** (more than twice as long as wide), or **bounding-box fill < 0.45** (it fills less than 45% of its own bounding rectangle). The stated quality goal is **two to four or fewer irregular districts per state.** Irregular count leads the ranking precisely because it captures the squares-first intent: across the stress states the centroid research arm produces fewer irregular districts than the splitline production arm (41 vs. 58) — the quantitative case for finishing the hybrid.

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


---

# Chapter 3 — Results: The 2020 Production Run

The production engine (the shortest-split method, Chapter 2) was run on all fifty states using 2020
Census PL 94-171 block data. Every figure below is generated directly from the engine's output files
at the time this report was built — the report cannot disagree with the artifacts.

## National summary

| Measure | Result |
| --- | --- |
| States completed | 50 / 50 (zero failures, zero timeouts) |
| Districts drawn | 435 / 435 |
| States fully clean | 49 / 50 |
| Population assigned | 330,759,736 — **exact** match to the official Census 50-state resident total |
| Determinism | byte-identical re-runs, including with shuffled input order (SHA-256 verified on TX, CA, HI, MI) |

One state — New York — exceeds the 2% reporting gate (4.08%) and is disclosed as *flagged, not
failed*: a single square mile of Manhattan can hold more than 100,000 people, so at one-square-mile
granularity its worst district cannot be cut finer. The flagged-not-failed *policy* covers the four
hot-cell states (NY, CA, IL, NJ); in practice CA (0.81%), IL (0.57%), and NJ (0.18%) came in under
the gate and needed no flag. The block-level index the engine already stores supports a half-mile
refinement that shrinks the NY figure toward zero (Chapter 6, future work). Separately, the
operations ledger marks seven structurally hard geographies (HI, AK, MI, FL, MD, LA, WV) for routine
human spot-review regardless of their passing scores — a review queue, not a quality failure.

## State-by-state

| State | Seats | Status | Max deviation | Irregular districts |
| --- | --- | --- | --- | --- |
| AK | 1 | at-large | — | — |
| AL | 7 | clean | 0.00% | 5 |
| AR | 4 | clean | 0.00% | 4 |
| AZ | 9 | clean | 0.17% | 8 |
| CA | 52 | clean | 0.81% | 43 |
| CO | 8 | clean | 0.02% | 5 |
| CT | 5 | clean | 0.01% | 3 |
| DE | 1 | at-large | — | — |
| FL | 28 | clean | 0.85% | 25 |
| GA | 14 | clean | 0.11% | 12 |
| HI | 2 | clean | 0.02% | 2 |
| IA | 4 | clean | 0.00% | 3 |
| ID | 2 | clean | 0.00% | 2 |
| IL | 17 | clean | 0.57% | 14 |
| IN | 9 | clean | 0.00% | 7 |
| KS | 4 | clean | 0.00% | 3 |
| KY | 6 | clean | 0.01% | 5 |
| LA | 6 | clean | 0.32% | 6 |
| MA | 9 | clean | 0.02% | 8 |
| MD | 8 | clean | 0.28% | 8 |
| ME | 2 | clean | 0.00% | 2 |
| MI | 13 | clean | 0.69% | 12 |
| MN | 8 | clean | 0.12% | 5 |
| MO | 8 | clean | 0.02% | 6 |
| MS | 4 | clean | 0.00% | 3 |
| MT | 2 | clean | 0.00% | 1 |
| NC | 14 | clean | 0.76% | 10 |
| ND | 1 | at-large | — | — |
| NE | 3 | clean | 0.00% | 2 |
| NH | 2 | clean | 0.00% | 2 |
| NJ | 12 | clean | 0.18% | 11 |
| NM | 3 | clean | 0.06% | 2 |
| NV | 4 | clean | 0.01% | 4 |
| NY | 26 | G1-flagged-not-failed | 4.08% | 20 |
| OH | 15 | clean | 0.10% | 13 |
| OK | 5 | clean | 0.00% | 3 |
| OR | 6 | clean | 0.00% | 4 |
| PA | 17 | clean | 0.71% | 12 |
| RI | 2 | clean | 0.00% | 1 |
| SC | 7 | clean | 0.00% | 7 |
| SD | 1 | at-large | — | — |
| TN | 9 | clean | 0.23% | 8 |
| TX | 38 | clean | 0.78% | 32 |
| UT | 4 | clean | 0.08% | 2 |
| VA | 11 | clean | 0.07% | 9 |
| VT | 1 | at-large | — | — |
| WA | 10 | clean | 0.02% | 7 |
| WI | 8 | clean | 0.08% | 6 |
| WV | 2 | clean | 0.00% | 2 |
| WY | 1 | at-large | — | — |

"Irregular" applies the squareness rule defined in Chapter 2 (normalized Polsby-Popper < 0.45, or
bounding-box aspect > 2, or bounding-box fill < 0.45). Coastline and border geography make some
irregularity unavoidable; the count is reported so that enacted maps can be compared like-for-like.

---

# Chapter 4 — The Historical Demonstration: 1950–2020

**Methodology, stated plainly.** Block-level census geography does not exist in digital form before
2000. To demonstrate the process across history, the engine applies each decade's *actual*
apportionment (verified from the Census Bureau's Table C1) and each decade's *actual county-level
census populations* (verified against published state totals, with exact matches on the anchor
states), scaling the 2020 settlement pattern within each county to the decade's county total. Where
a county's FIPS code does not match across vintages (a handful of renames and consolidations), the
state-level ratio is used and the affected share is reported as reduced "coverage." These maps are
therefore **approximations that hold 2020 within-county geography fixed** — they demonstrate that
the *process* is indifferent to era and politics, not that these exact lines would have existed.

## Coverage of the demonstration

| Decade | Seats apportioned | State runs completed | Multi-district maps | Avg. county-data coverage |
| --- | --- | --- | --- | --- |
| 1950 | 435 | 48 | 44 | 99.4% |
| 1960 | 435 | 50 | 45 | 99.5% |
| 1970 | 435 | 50 | 44 | 99.6% |
| 1980 | 435 | 50 | 44 | 99.7% |
| 1990 | 435 | 50 | 43 | 99.7% |
| 2000 | 435 | 50 | 43 | 100.0% |
| 2010 | 435 | 50 | 43 | 100.0% |

Alaska and Hawaii appear from 1960 (statehood). States with a single at-large seat in a given decade
are recorded as such (the whole state is the district). Every multi-district map in every decade was
produced by the same engine, same rules, same tie-breaks as the 2020 production run.

## What the demonstration shows

1. **Indifference to era.** The same code drew Ohio in 1950 (23 seats) and 2020 (15 seats). No
   parameter was tuned per decade; only the inputs (seats, populations) changed.
2. **Stability of character.** A state's districts evolve smoothly as population shifts — compare
   any state's decade slider on the accompanying website — rather than lurching with political
   control, because there is no political control anywhere in the loop.
3. **The counterfactual.** Every gerrymander drawn since 1950 had a neutral alternative available in
   principle. This chapter makes that alternative concrete and visible for all eight cycles.

The full per-decade, per-state maps and statistics are in the interactive website (`site/`) and the
repository's `out/<state>/history/` directories.

---

# Chapter — Legal Context & Limitations

*Where a deterministic, demographics-blind redistricting baseline sits within the constitutional and statutory law of congressional districting — and, more importantly, where it does not reach.*

> **This chapter is policy analysis, not legal advice.** It is written by the report's authors for a general and congressional audience, not by counsel for any party, and it creates no attorney-client relationship and offers no opinion that anyone should rely on to draw, defend, or challenge an actual map. Every case and statute cited below was verified against a primary or authoritative secondary source before assertion; the closing box lists each citation with its verification status. Election law is unusually live — one of the most consequential cases discussed here was decided in **April 2026**, weeks before this writing — so any reader acting on these questions must confirm the current state of the law with qualified counsel.

The thesis of this report is narrow and we keep it narrow here: the algorithm described in the preceding chapters is offered as a **transparency baseline** — a neutral, reproducible benchmark against which enacted maps can be measured — **not** as a set of binding districts. Almost every legal difficulty with computer-drawn districting dissolves at the baseline framing and reappears the moment one proposes to *enact* the algorithm's output directly. This chapter is honest about which is which. A report that oversells its legal footing gets dismissed by the first election-law staffer who reads it; we would rather state the limitations plainly and let the baseline idea stand on what it can actually support.

---

## 1. The constitutional framework

### 1.1 Equal population: Article I and *Wesberry*

Congressional apportionment within a state begins with a single, hard rule: districts must be equal in population. The textual hook is **Article I, § 2** of the Constitution, which provides that Representatives be apportioned among the states and "chosen . . . by the People." In **Wesberry v. Sanders, 376 U.S. 1 (1964)**, the Supreme Court read that language to require that, "as nearly as is practicable, one man's vote in a congressional election is to be worth as much as another's" (id. at 7–8). Georgia's Fifth District then held two to three times the population of other districts; the Court held that disparity unconstitutional and made equal population the controlling command for House maps.

The baseline algorithm is built directly on this rule. Its first and highest gate is equal population: each district must hold the state's resident population divided by its seats, within a deviation tolerance. As reported in the preceding chapters, typical worst-district deviations are small — on the order of **0.02% to 0.85%** for the well-behaved states, rising in dense-city states where a single Manhattan-density square-mile cell can hold a meaningful fraction of a whole district (New York's worst arm runs to roughly **3–4%** and is flagged rather than silently passed). That last point matters for the rest of this chapter, because the congressional equal-population standard is not "small deviations are fine."

### 1.2 *Karcher*: deviations need justification — and what "grid granularity" can and cannot supply

**Karcher v. Daggett, 462 U.S. 725 (1983)**, set the demanding standard for congressional plans. New Jersey's map had a maximum deviation of **0.6984%** — under one percent — and the Court still struck it down. The rule from *Karcher* has two parts: (1) there is no de minimis threshold below which a congressional deviation is automatically acceptable; any deviation must be shown to be unavoidable, and (2) if a deviation could have been reduced by a "good-faith effort to achieve population equality," the state bears the burden of justifying it by reference to a legitimate, consistently applied objective (id. at 730–731, 740–741).

This is the most important doctrinal constraint on the baseline as a source of *enactable* congressional maps, and we will not paper over it. A one-square-mile grid is, by construction, a quantized representation of geography. The smallest unit the algorithm can move between districts is a whole 1-mi² cell, which in a dense area can carry tens of thousands of people. That quantization is the direct mechanical source of the deviations reported above — and it is exactly the kind of deviation *Karcher* says a state must either eliminate or justify.

What does "grid granularity" justify? It honestly justifies the *baseline* role, and only weakly justifies enactment:

- **As a benchmark, granularity is a feature, not a defect.** A baseline does not need to satisfy *Karcher*; it needs to be neutral, reproducible, and explicable. "We could not split a square mile" is a complete and true account of the baseline's deviations.
- **As a source of enactable maps, granularity is a defect that *Karcher* would likely not excuse on its own.** "Our software used a coarse grid" is an administrative convenience, not the kind of unavoidable, legitimate state interest *Karcher* contemplates — a state that could reduce the deviation by going to a finer unit and chose not to would struggle to carry its burden. The honest path to an enactable map is therefore **block-level refinement** (Section 3.3): take the grid map as the compactness-and-contiguity skeleton, then re-balance to near-zero deviation at the census-block level, which is the unit enacted maps actually use. The baseline's coarseness is a transparency choice, not a legal claim that coarse maps are permissible.

### 1.3 The Elections Clause: where Congress's power comes from

A report proposing a federal transparency standard must be clear about the source of Congress's authority to set one. That source is the **Elections Clause, Article I, § 4, cl. 1**: the "Times, Places and Manner of holding Elections for Senators and Representatives, shall be prescribed in each State by the Legislature thereof; but the Congress may at any time by Law make or alter such Regulations." The settled reading is that this is a *default* allocation — states run the mechanics of congressional elections unless and until Congress legislates, and Congress may then "make or alter" those rules and bind the states. Congress first used this power in 1842 to require single-member districts and has legislated districting requirements since.

Two consequences follow for this report. First, a federal statute that required states to publish a neutral baseline map and to explain deviations from it would sit comfortably within long-recognized Elections Clause authority — it regulates the "Manner" of congressional elections and does not purport to draw the lines itself. Second, the baseline framing avoids the Elections Clause's *outer* edge: a statute *commanding* a particular set of districts drawn by a federal algorithm would raise harder questions about displacing the state legislature's role, whereas a transparency-and-justification requirement leaves the drawing power where the Clause places it.

### 1.4 *Rucho*: why a legislative or algorithmic standard is the only realistic lever

The case for a neutral baseline does not rest on aesthetics; it rests on the fact that the federal courts have closed their own door to the problem the baseline addresses. In **Rucho v. Common Cause, 588 U.S. 684 (2019)**, the Court held 5–4 that *partisan* gerrymandering claims present **nonjusticiable political questions** beyond the reach of the federal courts — even while acknowledging that extreme partisan gerrymanders are "incompatible with democratic principles." Chief Justice Roberts's majority reasoned that there is no judicially manageable standard for "how much" partisanship is too much, and pointed instead to the political branches: state constitutions, state courts, independent commissions, and **congressional legislation under the Elections Clause** as the appropriate venues.

*Rucho* is, in effect, an invitation that this report accepts. If federal courts will not police partisan line-drawing, the remedy must come from a standard the political process can adopt and the public can verify. A deterministic, demographics-blind baseline is exactly such a standard: it gives a non-judicial, non-discretionary reference point that a legislature can require and a citizen can reproduce. The baseline does not ask a court to decide how much gerrymandering is too much; it shows what a map drawn *without any partisan input at all* looks like, and asks enacted maps to be measured against it.

---

## 2. The Voting Rights Act problem — treated head-on

This is the hard one, and it has become harder — and, in a specific sense this section explains, also more central to the report's argument — since early 2026. We treat it without flinching.

### 2.1 The doctrine through 2023: §2, *Gingles*, and *Milligan*

**Section 2 of the Voting Rights Act** (52 U.S.C. § 10301) prohibits any voting practice that "results in a denial or abridgement" of the right to vote on account of race or membership in a language-minority group. As applied to districting, the controlling test comes from **Thornburg v. Gingles, 478 U.S. 30 (1986)**, which requires a plaintiff to establish three preconditions: (1) the minority group is "sufficiently large and geographically compact to constitute a majority in a single-member district"; (2) the group is "politically cohesive"; and (3) the white majority "votes sufficiently as a bloc" usually to defeat the minority's preferred candidate (id. at 50–51). Where those are met and the totality of circumstances supports liability, §2 has required states to draw **majority-minority districts** — districts in which the protected group is a voting majority. As recently as **Allen v. Milligan, 599 U.S. 1 (2023)**, the Court reaffirmed §2 and the *Gingles* framework, holding 5–4 that Alabama's congressional map likely violated §2 by packing and cracking Black voters into a single opportunity district, and that §2 "is an appropriate method of promoting the purposes of the Fifteenth Amendment."

The structural tension is unavoidable and we state it plainly: **a race-blind algorithm cannot guarantee a majority-minority district.** The baseline never reads race; it cannot draw a line to create, preserve, or measure a majority-minority seat, because it cannot see one. If §2 in a given state requires such a district and the neutral baseline does not happen to produce one, the baseline map — drawn as binding districts — would be unlawful in that state. This is not a flaw to hide; it is the precise boundary of what a demographics-blind tool can claim.

### 2.2 The 2026 development: *Louisiana v. Callais*

On **April 29, 2026**, the Court decided **Louisiana v. Callais, 608 U.S. ___ (2026)** (No. 24-109), 6–3, in an opinion by Justice Alito. The Court held that Louisiana's congressional map was an **unconstitutional racial gerrymander** because race predominated in drawing a second majority-Black district, and — critically — that **compliance with §2 could not, on these facts, supply the compelling state interest** that strict scrutiny requires for race-predominant districting. The majority reasoned that §2, "properly construed," did not *require* the second majority-minority district, so the State had no compelling justification for using race to draw it.

Three things must be said precisely, because the case has been described in the press both as having "eviscerated" §2 and as a "narrow" ruling, and the truth is in between:

- **The Court did not facially strike down §2, and did not formally overrule *Gingles* or *Milligan*.** Those precedents remain on the books.
- **But the Court substantially narrowed the circumstances in which §2 compels a majority-minority district** and tightened the evidentiary burden on §2 plaintiffs, holding that mere asserted §2 compliance is not, by itself, a compelling interest sufficient to justify race-predominant line-drawing. The practical effect — reflected in the rush of post-decision state map revisions — is that the §2 obligation to create majority-minority districts is materially weaker after *Callais* than it was after *Milligan*.
- **The dissent (Justice Kagan, joined by Justices Sotomayor and Jackson) characterized the decision as dismantling §2's core protection.** That this is contested at the Court itself is part of the honest picture: the doctrine is unsettled and may continue to move.

### 2.3 Why this *strengthens*, rather than undercuts, the baseline argument

It would be easy — and wrong — to treat *Callais* as making the VRA problem disappear. The honest reading is more interesting. After *Rucho* (partisan gerrymandering nonjusticiable) **and** *Callais* (the §2 majority-minority mandate sharply narrowed and race-predominant remediation now facing strict scrutiny), the two largest federal judicial constraints on partisan line-drawing have both receded. The discretion that used to be checked by litigation is increasingly unchecked. That is exactly the condition under which a *neutral, demographics-blind, publicly reproducible baseline* matters **more**, not less: it offers a standard the political process can adopt precisely because the courts have stepped back from supplying one.

It also relieves — without eliminating — the deepest tension in this section. Before *Callais*, a race-blind baseline sat in unavoidable conflict with a robust §2 mandate. After *Callais*, race-predominant districting is itself under heightened constitutional suspicion, and a tool that demonstrably *never uses race* is, if anything, easier to square with the Equal Protection Clause's racial-gerrymander doctrine (Section 2.5). The baseline does not resolve the policy question of whether minority representation should be protected — that is a value judgment above this report's pay grade — but its legal posture is more comfortable now than it was three years ago.

### 2.4 Options analysis

Given the doctrine, there are three coherent ways to relate a race-blind algorithm to the VRA. We assess each honestly.

**(a) Baseline / benchmark use — recommended.** Use the neutral map as a benchmark, not as binding districts. The enacting authority draws the actual map (and may draw majority-minority districts where §2 still requires them), then publishes the deviations between the enacted map and the neutral baseline, with a written justification for each material departure. Under this posture the baseline does not itself create a new VRA conflict: it is a published reference, not an enacted map, and any §2-driven departure is drawn by the state and documented as such. We do not claim this *resolves* §2 compliance — that remains the enacting authority’s burden on the enacted map — only that the benchmark adds no new conflict. The "beat the baseline or explain why" standard (Section 4) absorbs VRA compliance as one legitimate, stated reason for an explained departure. This posture is designed to be compatible with §2 under either the pre- or post-*Callais* understanding — a design goal, not a litigated guarantee — and it is the implementation posture we recommend.

**(b) A VRA-compliance post-process layer — future work, with real two-sided legal risk.** One could bolt a remedial layer onto the neutral output: after the race-blind map is drawn, adjust specific districts to create majority-minority seats where §2 requires them. This is technically conceivable but legally fraught, and the risk now cuts *both* ways. On one side, doing too little risks §2 liability where it still applies. On the other side — and this is the sharper edge after *Callais* — a layer that makes race the *predominant* factor in redrawing a district invites a racial-gerrymander challenge under the Equal Protection Clause (Section 2.5), and *Callais* holds that §2 compliance will not automatically be a compelling interest justifying it. A post-process layer would therefore have to thread a narrower needle than existed in 2023. We flag this as genuine future work, not a solved problem, and we do not claim it is presently safe to deploy.

**(c) Statutory change — not recommended.** Congress could amend §2 to define VRA obligations in race-neutral or formulaic terms compatible with a blind algorithm. We do not recommend this and do not analyze it at length: it would be a major substantive change to civil-rights law made for the convenience of a tool, which inverts the proper relationship between the two. The baseline should adapt to the law, not the reverse.

**Recommendation: (a).** The baseline ships as a transparency benchmark. Where §2 still requires a majority-minority district, the enacting authority draws it and records the departure from the neutral baseline as a justified, VRA-driven deviation. This keeps the tool useful in every state and lawful under any plausible reading of the current doctrine.

### 2.5 The other side of the tension: *Shaw v. Reno*

The VRA pressure does not run in only one direction, and a credible chapter must say so. **Shaw v. Reno, 509 U.S. 630 (1993)**, holds that when race is the **predominant factor** in drawing a district — producing district lines explicable only as racial sorting, of the "bizarre" shape the Court found in North Carolina's District 12 — the map is subject to **strict scrutiny** under the Equal Protection Clause and is presumptively unconstitutional. This is the doctrine that any option-(b) post-process layer would run straight into, and the doctrine *Callais* invoked. The tension is real and structural: §2 can push a state *toward* race-conscious districts, while *Shaw* (now reinforced by *Callais*) punishes maps in which race-consciousness predominates. A demographics-blind baseline sits, by construction, on the safe side of *Shaw* — it cannot make race predominate because it cannot see race — which is one more reason the benchmark posture (a) is the cleanest fit with current law.

---

## 3. Other limitations, stated honestly

The baseline is deliberately minimal. It optimizes equal population, contiguity, and compactness, and nothing else. Everything a human map-drawer legitimately considers beyond those is, by design, *absent* — and we would rather enumerate the absences than let a reader assume completeness.

### 3.1 Communities of interest are ignored

Most state redistricting laws, and good districting practice, ask map-drawers to preserve **communities of interest** — neighborhoods, shared economic or cultural ties, common media markets, and the like. The baseline cannot see any of this. It knows only how many people live in each square mile. A district it draws may cleanly bisect a recognized community that a human would keep whole. This is a real limitation for *enactment* and a non-issue for the *benchmark* role: a community-of-interest departure from the baseline is exactly the kind of legitimate, explained deviation the "beat-the-baseline-or-explain" standard is built to accept.

### 3.2 County and municipal splits are not minimized

Many states require map-drawers to minimize splits of counties and municipalities. The baseline makes no attempt to do so. Because it assigns whole square-mile cells to districts with no regard for jurisdictional boundaries, a district edge will fall wherever the population-balancing and compactness rules put it, frequently mid-county and mid-city. Conceptually, the magnitude is bounded by geometry: each district boundary that crosses a county can split it, so a state with *D* districts and a long internal boundary network will show split counts on the order of the number of boundary-segment/county intersections — typically *more* splits than a split-minimizing human plan, not fewer. We do not report an exact split count here because it is not a metric the algorithm optimizes or even computes; that omission is itself a limitation worth naming. A production benchmark should add a split-count diagnostic so departures can be measured, even though the baseline does not minimize them.

### 3.3 Grid granularity vs. the exact-equality doctrine (revisited)

Section 1.2 established the core point; here is its practical resolution. For *enacted* congressional maps, *Karcher* tolerates essentially zero avoidable deviation, and a 1-mi² grid cannot meet that bar in dense geography. Two honest responses follow, and the report embraces both: (1) **the baseline role**, where coarse-but-neutral is exactly what is wanted and *Karcher* does not apply because nothing is being enacted; and (2) **block-level refinement as the path to enactable maps**, where the grid map is treated as a compactness/contiguity scaffold and a downstream step re-balances populations at the census-block level (the unit enacted maps use) until the deviation approaches the near-zero standard *Karcher* requires. We do not claim the current grid output is enactable as congressional districts; we claim it is a sound, neutral *starting geometry* and a sound *benchmark*.

### 3.4 Water, contiguity conventions, and the bridge approximation

Contiguity is a legal requirement in most states, and the baseline enforces it — but via conventions a court might examine. Islands and detached landmasses are connected to the mainland by deterministic water **bridges** (the shortest open-water connection, ties broken by a fixed rule), so the Florida Keys or Long Island count as contiguous with their state. This matches how real maps treat water contiguity, but it is a *convention*: a state whose law defines contiguity more strictly (e.g., requiring land or a physical crossing) might not accept the bridge approximation, and the baseline's water-crossing connections are an assumption a reviewer should check against the relevant state standard rather than take as given.

### 3.5 State constitutional requirements vary — and often go beyond federal law

Federal law (equal population, the VRA, Equal Protection) is a floor, not a ceiling. State constitutions and statutes frequently impose *additional* requirements: mandatory compactness formulas, explicit bans on favoring incumbents or parties, county-integrity priorities, nesting of legislative districts, and others. These vary state to state and the baseline encodes none of them beyond the three it optimizes. A baseline tuned to satisfy one state's constitution would not automatically satisfy another's. The report's "same process on every state" commitment is a strength for *comparability* and a limitation for *state-specific enactment*; the benchmark posture again absorbs this, because each state's extra requirements become documented, legitimate reasons that an enacted map departs from the uniform neutral baseline.

---

## 4. Why determinism plus open source changes the politics

The legal and political force of this proposal comes not from any single doctrine but from two structural properties the algorithm has and a discretionary process lacks.

**No discretion to capture.** Gerrymandering is, at bottom, the exploitation of *discretion*: someone with the power to choose where lines go chooses them to a partisan or self-interested end. A deterministic algorithm with no demographic or partisan inputs has **no discretion to capture**. There is no knob a party can turn, no input a mapmaker can shade, no judgment call to lobby. The same public data produces the same map, byte for byte, no matter who runs it. You cannot gerrymander a process that has no decision points exposed to influence.

**Anyone can verify.** Because the data is public and free, the code is public, and the output is reproducible to a single cryptographic fingerprint, *any* citizen, journalist, opposing party, or legislative staffer can re-run the baseline and confirm it independently. Verification does not require trusting the authors; it requires running the code. This is the difference between "trust us, the commission was fair" and "here is a result you can reproduce yourself in an afternoon."

**The "beat the baseline or explain why" standard reframes the burden of proof.** This is the practical payoff and the answer to *Rucho*'s "no manageable standard" problem. Under current practice, a challenger must prove a map is a gerrymander — a burden *Rucho* made nearly impossible in federal court. A baseline inverts the rhetoric: the neutral map exists, publicly, before any enacted map is drawn. An enacted map that departs sharply from it on compactness, splits, or population balance is not automatically illegal — but the enacting authority now bears the *public* burden of explaining *why* each material departure serves a legitimate, stated interest (a still-applicable VRA requirement, a preserved community of interest, a county kept whole). Legitimate departures have ready answers; partisan ones do not. The standard does not ask a court to measure "how much" gerrymandering is too much; it asks the mapmaker to account for the difference between their map and a map drawn with no partisan information at all. That is a manageable, transparent standard of exactly the kind *Rucho* said the political branches, not the courts, should supply.

---

## 5. Precedents and analogues

The idea of removing discretion from districting is not new, and intellectual honesty requires acknowledging the lineage rather than claiming originality.

**Iowa's nonpartisan agency model.** Iowa is the longest-running American example of rule-bound, low-discretion congressional districting. Its nonpartisan **Legislative Services Agency (LSA)** draws maps under criteria fixed almost entirely by statute — population equality, contiguity, compactness, and keeping counties and cities whole — **without** using political or election data, and an advisory commission of non-officeholders runs public hearings. The legislature may only approve or reject the LSA's plan, not amend it, with the state supreme court as a backstop. Iowa demonstrates that a constrained, demographic-and-partisan-blind drawing process is workable in practice and politically durable. The baseline is, in a sense, the Iowa philosophy carried to its deterministic limit: where the LSA still exercises professional judgment within the rules, the algorithm removes the judgment entirely.

**Independent commissions: Arizona, California, Michigan.** A parallel reform tradition takes the pen out of the legislature's hands and gives it to an independent body. **Arizona** voters created the Arizona Independent Redistricting Commission by ballot initiative (Proposition 106, 2000); the Supreme Court upheld that transfer of authority against an Elections Clause challenge in **Arizona State Legislature v. Arizona Independent Redistricting Commission, 576 U.S. 787 (2015)**, confirming that a state may vest congressional districting in an independent commission created by initiative. **California** (Voters FIRST Act, 2008, extended to congressional maps in 2010) and **Michigan** (Proposal 2, 2018, passed with 61% of the vote) followed with citizen commissions. These reforms attack the *discretion-capture* problem by changing *who* holds the discretion; the baseline attacks the same problem by *eliminating* the discretion. They are complementary: a commission could adopt the neutral baseline as its own starting point and justification standard, marrying democratic legitimacy with algorithmic neutrality.

**Algorithmic and optimization lineage: the shortest-splitline tradition.** The production engine described in the algorithm chapter is **recursive splitline**, and we cite its origin honestly as prior art. The **shortest-splitline algorithm** was developed by mathematician **Warren D. Smith** and popularized through the Center for Range Voting (RangeVoting.org) in the early 2000s: recursively cut a state with the shortest line that divides its remaining seats as evenly as possible in population, producing a unique, deterministic, unbiased subdivision. This report's baseline is a grid-quantized descendant of that idea, combined with an explored "center-outward squares" accretion variant of our own. The contribution here is not the splitline concept — which is Smith's — but the packaging of a deterministic, demographics-blind, fully reproducible pipeline as a *transparency benchmark* with explicit verification, paired with the constitutional and statutory analysis in this chapter. The broader academic optimization literature on compactness and automated redistricting is large; we acknowledge it as the field this work sits within rather than claiming to stand outside it.

---

## 6. What this chapter does and does not claim

To close where we began, in plain terms:

- **It claims** that a deterministic, demographics-blind, open-source baseline is constitutionally comfortable *as a benchmark* — built on *Wesberry*'s equal-population command, authorized for federal adoption under the Elections Clause, and responsive to the gap *Rucho* left open by declining to police partisan gerrymanders.
- **It does not claim** that the baseline's grid-quantized output is enactable as congressional districts without block-level refinement (because of *Karcher*), nor that a race-blind map can satisfy a still-binding §2 majority-minority requirement on its own (because of *Gingles* and *Milligan*, as narrowed by *Callais*), nor that the baseline captures communities of interest, jurisdictional integrity, or state-specific constitutional rules.
- **It recommends** the benchmark posture — "beat the baseline or explain why" — under which every one of the limitations above becomes a documented, legitimate, publicly testable reason for an enacted map to depart from the neutral reference, rather than a hidden defect of the tool.

The strongest version of this proposal is also the most modest one. The baseline does not end the argument about what a fair map is; it makes the argument *visible*, *reproducible*, and *accountable* — and after *Rucho* and *Callais*, that visibility is no longer one option among many for checking discretion in congressional districting. It is increasingly the only one the political branches are left to build.

---

> **Reproduce the legal claims.** Every case and statute in this chapter is listed in the final-message verification table with its citation and one-line status. Citations were confirmed against primary sources (U.S. Reports, the U.S. Code, the Constitution) or authoritative secondary sources (Library of Congress *Constitution Annotated* / Congress.gov, Justia, SCOTUSblog, Supreme Court of the United States) before assertion; none were cited from memory. The single most time-sensitive item — *Louisiana v. Callais*, decided April 29, 2026 — should be re-confirmed against the slip opinion and current commentary by any reader relying on it, as its scope is contested and the surrounding law is moving.

Reviewed by: __________  Date: __________


---

# Implementation Pathways

This chapter sets out how a deterministic, open-source congressional redistricting
baseline can move from a working reference system into public institutions. It does
not propose that the federal government draw any state's districts. It proposes that
the country gain a neutral, reproducible reference map against which every enacted
plan can be measured in the open.

The reference system already exists and has been run. The same process was applied
to all 50 states, producing all 435 congressional districts. Population is conserved
exactly: the assigned resident total equals the 2020 census resident population of
the 50 states, 330,759,736, to the person. Every district is a single connected
piece. The output is byte-identical across re-runs and across a deliberately
shuffled input ordering — determinism verified by SHA-256 equality, not by
inspection. The input data (2020 Census redistricting blocks) and the code are open.
These are the facts the pathways below rest on; nothing here assumes a capability
that has not been demonstrated.

The pathways are ordered by how little they ask of the political system. The first
asks only for disclosure. The last, years out, asks the most. A reader can support
the first without committing to any of the others.

---

## Pathway 1 (primary): a federal transparency baseline

The core proposal is a disclosure mandate, not a drawing mandate. After each
decennial cycle, a neutral baseline map would be computed and published for every
state by the same public process. When a state enacts its congressional plan, the
state would publish, alongside the enacted map, a standardized comparison against
that baseline. Where the enacted plan departs from the neutral reference, the
departure would be stated and justified in public.

The comparison is a fixed, short set of metrics defined by reference to a published
open specification, so that the same numbers are computed the same way for every
state and every cycle:

- **Population deviation** — the worst district's percentage departure from the
  equal-population ideal. This is already produced by the reference system for all
  50 states and is the system's strongest result: most states land far below a
  one-percent worst-district deviation, with the few exceptions confined to dense
  metropolitan geography (discussed below).
- **Compactness** — a squareness/shape measure on every district. The reference
  system scores this today and reports the count of irregular districts per state.
- **County splits** — how many counties an enacted plan divides relative to the
  baseline. This metric is *defined in the published specification and computed at
  publication time*; it is part of what the baseline regime would add, not a number
  the current reference build already emits. It is included because county integrity
  is one of the most common, most legible measures of gerrymandering.
- **Baseline-divergence score** — a single summary number expressing how far an
  enacted plan sits from the neutral reference. Like county splits, this is a
  specified metric to be computed under the regime, not an existing output. Its
  definition lives in the open spec so it cannot be tuned to a result.

The constitutional footing is the Elections Clause, which gives Congress authority
over the "Times, Places and Manner" of congressional elections. Mandating that
states publish a standardized comparison and justify deviations is a manner-of-
elections disclosure rule. It does not preempt a state's choice of map, does not
install a federal map, and does not bind any state to the baseline. It changes one
thing: a state that draws unusual lines must say so, in public, in comparable terms.

The honest framing matters. The baseline is a reference, not a verdict. There are
legitimate reasons an enacted plan should diverge from a purely geometric map — the
Voting Rights Act foremost among them. The transparency regime is built to surface
divergence and require its justification, not to penalize it.

---

## Pathway 2: state adoption

Nothing in Pathway 1 requires a state to wait for Congress. A state commission or
legislature can adopt the neutral baseline directly — as the starting point its
process refines, or as the benchmark its own map is measured against. Iowa is the
standing precedent: a nonpartisan process draws plans against fixed, neutral
criteria, and the legislature votes them up or down. A published, reproducible
baseline gives any state that wants Iowa-style discipline a turnkey reference,
already computed for its geography, that no party controls and anyone can re-run.

Adoption here is voluntary and incremental. A single state can use the baseline as a
benchmark with no change in federal law, and the more states that do, the more the
standardized metrics become a common vocabulary across the country.

---

## Pathway 3: a litigation and expert tool

Redistricting is litigated constantly, and courts already reason about whether a
challenged map is an outlier. A deterministic, open baseline is well suited to that
role as a neutral comparator. Because the process is reproducible — identical output
on re-run and on shuffled input, verified by hash — opposing experts can run the
same code on the same public data and get the same map, removing a whole category of
"my model versus your model" dispute. The baseline does not tell a court what is
legal; it gives the court a fixed, inspectable reference point that neither party
authored, against which a challenged plan's deviation can be quantified in the same
terms used everywhere else.

This pathway requires no legislation at all. It depends only on the system being
open, reproducible, and documented — which it is.

---

## Pathway 4 (long-run): a default-map fallback

The most ambitious pathway is also the furthest out and rests on a refined,
block-level variant of the engine rather than the 1-square-mile grid used for the
reference run. Several states already see courts impose congressional maps when a
legislature deadlocks or misses a deadline; the map of last resort exists today, it
is simply drawn ad hoc. A neutral, pre-published default — the baseline map — could
serve as that fallback when a state misses its deadline.

The point is not that the default map is ideal. It is that the *existence* of a
neutral default changes the negotiation. Today, a faction that benefits from
deadlock can run out the clock and let a court draw lines. If the consequence of
missing the deadline is a known, neutral, geometry-driven map, the incentive to
stall weakens, because no side can assume the fallback favors it — the algorithm
cannot see party, and the result is whatever the geography gives.

This pathway is explicitly downstream of further engineering. The reference run was
done on a coarse grid that is excellent for a baseline comparator but too blunt to
be a state's actual enacted map without block-level refinement. It is listed as a
long-run direction, conditioned on that work, not as something ready to enact.

---

## Keeping the baseline current: the annual-update mechanism

A baseline is only useful if it is current and if its currency is itself
transparent. The mechanism has two cadences:

- **Annual code re-run.** The open code is re-executed every year. This is a
  software-maintenance cadence: it catches dependency drift, confirms the
  determinism guarantee still holds (the hash of each state's output should not move
  unless an input did), and keeps the published artifacts live rather than stale.
  Because the process is deterministic, an unchanged input must produce an unchanged
  output; any annual-run hash change is a signal that something upstream moved and is
  worth an explanation.
- **Decennial input refresh.** The legally relevant inputs — census population and
  the apportionment that sets each state's seat count — change on the decennial
  cycle. The baseline's substantive content refreshes then. Between censuses the map
  is stable by design, matching how districts actually function.

Tying these together is **vintage detection**: every published artifact carries the
vintage of the data it was built from (which census, which apportionment, which seat
allocation). A consumer of the baseline can always tell which decade's data a given
map reflects, and the system can flag when a published baseline is running on inputs
that a newer vintage has superseded. This prevents the most basic failure mode of a
public reference — quietly comparing a current enacted plan against a stale baseline.

---

## Where the baseline would live: institutional home options

The regime needs a custodian: an institution that computes the baseline, publishes
the artifacts and the metric specification, and runs the annual and decennial
cadences. Several homes are plausible, and the choice is a policy decision rather
than a technical one:

- **The Census Bureau.** It already owns the underlying redistricting data and the
  decennial cadence, and is the natural source of the population inputs the baseline
  consumes. Housing the baseline beside the data it depends on minimizes vintage and
  provenance risk.
- **The Government Accountability Office.** As a nonpartisan congressional support
  agency, GAO is suited to publishing standardized comparisons and to the oversight
  framing of "did the state disclose and justify its deviations."
- **An open public repository with federal mirroring.** Because the code and data
  are open and the output is reproducible by anyone, the baseline can live in a
  public repository that a federal institution mirrors for authority and
  permanence. This option leans hardest on the system's core property: the custodian
  does not have to be trusted, because anyone can re-run the code and confirm the
  published map byte-for-byte.

These are not mutually exclusive. A workable arrangement is a federal custodian for
authority and the decennial inputs, with the open repository as the reproducibility
backstop — so that the baseline is both official and independently checkable. Across
every pathway, the same property does the work: the map is not something the public
is asked to trust, it is something the public can recompute.

---

## A note on the known rough edges

Precision requires naming where the reference run is not clean. Of the 50 states,
the equal-population result is excellent in the large majority; a small set of dense-
metropolitan states (the same New York / California / Illinois / New Jersey class
where a single ultra-dense square-mile cell can exceed a whole district's population
quota) are flagged rather than treated as passing, and the system reports them as
such rather than hiding the deviation. Across the national run, 349 districts are
flagged as irregular in shape, and the reference uses the shortest-splitline method as its
production arm because it proved the most geography-robust of the approaches tested;
the center-out square-block method is carried as the active research direction. None
of this undercuts the transparency case — it is, in fact, the case. A baseline that
reports its own flagged states and irregular districts in public is exactly the kind
of reference an enacted-plan disclosure regime should be measured against.

Reviewed by: __________  Date: __________


---

# Appendix A — Model Bill (Discussion Draft)

# DISCUSSION DRAFT — NOT LEGAL ADVICE — FOR ILLUSTRATION OF THE STATUTORY MECHANICS ONLY

> This document is a discussion draft prepared to illustrate how the statutory
> mechanics of a transparency baseline could be structured. It is not legislation,
> not legal advice, and not a finished bill. Section numbering, cross-references, and
> defined terms are illustrative. Any actual bill would require drafting by competent
> legislative counsel and conformity review against existing federal election law.

---

# A BILL

To require public disclosure of a neutral congressional redistricting baseline and a
standardized comparison of each enacted congressional plan against that baseline.

## SECTION 1. SHORT TITLE.

This Act may be cited as the **"Fair And Identical Redistricting (FAIR) Baseline
Act"**.

## SECTION 2. FINDINGS.

Congress finds the following:

(1) The Elections Clause of the Constitution authorizes Congress to make or alter
regulations as to the Times, Places, and Manner of holding elections for
Representatives.

(2) Public confidence in congressional districting depends on the ability of any
citizen to evaluate an enacted plan against a neutral, reproducible reference using
the same measures applied uniformly to every State.

(3) It is technically demonstrated that a single deterministic, open-source process
can be applied uniformly to all fifty States to produce all four hundred thirty-five
congressional districts, conserving the resident population of the fifty States
exactly and producing output that is byte-for-byte reproducible on re-execution and
on reordered input.

(4) Disclosure of how an enacted plan compares to such a neutral baseline, and public
justification of material deviations, advances the integrity of congressional
elections without displacing the authority of a State to draw its own districts.

(5) Nothing in a neutral geometric baseline can, or should, substitute for the
protections of the Voting Rights Act of 1965; a baseline is a reference for
disclosure, not a binding map and not a limit on compliance with that Act.

## SECTION 3. DEFINITIONS.

In this Act:

(1) BASELINE MAP.—The term "baseline map" means, for a State, the assignment of that
State's territory and population to the number of congressional districts apportioned
to that State, computed by the Published Specification.

(2) ENACTED PLAN.—The term "enacted plan" means the congressional districting plan
that has the force of law in a State for an election cycle, however adopted.

(3) PUBLISHED SPECIFICATION.—The term "Published Specification" means the open,
publicly available document and source code that define the baseline computation and
each Standard Metric, maintained by the Custodian under Section 6.

(4) STANDARD METRIC.—The term "Standard Metric" means each of the metrics defined in
the Published Specification, comprising at minimum population deviation, a compactness
measure, county splits, and a baseline-divergence score.

(5) CUSTODIAN.—The term "Custodian" means the Federal entity designated under
Section 6 to compute and publish the baseline map and the Published Specification.

(6) VINTAGE.—The term "vintage" means the identification of the decennial census,
the apportionment, and the seat allocation from which a baseline map was computed.

## SECTION 4. BASELINE PUBLICATION REQUIREMENT.

(a) IN GENERAL.—Not later than ninety days after each apportionment following a
decennial census, the Custodian shall compute and publish a baseline map for each
State by applying the Published Specification uniformly to every State.

(b) WHERE PUBLISHED.—The Custodian shall publish, for each State and without charge:
(1) the baseline map; (2) the value of each Standard Metric for the baseline map;
(3) the vintage of the baseline map; and (4) the source code and input data
sufficient for any person to reproduce the baseline map.

(c) REPRODUCIBILITY.—The baseline computation shall be deterministic. The Custodian
shall publish, for each State's baseline map, a cryptographic hash of the output, and
the published output shall be byte-for-byte identical on re-execution of the
published code against the published input.

(d) ANNUAL RE-EXECUTION.—The Custodian shall re-execute the published code not less
than once each year and shall confirm that each State's published baseline map
remains byte-for-byte identical, except where a change of vintage under subsection (e)
requires recomputation. Any change in a published hash absent a change of vintage
shall be disclosed with an explanation.

(e) VINTAGE REFRESH.—The substantive inputs to the baseline map shall be refreshed
only upon a new apportionment following a decennial census. Each published artifact
shall state its vintage, and the Custodian shall flag any published baseline computed
from a superseded vintage.

## SECTION 5. ENACTED-PLAN COMPARISON DISCLOSURE REQUIREMENT.

(a) IN GENERAL.—A State that enacts a congressional districting plan shall publish,
concurrently with the plan taking effect, a comparison disclosure under this Section.

(b) CONTENTS.—The comparison disclosure shall state, for the enacted plan and for the
baseline map of the same vintage, the value of each Standard Metric, computed by the
methods set out in the Published Specification.

(c) JUSTIFICATION OF DEVIATIONS.—Where the enacted plan deviates materially from the
baseline map on any Standard Metric, as defined by the threshold in the Published
Specification, the comparison disclosure shall state the reason for the deviation in
plain language and shall identify any deviation undertaken to comply with Federal or
State law, including the Voting Rights Act of 1965.

(d) FORM AND ACCESS.—The comparison disclosure shall be published without charge in a
machine-readable form prescribed by the Published Specification and shall remain
publicly available for the life of the enacted plan.

(e) NO BINDING EFFECT.—This Section requires disclosure and justification only.
Nothing in this Act requires a State to adopt the baseline map, conform an enacted
plan to the baseline map, or treat the baseline map as a ceiling, floor, or
presumption as to the lawfulness of any enacted plan.

## SECTION 6. THE PUBLISHED SPECIFICATION AND CUSTODIAN.

(a) DESIGNATION.—The [Director of the Census Bureau / Comptroller General] is
designated as the Custodian and shall maintain the Published Specification.

(b) OPENNESS.—The Published Specification, including all source code and the
definition of each Standard Metric, shall be open and publicly available at no
charge, in a form that permits independent reproduction of every published baseline
map and metric value.

(c) DEFINITION BY REFERENCE.—Each Standard Metric required by this Act is defined by
reference to the Published Specification. A metric shall not be computed for purposes
of this Act by any method other than the one set out in the Published Specification,
and any change to a metric definition shall be published, dated, and assigned a
vintage before it takes effect.

(d) MIRRORING.—The Custodian may satisfy the publication requirements of this Act in
whole or in part through an open public repository, provided that the Custodian
maintains an authoritative Federal mirror of each published artifact and its hash.

## SECTION 7. RULE OF CONSTRUCTION; SAVINGS CLAUSE (VOTING RIGHTS ACT).

(a) NO PREEMPTION OF THE VOTING RIGHTS ACT.—Nothing in this Act supersedes, limits,
or otherwise affects the application of the Voting Rights Act of 1965 or any other
Federal law protecting the right to vote. The baseline map is a neutral geometric
reference and is not evidence of compliance or noncompliance with any such law.

(b) NO PREEMPTION OF STATE AUTHORITY TO DRAW DISTRICTS.—Nothing in this Act
authorizes the Custodian or any Federal entity to draw, impose, or require any
congressional district. The authority to enact a congressional districting plan
remains with the States.

(c) DISCLOSURE ONLY.—This Act imposes obligations of computation, publication,
comparison, and justification. It creates no presumption as to the validity of any
enacted plan.

## SECTION 8. EFFECTIVE DATE.

(a) IN GENERAL.—This Act takes effect on the date of enactment.

(b) APPLICATION.—The baseline publication requirement of Section 4 and the comparison
disclosure requirement of Section 5 apply beginning with the next apportionment
following the next decennial census after enactment, and to each enacted plan adopted
on the basis of that apportionment.

---

*End of discussion draft. Bracketed designations indicate choices to be resolved in
drafting. This draft is for illustration of statutory mechanics only and is not legal
advice.*

Reviewed by: __________  Date: __________


---

# Appendix B — Objections & Responses

# Hard Questions, Answered

This document states the strongest objections to a deterministic, open-source
redistricting baseline and answers each one directly. Where the honest answer is a
limit on the proposal, it is stated as a limit. The proposal is a *transparency
baseline* — a neutral reference that enacted plans are published against and that
states justify their deviations from. It is not a binding map and does not draw any
state's districts. Several answers below turn on that distinction.

---

### 1. Doesn't a neutral geometric map harm minority representation and undermine the Voting Rights Act?

This is the hardest objection and the one the design takes most seriously. A purely
geometric baseline cannot see race and will not, on its own, produce the majority-
minority districts the Voting Rights Act sometimes requires. The answer is structural:
**the baseline is not binding.** It is a reference that enacted plans are measured
against, not a map any state must adopt. The model bill contains an explicit savings
clause stating that nothing in it supersedes or limits the Voting Rights Act, and that
the baseline is not evidence of compliance or noncompliance with it. A state that
draws VRA-required districts will diverge from the baseline on the published metrics —
and the regime asks exactly that the state *say so and justify it in public*.
Surfacing a VRA-driven deviation is the system working, not failing.

### 2. The baseline ignores communities of interest.

Correct, and intentionally so. A geometric baseline cannot know which neighborhoods
share schools, watersheds, media markets, or economic ties. But communities of
interest are precisely the kind of legitimate reason a state would deviate from the
baseline — and under the disclosure regime, that deviation is named and justified
rather than hidden. The baseline does not claim communities of interest don't matter;
it makes the choice to honor them visible and accountable.

### 3. "Squares don't respect real geography."

Two responses. First, the production national run does **not** ship the square method
— it ships the shortest-splitline method, which proved the most geography-robust of the
approaches tested across all 50 states. The square-block, center-out method is an
active research arm, not the baseline that was actually run nationally. Second, the
baseline is a comparator, not a state's enacted map. Its job is to be neutral and
reproducible, not to be the prettiest map. Where real geography demands a non-
geometric line, the enacted plan can draw it — and disclose the divergence.

### 4. The baseline splits counties.

County integrity is one of the most legible measures of fair districting, which is
why county splits are a named metric in the published specification and reported in
the enacted-plan comparison. Note one honesty point: county-split counting is part of
what the *transparency regime* adds via the published spec — it is a specified metric
computed at publication, not a number the current reference build already emits. The
point of putting it in the comparison is that a plan splitting far more counties than
the neutral reference has to account for it.

### 5. "The baseline's deviation isn't zero like an enacted map's."

True, and worth understanding. Enacted plans are drawn to essentially zero population
deviation because mapmakers move individual blocks to hit it. The baseline works from
1-square-mile cells, so it cannot shave to zero — but the measured results are still
very tight: across the 50-state run, the worst-district deviation is well under one
percent in the large majority of states. And precision here is a feature, not a
defect: the baseline is a neutral comparator, not the final enacted map. A state that
wants zero deviation draws it and discloses the (tiny) divergence from the reference.

### 6. Why are dense cities flagged with larger deviations?

In a handful of dense-metropolitan states — New York, California, Illinois, New Jersey
— a single ultra-dense square-mile cell can hold more people than a whole district's
population quota, which mathematically prevents a coarse-grid baseline from hitting
the tight gate there. The system **flags these states rather than pretending they
pass**, and reports the deviation honestly. That transparency is the design: the
baseline discloses its own rough edges, which is exactly the standard an enacted-plan
disclosure regime should be held to.

### 7. "Algorithms can be gamed — who controls the code?"

No one needs to be trusted, because the process is deterministic and open. The same
code on the same public data produces byte-for-byte identical output — verified by
SHA-256 hash, and verified to be identical even when the input order is deliberately
shuffled. The code and data are public. Anyone — a rival party, a journalist, a court-
appointed expert — can re-run it and confirm the published map to the byte. A baseline
you can recompute yourself cannot be quietly gamed; a discrepancy would be visible to
everyone who runs it.

### 8. Why 1 square mile?

A 1-square-mile (640-acre) cell is a deliberate balance: fine enough to follow
population density across a state, coarse enough to run deterministically over the
whole country in a tractable time and to produce a stable, inspectable reference.
For the *baseline-comparator* role, that resolution is the right tool. The long-run
default-map pathway contemplates a finer, block-level variant — but a state's actual
enacted map, not the neutral reference, is where block-level resolution belongs.

### 9. "This helps party X" / "this hurts party Y."

The algorithm cannot see party. There is no voter-registration, vote-history, or
partisan input anywhere in the process — it reads census population and geography and
nothing else. Whatever partisan tilt a baseline map shows in a given state is simply
what that state's geography and population produce, not a thumb on the scale. The
measured outcomes are whatever geography gives. That is the strongest guarantee of
neutrality available: not a promise of balance, but the structural inability to aim.

### 10. What about Alaska, Hawaii, and island geography?

States with a single at-large seat (including Alaska) are trivial — the district is
the state. Hawaii and other multi-island or coastal states were part of the 50-state
run; the system handles non-contiguous landmasses through virtual bridges that count
as connections, so each district remains a single connected piece. Some of these
states are flagged for review, and the system reports that honestly rather than
glossing it.

### 11. How does the baseline handle districts across water?

Contiguity is enforced as one connected component per district, and water crossings
are handled by virtual bridges that count as legitimate connections — the same way
real districts span bays, rivers, and straits. This was exercised in the national run
on exactly the coastal and island geographies where it matters, and every shipped
district passes the one-connected-piece test.

### 12. "Congress lacks the power to do this."

The proposal is grounded in the Elections Clause, which gives Congress authority over
the Times, Places, and Manner of congressional elections. The bill mandates
*disclosure* — publish a neutral baseline, publish a standardized comparison, justify
deviations — and explicitly does not draw, impose, or require any district, and does
not preempt state authority to draw maps. A manner-of-elections disclosure rule sits
well within established Elections Clause practice; this is far less intrusive than
federal standards Congress has already imposed on congressional elections.

### 13. "Why not just use independent commissions?"

Commissions and this baseline are complementary, not competing. A commission still
needs a neutral reference to measure its own work against, and an Iowa-style process
is strengthened, not replaced, by a reproducible baseline that no party controls. A
state can adopt the baseline as the starting point its commission refines, or as the
benchmark it reports against. The baseline also reaches the states that have *no*
commission — through the disclosure mandate — which a commission-only approach never
will.

### 14. What's actually new here? Isn't this just the old "shortest-splitline" idea?

Credit where due: the shortest-line / shortest-splitline method has a long lineage,
and the production baseline uses it as the geography-robust arm. What is new is not
the cut rule. It is **(a)** a full verification regime — exact population conservation
to the person (the 50-state resident total, 330,759,736), one-connected-piece
contiguity, and determinism proven by SHA-256 equality across re-runs *and* shuffled
input; **(b)** grid determinism — a fixed, reproducible 1-square-mile process that
gives byte-identical output, not just a method described on paper; **(c)** open
reproducibility — code and data published so anyone can recompute the result; and
**(d)** the square-block research arm, a distinct center-out, squares-first method
carried alongside the baseline. The contribution is turning a known cut rule into a
verified, reproducible, openly-checkable public reference.

### 15. Has this been run, or is it a proposal on paper?

It has been run. The same process produced all 435 congressional districts across all
50 states, conserving the 50-state resident population exactly (330,759,736), with
every district a single connected piece and output verified byte-identical across
re-runs and shuffled input. The known rough edges — the flagged dense-city states and
the count of irregular-shaped districts nationwide — are reported in the public
summary, not hidden. No skill or claim here implies an accuracy it has not measured.

Reviewed by: __________  Date: __________


## Doesn't a "blind" map still systematically favor one party, because density correlates with partisanship?

Possibly — and the honest answer is that this system cannot measure its own partisan effect, because it
holds no election data at all; that is a design constraint, not an oversight. Three things follow. First,
whatever partisan lean the baseline exhibits in a given state is the lean of that state's *geography*, not
of any drafter's intent — there is no mechanism by which intent can enter. Second, the baseline is a
disclosure standard, not an enacted map: the "compare and justify" regime is precisely the tool that
surfaces a *skewed enacted map*, whoever it favors. Third, the baseline is public: any analyst can overlay
election results on it and publish the partisan-impact measurement this report deliberately does not make.
That analysis is invited, not feared — it is exactly the public scrutiny the proposal exists to enable.


---

# Appendix C — One-Page Brief

# The FAIR Baseline Act — One-Page Brief

**A neutral, reproducible redistricting baseline — for disclosure, not federal map-drawing.**

---

**The problem.** Voters cannot easily judge whether an enacted congressional map is
fair, because there is no neutral, reproducible reference that the same rules produce
for every state.

**The proposal.** Require that every enacted congressional plan be published alongside
a neutral, open-source baseline map and a standardized metrics comparison, with any
material deviation justified in public — a disclosure mandate under the Elections
Clause, with no federal takeover of map-drawing.

**How it works.**
- One identical, deterministic process is applied to every state — it reads census
  population and geography only, and cannot see party.
- States keep full authority to draw their own maps; they simply publish how their
  map compares to the neutral baseline and justify any large divergence.
- The code and data are open, so anyone — a rival party, a journalist, a court expert
  — can re-run it and confirm the result for themselves.

**What was built and proven.**
- The same process produced **all 435 congressional districts across all 50 states.**
- Population is conserved **exactly** — the assigned total equals the 2020 census
  resident population of the 50 states, **330,759,736**, to the person.
- Output is **deterministic** — byte-for-byte identical across re-runs *and* across a
  deliberately shuffled input order, verified by SHA-256 hash.
- The data and code are **open**, and the known rough edges (a few flagged
  dense-city states; the count of irregular-shaped districts nationwide) are reported
  publicly, not hidden.

**What the bill would do.**
- Direct a neutral custodian (e.g., the Census Bureau or GAO) to compute and publish
  the baseline map and metrics for every state each decennial cycle.
- Require each state to publish a standardized comparison of its enacted plan to the
  baseline and to justify material deviations in public.
- Preserve the Voting Rights Act in full through an explicit savings clause — the
  baseline is a reference, never binding, and never evidence of VRA compliance.

**The ask.** Hold a hearing on the FAIR Baseline Act and direct GAO or the Census
Bureau to conduct a technical review of the reference system's reproducibility and
methodology.

---

*Discussion materials — illustrative only, not legal advice. The accompanying model
bill, implementation chapter, and objections memo provide detail.*

Reviewed by: __________  Date: __________


---

# Appendix D — Development Failure Log (Integrity Record)

The complete defect log from development — symptom, root cause, fix, prevention rule — ships in the repository as `FAILURE-LOG.md`. Its presence is deliberate: a process that claims verifiability must show its own errors and how they were caught.


---

# Appendix E — Data Sources & Verification Chain

| Input | Source | Verification |
| --- | --- | --- |
| Block populations + locations | Census TIGER/Line TABBLOCK20 (per state) | Σ POP20 must equal the official state resident population **exactly** at grid build — hard gate, all 50 states |
| State resident populations | Census 2020 Apportionment Table 2 (xlsx) | 4 known-value checks + national identity sum(50)+DC = published US total, exact |
| Seats by state, 1950–2020 | Census Apportionment Table C1 (xlsx) | per-decade totals = 435; 2020/2010 spot values; AK/HI statehood handling |
| County populations 1950–1990 | NBER census county dataset (cencounts) | anchor-state sums match published totals exactly; national sums within 0.09% |
| County populations 2000/2010 | Census intercensal county files | decennial-count columns only; same checks |
| State boundaries | Census cartographic boundary files (1:500k) | used for membership tests and silhouettes only — never for population |

All inputs are public domain US government data. The verification suite (`scripts/verify/`) is
written against the published data contract (`docs/INTERFACES.md`) and never imports engine code.
