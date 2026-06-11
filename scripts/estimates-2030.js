// 2025 ESTIMATES + 2030 APPORTIONMENT PREVIEW -> site/data/estimates.json
//
// Inputs (written by verification agents from official census.gov sources only):
//   data/estimates/state_pop_2025.json            Vintage 2025 estimates (July 1, 2025)
//   data/estimates/apportionment_2020_official.json  official 2020 apportionment Table 1
//
// Gates (all must pass or this script exits 1 and writes nothing):
//   G1  both inputs present, 50 states each
//   G2  ESTIMATESBASE2020 within 0.5% of the verified census resident pop, every state
//       (the estimates base may carry small official corrections; large drift = wrong file)
//   G3  the Huntington-Hill implementation below reproduces the OFFICIAL 2020 apportionment
//       (all 50 states, exact) from the official 2020 apportionment populations
//   G4  official 2020 seats in the fetched table match src/constants.js SEATS exactly
//
// Only after G1-G4 does it apply Huntington-Hill to the July 2025 resident estimates to
// produce the "seats if apportioned on today's numbers" preview. That preview is a labeled
// projection: actual 2030 apportionment will use the 2030 count incl. overseas personnel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const { SEATS, RESIDENT_POP } = await import('../src/constants.js');

const fail = (msg) => { console.error('GATE FAIL: ' + msg); process.exit(1); };

// ---- G1: load inputs ----
const estPath = 'data/estimates/state_pop_2025.json';
const appPath = 'data/estimates/apportionment_2020_official.json';
if (!fs.existsSync(estPath)) fail(`${estPath} missing — run the fetch agents first`);
if (!fs.existsSync(appPath)) fail(`${appPath} missing — run the fetch agents first`);
const EST = JSON.parse(fs.readFileSync(estPath, 'utf8'));
const APP = JSON.parse(fs.readFileSync(appPath, 'utf8'));
const abbrs = Object.keys(SEATS).sort();
if (Object.keys(EST.states).length !== 50) fail(`estimates file has ${Object.keys(EST.states).length} states`);
if (Object.keys(APP.states).length !== 50) fail(`apportionment file has ${Object.keys(APP.states).length} states`);
for (const ab of abbrs) {
  if (!EST.states[ab]) fail(`estimates missing ${ab}`);
  if (!APP.states[ab]) fail(`apportionment missing ${ab}`);
}

// ---- G2: estimates base vs verified census resident pop ----
let maxBaseDrift = 0, maxBaseState = '';
for (const ab of abbrs) {
  const base = EST.states[ab].base2020, res = RESIDENT_POP[ab];
  const drift = Math.abs(base - res) / res;
  if (drift > maxBaseDrift) { maxBaseDrift = drift; maxBaseState = ab; }
  if (drift > 0.005) fail(`${ab} ESTIMATESBASE2020 ${base} drifts ${(drift * 100).toFixed(3)}% from census resident ${res}`);
}
console.log(`G2 PASS: estimates base matches census residents (max drift ${(maxBaseDrift * 100).toFixed(4)}% in ${maxBaseState})`);

// ---- Huntington-Hill (method of equal proportions; 50 seats guaranteed, then 385 by priority) ----
function apportion(pops, totalSeats = 435) {
  const names = Object.keys(pops).sort(); // deterministic iteration
  const seats = {};
  names.forEach((s) => { seats[s] = 1; });
  for (let assigned = names.length; assigned < totalSeats; assigned++) {
    let best = null, bestP = -1;
    for (const s of names) {
      const n = seats[s];
      const P = pops[s] / Math.sqrt(n * (n + 1));
      // tie-break: larger population, then alphabetical (ties are theoretical at this scale)
      if (P > bestP || (P === bestP && (best === null || pops[s] > pops[best]))) { best = s; bestP = P; }
    }
    seats[best]++;
  }
  return seats;
}

// ---- G3 + G4: reproduce the official 2020 apportionment exactly ----
const appPops = {}; for (const ab of abbrs) appPops[ab] = APP.states[ab].apportionmentPop;
const hh2020 = apportion(appPops, 435);
let sumOfficial = 0;
for (const ab of abbrs) {
  const official = APP.states[ab].seats;
  sumOfficial += official;
  if (official !== SEATS[ab]) fail(`G4: fetched official seats for ${ab} (${official}) != constants SEATS (${SEATS[ab]})`);
  if (hh2020[ab] !== official) fail(`G3: Huntington-Hill gives ${ab} ${hh2020[ab]} seats; official 2020 = ${official}`);
}
if (sumOfficial !== 435) fail(`official seats sum ${sumOfficial} != 435`);
console.log('G3 PASS: Huntington-Hill reproduces the official 2020 apportionment exactly (50/50 states, 435 seats)');
console.log('G4 PASS: fetched official 2020 seats match src/constants.js SEATS');

// ---- the 2030 preview on July 1, 2025 resident estimates ----
const estPops = {}; for (const ab of abbrs) estPops[ab] = EST.states[ab].est2025;
const proj = apportion(estPops, 435);
const states = {};
let estTotal = 0;
for (const ab of abbrs) {
  const e = EST.states[ab];
  estTotal += e.est2025;
  states[ab] = {
    est2025: e.est2025,
    pctChange: (e.est2025 - RESIDENT_POP[ab]) / RESIDENT_POP[ab] * 100,
    projSeats2030: proj[ab],
    seatDelta: proj[ab] - SEATS[ab],
  };
}
const censusTotal = abbrs.reduce((a, ab) => a + RESIDENT_POP[ab], 0);
const deltas = abbrs.filter((ab) => states[ab].seatDelta !== 0)
  .sort((a, b) => states[b].seatDelta - states[a].seatDelta || a.localeCompare(b));
const out = {
  provenance: {
    estimates: { source: EST.source, vintage: EST.vintage, asOf: EST.asOf, retrieved: EST.retrieved },
    apportionment2020: { source: APP.source, retrieved: APP.retrieved },
    method: 'Huntington-Hill (method of equal proportions), verified by reproducing the official 2020 apportionment exactly before use',
    caveat: 'Projection applies the official method to July 1, 2025 resident-population ESTIMATES. Actual 2030 apportionment will use the 2030 census count, which includes overseas federal personnel.',
  },
  national: { censusTotal, est2025Total: estTotal, pctChange: (estTotal - censusTotal) / censusTotal * 100 },
  states,
  seatChanges: deltas.map((ab) => ({ abbr: ab, delta: states[ab].seatDelta, projSeats: states[ab].projSeats2030 })),
};
fs.mkdirSync('site/data', { recursive: true });
fs.writeFileSync('site/data/estimates.json', JSON.stringify(out, null, 1));
const gain = deltas.filter((ab) => states[ab].seatDelta > 0).map((ab) => `${ab}+${states[ab].seatDelta}`).join(' ');
const lose = deltas.filter((ab) => states[ab].seatDelta < 0).map((ab) => `${ab}${states[ab].seatDelta}`).join(' ');
console.log(`2025 estimate total (50 states): ${estTotal.toLocaleString('en-US')} (${out.national.pctChange.toFixed(2)}% vs census)`);
console.log(`2030 preview on 2025 estimates — gainers: ${gain || 'none'} | losers: ${lose || 'none'}`);
console.log('wrote site/data/estimates.json');
