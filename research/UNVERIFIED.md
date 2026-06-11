# UNVERIFIED CLAIMS — quarantine

Rule (CLAUDE.md #1): values listed here are NEVER hardcoded into `src/`.

## intptlat20-intptlon20-decimal-string
- **Claim:** INTPTLAT20/INTPTLON20 store internal points as signed decimal-degree strings with a leading sign character.
- **Verifier result:** UNCONFIRMED — the TIGER tech doc confirms both fields are type String but never uses the words "signed decimal-degree."
- **Resolution: CONFIRMED BY MECHANICAL PROBE (stronger evidence).** `scripts/verify/probe-tabblock.js` parsed real Colorado data: `parseFloat(INTPTLAT20/LON20)` yields finite coordinates on all 140,345 blocks. Safe to rely on `parseFloat`; the *prose framing* stays unverified, the *behavior* is proven.

## co-land-area-sqmi
- **Claim:** Colorado land area ≈ 103,642 sq mi.
- **Verifier result:** UNCONFIRMED — the cited Census density PDF implies ~103,657 sq mi (5,773,714 ÷ 55.7) and the exact value 103,642 was not found as text.
- **Status: QUARANTINED.** Used only as an order-of-magnitude sanity check on grid cell counts (expect ~104k in-state cells). Never hardcoded as an assertion target. The real sanity check uses Σ ALAND20 from the DBF itself.
