// Extract Vintage 2025 state population estimates from NST-EST2025-ALLDATA.csv
// and run mechanical verification gates. No fabricated values: everything read from the CSV.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'C:/Users/david/Downloads/Claude Personal App/redistricting/data/estimates';
const csvPath = path.join(dir, 'NST-EST2025-ALLDATA.csv');
const raw = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');

// Minimal CSV parser (handles quoted fields just in case)
function parseLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
const header = parseLine(lines[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const need = ['SUMLEV','STATE','NAME','ESTIMATESBASE2020','POPESTIMATE2021','POPESTIMATE2022','POPESTIMATE2023','POPESTIMATE2024','POPESTIMATE2025'];
for (const n of need) if (!(n in col)) throw new Error('Missing column: ' + n);

const rows = lines.slice(1).map(parseLine);
const get = (r, name) => r[col[name]];
const num = (r, name) => {
  const v = Number(get(r, name));
  if (!Number.isFinite(v)) throw new Error(`Non-numeric ${name} in row ${get(r,'NAME')}: "${get(r,name)}"`);
  return v;
};

const NAME_TO_USPS = {
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

const sumlev040 = rows.filter(r => get(r, 'SUMLEV') === '040');
const states = sumlev040.filter(r => get(r, 'NAME') !== 'District of Columbia' && get(r, 'NAME') !== 'Puerto Rico');
const dcRow = sumlev040.find(r => get(r, 'NAME') === 'District of Columbia');
const prRow = sumlev040.find(r => get(r, 'NAME') === 'Puerto Rico');
const usRow = rows.find(r => get(r, 'SUMLEV') === '010');

// ---- Gate a: exactly 50 states ----
console.log(`GATE_A states_captured=${states.length} ${states.length === 50 ? 'PASS' : 'FAIL'}`);

// ---- Gate b: national row decomposition ----
const us2025 = num(usRow, 'POPESTIMATE2025');
const sumStates = states.reduce((a, r) => a + num(r, 'POPESTIMATE2025'), 0);
const sumStatesDC = sumStates + num(dcRow, 'POPESTIMATE2025');
const sumStatesDCPR = sumStatesDC + num(prRow, 'POPESTIMATE2025');
console.log(`GATE_B us_pop2025=${us2025}`);
console.log(`GATE_B sum_50states=${sumStates} diff_vs_us=${us2025 - sumStates}`);
console.log(`GATE_B sum_50states_plus_DC=${sumStatesDC} diff_vs_us=${us2025 - sumStatesDC}`);
console.log(`GATE_B sum_50states_plus_DC_plus_PR=${sumStatesDCPR} diff_vs_us=${us2025 - sumStatesDCPR}`);

// ---- Gate c: every state est2025 within +/-10% of base2020 ----
let cFail = 0;
for (const r of states) {
  const base = num(r, 'ESTIMATESBASE2020');
  const est = num(r, 'POPESTIMATE2025');
  const pct = (est - base) / base * 100;
  if (Math.abs(pct) > 10) {
    cFail++;
    console.log(`GATE_C OUTLIER ${get(r, 'NAME')} base2020=${base} est2025=${est} pct=${pct.toFixed(2)}%`);
  }
}
// also report the max movers for context
const moves = states.map(r => ({ n: get(r, 'NAME'), pct: (num(r,'POPESTIMATE2025') - num(r,'ESTIMATESBASE2020')) / num(r,'ESTIMATESBASE2020') * 100 }))
  .sort((a, b) => b.pct - a.pct);
console.log(`GATE_C max_growth=${moves[0].n} ${moves[0].pct.toFixed(2)}% max_decline=${moves[moves.length-1].n} ${moves[moves.length-1].pct.toFixed(2)}%`);
console.log(`GATE_C outliers_beyond_10pct=${cFail} ${cFail === 0 ? 'PASS' : 'FAIL'}`);

// ---- Gate d: CO and FL base2020 vs verified census counts ----
const coBase = num(states.find(r => get(r, 'NAME') === 'Colorado'), 'ESTIMATESBASE2020');
const flBase = num(states.find(r => get(r, 'NAME') === 'Florida'), 'ESTIMATESBASE2020');
console.log(`GATE_D CO_base2020=${coBase} ref=5773714 delta=${coBase - 5773714}`);
console.log(`GATE_D FL_base2020=${flBase} ref=21538187 delta=${flBase - 21538187}`);

// ---- Write output JSON (keys in CSV order = alphabetical by state name) ----
const out = {
  source: 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv',
  vintage: '2025',
  retrieved: '2026-06-11',
  asOf: '2025-07-01',
  states: {}
};
for (const r of states) {
  const usps = NAME_TO_USPS[get(r, 'NAME')];
  if (!usps) throw new Error('No USPS code for: ' + get(r, 'NAME'));
  out.states[usps] = {
    base2020: num(r, 'ESTIMATESBASE2020'),
    est2021: num(r, 'POPESTIMATE2021'),
    est2022: num(r, 'POPESTIMATE2022'),
    est2023: num(r, 'POPESTIMATE2023'),
    est2024: num(r, 'POPESTIMATE2024'),
    est2025: num(r, 'POPESTIMATE2025')
  };
}
const outPath = path.join(dir, 'state_pop_2025.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`WROTE ${outPath} states=${Object.keys(out.states).length}`);
