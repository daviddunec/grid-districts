# DISCUSSION DRAFT — NOT LEGAL ADVICE — FOR ILLUSTRATION OF THE STATUTORY MECHANICS ONLY

> This document is a discussion draft prepared to illustrate how the statutory
> mechanics of a transparency baseline could be structured. It is not legislation,
> not legal advice, and not a finished bill. Section numbering, cross-references, and
> defined terms are illustrative. Any actual bill would require drafting by competent
> legislative counsel and conformity review against existing federal election law.

---

# A BILL

To require public disclosure of a neutral congressional redistricting baseline and a
standardized comparison of each enacted congressional plan against that baseline.

## SECTION 1. SHORT TITLE.

This Act may be cited as the **"Fair And Identical Redistricting (FAIR) Baseline
Act"**.

## SECTION 2. FINDINGS.

Congress finds the following:

(1) The Elections Clause of the Constitution authorizes Congress to make or alter
regulations as to the Times, Places, and Manner of holding elections for
Representatives.

(2) Public confidence in congressional districting depends on the ability of any
citizen to evaluate an enacted plan against a neutral, reproducible reference using
the same measures applied uniformly to every State.

(3) It is technically demonstrated that a single deterministic, open-source process
can be applied uniformly to all fifty States to produce all four hundred thirty-five
congressional districts, conserving the resident population of the fifty States
exactly and producing output that is byte-for-byte reproducible on re-execution and
on reordered input.

(4) Disclosure of how an enacted plan compares to such a neutral baseline, and public
justification of material deviations, advances the integrity of congressional
elections without displacing the authority of a State to draw its own districts.

(5) Nothing in a neutral geometric baseline can, or should, substitute for the
protections of the Voting Rights Act of 1965; a baseline is a reference for
disclosure, not a binding map and not a limit on compliance with that Act.

## SECTION 3. DEFINITIONS.

In this Act:

(1) BASELINE MAP.—The term "baseline map" means, for a State, the assignment of that
State's territory and population to the number of congressional districts apportioned
to that State, computed by the Published Specification.

(2) ENACTED PLAN.—The term "enacted plan" means the congressional districting plan
that has the force of law in a State for an election cycle, however adopted.

(3) PUBLISHED SPECIFICATION.—The term "Published Specification" means the open,
publicly available document and source code that define the baseline computation and
each Standard Metric, maintained by the Custodian under Section 6.

(4) STANDARD METRIC.—The term "Standard Metric" means each of the metrics defined in
the Published Specification, comprising at minimum population deviation, a compactness
measure, county splits, and a baseline-divergence score.

(5) CUSTODIAN.—The term "Custodian" means the Federal entity designated under
Section 6 to compute and publish the baseline map and the Published Specification.

(6) VINTAGE.—The term "vintage" means the identification of the decennial census,
the apportionment, and the seat allocation from which a baseline map was computed.

## SECTION 4. BASELINE PUBLICATION REQUIREMENT.

(a) IN GENERAL.—Not later than ninety days after each apportionment following a
decennial census, the Custodian shall compute and publish a baseline map for each
State by applying the Published Specification uniformly to every State.

(b) WHERE PUBLISHED.—The Custodian shall publish, for each State and without charge:
(1) the baseline map; (2) the value of each Standard Metric for the baseline map;
(3) the vintage of the baseline map; and (4) the source code and input data
sufficient for any person to reproduce the baseline map.

(c) REPRODUCIBILITY.—The baseline computation shall be deterministic. The Custodian
shall publish, for each State's baseline map, a cryptographic hash of the output, and
the published output shall be byte-for-byte identical on re-execution of the
published code against the published input.

(d) ANNUAL RE-EXECUTION.—The Custodian shall re-execute the published code not less
than once each year and shall confirm that each State's published baseline map
remains byte-for-byte identical, except where a change of vintage under subsection (e)
requires recomputation. Any change in a published hash absent a change of vintage
shall be disclosed with an explanation.

