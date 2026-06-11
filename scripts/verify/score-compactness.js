#!/usr/bin/env node
// score-compactness.js <ST>
// Verifier: independently re-derive all stats_<arm>.json district metrics from CSV + grid.json + meta.json
// Usage: node scripts/verify/score-compactness.js CO [--selftest]
//
// Metrics re-derived per INTERFACES.md:
//   pop           = Σ csv pop for district
//   cells         = count of cells in district
//   deviationPct  = (pop - idealTarget) / idealTarget * 100  (signed)
//   ppn           = (4π·cells / exposedEdges²) / (π/4)
//                 = 16·cells / exposedEdges²
//   exposedEdge   = side whose rook neighbor is a different district OR not an in-state cell OR out-of-grid
//                   (bridges do NOT remove exposure)
//   bboxAspect    = max(w,h)/min(w,h)  where w=colMax-colMin+1, h=rowMax-rowMin+1
//   bboxFill      = cells / (w * h)
//   irregular     = ppn < 0.45 OR bboxAspect > 2.0 OR bboxFill < 0.45
//
// Tolerances: integers exact (===), floats |delta| ≤ 1e-9
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const FLOAT_TOL = 1e-9;

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function parseCsv(p) {
  const lines = readFileSync(p, 'utf8').split('\n');
  if (lines[0] !== 'row,col,district,pop') throw new Error(`Bad header: "${lines[0]}"`);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    const parts = line.split(',');
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
const ROOK_DR = [-1, 1, 0, 0];
const ROOK_DC = [0, 0, -1, 1];

function deriveMetrics(csvRows, grid, meta) {
  const gridRows = grid.rows;
  const gridCols = grid.cols;
  const inState = grid.inState;
  const idealTarget = meta.idealTarget;

  // Build lookup: "r,c" -> district
  const cellDistrict = new Map();
  // Group by district
  const districtCells = new Map();
  const districtPop = new Map();

  for (const r of csvRows) {
    const key = `${r.row},${r.col}`;
    cellDistrict.set(key, r.district);
    if (!districtCells.has(r.district)) districtCells.set(r.district, []);
    districtCells.get(r.district).push({ row: r.row, col: r.col });
    districtPop.set(r.district, (districtPop.get(r.district) || 0) + r.pop);
  }

  const results = new Map();

  for (const [d, cells] of districtCells) {
    const pop = districtPop.get(d);
    const cellCount = cells.length;
    const deviationPct = (pop - idealTarget) / idealTarget * 100;

    // Bounding box
    let rowMin = Infinity, rowMax = -Infinity, colMin = Infinity, colMax = -Infinity;
    for (const { row, col } of cells) {
      if (row < rowMin) rowMin = row;
      if (row > rowMax) rowMax = row;
      if (col < colMin) colMin = col;
      if (col > colMax) colMax = col;
    }
    const w = colMax - colMin + 1;
    const h = rowMax - rowMin + 1;
    const bboxAspect = Math.max(w, h) / Math.min(w, h);
    const bboxFill = cellCount / (w * h);

    // Exposed edges: for each cell, count sides whose rook neighbor is:
    //   - out of grid, OR
    //   - not in-state (inState[i] === 0), OR
    //   - in a different district
    // Bridges do NOT remove exposure (per spec)
    let exposedEdges = 0;
    for (const { row, col } of cells) {
      for (let dir = 0; dir < 4; dir++) {
        const nr = row + ROOK_DR[dir];
        const nc = col + ROOK_DC[dir];
        if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) {
          // out of grid → exposed
          exposedEdges++;
          continue;
        }
        const ni = nr * gridCols + nc;
        if (inState[ni] !== 1) {
          // not in-state → exposed
          exposedEdges++;
          continue;
        }
        const nKey = `${nr},${nc}`;
        const nDistrict = cellDistrict.get(nKey);
        if (nDistrict === undefined || nDistrict !== d) {
          // different district (or in-state but unassigned) → exposed
          exposedEdges++;
        }
      }
    }

    // ppn = (4π·cells / exposedEdges²) / (π/4) = 16·cells / exposedEdges²
    let ppn;
    if (exposedEdges === 0) {
      ppn = 0; // degenerate; shouldn't happen in valid output
    } else {
      ppn = (4 * Math.PI * cellCount / (exposedEdges * exposedEdges)) / (Math.PI / 4);
      // Simplifies to: 16 * cellCount / (exposedEdges * exposedEdges)
    }

    const irregular = ppn < 0.45 || bboxAspect > 2.0 || bboxFill < 0.45;

    results.set(d, { district: d, pop, cells: cellCount, deviationPct, ppn, bboxAspect, bboxFill, irregular, exposedEdges });
  }

  return results;
}

