// Per-district stats + canonical CSV + GeoJSON + scores.csv aggregation (INTERFACES.md).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dissolveDistrict } from './geo.js';

export function buildCsv(grid, district) {
  const { rows, cols, inState, pop } = grid;
  const lines = ['row,col,district,pop'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (inState[i]) lines.push(`${r},${c},${district[i]},${pop[i]}`);
    }
  }
  return lines.join('\n') + '\n'; // LF only, final newline
}

export function districtStats(grid, meta, district, repairStats, sha256, arm) {
  const { rows, cols, inState, pop } = grid;
  const n = rows * cols;
  const per = new Map();
  for (let i = 0; i < n; i++) {
    if (!inState[i] || district[i] < 1) continue;
    const d = district[i];
    if (!per.has(d)) per.set(d, { pop: 0, cells: 0, exposed: 0, minR: Infinity, maxR: -1, minC: Infinity, maxC: -1 });
    const s = per.get(d);
    s.pop += pop[i];
    s.cells++;
    const r = Math.floor(i / cols), c = i % cols;
    if (r < s.minR) s.minR = r; if (r > s.maxR) s.maxR = r;
    if (c < s.minC) s.minC = c; if (c > s.maxC) s.maxC = c;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      const j = nr * cols + nc;
      const sameDistrict =
        nr >= 0 && nr < rows && nc >= 0 && nc < cols && inState[j] && district[j] === d;
      if (!sameDistrict) s.exposed++; // bridges do NOT remove exposure (INTERFACES.md)
    }
  }
  const districts = [...per.keys()].sort((a, b) => a - b).map((d) => {
    const s = per.get(d);
    const pp = (4 * Math.PI * s.cells) / (s.exposed * s.exposed);
    const ppn = pp / (Math.PI / 4);
    const w = s.maxC - s.minC + 1, h = s.maxR - s.minR + 1;
    const bboxAspect = Math.max(w, h) / Math.min(w, h);
    const bboxFill = s.cells / (w * h);
    // Full precision — the independent verifier compares at 1e-9 per INTERFACES.md (FL-005)
    return {
      district: d,
      pop: s.pop,
      cells: s.cells,
      deviationPct: ((s.pop - meta.idealTarget) / meta.idealTarget) * 100,
      ppn,
      bboxAspect,
      bboxFill,
      irregular: ppn < 0.45 || bboxAspect > 2.0 || bboxFill < 0.45,
    };
  });
  return { arm, districts, repair: repairStats, sha256 }; // arm is contractual (INTERFACES stats schema)
}

export function buildGeojson(grid, meta, district, stats) {
  const { rows, cols, inState } = grid;
  const features = stats.districts.map((ds) => {
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (inState[i] && district[i] === ds.district) cells.push([r, c]);
    }
    const isSame = (r, c) =>
      r >= 0 && r < rows && c >= 0 && c < cols && inState[r * cols + c] === 1 && district[r * cols + c] === ds.district;
    const geometry = dissolveDistrict(cells, isSame, meta);
    // Exactly the six enumerated contract fields (review m1: doc lists 6, not the full entry)
    const { district: d, pop, deviationPct, cells: nCells, ppn, irregular } = ds;
    return { type: 'Feature', properties: { district: d, pop, deviationPct, cells: nCells, ppn, irregular }, geometry };
  });
  return { type: 'FeatureCollection', features };
}

export function sha256Of(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Contiguity component count per district (bridges count as edges) — for the eligible flag. */
export function contiguityOk(grid, meta, district) {
  const { rows, cols, inState, bridges } = grid;
  const n = rows * cols;
  const bridgeMap = new Map();
  for (const [a, b] of bridges || []) {
    if (!bridgeMap.has(a)) bridgeMap.set(a, []);
    if (!bridgeMap.has(b)) bridgeMap.set(b, []);
    bridgeMap.get(a).push(b);
    bridgeMap.get(b).push(a);
  }
  for (let d = 1; d <= meta.seats; d++) {
    const cells = [];
    for (let i = 0; i < n; i++) if (inState[i] && district[i] === d) cells.push(i);
    if (!cells.length) return false;
    const cellSet = new Set(cells);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop();
      const r = Math.floor(i / cols), c = i % cols;
      const nbrs = [];
      if (r > 0) nbrs.push(i - cols);
      if (r < rows - 1) nbrs.push(i + cols);
      if (c > 0) nbrs.push(i - 1);
      if (c < cols - 1) nbrs.push(i + 1);
      for (const j of nbrs.concat(bridgeMap.get(i) || [])) {
        if (cellSet.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

export function writeScoresCsv(outDir, meta, arms) {
  // arms: [{arm, stats, contiguous}]
  // Deviation gates per ab-metrics.md: CO pilot ±1%; national ±2%; hot-cell states
  // (NY/CA/IL/NJ) flagged-not-failed — reported in gateFailures, doesn't kill eligibility.
  const GATE_DEV = meta.state === 'CO' ? 1.0 : 2.0;
  const FLAG_NOT_FAIL = ['NY', 'CA', 'IL', 'NJ'].includes(meta.state);
  const rows = ['arm,eligible,gateFailures,maxAbsDevPct,meanAbsDevPct,irregularCount,meanPpn,repairMoves,sha256'];
  for (const { arm, stats, contiguous } of arms) {
    const devs = stats.districts.map((d) => Math.abs(d.deviationPct));
    const maxDev = Math.max(...devs);
    const meanDev = devs.reduce((a, b) => a + b, 0) / devs.length;
    const irregular = stats.districts.filter((d) => d.irregular).length;
    const meanPpn = stats.districts.reduce((a, d) => a + d.ppn, 0) / stats.districts.length;
    const fails = [];
    if (maxDev > GATE_DEV) fails.push(FLAG_NOT_FAIL ? 'G1-flagged-not-failed' : 'G1-population');
    if (!contiguous) fails.push('G2-contiguity');
    if (stats.districts.length !== meta.seats) fails.push('G4-coverage');
    const hardFails = fails.filter((f) => f !== 'G1-flagged-not-failed');
    const repairMoves = stats.repair.orphanCellsMoved + stats.repair.rebalanceMoves;
    rows.push([
      arm, hardFails.length === 0, fails.join('+') || 'none',
      maxDev.toFixed(4), meanDev.toFixed(4), irregular,
      meanPpn.toFixed(4), repairMoves, stats.sha256,
    ].join(','));
  }
  fs.writeFileSync(path.join(outDir, 'scores.csv'), rows.join('\n') + '\n');
  return rows.join('\n');
}
