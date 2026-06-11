# Site Fact-Check Review — Per-Claim Verification

**Lens:** FACT-CHECK. A claim is CONFIRMED only if verified against the named engine artifact (or, for external facts, the public record). Snippet plausibility ≠ confirmation.
**Pages reviewed:** `site/index.html`, `site/how-it-works.html`, `site/faq.html`, `site/about.html`, `site/state/TX.html`, `site/state/NY.html`, `site/state/WY.html`
**Artifacts used:** `src/constants.js`, `data/states.json`, `out/CO/{stats_splitline.json,meta.json,grid.json}`, `out/TX/stats_splitline.json`, `out/NY/{stats_splitline.json,grid.json}`, `out/HI/stats_splitline.json`, `out/*/history/*/stats.json` (348 files), `FAILURE-LOG.md`, `site/data/demo-cuts-CO.json`, `site/report.html`, `cli.js`, `scripts/*`
**Date:** 2026-06-11

---

## FINDINGS

### F1 — FATAL — The "one square mile holds more than a district's share" claim is false by ~5–6x, and the project's own grid data disproves it

**Where (4 pages, same claim):**
- `site/index.html` line ~139 ("One state is flagged" card): *"New York's densest city blocks hold more people in one square mile than a whole district's share elsewhere"*
- `site/faq.html` line ~35: *"In Manhattan, one square mile can hold more people than an entire district's equal share — no one-square-mile map can split that crowd."*
- `site/how-it-works.html` line ~76: *"In New York, a single square mile can hold more people than a district's equal share"*
- `site/state/NY.html` line 30 (flagged callout): *"New York's densest city blocks pack more people into one square mile than a whole district's share elsewhere"*

**What the engine artifact says:** `out/NY/grid.json` — the maximum population of any one-square-mile cell in New York is **121,272** (top 5 cells: 121,272 / 113,384 / 103,393 / 100,431 / 93,735; only 4 cells exceed 100k; zero cells exceed 300k).
- NY's equal district share = 20,201,249 / 26 = **776,971**. The densest cell is **15.6%** of a share, not "more than" one.
- The smallest equal share in any state is MT at **542,113** (`src/constants.js`) — still 4.5x the densest NYC cell.
- The claim is also internally impossible: if a single indivisible cell exceeded a full share, NY's worst deviation could not be the 4.08% the same pages report — it would be enormous.

**Why FATAL:** This is the site's *stated explanation* for its only flagged state, repeated on four pages, in vivid quotable form. It is contradicted by the project's own published data. The entire pitch is "re-derive any number yourself"; the first journalist who checks Manhattan's density (~74k/sq mi borough-wide, peak ~120–150k/sq mi) will find the claim absurd and discredit the rest of the site.

**Fix:** State the true mechanism: a one-square-mile cell in Manhattan can hold **over 120,000 people — roughly a sixth of a whole district's share — and the rule never splits a square**, so cuts near those cells can't fine-tune population, leaving NY's worst district 4.08% off. (Verify the 121,272 figure from `out/NY/grid.json` before publishing.)

---

### F2 — MAJOR — Defect-log count is wrong on the site, and three shipped surfaces give three different numbers

**Where:**
- `site/index.html` line ~143: *"a public defect log — 13 issues so far, each with its root cause and fix"*
- `site/about.html` line ~43: *"a public defect log — 13 issues so far, each with root cause and fix"*
- `site/report.html` (executive summary): *"a published defect log (eleven issues, each with root cause and fix)"*

**What the artifact says:** `FAILURE-LOG.md` contains **12 real entries** (FL-001 … FL-012). There are 13 lines matching `^## FL-`, but one is the placeholder template header `## FL-NNN — <symptom> (<date>, <phase>)`, which has no root cause or fix. The report shipped alongside says **eleven**. So the project simultaneously publishes 13, 11, and (actually) 12.

**Why MAJOR:** The defect log is the site's honesty credential ("we publish our mistakes"). Anyone who opens `FAILURE-LOG.md` and counts gets 12, sees the site say 13 and the report say 11, and concludes the project can't even count its own mistakes — exactly the wrong impression for a "re-derive any number" project.

**Fix:** State **12** on `index.html` and `about.html`; update `report.html` from "eleven" to twelve; ideally have the site generator count `^## FL-\d` entries (excluding the `FL-NNN` template) at build time so it never drifts again.

