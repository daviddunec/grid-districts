#!/usr/bin/env node
// check-coverage.js <ST>
// Verifier: CSV (row,col) set === in-state cells of grid.json, each exactly once,
//           sorted by (row,col), header exact, every district in 1..meta.seats
// Usage: node scripts/verify/check-coverage.js CO [--selftest]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function parseCsvRaw(p) {
  const content = readFileSync(p, 'utf8');
  const lines = content.split('\n');
  const header = lines[0];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    const parts = line.split(',');
    if (parts.length !== 4) throw new Error(`Bad line ${i + 1}: "${line}"`);
    rows.push({
      row: parseInt(parts[0], 10),
      col: parseInt(parts[1], 10),
      district: parseInt(parts[2], 10),
      pop: parseInt(parts[3], 10),
    });
  }
  return { header, rows };
}

const ARMS = ['accretion-west', 'accretion-centroid', 'splitline'];

function checkArm(arm, meta, grid, outDir) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  let parsed;
  try {
    parsed = parseCsvRaw(csvPath);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(`[${arm}] SKIP: assign_${arm}.csv not found`);
      return null;
    }
    throw e;
  }

  const { header, rows } = parsed;
  const failures = [];

  // 1. Header exact
  if (header !== 'row,col,district,pop') {
    failures.push(`  FAIL header: got "${header}", expected "row,col,district,pop"`);
  }

  const seats = meta.seats;
  const gridRows = grid.rows;
  const gridCols = grid.cols;
  const inState = grid.inState;

  // Build the expected set of in-state cells
  const expectedSet = new Set();
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (inState[r * gridCols + c] === 1) {
        expectedSet.add(`${r},${c}`);
      }
    }
  }

  // 2. Check for duplicates, wrong districts, and build actual set
  const seen = new Set();
  const duplicates = [];
  const badDistrict = [];
  const actualKeys = [];

  for (const r of rows) {
    const key = `${r.row},${r.col}`;
    if (seen.has(key)) {
      duplicates.push(key);
    } else {
      seen.add(key);
    }
    actualKeys.push(key);
    if (r.district < 1 || r.district > seats) {
      badDistrict.push(`(${r.row},${r.col}) district=${r.district}`);
    }
  }

  if (duplicates.length > 0) {
    failures.push(`  FAIL duplicates: ${duplicates.slice(0, 5).join('; ')}${duplicates.length > 5 ? ` ... (${duplicates.length} total)` : ''}`);
  }

  if (badDistrict.length > 0) {
    failures.push(`  FAIL district range: ${badDistrict.slice(0, 5).join('; ')}${badDistrict.length > 5 ? ` ... (${badDistrict.length} total)` : ''}`);
  }

  // 3. Set equality: actual === expected
  const missing = []; // in expected but not in actual
  const extra = [];   // in actual but not in expected

  for (const k of expectedSet) {
    if (!seen.has(k)) missing.push(k);
  }
  for (const k of seen) {
    if (!expectedSet.has(k)) extra.push(k);
  }

  if (missing.length > 0) {
    failures.push(`  FAIL coverage: ${missing.length} in-state cells missing from CSV (first 5: ${missing.slice(0, 5).join('; ')})`);
  }
  if (extra.length > 0) {
    failures.push(`  FAIL coverage: ${extra.length} CSV cells not in-state (first 5: ${extra.slice(0, 5).join('; ')})`);
  }

  // 4. Sorted by (row, then col)
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    const cmp = prev.row !== cur.row ? prev.row - cur.row : prev.col - cur.col;
    if (cmp > 0) {
      failures.push(`  FAIL sort: line ${i + 1} (${cur.row},${cur.col}) out of order after (${prev.row},${prev.col})`);
      break; // report first only
    }
  }

  // 5. Every district 1..seats must appear at least once
  const presentDistricts = new Set(rows.map(r => r.district));
  for (let d = 1; d <= seats; d++) {
    if (!presentDistricts.has(d)) {
      failures.push(`  FAIL coverage: district ${d} missing from CSV`);
    }
  }

  if (failures.length === 0) {
    console.log(`[${arm}] PASS: ${rows.length} cells, all in-state, sorted, districts 1..${seats}`);
    return true;
  } else {
    console.log(`[${arm}] FAIL:`);
    for (const f of failures) console.log(f);
    return false;
  }
}

