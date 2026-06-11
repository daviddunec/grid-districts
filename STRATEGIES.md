# Redistricting Strategies — The Complete Picture

**This is the single source of truth** for the traversal options, where each succeeds and fails,
*why*, and the recommended path forward. It consolidates `consensus/decision.md` (why these five),
`reviews/shakeout-report.md` (the matrix), and `FAILURE-LOG.md` (root causes). The numeric matrix
below is reproducible — it is read directly from `out/<ST>/scores.csv` after a run, never hand-typed.

Last updated: 2026-06-10, after the MD/FL/NY shakeout + the orphan-splitting repair upgrade.

---

## How a district is judged (the gates)

Every arm must, on every state, produce districts that are:
- **Equal population** — within the deviation gate (CO pilot **±1%**; national **±2%**; the four
  hot-cell states NY/CA/IL/NJ are **flagged-not-failed** because a single Manhattan-density cell can
  exceed a whole district's slice — see FL/NY notes).
- **Contiguous** — one connected piece each (water bridges count as connections).
- **Deterministic** — byte-identical output across re-runs, even with shuffled input order.
- **Complete** — every 1-mi² in-state cell assigned to exactly one district.

Then they are *ranked* by: fewest **irregular** districts (irregular = squareness PPn < 0.45, or
bounding-box aspect > 2, or bbox fill < 0.45) → highest mean squareness (PPn) → fewest repair moves.
"Irregular ≤ 2–4 per state" is your stated goal.

---

## The five options

| Code | Name | One-line mechanism | Embodies your vision? |
|---|---|---|---|
| **S1** | center-spiral | Seed at the centroid, spiral outward clockwise; cut at target population. | ✅ literally center-outward, ❌ but makes rings, not squares |
| **S2** | serpentine | Sweep rows top→bottom, snake left↔right; cut at target. | ❌ makes wide stripes |
| **S3-west** | square-block accretion (west seed) | Grow each district one neighbor at a time, always picking the cell that keeps the block most square; seeds sweep from the **west edge**. | ✅ squares-first, ❌ not center-outward |
| **S3-centroid** | square-block accretion (centroid seed) | **Same square-growth rule, but district 1 starts in the middle of the state** and they radiate outward. | ✅✅ **squares-first AND center-outward — your exact idea** |
| **S5** | splitline | Recursively cut the state with the shortest line that splits seats in half; not a grid-walk. | ❌ academic baseline only |
| **S4** | hilbert | Order cells along a space-filling curve, cut into equal-population runs. | ❌ kept only as a robustness contingency |

The blind 5-judge consensus panel ranked **S3 (square-block accretion) #1 unanimously** (5/5
first-choice, Condorcet winner). S2 was eliminated early (wide stripes). S1 (your literal spiral
instinct) was honored by adding the **centroid seed** to S3 — giving you squares-first *and*
center-outward in one mechanism. S5 and S4 are carried as the comparison baseline and the
contingency. So the live contest is **S3-centroid vs S3-west vs S5**, with S4 as backstop.

---

## The success / fail matrix (from `out/<ST>/scores.csv`)

Worst-district population deviation, and (irregular-district count). ✅ = passes its gate, ❌ = fails.
CO is the easy near-rectangle; MD tests Chesapeake concavity; FL tests panhandle + Keys islands; NY
tests Manhattan hot-cells + Long Island (flagged-not-failed, so shown as ✅ⓕ).

| Arm | Colorado (8) | Maryland (8) | Florida (28) | New York (26) | Eligible everywhere? |
|---|---|---|---|---|---|
| **S3-centroid** (your vision) | ✅ 0.024% (2) | ✅ **0.082%** (6) | ❌ **37.05%** (19) | ✅ⓕ 3.42% (14) | **No — fails only FL** |
| **S3-west** | ✅ 0.018% (1) | ❌ 2.04% (4) | ❌ 7.95% (18) | ✅ⓕ 6.28% (17) | No — fails MD + FL |
| **S5 splitline** | ✅ 0.017% (5) | ✅ 0.281% (8) | ✅ 0.855% (25) | ✅ⓕ 4.08% (20) | **Yes** (but vision-empty) |
| **S4 hilbert** | ✅ 0.001% (5) | ❌ 31.78% (8) | ❌ 10.38% (25) | ✅ⓕ 8.51% (18) | No — fails MD + FL |

