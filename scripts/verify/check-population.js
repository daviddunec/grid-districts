#!/usr/bin/env node
// check-population.js <ST>
// Verifier: population conservation + equality (independent of src/)
// Usage: node scripts/verify/check-population.js CO [--selftest]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function parseCsv(p) {
  const lines = readFileSync(p, 'utf8').split('\n');
  const header = lines[0];
  if (header !== 'row,col,district,pop') {
    throw new Error(`Bad CSV header: "${header}"`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    const parts = line.split(',');
    if (parts.length !== 4) throw new Error(`Bad CSV line ${i + 1}: "${line}"`);
    rows.push({
      row: parseInt(parts[0], 10),
      col: parseInt(parts[1], 10),
      district: parseInt(parts[2], 10),
      pop: parseInt(parts[3], 10),
    });
  }
  return rows;
}

const ARMS = ['accretion-west', 'accretion-centroid', 'splitline'];

function checkArm(ST, arm, meta, outDir) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  let csvRows;
  try {
    csvRows = parseCsv(csvPath);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(`[${arm}] SKIP: assign_${arm}.csv not found`);
      return null;
    }
    throw e;
  }

  const failures = [];

  // (a) Conservation: Σ csv pop
  let csvTotalPop = 0;
  const districtPops = new Map();
  for (const r of csvRows) {
    csvTotalPop += r.pop;
    districtPops.set(r.district, (districtPops.get(r.district) || 0) + r.pop);
  }

  // Σ district pops
  let districtSum = 0;
  for (const [, p] of districtPops) districtSum += p;

  const residentPop = meta.residentPop;

  if (csvTotalPop !== residentPop) {
    failures.push(`  FAIL conservation: Σ csv pop ${csvTotalPop} !== meta.residentPop ${residentPop}`);
  }
  if (districtSum !== residentPop) {
    failures.push(`  FAIL conservation: Σ district pops ${districtSum} !== meta.residentPop ${residentPop}`);
  }
  if (csvTotalPop !== districtSum) {
    failures.push(`  FAIL conservation: Σ csv pop ${csvTotalPop} !== Σ district pops ${districtSum}`);
  }

  // (b) Equality: max |deviationPct| ≤ 1.0
  // Derive idealTarget independently from meta (do NOT trust stats json)
  const idealTarget = meta.idealTarget; // this is computed by the engine grid step, not stats
  // But we re-derive deviationPct ourselves from csv pops:
  let maxAbsDev = 0;
  let worstDistrict = null;
  for (const [d, pop] of districtPops) {
    const dev = Math.abs((pop - idealTarget) / idealTarget * 100);
    if (dev > maxAbsDev) {
      maxAbsDev = dev;
      worstDistrict = d;
    }
  }

  // Gate: ±1% pilot (from INTERFACES.md / ab-metrics)
  const GATE = 1.0;
  if (maxAbsDev > GATE) {
    failures.push(
      `  FAIL equality: district ${worstDistrict} |deviationPct| = ${maxAbsDev.toFixed(6)}% > ${GATE}%`
    );
  }

  // Check district range
  const seats = meta.seats;
  for (const d of districtPops.keys()) {
    if (d < 1 || d > seats) {
      failures.push(`  FAIL equality: district ${d} out of range 1..${seats}`);
    }
  }

  if (failures.length === 0) {
    console.log(`[${arm}] PASS: conservation OK (csvTotal=${csvTotalPop}), maxAbsDev=${maxAbsDev.toFixed(6)}%`);
    return true;
  } else {
    console.log(`[${arm}] FAIL:`);
    for (const f of failures) console.log(f);
    return false;
  }
}

