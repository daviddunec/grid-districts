// HISTORICAL DEMONSTRATION RUNNER — "what if this process had been used since 1950?"
//
// METHODOLOGY (clearly an approximation, labeled as such everywhere it surfaces):
//   Cell populations for decade D = 2020 block populations scaled by county-level ratio
//   pop_D(county) / pop_2020(county), with a state-level ratio fallback for county FIPS
//   that don't match across vintages. I.e., the 2020 settlement PATTERN is held fixed
//   and rescaled to each decade's county totals. District counts use that decade's
//   actual apportionment. This is a demonstration of the process across history, not a
//   reconstruction of historical block-level geography (which does not exist digitally).
//
// Per state per decade -> out/<ST>/history/<decade>/{stats.json, map.png}
// Resumable via data/history/run_ledger.json. Splitline arm (the production arm).
// Usage: node scripts/historical-run.js [--only CO,NY] [--decades 1950,1990] [--force]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const { FIPS, AT_LARGE, RESIDENT_POP } = await import('../src/constants.js');
const { buildGrid } = await import('../src/grid.js');
const { runSplitline } = await import('../src/traverse/splitline.js');
const { repair } = await import('../src/repair.js');
const { districtStats } = await import('../src/score.js');
const shapefile = (await import('shapefile')).default;
const { ensureBlockDbf } = await import('../src/download.js');

const APPORTIONMENT = JSON.parse(fs.readFileSync('data/history/apportionment.json', 'utf8'));
const COUNTY = JSON.parse(fs.readFileSync('data/history/county_pops.json', 'utf8'));
const DECADES = ['1950', '1960', '1970', '1980', '1990', '2000', '2010'];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const decadesArg = args.includes('--decades') ? args[args.indexOf('--decades') + 1].split(',') : DECADES;
const force = args.includes('--force');

const LEDGER_PATH = 'data/history/run_ledger.json';
const ledger = fs.existsSync(LEDGER_PATH) ? JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')) : {};
const saveLedger = () => fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1) + '\n');

// ---------- PNG (same minimal encoder as the summary builder) ----------
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const body = Buffer.concat([Buffer.from(ty), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(body), 0); return Buffer.concat([l, body, cr]); };
const encodePNG = (w, h, rgb) => { const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const st = w * 3; const raw = Buffer.alloc((st + 1) * h); for (let y = 0; y < h; y++) rgb.copy(raw, y * (st + 1) + 1, y * st, y * st + st); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); };
const hsl = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]; };
const CAT = ['#4e79a7', '#f28e2b', '#e15759', '#59a14f', '#b07aa1', '#edc948', '#76b7b2', '#ff5d8f', '#9c755f', '#17becf', '#bcbd22', '#8c564b'].map((x) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]);
const color = (d) => (d <= 12 ? CAT[d - 1] : hsl(((d - 1) * 137.508) % 360, 0.62, 0.52));

function renderPng(grid, district, outPath, maxDim = 300) {
  const { rows, cols, inState } = grid;
  const scale = Math.max(1, Math.max(rows, cols) / maxDim);
  const tw = Math.max(1, Math.round(cols / scale)), th = Math.max(1, Math.round(rows / scale));
  const counts = new Map();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    if (!inState[i]) continue;
    const key = Math.min(th - 1, Math.floor(r / scale)) * tw + Math.min(tw - 1, Math.floor(c / scale));
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key);
    const d = district ? district[i] : 1;
    m.set(d, (m.get(d) || 0) + 1);
  }
  const rgb = Buffer.alloc(tw * th * 3, 255);
  for (const [key, m] of counts) {
    let bd = -1, bn = -1;
    for (const [d, n] of m) if (n > bn || (n === bn && d < bd)) { bd = d; bn = n; }
    const [R, G, B] = color(bd);
    rgb[key * 3] = R; rgb[key * 3 + 1] = G; rgb[key * 3 + 2] = B;
  }
  fs.writeFileSync(outPath, encodePNG(tw, th, rgb));
}

