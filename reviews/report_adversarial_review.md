# Adversarial Review — REPORT.md

**Reviewer posture:** a skeptical election-law committee staffer reading alongside a quantitative analyst, both looking for the fastest defensible reason to set this report aside. Findings are graded **FATAL** (kills credibility / cannot circulate as-is), **MAJOR** (a hostile member lands a clean hit), or **MINOR** (polish / fairness).

Every numeric claim was checked against the live artifacts: `data/states.json`, `out/CO/scores.csv`, `STRATEGIES.md`, `research/state_populations.json`, `data/history/apportionment.json`.

**Verdict: NOT PUBLISHABLE** (moves to PUBLISHABLE WITH EDITS once the two FATAL integrity findings are fixed; the rest are MAJOR/MINOR).

---

## FATAL FINDINGS

### F-1 (FATAL — NUMBER VERIFICATION / INTERNAL CONTRADICTION). Florida and Maryland are reported "clean," but the projects own data records them as having FAILED population verification.

**Quoted text (Chapter 3 state-by-state table):**
> "| FL | 28 | clean | 0.85% | 25 |"
> "| MD | 8 | clean | 0.28% | 8 |"

and the national summary line:
> "States fully clean | 49 / 50"

**The artifact says otherwise.** In `data/states.json`:
- `FL`: `"v_pop": false`, `"stages": "...v-pop:FAIL..."`, `"flaggedForReview": true`
- `MD`: `"v_pop": false`, `"stages": "...v-pop:FAIL..."`, `"flaggedForReview": true`
- `NY`: `"v_pop": false`, `"v-pop:FAIL"`, `"flaggedForReview": true`

Three states failed population verification in the source data; the report discloses only NY and labels FL and MD "clean." A staffer who opens `states.json` (which the report INVITES them to do — "every claim in this report can be re-derived by any congressional staffer with a laptop in an afternoon") finds the flagship "fully clean" status flatly contradicted by the builds own verification log. This ends a hearing: the documents own substrate calls it inaccurate.

**Why fatal, not major:** the entire pitch is "dont trust us, check it." The first thing a hostile analyst checks is the status column against the status file, and it does not match. The credibility premise self-destructs.

**Concrete rewrite.** Either (a) re-run FL/MD until `v_pop` passes and update the data, or (b) tell the truth in the table and prose:
> "| FL | 28 | **v-pop flagged** | 0.85% | 25 |"
> "| MD | 8 | **v-pop flagged** | 0.28% | 8 |"
> National summary: "States passing all four gates incl. exact population identity: **47 / 50**; three states (FL, MD, NY) are flagged on the population check and reported here as flagged, not clean."
Then add one sentence explaining what v-pop failure means and why the map is still shown.

---

### F-2 (FATAL — OVERCLAIM contradicted by source). Chapter 2 names Florida, Maryland, and New York as having "passed this exact match" — the data says all three FAILED it.

**Quoted text (Chapter 2, Section 2, "Exact block-sum identity"):**
> "...the algorithm sums `POP20` over every block and **refuses to proceed unless that sum exactly equals the official resident figure** (check V1). A one-person discrepancy halts the run... **Colorado, Florida, Maryland, and New York have each passed this exact match.**"

**Two independent contradictions with the artifacts:**
1. `states.json` records `v_pop:false` / `v-pop:FAIL` for FL, MD, AND NY — three of the four states cited as PASSING the exact-population check are logged as FAILING it. Appendix E describes this very check as "Sum POP20 must equal the official state resident population EXACTLY at grid build — hard gate, all 50 states."
2. The text says the gate "refuses to proceed" and "halts the run" on any discrepancy — yet FL (28 districts), MD (8), and NY (26) all produced complete results, scores, and rendered maps (`"render": true`). A hard gate that halts cannot also have let three failing states run to completion. The report cannot have it both ways.

This is F-1 from the algorithm chapter, independently fatal: the sentence asserts as PROVEN the exact opposite of what the build log records, on the single number "the whole map balances on" (the reports own words).