Reading it: **your centroid vision arm is the best squares-first option and is one state away from
clean** — it passes CO, MD, and NY comfortably and fails *only* Florida. Splitline is the only arm
that passes everywhere, but it's the baseline that embodies none of your idea (and has the most
irregular districts). Hilbert was eliminated by the data despite its theoretical robustness.

---

## Where each fails — and *why*

- **S3-centroid (your vision) — fails only Florida (37%).** Root cause is the **remainder problem**
  (FL-011): the last district to form has to absorb whatever geography is left over, and in Florida
  that's the panhandle *and* the Keys *and* scattered coast simultaneously — a single 800k-person
  "district" smeared across the whole state that no after-the-fact rebalancing can cleanly redraw.
  On CO/MD/NY there's no such scattered leftover, so it passes. **This is a fixable, well-understood
  defect, not a flaw in your idea.**
- **S3-west — fails MD (2.04%) + FL (7.95%).** Same remainder problem, plus the west-edge seed
  starts districts in the Chesapeake's notched coastline, generating orphan fragments. The centroid
  seed (your version) is strictly better here, which is itself evidence your instinct was right.
- **S5 splitline — passes everywhere, but** produces the most irregular districts (wedges, not
  squares) and has zero center-outward behavior. It "wins" mechanically only because it balances
  populations *before* assigning cells — top-down — so it never has a remainder problem. It is the
  bar to beat, not the thing to ship.
- **S4 hilbert — fails MD (31.78%) + FL (10.38%).** The panel's E5 judge predicted it "can't
  cascade-seal," which is true, but its space-filling curve jumps across water/empty gaps and dumps
  huge orphan piles (5,682 cells on MD, 11,725 on NY) that overwhelm repair. Eliminated by data.

The full failure history — eleven entries, each with symptom → root cause → fix — is in
`FAILURE-LOG.md` (FL-008 the sealing cascade, FL-009 the graph-flow rebalancer, FL-011 the remainder
problem, etc.). Five different repair upgrades were tried; each fixed one state and relocated the
failure to another, which is the signal (PR-7) that the remaining defect is **strategy-level, not
repair-level**.

---

## Recommended solution

**Primary recommendation — the "hybrid finish" (one focused consensus round, then build):**
Keep your centroid square-block accretion as the engine for districts 1 through n−k, then finish the
last *k* "remainder" seats with splitline's top-down balancing — because splitline is provably good
at exactly the thing accretion is bad at (a scattered multi-pocket remainder). This grafts the one
strength of the baseline onto your vision arm, surgically targeting the *only* reason centroid fails
Florida, while leaving CO/MD/NY (where it already passes) untouched. Expected outcome: centroid
becomes eligible everywhere and wins the mechanical A/B as both the squares-first *and*
center-outward choice. Scope is small and bounded: a "switch to splitline for the final k seats"
rule, one re-run, one full verification gauntlet.

**Fallback if the hybrid underperforms — Hilbert is the pre-committed contingency** (already built),
but the shakeout showed it's weak; more likely the fallback is "ship S3-centroid with Florida
flagged for the v2 hot-cell refinement."

**Not recommended:**
- *Ship splitline now (option B)* — it scales today but throws away your entire idea.
- *Best-strategy-per-state (option C)* — rejected outright; it violates the core requirement that
  the **same process runs on every state**.

---

## Where to go for more depth

| Question | File |
|---|---|
| Why these five, and the panel's full reasoning + dissents | `consensus/decision.md` |
| The shakeout matrix + the three options, in narrative form | `reviews/shakeout-report.md` |
| Every bug, root cause, fix, and prevention rule | `FAILURE-LOG.md` |
| The Phase-4 scale go/no-go and its conditions | `reviews/go-no-go.md` |
| Live, reproducible numbers per state | `out/<ST>/scores.csv` |
| See a map | `out/<ST>/map_<arm>.html` (e.g. `out/CO/map_accretion-centroid.html`) |

Reviewed by: __________  Date: __________