function compareMetrics(derived, fromJson, district) {
  const mismatches = [];
  // Integers: exact
  if (derived.pop !== fromJson.pop) mismatches.push(`pop: derived=${derived.pop} json=${fromJson.pop}`);
  if (derived.cells !== fromJson.cells) mismatches.push(`cells: derived=${derived.cells} json=${fromJson.cells}`);
  // Floats: |delta| ≤ 1e-9
  const floatFields = ['deviationPct', 'ppn', 'bboxAspect', 'bboxFill'];
  for (const f of floatFields) {
    const delta = Math.abs(derived[f] - fromJson[f]);
    if (delta > FLOAT_TOL) mismatches.push(`${f}: derived=${derived[f]} json=${fromJson[f]} delta=${delta}`);
  }
  // Boolean: exact
  if (derived.irregular !== fromJson.irregular) {
    mismatches.push(`irregular: derived=${derived.irregular} json=${fromJson.irregular}`);
  }
  return mismatches;
}

function checkArm(arm, meta, grid, outDir) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  const statsPath = join(outDir, `stats_${arm}.json`);
  let csvRows, statsJson;
  try {
    csvRows = parseCsv(csvPath);
  } catch (e) {
    if (e.code === 'ENOENT') { console.log(`[${arm}] SKIP: assign_${arm}.csv not found`); return null; }
    throw e;
  }
  try {
    statsJson = readJson(statsPath);
  } catch (e) {
    if (e.code === 'ENOENT') { console.log(`[${arm}] SKIP: stats_${arm}.json not found`); return null; }
    throw e;
  }

  const derived = deriveMetrics(csvRows, grid, meta);

  // Build lookup from stats json
  const jsonByDistrict = new Map();
  for (const entry of statsJson.districts) {
    jsonByDistrict.set(entry.district, entry);
  }

  const failures = [];
  const tableRows = [];

  // Print header
  tableRows.push(`${'D'.padStart(3)} ${'pop'.padStart(10)} ${'cells'.padStart(6)} ${'devPct'.padStart(10)} ${'ppn'.padStart(10)} ${'bboxAsp'.padStart(8)} ${'bboxFill'.padStart(9)} ${'irreg'.padStart(6)} | STATUS`);
  tableRows.push('-'.repeat(75));

  const allDistricts = new Set([...derived.keys(), ...jsonByDistrict.keys()]);
  for (const d of [...allDistricts].sort((a, b) => a - b)) {
    const der = derived.get(d);
    const jso = jsonByDistrict.get(d);

    if (!der) {
      failures.push(`  district ${d}: in stats_json but not in CSV`);
      tableRows.push(`  d${d}: MISMATCH (missing from CSV)`);
      continue;
    }
    if (!jso) {
      failures.push(`  district ${d}: in CSV but not in stats_json`);
      tableRows.push(`  d${d}: MISMATCH (missing from stats_json)`);
      continue;
    }

    const mismatches = compareMetrics(der, jso, d);
    const status = mismatches.length === 0 ? 'PASS' : 'MISMATCH';
    const row = `${String(d).padStart(3)} ${String(der.pop).padStart(10)} ${String(der.cells).padStart(6)} ${der.deviationPct.toFixed(4).padStart(10)} ${der.ppn.toFixed(6).padStart(10)} ${der.bboxAspect.toFixed(4).padStart(8)} ${der.bboxFill.toFixed(4).padStart(9)} ${String(der.irregular).padStart(6)} | ${status}`;
    tableRows.push(row);

    for (const m of mismatches) {
      tableRows.push(`       MISMATCH: ${m}`);
      failures.push(`  district ${d}: ${m}`);
    }
  }

  console.log(`\n[${arm}] Compactness comparison table:`);
  for (const row of tableRows) console.log(row);

  if (failures.length === 0) {
    console.log(`[${arm}] PASS: all ${derived.size} districts match stats_${arm}.json`);
    return true;
  } else {
    console.log(`[${arm}] FAIL: ${failures.length} mismatch(es)`);
    return false;
  }
}

