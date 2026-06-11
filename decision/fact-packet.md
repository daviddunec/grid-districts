# FACT PACKET — Traversal-Strategy Consensus Panel (v2, post-red-team, FROZEN)

**Scope of "confirmed":** Only the *inputs* in §Confirmed Inputs are verified (research/verdicts.json
+ the V6 mechanical probe on real Census data). **Every strategy outcome described below is a
PREDICTION — no strategy has been executed yet.** Evaluators receive this packet and nothing else.

## The user's vision (verbatim — fidelity criteria derive from this)

> "Six hundred and forty acres is one square mile. It's a square, and I want there to be a process
> where it picks up the population in the set way. It could go up, down, left, right, but it's the
> same process per state, and after every square that picks up the number of population, it stops
> with that congressional district. Once it reaches that average then congressional district two
> begins and so on until all the districts per state is calculated in the same way."
>
> "What I'm trying to figure out is where should this process begin — should it be literally right
> in the middle of the state where congressional district one is literally right in the middle and
> then you start moving this process up, down, left, right, back, forth until each congressional
> district is picked up."
>
> "The goal is to have as many one square mile shapes the better before irregular shaped districts.
> As many squares as possible knowing it will not be exact. When it's all said and done, if you have
> districts to the right and districts to the left and districts up and districts down from the
> middle of the state, there should only be maximum two to four districts that are irregularly shaped."

## Confirmed Inputs (probe-measured / source-verified)

- Pilot: Colorado — 8 seats, 2020 resident population **5,773,714** (exact block sum, probe-verified), ideal district **721,714.25**.
- Colorado TABBLOCK20: 140,345 blocks, 99,899 populated, max single-block population **3,328**. Internal points bin into ~104,000 one-mi² cells. Colorado is near-rectangular (~380 × 280 cells), no coastline, no islands.
- Grid: equal-area Albers, 1-mi² cells, rook (4-neighbor) adjacency, deterministic origin snap. Denver-core cell populations roughly 5,000–25,000; most rural cells 0.
- Shared by all strategies: greedy cut (`assign iff |P+pop−T| <= |P−T|`; never close at P=0; last district absorbs the remainder), rolling re-target (`T = remaining_pop / remaining_districts`), all ties (row, col), zero randomness.
- Shared repair pass after every strategy: orphan components reassigned to the adjacent lowest-population district, then boundary-cell rebalance (each move must strictly reduce Σ|deviation| by ≥1 person and keep the donor connected; provably terminating). **The heavier a strategy's repair load, the further its final map diverges from its nominal walk.**
- Post-pilot stressors (for robustness scoring): Maryland (Chesapeake concavity), Florida (panhandle + Keys), New York (Manhattan cells ~120–150k vs 776,971 target → ±8–10% pre-rebalance deviation, flagged not failed). 6 at-large states bypass entirely.

## The five candidates — uniform template, PREDICTED outcomes

Each: **Mechanism / Predicted strengths (≤2) / Predicted weaknesses (≤2) / Predicted repair load.**

**S1 CENTER-SPIRAL.**
Mechanism: seed = in-state cell nearest the geometric centroid of in-state cells (tie row→col); square spiral (start East, clockwise E→S→W→N, run lengths 1,1,2,2,3,3…), skipping out-of-state cells; greedy cut on visit order.
Strengths: District 1 forms centered on the state's middle; the only strategy whose growth is literally center-outward in all four directions.
Weaknesses: Districts 2…n are predicted to form concentric rings/arcs around District 1 (high perimeter, non-square); on Colorado's ~1.4:1 rectangle the spiral runs off the north/south edges before completing outer rings, producing long skipped runs and fragmented outer districts pre-repair.
Repair load: HIGH (ring fragmentation at state edges).

**S2 SERPENTINE SWEEP.**
Mechanism: visit rows north→south, boustrophedon (row 0 W→E, row 1 E→W, …); greedy cut.
Strengths: simplest possible rule; consecutive cells almost always adjacent, so the nominal walk is nearly contiguous.
Weaknesses: districts predicted to be full-width horizontal bands (Colorado ≈ 380 mi wide × ~35 mi tall, aspect ≈ 10 — maximally non-square); no center-outward semantics at all.
Repair load: LOW (occasional row-transition breaks).