function runSelftest() {
  console.log('--- SELFTEST check-coverage.js ---');
  const dir = join(tmpdir(), `verify_cov_selftest_${process.pid}`);
  mkdirSync(dir, { recursive: true });

  // 2x2 grid, all in-state, 2 seats
  const meta = { state: 'XX', seats: 2, residentPop: 200, idealTarget: 100.0, rows: 2, cols: 2 };
  const grid = { rows: 2, cols: 2, inState: [1, 1, 1, 1], pop: [50, 50, 50, 50], bridges: [] };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
  writeFileSync(join(dir, 'grid.json'), JSON.stringify(grid));

  // GOOD case: perfect coverage, sorted, correct districts
  const goodCsv = 'row,col,district,pop\n0,0,1,50\n0,1,1,50\n1,0,2,50\n1,1,2,50\n';
  writeFileSync(join(dir, 'assign_accretion-west.csv'), goodCsv);

  // BAD: duplicate cell (0,0 appears twice)
  const badDupCsv = 'row,col,district,pop\n0,0,1,50\n0,0,1,50\n1,0,2,50\n1,1,2,50\n';
  writeFileSync(join(dir, 'assign_accretion-centroid.csv'), badDupCsv);

  // BAD: out-of-order sort
  const badSortCsv = 'row,col,district,pop\n0,1,1,50\n0,0,1,50\n1,0,2,50\n1,1,2,50\n';
  writeFileSync(join(dir, 'assign_splitline.csv'), badSortCsv);

  let allPass = true;

  const r1 = checkArmInDir(dir, 'accretion-west', meta, grid);
  if (r1 === true) { console.log('SELFTEST PASS: good case passed'); }
  else { console.log('SELFTEST FAIL: good case incorrectly failed'); allPass = false; }

  const r2 = checkArmInDir(dir, 'accretion-centroid', meta, grid);
  if (r2 === false) { console.log('SELFTEST PASS: duplicate detected'); }
  else { console.log('SELFTEST FAIL: duplicate NOT detected'); allPass = false; }

  const r3 = checkArmInDir(dir, 'splitline', meta, grid);
  if (r3 === false) { console.log('SELFTEST PASS: sort failure detected'); }
  else { console.log('SELFTEST FAIL: sort failure NOT detected'); allPass = false; }

  if (allPass) { console.log('SELFTEST PASS: check-coverage.js'); }
  else { console.log('SELFTEST FAIL: check-coverage.js'); process.exit(1); }
}

function checkArmInDir(outDir, arm, meta, grid) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  let parsed;
  try { parsed = parseCsvRaw(csvPath); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  const { header, rows } = parsed;
  const failures = [];
  if (header !== 'row,col,district,pop') failures.push('header');

  const seats = meta.seats;
  const gridCols = grid.cols;
  const inState = grid.inState;
  const expectedSet = new Set();
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++)
      if (inState[r * gridCols + c] === 1) expectedSet.add(`${r},${c}`);

  const seen = new Set();
  for (const r of rows) {
    const key = `${r.row},${r.col}`;
    if (seen.has(key)) failures.push(`dup ${key}`);
    else seen.add(key);
    if (r.district < 1 || r.district > seats) failures.push(`bad district`);
  }
  for (const k of expectedSet) if (!seen.has(k)) failures.push(`missing ${k}`);
  for (const k of seen) if (!expectedSet.has(k)) failures.push(`extra ${k}`);
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i-1], c = rows[i];
    const cmp = p.row !== c.row ? p.row - c.row : p.col - c.col;
    if (cmp > 0) { failures.push(`sort`); break; }
  }
  const present = new Set(rows.map(r => r.district));
  for (let d = 1; d <= seats; d++) if (!present.has(d)) failures.push(`missing district ${d}`);
  return failures.length === 0;
}

// --- MAIN ---
const args = process.argv.slice(2);
if (args.includes('--selftest')) { runSelftest(); process.exit(0); }

const ST = args[0];
if (!ST) { console.error('Usage: node check-coverage.js <ST> [--selftest]'); process.exit(1); }

const outDir = join(PROJECT_ROOT, 'out', ST);
const meta = readJson(join(outDir, 'meta.json'));
const grid = readJson(join(outDir, 'grid.json'));

let anyFound = false;
let anyFail = false;
for (const arm of ARMS) {
  const result = checkArm(arm, meta, grid, outDir);
  if (result !== null) anyFound = true;
  if (result === false) anyFail = true;
}

if (!anyFound) { console.log('FAIL: no assign_*.csv files found'); process.exit(1); }
if (anyFail) { console.log('OVERALL: FAIL'); process.exit(1); }
else { console.log('OVERALL: PASS'); process.exit(0); }