function runSelftest() {
  console.log('--- SELFTEST check-population.js ---');
  const dir = join(tmpdir(), `verify_pop_selftest_${process.pid}`);
  mkdirSync(dir, { recursive: true });

  // Minimal synthetic: 2 seats, 4 cells
  // idealTarget = 100.0, residentPop = 200
  const meta = {
    state: 'XX',
    seats: 2,
    residentPop: 200,
    idealTarget: 100.0,
    rows: 2,
    cols: 2,
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));

  // --- GOOD case: two districts, exactly balanced ---
  const goodCsv = 'row,col,district,pop\n0,0,1,50\n0,1,1,50\n1,0,2,50\n1,1,2,50\n';
  writeFileSync(join(dir, 'assign_accretion-west.csv'), goodCsv);

  // --- BAD case: conservation fails (total = 199 ≠ 200) ---
  const badCsv = 'row,col,district,pop\n0,0,1,50\n0,1,1,49\n1,0,2,50\n1,1,2,50\n';
  writeFileSync(join(dir, 'assign_accretion-centroid.csv'), badCsv);

  // --- BAD case 2: equality fails (>1% deviation) ---
  // ideal=100; d1=102, d2=98 → dev=2% > 1%
  const badCsv2 = 'row,col,district,pop\n0,0,1,51\n0,1,1,51\n1,0,2,49\n1,1,2,49\n';
  writeFileSync(join(dir, 'assign_splitline.csv'), badCsv2);

  let allPass = true;

  // Test GOOD arm
  {
    const r = checkArmFromDir(dir, 'accretion-west', meta);
    if (r === true) {
      console.log('SELFTEST PASS: good case correctly passed');
    } else {
      console.log('SELFTEST FAIL: good case incorrectly failed');
      allPass = false;
    }
  }

  // Test BAD conservation arm
  {
    const r = checkArmFromDir(dir, 'accretion-centroid', meta);
    if (r === false) {
      console.log('SELFTEST PASS: conservation failure correctly detected');
    } else {
      console.log('SELFTEST FAIL: conservation failure was NOT detected');
      allPass = false;
    }
  }

  // Test BAD equality arm
  {
    const r = checkArmFromDir(dir, 'splitline', meta);
    if (r === false) {
      console.log('SELFTEST PASS: equality failure correctly detected');
    } else {
      console.log('SELFTEST FAIL: equality failure was NOT detected');
      allPass = false;
    }
  }

  if (allPass) {
    console.log('SELFTEST PASS: check-population.js');
  } else {
    console.log('SELFTEST FAIL: check-population.js');
    process.exit(1);
  }
}

function checkArmFromDir(outDir, arm, meta) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  let csvRows;
  try {
    csvRows = parseCsv(csvPath);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }

  const failures = [];
  let csvTotalPop = 0;
  const districtPops = new Map();
  for (const r of csvRows) {
    csvTotalPop += r.pop;
    districtPops.set(r.district, (districtPops.get(r.district) || 0) + r.pop);
  }
  let districtSum = 0;
  for (const [, p] of districtPops) districtSum += p;

  if (csvTotalPop !== meta.residentPop) failures.push('conservation: csvTotal');
  if (districtSum !== meta.residentPop) failures.push('conservation: districtSum');
  if (csvTotalPop !== districtSum) failures.push('conservation: csvTotal vs districtSum');

  const idealTarget = meta.idealTarget;
  let maxAbsDev = 0;
  let worstDistrict = null;
  for (const [d, pop] of districtPops) {
    const dev = Math.abs((pop - idealTarget) / idealTarget * 100);
    if (dev > maxAbsDev) { maxAbsDev = dev; worstDistrict = d; }
  }
  if (maxAbsDev > 1.0) failures.push(`equality: d${worstDistrict} dev=${maxAbsDev.toFixed(4)}%`);

  for (const d of districtPops.keys()) {
    if (d < 1 || d > meta.seats) failures.push(`district ${d} out of range`);
  }

  return failures.length === 0;
}

// --- MAIN ---
const args = process.argv.slice(2);
if (args.includes('--selftest')) {
  runSelftest();
  process.exit(0);
}

const ST = args[0];
if (!ST) {
  console.error('Usage: node check-population.js <ST> [--selftest]');
  process.exit(1);
}

const outDir = join(PROJECT_ROOT, 'out', ST);
const meta = readJson(join(outDir, 'meta.json'));

let anyFound = false;
let anyFail = false;
for (const arm of ARMS) {
  const result = checkArm(ST, arm, meta, outDir);
  if (result !== null) anyFound = true;
  if (result === false) anyFail = true;
}

if (!anyFound) {
  console.log('FAIL: no assign_*.csv files found');
  process.exit(1);
}

if (anyFail) {
  console.log('OVERALL: FAIL');
  process.exit(1);
} else {
  console.log('OVERALL: PASS');
  process.exit(0);
}
