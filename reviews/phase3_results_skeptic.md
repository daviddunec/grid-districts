# Phase 3 Independent Skeptic Results — accretion-west, Colorado

**Re-derived independently.** No code from `src/` or `scripts/verify/` was read or imported.

**Date:** 2026-06-10T13:35:02.265Z

## Per-District Population Table

| District | Derived-A (DBF→cell_blocks→csv-district) | Derived-B (CSV pop col) | Reported (stats JSON) | A==B | A==Reported |
|----------|------------------------------------------|-------------------------|-----------------------|------|-------------|
| 1 | 721,845 | 721,845 | 721,845 | YES | YES |
| 2 | 721,728 | 721,728 | 721,728 | YES | YES |
| 3 | 721,714 | 721,714 | 721,714 | YES | YES |
| 4 | 721,706 | 721,706 | 721,706 | YES | YES |
| 5 | 721,689 | 721,689 | 721,689 | YES | YES |
| 6 | 721,606 | 721,606 | 721,606 | YES | YES |
| 7 | 721,712 | 721,712 | 721,712 | YES | YES |
| 8 | 721,714 | 721,714 | 721,714 | YES | YES |

**Total (Derived-A):** 5,773,714  
**Total (Derived-B):** 5,773,714  
**Expected (meta.residentPop):** 5,773,714

## Five Checks

| # | Check | Result |
|---|-------|--------|
| A | Every populated cell in `cell_blocks.json` appears in the CSV | **PASS** |
| B | CSV `pop` column equals sum of its blocks' POP20 from DBF, for every populated cell | **PASS** (0 mismatches) |
| C | No GEOID20 appears in two different cells | **PASS** (0 duplicates) |
| D | Both derivations sum to exactly 5,773,714 | **PASS** (A=5,773,714, B=5,773,714) |
| E | Per-district populations match `stats_accretion-west.json` | **PASS** (0 district mismatches) |

## Verdict

**VERDICT: PASS**

All five independent checks passed. The reported per-district populations in `stats_accretion-west.json` are consistent with the raw Census DBF (tl_2020_08_tabblock20.dbf) summed through `cell_blocks.json`, and both derivations sum to the correct Colorado resident population of 5,773,714.

### Per-District One-Line Summary

- District 1: **721,845** — matches reported 721,845, deviation 0.0181% from ideal 721,714.25
- District 2: **721,728** — matches reported 721,728, deviation 0.0019% from ideal 721,714.25
- District 3: **721,714** — matches reported 721,714, deviation -0.0000% from ideal 721,714.25
- District 4: **721,706** — matches reported 721,706, deviation -0.0011% from ideal 721,714.25
- District 5: **721,689** — matches reported 721,689, deviation -0.0035% from ideal 721,714.25
- District 6: **721,606** — matches reported 721,606, deviation -0.0150% from ideal 721,714.25
- District 7: **721,712** — matches reported 721,712, deviation -0.0003% from ideal 721,714.25
- District 8: **721,714** — matches reported 721,714, deviation -0.0000% from ideal 721,714.25

---
*Script: reviews/skeptic_rederive.mjs — imports only node built-ins + shapefile dist CJS*
