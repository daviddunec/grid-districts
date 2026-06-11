# Deterministic Grid Redistricting: A Transparent, Reproducible Baseline for Congressional Maps

## Report to Lawmakers — Executive Summary

This report documents a deterministic, demographics-blind redistricting algorithm and proposes that
its output be published each cycle as a neutral benchmark, against which states disclose and justify
deviations in their enacted congressional plans. The algorithm was run on all fifty states; the
results, the method's limitations, and the legal posture follow.

**The problem.** In most states, congressional district lines are drawn by officials with a direct
stake in where those lines fall. The Supreme Court has held that federal courts cannot police
partisan gerrymandering (*Rucho v. Common Cause*, 2019), and recent decisions have narrowed the
remaining federal checks. Reform proposals routinely stall on a single question: who can be trusted
to draw the lines? This report examines an alternative framing — a benchmark that requires no trust,
because it removes discretion from the *reference point* rather than from the states.

**The approach.** The algorithm receives one input: how many people live in each square mile,
from official Census block data. It receives no race, no party registration, no election results,
and no addresses. It is deterministic — the same input produces the same map, byte for byte, on any
computer, run by anyone — and fully open source, so no person or institution controls it and any
claim about it can be independently re-derived.

**What was built and verified.** This is a working system, not a concept paper:

- All 50 states were districted; all 435 districts drawn, with zero failed runs.
- The 330,759,736 residents of the 50 states were assigned to districts in an exact match to the
  official Census total, verified two independent ways: against the Census Bureau's published
  apportionment tables, and against the block-by-block sum of each state's own census data — a
  build-time gate that all fifty states passed.
- The typical state's worst district deviates from a perfectly equal share by well under one
  percent. One state (New York) exceeds the report's two-percent reporting gate, at 4.08%, and is
  disclosed as flagged; the dense-city refinement that addresses this is specified in Chapter 6.
- Re-running the engine — including with deliberately shuffled input — produces byte-identical
  maps, verified by cryptographic hash on a four-state sample spanning the largest (TX, CA) and
  island/peninsula geographies (HI, MI).
- The development process used independent verification code written against a published data
  contract, internal blind multi-reviewer evaluation of the candidate methods, and a published
  defect log (eleven issues, each with root cause and fix). **No external expert review has yet
  been conducted; obtaining one — from GAO or the Census Bureau — is this report's explicit ask.**

**What this output is, and is not.** The one-square-mile output is a *benchmark*, not an enactable
map: enacted congressional plans are held to near-zero population deviation (*Karcher v. Daggett*),
which requires a block-level refinement step that is specified but not part of this build (Chapter
5, §3.3). Congress is not asked to enact any algorithm-drawn district. It is asked to adopt a
*disclosure standard*.

**What the draft bill requires (Appendix A, ~two pages).** Four mechanics:

1. A designated custodian computes and publishes the baseline map for each state from the open
   specification after each census.
2. Each enacted congressional plan is published alongside its state's baseline with a standardized
   metrics comparison.
3. Material deviations are publicly justified in writing.
4. An explicit Voting Rights Act savings clause; the baseline binds no one and preempts nothing.

**The historical demonstration.** Chapter 4 applies the same engine to all eight apportionment
cycles since 1950, using each decade's actual seat counts and county-level census populations
(coverage detailed in Chapter 4's table; the maps are labeled approximations, since block-level
data predates digital records). The demonstration's point is narrow but important: the process is
indifferent to era and to whoever held power — nothing in the loop can respond to politics.

**The legal posture, honestly stated (Chapter 5).** A demographics-blind algorithm cannot by itself
guarantee the majority-minority districts the Voting Rights Act requires in some circumstances.
The baseline posture is designed for exactly that reality: states keep drawing their maps under
existing law, §2-driven choices are documented as justified departures, and the benchmark adds no
new conflict. Chapter 5 also addresses the predictable objection that a blind process can still
carry partisan consequences through geography — and why a published, measurable baseline makes that
question *more* answerable, not less (Appendix B).

**The ask.** A hearing; a technical review by GAO or the Census Bureau; and consideration of the
baseline-disclosure standard for the post-2030 cycle. Every claim in this report can be re-derived
from the public repository by any congressional staffer with a laptop.

---

*Chapter 2: full algorithm specification. Chapter 3: 2020 results. Chapter 4: the 1950–2020
demonstration. Chapter 5: legal context and limitations. Chapter 6: implementation pathways.
Appendix A: the draft bill. Appendix B: objections and responses. Appendix C: one-page brief.*
