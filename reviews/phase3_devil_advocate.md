# Phase 3 — Devil's Advocate Review: Is accretion-west ready to scale to 50 states?

**Stance:** Adversarial. The mechanical winner (accretion-west) is real and the determinism is real.
My job is to attack the *inference* from "won the Colorado A/B" to "ready for the 50-state batch."
If every attack below were toothless, the pattern failed. They are not toothless.

**Evidence base:** `out/CO/scores.csv`, `stats_*.json`, the three `assign_*.csv` (re-tabulated
below), `src/traverse/accretion.js`, `src/traverse/splitline.js`, `src/repair.js`, `cli.js`,
`consensus/decision.md`, `decision/ab-metrics.md`, `docs/INTERFACES.md`, `out/CO/` directory listing.

Per-district cell/pop, re-derived from the CSVs (not trusting stats files):

| arm | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 (last) |
|---|---|---|---|---|---|---|---|---|
| accretion-west | **41266** | 18664 | 4223 | 9092 | 268 | 126 | 2129 | 28367 |
| accretion-centroid | 6309 | 10392 | 6191 | 13297 | 121 | 401 | 2195 | **65229** |
| splitline | 5060 | 2458 | 1234 | 20471 | 2274 | 10579 | **50768** | 11291 |

(All three total 104,135 in-state cells. Coverage is fine. Population is dead-even — that's the easy
part and not in dispute.)

---

## ATTACK 1 — Colorado is the easy case, and the winning metric is built from properties that Colorado uniquely supplies.

The whole ranking is **irregular-count first, then meanPpn**. Both numbers are flattered by Colorado's
geometry, and both degrade in named ways on MD/FL/NY.

**1a. `bridges: []`.** INTERFACES.md (`grid.json`) literally says "Colorado: expected `[]`." Colorado
has **no islands, no virtual bridges**. The entire bridge code path in `repair.js` and `score.js`
(`bridgeMap`, the "no adjacent district → nearest by Chebyshev" branch at repair.js:97-108) ran on an
empty map. So:
- **FL Keys** and **NY (Long Island, Manhattan, Staten Island)** are the *first* inputs that exercise
  bridges at all. A bridge is a single virtual edge holding an island to the mainland. The accretion
  walk (accretion.js) uses **only physical rook neighbors** (`addNeighbors`, lines 74-81) — it does
  **not** traverse bridges. So an island can never be *grown into*; it can only be swept up by the
  last-district absorb (accretion.js:59-64) or rescued by repair's orphan pass. Neither is a "square
  block." On FL/NY this is not an edge case, it is the modal case for coastal districts.
- ppn (INTERFACES.md: "Bridges do NOT remove exposed edges") *penalizes* every island district by
  counting the entire island coastline as exposed perimeter. So the very states with islands will score
  systematically *worse* on the metric that picked the winner — and Colorado contributed zero such
  districts to the calibration.

**1b. Aspect ratio is a near-rectangle freebie.** Colorado's state bbox aspect is ~1.0 (it is a
rectangle). The irregular test fires on `bboxAspect > 2.0`. In CO the largest district aspect is 1.83
(splitline D1). **No district in any arm is anywhere near the 2.0 aspect trip on CO** — not because the
algorithm controls aspect, but because the *state* has no concave neck to force a long thin district.
- **MD**: the Eastern Shore + the western panhandle give Maryland a real-state aspect far above 2. Any
  district that has to span the Chesapeake concavity, or live entirely on the Eastern Shore, will have a
  bbox aspect well over 2.0 *by construction of the coastline*, tripping the irregular flag regardless of
  how the walk behaves.
- **FL panhandle**: the panhandle is itself an aspect > 3 ribbon. A district covering Pensacola→Tallahassee
  is a forced thin rectangle. CO never produced a single such shape, so the metric was never stressed.

**1c. meanPpn 0.6107 is a near-rectangle artifact.** ppn is normalized so a perfect grid square = 1.0.
On a rectangular state with a mild density gradient, square-block accretion *can* approximate squares.
On a concave state the bbox-side-growth penalty (accretion.js:90-98, the `side` minimization) keeps
trying to grow a square into a coastline that isn't there — the frontier runs out on one side and the
district elongates. **meanPpn 0.61 is the ceiling case, not a representative case.** I would expect
MD/FL meanPpn for accretion-west to land materially below 0.45 for coastal districts (the splitline arm
already shows what sub-0.45 looks like at scale: 5 of 8 districts).

**What would change my mind on Attack 1:** run accretion-west on MD and FL and show (i) bridge-bearing
districts that are still contiguous *and* ppn ≥ 0.45, and (ii) no district tripping aspect > 2.0 purely
from coastline geometry. Until those two numbers exist, "1 irregular / 0.61 ppn" is a Colorado number,
not a method number.

