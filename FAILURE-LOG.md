# FAILURE LOG — append-only, orchestrator is the sole writer

Format per entry:

```
## FL-NNN — <symptom> (<date>, <phase>)
- **Symptom:**
- **Root cause:**
- **Fix:**
- **Prevention rule:**
- **Promoted:** yes → CLAUDE.md PR-N | no (incident-local)
```

Entries are written on: any mechanical verifier FAIL, any agent crash/timeout/malformed schema output, any adversarial verdict of FAIL / NOT DEFENSIBLE, any user correction. Same symptom firing twice → STOP and surface to David (recurrence brake).

---

## FL-001 — Resident vs apportionment population mismatch (2026-06-10, Phase 0, pre-seeded)
- **Symptom:** `Σ POP20 === state total` gate fails on a correct download.
- **Root cause:** 2020 apportionment population includes overseas federal personnel (CO: 5,782,171); census blocks sum to the PL 94-171 **resident** population (CO: 5,773,714). Hardcoding the apportionment figure makes the exact-equality gate unpassable.
- **Fix:** `src/constants.js` stores resident population as the verification target; apportionment figure stored separately, labeled, never used in gates.
- **Prevention rule:** Any exact-sum population check targets PL 94-171 resident population. Record both figures per state, labeled.
- **Promoted:** yes → CLAUDE.md PR-1

## FL-002 — Phase-0 verifier fan-out collapsed to one source group (2026-06-10, Phase 0)
- **Symptom:** Workflow log shows "1 source groups to verify" instead of ~10–15; one verifier agent handled all 37 claims.
- **Root cause:** The workflow script grouped claims with `new URL(c.source_url)` inside a try/catch; the `URL` constructor appears unavailable (or threw) in the Workflow sandbox, so every claim fell to the `unknown-source` bucket.
- **Fix:** None required for results — the verifier still returned one fetched-evidence verdict row per claim (per-claim standard intact, 35/37 CONFIRMED). Future workflows parse hostnames with plain string ops (`split('/')`), not web globals.
- **Prevention rule:** Workflow scripts may only rely on core JS built-ins (JSON, Math, Array, String). No `URL`, `fetch`, `Date.now`, `Math.random`, or other environment globals — test grouping logic degradation paths.
- **Promoted:** yes → CLAUDE.md PR-2

## FL-003 — Consensus fact packet failed red-team: REWRITE REQUIRED (2026-06-10, Phase 1)
- **Symptom:** Opus red-team returned 16 findings, 1 FATAL: scoring criteria `squareness` and `irregular_district_risk` were near-inverses, double-weighting squareness to ~40% and structurally pre-deciding an S3 win; plus framing asymmetry (S3 sold in present-tense benefits, S1/S2 net-negative, S5 weaknesses omitted entirely) and predicted outcomes labeled as confirmed facts.
- **Root cause:** Packet author (orchestrator) wrote criteria from the project's own goal statement without checking criteria orthogonality, and let the algorithm-plan's predictions leak into the packet as facts.
- **Fix:** Packet v2 — merged the duplicate criteria pair; decomposed vision_fidelity into two explicit sub-criteria; normalized all five strategies to one balanced template (mechanism / ≤2 predicted strengths / ≤2 predicted weaknesses / repair load) in predictive voice; demoted implementation complexity to tiebreaker; scoped "CONFIRMED" to probe-measured inputs only.
- **Prevention rule:** Before any blind panel: (a) check criteria pairwise for correlation — two criteria that move together are one criterion counted twice; (b) every outcome claim in a fact packet must be labeled PREDICTED unless it was measured; (c) all options described with the same template and claim-count budget.
- **Promoted:** yes → CLAUDE.md PR-3

## FL-004 — Splitline district reduced to 5 people after repair (2026-06-10, Phase 2)
- **Symptom:** First CO run: splitline D5 = 5 pop / 2 cells (dev −99.999%), D6 = 1,435,194 (dev +98.9%); accretion arms unaffected.
- **Root cause:** Repair kept the component containing the district's *anchor* (min cell index). Splitline's D5 fractured into a 2-cell fragment that happened to contain the anchor and a 2,280-cell / ~717k-person main body — repair kept the fragment and dumped the main body into D6. Rebalance can't move 713k people cell-by-cell.
- **Fix:** `src/repair.js` keeps the component with the most **population** (tie: most cells, then min index). A district's identity is its people, not its first-assigned cell.
- **Prevention rule:** Any "keep one representative piece" rule must key on the quantity the gates measure (population), never on an incidental marker like first-assigned/min-index cell.
- **Promoted:** no (incident-local — the fix is structural in repair.js)

