# Hard Questions, Answered

This document states the strongest objections to a deterministic, open-source
redistricting baseline and answers each one directly. Where the honest answer is a
limit on the proposal, it is stated as a limit. The proposal is a *transparency
baseline* — a neutral reference that enacted plans are published against and that
states justify their deviations from. It is not a binding map and does not draw any
state's districts. Several answers below turn on that distinction.

---

### 1. Doesn't a neutral geometric map harm minority representation and undermine the Voting Rights Act?

This is the hardest objection and the one the design takes most seriously. A purely
geometric baseline cannot see race and will not, on its own, produce the majority-
minority districts the Voting Rights Act sometimes requires. The answer is structural:
**the baseline is not binding.** It is a reference that enacted plans are measured
against, not a map any state must adopt. The model bill contains an explicit savings
clause stating that nothing in it supersedes or limits the Voting Rights Act, and that
the baseline is not evidence of compliance or noncompliance with it. A state that
draws VRA-required districts will diverge from the baseline on the published metrics —
and the regime asks exactly that the state *say so and justify it in public*.
Surfacing a VRA-driven deviation is the system working, not failing.

### 2. The baseline ignores communities of interest.

Correct, and intentionally so. A geometric baseline cannot know which neighborhoods
share schools, watersheds, media markets, or economic ties. But communities of
interest are precisely the kind of legitimate reason a state would deviate from the
baseline — and under the disclosure regime, that deviation is named and justified
rather than hidden. The baseline does not claim communities of interest don't matter;
it makes the choice to honor them visible and accountable.

### 3. "Squares don't respect real geography."

Two responses. First, the production national run does **not** ship the square method
— it ships the shortest-line method, which proved the most geography-robust of the
approaches tested across all 50 states. The square-block, center-out method is an
active research arm, not the baseline that was actually run nationally. Second, the
baseline is a comparator, not a state's enacted map. Its job is to be neutral and
reproducible, not to be the prettiest map. Where real geography demands a non-
geometric line, the enacted plan can draw it — and disclose the divergence.

### 4. The baseline splits counties.

County integrity is one of the most legible measures of fair districting, which is
why county splits are a named metric in the published specification and reported in
the enacted-plan comparison. Note one honesty point: county-split counting is part of
what the *transparency regime* adds via the published spec — it is a specified metric
computed at publication, not a number the current reference build already emits. The
point of putting it in the comparison is that a plan splitting far more counties than
the neutral reference has to account for it.

### 5. "The baseline's deviation isn't zero like an enacted map's."

True, and worth understanding. Enacted plans are drawn to essentially zero population
deviation because mapmakers move individual blocks to hit it. The baseline works from
1-square-mile cells, so it cannot shave to zero — but the measured results are still
very tight: across the 50-state run, the worst-district deviation is well under one
percent in the large majority of states. And precision here is a feature, not a
defect: the baseline is a neutral comparator, not the final enacted map. A state that
wants zero deviation draws it and discloses the (tiny) divergence from the reference.

### 6. Why are dense cities flagged with larger deviations?

In a handful of dense-metropolitan states — New York, California, Illinois, New Jersey
— a single ultra-dense square-mile cell can hold more people than a whole district's
population quota, which mathematically prevents a coarse-grid baseline from hitting
the tight gate there. The system **flags these states rather than pretending they
pass**, and reports the deviation honestly. That transparency is the design: the
baseline discloses its own rough edges, which is exactly the standard an enacted-plan
disclosure regime should be held to.

### 7. "Algorithms can be gamed — who controls the code?"

No one needs to be trusted, because the process is deterministic and open. The same
code on the same public data produces byte-for-byte identical output — verified by
SHA-256 hash, and verified to be identical even when the input order is deliberately
shuffled. The code and data are public. Anyone — a rival party, a journalist, a court-
appointed expert — can re-run it and confirm the published map to the byte. A baseline
you can recompute yourself cannot be quietly gamed; a discrepancy would be visible to
everyone who runs it.

