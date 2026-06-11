# Shakeout Report — MD / FL / NY (Phase 5, 2026-06-10)

> **POST-SCRIPT (same day, after Option A ran):** Pop-aware orphan splitting was implemented per
> David's approval. Result: MD-centroid improved to **0.082%** (vision arm now passes MD easily),
> but FL-west regressed 0.107→7.95% and NY-west 2.84→6.28 — the patch relocated failures instead
> of shrinking them (FL-011, PR-7). FINAL post-splitting matrix: **splitline eligible everywhere;
> centroid eligible CO+MD+NY, fails only FL (37%, the remainder problem); west eligible CO+NY,
> fails MD (2.04 vs 2.0 gate) + FL (7.95)**. Patching stopped per the re-plan rule. The residual
> defect is structural: the LAST accretion district absorbs a multi-pocket coastal remainder that
> no post-hoc rebalance can redistribute. Recommended next step: a focused consensus round on the
> **hybrid finish** (accretion grows districts 1..n−k squares-first; the final k remainder seats
> are split top-down, splitline-style, which never has the remainder problem). All maps rendered:
> `out/<ST>/map_<arm>.html` (16 total).

Gates: CO ±1% · MD/FL ±2% · NY flagged-not-failed (hot-cell state). All runs contiguous,
deterministic, exact population conservation (verified per state at grid build).

## Eligibility matrix (max |deviation| / irregular districts)

| Arm | CO (8) | MD (8) | FL (28) | NY (26, flagged) | Eligible everywhere? |
|---|---|---|---|---|---|
| **accretion-west** | ✅ 0.018% / 1 | ❌ 3.86% / 4 | ✅ 0.107% / 21 | ✅ 2.84% / 15 | NO (MD) |
| **accretion-centroid** | ✅ 0.024% / 2 | ✅ 0.297% / 6 | ❌ 36.96% / 20 | ✅ 3.42% / 14 | NO (FL) |
| **splitline** | ✅ 0.017% / 5 | ✅ 0.281% / 8 | ✅ 0.855% / 25 | ✅ 7.84% / 20 | **YES** |
| **hilbert** (contingency) | ✅ 0.001% / 5 | ❌ 27.8% / 7 | ❌ 10.4% / 27 | ✅ 3.85% / 20 | NO (MD+FL) |

## What the shakeout proved

1. **The sealing cascade was real** (FL-008) — exactly as all 5 panel evaluators and the devil's
   advocate predicted, and exactly where they predicted it (Chesapeake pockets). Fixed by
   seal→re-seed; PR-5 promoted.
2. **Rebalancing is graph flow, not local swaps** (FL-009) — the engine grew a chain-flow
   rebalancer (blob transfers, alternate paths, fragmenting fallback, round revert). This took
   FL-west from 3.13%→0.107% and made splitline pass everywhere. PR-6 promoted.
3. **Hilbert's robustness reputation did not survive contact** — the panel's E5 dissent predicted
   it "cannot cascade-seal," which is true, but its mask-gap orphan dumps (5,682 cells on MD,
   11,725 on NY) overwhelm repair the same way. Eliminated by data.
4. **NY hot cells were milder than predicted** — panel/devil expected ±8–10%; actual worst arm is
   7.8% and the accretion arms are at 2.8–3.4%. The v2 hot-cell split (cell_blocks.json) remains
   available but is less urgent.
5. Colorado results never regressed: byte-identical SHAs through every repair upgrade.

## The decision the protocol cannot make alone

Per the frozen mechanical ranking, **splitline is the only fully-eligible arm** — but it is the
vision-empty academic baseline (worst irregular counts: 58 total vs centroid's 42), kept as a
comparison bar, never intended to ship. The two squares-first arms each fail exactly ONE hard
state, and in both cases the failure is in the REPAIR stage (orphan handling on extreme coastal
geography), not in the growth rule that the panel ranked #1 unanimously:

- **west-MD 3.86%**: Eastern Shore orphan dumps; chain flow recovers most but stalls at ~2x gate.
- **centroid-FL 36.96%**: every extraction from the Keys/Miami-area district creates a new worst
  → every chain-flow round reverts. Needs pop-aware orphan SPLITTING (divide a big orphan among
  several adjacent districts instead of dumping it into one) — a bounded, well-understood next step.

## Paths forward (David's call — this is a scope decision)

- **A. One more repair upgrade (recommended):** implement pop-aware orphan splitting (split big
  orphan components among adjacent districts proportional to their deficits). High likelihood it
  fixes both residual failures; the squares-first arms then compete fairly and the mechanical
  protocol picks between centroid (the vision arm) and west. Bounded scope: one function, one
  re-run, full gauntlet.
- **B. Accept splitline now:** mechanically clean everywhere, scales today — but ships the one
  strategy that embodies none of the original vision.
- **C. Ship per-state best:** rejected — violates the core "same process per state" requirement.

Reviewed by: __________  Date: __________