**Concrete rewrite.**
> "Colorado has passed this exact block-sum identity. Florida, Maryland, and New York are flagged on the population check (`v-pop:FAIL` in the build log): their grid sums diverge from the official resident figure by [X people], the cause is [coastal/internal-point handling / hot-cell], and the maps are published as **flagged**, not as exact-identity-clean. The gate halts on an UNEXPLAINED discrepancy; these three are run with the discrepancy documented."
(If the gate was in fact relaxed for these states, say so — an undisclosed relaxation of a "hard gate" is itself a finding.)

---

## MAJOR FINDINGS

### M-1 (MAJOR — INTERNAL CONTRADICTION). The set of "flagged" states is stated three ways, and none matches the data.

**Exec Summary:** "four dense-city states are transparently flagged at up to ~4%."
**Chapter 3:** "Four dense-city states (NY, CA, IL, NJ) are FLAGGED, NOT FAILED."
**Chapter 2 Section 7 / STRATEGIES.md:** "the four hot-cell states NY/CA/IL/NJ are flagged-not-failed."

**The artifact says:** `flaggedForReview: true` holds for **eight** states — **AK, FL, HI, LA, MD, MI, NY, WV** — and is **false** for CA, IL, NJ (deviations 0.81% / 0.57% / 0.18%, all inside the 2% gate). The reports "NY/CA/IL/NJ" set is wrong both ways: it names three states (CA, IL, NJ) the data does NOT flag, and omits the ones it DOES (FL, MD, MI, LA, HI, WV, AK). A member asks "you say four flagged — your file flags eight, and three of your four arent in it. Which is right?" No good answer on the record.

**Concrete rewrite.** Distinguish the two conflated things: (a) the G1 population-deviation flag — only NY breaches the 2% gate (`gateFailures: "G1-flagged-not-failed"`), making NY the ONLY G1-flagged state, not four; and (b) the broader `flaggedForReview` set of eight. Relabel the "NY/CA/IL/NJ dense-city" grouping as a narrative about hot-cell risk, not the actual flag set, or delete it.

### M-2 (MAJOR — OVERCLAIM). "Survived blind expert-panel review of the method" implies external validation the artifacts dont support.

**Exec Summary:** "...and **survived blind expert-panel review of the method**."

The "blind 5-judge consensus panel" (STRATEGIES.md line 39) is an internal multi-agent consensus process, not outside human election-law/GIS experts. To a congressional reader, "expert-panel review" connotes external peer review. Presenting an in-house agent panel as such is inflation that taints every other claim once discovered.

**Concrete rewrite.** "...and was stress-tested through an internal blind multi-reviewer consensus process that ranked the candidate methods (`consensus/decision.md`). No external expert or peer review has yet been conducted; the reports explicit ask is for exactly that — a GAO or Census Bureau technical review."

### M-3 (MAJOR — OVERCLAIM / VRA). "Fully VRA-compatible in any state" / "no VRA conflict at all" overstates a contested, untested legal position.

**Chapter 5 Section 2.4(a):** "Under this posture there is **no VRA conflict at all**... This is **fully VRA-compatible in any state**, under either the pre- or post-Callais understanding of Section 2."

A categorical legal conclusion in a chapter that elsewhere (correctly) calls itself "policy analysis, not legal advice" and concedes the doctrine "is unsettled and may continue to move." The absolute phrasing is the overclaim the rest of the chapter avoids — and resting it on a 9-day-old, 6-3, contested decision (Callais) is an aggressive bet a hostile member will attack.

**Concrete rewrite.** "Under this posture the baseline does not itself create a VRA conflict, because it is a published reference rather than an enacted map: any Section-2-required district is drawn by the state and recorded as a justified departure. We do not claim this RESOLVES Section 2 compliance — that remains the states burden on the enacted map — only that the benchmark framing adds no new conflict."

### M-4 (MAJOR — MISSING DEFENSE). No answer to "a neutral-looking process can still produce systematically partisan maps."

