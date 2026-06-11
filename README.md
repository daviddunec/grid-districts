# Grid Districts — a deterministic, open redistricting baseline

**One identical process for every state. Equal population. Fully connected. Bit-for-bit
reproducible. No demographic, partisan, or address inputs — the algorithm only ever sees
population counts per square mile.**

This repository contains a complete engine that draws all 435 US congressional districts
from official 2020 Census block data, plus the verification suite that proves the results,
a historical demonstration back to 1950, an interactive website, and a report prepared for
lawmakers.

## Headline results (2020 Census, production run)

| | |
|---|---|
| States districted | **50/50** — zero failures |
| Districts drawn | **435/435** |
| Population identity | **330,759,736 people assigned — exact match** to the official Census 50-state resident total |
| Worst-district deviation | typically **&lt; 1%** of an equal share (dense-city states flagged at up to ~4%, see report) |
| Determinism | byte-identical output across runs, **even with input order shuffled** |
| Dependencies | 4 small npm packages, no native builds, no proprietary data |

## Quick start

```bash
npm install
node cli.js all --state CO          # district Colorado end-to-end (downloads ~200MB Census data)
node scripts/run-all-states.js      # the full country (resumable; ~3.5GB downloads first run)
node scripts/verify/check-population.js CO    # independent verification suite
node scripts/build-national-summary.js        # the all-50 visual summary HTML
node scripts/historical-run.js      # the 1950–2010 historical demonstration
node scripts/site-export-data.js    # website data: RLE grids, US map, cut trace -> site/data/
node scripts/site-build.js          # the interactive website -> site/
```

Every number this engine reports is checkable: each state's population is verified against
the official Census apportionment tables **and** against the exact sum of that state's own
census blocks; an independent verifier suite (written against the data contract, never the
engine source) re-derives populations, coverage, contiguity, and compactness from raw data.

## How it works (one paragraph)

The state is covered by a grid of one-square-mile cells in an equal-area projection. Every
2020 census block's population is assigned to the cell containing its official internal
point. The production algorithm recursively splits the state's cells into equal-population
halves (seat-weighted) using the shortest balanced cut, then a repair stage guarantees
contiguity and a chain-flow balancing stage drives every district to within a fraction of a
percent of an equal share. Every step is deterministic: all ties break on fixed rules, so
anyone running this code gets the identical map. Full specification: `docs/report/`.

## Repository map

| Path | What it is |
|---|---|
| `src/` | The engine (grid, traversal arms, repair, scoring, renderers) |
| `scripts/verify/` | Independent verification suite (authored against `docs/INTERFACES.md`, never reads `src/`) |
| `scripts/` | Batch runners, historical demonstration, site + report builders, annual update |
| `docs/report/` | The full report (algorithm spec, legal context, implementation pathways) |
| `docs/` | One-pager, FAQ & objections, model bill discussion draft |
| `site/` | The interactive website (static, GitHub Pages-ready) |
| `STRATEGIES.md` | The complete strategy comparison: what was tried, where each succeeds/fails |
| `FAILURE-LOG.md` | Every defect found during development: symptom → root cause → fix → prevention rule |
| `data/history/` | Verified historical inputs (apportionment 1950–2020, county populations by decade) |

## The annual update

`scripts/annual-update.js` (run yearly by `.github/workflows/annual-update.yml`):
- checks the Census Bureau for a **new decennial PL 94-171 vintage** (the legally relevant
  input, which changes every 10 years) and fails loudly when one appears so the new cycle
  can be run;
- re-verifies that all cached source URLs are live and that key checksums still match;
- re-runs the full pipeline and confirms byte-identical output (regression proof);
- regenerates the website and summary artifacts.

## Honesty notes

- The **historical demonstration (1950–2010)** scales 2020 settlement patterns by
  county-level decade ratios — it shows the *process* across history, not reconstructed
  historical geography (block-level data before 2000 does not exist digitally).
- The **center-out square-block arm** (the project's founding idea) currently passes 3 of 4
  stress-test states and is under active development (see `STRATEGIES.md`); the production
  arm is the shortest-split method.
- This is a **baseline/benchmark proposal**, not a claim that these maps should be enacted
  as-is; see the legal chapter (`docs/report/ch-legal.md`) for the Voting Rights Act
  discussion and the recommended implementation posture.

## Credit

Grid Districts was created by **Mark Dunec, CRE, MAI, FRICS** and **David Dunec**.

## License

MIT — see `LICENSE`. Census data is public domain.
