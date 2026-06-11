# Site Review — Comprehension Lens (average American, 8th-grade target)

**Scope:** visible copy + information architecture of `site/index.html`, `site/how-it-works.html`, `site/faq.html`, `site/about.html`, plus the user-visible strings JS injects into those pages (gerrymander-demo scoreboard/takeaways, cut-animation narration in `site/assets/site.js`).
**Reviewer stance:** adversarial; every finding cites the actual text seen.

---

## What already works (calibration, so the findings below land in context)

- The page order on index tells a real story: claim → proof stats → the problem (demo) → the fix (4 cards) → watch it → explore → history → fine print. A non-expert can follow it.
- The gerrymander demo takeaways are excellent plain English ("packs Purple voters into two districts they win overwhelmingly, and spreads the rest too thin to win"). The scoreboard ("Purple wins 3 districts / Gold wins 2 districts") is instantly legible, and the math in all three tabs checks out against the voter array (30/20 split; 3-2, 5-0, 2-3).
- The animation narration is genuinely good: "**Colorado.** 5,773,714 people, 8 congressional seats. Every square is one square mile. Press **Play**…" and per-cut text uses compass words ("puts 2,880,697 west of it and 2,893,017 east of it"), not math jargon.
- The glossary on how-it-works (census block, deviation, deterministic, at-large, benchmark/baseline) is exactly the right move — the problems below are mostly that key terms are used *before* or *far from* it.
- Honesty signals (NY flagged, defect log, "mistakes and all") are strong trust-builders.

---

## FATAL

### F1. "Matching the official census total" — the number a skeptic will Google does NOT match
- **File/location:** `index.html` line 32 (stats band): "**330,759,736** people — each counted exactly once, **matching the official census total to the last digit**"; and `faq.html` lines 52–53 ("Has this actually been run…"): "the national total matching the census exactly: 330,759,736 people."
- **What's wrong:** The official 2020 Census total every search engine returns is **331,449,281** (it includes Washington, D.C.). 330,759,736 is the 50-state total *excluding* D.C. (331,449,281 − 689,545). The site's own how-it-works page knows this and says it right ("matching the official **50-state** census total exactly," line 63), and About says "official **50-state** resident population" — but the two most-trafficked claims (the homepage stat band and the "has this actually been run" FAQ) drop the qualifier. A skeptical reader who checks the headline number will conclude the site's flagship "to the last digit" boast is off by ~690,000 people — on a site whose entire pitch is exact verifiability. That is a trust-breaking misread the site hands to its critics, with a six-word fix.
- **Fix:** On both occurrences, say "matching the official 50-state census total (D.C. has no House district) to the last digit." Also add the missing FAQ entry (see M-16) explaining why D.C. and Puerto Rico don't appear.

---

## MAJOR

### M1. "0 humans involved in drawing the lines" — hype a skeptic can puncture
- **File/location:** `index.html` line 33 (stats band): "**0** humans involved in drawing the lines."
- **What's wrong:** Humans wrote the algorithm, picked the one-square-mile grid, picked the cut families, and picked the tie-breaking order. "0 humans involved" is the kind of absolute that makes a skeptical reader stop trusting everything else, because the obvious rebuttal ("a human chose the rule") is one second away. The site's better framing already exists elsewhere ("no knobs anyone can turn").
- **Fix:** "0 human choices about where any line went" or "0 hands on the pen — the rule was fixed before any map was drawn."

### M2. "Cannot have been rigged, because there was nothing to rig" — overclaim; the strongest objection is never answered
- **File/location:** `how-it-works.html` lines 69–70: "a reference map that *cannot* have been rigged, because there was nothing to rig." Related: `faq.html` line 38 ("Couldn't someone game the algorithm?"): "Game it how? There are no parameters to tune, no randomness to fish, no inputs except published census counts."
- **What's wrong:** The rule *itself* is a parameter. A motivated designer could, in principle, try many candidate rules and publish the one whose outcomes they liked. The FAQ's "Game it how?" answers the weak version of the objection (tampering after publication) and skips the strong version (selection before publication) — which is the first question any politically literate skeptic will ask. As written, "cannot have been rigged" is falsifiable rhetoric on the page that's supposed to be the sober walkthrough.
- **Fix:** Soften to "nothing left to rig once the rule is published," and add a FAQ entry: "Couldn't *you* have picked a rule that favors one side?" — answered with whatever the report actually offers (rule published with full history, tested across 8 decades of population data, anyone can propose/compare alternative rules against the same gates).