// ---------- per-state machinery ----------
async function cellCountyPops(abbr, grid) {
  // One DBF pass: per-cell, per-county 2020 population (county = GEOID20 first 5 chars).
  const meta = JSON.parse(fs.readFileSync(path.join('out', abbr, 'meta.json'), 'utf8'));
  const dbfPath = await ensureBlockDbf(FIPS[abbr]);
  const source = await shapefile.openDbf(dbfPath);
  const proj4 = (await import('proj4')).default;
  const { PROJ_5070 } = await import('../src/constants.js');
  proj4.defs('EPSG:5070', PROJ_5070);
  const fwd = proj4('EPSG:4326', 'EPSG:5070').forward;
  const cellCounty = new Map(); // i -> Map(countyFips -> pop2020)
  for (;;) {
    const { done, value } = await source.read();
    if (done) break;
    const pop = Number(value.POP20);
    if (pop <= 0) continue;
    const [x, y] = fwd([parseFloat(value.INTPTLON20), parseFloat(value.INTPTLAT20)]);
    const c = Math.floor((x - meta.originX) / meta.cellSizeM);
    const r = Math.floor((meta.originYTop - y) / meta.cellSizeM);
    const i = r * grid.cols + c;
    const county = value.GEOID20.slice(0, 5);
    if (!cellCounty.has(i)) cellCounty.set(i, new Map());
    const m = cellCounty.get(i);
    m.set(county, (m.get(county) || 0) + pop);
  }
  return { cellCounty, meta };
}

function loadGrid(abbr) {
  const g = JSON.parse(fs.readFileSync(path.join('out', abbr, 'grid.json'), 'utf8'));
  return { rows: g.rows, cols: g.cols, inState: Uint8Array.from(g.inState), pop: Int32Array.from(g.pop), bridges: g.bridges };
}

const states = Object.keys(FIPS).sort((a, b) => FIPS[a].localeCompare(FIPS[b]));
let runs = 0, skips = 0, fails = 0;