**S3 SQUARE-BLOCK ACCRETION.**
Mechanism: band width k0 = max(1, round(sqrt(ideal_target/ρ))) from statewide density (CO: k0 ≈ 114); vertical bands swept boustrophedon; seed = first unassigned in-state cell in sweep order; grow by the frontier cell minimizing (resulting region bbox max side, Chebyshev distance to seed, row, col); greedy-cut acceptance on that single candidate; empty frontier → close early ("sealed").
Strengths: the bbox-side growth penalty directly optimizes square regions; predicted to contain leftover irregularity at one edge of the state.
Weaknesses: contiguity holds for grown regions, but early-sealed regions and the final remainder rely on repair (the "by construction" guarantee is partial, not total); seeds sweep from the west edge — no center-outward semantics.
Repair load: LOW-MEDIUM (sealed regions + final remainder).

**S4 HILBERT CURVE.**
Mechanism: embed grid in the 2^m×2^m Hilbert curve (CO: m=9 → 512×512), canonical d2xy; sort in-state cells by curve index; greedy cut the 1-D sequence.
Strengths: curve locality predicts compact, blob-like districts; degrades gracefully on pathological state shapes (the robustness fallback candidate).
Weaknesses: most of the 512² curve is out-of-state, so the in-state subsequence jumps wherever the curve crosses masked cells — repair load comparable to other cell-walks, not negligible; blobs are compact but not square, and not center-outward.
Repair load: MEDIUM (mask-crossing jumps).

**S5 RECURSIVE SPLITLINE (reference baseline; not a cell-walk).**
Mechanism: recursively split region seats a:b = ⌊s/2⌋:(s−⌊s/2⌋); cut families V/H/two diagonals as half-plane predicates via prefix sums; minimize |popA − (a/s)·popR|; ties → shortest cut → V<H<D1<D2 → lower index.
Strengths: the academic compactness baseline; predicted rectangle-ish wedges with the best population balance pre-repair.
Weaknesses: embodies none of the user's vision — no 1-mi²-walk semantics, no center-outward growth, no squares-first objective; concave regions can produce disconnected halves needing repair.
Repair load: LOW (occasional concavity splits).

## Eligibility (pass/fail, not scored)

DISQUALIFY a strategy only if there is a structural reason the shared repair pass cannot restore
contiguity, or the rule as specified is not deterministic. As specified, all five are deterministic.

## Scoring criteria (1–5 each; orthogonal by design)

1. **squareness_outcome** — predicted ability to deliver many square/regular districts AND stay within the user's ≤2–4 irregular budget on Colorado. (One criterion — do not double-count.)
2. **repair_burden** — how little the final map diverges from the nominal walk (5 = walk output survives repair nearly unchanged; 1 = repair effectively redraws the map, meaning the strategy's appealing description is not what ships).
3. **geography_robustness** — predicted behavior on MD concavity / FL panhandle / NY hot cells.
4. **vision_center_outward** — does the process literally begin in the middle of the state and grow up/down/left/right, as the user described? (Partial credit allowed — e.g., a strategy could be re-seeded from the center.)
5. **vision_squares_first** — does the mechanism itself prioritize square shapes, the user's #1 stated goal?

**Implementation complexity is NOT scored.** It is a post-panel tiebreaker only (accuracy outranks build effort in this project's priority order).

## Pre-committed decision protocol (you do not pick the final winner)

The panel selects the TOP 2 for implementation; the final pick is made mechanically from Colorado A/B
scores per `decision/ab-metrics.md` (frozen before this packet existed). Recommend a single winner
ONLY if it takes ≥4/5 first-choice votes with zero unresolved fatal flaws. Hybrid proposals (e.g.,
"S3 growth rule re-seeded from the center") are welcome in ballot notes but are not votable options.