## FL-005 — Independent compactness verifier flagged 32 "mismatches" (2026-06-10, Phase 3a)
- **Symptom:** `score-compactness.js` reported MISMATCH on every float metric, all deltas ~1e-5.
- **Root cause:** `src/score.js` rounded stats floats to 4 decimals; INTERFACES.md promises 1e-9 comparison tolerance. Contract violation by the engine, not a math error — the independently-derived values agreed to within rounding.
- **Fix:** stats_<arm>.json now writes full-precision floats; verifier unchanged (it was enforcing the contract correctly).
- **Prevention rule:** When an interface declares a comparison tolerance, every producer must emit at least that precision. Never round in the artifact; round only at display time (renderers).
- **Promoted:** no (incident-local; the independence pattern worked exactly as designed — engine author's shortcut caught by the blind verifier)

## FL-006 — Code review: 3 BLOCKERs latent until non-Colorado states (2026-06-10, Phase 3b)
- **Symptom:** Opus code review verdict FAIL: (B1) `Math.min(...arr)` spreads in repair.js overflow the V8 stack at ~130k elements — TX/CA absorb components routinely exceed it; (B2) same spread pattern in geo.js hole-assignment; (B3) at-large states had NO cli.js path — the 50-state batch would abort on all six. Plus M1–M4 scale hot-spots (O(grid) connectivity checks per rebalance candidate, pairwise bridge search, O(keys×cells) splitline cutLen, empty-region recursion).
- **Root cause:** Colorado is the easy case on every axis (single component, no holes, small n, 8 seats, not at-large) — none of these paths execute on the pilot, so the mechanical gauntlet could not catch them.
- **Fix:** loop-based min everywhere; hoisted one-pass ring bboxes; at-large branch in cli.js (meta.json + exit 0, CC-1); incremental per-district cell Sets in rebalance; boundary-only bridge search; edge-bucket cutLen sweep; ≤s-cells split guard.
- **Prevention rule:** A pilot chosen for being well-behaved CANNOT exercise failure paths — every conditional branch that the pilot never enters (multi-component, holes, at-large, degenerate regions) needs either a synthetic test or an explicit review before scale-up. `Math.min/max(...spread)` is banned on arrays that scale with state size.
- **Promoted:** yes → CLAUDE.md PR-4

## FL-007 — Leaflet maps blank in browser; title shows "undefined" (2026-06-10, Phase 3b)
- **Symptom:** Visual-QA: all map_*.html render a black map — Leaflet CDN script blocked by a WRONG SRI integrity hash (`L is not defined`); headers read "CO — undefined".
- **Root cause:** (a) Renderer agent hardcoded an incorrect integrity hash from memory; browsers silently refuse the script. (b) Engine omitted the contractual `arm` field from stats_<arm>.json; the renderer read `stats.arm` → undefined.
- **Fix:** integrity attributes removed (CDN load without SRI); `districtStats` now writes `arm`.
- **Prevention rule:** Never hardcode an SRI hash from memory — omit it or compute it from the fetched file. Producers must emit every field the schema declares, even ones the producer itself never reads.
- **Promoted:** no (incident-local)

## FL-008 — Sealing cascade on Maryland: accretion districts starved to 0 pop (2026-06-10, Phase 5 shakeout)
- **Symptom:** MD first run: accretion-west maxDev=100% (a ~0-pop district), centroid 75.7%, 37–39 orphan components; the exact failure mode all 5 panel evaluators + the devil's advocate predicted and Colorado structurally could not test. Splitline passed MD (1.05%).
- **Root cause:** Two compounding rules: (1) "empty frontier → close early" let Chesapeake-pocket districts close with a fraction of target; (2) rebalance only moves cells with delta ≤ −1, so zero-pop cells never move — population cannot tunnel through empty shore cells into a starved district.
- **Fix:** Seal → RE-SEED: a sealed district keeps its accumulated population and continues growing from the next unassigned seed in sweep order (bbox/Chebyshev reset per pocket). No district can close under target while unassigned cells remain. This completes the spec's own contract ("repair handles the pop shortfall") rather than changing the strategy's objective.
- **Prevention rule:** A greedy accumulator must never finalize below target while supply remains — every "give up locally" branch needs a "continue globally" continuation, not a close.
- **Promoted:** yes → CLAUDE.md PR-5 (and validates PR-4: the pilot couldn't reach this path; the shakeout state existed precisely to find it)

## FL-009 — Rebalance is a graph-flow problem, not a local-swap problem (2026-06-10, Phase 5 shakeout)
- **Symptom:** FL all arms >2% deviation; single-cell rebalance stalls at 9–64 moves with 16–38% deviation left. Three escalating causes found: (a) zero-pop cells never satisfy delta ≤ −1, so population can't cross water/empty corridors; (b) over- and under-populated districts often aren't adjacent — flow must pass THROUGH balanced intermediaries, which strictly-improving local moves forbid; (c) one-cell-wide isthmus donors (FL Keys) fail every connectivity check, deadlocking transfers.
- **Fix (pass 3 in repair.js):** chain-flow rebalance — worst-over → worst-under BFS path on the district adjacency graph; atomic connected-blob transfers per hop (greedy-cut sizing, halving retry); alternate-path retry with per-link edge bans; fragmenting fallback with inline orphan reattachment for isthmus donors; everything journaled with round-level revert if the worst deviation doesn't strictly improve.
- **Prevention rule:** Local strictly-improving moves cannot fix non-adjacent imbalances or cross zero-weight regions. Any partition-balancing pass needs an explicit flow-along-paths mechanism with rollback, not just local swaps.
- **Promoted:** yes → CLAUDE.md PR-6
- **Outcome:** FL-west 3.13%→0.107% PASS; MD-splitline 1.05%→0.281% PASS; FL-splitline 32%→0.855% PASS; MD-west 25.7%→3.86% (improved, still fails); FL-centroid unchanged 36.96% (every pass-3 round reverts — extraction from the Keys-area district always creates a new worst). Residual failures are repair-architecture limits, not traversal-rule failures.

## FL-010 — Negative rebalanceMoves stat after round revert (2026-06-10, Phase 5 shakeout)
- **Symptom:** MD hilbert reported `rebalance:-416`.
- **Root cause:** Fragmenting-fallback journaled its orphan-cleanup moves without incrementing the stat; round revert decrements per journaled move → asymmetric counting going negative.
- **Fix:** orphan-cleanup moves now increment the stat (symmetric with revert).
- **Prevention rule:** Any journaled-undo system must increment/decrement the SAME counters through the SAME journal — never count on apply-paths that bypass the journal's accounting.
- **Promoted:** no (incident-local)

## FL-011 — Repair patches now redistribute failures instead of eliminating them (2026-06-10, Phase 5)
- **Symptom:** Pop-aware orphan splitting fixed MD-centroid (0.297→0.082%) but regressed FL-west (0.107→7.95%) and NY-west (2.84→6.28%). Sequence of five repair upgrades (seal-reseed, corridor moves, chain flow, fragmenting fallback, orphan splitting) each fixed one state-arm and shifted the failure elsewhere. West-MD sits at 2.044% vs the 2.0 gate.
- **Root cause (structural):** The accretion arms' residual deviations all originate in the far-flung REMAINDER problem — the last district absorbs whatever geography remains (panhandle + Keys + coastal fragments simultaneously), and no amount of post-hoc cell rebalancing can cleanly redistribute a multi-pocket 800k-person remainder through narrow coastal corridors. Splitline never has this problem because it balances BEFORE assigning, top-down.
- **Fix:** None applied — STOPPED per the re-plan rule. The fix is strategy-level, not repair-level: e.g., accretion for districts 1..n−k, splitline finish for the last k remainder seats ("hybrid finish"), or remainder-aware seeding. That design change deserves a focused consensus round, not a midnight hack.
- **Prevention rule:** When successive local patches each move a failure to a new location instead of shrinking it, the defect is one level up (architecture/strategy). Stop patching, escalate the design question.
- **Promoted:** yes → CLAUDE.md PR-7
- **State of the code:** splitting KEPT (net win for the vision arm: MD 0.082%, NY 3.42%, CO 0.024%; its only failure is FL's remainder problem). All arms remain deterministic and contiguous everywhere; CO byte-identical throughout.

## FL-012 — Production ledger recorded v-pop:FAIL for FL/MD/NY while their production maps were clean (2026-06-10, congressional-report QC)
- **Symptom:** Adversarial report review found `data/states.json` showing `v_pop:false` for FL, MD, NY — directly contradicting the report's "clean" labels and the exact-identity narrative. Verdict NOT PUBLISHABLE on this alone.
- **Root cause:** The independent population verifier audited EVERY `assign_*.csv` in a state's folder — including research-arm artifacts left over from the shakeout (e.g., centroid-FL at 37%) — with a hardcoded ±1% pilot gate, then the batch runner recorded that mixed verdict as the state's production status. The production (splitline) maps themselves passed every gate; the build-time exact-sum identity (V1) was never violated in any state.
- **Fix:** Verifiers accept `--arm` scoping and the real gate policy (`--gate`, `--flag-not-fail` for NY/CA/IL/NJ per ab-metrics); the batch runner passes production-arm scope; `scripts/refresh-verifier-ledger.js` re-ran all states (3 changed, zero failures remain); report prose corrected to disclose the episode rather than hide it.
- **Prevention rule:** A status ledger must record the verdict of the artifact it claims to describe — never an aggregate over unrelated artifacts sharing a folder. Verifiers need explicit scope parameters the moment more than one artifact variant exists.
- **Promoted:** yes → CLAUDE.md PR-8
