# Implementation Pathways

This chapter sets out how a deterministic, open-source congressional redistricting
baseline can move from a working reference system into public institutions. It does
not propose that the federal government draw any state's districts. It proposes that
the country gain a neutral, reproducible reference map against which every enacted
plan can be measured in the open.

The reference system already exists and has been run. The same process was applied
to all 50 states, producing all 435 congressional districts. Population is conserved
exactly: the assigned resident total equals the 2020 census resident population of
the 50 states, 330,759,736, to the person. Every district is a single connected
piece. The output is byte-identical across re-runs and across a deliberately
shuffled input ordering — determinism verified by SHA-256 equality, not by
inspection. The input data (2020 Census redistricting blocks) and the code are open.
These are the facts the pathways below rest on; nothing here assumes a capability
that has not been demonstrated.

The pathways are ordered by how little they ask of the political system. The first
asks only for disclosure. The last, years out, asks the most. A reader can support
the first without committing to any of the others.

---

## Pathway 1 (primary): a federal transparency baseline

The core proposal is a disclosure mandate, not a drawing mandate. After each
decennial cycle, a neutral baseline map would be computed and published for every
state by the same public process. When a state enacts its congressional plan, the
state would publish, alongside the enacted map, a standardized comparison against
that baseline. Where the enacted plan departs from the neutral reference, the
departure would be stated and justified in public.

The comparison is a fixed, short set of metrics defined by reference to a published
open specification, so that the same numbers are computed the same way for every
state and every cycle:

- **Population deviation** — the worst district's percentage departure from the
  equal-population ideal. This is already produced by the reference system for all
  50 states and is the system's strongest result: most states land far below a
  one-percent worst-district deviation, with the few exceptions confined to dense
  metropolitan geography (discussed below).
- **Compactness** — a squareness/shape measure on every district. The reference
  system scores this today and reports the count of irregular districts per state.
- **County splits** — how many counties an enacted plan divides relative to the
  baseline. This metric is *defined in the published specification and computed at
  publication time*; it is part of what the baseline regime would add, not a number
  the current reference build already emits. It is included because county integrity
  is one of the most common, most legible measures of gerrymandering.
- **Baseline-divergence score** — a single summary number expressing how far an
  enacted plan sits from the neutral reference. Like county splits, this is a
  specified metric to be computed under the regime, not an existing output. Its
  definition lives in the open spec so it cannot be tuned to a result.

The constitutional footing is the Elections Clause, which gives Congress authority
over the "Times, Places and Manner" of congressional elections. Mandating that
states publish a standardized comparison and justify deviations is a manner-of-
elections disclosure rule. It does not preempt a state's choice of map, does not
install a federal map, and does not bind any state to the baseline. It changes one
thing: a state that draws unusual lines must say so, in public, in comparable terms.

The honest framing matters. The baseline is a reference, not a verdict. There are
legitimate reasons an enacted plan should diverge from a purely geometric map — the
Voting Rights Act foremost among them. The transparency regime is built to surface
divergence and require its justification, not to penalize it.

---

## Pathway 2: state adoption

Nothing in Pathway 1 requires a state to wait for Congress. A state commission or
legislature can adopt the neutral baseline directly — as the starting point its
process refines, or as the benchmark its own map is measured against. Iowa is the
standing precedent: a nonpartisan process draws plans against fixed, neutral
criteria, and the legislature votes them up or down. A published, reproducible
baseline gives any state that wants Iowa-style discipline a turnkey reference,
already computed for its geography, that no party controls and anyone can re-run.

Adoption here is voluntary and incremental. A single state can use the baseline as a
benchmark with no change in federal law, and the more states that do, the more the
standardized metrics become a common vocabulary across the country.

---

## Pathway 3: a litigation and expert tool

Redistricting is litigated constantly, and courts already reason about whether a
challenged map is an outlier. A deterministic, open baseline is well suited to that
role as a neutral comparator. Because the process is reproducible — identical output
on re-run and on shuffled input, verified by hash — opposing experts can run the
same code on the same public data and get the same map, removing a whole category of
"my model versus your model" dispute. The baseline does not tell a court what is
legal; it gives the court a fixed, inspectable reference point that neither party
authored, against which a challenged plan's deviation can be quantified in the same
terms used everywhere else.

This pathway requires no legislation at all. It depends only on the system being
open, reproducible, and documented — which it is.