### 8. Why 1 square mile?

A 1-square-mile (640-acre) cell is a deliberate balance: fine enough to follow
population density across a state, coarse enough to run deterministically over the
whole country in a tractable time and to produce a stable, inspectable reference.
For the *baseline-comparator* role, that resolution is the right tool. The long-run
default-map pathway contemplates a finer, block-level variant — but a state's actual
enacted map, not the neutral reference, is where block-level resolution belongs.

### 9. "This helps party X" / "this hurts party Y."

The algorithm cannot see party. There is no voter-registration, vote-history, or
partisan input anywhere in the process — it reads census population and geography and
nothing else. Whatever partisan tilt a baseline map shows in a given state is simply
what that state's geography and population produce, not a thumb on the scale. The
measured outcomes are whatever geography gives. That is the strongest guarantee of
neutrality available: not a promise of balance, but the structural inability to aim.

### 10. What about Alaska, Hawaii, and island geography?

States with a single at-large seat (including Alaska) are trivial — the district is
the state. Hawaii and other multi-island or coastal states were part of the 50-state
run; the system handles non-contiguous landmasses through virtual bridges that count
as connections, so each district remains a single connected piece. Some of these
states are flagged for review, and the system reports that honestly rather than
glossing it.

### 11. How does the baseline handle districts across water?

Contiguity is enforced as one connected component per district, and water crossings
are handled by virtual bridges that count as legitimate connections — the same way
real districts span bays, rivers, and straits. This was exercised in the national run
on exactly the coastal and island geographies where it matters, and every shipped
district passes the one-connected-piece test.

### 12. "Congress lacks the power to do this."

The proposal is grounded in the Elections Clause, which gives Congress authority over
the Times, Places, and Manner of congressional elections. The bill mandates
*disclosure* — publish a neutral baseline, publish a standardized comparison, justify
deviations — and explicitly does not draw, impose, or require any district, and does
not preempt state authority to draw maps. A manner-of-elections disclosure rule sits
well within established Elections Clause practice; this is far less intrusive than
federal standards Congress has already imposed on congressional elections.

### 13. "Why not just use independent commissions?"

Commissions and this baseline are complementary, not competing. A commission still
needs a neutral reference to measure its own work against, and an Iowa-style process
is strengthened, not replaced, by a reproducible baseline that no party controls. A
state can adopt the baseline as the starting point its commission refines, or as the
benchmark it reports against. The baseline also reaches the states that have *no*
commission — through the disclosure mandate — which a commission-only approach never
will.

### 14. What's actually new here? Isn't this just the old "shortest-splitline" idea?

Credit where due: the shortest-line / shortest-splitline method has a long lineage,
and the production baseline uses it as the geography-robust arm. What is new is not
the cut rule. It is **(a)** a full verification regime — exact population conservation
to the person (the 50-state resident total, 330,759,736), one-connected-piece
contiguity, and determinism proven by SHA-256 equality across re-runs *and* shuffled
input; **(b)** grid determinism — a fixed, reproducible 1-square-mile process that
gives byte-identical output, not just a method described on paper; **(c)** open
reproducibility — code and data published so anyone can recompute the result; and
**(d)** the square-block research arm, a distinct center-out, squares-first method
carried alongside the baseline. The contribution is turning a known cut rule into a
verified, reproducible, openly-checkable public reference.

### 15. Has this been run, or is it a proposal on paper?

It has been run. The same process produced all 435 congressional districts across all
50 states, conserving the 50-state resident population exactly (330,759,736), with
every district a single connected piece and output verified byte-identical across
re-runs and shuffled input. The known rough edges — the flagged dense-city states and
the count of irregular-shaped districts nationwide — are reported in the public
summary, not hidden. No skill or claim here implies an accuracy it has not measured.

Reviewed by: __________  Date: __________