function runSelftest() {
  console.log('--- SELFTEST score-compactness.js ---');
  const dir = join(tmpdir(), `verify_compact_selftest_${process.pid}`);
  mkdirSync(dir, { recursive: true });

  // 3x3 grid, all in-state, 2 seats, 5 cells each
  // Layout:
  // (0,0) (0,1) (0,2)
  // (1,0) (1,1) (1,2)
  // (2,0) (2,1) (2,2)
  //
  // District 1: top row (0,0),(0,1),(0,2),(1,0),(1,1) — 5 cells in a roughly horizontal band
  // District 2: (1,2),(2,0),(2,1),(2,2) — 4 cells (bottom-right + left)
  // Wait, let me make it cleaner:
  // D1: rows 0-1, cols 0-1 → (0,0),(0,1),(1,0),(1,1) = 4 cells
  // D2: (0,2),(1,2),(2,0),(2,1),(2,2) = 5 cells (not contiguous) ... bad for selftest
  //
  // Simpler: 2x2 grid, 2 seats, 2 cells each
  // D1: (0,0),(0,1)  D2: (1,0),(1,1)
  // D1 exposed edges:
  //   (0,0): north=OOG, west=OOG, south→(1,0)=D2 exposed, east→(0,1)=D1 not exposed → 3 exposed
  //   (0,1): north=OOG, east=OOG, south→(1,1)=D2 exposed, west→(0,0)=D1 not exposed → 3 exposed
  //   D1 total exposed = 6
  //   D1 ppn = 16*2/36 = 32/36 = 0.88889
  //   D1 bboxAspect: w=2,h=1 → 2.0/1.0=2.0; bboxFill=2/(2*1)=1.0
  //   D1 irregular: ppn(0.888)>=0.45 ok, bboxAspect(2.0)<=2.0 ok (not >2.0), bboxFill(1.0)>=0.45 ok → NOT irregular
  //
  // D2 exposed edges (symmetric):
  //   (1,0): south=OOG, west=OOG, north→(0,0)=D1 exposed, east→(1,1)=D2 not exposed → 3
  //   (1,1): south=OOG, east=OOG, north→(0,1)=D1 exposed, west→(1,0)=D2 not exposed → 3
  //   D2 total exposed = 6
  //   D2 ppn = 16*2/36 = 0.88889
  //   D2 bboxAspect: w=2,h=1 → 2.0; bboxFill=2/2=1.0; NOT irregular

  const meta = { state: 'XX', seats: 2, residentPop: 400, idealTarget: 200.0, rows: 2, cols: 2 };
  const grid = { rows: 2, cols: 2, inState: [1, 1, 1, 1], pop: [100, 100, 100, 100], bridges: [] };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
  writeFileSync(join(dir, 'grid.json'), JSON.stringify(grid));

  const goodCsv = 'row,col,district,pop\n0,0,1,100\n0,1,1,100\n1,0,2,100\n1,1,2,100\n';
  writeFileSync(join(dir, 'assign_accretion-west.csv'), goodCsv);

  // ppn = 16*2/36 = 0.888...
  const ppn = 16 * 2 / 36;
  // bboxAspect for D1 (row0..0, col0..1): w=2,h=1 → max/min=2.0
  // bboxFill = 2/(2*1) = 1.0
  const goodStats = {
    arm: 'accretion-west',
    districts: [
      { district: 1, pop: 200, cells: 2, deviationPct: 0.0, ppn: ppn, bboxAspect: 2.0, bboxFill: 1.0, irregular: false },
      { district: 2, pop: 200, cells: 2, deviationPct: 0.0, ppn: ppn, bboxAspect: 2.0, bboxFill: 1.0, irregular: false },
    ],
    repair: { orphanComponentsMoved: 0, orphanCellsMoved: 0, rebalanceMoves: 0 },
    sha256: ''
  };
  writeFileSync(join(dir, 'stats_accretion-west.json'), JSON.stringify(goodStats));

  // BAD stats: wrong ppn for district 1
  const badStats = JSON.parse(JSON.stringify(goodStats));
  badStats.arm = 'accretion-centroid';
  badStats.districts[0].ppn = 0.5; // wrong value
  writeFileSync(join(dir, 'assign_accretion-centroid.csv'), goodCsv);
  writeFileSync(join(dir, 'stats_accretion-centroid.json'), JSON.stringify(badStats));

  let allPass = true;

  const r1 = checkArmResult(dir, 'accretion-west', meta, grid);
  if (r1 === true) { console.log('SELFTEST PASS: correct stats passed'); }
  else { console.log('SELFTEST FAIL: correct stats incorrectly failed'); allPass = false; }

  const r2 = checkArmResult(dir, 'accretion-centroid', meta, grid);
  if (r2 === false) { console.log('SELFTEST PASS: wrong ppn detected'); }
  else { console.log('SELFTEST FAIL: wrong ppn NOT detected'); allPass = false; }

  if (allPass) { console.log('SELFTEST PASS: score-compactness.js'); }
  else { console.log('SELFTEST FAIL: score-compactness.js'); process.exit(1); }
}

function checkArmResult(outDir, arm, meta, grid) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  const statsPath = join(outDir, `stats_${arm}.json`);
  let csvRows, statsJson;
  try { csvRows = parseCsv(csvPath); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  try { statsJson = readJson(statsPath); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }

  const derived = deriveMetrics(csvRows, grid, meta);
  const jsonByDistrict = new Map();
  for (const entry of statsJson.districts) jsonByDistrict.set(entry.district, entry);

  let pass = true;
  for (const [d, der] of derived) {
    const jso = jsonByDistrict.get(d);
    if (!jso) { pass = false; break; }
    const mm = compareMetrics(der, jso, d);
    if (mm.length > 0) { pass = false; break; }
  }
  if (derived.size !== jsonByDistrict.size) pass = false;
  return pass;
}

// --- MAIN ---
const args = process.argv.slice(2);
if (args.includes('--selftest')) { runSelftest(); process.exit(0); }

const ST = args[0];
if (!ST) { console.error('Usage: node score-compactness.js <ST> [--selftest]'); process.exit(1); }

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

if (!anyFound) { console.log('FAIL: no arm files found'); process.exit(1); }
if (anyFail) { console.log('OVERALL: FAIL'); process.exit(1); }
else { console.log('OVERALL: PASS'); process.exit(0); }