---

## ATTACK 2 — The sealing-cascade risk (all 5 panel evaluators' #1 concern) was NOT tested. There is no `sealed_*.log`. The answer is: **Colorado tested it zero times.**

This is the loudest finding and I want it unmissable.

- `consensus/decision.md` "Unresolved risk register": *"S3 sealing-cascade risk (raised in substance by
  all 5)."* The pre-committed gating experiment was repair-move divergence **on MD/FL/NY** — explicitly
  not Colorado.
- `cli.js:57-58` writes `sealed_<arm>.log` **only `if (result.sealedLog.length)`**. The `out/CO/`
  directory contains **no `sealed_*.log` for any arm** (confirmed by directory listing). Therefore
  `sealedLog.length === 0` on all three arms. **Zero districts sealed on Colorado.**
- Mechanically this is expected and damning: a district seals (accretion.js:100, `best === -1`) only when
  its growth frontier is *entirely* claimed/out-of-state before it hits target — i.e., it got boxed in.
  On a convex near-rectangle with a smooth density gradient, that essentially never happens. **Colorado
  is structurally incapable of triggering the failure mode the panel cared most about.**

So the A/B selected a winner on a state where the winner's single largest predicted risk has **0% code
coverage**. "All eligible, all contiguous, determinism proven" is true and irrelevant to the question
the panel actually flagged. The sealing path in `accretion.js` is, as of this pilot, **dead code that
has never executed in anger**. Promoting accretion-west to 50 states on this evidence is shipping an
untested branch to production.

Note also: because the log is written *conditionally*, the **absence of the file is ambiguous** to a
reader who didn't read cli.js — it could mean "no sealing" or "logging broke." The pipeline should emit
a `sealed_<arm>.log` (even `[]`) on every run so "zero sealing" is an *asserted* result, not an inferred
one. Right now the most important risk register line is documented by a missing file.

**What would change my mind:** a MD or FL run where `sealedLog.length > 0`, the resulting `sealed_*.log`
shows the sealed districts, and the post-repair map still passes all four gates with irregular-count
within the project's ≤2-4 goal. That is the experiment the protocol promised and has not run.

---

## ATTACK 3 — "1 irregular" is sitting on the cliff edge. The winner's compactness is one coastline away from collapsing.

The irregular test is `ppn < 0.45 OR aspect > 2.0 OR bboxFill < 0.45`. "Robust" would mean the winner's
districts clear these thresholds with margin. They do not.

accretion-west district-by-district distance to the nearest cliff:
- **D7: ppn 0.4673** — **0.017 above the 0.45 ppn cliff.** A single rebalance move or one more sealed
  cell flips this to irregular. (D7 bboxFill 0.572 is also only 0.12 above its cliff.)
- **D8: aspect 1.663** — 0.34 below the 2.0 aspect cliff, *on a state with ~1.0 aspect*. On any concave
  state this is the district that elongates first.
- **D8: ppn 0.527, bboxFill 0.597** — within 0.08 / 0.15 of their cliffs.
- The lone flagged D2 (ppn 0.279, fill 0.338) is already gone.

So accretion-west is genuinely **one nudge from "2 irregular"** (D7 ppn), at which point it *ties*
accretion-centroid on the first ranking key and the win is decided by meanPpn alone. The "1 vs 2 vs 5"
headline reads like a comfortable spread; the underlying margin on the lexicographic *first* key is
**0.017 of a Polsby-Popper ratio.** That is not robust; that is a photo finish dressed as a blowout.

For comparison, the prompt's named splitline D8 (ppn 0.4985) is **0.0015 above** the cliff — splitline's
"5 irregular" would become "6 irregular" on a rounding breath. Both arms are clustered against the
threshold; Colorado just happened to land accretion-west's marginal district (D7) on the safe side by
0.017. Re-run on a slightly different state and that sign can flip.

**What would change my mind:** show that across MD/FL/NY the winner's *minimum* district ppn stays
above, say, 0.50 (real margin, not 0.017), or re-define the metric with hysteresis so a 0.017 ppn jitter
can't reorder the arms.

---

## ATTACK 4 — The winning margin is partly manufactured by repair. accretion-west needed 60 rebalance moves — nearly 3x the runner-up — and the metric that rewards it (repairMoves) ranks it WORST of the three on that very axis.

This is the internal contradiction in the result.

- repairMoves: accretion-west **60**, accretion-centroid 22, splitline 15 (scores.csv; the stats files
  confirm: west rebalanceMoves 60, centroid 22, splitline 14 + 1 orphan).