### M3. "Run it yourself" has no repository link anywhere — the core promise dead-ends
- **File/location:** `about.html` line 49: the code block opens with the placeholder "`« clone the repository »`" — no URL. `faq.html` lines 62–64 ("Can I check any of this myself?"): "Yes — that's the entire design… Start with Run it yourself." Grep across all site pages: zero occurrences of an actual repo URL (github/gitlab/git clone).
- **What's wrong:** The site's entire trust architecture rests on "anyone on earth can run it too" (faq.html line 56). A reader who follows that thread lands on a French-quoted placeholder. For the public this is a broken promise; for a hostile reader it's evidence the verifiability story is theater.
- **Fix:** Put the real repository URL in `about.html#run` (as a `git clone <url>` line), in the footer "Go deeper" column, and in the FAQ answer. If the repo isn't public yet, the pages must say so plainly ("repository public on [date]") instead of implying it's available now.

### M4. Historical maps presented on index with no approximation caveat — the disclosure lives only on About
- **File/location:** `index.html` lines 117–121: "We ran the identical process on every census since 1950 — 348 state-decade runs, zero failures. Here's Ohio shrinking from 23 seats to 15…" with figures alt-texted "Ohio's algorithm-drawn districts in 1950" and captions just "1950," "1970," etc. The caveat appears only in `about.html` lines 27–30: block-level data doesn't exist before 2000, so "historical maps scale the 2020 settlement pattern to each decade's real county totals — a labeled approximation."
- **What's wrong:** An average reader leaves the homepage believing the 1950 Ohio map shows where 1950 Ohioans actually lived. It doesn't — it's 2020 settlement geography rescaled to 1950 county totals. The site calls them "a labeled approximation," but on the page where most people will see them, there is no label. That gap is exactly the "would mislead the public" category, partially mitigated only because About discloses it.
- **Fix:** One line under the Ohio strip: "Historical maps are estimates: today's street-level population pattern, scaled to each decade's real county counts (details in About)." Consider alt text "estimated 1950 districts."

---

## MINOR

### m1. "deterministic" used as a hero badge, defined three clicks away
- **File/location:** `index.html` line 25 hero tags: "open source · **deterministic** · verified against the 2020 Census."
- **What's wrong:** The site's single most important concept appears first as an unexplained Latinate badge. The definition ("same input always produces the exact same output") lives in the glossary at the *bottom of a different page* (how-it-works lines 88–89).
- **Fix:** Swap the badge text for plain English ("same answer every time") or add a title/tooltip; the hero lead's "anyone can re-run it and get the identical maps" is the badge — use it.

### m2. "zero discretion" — kicker jargon
- **File/location:** `index.html` line 17: "An open algorithm · all 50 states · **zero discretion**."
- **What's wrong:** "Discretion" in this technical sense (room for human judgment) is above the 8th-grade target and reads, to some, as "zero caution."
- **Fix:** "no judgment calls" or "no human choices."

### m3. "Packed & cracked" — insider jargon as a button label
- **File/location:** `index.html` line 44, third demo tab: `Packed & cracked`.
- **What's wrong:** "Pack and crack" is gerrymandering-insider vocabulary. The takeaway text explains packing beautifully *after* the click, but the label is gibberish at the moment of choosing — the other two tabs ("Follow the neighborhoods," "Tidy straight strips") are plain English.
- **Fix:** Label it "Rigged on purpose" and let the takeaway introduce the terms: "this trick is called 'packing and cracking.'"

### m4. "348 state-decade runs" — statistician's shorthand
- **File/location:** `index.html` lines 117–118 and `faq.html` line 53 ("348 state-decade runs").
- **What's wrong:** "State-decade" is a unit no normal reader has met.
- **Fix:** "we ran it for every state in every census year since 1950 — 348 runs in all."

### m5. Legal jargon cluster never unpacked: "savings clause," "preempts nothing," "Elections Clause," "minority-opportunity districts"
- **File/location:** `faq.html` line 24 ("an explicit savings clause: the baseline binds no one and preempts nothing"), line 61 ("Congress's power… under the Elections Clause comfortably covers"); `index.html` line 137 ("an explicit VRA savings clause"); `how-it-works.html` line 80; "minority-opportunity districts" in `faq.html` line 22 and `index.html` line 135.
- **What's wrong:** Four pieces of law-review vocabulary carry the site's most sensitive reassurances (minority voting rights; that nothing is being forced on anyone), and none gets a plain-language gloss. Also, "comfortably covers" states a contested constitutional judgment as settled fact — mild hype.
- **Fix:** Gloss each on first use: "a savings clause (a line in the bill saying existing voting-rights law always wins)"; "binds no one — no state is forced to use it"; "districts where minority voters can elect candidates of their choice." Change "comfortably covers" to "the report argues this fits squarely within."

