// Stage 2: build the 1-mi^2 grid for a state -> out/<ST>/{meta,grid,cell_blocks}.json
// Conventions per docs/INTERFACES.md: row 0 = north, col 0 = west, i = row*cols + col.
import fs from 'node:fs';
import path from 'node:path';
import shapefile from 'shapefile';
import { CELL_M, requireState } from './constants.js';
import { ensureBlockDbf, ensureStateBoundary } from './download.js';
import { toAlbers, toLonLat, pointInState } from './geo.js';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

async function loadStatePolygon(fips) {
  const { shpPath, dbfPath } = await ensureStateBoundary();
  const source = await shapefile.open(shpPath, dbfPath);
  for (;;) {
    const { done, value } = await source.read();
    if (done) break;
    if (value.properties.STATEFP === fips) return value.geometry;
  }
  throw new Error(`State FIPS ${fips} not found in boundary file`);
}

async function loadBlocks(fips) {
  const dbfPath = await ensureBlockDbf(fips);
  const source = await shapefile.openDbf(dbfPath);
  const blocks = [];
  for (;;) {
    const { done, value } = await source.read();
    if (done) break;
    blocks.push({
      geoid: value.GEOID20,
      pop: Number(value.POP20),
      lon: parseFloat(value.INTPTLON20),
      lat: parseFloat(value.INTPTLAT20),
    });
  }
  return blocks;
}

/** Deterministic LCG permutation (seed fixed) — used only by --shuffle order-independence runs. */
function lcgShuffle(arr) {
  let s = 1;
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function buildGrid(abbr, { shuffle = false } = {}) {
  const st = requireState(abbr);
  if (st.atLarge) throw new Error(`${abbr} is at-large — no grid needed (district = state polygon)`);
  const geom = await loadStatePolygon(st.fips);
  let blocks = await loadBlocks(st.fips);
  if (shuffle) blocks = lcgShuffle(blocks);

  // Projected bbox from block points (cheap, complete) padded one cell; origins snapped
  // to absolute multiples of CELL_M (translation-invariant determinism).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const proj = new Array(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    const [x, y] = toAlbers(blocks[i].lon, blocks[i].lat);
    proj[i] = [x, y];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const originX = Math.floor((minX - CELL_M) / CELL_M) * CELL_M;
  const originYTop = Math.ceil((maxY + CELL_M) / CELL_M) * CELL_M;
  const cols = Math.ceil((maxX + CELL_M - originX) / CELL_M);
  const rows = Math.ceil((originYTop - (minY - CELL_M)) / CELL_M);

  const n = rows * cols;
  const pop = new Int32Array(n);
  const inState = new Uint8Array(n);
  const cellBlocks = new Map(); // i -> [geoid,...] populated blocks only

  // Bin blocks (OR-rule part 2: any block point marks the cell in-state, even POP20=0)
  for (let b = 0; b < blocks.length; b++) {
    const [x, y] = proj[b];
    const c = Math.floor((x - originX) / CELL_M);
    const r = Math.floor((originYTop - y) / CELL_M);
    const i = r * cols + c;
    inState[i] = 1;
    if (blocks[b].pop > 0) {
      pop[i] += blocks[b].pop;
      if (!cellBlocks.has(i)) cellBlocks.set(i, []);
      cellBlocks.get(i).push(blocks[b].geoid);
    }
  }

  // OR-rule part 1: cell centers inside the state polygon (PIP in lon/lat)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (inState[i]) continue;
      const x = originX + (c + 0.5) * CELL_M;
      const y = originYTop - (r + 0.5) * CELL_M;
      const [lon, lat] = toLonLat(x, y);
      if (pointInState(lon, lat, geom)) inState[i] = 1;
    }
  }

  // Connected components (rook) -> virtual bridges from each minor component to the main one
  const comp = new Int32Array(n).fill(-1);
  let nComp = 0;
  const compCells = [];
  for (let i = 0; i < n; i++) {
    if (!inState[i] || comp[i] !== -1) continue;
    const stack = [i], cells = [];
    comp[i] = nComp;
    while (stack.length) {
      const j = stack.pop();
      cells.push(j);
      const r = Math.floor(j / cols), c = j % cols;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const k = nr * cols + nc;
        if (inState[k] && comp[k] === -1) { comp[k] = nComp; stack.push(k); }
      }
    }
    compCells.push(cells);
    nComp++;
  }
  const bridges = [];
  if (nComp > 1) {
    const mainIdx = compCells.reduce((best, cells, idx) => cells.length > compCells[best].length ? idx : best, 0);
    // Only BOUNDARY cells can form the nearest pair on a grid — restricting both loops keeps
    // HI/MI multi-island bridge search out of O(|minor|*|main|) pairwise blowup (code review M2).
    const boundaryOf = (cells) => cells.filter((i) => {
      const r = Math.floor(i / cols), c = i % cols;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return true;
        if (!inState[nr * cols + nc]) return true;
      }
      return false;
    });
    const mainBoundary = boundaryOf(compCells[mainIdx]);
    for (let ci = 0; ci < nComp; ci++) {
      if (ci === mainIdx) continue;
      let best = null;
      for (const a of boundaryOf(compCells[ci])) {
        const ar = Math.floor(a / cols), ac = a % cols;
        for (const b of mainBoundary) {
          const br = Math.floor(b / cols), bc = b % cols;
          const d2 = (ar - br) ** 2 + (ac - bc) ** 2;
          if (!best || d2 < best.d2 || (d2 === best.d2 && (ar < best.ar || (ar === best.ar && ac < best.ac)))) {
            best = { d2, a, b, ar, ac };
          }
        }
      }
      bridges.push([best.a, best.b]);
    }
  }

  const inStateCells = inState.reduce((a, b) => a + b, 0);
  const populatedCells = cellBlocks.size;
  const totalPop = pop.reduce((a, b) => a + b, 0);
  if (totalPop !== st.residentPop)
    throw new Error(`V1 FAIL at grid stage: cell pop sum ${totalPop} !== resident ${st.residentPop}`);

  const outDir = path.join(ROOT, 'out', abbr);
  fs.mkdirSync(outDir, { recursive: true });
  const meta = {
    state: abbr, fips: st.fips, seats: st.seats, residentPop: st.residentPop,
    idealTarget: st.residentPop / st.seats,
    originX, originYTop, rows, cols, cellSizeM: CELL_M,
    inStateCells, populatedCells, blocks: blocks.length,
    populatedBlocks: blocks.filter((b) => b.pop > 0).length,
  };
  const writeJson = (name, obj) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(obj) + '\n');
  writeJson('meta.json', meta);
  writeJson('grid.json', { rows, cols, inState: Array.from(inState), pop: Array.from(pop), bridges });
  // Sorted keys + sorted GEOID lists -> byte-identical regardless of block input order
  const cb = {};
  for (const i of [...cellBlocks.keys()].sort((a, b) => a - b)) {
    const r = Math.floor(i / cols), c = i % cols;
    cb[`${r},${c}`] = cellBlocks.get(i).sort();
  }
  fs.writeFileSync(path.join(outDir, 'cell_blocks.json'), JSON.stringify(cb) + '\n');
  return meta;
}
