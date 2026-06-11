#!/usr/bin/env node
// check-contiguity.js <ST>
// Verifier: rook flood-fill per district (+ bridges) = exactly 1 connected component each
// Usage: node scripts/verify/check-contiguity.js CO [--selftest]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

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
    });
  }
  return rows;
}

const ARMS = ['accretion-west', 'accretion-centroid', 'splitline'];

// Rook neighbors: up, down, left, right
const ROOK_DR = [-1, 1, 0, 0];
const ROOK_DC = [0, 0, -1, 1];

function countComponents(cells, bridgeSet, gridRows, gridCols) {
  // cells: Set of "r,c" strings
  // bridgeSet: Set of "i1,i2" pairs (both directions stored)
  const visited = new Set();

  function bfs(startKey) {
    const queue = [startKey];
    visited.add(startKey);
    while (queue.length > 0) {
      const key = queue.shift();
      const [r, c] = key.split(',').map(Number);
      const i = r * gridCols + c;

      // Rook neighbors
      for (let d = 0; d < 4; d++) {
        const nr = r + ROOK_DR[d];
        const nc = c + ROOK_DC[d];
        if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) continue;
        const nKey = `${nr},${nc}`;
        if (!cells.has(nKey) || visited.has(nKey)) continue;
        visited.add(nKey);
        queue.push(nKey);
      }

      // Bridge neighbors
      const ni = r * gridCols + c;
      // Check all bridges that include cell i
      // We store bridge lookup in a map indexed by cell index
      // (passed in as bridgeSet for efficiency — see below)
    }
  }

  // For bridges: build adjacency map indexed by cell index
  // This is done outside and passed as bridgeAdj
  return bfs; // will be replaced
}

function buildBridgeAdj(bridges, gridCols) {
  // bridges: [[i1, i2], ...]
  // Returns map: i -> [j, ...]
  const adj = new Map();
  for (const [i1, i2] of bridges) {
    if (!adj.has(i1)) adj.set(i1, []);
    if (!adj.has(i2)) adj.set(i2, []);
    adj.get(i1).push(i2);
    adj.get(i2).push(i1);
  }
  return adj;
}

function countDistrictComponents(cells, bridgeAdj, gridRows, gridCols) {
  // cells: Set of "r,c" strings belonging to this district
  const visited = new Set();
  let components = 0;

  for (const startKey of cells) {
    if (visited.has(startKey)) continue;
    components++;
    const queue = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
      const key = queue.shift();
      const [r, c] = key.split(',').map(Number);
      const i = r * gridCols + c;

      // Rook neighbors
      for (let d = 0; d < 4; d++) {
        const nr = r + ROOK_DR[d];
        const nc = c + ROOK_DC[d];
        if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) continue;
        const nKey = `${nr},${nc}`;
        if (!cells.has(nKey) || visited.has(nKey)) continue;
        visited.add(nKey);
        queue.push(nKey);
      }

      // Bridge neighbors
      if (bridgeAdj.has(i)) {
        for (const ni of bridgeAdj.get(i)) {
          const nr = Math.floor(ni / gridCols);
          const nc = ni % gridCols;
          const nKey = `${nr},${nc}`;
          if (!cells.has(nKey) || visited.has(nKey)) continue;
          visited.add(nKey);
          queue.push(nKey);
        }
      }
    }
  }
  return components;
}

function checkArm(arm, meta, grid, outDir) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  let csvRows;
  try {
    csvRows = parseCsv(csvPath);
  } catch (e) {
    if (e.code === 'ENOENT') { console.log(`[${arm}] SKIP: not found`); return null; }
    throw e;
  }

  const gridRows = grid.rows;
  const gridCols = grid.cols;
  const bridgeAdj = buildBridgeAdj(grid.bridges || [], gridCols);

  // Group cells by district
  const districtCells = new Map();
  for (const r of csvRows) {
    const d = r.district;
    if (!districtCells.has(d)) districtCells.set(d, new Set());
    districtCells.get(d).add(`${r.row},${r.col}`);
  }

  const failures = [];
  const componentCounts = new Map();

  for (const [d, cells] of districtCells) {
    const n = countDistrictComponents(cells, bridgeAdj, gridRows, gridCols);
    componentCounts.set(d, n);
    if (n !== 1) {
      failures.push(`  district ${d}: ${n} components (expected 1)`);
    }
  }

  if (failures.length === 0) {
    console.log(`[${arm}] PASS: all ${districtCells.size} districts contiguous`);
    return true;
  } else {
    console.log(`[${arm}] FAIL:`);
    for (const f of failures) console.log(f);
    return false;
  }
}

