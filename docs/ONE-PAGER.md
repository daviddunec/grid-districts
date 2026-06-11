# The FAIR Baseline Act — One-Page Brief

**A neutral, reproducible redistricting baseline — for disclosure, not federal map-drawing.**

---

**The problem.** Voters cannot easily judge whether an enacted congressional map is
fair, because there is no neutral, reproducible reference that the same rules produce
for every state.

**The proposal.** Require that every enacted congressional plan be published alongside
a neutral, open-source baseline map and a standardized metrics comparison, with any
material deviation justified in public — a disclosure mandate under the Elections
Clause, with no federal takeover of map-drawing.

**How it works.**
- One identical, deterministic process is applied to every state — it reads census
  population and geography only, and cannot see party.
- States keep full authority to draw their own maps; they simply publish how their
  map compares to the neutral baseline and justify any large divergence.
- The code and data are open, so anyone — a rival party, a journalist, a court expert
  — can re-run it and confirm the result for themselves.

**What was built and proven.**
- The same process produced **all 435 congressional districts across all 50 states.**
- Population is conserved **exactly** — the assigned total equals the 2020 census
  resident population of the 50 states, **330,759,736**, to the person.
- Output is **deterministic** — byte-for-byte identical across re-runs *and* across a
  deliberately shuffled input order, verified by SHA-256 hash.
- The data and code are **open**, and the known rough edges (a few flagged
  dense-city states; the count of irregular-shaped districts nationwide) are reported
  publicly, not hidden.

**What the bill would do.**
- Direct a neutral custodian (e.g., the Census Bureau or GAO) to compute and publish
  the baseline map and metrics for every state each decennial cycle.
- Require each state to publish a standardized comparison of its enacted plan to the
  baseline and to justify material deviations in public.
- Preserve the Voting Rights Act in full through an explicit savings clause — the
  baseline is a reference, never binding, and never evidence of VRA compliance.

**The ask.** Hold a hearing on the FAIR Baseline Act and direct GAO or the Census
Bureau to conduct a technical review of the reference system's reproducibility and
methodology.

---

*Discussion materials — illustrative only, not legal advice. The accompanying model
bill, implementation chapter, and objections memo provide detail.*

Reviewed by: __________  Date: __________
