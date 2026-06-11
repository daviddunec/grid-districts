# Phase 4 Go / No-Go — 50-State Scale-Up

**Synthesizer:** Phase-4 orchestrator. **Date:** 2026-06-10. **Feeds:** Human gate (next).
**Question:** Scale the deterministic redistricting engine from the Colorado pilot to all 50 states?

Sources read in full: `out/CO/scores.csv`; `reviews/phase3_code_review.md`;
`reviews/phase3_devil_advocate.md`; `reviews/phase3_results_skeptic.md`;
`reviews/phase3_visual_qa.md`; `FAILURE-LOG.md` (FL-001..007); `consensus/decision.md`;
grounding: `decision/ab-metrics.md`, `CLAUDE.md` (PR-1..4, V1..6), `docs/INTERFACES.md`.

---

## 1. Verdict Table — every gauntlet check / review, final status

### Mechanical eligibility gates (CO, frozen `ab-metrics.md`) — winner arm accretion-west

| Gate | Requirement | accretion-west | Status |
|---|---|---|---|
| G1 Population equality | every district ±1.0% of 721,714 | max abs dev 0.0181% | **PASS** |
| G2 Contiguity | 1 connected component/district (bridges count) | all 8 contiguous | **PASS** |
| G3 Determinism | SHA-256 identical, cold ×2 + shuffled | `7bbedaa0…77e3`, stable | **PASS** |
| G4 Coverage | every in-state cell assigned exactly once | 104,135 cells, full | **PASS** |

### Ranking (lexicographic) — why accretion-west won, mechanically

| Key | Rule | west | centroid | splitline | Winner |
|---|---|---|---|---|---|
| 1 Irregular count | lower | **1** | 2 | 5 | **west** (short-circuits) |
| 2 Mean PPn | higher | 0.6107 | 0.5527 | 0.3305 | west |
| 3 Repair moves | lower | 60 | 22 | 15 | (not reached) |
| 4 Max dev | lower | 0.0181% | 0.0238% | 0.0174% | (not reached) |

accretion-west wins on key 1 (1 < 2 < 5); the comparison legally stops there. **Selection is correct under the pre-committed, non-shopped metric.** Caveat (Attack 3/4) carried to risks: the key-1 margin is 0.017 PPn (D7 = 0.4673), and west is *last* on the repairMoves honesty proxy (60 moves) — both irrelevant to the CO selection, both load-bearing at scale.

### Independent verification fleet

| Review | Verdict | Final status for this gate |
|---|---|---|
| Results skeptic (re-derived pop from raw Census DBF, no `src/`) | PASS, exact | **PASS** — 5/5 checks; Σ = 5,773,714 resident, matches PR-1/V1 |
| Code review (scale / latent determinism / edge cases) | FAIL — 3 BLOCKER + 4 MAJOR | **ADDRESSED, NOT RE-REVIEWED** (see below) |
| Devil's advocate (inference: CO win → scale-ready) | DEFENSIBLE WITH CAVEATS + 8 preconditions | **CONDITIONALLY PASS** — defensible *as a CO selection A/B*, not as a scale verdict |
| Visual QA (maps) | PASS WITH NOTES | **PASS** — HIGH SRI + MEDIUM "undefined" FIXED & re-rendered (FL-007); LOW sliver note stands |

### Code-review blockers/majors — fix-and-reverify ledger

Per the orchestrator's standing record (FL-006 / PR-4) every BLOCKER and MAJOR was fixed; the full CO pipeline re-ran with **byte-identical assignment SHAs** and all 5 mechanical verifiers green; at-large WY exits 0. The original review was never re-run against the patched tree.

| ID | Finding | Fix landed | Re-verified at scale? |
|---|---|---|---|
| B1 | `Math.min(...component)` stack overflow >130k (repair.js) | loop-min everywhere | **NO** — CO single-component never fires it |
| B2 | same spread in geo.js hole dissolve | one-pass hoisted ring bbox | **NO** — CO has no holed districts |
| B3 | at-large states (AK/DE/ND/SD/VT/WY) no CLI path → batch aborts | at-large branch (CC-1, INTERFACES) | **PARTIAL** — at-large WY exits 0; only 1 of 6 run |
| M1 | `donorStaysConnected` full-grid flood per candidate | incremental per-district cell Sets | **NO** — not exercised at TX/CA n |
| M2 | bridge search pairwise O(\|minor\|·\|main\|) | boundary-only bridge search | **NO** — CO has zero bridges |
| M3 | splitline `cutLen` O(keys·cells)/node | edge-bucket sweep | **NO** — winner is accretion, not splitline |
| M4 | splitline recursion on ≤s-cell / empty region | ≤s-cells split guard | **NO** — degenerate regions unreached on CO |
| m1–m5, n1–n3 | minor/nit (contract drift, lazy min, shapefile cache, positive determinism note) | per ledger / accepted | low-risk; defer to BUILD-ON-ARRIVAL |

