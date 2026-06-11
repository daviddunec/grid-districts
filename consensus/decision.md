# CONSENSUS DECISION — Traversal Strategy (Phase 1) — AWAITING HUMAN GATE 1

**Panel:** 5 blind Opus evaluators, distinct lenses (edge-robustness / shape quality / repair realism /
user-vision fidelity / 50-state scale), zero tools, identical frozen fact packet (v2, post-red-team).
Tally computed deterministically in code. Raw ballots: `consensus/ballots/`, tally: `consensus/tally.json`.

## The vote

| | S1 spiral | S2 serpentine | **S3 square-block accretion** | S4 Hilbert | S5 splitline |
|---|---|---|---|---|---|
| First-choice votes | 0 | 0 | **5/5 (unanimous)** | 0 | 0 |
| Borda (max 20) | 6 | 4 | **20** | 9 | 11 |
| Condorcet | — | — | **winner (5–0 pairwise vs every rival)** | — | — |
| Mean squareness | 1.8 | 1.0 | **4.2** | 2.6 | 3.2 |
| Mean vision: squares-first | 2.2 | 1.0 | **5.0** | 1.8 | 1.4 |
| Mean vision: center-outward | **5.0** | 1.0 | 2.2 | 1.0 | 1.0 |

## Decision (per the pre-committed protocol)

- **TOP 2 TO IMPLEMENT: S3 (square-block accretion) + S5 (splitline baseline).**
- **Single winner: NONE declared** — deliberately. S3 took 5/5 first choices, but all five evaluators'
  steelman fields converged on the same *untested* risk (below), and the protocol reserves the final
  pick for the mechanical Colorado A/B (`decision/ab-metrics.md`). The panel predicts; the engine decides.

## The hybrid that matters most to David (carried into implementation)

**S3 re-seeded from the state centroid.** 4 of 5 evaluators independently flagged it: S3's bbox-side
growth penalty mechanizes the squares-first goal (mean 5.0), but as specified it seeds from the west
edge. Re-seeding district 1 at the centroid restores the literal **"start in the middle, grow
up/down/left/right"** vision — both vision clauses in one mechanism. **The A/B will therefore run THREE
arms: S3-west-edge, S3-centroid-seeded, and S5 baseline.**

## Dissents (surfaced by name — findings, not noise)

- **E5 (50-state lens):** ranked S4 Hilbert #2 — its locality guarantee is shape-independent ("it never
  seals, so it cannot cascade-seal"); warns the panel's S3 consensus may over-index on Colorado, the easy
  case. → S4 stays in reserve as the robustness fallback if S3 fails the shakeout.
- **E4 (vision lens):** sole evaluator ranking S1 spiral #2 — "S1 is the only candidate that actually
  shows the user the picture in their head." → resolved via the centroid-seeded S3 arm.
- **E1 (robustness lens):** names the falsification condition — if sealing cascades on MD/FL, S2's
  predictability beats S3's aspirational squareness.

## Unresolved risk register (drives the shakeout tests)

**S3 sealing-cascade risk (raised in substance by all 5):** the bbox penalty governs *grown* regions;
early-sealed regions + the final remainder are decided by the repair pass. On concave geographies
(MD Chesapeake, FL panhandle/Keys, NY islands) repeated early sealing could spike repair load and erode
the squareness that justifies S3's #1 rank. **Gating experiment (pre-committed): nominal-walk-vs-shipped-map
divergence (repair-move count) on MD/FL/NY**, with the centroid-seed arm and the S4 fallback as contingencies.

---

## HUMAN GATE 1 — David's sign-off required

Approving this gate approves the **procedure**, not a final winner:
1. Implement S3 (both seed variants) + S5; A/B on Colorado per the frozen `ab-metrics.md`.
2. The winner falls out mechanically from the scores — no further human pick.
3. Fallback if both fail eligibility gates on CO: promote S4 (panel #3 by Borda), same protocol.

Sign-off: __________  Date: __________