function runSelftest() {
  console.log('--- SELFTEST check-contiguity.js ---');
  const dir = join(tmpdir(), `verify_cont_selftest_${process.pid}`);
  mkdirSync(dir, { recursive: true });

  // 3x2 grid (3 rows, 2 cols = 6 cells), 2 seats
  // Layout (row,col):
  // (0,0)(0,1)
  // (1,0)(1,1)
  // (2,0)(2,1)
  // All in-state
  const meta = { state: 'XX', seats: 2, residentPop: 600, idealTarget: 300.0, rows: 3, cols: 2 };
  const grid = {
    rows: 3, cols: 2,
    inState: [1, 1, 1, 1, 1, 1],
    pop: [100, 100, 100, 100, 100, 100],
    bridges: []
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
  writeFileSync(join(dir, 'grid.json'), JSON.stringify(grid));

  // GOOD: district 1 = top 3 (0,0),(0,1),(1,0) ← NOT contiguous actually...
  // Let's make it: d1=(0,0),(0,1),(1,0),(1,1) and d2=(2,0),(2,1) — both contiguous
  const goodCsv = 'row,col,district,pop\n0,0,1,100\n0,1,1,100\n1,0,1,100\n1,1,1,100\n2,0,2,100\n2,1,2,100\n';
  writeFileSync(join(dir, 'assign_accretion-west.csv'), goodCsv);

  // BAD: district 1 = (0,0) and (2,0) — NOT rook-connected (gap at (1,0) which is district 2)
  // district 2 = (0,1),(1,0),(1,1),(2,1) — contiguous
  const badCsv = 'row,col,district,pop\n0,0,1,100\n0,1,2,100\n1,0,2,100\n1,1,2,100\n2,0,1,100\n2,1,2,100\n';
  writeFileSync(join(dir, 'assign_accretion-centroid.csv'), badCsv);

  // GOOD with bridge: district 1 = (0,0),(2,0) connected via bridge [0*2+0, 2*2+0]=[0,4]
  // district 2 = (0,1),(1,0),(1,1),(2,1)
  const gridWithBridge = { ...grid, bridges: [[0, 4]] }; // cell 0=(0,0), cell 4=(2,0)
  writeFileSync(join(dir, 'grid_bridge.json'), JSON.stringify(gridWithBridge));
  // We test bridge inline below

  let allPass = true;

  const r1 = checkArmResult(dir, 'accretion-west', meta, grid);
  if (r1 === true) { console.log('SELFTEST PASS: contiguous case passed'); }
  else { console.log('SELFTEST FAIL: contiguous case incorrectly failed'); allPass = false; }

  const r2 = checkArmResult(dir, 'accretion-centroid', meta, grid);
  if (r2 === false) { console.log('SELFTEST PASS: split district detected'); }
  else { console.log('SELFTEST FAIL: split district NOT detected'); allPass = false; }

  // Test bridge: same CSV as badCsv but with a bridge connecting (0,0) to (2,0)
  // now district 1 becomes contiguous via bridge
  writeFileSync(join(dir, 'assign_splitline.csv'), badCsv);
  const r3 = checkArmResult(dir, 'splitline', meta, gridWithBridge);
  if (r3 === true) { console.log('SELFTEST PASS: bridge makes district contiguous'); }
  else { console.log('SELFTEST FAIL: bridge did not help contiguity'); allPass = false; }

  if (allPass) { console.log('SELFTEST PASS: check-contiguity.js'); }
  else { console.log('SELFTEST FAIL: check-contiguity.js'); process.exit(1); }
}

function checkArmResult(outDir, arm, meta, grid) {
  const csvPath = join(outDir, `assign_${arm}.csv`);
  let csvRows;
  try { csvRows = parseCsv(csvPath); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }

  const gridCols = grid.cols;
  const bridgeAdj = buildBridgeAdj(grid.bridges || [], gridCols);
  const districtCells = new Map();
  for (const r of csvRows) {
    if (!districtCells.has(r.district)) districtCells.set(r.district, new Set());
    districtCells.get(r.district).add(`${r.row},${r.col}`);
  }
  let pass = true;
  for (const [d, cells] of districtCells) {
    const n = countDistrictComponents(cells, bridgeAdj, grid.rows, grid.cols);
    if (n !== 1) { pass = false; break; }
  }
  return pass;
}

// --- MAIN ---
const args = process.argv.slice(2);
if (args.includes('--selftest')) { runSelftest(); process.exit(0); }

const ST = args[0];
if (!ST) { console.error('Usage: node check-contiguity.js <ST> [--selftest]'); process.exit(1); }

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