**Net:** the fixes are mechanical, localized, and the determinism contract survived them (byte-identical SHA is strong evidence the edits did not perturb the CO output path). But **every fixed path except at-large-WY remains unexercised** — fixed-and-green-on-CO is not the same as exercised-on-the-state-that-triggers-it. This is the exact PR-4 lesson, restated.

### Phase-0 data integrity (precondition spine for any run)

| Check | Status |
|---|---|
| V1 exact pop conservation (blocks→cells→districts→resident total) | **PASS** (skeptic confirmed, CO) |
| PR-1 resident-not-apportionment | **PASS** (5,773,714 used; FL-001 closed) |
| 48 remaining states' resident pop CONFIRMED in `research/verdicts.json` | **OPEN** — enforced per-state by `requireState`; condition (d) |

---

## 2. Decision

# GO WITH CONDITIONS

**Five conditions, all gating before the national batch (count: 5).**

The engine is determinism-clean, population-exact, and internally consistent on Colorado — independently re-derived from raw Census, byte-identical across runs. The three crash BLOCKERs and four scale MAJORs are fixed and the patched pipeline reproduces CO bit-for-bit. That is enough to authorize *continued scale-up work* but **not** enough to release a 50-state batch, because Colorado is structurally the easy case on every axis that matters at scale (single component, no holes, convex near-rectangle, 8 seats, not at-large). It tested **zero** sealing events, **zero** bridges, **zero** holes, and 1 of 6 at-large states. The fixes for those paths are therefore *fixed-but-unexercised*. The shakeout is the gate the protocol promised; it is not optional, and CO does not substitute for it.

Why not NO-GO: nothing found is a correctness defect in the shipped CO map or a determinism violation; the failures are all *coverage gaps*, addressable by running the states that exercise the paths. Why not unconditional GO: releasing 50 states would fire B1/B2/M1–M4 and the sealing path for the first time in production, against the panel's unanimous #1 risk, with no rollback. Conditions convert the gap into a bounded, pre-committed test sequence.

### Conditions (must ALL clear before the national batch)

**(a) MD + FL + NY shakeout, full mechanical gauntlet (G1–G4 + V1–V6), must PASS before the national batch — ADOPTED, hard gate.**
This is the protocol's own Phase-4 GO condition (`ab-metrics.md` §Scope), not an add-on. These three exercise what CO could not: MD (Chesapeake concavity → sealing cascade, aspect>2 by coastline), FL (panhandle ribbon + Keys islands/bridges + hot/sparse absorb), NY (Long Island / Manhattan / Staten Island bridges + dense hot cells). Required outcome on each: all four gates pass, irregular ≤ 4, deviation ≤ national ±2% (NY flagged-not-failed per V3). A shakeout gate failure **reopens `ab-metrics.md`** with that state added to the scoring set (per the frozen fallback) — it does not get hand-patched mid-run.

**(b) Targeted re-review / synthetic tests of the fixed paths before trusting them — ADOPTED (merged with PR-4), hard gate, runs WITH (a).**
Byte-identical CO SHA proves the fixes did not break the *exercised* path; it proves nothing about the *unexercised* ones. Per PR-4, every branch CO never enters needs a synthetic test or explicit review before scale. Concretely: synthetic multi-component fixture (B1/M1/M2), holed-district fixture (B2), degenerate ≤s-cell region (M4), and the remaining **five** at-large states beyond WY (B3 — run AK/DE/ND/SD/VT, confirm exit 0 + the CC-1 artifact shape). The shakeout (a) covers real-data triggers; (b) covers the paths even MD/FL/NY may not hit (holes, degenerate regions, the other 5 at-large). Adopt as one combined "fixed-path proof" gate.