### m6. FAQ uses "deviation" cold; the glossary that defines it is on another page, unlinked
- **File/location:** `faq.html` line 32: "Isn't the deviation worse than real enacted maps?" — answer assumes the reader knows deviation = distance from equal population. The definition exists only at `how-it-works.html` lines 86–87.
- **What's wrong:** FAQ pages are direct-landing pages; a reader arriving from search gets a question framed in a term the site never defines there.
- **Fix:** Parenthetical on first use — "deviation (how far a district's population strays from a perfectly equal share)" — or link the glossary entry.

### m7. About's verification paragraph is one ~90-word sentence with five gates
- **File/location:** `about.html` lines 34–39: "Every state must pass, in order: an exact population identity at grid build (… a single missing person fails the build); coverage (…); contiguity (…); a deviation gate (…); and determinism (…)."
- **What's wrong:** Five semicolon-chained gates with nested parentheticals — far over the 8th-grade bar. The same content is a clean bulleted list on how-it-works (lines 55–62); About punishes the diligent reader.
- **Fix:** Reuse the bullet format from how-it-works.

### m8. "Population identity" / "pass this identity" — math jargon that reads as "ID"
- **File/location:** `about.html` line 34 ("an exact population identity"); `how-it-works.html` line 57 ("All 50 states pass this identity").
- **What's wrong:** To a general reader "identity" means a driver's license. The mathematical sense (an equation that must hold) is unguessable.
- **Fix:** "an exact head-count match" — how-it-works' own bullet heading ("Exact head-count") already nails it.

### m9. "Hover over every district" — instruction excludes phone users and reads as a chore
- **File/location:** `index.html` line 100: "Click any state to see its districts — hover over every district, then slide back through every census since 1950."
- **What's wrong:** Half the audience is on a touchscreen with no hover; and "hover over *every* district" sounds like homework rather than an invitation. (The state pages themselves correctly say "Hover or tap a district.")
- **Fix:** "tap or hover any district to see its population, and slide back through every census since 1950."

### m10. "Each cycle's new census data triggers an annual auto-update check" — muddled
- **File/location:** `about.html` line 53.
- **What's wrong:** Census data arrives every ten years; the check is annual; the sentence fuses the two so the reader can't tell what happens when. It also undercuts itself — what does an "auto-update check" do between censuses?
- **Fix:** "The code checks once a year for newly published census data, so each new decade's baseline can be rebuilt and re-verified automatically."

### m11. "Written for Congress" — implies a commission that doesn't exist
- **File/location:** `index.html` line 150: "the full technical report **written for Congress**"; `faq.html` lines 19–20: "answered the same way the report answers them **for Congress**."
- **What's wrong:** "Written for Congress" can read as "Congress asked for this." Nothing on these pages says any member did. A skeptic flags it as résumé inflation; About even admits "No external expert has reviewed the work yet."
- **Fix:** "the full technical report, written to be put in front of Congress" or "aimed at policymakers."

### m12. "Hashes" are the proof mechanism, and the word is never explained
- **File/location:** `how-it-works.html` line 61 ("verified with cryptographic hashes"); `faq.html` lines 39 and 63 ("compare hashes"); `about.html` line 38 ("under cryptographic hash").
- **What's wrong:** The reader is repeatedly told the proof is "compare hashes," and to an average American a hash is breakfast. The glossary defines deterministic but not hash.
- **Fix:** One parenthetical at first use — "a cryptographic hash (a short digital fingerprint: if even one byte of the map changed, the fingerprint changes)" — and a glossary entry.

### m13. Scare quotes around "communities of interest" risk sounding contemptuous
- **File/location:** `how-it-works.html` line 67: 'City limits, county lines, freeways, party registration, where incumbents live, &ldquo;communities of interest&rdquo; — the rule sees none of it.'
- **What's wrong:** Listing a legally recognized redistricting principle in scare quotes, sandwiched next to "where incumbents live," reads as a sneer to readers who care about minority and neighborhood representation — the exact audience the VRA FAQ works hard to reassure. That's the "talking down" failure mode.
- **Fix:** Drop the quotes and the guilt-by-association ordering: "…even legally recognized 'communities of interest' — the rule sees none of it, including the good-faith inputs."