---

### F3 — MAJOR — "Block-level data doesn't exist digitally before 2000" is factually wrong (1990 block data exists), and the state pages' "person-by-person data" phrasing is doubly wrong

**Where:**
- `site/about.html` lines 27–28: *"Block-level data doesn't exist digitally before 2000, so historical maps scale the 2020 settlement pattern…"*
- `site/state/TX.html`, `site/state/NY.html`, `site/state/WY.html` line 31 (identical callout on all state pages): *"…the 2020 settlement pattern scaled to match (person-by-person data before 2000 was never digitized)"*

**What the public record says:** The 1990 Census published block-level population counts digitally — the 1990 PL 94-171 redistricting files and STF 1B are block-level, and NHGIS distributes complete 1990 block data today. 1990 was the first census with *nationwide* digital block coverage, so the defensible cutoff is "before 1990," not "before 2000." Separately, "person-by-person data" is wrong in kind: the Census Bureau never publishes person-level records at all (72-year rule); the relevant unit is the block.

**Why MAJOR:** This is the factual justification for the entire 1950–2010 historical methodology. A demographer or census-data journalist will spot it immediately. (It also quietly raises the question "why didn't you use real 1990/2000 block data for those decades?" — which deserves an honest answer, e.g., methodological consistency across all seven decades.)

**Fix:** about.html: *"Complete digital block-level data only exists from 1990 onward, so for consistency the historical demonstration uses official county totals for every decade, scaling the 2020 settlement pattern…"* State pages: replace "person-by-person data before 2000 was never digitized" with "full block-level digital data isn't available for most of this period."

---

### F4 — MAJOR — Hero stat calls 330,759,736 "the official census total," which fails the naive check by 689,545

**Where:** `site/index.html` line 32 (hero stats band): *"330,759,736 people — each counted exactly once, matching the official census total to the last digit"*

**What the artifacts say:** Sum of `RESIDENT_POP` over 50 states in `src/constants.js` = **330,759,736 exactly** (CONFIRMED), and 435 = sum of `SEATS` (CONFIRMED). But "the official census total" of the United States is **331,449,281** (includes DC's 689,545; the site's own `report.html` states this correctly: "Columbia (689,545) yields 331,449,281 — exactly the published total resident population"). The hero stat omits the qualifier that `about.html` ("official 50-state resident population") and `how-it-works.html` ("official 50-state census total") both correctly include.

**Why MAJOR:** This is the single most prominent number on the landing page, under a banner inviting verification. An average reader who googles "2020 census total population" gets 331,449,281, sees a 689,545-person discrepancy, and the "to the last digit" boast backfires.

**Fix:** Change the stat label to *"matching the official 50-state resident population to the last digit (DC has no House seat)"* or similar.

---

### F5 — MINOR — "The other 49 states pass clean" vs. a ledger that flags 8 states for review

**Where:** `site/faq.html` line ~37: *"The other 49 states pass clean."* `site/index.html` line ~140: *"49 of 50 states pass clean."*

**What the artifact says:** `data/states.json`: only NY exceeds the 2% bar (maxDevPct 4.0769; all other 49 states ≤ 2%, max elsewhere is FL at 0.8545; `gateFailures` is "none" for all 49) — so **in the deviation-gate sense the claim is CONFIRMED**. However, the same ledger has `flaggedForReview: true` for **8 states** (NY plus AK, FL, HI, LA, MD, MI, WV — the `HARD_GEOGRAPHIES` spot-review list in `scripts/run-all-states.js` line 18).

**Why MINOR:** A reader who opens `data/states.json` will see `"flaggedForReview": true` on Hawaii and conclude the FAQ overstated. The flag is routine geometry spot-review, not failure — but the site doesn't scope its sentence.

**Fix:** Scope it: *"The other 49 states pass the deviation gate clean"* (and, if desired, a footnote that hard geographies get routine human spot-review).

---

### F6 — MINOR — Hawaii "within 0.02% on the first verified run": number confirmed, "first verified run" unverifiable

**Where:** `site/faq.html` line ~47: *"Hawaii's two districts came out within 0.02% of equal on the first verified run."*