- The ranking is lexicographic: irregular → meanPpn → **repairMoves** → maxDev. accretion-west wins on
  key 1 (irregular) so the comparison stops before repairMoves matters. But ab-metrics.md itself says
  repairMoves *"proxies how much the raw walk lied."* **By the project's own definition, accretion-west's
  raw walk lied the most of the three arms** — its shipped map is the furthest from what the pure
  square-block accretion produced. Centroid's walk was 2.7x more honest; splitline's 4x.

So "accretion-west is the squarest square-block accretion" is not quite what happened. What happened is:
accretion-west's *raw* walk produced a map that then needed 60 boundary cells reshuffled by `repair.js`
Pass 2 to hit population equality, and only the *post-repair* shape was scored for compactness. The
clean separation the project wants — walk produces shape, repair only fixes contiguity/equality — is
muddied: the rebalance pass (repair.js:150-184) moves boundary cells purely to reduce population
objective, which *also* reshapes districts and therefore *also* moves the ppn/aspect/fill numbers that
decide the winner. 60 such moves is enough to nudge a near-cliff district (see Attack 3, D7 at 0.4673)
across a threshold in either direction. **The winner's compactness score is a function of the repair
pass, not just the traversal.** You cannot cleanly attribute the win to "square-block accretion is best"
when the runner-up's *traversal* was demonstrably more faithful and 60 cells of post-hoc surgery
separate the shipped winner from its own walk.

This also predicts badly: repair-move count is the one metric expected to *explode* on concave states
(the panel said so). accretion-west enters the shakeout as the arm **most** dependent on repair, on the
axis **most** sensitive to geography. It is the worst-positioned arm for MD/FL/NY on its own weakest
metric, and it won only because Colorado let key-1 short-circuit the comparison before that weakness
counted.

**What would change my mind:** score compactness on the **pre-rebalance** map too and show the win
survives without the 60-move surgery; or show on MD/FL that accretion-west's repairMoves stay bounded
(say < 100) rather than scaling with concavity.

---

## ATTACK 5 — The last-district absorb is the garbage-collector, and in the centroid arm it is the irregular district. The "leftovers at one edge" pathology IS visible in the stats — it just didn't sink the *winning* arm, this time, on this state.

`accretion.js:59-64`: the last district (d === seats === 8) absorbs **every remaining unassigned cell**,
no shape control, contiguity left to repair. So D8 is structurally the dumping ground in both accretion
arms. Look at what it absorbed:

