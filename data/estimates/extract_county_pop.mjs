// Extract Vintage 2025 county population estimates (SUMLEV 050, 50 states only)
// from co-est2025-alldata.csv and run mechanical gates against state_pop_2025.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(dir, 'co-est2025-alldata.csv');
const statePath = path.join(dir, 'state_pop_2025.json');
const outPath = path.join(dir, 'county_pop_2025.json');

// latin1: Census popest CSVs use ISO-8859-1 (e.g. Dona Ana). We only need numerics + FIPS.
const raw = fs.readFileSync(csvPath, 'latin1');

// Minimal RFC4180 parser (handles quoted fields with commas).
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCSV(raw);
const header = rows[0];
const col = Object.fromEntries(header.map((h, i) => [h, i]));
for (const need of ['SUMLEV', 'STATE', 'COUNTY', 'STNAME', 'ESTIMATESBASE2020', 'POPESTIMATE2025']) {
  if (!(need in col)) { console.error('MISSING COLUMN: ' + need); process.exit(1); }
}

// Standard state-name -> USPS abbreviation map (50 states; DC/PR intentionally absent).
const NAME2ABBR = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
  'Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID',
  'Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
  'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS',
  'Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
  'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
  'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA',
  'West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};

const counties = {};   // fips -> {base2020, est2025}
const stateSums = {};  // abbr -> sum of county POPESTIMATE2025
const skipped = new Set(); // STNAMEs of SUMLEV 050 rows excluded (DC, PR, anything unmapped)
let badNum = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (row[col.SUMLEV] !== '050') continue;
  const stname = row[col.STNAME];
  const abbr = NAME2ABBR[stname];
  if (!abbr) { skipped.add(stname); continue; } // excludes District of Columbia, Puerto Rico
  const fips = row[col.STATE].padStart(2, '0') + row[col.COUNTY].padStart(3, '0');
  const base2020 = Number(row[col.ESTIMATESBASE2020]);
  const est2025 = Number(row[col.POPESTIMATE2025]);
  if (!Number.isFinite(base2020) || !Number.isFinite(est2025)) { badNum++; continue; }
  if (counties[fips]) { console.error('DUPLICATE FIPS: ' + fips); process.exit(1); }
  counties[fips] = { base2020, est2025 };
  stateSums[abbr] = (stateSums[abbr] || 0) + est2025;
}

const fipsSorted = Object.keys(counties).sort();
const n = fipsSorted.length;

// ---- Gates ----
const gates = [];

// (a) county count
gates.push(`GATE a (county count 3000-3200): count=${n} -> ${n >= 3000 && n <= 3200 ? 'PASS' : 'FAIL'}`);

// (b) per-state sums vs state_pop_2025.json est2025
const stateFile = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const mismatches = [];
let matches = 0;
const abbrs = Object.keys(NAME2ABBR).map(k => NAME2ABBR[k]).sort();
for (const ab of abbrs) {
  const expected = stateFile.states?.[ab]?.est2025;
  const got = stateSums[ab];
  if (expected === undefined) { mismatches.push(`${ab}: missing in state_pop_2025.json`); continue; }
  if (got === undefined) { mismatches.push(`${ab}: no county rows found`); continue; }
  if (got === expected) matches++;
  else mismatches.push(`${ab}: countySum=${got} stateFile=${expected} delta=${got - expected}`);
}
gates.push(`GATE b (50-state sum match): ${matches}/50 states match EXACTLY -> ${matches === 50 ? 'PASS' : 'FAIL'}${mismatches.length ? ' | mismatches: ' + mismatches.join('; ') : ''}`);

// (c) Connecticut FIPS codes
const ctFips = fipsSorted.filter(f => f.startsWith('09'));
gates.push(`GATE c (CT FIPS for state 09): ${ctFips.length} codes: ${ctFips.join(', ')}`);

// (d) Los Angeles spot check
const la = counties['06037'];
const laOk = la && la.est2025 > 9_000_000 && la.est2025 < 11_000_000;
gates.push(`GATE d (LA 06037 est2025 in 9-11M): ${la ? la.est2025 : 'MISSING'} -> ${laOk ? 'PASS' : 'FAIL'}`);

if (skipped.size) gates.push(`NOTE: excluded SUMLEV 050 rows from: ${[...skipped].join(', ')}`);
if (badNum) gates.push(`NOTE: ${badNum} rows had non-numeric values (skipped)`);

// ---- Write output ----
// Serialize counties manually: JS objects reorder integer-like keys ("10001")
// ahead of leading-zero keys ("01001"), so JSON.stringify would break FIPS order.
const countyLines = fipsSorted
  .map(f => `  "${f}": {"base2020": ${counties[f].base2020}, "est2025": ${counties[f].est2025}}`)
  .join(',\n');
const json = `{
 "source": "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv",
 "vintage": "2025",
 "retrieved": "2026-06-11",
 "asOf": "2025-07-01",
 "counties": {
${countyLines}
 }
}
`;
JSON.parse(json); // validate before writing
fs.writeFileSync(outPath, json);

console.log('counties captured: ' + n);
for (const g of gates) console.log(g);
console.log('wrote: ' + outPath);
