// PR-4 synthetic tests: exercise every branch the Colorado pilot structurally cannot reach.
// (Engine-side test — imports src/ deliberately; this is NOT one of the independent verifiers.)
// T1 bridges: two-component grid gets a deterministic virtual bridge; contiguity honors it.
// T2 holes: dissolve of a ring-shaped district emits a Polygon with a hole (2 rings).
// T3 orphan repair: a district split into fragments keeps its highest-POPULATION component (FL-004).
// T4 splitline guard: cells.length <= seats does not crash and assigns 1 cell per seat.
// T5 spread ban: repair + dissolve survive a 200k-cell component (V8 spread limit regression test).
import { repair } from '../../src/repair.js';
import { runSplitline } from '../../src/traverse/splitline.js';
import { dissolveDistrict } from '../../src/geo.js';
import { contiguityOk } from '../../src/score.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
};

// --- T1: bridge contiguity ---
{
  // 6x6 grid: left island cols 0-1, right island cols 4-5, water cols 2-3
  const rows = 6, cols = 6;
  const inState = new Uint8Array(rows * cols);
  const pop = new Int32Array(rows * cols);
  for (let r = 0; r < rows; r++) for (const c of [0, 1, 4, 5]) {
    inState[r * cols + c] = 1;
    pop[r * cols + c] = 10;
  }
  const bridges = [[0 * cols + 1, 0 * cols + 4]]; // row 0: (0,1)<->(0,4)
  const grid = { rows, cols, inState, pop, bridges };
  const meta = { seats: 1, idealTarget: 240, residentPop: 240, state: 'TT' };
  const district = new Int16Array(rows * cols).fill(-1);
  for (let i = 0; i < rows * cols; i++) if (inState[i]) district[i] = 1;
  check('T1 bridge makes split landmass one contiguous district', contiguityOk(grid, meta, district) === true);
  const noBridge = { ...grid, bridges: [] };
  check('T1b without the bridge the same district is NOT contiguous', contiguityOk(noBridge, meta, district) === false);
}

// --- T2: dissolve with a hole ---
{
  // 5x5 all in district 1 except center cell (2,2) in district 2 -> D1 is a ring
  const rows = 5, cols = 5;
  const meta = { originX: 0, originYTop: 5 * 1609.344 };
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!(r === 2 && c === 2)) cells.push([r, c]);
  const isSame = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && !(r === 2 && c === 2);
  const geom = dissolveDistrict(cells, isSame, meta);
  check('T2 ring district dissolves to Polygon with exactly 2 rings (outer + hole)',
    geom.type === 'Polygon' && geom.coordinates.length === 2,
    `type=${geom.type} rings=${geom.coordinates ? geom.coordinates.length : '?'}`);
}

// --- T3: orphan repair keeps highest-population component ---
{
  // 1x9 strip: D1 = cells 0-1 (pop 5 each) and cells 4-8 (pop 100 each), D2 = cells 2-3.
  // D1 is split; the 2-cell low-pop fragment must be donated, the 500-pop body kept.
  const rows = 1, cols = 9;
  const inState = new Uint8Array(cols).fill(1);
  const pop = Int32Array.from([5, 5, 50, 50, 100, 100, 100, 100, 100]);
  const grid = { rows, cols, inState, pop, bridges: [] };
  const meta = { seats: 2, idealTarget: 305, residentPop: 610, state: 'TT' };
  const district = Int16Array.from([1, 1, 2, 2, 1, 1, 1, 1, 1]);
  const anchors = [0, 2]; // D1 anchor deliberately in the LOW-pop fragment (the FL-004 trap)
  repair(grid, meta, district, anchors);
  // Note: rebalance may legitimately shift boundary cells (4,5) to D2 to equalize pops —
  // the invariant is that D1's IDENTITY stays with the high-pop body (its far end), not
  // that every body cell stays (first version of this test over-asserted; engine was right).
  check('T3 high-pop component keeps D1 identity at its core', district[8] === 1 && district[7] === 1,
    `district=[${Array.from(district).join(',')}]`);
  check('T3b low-pop fragment donated to D2', district[0] === 2 && district[1] === 2);
  check('T3c result contiguous', contiguityOk(grid, meta, district) === true);
  {
    const p1 = Array.from(district).reduce((a, d, i) => a + (d === 1 ? pop[i] : 0), 0);
    const p2 = Array.from(district).reduce((a, d, i) => a + (d === 2 ? pop[i] : 0), 0);
    check('T3d rebalance improved population balance', Math.abs(p1 - 305) + Math.abs(p2 - 305) <= 100,
      `D1=${p1} D2=${p2} (ideal 305)`);
  }
}

// --- T4: splitline tiny-region guard ---
{
  const rows = 1, cols = 3;
  const inState = new Uint8Array(cols).fill(1);
  const pop = Int32Array.from([7, 7, 7]);
  const grid = { rows, cols, inState, pop, bridges: [] };
  const meta = { seats: 3, idealTarget: 7, residentPop: 21, state: 'TT' };
  const { district } = runSplitline(grid, meta);
  const ds = new Set(Array.from(district).filter((d) => d >= 1));
  check('T4 cells===seats splits 1 cell per district without crash', ds.size === 3,
    `districts=${[...ds].sort().join(',')}`);
}

// --- T5: 200k-cell component survives repair + dissolve (spread-ban regression) ---
{
  const rows = 450, cols = 450; // 202,500 cells, all one component
  const n = rows * cols;
  const inState = new Uint8Array(n).fill(1);
  const pop = new Int32Array(n).fill(1);
  const grid = { rows, cols, inState, pop, bridges: [] };
  const meta = { seats: 2, idealTarget: n / 2, residentPop: n, state: 'TT' };
  // D1 = a 3-cell sliver in the SE corner (anchored there), D2 = everything else, then
  // a second D1 fragment of 150k cells in the north — repair must flood/min over ~150k+ cells.
  const district = new Int16Array(n).fill(2);
  district[n - 1] = 1; district[n - 2] = 1; district[n - cols - 1] = 1;
  for (let r = 0; r < 333; r++) for (let c = 0; c < cols; c++) district[r * cols + c] = 1; // 149,850-cell D1 fragment
  const anchors = [n - 1, Math.floor(n / 2)];
  let threw = null;
  try { repair(grid, meta, district, anchors); } catch (e) { threw = e.message; }
  check('T5 repair handles a ~150k-cell component without stack overflow', threw === null, threw || '');
  check('T5b post-repair contiguous', threw === null && contiguityOk(grid, meta, district) === true);
}

console.log(failures === 0 ? 'SYNTHETIC TESTS: ALL PASS' : `SYNTHETIC TESTS: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