### m14. Dense fine-print card on index
- **File/location:** `index.html` lines 131–133: "Courts require enacted maps to hit near-perfect population equality, which takes a final block-level refinement this build deliberately leaves to the official process."
- **What's wrong:** 30-word sentence, three abstractions deep ("enacted," "block-level refinement," "official process"), in the section average readers most need to understand (what this is and isn't).
- **Fix:** "By law, real maps must be almost perfectly equal in population. Getting that last fraction of a percent takes a final fine-tuning step we deliberately leave to officials."

### m15. "County-record coverage… median is 100.0%, the lowest 87.5%" — numbers with no referent
- **File/location:** `about.html` lines 29–30: "Each historical map shows its county-record coverage; the median across 348 runs is 100.0%, the lowest 87.5%."
- **What's wrong:** Coverage of *what*? The reader has no way to know whether 87.5% is good or alarming, or what's in the missing 12.5%.
- **Fix:** One plain sentence: "Coverage = the share of that decade's county population records we could locate and use. 100% means every county's official count was found; the worst case used 87.5% of them and scaled the rest."

### m16. Nothing anywhere explains why D.C. and Puerto Rico are absent
- **File/location:** gap — `faq.html` has island/Alaska/at-large entries (lines 45–47) but no D.C./territories entry; no page mentions D.C.
- **What's wrong:** "All 435 districts" + a population total ~690k below the famous census number (see F1) and 3.2M Puerto Ricans unmentioned will generate the question; the site leaves the reader to guess.
- **Fix:** FAQ entry: "Why isn't Washington, D.C. (or Puerto Rico) on the map? They have no voting House seats to draw, so they're not part of the 435 — and that's also why our total is 330,759,736, not the full-U.S. 331,449,281."

---

## NIT

### n1. "one due half the districts" — "due" is a stumble word
- `how-it-works.html` line 36: "splits the state into two regions — one due *half* the districts, the other the rest." Eighth-grade rewrite: "one side gets half the districts, the other side gets the rest."

### n2. "The grid isn't the district — it's the measuring tape" — metaphor is slightly false
- `faq.html` line 31. The districts literally *are* unions of grid squares, so the tape metaphor invites the rebuttal "no, your districts are made of the tape." Safer: "the squares are just the unit we count in — like pixels in a photo."

### n3. "Step" button label
- `index.html` line 88 / `how-it-works.html` line 45: `Step`. "Next cut" says what it does; "Step" reads as dance instruction to non-technical users.

### n4. Hero: "get the identical maps, down to the last person"
- `index.html` lines 19–20. "Down to the last person" grammatically modifies the *maps being identical*, but the person-level claim belongs to the population accounting. Tighten: "and get the identical maps — every one of 330 million people accounted for."

### n5. "its findings were fixed" — ambiguous antecedent
- `about.html` line 42: "a hostile review… initially ruled it not publishable (its findings were fixed…)." Whose findings — the review's or the report's flaws? Say "the problems it found were fixed."

### n6. Asserting honesty instead of demonstrating it
- `faq.html` line 35: "Because we measure honestly." and line 29: "Squares are the most honest unit available." Twice telling the reader you're honest is weaker than the surrounding evidence; cut to "Because we don't hide bad numbers" / "Squares are equal-area, identical everywhere, and impossible to nudge."

### n7. "our reporting bar is 2%" — bar for what?
- `faq.html` line 37. Unclear whether 2% is a legal limit, a target, or a tripwire. "our self-imposed flag-it threshold is 2%" (one extra word, removes the guess).

---

## Counts

| Severity | Count |
|---|---|
| FATAL | 1 |
| MAJOR | 4 |
| MINOR | 16 |
| NIT | 7 |

## Verdict

The copy is far better than typical civic-tech writing — the demo takeaways, animation narration, and page-order storytelling genuinely work for a lay reader. But the site's two highest-stakes sentences are its two weakest: the homepage "matching the official census total to the last digit" claim collides with the census number everyone can Google (F1), and the verifiability promise dead-ends at a placeholder where the repository link should be (M3). Fix F1, M1–M4, and the jargon-at-first-use cluster (m1–m6, m12), and this is a publishable, trustworthy public explainer.
