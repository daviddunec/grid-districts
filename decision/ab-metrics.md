# Pre-Committed A/B Metrics — Traversal Strategy Selection

**Written 2026-06-10, BEFORE the consensus panel convened and BEFORE any traversal code exists.**
These metrics decide the final strategy mechanically from Colorado pilot results. They may not be
changed after panel ballots or pilot scores exist (anti-metric-shopping rule). Human Gate 1 approves
this protocol; the winner then falls out of the numbers.

## Eligibility gates (pass/fail — a strategy failing any gate is out, regardless of scores)

| Gate | Requirement |
|---|---|
| G1 Population equality | Every CO district within **±1.0%** of ideal target (721,714) after repair/rebalance |
| G2 Contiguity | Every district = exactly 1 connected component (rook adjacency; virtual bridges count) |
| G3 Determinism | SHA-256 of canonical assignment CSV identical across 2 cold runs + 1 shuffled-input run |
| G4 Coverage | Every in-state cell assigned to exactly one district |

## Ranking metrics (lexicographic, in this order)

1. **Irregular district count** (lower wins) — irregular := PPn < 0.45 OR bbox aspect > 2.0 OR bbox fill < 0.45. Project goal: ≤ 2–4.
2. **Mean normalized Polsby-Popper (PPn)** (higher wins) — PPn = (4π·A/P²)/(π/4), perfect grid square = 1.0.
3. **Repair-move count** (lower wins) — total cells touched by contiguity repair + rebalance; proxies how much the raw walk "lied."
4. **Max population deviation** (lower wins) — final tiebreak.

Ties beyond all four: the simpler implementation (fewer LOC in src/traverse/) wins.

## Fallback branch (pre-decided)

If BOTH top-2 panel strategies fail an eligibility gate on Colorado, promote the panel's #3 and re-run
the same protocol. If #3 also fails: stop, FAILURE-LOG entry, escalate to David — do not improvise a
new strategy mid-pilot.

## Scope

A/B runs on Colorado only for selection. The winner must then survive the MD/FL/NY shakeout
mini-gauntlet before the 50-state batch (Phase 4 GO condition); a shakeout failure reopens this
protocol with the shakeout state added to the scoring set.