**What the artifact says:** `out/HI/stats_splitline.json`: districts 727,751 and 727,520, deviations ±0.01587% — **within 0.02% CONFIRMED** (sum = 1,455,271 = `RESIDENT_POP.HI`). But no shipped artifact records run ordinals; "on the first verified run" cannot be checked, and `FAILURE-LOG.md` documents many development reruns across states.

**Fix:** Drop "on the first verified run" (the 0.02% fact is strong on its own) or cite the specific run log that establishes it.

---

### F7 — MINOR — Coverage median/min confirmed, but "median across 348 runs" is computed over 321, and 27 at-large runs show no coverage at all

**Where:** `site/about.html` lines 29–30: *"Each historical map shows its county-record coverage; the median across 348 runs is 100.0%, the lowest 87.5%."*

**What the artifacts say:** 348 `out/*/history/*/stats.json` files exist (CONFIRMED). Of these, **27 have no `coverage` field at all** (every decade of at-large AK, DE, VT, WY — though at-large ND and SD do have it, an artifact inconsistency). Across the 321 runs that have coverage: median = 1.0 → "100.0%" CONFIRMED; minimum = 0.8746 (FL 1950–1990) → "87.5%" CONFIRMED after rounding (87.46%). The at-large state pages show no coverage line (they show the at-large note instead), so "each historical map shows its coverage" is not literally true for those 27.

**Fix:** Say *"median across the 321 multi-district runs"* or backfill `coverage` for the 27 at-large runs; optionally show "87.46%" to survive a strict re-derivation.

---

### F8 — MINOR — "the episode is disclosed in the report's integrity chapter" — the report's integrity section doesn't contain the episode

**Where:** `site/about.html` lines 41–43: *"a hostile review of the report that initially ruled it not publishable (its findings were fixed, and the episode is disclosed in the report's integrity chapter)"*

**What the artifacts say:** The episode is real — `FAILURE-LOG.md` FL-012 records *"Verdict NOT PUBLISHABLE on this alone"* and `reviews/report_adversarial_review.md` exists. But `site/report.html`'s only integrity section, **Appendix D — Development Failure Log (Integrity Record)**, is a 2-sentence pointer to `FAILURE-LOG.md` in the repository; the not-publishable episode is not described anywhere in the shipped report page (no "hostile," "publishable," or "rewrite" text in report.html).

**Fix:** Either add one sentence about the episode to Appendix D, or change about.html to "…the episode is recorded in the public failure log (FL-012)."

---

### F9 — NIT — "2020 Census PL 94-171 block data (TIGER/Line)" conflates two different Census products

**Where:** `site/about.html` line 24. PL 94-171 is the redistricting *population* file; TIGER/Line is the *geometry* product. The footer on every page lists them separately (correctly). **Fix:** "2020 Census PL 94-171 block counts, placed with TIGER/Line block coordinates."

### F10 — NIT — "0 humans involved in drawing the lines" (index.html line 33)

Defensible as written (no human drew any line), but humans chose the grid size, projection, tie-break order, and repair rules — choices the how-it-works page itself describes. Consider *"0 human discretion in where the lines fall."*

---

## PER-CLAIM VERIFICATION TABLE

