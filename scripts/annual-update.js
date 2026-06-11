// ANNUAL UPDATE — run yearly (locally or via .github/workflows/annual-update.yml).
//
// What "auto-update" honestly means here: the legally relevant input (decennial PL 94-171
// block data) changes every 10 years. This job (1) DETECTS a new decennial vintage the
// moment the Census Bureau publishes its TIGER block directory, (2) re-verifies that all
// source URLs this project depends on are still live, (3) re-runs the pilot pipeline and
// proves byte-identical output (regression/determinism proof), and (4) regenerates the
// derived artifacts. When a new decade appears, it exits 10 so CI opens a loud issue —
// the new cycle is then run with the same one command as the last one.
//
// Usage: node scripts/annual-update.js [--full]   (--full re-runs all 50 states)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const full = process.argv.includes('--full');
const out = [];
const say = (s) => { out.push(s); console.log(s); };
let newVintage = false, failures = 0;

// ---- 1. New decennial vintage detection ----
// The current cycle's data lives under TIGER2020/TABBLOCK20. Future cycles follow the
// same pattern (TIGER2030/TABBLOCK30 etc.). Probe the next two plausible vintages.
const CYCLE = 2020;
for (const year of [CYCLE + 10, CYCLE + 20]) {
  const url = `https://www2.census.gov/geo/tiger/TIGER${year}/TABBLOCK${String(year).slice(2)}/`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      say(`NEW DECENNIAL VINTAGE DETECTED: ${url} is live. A new redistricting cycle's block data exists.`);
      newVintage = true;
    } else {
      say(`vintage probe ${year}: not yet published (HTTP ${res.status}) — expected until the ${year} census data release.`);
    }
  } catch (e) {
    say(`vintage probe ${year}: unreachable (${e.message}) — treated as not-yet-published.`);
  }
}

// ---- 2. Source liveness ----
const SOURCES = [
  ['TIGER TABBLOCK20 (CO sample)', 'https://www2.census.gov/geo/tiger/TIGER2020/TABBLOCK20/tl_2020_08_tabblock20.zip'],
  ['State boundaries', 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip'],
  ['Apportionment Table 2 (populations)', 'https://www2.census.gov/programs-surveys/decennial/2020/data/apportionment/apportionment-2020-table02.xlsx'],
  ['Apportionment Table C1 (seats by decade)', 'https://www2.census.gov/programs-surveys/decennial/2020/data/apportionment/apportionment-2020-tableC1.xlsx'],
];
for (const [name, url] of SOURCES) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) say(`source OK: ${name}`);
    else { say(`SOURCE FAILURE: ${name} -> HTTP ${res.status} (${url})`); failures++; }
  } catch (e) { say(`SOURCE FAILURE: ${name} -> ${e.message}`); failures++; }
}

// ---- 3. Determinism regression: pilot must reproduce byte-identically ----
const KNOWN_SHA = {
  // canonical assignment SHA-256 for the production arm on the pilot, frozen at release
  'CO/assign_splitline.csv': 'adf3ad45fbd267108d568bb05664ccbf44886a9302c7bb00756c8faa775f75b5',
};
const run = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 30 * 60 * 1000 });
say('re-running pilot (CO, splitline)...');
const r1 = run(['cli.js', 'run', '--state', 'CO', '--arm', 'splitline']);
if (r1.status !== 0) { say('PILOT RUN FAILED:\n' + (r1.stderr || r1.stdout || '').slice(-500)); failures++; }
else {
  const crypto = await import('node:crypto');
  for (const [rel, expected] of Object.entries(KNOWN_SHA)) {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join('out', rel))).digest('hex');
    if (sha === expected) say(`determinism regression OK: ${rel}`);
    else { say(`DETERMINISM REGRESSION FAILURE: ${rel} sha ${sha.slice(0, 12)} != frozen ${expected.slice(0, 12)}`); failures++; }
  }
}

// ---- 4. Regenerate derived artifacts ----
if (full) {
  say('full 50-state re-run requested...');
  const rf = run(['scripts/run-all-states.js', '--force']);
  if (rf.status !== 0) { say('FULL RUN REPORTED FAILURES — see ledger'); failures++; }
}
const rs = run(['scripts/build-national-summary.js']);
if (rs.status !== 0) { say('summary rebuild FAILED'); failures++; } else say('national summary regenerated');
if (fs.existsSync('scripts/site-build.js')) {
  // export first: site-build consumes site/data/*.json (RLE grids, US map, demo cuts)
  const re = run(['scripts/site-export-data.js']);
  if (re.status !== 0) { say('site data export FAILED'); failures++; }
  const rw = run(['scripts/site-build.js']);
  if (rw.status !== 0) { say('site rebuild FAILED'); failures++; } else say('website regenerated');
}

// ---- report ----
fs.mkdirSync('data/update_reports', { recursive: true });
const stamp = process.env.UPDATE_STAMP || 'manual-run';
fs.writeFileSync(path.join('data/update_reports', `update-${stamp}.txt`), out.join('\n') + '\n');
say(`\nANNUAL UPDATE: ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURE(S)'}${newVintage ? ' — NEW DECENNIAL VINTAGE AVAILABLE, run the new cycle' : ''}`);
process.exit(newVintage ? 10 : failures > 0 ? 1 : 0);
