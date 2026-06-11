#!/usr/bin/env node
// build_county_pops.js
// Downloads and processes county-level decennial census populations for 1950-2010.
// Sources:
//   1950-1990: NBER cencounts.csv (https://data.nber.org/census/population/cencounts/cencounts.csv)
//   2000:      Census co-est00int-tot.csv (ESTIMATESBASE2000 column)
//   2010:      Census co-est2020.csv (CENSUS2010POP column)
// Output: data/history/county_pops.json

'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');

// ── helpers ──────────────────────────────────────────────────────────────────

function fetch(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

// RFC-4180 compliant CSV parser — handles quoted fields with embedded commas/newlines.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\n') {
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row); // skip blank lines
      row = []; i++; continue;
    }
    field += ch; i++;
  }
  // last field/row
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  const [header, ...data] = rows;
  return data.map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = (r[i] || '').trim(); });
    return obj;
  });
}

// pad state+county to 5-digit FIPS
function makeFips(state, county) {
  return String(state).padStart(2, '0') + String(county).padStart(3, '0');
}

// Exclude DC (11) and PR (72)
function keepState(stateNum) {
  const s = parseInt(stateNum, 10);
  return s >= 1 && s <= 56 && s !== 11;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const DECADES = ['1950', '1960', '1970', '1980', '1990', '2000', '2010'];

  // ── SOURCE 1: NBER cencounts.csv (1950-1990) ────────────────────────────
  console.error('Fetching NBER cencounts.csv ...');
  const NBER_URL = 'https://data.nber.org/census/population/cencounts/cencounts.csv';
  const nberText = await fetch(NBER_URL);
  const nberRows = parseCSV(nberText);
  const nberObjs = rowsToObjects(nberRows);

  // NBER fips field: "00000"=US total, "XX000"=state totals, "XXXXX"=county
  // Keep only county rows: 5-digit fips, last 3 digits != 000
  const pops = { '1950': {}, '1960': {}, '1970': {}, '1980': {}, '1990': {} };
  let nberCounties = { '1950': 0, '1960': 0, '1970': 0, '1980': 0, '1990': 0 };

  for (const obj of nberObjs) {
    const fips = obj.fips ? obj.fips.trim() : '';
    if (fips.length !== 5) continue;
    const stateNum = parseInt(fips.substring(0, 2), 10);
    const countyNum = parseInt(fips.substring(2, 5), 10);
    if (countyNum === 0) continue; // state-level row
    if (!keepState(stateNum)) continue;

    for (const dec of ['1950', '1960', '1970', '1980', '1990']) {
      const col = 'pop' + dec;
      const val = parseInt(obj[col], 10);
      if (!isNaN(val)) {
        pops[dec][fips] = val;
        nberCounties[dec]++;
      }
    }
  }

  // ── SOURCE 2: Census co-est00int-tot.csv (2000 + 2010 backup) ───────────
  console.error('Fetching Census co-est00int-tot.csv ...');
  const C00_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/county/co-est00int-tot.csv';
  const c00Text = await fetch(C00_URL);
  const c00Rows = parseCSV(c00Text);
  const c00Objs = rowsToObjects(c00Rows);

  pops['2000'] = {};
  let cnt2000 = 0;

  for (const obj of c00Objs) {
    const sumlev = (obj['SUMLEV'] || '').trim();
    if (sumlev !== '50') continue; // county rows only
    const stateNum = parseInt(obj['STATE'] || '0', 10);
    if (!keepState(stateNum)) continue;
    const fips = makeFips(obj['STATE'], obj['COUNTY']);
    const val = parseInt(obj['ESTIMATESBASE2000'], 10);
    if (!isNaN(val)) {
      pops['2000'][fips] = val;
      cnt2000++;
    }
  }

  // ── SOURCE 3: Census co-est2020.csv (2010) ──────────────────────────────
  console.error('Fetching Census co-est2020.csv ...');
  const C20_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/counties/totals/co-est2020.csv';
  const c20Text = await fetch(C20_URL);
  const c20Rows = parseCSV(c20Text);
  const c20Objs = rowsToObjects(c20Rows);

  pops['2010'] = {};
  let cnt2010 = 0;

  for (const obj of c20Objs) {
    const sumlev = (obj['SUMLEV'] || '').trim();
    if (sumlev !== '050' && sumlev !== '50') continue;
    const stateNum = parseInt(obj['STATE'] || '0', 10);
    if (!keepState(stateNum)) continue;
    const fips = makeFips(obj['STATE'], obj['COUNTY']);
    const val = parseInt(obj['CENSUS2010POP'], 10);
    if (!isNaN(val)) {
      pops['2010'][fips] = val;
      cnt2010++;
    }
  }

  // ── VALIDATION ────────────────────────────────────────────────────────────

  // Published US resident population (50 states, no DC):
  // Source: Census Bureau historical national tables
  // Published 50-state totals (50 states only, DC excluded).
  // Source: Census Bureau historical population change table (popchange-data-text.html)
  // US total minus DC for each decade:
  //   1950: 151,325,798 - 802,178 = 150,523,620
  //   1960: 179,323,175 - 763,956 = 178,559,219
  //   1970: 203,211,926 - 756,510 = 202,455,416
  //   1980: 226,545,805 - 638,333 = 225,907,472
  //   1990: 248,709,873 - 606,900 = 248,102,973
  //   2000: 281,421,906 - 572,059 = 280,849,847
  //   2010: 308,745,538 - 601,723 = 308,143,815
  const publishedUS = {
    '1950': 150523620,
    '1960': 178559219,
    '1970': 202455416,
    '1980': 225907472,
    '1990': 248102973,
    '2000': 280849847,
    '2010': 308143815,
  };

  // Anchor state published totals (from Census Bureau):
  // Source: Census P25 series, decennial summary files
  const anchorStates = {
    // CO
    '08': {
      '1950': 1325089,
      '1990': 3294394,
    },
    // NY
    '36': {
      '1950': 14830192,
      '1990': 17990455,
    },
  };

  const validation = {};
  for (const dec of DECADES) {
    const countyMap = pops[dec];
    const fipsList = Object.keys(countyMap);

    // national sum
    const nationalSum = fipsList.reduce((s, f) => s + countyMap[f], 0);

    // state sums
    const stateSums = {};
    for (const f of fipsList) {
      const st = f.substring(0, 2);
      stateSums[st] = (stateSums[st] || 0) + countyMap[f];
    }

    const pubUS = publishedUS[dec];
    const pctDiff = pubUS ? ((nationalSum - pubUS) / pubUS * 100).toFixed(4) : 'N/A';
    const within1pct = pubUS ? Math.abs(nationalSum - pubUS) / pubUS < 0.01 : null;

    const anchorChecks = {};
    if (anchorStates['08'][dec] !== undefined) {
      const co = stateSums['08'] || 0;
      const pub = anchorStates['08'][dec];
      const diff = co - pub;
      anchorChecks['CO_' + dec] = { computed: co, published: pub, diff, pct: (diff / pub * 100).toFixed(4) + '%', pass: Math.abs(diff / pub) < 0.001 };
    }
    if (anchorStates['36'][dec] !== undefined) {
      const ny = stateSums['36'] || 0;
      const pub = anchorStates['36'][dec];
      const diff = ny - pub;
      anchorChecks['NY_' + dec] = { computed: ny, published: pub, diff, pct: (diff / pub * 100).toFixed(4) + '%', pass: Math.abs(diff / pub) < 0.001 };
    }

    validation[dec] = {
      county_count: fipsList.length,
      national_sum: nationalSum,
      published_50state: pubUS,
      pct_diff: pctDiff + '%',
      within_1pct: within1pct,
      anchor_checks: anchorChecks,
    };
  }

  // ── QUIRKS ────────────────────────────────────────────────────────────────
  // Document known FIPS quirks found in the data
  const quirksFound = [];

  // Shannon County SD: 46113 renamed to Oglala Lakota County, FIPS 46102 after 2015
  if (pops['2000']['46113']) quirksFound.push('SD 46113 (Shannon County) present in 2000 data (pre-rename)');
  if (pops['2010']['46113']) quirksFound.push('SD 46113 present in 2010 data');
  if (pops['2010']['46102']) quirksFound.push('SD 46102 (Oglala Lakota) present in 2010 data');

  // Miami-Dade: Dade County FL 12025 -> Miami-Dade 12086 (renamed 1997, FIPS changed)
  if (pops['1990']['12025']) quirksFound.push('FL 12025 (Dade County) present in 1990 data (pre-rename)');
  if (pops['2000']['12086']) quirksFound.push('FL 12086 (Miami-Dade) present in 2000 data');
  if (pops['2000']['12025']) quirksFound.push('FL 12025 still present in 2000 data (check for double-count)');

  // VA independent cities: check a few known ones
  if (pops['2010']['51760']) quirksFound.push('VA 51760 (Richmond city) present in 2010 — VA independent cities included');

  // AK: check borough vs census area
  if (pops['2010']['02290']) quirksFound.push('AK 02290 (Yukon-Koyukuk Census Area) present in 2010');
  if (pops['2010']['02261']) quirksFound.push('AK 02261 (Valdez-Cordova) present in 2010');

  // CT: check for county presence (CT dissolved counties 2022, but they exist in historical data)
  if (pops['2010']['09001']) quirksFound.push('CT 09001 (Fairfield County) present in 2010 — CT historical counties intact');

  // ── OUTPUT ────────────────────────────────────────────────────────────────

  const output = {
    sources: {
      '1950_to_1990': {
        url: NBER_URL,
        description: 'NBER Census U.S. Decennial County Population Data 1900-1990 (cencounts.csv)',
        columns_used: ['pop1950', 'pop1960', 'pop1970', 'pop1980', 'pop1990'],
      },
      '2000': {
        url: C00_URL,
        description: 'Census Bureau co-est00int-tot.csv: 2000-2010 intercensal county estimates',
        column_used: 'ESTIMATESBASE2000',
        note: 'ESTIMATESBASE2000 is the April 1 2000 Census count adjusted to match the 2010 Census geography; use as the decennial Census count for 2000.',
      },
      '2010': {
        url: C20_URL,
        description: 'Census Bureau co-est2020.csv: 2010-2020 county population estimates',
        column_used: 'CENSUS2010POP',
        note: 'CENSUS2010POP is the April 1 2010 Census count.',
      },
    },
    validation,
    quirks: quirksFound,
    notes: [
      'FIPS codes output as-is from each source; no remapping applied (consumer handles Shannon/Oglala Lakota SD 46113->46102 and Dade->Miami-Dade FL 12025->12086 fallbacks).',
      'DC (FIPS prefix 11) excluded. PR (FIPS prefix 72) excluded.',
      'Historical approximation use only: county populations for ratio-scaling grid cells.',
      'NBER source counties may reflect Census geography of the decade; boundary changes between decades are not reconciled in this file.',
    ],
    pops,
  };

  // Print validation table to stderr for human review
  console.error('\n=== VALIDATION TABLE ===');
  console.error('Decade | Counties | National Sum    | Published 50-state | Pct Diff | Within 1%?');
  for (const dec of DECADES) {
    const v = validation[dec];
    console.error(
      `${dec}   | ${String(v.county_count).padStart(5)} | ${String(v.national_sum).padStart(15)} | ${String(v.published_50state || 'N/A').padStart(18)} | ${String(v.pct_diff).padStart(8)} | ${v.within_1pct === null ? 'N/A' : v.within_1pct ? 'PASS' : 'FAIL'}`
    );
    for (const [k, ac] of Object.entries(v.anchor_checks || {})) {
      console.error(`  ${k}: computed=${ac.computed} published=${ac.published} diff=${ac.diff} (${ac.pct}) => ${ac.pass ? 'PASS' : 'FAIL'}`);
    }
  }
  console.error('\n=== QUIRKS FOUND ===');
  quirksFound.forEach(q => console.error(' -', q));

  // Write output
  const outPath = path.join(__dirname, 'county_pops.json');
  fs.writeFileSync(outPath, JSON.stringify(output) + '\n', 'utf8');
  console.error(`\nWrote ${outPath}`);
  console.error('Done.');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