| # | Claim (location) | Source artifact | Source value | Verdict |
|---|---|---|---|---|
| 1 | 50 states districted by one process (index hero) | `src/constants.js` | 50 states in SEATS | CONFIRMED |
| 2 | 435 districts drawn (index, faq) | `src/constants.js` | ΣSEATS = 435 | CONFIRMED |
| 3 | 330,759,736 people, exact (index, faq, how-it-works, about) | `src/constants.js` | ΣRESIDENT_POP = 330,759,736 | CONFIRMED (number) — but see F4 (label "official census total" unqualified; US total incl. DC is 331,449,281) |
| 4 | "matching the official census total to the last digit" (index hero) | Census public record + report.html | US total = 331,449,281; 50-state = 330,759,736 | MISMATCH as labeled → F4 |
| 5 | 0 humans drew the lines (index) | — | rhetorical | CONFIRMED-with-caveat → F10 |
| 6 | Rucho v. Common Cause, 2019, federal courts can't police partisan gerrymandering (index) | public record | Decided June 27, 2019; partisan-gerrymandering claims held nonjusticiable in federal court | CONFIRMED |
| 7 | Gerry demo: 30 Purple / 20 Gold, 5 districts of 10; tallies 3–2, 5–0, 2–3 (index) | embedded JSON, index.html line 161 | voters array = 30×0 + 20×1; per-district counts re-derived by hand: fair P3/G2, strips P5/G0, pack P2/G3 ("40% minority takes a majority") | CONFIRMED (labeled "An illustration, not real data") |
| 8 | CO: 8 districts from 5,773,714 residents; "actual sequence of cuts… real engine output" (index #watch, how-it-works) | `out/CO/meta.json`, `site/data/demo-cuts-CO.json` | seats 8, residentPop 5,773,714, idealTarget 721,714.25 | CONFIRMED |
| 9 | CO animation arithmetic (embedded JSON, index line 162 + how-it-works line 101) | re-derivation | All 7 splits sum to parent region: 2,880,697+2,893,017=5,773,714; 1,438,539+1,442,158=2,880,697; 718,373+720,166=1,438,539; 721,753+720,405=1,442,158; 1,450,307+1,442,710=2,893,017; 732,028+718,279=1,450,307; 721,490+721,220=1,442,710 | CONFIRMED |
| 10 | CO final districts (animation final frame) | `out/CO/stats_splitline.json` | 721,714 / 721,783 / 721,753 / 721,749 / 721,755 / 721,714 / 721,657 / 721,589 — identical to engine; sum = 5,773,714 | CONFIRMED |
| 11 | Animation narration "every one within a fraction of a percent" (site.js showFinal) | `out/CO/stats_splitline.json` | max |dev| = 0.0174% | CONFIRMED (for CO, the only state animated) |
| 12 | State dropdown seat counts, all 50 (index line 109) | `src/constants.js` SEATS | 50/50 options match | CONFIRMED |
| 13 | Ohio 23 seats (1950) → 15 (2020) (index line 118) | `out/OH/history/1950/stats.json`, `src/constants.js` | 1950 seats=23; SEATS.OH=15; intermediate decades 24/23/21/19/18/16 also match real apportionment | CONFIRMED |
| 14 | OH strip images exist (index line 121) | `site/maps/` | OH-1950/1970/1990/2010/2020.png all present | CONFIRMED |
| 15 | 348 state-decade runs, zero failures (index line 117, faq line 53) | `out/*/history/*/stats.json`, `data/states.json` | exactly 348 files; = 50×7 − AK-1950 − HI-1950 (statehood 1959); all 50 production states status "done" | CONFIRMED |
| 16 | NY worst district 4.08%, 2% bar (index, faq, how-it-works, NY page) | `data/states.json`, `out/NY/stats_splitline.json` | maxDevPct 4.0769 → "4.08%" ✓; NY only state > 2% | CONFIRMED |
| 17 | 49 of 50 pass clean (index, faq) | `data/states.json` | deviation gate: true (next-worst FL 0.8545); but 8 states flaggedForReview | CONFIRMED for the 2% bar → F5 scope note |
| 18 | NY density justification "one sq mi > a district's share" (4 pages) | `out/NY/grid.json` | max cell = 121,272 vs share 776,971 (min share anywhere MT 542,113) | **MISMATCH → F1 (FATAL)** |
| 19 | 13 logged defects (index, about) | `FAILURE-LOG.md` | 12 real entries FL-001…FL-012 (+1 FL-NNN template); report.html says "eleven" | **MISMATCH → F2 (MAJOR)** |
| 20 | 6 at-large states (faq, how-it-works glossary) | `src/constants.js` | AK, DE, ND, SD, VT, WY = 6 | CONFIRMED |
| 21 | Hawaii two districts within 0.02% (faq) | `out/HI/stats_splitline.json` | 727,751 / 727,520; dev ±0.01587%; sum = 1,455,271 = RESIDENT_POP.HI | CONFIRMED (number); "first verified run" UNVERIFIABLE → F6 |
| 22 | Splitline concept proposed by mathematicians in the 2000s (faq) | public record | shortest-splitline, Warren Smith / Center for Range Voting, mid-2000s | CONFIRMED |
| 23 | Exact population identity, all 50 states pass (how-it-works, about) | `data/states.json` | v_pop true for all 50; TX districts sum 29,145,505; NY sum 20,201,249; CO sum 5,773,714; HI sum 1,455,271 — all equal RESIDENT_POP exactly | CONFIRMED |
| 24 | CO 5,773,714 distributed across grid; total must match exactly (how-it-works) | `out/CO/meta.json` | residentPop 5,773,714 | CONFIRMED |
| 25 | 1 sq mile = 640 acres (index, how-it-works) | arithmetic | 640 acres = 1 sq mi | CONFIRMED |
| 26 | Deviation glossary example: 8M/8 seats → 1M share; 1,005,000 = +0.5% (how-it-works) | arithmetic | 5,000/1,000,000 = 0.5% | CONFIRMED |
| 27 | Block-level data doesn't exist digitally before 2000 (about); "person-by-person… never digitized" (state pages) | public record (1990 PL 94-171 / STF 1B / NHGIS) | 1990 block data exists digitally | **MISMATCH → F3 (MAJOR)** |
| 28 | Coverage median 100.0% / lowest 87.5% across 348 runs (about) | `out/*/history/*/stats.json` | median 1.0 (of 321 with coverage); min 0.8746 = FL 1950–1990 | CONFIRMED with rounding + scope caveat → F7 |
| 29 | Hostile review "not publishable," disclosed in report's integrity chapter (about) | `FAILURE-LOG.md` FL-012, `reviews/report_adversarial_review.md`, `site/report.html` Appendix D | episode real; Appendix D is a pointer only, episode not in report.html | PARTIAL → F8 |
| 30 | Run-it-yourself commands (about) | repo | `cli.js` exists with `all` stage + `--state` flag (usage string matches); `scripts/run-all-states.js`, `scripts/site-build.js` exist | CONFIRMED |
| 31 | TX: 38 seats, 29,145,505 residents (TX.html title/header) | `src/constants.js` | SEATS.TX=38, RESIDENT_POP.TX=29,145,505 | CONFIRMED |
| 32 | TX embedded per-decade data (TX.html line 42) | `out/TX/history/*/stats.json`, `out/TX/stats_splitline.json` | seats 22/23/24/27/30/32/36/38 match artifacts & real apportionment; 2020 maxDev 0.7771 = engine 0.77707; per-decade district sums internally consistent; 1950 d1 pop 350,563 matches artifact | CONFIRMED |
| 33 | NY: 26 seats, 20,201,249 residents; flagged callout 4.08% (NY.html) | `src/constants.js`, `data/states.json` | 26 / 20,201,249 / 4.0769 | CONFIRMED (but callout repeats F1's false density claim) |
| 34 | NY embedded per-decade data (NY.html line 42) | `out/NY/history/*/stats.json` | seats 43/41/39/34/31/29/27/26 match artifacts & real apportionment; 2010 maxDev 26.6228 matches artifact | CONFIRMED |
| 35 | WY: 1 seat, 576,851 residents; at-large every decade since 1950 (WY.html) | `src/constants.js`, `out/WY/history/` | SEATS.WY=1, RESIDENT_POP.WY=576,851; all decades seats=1 | CONFIRMED |
| 36 | "Decennial county counts, 1950–2010" (footer, all pages) | `out/*/history/` | history decades are exactly 1950–2010 | CONFIRMED |
| 37 | Determinism / byte-identical re-runs incl. shuffled input (multiple pages) | `data/states.json` sha256 fields exist per state | hashes present; shuffle re-run itself not independently re-executed in this review | UNVERIFIABLE here (consistent with artifacts; no contradicting evidence) |

---

## VERDICT

The quantitative spine of the site is in excellent shape: every seat count, every resident population, the national 330,759,736 identity, the CO animation arithmetic (all 7 splits and the final 8 districts re-derived to the person against engine output), the 348-run history, the coverage statistics, the HI deviation, and the NY 4.08% flag all reconcile exactly with the engine artifacts. The historical seat counts even match real-world apportionment for every decade checked.

But the review fails the site as shipped, on one fatal and three major findings: the **NYC-density justification (F1) is contradicted by the project's own grid file by a factor of ~6 and is repeated on four pages**; the defect-log count is wrong in two directions at once (F2); the "no digital block data before 2000" methodology justification is factually incorrect (F3); and the hero's flagship number is labeled in a way that fails the first Google check (F4). For a project whose entire premise is "check us," F1–F4 are exactly the kind of errors that cost public trust permanently. All four have small, concrete fixes.

**Counts: FATAL 1 · MAJOR 3 · MINOR 4 · NIT 2**