The most predictable hostile attack on any "neutral algorithm" is disparate impact: "Your blind process still packs my partys urban voters because density correlates with party — youve laundered a partisan outcome through geometry." The report asserts the INABILITY TO AIM (Appendix B #9, Chapter 6 Section 4) but never addresses the OUTCOME: does the baseline exhibit measurable partisan or incumbent skew vs. enacted maps? It holds no election data, so it cannot answer — but failing to NAME the attack and state that limitation reads as naive or evasive.

**Concrete rewrite.** Add an Appendix B objection: "Doesnt a density-blind map still systematically favor one party because density correlates with partisanship?" Answer: the baseline cannot measure its own partisan effect (it holds no election data); the beat-the-baseline-or-explain regime is what surfaces a skewed ENACTED map; and any analyst can overlay election results on the published baseline to test for skew — which is invited, not feared.

### M-5 (MAJOR — MISSING DEFENSE / STRUCTURE). The Exec Summary never surfaces "the grid map is not enactable — so what is Congress voting on?"

Chapter 5 Section 1.2/3.3 candidly concede the 1-mi-sq output is NOT enactable under Karcher and needs unbuilt block-level refinement. A hostile staffer fuses this with the Pathways: "the thing you built cant be a map, and the thing that could be a map isnt built." The correct answer (the BENCHMARK neednt be enactable) is in Chapter 5 but ABSENT from the Executive Summary and One-Page Brief, where the decision-maker actually reads. The exec summarys "complete, working" framing invites the attack the body then walks back.

**Concrete rewrite.** Add to the Exec Summary "What was built" block: "The 1-mi-sq output is a BENCHMARK, not an enactable map — enactment would require a separate block-level refinement step (Chapter 5 Section 3.3) NOT part of this build. Congress is asked to adopt a DISCLOSURE standard, not to enact any algorithm-drawn district."

### M-6 (MAJOR — TONE / ADVOCACY). The Executive Summary opens as a pitch, not analysis.

**Quoted text:** "Remove the discretion — not from the states, but from the BENCHMARK." ... "no one controls it and everyone can check it." ... "**Beat the baseline or explain why.**" ... "every choice a map-drawer can make is a choice that can be captured."

Italic slogans, imperative voice, and rhetorical antitheses read like campaign copy. A neutral staffer evaluating a technical disclosure proposal is alienated by advocacy framing — on redistricting, tone is read as partisan signaling. The substance survives a flatter register.

**Concrete rewrite.** Lead with the finding: "This report documents a deterministic, demographics-blind redistricting algorithm and proposes its output be published as a neutral benchmark against which states disclose and justify deviations in their enacted plans. The algorithm was run on all 50 states; results and limitations follow." Retire "Beat the baseline or explain why" from the summary (keep it once, defined, in Chapter 6).

### M-7 (MAJOR — STRUCTURE). A staffer cannot find the bill mechanics in under a minute from the front.

The model bill (the actual ASK) is **Appendix A**, ~780 lines deep. The Exec Summary mentions "a discussion-draft bill (the FAIR Baseline Act)... in roughly two pages" but gives ZERO mechanics — no "Custodian computes baseline within 90 days; states publish a standardized comparison and justify material deviations; VRA savings clause." A member asking "what does the statute actually require?" must hunt to the back. The One-Page Brief (Appendix C) has it — also at the back.

**Concrete rewrite.** Move the One-Page Brief to the FRONT, right after the Executive Summary, or fold a 4-bullet "What the bill requires" box into the Exec Summary (custodian + 90-day deadline; state disclosure duty; deviation-justification duty; VRA savings clause + no-binding-effect). Operative mechanics should be on page 1-2.

### M-8 (MAJOR — OVERCLAIM, historical). "Apply[ing] the same process to every apportionment cycle since 1950" oversells ~40%-of-states coverage.

**Exec Summary:** "Chapter 4 applies the same process to **every apportionment cycle since 1950**."

The Chapter 4 coverage table shows only **19-22 state runs** and **19-20 multi-district maps** per decade out of ~48-50 states — roughly **40% of states per decade**; the majority were not run. "Every apportionment cycle" is literally true; the impression of "the country since 1950" is not what the table supports, and the "Ohio 1950/1990/2020" example cherry-picks a state that WAS run. Partial coverage IS disclosed in the table (credit for that), but the summary framing oversells it.

**Concrete rewrite.** "Chapter 4 applies the same process to a representative ~20 states per decade across all eight apportionment cycles since 1950 (coverage table in Chapter 4), using each decades actual seat counts and county-level populations."

---

## MINOR FINDINGS

### m-1 (MINOR — NUMBER VERIFICATION). The "42 vs 58 irregular" claim is off by one against the reports own table.

**Chapter 2 Section 7:** "the centroid research arm produces fewer irregular districts than the splitline production arm (**42 vs. 58**)."

Summing the reports own Chapter 6 table (centroid: CO 2 + MD 6 + FL 19 + NY 14) = **41**, not 42. (Splitline 5 + 8 + 25 + 20 = 58 is correct.) Small, but a hostile analyst who adds the column finds the headline comparison doesnt reconcile with the table two pages earlier.

**Concrete rewrite.** "(**41 vs. 58** across the four stress states)" — or recompute and fix the authoritative value.

### m-2 (MINOR — OVERCLAIM, determinism scope). "Cryptographic hash on the largest and most complex states" vs. the listed proof set.

**Exec Summary:** determinism "verified by cryptographic hash on the largest and most complex states." **Chapter 3** specifies the shuffled-input SHA-256 proof ran on "TX, CA, HI, MI." HI (2 seats) is neither large nor complex; the superlative doesnt match a set that includes Hawaii.

**Concrete rewrite.** "verified by cryptographic hash, including shuffled-input re-runs, on a 4-state sample spanning the largest (TX, CA) and an island/peninsula case (HI, MI)."

### m-3 (MINOR — UNVERIFIABLE, logged for the record). All Chapter 5 case holdings are external citations not checkable against the supplied artifacts.

Karcher "0.6984%," Rucho (588 U.S. 684), Milligan (599 U.S. 1), Louisiana v. Callais (608 U.S. ___, April 29 2026, No. 24-109): none verifiable from the five in-scope data files. NOT a defect — appropriately caveated — but logged so sign-off is explicit: a legal reviewer must independently confirm every citation, and the Callais characterization (a 9-day-old decision doing heavy load-bearing work in Section 2.2-2.3) is the highest-risk item after F-1/F-2.

### m-4 (MINOR — TONE). "It does not ask to be trusted, it asks to be checked" appears at least four times.

(Exec Summary; Chapter 2 Section 8; Chapter 6 Section 4; Appendix B.) Good once; repeated it reads as a mantra and invites "you keep saying check it — we did, and FL/MD arent clean" (F-1). Use it once.

### m-5 (MINOR — CONSISTENCY, naming). The production method is called four things.

"recursive splitline" (Ch 2), "shortest-split method" (Ch 3), "shortest-line method" (Impl ch / App B), "shortest-splitline" (Ch 5 / App B #14). Standardize on one term on first use per chapter.

---

## What the report gets RIGHT (so the verdict is read fairly)

- **Population identity is exact and reproduces.** Sum(50 states) = **330,759,736** and + DC = **331,449,281** both verify to the person against `research/state_populations.json`.
- **The Chapter 3 per-state deviation and irregular-count table reproduces exactly** against `data/states.json` for all 44 listed rows — the ONLY defects are the FL/MD "clean" LABELS (F-1); the numbers themselves are right.
- **Decade seat totals all = 435** across 1950-2020 in `apportionment.json`; Ohio 1950 = 23, 1990 = 19, 2020 = 15 all match the Chapter 4 claims.
- **National irregular total = 349** matches the Implementation chapter exactly.
- **The legal chapters posture is genuinely cautious and well-structured**; the Karcher/Section-2 concessions are honest, and the bills savings clause + no-binding-effect section line up with the chapters recommendation. That honesty is real — which is WHY F-1/F-2 sting: they are the rare places the documents caution failed, and they sit on the load-bearing number.

---

## Verdict

**NOT PUBLISHABLE** as currently written. The two FATAL findings (F-1, F-2) are not stylistic — they are direct, reproducible contradictions between the reports headline "clean / passed exact match" claims and the projects own verification log, on the one number the report says everything balances on. They are also CHEAP to fix: tell the truth about FL/MD/NY v-pop status in three places, reconcile the "hard gate" language, and the document moves to **PUBLISHABLE WITH EDITS** (the eight MAJOR findings then being the gating list, none individually fatal).

Reviewed by: __________  Date: __________
