// Every value here is CONFIRMED in research/verdicts.json (CLAUDE.md rule 1).
// States without a residentPop have NOT had their population verified yet — the
// engine refuses to run them until the figure is added with a CONFIRMED verdict
// (Phase 5 adds the remaining 48 as verified claims before the national batch).

export const CELL_M = 1609.344; // 1 international statute mile in meters; 1 mi^2 = 640 acres

// epsg.io canonical PROJ string (verified claim proj4-epsg5070-proj-string).
// proj4 ships no 5070/3338 definitions by name — register via proj4.defs() before use.
export const PROJ_5070 =
  '+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';
export const PROJ_3338 = // Alaska Albers — unused in v1 (AK is at-large), kept for v2
  '+proj=aea +lat_1=55 +lat_2=65 +lat_0=50 +lon_0=-154 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs';
export const PROJ_HI = // Hawaii Albers (ESRI:102007 equivalent)
  '+proj=aea +lat_1=8 +lat_2=18 +lat_0=13 +lon_0=-157 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs';

// 2020 apportionment seats (verified claim full-50-state-seat-table vs Census Table C1 xlsx; sums to 435).
export const SEATS = {
  AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14,
  HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8,
  MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12,
  NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7,
  SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1,
};

// At-large states bypass grid + traversal entirely (district = state polygon).
export const AT_LARGE = ['AK', 'DE', 'ND', 'SD', 'VT', 'WY']; // verified claim at-large-states-six

// State FIPS codes (Census reference file www2.census.gov/geo/docs/reference/state.txt,
// fetched by the Phase-0 verifier; CO=08 individually CONFIRMED).
export const FIPS = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10',
  FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20',
  KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28',
  MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36',
  NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45',
  SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56',
};

// PL 94-171 RESIDENT populations — the figure census blocks sum to (FL-001 / PR-1).
// apportionmentPop (includes overseas personnel) is recorded for the distinction
// and must NEVER be a gate target.
// All 50 values: Census 2020 Apportionment Table 2 (apportionment-2020-table02.xlsx),
// parsed + self-checked in research/state_populations.json. Mechanical gates passed:
// 4 known values exact (CO/NY/MD/FL), Σ(50 states)=330,759,736, +DC(689,545)=331,449,281
// === the table's published TOTAL RESIDENT POPULATION. Each state is independently
// re-verified at grid build: buildGrid throws unless Σ POP20 === this value exactly (V1).
export const RESIDENT_POP = {
  AK: 733391,
  AL: 5024279,
  AR: 3011524,
  AZ: 7151502,
  CA: 39538223,
  CO: 5773714, // + V6 probe exact block-sum match
  CT: 3605944,
  DE: 989948,
  FL: 21538187, // + exact block-sum match (shakeout)
  GA: 10711908,
  HI: 1455271,
  IA: 3190369,
  ID: 1839106,
  IL: 12812508,
  IN: 6785528,
  KS: 2937880,
  KY: 4505836,
  LA: 4657757,
  MA: 7029917,
  MD: 6177224, // + exact block-sum match (shakeout)
  ME: 1362359,
  MI: 10077331,
  MN: 5706494,
  MO: 6154913,
  MS: 2961279,
  MT: 1084225,
  NC: 10439388,
  ND: 779094,
  NE: 1961504,
  NH: 1377529,
  NJ: 9288994,
  NM: 2117522,
  NV: 3104614,
  NY: 20201249, // + exact block-sum match (shakeout)
  OH: 11799448,
  OK: 3959353,
  OR: 4237256,
  PA: 13002700,
  RI: 1097379,
  SC: 5118425,
  SD: 886667,
  TN: 6910840,
  TX: 29145505,
  UT: 3271616,
  VA: 8631393,
  VT: 643077,
  WA: 7705281,
  WI: 5893718,
  WV: 1793716,
  WY: 576851,
};
export const APPORTIONMENT_POP_NEVER_FOR_GATES = {
  CO: 5782171, // verified claim co-apportionment-population-2020 (overseas add-on: 8,457)
};

/** Throws unless the state is fully verified and runnable. */
export function requireState(abbr) {
  if (!(abbr in SEATS)) throw new Error(`Unknown state ${abbr}`);
  if (AT_LARGE.includes(abbr)) return { abbr, fips: FIPS[abbr], seats: 1, atLarge: true };
  if (!(abbr in RESIDENT_POP))
    throw new Error(
      `${abbr} has no CONFIRMED resident population (research/verdicts.json). ` +
      `Verify it before running this state (CLAUDE.md rule 1).`
    );
  return { abbr, fips: FIPS[abbr], seats: SEATS[abbr], residentPop: RESIDENT_POP[abbr], atLarge: false };
}