---

## Pathway 4 (long-run): a default-map fallback

The most ambitious pathway is also the furthest out and rests on a refined,
block-level variant of the engine rather than the 1-square-mile grid used for the
reference run. Several states already see courts impose congressional maps when a
legislature deadlocks or misses a deadline; the map of last resort exists today, it
is simply drawn ad hoc. A neutral, pre-published default — the baseline map — could
serve as that fallback when a state misses its deadline.

The point is not that the default map is ideal. It is that the *existence* of a
neutral default changes the negotiation. Today, a faction that benefits from
deadlock can run out the clock and let a court draw lines. If the consequence of
missing the deadline is a known, neutral, geometry-driven map, the incentive to
stall weakens, because no side can assume the fallback favors it — the algorithm
cannot see party, and the result is whatever the geography gives.

This pathway is explicitly downstream of further engineering. The reference run was
done on a coarse grid that is excellent for a baseline comparator but too blunt to
be a state's actual enacted map without block-level refinement. It is listed as a
long-run direction, conditioned on that work, not as something ready to enact.

---

## Keeping the baseline current: the annual-update mechanism

A baseline is only useful if it is current and if its currency is itself
transparent. The mechanism has two cadences:

- **Annual code re-run.** The open code is re-executed every year. This is a
  software-maintenance cadence: it catches dependency drift, confirms the
  determinism guarantee still holds (the hash of each state's output should not move
  unless an input did), and keeps the published artifacts live rather than stale.
  Because the process is deterministic, an unchanged input must produce an unchanged
  output; any annual-run hash change is a signal that something upstream moved and is
  worth an explanation.
- **Decennial input refresh.** The legally relevant inputs — census population and
  the apportionment that sets each state's seat count — change on the decennial
  cycle. The baseline's substantive content refreshes then. Between censuses the map
  is stable by design, matching how districts actually function.

Tying these together is **vintage detection**: every published artifact carries the
vintage of the data it was built from (which census, which apportionment, which seat
allocation). A consumer of the baseline can always tell which decade's data a given
map reflects, and the system can flag when a published baseline is running on inputs
that a newer vintage has superseded. This prevents the most basic failure mode of a
public reference — quietly comparing a current enacted plan against a stale baseline.

---

## Where the baseline would live: institutional home options

The regime needs a custodian: an institution that computes the baseline, publishes
the artifacts and the metric specification, and runs the annual and decennial
cadences. Several homes are plausible, and the choice is a policy decision rather
than a technical one:

- **The Census Bureau.** It already owns the underlying redistricting data and the
  decennial cadence, and is the natural source of the population inputs the baseline
  consumes. Housing the baseline beside the data it depends on minimizes vintage and
  provenance risk.
- **The Government Accountability Office.** As a nonpartisan congressional support
  agency, GAO is suited to publishing standardized comparisons and to the oversight
  framing of "did the state disclose and justify its deviations."
- **An open public repository with federal mirroring.** Because the code and data
  are open and the output is reproducible by anyone, the baseline can live in a
  public repository that a federal institution mirrors for authority and
  permanence. This option leans hardest on the system's core property: the custodian
  does not have to be trusted, because anyone can re-run the code and confirm the
  published map byte-for-byte.

These are not mutually exclusive. A workable arrangement is a federal custodian for
authority and the decennial inputs, with the open repository as the reproducibility
backstop — so that the baseline is both official and independently checkable. Across
every pathway, the same property does the work: the map is not something the public
is asked to trust, it is something the public can recompute.

---

## A note on the known rough edges

Precision requires naming where the reference run is not clean. Of the 50 states,
the equal-population result is excellent in the large majority; a small set of dense-
metropolitan states (the same New York / California / Illinois / New Jersey class
where a single ultra-dense square-mile cell can exceed a whole district's population
quota) are flagged rather than treated as passing, and the system reports them as
such rather than hiding the deviation. Across the national run, 349 districts are
flagged as irregular in shape, and the reference uses the shortest-splitline method as its
production arm because it proved the most geography-robust of the approaches tested;
the center-out square-block method is carried as the active research direction. None
of this undercuts the transparency case — it is, in fact, the case. A baseline that
reports its own flagged states and irregular districts in public is exactly the kind
of reference an enacted-plan disclosure regime should be measured against.

Reviewed by: __________  Date: __________
