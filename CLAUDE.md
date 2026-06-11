# Redistricting Engine — Project Conventions

Deterministic grid-walk congressional redistricting: 1-mi² (640-acre) cells over an equal-area grid, walked up/down/left/right, accumulating 2020 census block population into equal-population districts. **One identical process per state.** Goal: maximize square/regular districts; ≤2–4 irregular leftover districts per state.

Full build plan: `C:/Users/david/.claude/plans/what-i-m-looking-to-quirky-hartmanis.md`

## Environment
Windows 11 + Git Bash. **Node v24 only — no Python, no sqlite3 CLI.** POSIX/bash syntax, forward slashes in all JS paths, quote paths with spaces. Deps: `shapefile`, `proj4`, `adm-zip`, `@turf/boolean-point-in-polygon` — nothing else without a logged reason.

## Hard rules (violations → FAILURE-LOG entry)

1. **Unverified values are never hardcoded into `src/`.** Every external fact (URL, DBF field name, population figure, seat count) must be CONFIRMED in `research/verdicts.json` or it lives in `research/UNVERIFIED.md` and stays out of code.
2. **RESIDENT population, never apportionment population.** PL 94-171 resident totals are what Σ POP20 sums to (CO: 5,773,714). Apportionment figures include overseas personnel (CO: 5,782,171) and will make exact-sum gates unpassable. (FL-001)
3. **Determinism everywhere.** No `Date.now()`, no `Math.random()`, no Map/object iteration-order dependence, no locale-dependent sorts. Every tie-break names an explicit sort key (row, then col). Hashed CSVs are written LF-only, UTF-8 no BOM, fixed integer formatting.
4. **DBF-only parse.** Never load TABBLOCK20 block geometry (`.shp`) — population + internal points come from the `.dbf`. `INTPTLAT20`/`INTPTLON20` are signed strings → `parseFloat`.
5. **Point-in-polygon runs entirely in lon/lat.** Inverse-project cell centers before testing against the (unprojected) boundary. turf is CRS-agnostic — mixed frames return garbage silently.
6. **proj4 knows nothing by name.** Register EPSG:5070 / EPSG:3338 / HI-Albers strings via `proj4.defs()` in `src/constants.js` before first use.
7. **Skills/commands are created only after Phase-4 GO.** Encoding the pipeline into a repeatable command before the gauntlet passes freezes bugs into the path.
8. **FAILURE-LOG.md is append-only and orchestrator-written.** Sub-agents report findings; they never write the log.

## Prevention Rules (promoted from FAILURE-LOG)

- **PR-1 (from FL-001):** Any check of the form `Σ POP20 === <state total>` must target the PL 94-171 **resident** population. When adding a state constant, record both figures and label them.
- **PR-2 (from FL-002):** Workflow scripts may only use core JS built-ins. No `URL`, `fetch`, `Date.now`, `Math.random`, or environment globals — a silently-failing global collapses fan-out logic into degenerate paths. Use plain string ops and verify group counts in `log()` output.
- **PR-3 (from FL-003):** Blind-panel inputs must pass three checks before freeze: criteria are pairwise orthogonal (correlated pair = one criterion double-counted); outcome claims labeled PREDICTED unless measured; every option described with the same template and claim-count budget.
- **PR-4 (from FL-006):** A well-behaved pilot cannot exercise failure paths. Every branch the pilot never enters (multi-component, holes, at-large, degenerate regions) needs a synthetic test or explicit review before scale-up. `Math.min/max(...spread)` is banned on arrays that scale with state size (V8 stack limit ~130k).
- **PR-5 (from FL-008):** A greedy accumulator must never finalize below target while supply remains. Every "give up locally" branch (sealed frontier, dead end) needs a "continue globally" continuation (re-seed and keep accumulating), never a close.
- **PR-6 (from FL-009):** Partition balancing is graph flow, not local swaps. Strictly-improving local moves cannot fix non-adjacent imbalances or cross zero-weight corridors — any balancing pass needs flow-along-paths with journaled rollback.
- **PR-7 (from FL-011):** When successive local patches each relocate a failure instead of shrinking it, the defect is one level up. Stop patching, escalate the design question (here: the accretion remainder problem → hybrid-finish consensus round).

## Verification gates (all must pass before a state ships)
V1 exact `===` population conservation (blocks → cells → districts → published resident total) · V2 every in-state cell assigned exactly once · V3 deviation ≤ gate (CO ±1%, national ±2%; NY/CA/IL/NJ flagged-not-failed) · V4 one connected component per district (virtual bridges count) · V5 SHA-256 identical across double run + shuffled-input run · V6 Phase-0 probe (DBF fields present, exact resident-pop sum).