**(c) Devil's advocate's 8 preconditions — disposition below (3 ADOPTED as gates, 4 MERGED, 1 ADOPTED-as-framing):**

1. **Run MD+FL+NY shakeout, irregular ≤4.** → **MERGE into condition (a).** Same gate.
2. **Emit `sealed_<arm>.log` unconditionally; require ≥1 shakeout state where sealing fires and still passes gates.** → **ADOPT as a gate.** The panel's unanimous #1 risk has 0% CO coverage; "zero sealing" must become an *asserted* `[]` not an inferred missing file, and the seal-then-repair path must execute at least once and survive. Cheap, decisive, closes the loudest finding.
3. **Add real PPn margin / hysteresis so a 0.017 jitter can't reorder arms.** → **MERGE into (a) as an observation, do NOT gate on a redefined metric.** Changing the ranking function now violates the anti-metric-shopping rule (locked pre-pilot). Instead: *report* each shakeout state's minimum-district PPn and flag if the winner's margin stays <0.05; treat a sign-flip across shakeout states as a shakeout failure (→ reopen protocol). Metric redefinition, if any, is a separate human decision, not a Phase-4 silent edit.
4. **Score compactness on the pre-rebalance map; bound repairMoves on concave states.** → **ADOPT, downgraded to a reported diagnostic, not a hard gate.** west enters as the arm most dependent on repair (60 moves) on the axis most geography-sensitive. Emit pre-rebalance PPn + repairMoves per shakeout state; if repairMoves scales pathologically (say >300 on any single shakeout state) that is a shakeout flag for human review, not an auto-fail — population equality via repair is by design (FL-004).
5. **Fix/cap the last-district absorb before it meets a coastline.** → **MERGE into (a) as an acceptance check.** Centroid D8 = 62.6% of CO cells at PPn 0.181 is the warning shot, but centroid is **not** the selected arm — west's absorb (D8 28k, D1 41k) stayed merely-bad. Do not re-architect the absorb pre-shakeout; instead add an acceptance check on FL/NY that no single district exceeds ~25% of state cells with PPn<0.45. If FL/NY trips it, that is a shakeout failure → reopen, and *then* shape the absorb.
6. **Bridge-bearing districts exercised and pass (contiguity + PPn≥0.45).** → **MERGE into (a).** FL Keys / NY Long Island are the bridge tests; covered by the shakeout. (M2's boundary-only bridge fix is also first-exercised here — ties to (b).)
7. **Add a sealing / repair-honesty term to the ranking, or a hard gate.** → **STRIKE as a Phase-4 action; defer to a post-shakeout human decision.** The ranking is frozen (anti-metric-shopping); adding a term now is exactly the gaming PR-3/ab-metrics forbid. The *substance* is captured by precondition 2 (sealing must fire and pass) and diagnostic 4 (repair honesty reported). If the shakeout shows the metric is blind to a real failure, that is a finding for David + a protocol reopen — not a Phase-4 edit.
8. **Restate the headline "selection-A/B winner on CO; 50-state readiness pending shakeout."** → **ADOPT as framing (this document's stance).** Nothing here claims CO proved scale-readiness. The winner statement (§3) is scoped exactly this way.

**(d) Resident populations for the remaining 48 states verified as Phase-0 CONFIRMED claims before each state runs — ADOPTED, already enforced.**
Per CLAUDE.md hard-rule 1 + PR-1, no unverified figure enters `src/`; the engine's `requireState` blocks any state whose resident total is not CONFIRMED in `research/verdicts.json`. Condition: complete the Phase-0 confirmation sweep for all 48 (resident PL 94-171 totals + seat counts + the six at-large flags) and confirm `requireState` hard-fails on a missing/unverified entry. This is a standing gate the engine already enforces — the condition is to *finish the data* and prove the guard fires, not to add machinery.

### Sequence the human gate is authorizing
1. Finish Phase-0 confirmation for 48 states (d) + the fixed-path proof gate (b).
2. Run MD+FL+NY shakeout, full gauntlet (a), with `sealed_*.log` unconditional and ≥1 sealing event surviving (c-2); report PPn margin (c-3), pre-rebalance/repairMoves (c-4), absorb share (c-5).
3. **All clear → release the 50-state batch.** Any shakeout gate failure → reopen `ab-metrics.md` with that state added; do not improvise.

---

## 3. Winner Statement

**accretion-west is the selected traversal arm — chosen mechanically**, not by judgment: it took ranking key 1 (1 irregular district vs centroid's 2 and splitline's 5), which legally short-circuits the lexicographic comparison; it also leads key 2 (mean PPn 0.6107). All four eligibility gates pass; the result is byte-reproducible (`7bbedaa0…77e3`) and independently re-derived from raw Census. This selection stands on Colorado; **it is the winner of the selection A/B, not a certified 50-state map** (per condition (a)/(c-8)).

**The accretion-centroid arm — David's center-outward vision (S3 re-seeded from the state centroid, the literal "start in the middle, grow up/down/left/right") — is RETAINED as a first-class arm in every future run.** It is the vision arm; the consensus panel created it specifically to honor both vision clauses (4/5 evaluators), and Visual QA confirmed it seeds D1 at the geographic center (~8 mi off true). It costs one CLI flag to keep. **Keeping it is the default; killing it requires David's explicit say-so, not the synthesizer's.** Its known weakness (D8 absorb = 62.6% of CO cells, PPn 0.181) is a reason to *fix the absorb*, not to drop the arm. splitline remains as the baseline/contrast arm; S4 Hilbert stays in reserve as the robustness fallback if the shakeout sinks accretion (per the consensus dissent register).

---

## 4. Residual Risks — open even after all conditions are met

1. **The 50-state long tail is untested by construction.** Shakeout covers MD/FL/NY (sealing, islands, hot cells, concavity). It does **not** cover every pathology: TX/CA raw scale (M1/M3 hot paths, ~607k/many-cell grids — first true stress even after the fixes), MI UP/LP and HI multi-island bridge density beyond FL/NY, and IL/NJ flagged-deviation states. The first national batch is still the first time those specific geographies run end-to-end.
2. **Photo-finish selection margin.** The winner leads key 1 by a single near-cliff district (D7 PPn 0.4673, 0.017 above the 0.45 line). The frozen metric has no hysteresis (c-3 is reported, not gated). A different state's geometry could legitimately reorder arms — but the protocol locks the CO selection, so a later state cannot retroactively change *which arm runs*; it can only trigger a documented reopen. Risk: the shipped national arm may not be per-state optimal, by design.
3. **Repair-dependence of the winner.** accretion-west needed 60 rebalance moves (3× the runner-up) and ranks worst on the honesty proxy. Repair reshapes boundary cells, which moves the very compactness numbers that decide irregularity. On concave states repairMoves is expected to climb; bounded only by the strict-decrease termination invariant (repair.js m3), not a hard cap. A future edit that admits a delta=0 move into the candidate set breaks termination — fragile invariant flagged for the maintainer.
4. **Last-district absorb is a single point of failure that scales with sparse-area fraction.** Even with the FL/NY acceptance check (c-5), the absorb has no shape control by design; a state with large *disconnected* sparse leftovers hands a big orphan-repair bill to Pass-1. Mitigated, not eliminated, until the absorb is made a shaped accretion target (deferred to BUILD-ON-ARRIVAL).
5. **Fixed-but-thinly-exercised paths.** Even after synthetic tests (b), synthetic fixtures are not real-state geometry; B1/B2/M1–M4 are validated against constructed inputs and at-large against 6 trivially-small states, not against the full distribution of real component shapes/hole topologies. Confidence is high (mechanical, localized fixes; determinism preserved) but not the same as production-exercised.
6. **Minor contract drift unresolved.** m1 (geojson properties emit bboxAspect/bboxFill beyond the enumerated INTERFACES list), n2 (`sealed_<arm>.log` undocumented in the contract — partly addressed by c-2 making it unconditional), and the LOW small-cell-sliver note (Visual QA: D5/D6 at 121–401 cells) remain open. None block; each is a contract-completeness item for the national run's doc pass.
7. **Determinism is necessary, not sufficient.** G3/V5 prove reproducibility; a deterministically-wrong map at scale is still wrong and would reproduce its own error byte-for-byte. The shakeout is the only thing testing *correctness across geographies*; outside MD/FL/NY that property is asserted by analogy, not measured.

---

Reviewed by: __________  Date: __________
