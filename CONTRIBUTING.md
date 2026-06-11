# Contributing

This project's credibility rests on two properties — **determinism** and **verifiability**.
Every contribution is evaluated against them first.

## Hard rules

1. **Determinism is non-negotiable.** No `Date.now()`, no `Math.random()`, no
   Map/object-iteration-order dependence, no locale-dependent operations anywhere in the
   engine. Every tie-break names an explicit sort key. CI runs the shuffled-input
   determinism check; a PR that breaks byte-identical output will not merge.
2. **Unverified values are never hardcoded.** Every external fact (population figure, URL,
   field name) must trace to a verified source recorded in `research/` or `data/history/`
   with its validation checks.
3. **The verifier suite stays independent.** Code in `scripts/verify/` is written against
   `docs/INTERFACES.md` and must never import from `src/`.
4. **Accuracy outranks speed, which outranks elegance.** A slower exact method beats a
   faster approximate one in the engine core.
5. **Log failures.** Real defects found during development get a `FAILURE-LOG.md` entry
   (symptom → root cause → fix → prevention rule). It is the project's institutional memory.

## Workflow

- Open an issue describing the change before significant work.
- PRs must pass: `node scripts/verify/synthetic-tests.js`, the full Colorado pipeline
  (`node cli.js all --state CO`) with all five verifiers green, and the determinism check.
- Changes to `docs/INTERFACES.md` are contract changes: they require a change-control entry
  in that file and updates to every consumer in the same PR.

## Good first contributions

- The **hybrid ending** for the square-accretion arm (see `STRATEGIES.md` — the open
  research problem).
- Half-mile hot-cell refinement for dense cities (the block index in `cell_blocks.json`
  already supports it).
- County-split and community-of-interest metrics for the scoring suite.
- Additional independent verifiers.