- **accretion-centroid D8 = 65,229 cells = 62.6% of all 104,135 in-state cells**, for 721,672 people
  (one seat's worth). ppn **0.1815**, fill 0.519, aspect 1.27 → **IRREGULAR**. This is the pathology in
  the flesh: centroid seeding grows seven tight districts out of the dense middle, then the entire
  sparse remainder of the state (Eastern Plains + Western Slope) collapses into a single C-shaped
  last district wrapped around the others. ppn 0.18 is barely a fifth of a square. The "leftovers
  swept to the edge" story is **not a hypothetical — it is centroid D8, and it is exactly the arm David
  most wanted** (the center-outward vision, per consensus/decision.md). The vision arm produced the
  ugliest single district in the entire pilot.

- **accretion-west D8 = 28,367 cells**, ppn 0.527, aspect 1.663 — the second-largest district, and (per
  Attack 3) the one nearest the aspect/ppn cliffs. West's leftovers are *also* concentrated in the last
  district; CO's geometry just kept them merely-bad instead of catastrophically-bad. West also has D1 =
  41,266 cells (the west seed sweeping the sparse Western Slope) — so west has **two** sprawl
  districts (D1 seed + D8 absorb), and both are its least-compact non-flagged districts (ppn 0.527 and
  0.637... actually D8 0.527 and D7 0.467).

The implication for scale: the last-district absorb is a **single point of failure that grows with the
sparse-area fraction of the state.** Colorado's sparse east/west is large but convex. On a state where
the leftovers are *disconnected* (FL Keys, NY Long Island), the absorb dumps non-contiguous cells into
D8 and hands a potentially huge orphan-repair bill to `repair.js` Pass 1 — exactly the cascade the panel
feared, now concentrated in the one district with zero shape control. Centroid D8 at ppn 0.18 on the
*easy* state is the warning shot.

**What would change my mind:** cap or shape the last-district absorb (e.g., make the final region a
proper accretion target rather than a sink), and show on MD/FL that no single district exceeds, say, 25%
of state cells with ppn < 0.45.

---

## ATTACK 6 — The A/B protocol itself: clean on paper, but the pilot quietly under-specified three things that let a Colorado-only result masquerade as a scale verdict.

ab-metrics.md is genuinely good hygiene (pre-committed, anti-metric-shopping, written before code). The
problems are not gaming of the stated metric — they are scope and what the metric *omits*:

**6a. The protocol selects on Colorado and the prompt's framing ("ready to scale to 50 states")
over-reads it.** ab-metrics.md §Scope is honest: *"A/B runs on Colorado only for selection. The winner
must then survive the MD/FL/NY shakeout ... before the 50-state batch (Phase 4 GO condition)."* So the
**protocol does not claim scale-readiness** — the shakeout is a *separate, not-yet-run* gate. Any
statement that the approach "is ready to scale to 50 states" contradicts the project's own
pre-committed plan. The correct status is: *winner of the selection A/B, shakeout pending.* The
conclusion under attack is one the protocol explicitly defers.

**6b. The ranking metric has no repair-honesty floor and no sealing term.** The single most-flagged
risk (sealing) appears **nowhere in the four ranking keys** (ab-metrics.md §Ranking). An arm that seals
catastrophically but gets bailed out by repair into a compact-looking map would *score well*. The metric
rewards the *post-repair* outcome and is blind to *how much lying* it took to get there beyond a
tertiary tiebreak (repairMoves) that, as Attack 4 shows, never even came into play. A protocol whose
top risk is absent from its own scoring function cannot certify against that risk.

**6c. Determinism was proven, but determinism is the cheap property.** G3 (SHA-256 across cold +
shuffled runs) proves the engine is reproducible. It says **nothing** about correctness or
generalization — a deterministically-wrong map is still wrong. The pilot's strongest, most-repeated
claim ("determinism proven") is the claim that matters least for the scale question. It is being used
as reassurance for a property (robustness across geographies) it does not address.

**What would change my mind:** restate the conclusion as "selection-A/B winner, shakeout pending," add
a sealing/repair-honesty term to the ranking (or a hard gate), and emit `sealed_*.log` unconditionally
so the omitted risk becomes a measured, gated quantity.

---

## VERDICT

**VERDICT: DEFENSIBLE WITH CAVEATS** (house scale)

Defensible *as what it actually is*: a clean, deterministic, fully-verified **selection A/B on
Colorado** that correctly ranked accretion-west first under a pre-committed, non-shopped metric. The
math holds, coverage/contiguity/population are real, and the protocol honestly scopes itself to
selection. **NOT DEFENSIBLE** as "ready to scale to 50 states" — that claim is not supported by this
pilot and is explicitly deferred by the project's own ab-metrics.md.

Concrete pre-conditions for the 50-state run (each must be met before Phase 4 GO):

1. **Run the MD + FL + NY shakeout that the protocol already promised.** No 50-state batch until
   accretion-west clears all four gates on all three with irregular-count ≤ 4. This is the gate, not Colorado.
2. **Trigger and inspect sealing.** Emit `sealed_<arm>.log` **unconditionally** (write `[]` when empty)
   so "zero sealing" is asserted, not inferred. Require ≥1 shakeout state where `sealedLog.length > 0`
   and verify the post-repair map still passes all gates. Until sealing fires at least once, the
   panel's #1 risk has 0% coverage.
3. **Add real margin to the irregular metric, or accept that "1 irregular" is a 0.017-ppn photo finish.**
   Either require the winner's minimum district ppn to clear 0.45 with margin (e.g., ≥0.50) on the
   shakeout states, or add hysteresis so a sub-0.02 ppn jitter can't reorder the arms (D7 at 0.4673).
4. **Decouple the win from repair.** Score compactness on the **pre-rebalance** map as well; require the
   accretion-west win to survive without its 60-move surgery, and bound repairMoves on concave states.
5. **Fix the last-district absorb before it meets a coastline.** Centroid D8 (62.6% of state cells, ppn
   0.181) is the pathology on the *easy* state. Make the final region a shaped accretion target, not a
   sink, and cap any single district's share of state cells. Verify on FL/NY where leftovers are islands.
6. **Bridge-bearing districts must be exercised and pass.** FL Keys / NY Long Island are the first real
   tests of the bridge path (untouched on CO). Require contiguity + ppn ≥ 0.45 on bridged coastal
   districts before any batch.
7. **Add a sealing / repair-honesty term to the ranking function** (or a hard gate). The top-flagged
   risk currently does not appear in any of the four ranking keys.
8. **Restate the headline.** "Selection-A/B winner on Colorado; 50-state readiness pending shakeout" —
   not "ready to scale."

---

**VERDICT: DEFENSIBLE WITH CAVEATS** — a clean Colorado selection A/B, NOT a scale verdict.
**Strongest single attack:** the panel's unanimous #1 risk (sealing cascade) was tested **zero times** —
no `sealed_*.log` exists because Colorado's convex near-rectangle is structurally incapable of sealing a
district, so accretion-west was crowned on a state that cannot exercise the one failure mode that
decides whether it survives Maryland, Florida, and New York.

Reviewed by: __________  Date: __________