(e) VINTAGE REFRESH.—The substantive inputs to the baseline map shall be refreshed
only upon a new apportionment following a decennial census. Each published artifact
shall state its vintage, and the Custodian shall flag any published baseline computed
from a superseded vintage.

## SECTION 5. ENACTED-PLAN COMPARISON DISCLOSURE REQUIREMENT.

(a) IN GENERAL.—A State that enacts a congressional districting plan shall publish,
concurrently with the plan taking effect, a comparison disclosure under this Section.

(b) CONTENTS.—The comparison disclosure shall state, for the enacted plan and for the
baseline map of the same vintage, the value of each Standard Metric, computed by the
methods set out in the Published Specification.

(c) JUSTIFICATION OF DEVIATIONS.—Where the enacted plan deviates materially from the
baseline map on any Standard Metric, as defined by the threshold in the Published
Specification, the comparison disclosure shall state the reason for the deviation in
plain language and shall identify any deviation undertaken to comply with Federal or
State law, including the Voting Rights Act of 1965.

(d) FORM AND ACCESS.—The comparison disclosure shall be published without charge in a
machine-readable form prescribed by the Published Specification and shall remain
publicly available for the life of the enacted plan.

(e) NO BINDING EFFECT.—This Section requires disclosure and justification only.
Nothing in this Act requires a State to adopt the baseline map, conform an enacted
plan to the baseline map, or treat the baseline map as a ceiling, floor, or
presumption as to the lawfulness of any enacted plan.

## SECTION 6. THE PUBLISHED SPECIFICATION AND CUSTODIAN.

(a) DESIGNATION.—The [Director of the Census Bureau / Comptroller General] is
designated as the Custodian and shall maintain the Published Specification.

(b) OPENNESS.—The Published Specification, including all source code and the
definition of each Standard Metric, shall be open and publicly available at no
charge, in a form that permits independent reproduction of every published baseline
map and metric value.

(c) DEFINITION BY REFERENCE.—Each Standard Metric required by this Act is defined by
reference to the Published Specification. A metric shall not be computed for purposes
of this Act by any method other than the one set out in the Published Specification,
and any change to a metric definition shall be published, dated, and assigned a
vintage before it takes effect.

(d) MIRRORING.—The Custodian may satisfy the publication requirements of this Act in
whole or in part through an open public repository, provided that the Custodian
maintains an authoritative Federal mirror of each published artifact and its hash.

## SECTION 7. RULE OF CONSTRUCTION; SAVINGS CLAUSE (VOTING RIGHTS ACT).

(a) NO PREEMPTION OF THE VOTING RIGHTS ACT.—Nothing in this Act supersedes, limits,
or otherwise affects the application of the Voting Rights Act of 1965 or any other
Federal law protecting the right to vote. The baseline map is a neutral geometric
reference and is not evidence of compliance or noncompliance with any such law.

(b) NO PREEMPTION OF STATE AUTHORITY TO DRAW DISTRICTS.—Nothing in this Act
authorizes the Custodian or any Federal entity to draw, impose, or require any
congressional district. The authority to enact a congressional districting plan
remains with the States.

(c) DISCLOSURE ONLY.—This Act imposes obligations of computation, publication,
comparison, and justification. It creates no presumption as to the validity of any
enacted plan.

## SECTION 8. EFFECTIVE DATE.

(a) IN GENERAL.—This Act takes effect on the date of enactment.

(b) APPLICATION.—The baseline publication requirement of Section 4 and the comparison
disclosure requirement of Section 5 apply beginning with the next apportionment
following the next decennial census after enactment, and to each enacted plan adopted
on the basis of that apportionment.

---

*End of discussion draft. Bracketed designations indicate choices to be resolved in
drafting. This draft is for illustration of statutory mechanics only and is not legal
advice.*

Reviewed by: __________  Date: __________