for (const abbr of states) {
  if (only && !only.includes(abbr)) continue;
  const fips2 = FIPS[abbr];
  // which target decades does this state need a map for? (seats >= 2 that decade)
  const needed = decadesArg.filter((d) => (APPORTIONMENT.seats[d] || {})[abbr] >= 2);
  const atLargeDecades = decadesArg.filter((d) => (APPORTIONMENT.seats[d] || {})[abbr] === 1);
  if (!needed.length && !atLargeDecades.length) continue;

  // Grid: build if missing (ND/SD are 2020-at-large but had 2 seats historically)
  const gridPath = path.join('out', abbr, 'grid.json');
  if (!fs.existsSync(gridPath)) {
    if (!needed.length) { // only at-large decades -> no grid required, record rows
      for (const d of atLargeDecades) {
        const key = abbr + ':' + d;
        if (ledger[key] && ledger[key].status === 'done' && !force) { skips++; continue; }
        fs.mkdirSync(path.join('out', abbr, 'history', d), { recursive: true });
        fs.writeFileSync(path.join('out', abbr, 'history', d, 'stats.json'),
          JSON.stringify({ decade: d, atLarge: true, seats: 1 }) + '\n');
        ledger[key] = { status: 'done', atLarge: true };
        runs++;
      }
      saveLedger();
      continue;
    }
    console.log(`${abbr}: building grid (historical multi-seat state)...`);
    try {
      // bypass requireState's at-large early-return by calling buildGrid on a shimmed entry
      if (AT_LARGE.includes(abbr)) {
        // temporary historical shim: buildGrid uses requireState internally; ND/SD have
        // confirmed pops in RESIDENT_POP, so monkey-patch is unnecessary if we call the
        // internal path. Simplest correct route: build via a one-off inline variant.
        await buildGridForceMultiseat(abbr);
      } else {
        await buildGrid(abbr);
      }
    } catch (e) {
      console.log(`${abbr}: grid build failed — ${e.message}`);
      fails++;
      continue;
    }
  }

  const grid = loadGrid(abbr);
  const { cellCounty, meta } = await cellCountyPops(abbr, grid);

  // 2020 county totals from our own blocks (the internally-consistent scaling base)
  const county2020 = new Map();
  for (const m of cellCounty.values()) for (const [cty, p] of m) county2020.set(cty, (county2020.get(cty) || 0) + p);

  for (const d of decadesArg) {
    const seats = (APPORTIONMENT.seats[d] || {})[abbr];
    if (!seats) continue; // not a state that decade (AK/HI pre-statehood)
    const key = abbr + ':' + d;
    if (ledger[key] && ledger[key].status === 'done' && !force) { skips++; continue; }
    const outDir = path.join('out', abbr, 'history', d);
    fs.mkdirSync(outDir, { recursive: true });
    const t0 = Date.now();
    try {
      const decadeCounties = COUNTY.pops[d] || {};
      // ratios + coverage
      let matched2020 = 0, total2020 = 0, decadeMatchedSum = 0;
      for (const [cty, p20] of county2020) {
        total2020 += p20;
        if (decadeCounties[cty] !== undefined) { matched2020 += p20; decadeMatchedSum += decadeCounties[cty]; }
      }
      const coverage = matched2020 / total2020;
      // state fallback ratio: decade state total (all decade counties in this state) / our 2020 total
      let decadeStateTotal = 0;
      for (const [cty, p] of Object.entries(decadeCounties)) if (cty.slice(0, 2) === fips2) decadeStateTotal += p;
      const stateRatio = decadeStateTotal > 0 ? decadeStateTotal / total2020 : 1;

      const scaled = new Int32Array(grid.rows * grid.cols);
      let scaledTotal = 0;
      for (const [i, m] of cellCounty) {
        let v = 0;
        for (const [cty, p20] of m) {
          const ratio = decadeCounties[cty] !== undefined && county2020.get(cty) > 0
            ? decadeCounties[cty] / county2020.get(cty)
            : stateRatio;
          v += p20 * ratio;
        }
        scaled[i] = Math.round(v);
        scaledTotal += scaled[i];
      }

      if (seats === 1) {
        renderPng(grid, null, path.join(outDir, 'map.png'));
        fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify({
          decade: d, atLarge: true, seats: 1, scaledPop: scaledTotal, coverage: Math.round(coverage * 1e4) / 1e4,
        }) + '\n');
      } else {
        const histGrid = { ...grid, pop: scaled };
        const histMeta = { ...meta, seats, residentPop: scaledTotal, idealTarget: scaledTotal / seats, state: abbr };
        const result = runSplitline(histGrid, histMeta);
        const repairStats = repair(histGrid, histMeta, result.district, result.anchors);
        const stats = districtStats(histGrid, histMeta, result.district, repairStats, 'historical', 'splitline-' + d);
        const devs = stats.districts.map((x) => Math.abs(x.deviationPct));
        renderPng(histGrid, result.district, path.join(outDir, 'map.png'));
        fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify({
          decade: d, seats, scaledPop: scaledTotal, coverage: Math.round(coverage * 1e4) / 1e4,
          maxAbsDevPct: Math.max(...devs), irregular: stats.districts.filter((x) => x.irregular).length,
          districts: stats.districts.map((x) => ({ district: x.district, pop: x.pop, deviationPct: x.deviationPct })),
          methodology: 'APPROXIMATION: 2020 block geography scaled by county-level decade ratios',
        }, null, 1) + '\n');
      }
      ledger[key] = { status: 'done', seats, coverage: Math.round(coverage * 1e4) / 1e4, ms: Date.now() - t0 };
      runs++;
      console.log(`${abbr} ${d}: seats=${seats} coverage=${(coverage * 100).toFixed(1)}% (${Date.now() - t0}ms)`);
    } catch (e) {
      ledger[key] = { status: 'failed', error: String(e.message).slice(0, 200) };
      fails++;
      console.log(`${abbr} ${d}: FAILED — ${e.message}`);
    }
    saveLedger();
  }
}

console.log(`\nHISTORY BATCH: runs=${runs} skipped=${skips} failed=${fails}`);
process.exit(fails > 0 ? 2 : 0);

// ND/SD: 2020-at-large states that need a grid for historical multi-seat decades.
// Reuses buildGrid's own module by temporarily masking the at-large guard via env flag
// is invasive; instead we duplicate the tiny guard check here by calling the underlying
// pipeline directly through a state object identical to requireState's multi-seat shape.
async function buildGridForceMultiseat(abbr) {
  const constants = await import('../src/constants.js');
  const original = constants.AT_LARGE;
  // constants.AT_LARGE is a const export (array) — mutate contents temporarily, restore after.
  const idx = original.indexOf(abbr);
  if (idx !== -1) original.splice(idx, 1);
  try {
    await buildGrid(abbr);
  } finally {
    if (idx !== -1) original.splice(idx, 0, abbr);
  }
}
