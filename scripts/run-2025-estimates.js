// 2025 ESTIMATE RUN — the historical-run methodology, run FORWARD to the present.
//
// Cell populations = 2020 block populations scaled by county-level ratio
//   est2025(county) / pop2020(county), with a state-level ratio fallback for county FIPS
// that don't match (notably Connecticut, whose Vintage-2025 estimates use the nine
// planning regions 09110-09190 while 2020 block GEOIDs carry the legacy counties —
// CT therefore scales statewide and its coverage reads ~0%, by design, disclosed).
// Seats = the CURRENT apportionment (set by the 2020 census) — the actual House today.
// This is a labeled ESTIMATE everywhere it surfaces, exactly like the 1950-2010 maps.
//
// Inputs:  data/estimates/county_pop_2025.json   (fetched + gated from census.gov)
// Outputs: out/<ST>/history/2025/{stats.json, map.png}
// Ledger:  data/estimates/run_ledger_2025.json (resumable; --force to redo, --only CO,NY)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const { FIPS, SEATS } = await import('../src/constants.js');
const { runSplitline } = await import('../src/traverse/splitline.js');
const { repair } = await import('../src/repair.js');
const { districtStats } = await import('../src/score.js');
const shapefile = (await import('shapefile')).default;
const { ensureBlockDbf } = await import('../src/download.js');

const C25_PATH = 'data/estimates/county_pop_2025.json';
if (!fs.existsSync(C25_PATH)) { console.error(`${C25_PATH} missing — run the county fetch agent first`); process.exit(1); }
const C25 = JSON.parse(fs.readFileSync(C25_PATH, 'utf8'));
const COUNTY25 = C25.counties; // { '01001': { base2020, est2025 }, ... }

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const force = args.includes('--force');
const LEDGER_PATH = 'data/estimates/run_ledger_2025.json';
const ledger = fs.existsSync(LEDGER_PATH) ? JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')) : {};
const saveLedger = () => fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1) + '\n');

// ---------- PNG (identical encoder/palette to historical-run.js) ----------
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

// ---------- per-state machinery (identical to historical-run.js) ----------
async function cellCountyPops(abbr, grid) {
  const meta = JSON.parse(fs.readFileSync(path.join('out', abbr, 'meta.json'), 'utf8'));
  const dbfPath = await ensureBlockDbf(FIPS[abbr]);
  const source = await shapefile.openDbf(dbfPath);
  const proj4 = (await import('proj4')).default;
  const { PROJ_5070 } = await import('../src/constants.js');
  proj4.defs('EPSG:5070', PROJ_5070);
  const fwd = proj4('EPSG:4326', 'EPSG:5070').forward;
  const cellCounty = new Map();
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
const D = '2025';

for (const abbr of states) {
  if (only && !only.includes(abbr)) continue;
  const fips2 = FIPS[abbr];
  const seats = SEATS[abbr];
  const key = abbr + ':' + D;
  if (ledger[key] && ledger[key].status === 'done' && !force) { skips++; continue; }
  const outDir = path.join('out', abbr, 'history', D);
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  try {
    const gridPath = path.join('out', abbr, 'grid.json');
    if (!fs.existsSync(gridPath)) {
      if (seats !== 1) throw new Error('multi-seat state with no grid — run the production batch first');
      // at-large state without a grid run: stats row only; site-build supplies the silhouette
      fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify({ decade: D, atLarge: true, seats: 1, estimate: true }) + '\n');
      ledger[key] = { status: 'done', atLarge: true };
      runs++; saveLedger(); continue;
    }
    const grid = loadGrid(abbr);
    const { cellCounty, meta } = await cellCountyPops(abbr, grid);
    const county2020 = new Map();
    for (const m of cellCounty.values()) for (const [cty, p] of m) county2020.set(cty, (county2020.get(cty) || 0) + p);

    let matched2020 = 0, total2020 = 0;
    for (const [cty, p20] of county2020) {
      total2020 += p20;
      if (COUNTY25[cty] !== undefined) matched2020 += p20;
    }
    const coverage = matched2020 / total2020;
    let stateTotal25 = 0;
    for (const [cty, v] of Object.entries(COUNTY25)) if (cty.slice(0, 2) === fips2) stateTotal25 += v.est2025;
    const stateRatio = stateTotal25 > 0 ? stateTotal25 / total2020 : 1;

    const scaled = new Int32Array(grid.rows * grid.cols);
    let scaledTotal = 0;
    for (const [i, m] of cellCounty) {
      let v = 0;
      for (const [cty, p20] of m) {
        const ratio = COUNTY25[cty] !== undefined && county2020.get(cty) > 0
          ? COUNTY25[cty].est2025 / county2020.get(cty)
          : stateRatio;
        v += p20 * ratio;
      }
      scaled[i] = Math.round(v);
      scaledTotal += scaled[i];
    }

    if (seats === 1) {
      renderPng(grid, null, path.join(outDir, 'map.png'));
      fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify({
        decade: D, atLarge: true, seats: 1, estimate: true, scaledPop: scaledTotal, coverage: Math.round(coverage * 1e4) / 1e4,
      }) + '\n');
    } else {
      const estGrid = { ...grid, pop: scaled };
      const estMeta = { ...meta, seats, residentPop: scaledTotal, idealTarget: scaledTotal / seats, state: abbr };
      const result = runSplitline(estGrid, estMeta);
      const repairStats = repair(estGrid, estMeta, result.district, result.anchors);
      const stats = districtStats(estGrid, estMeta, result.district, repairStats, 'estimate', 'splitline-2025');
      const devs = stats.districts.map((x) => Math.abs(x.deviationPct));
      renderPng(estGrid, result.district, path.join(outDir, 'map.png'));
      fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify({
        decade: D, seats, estimate: true, scaledPop: scaledTotal, coverage: Math.round(coverage * 1e4) / 1e4,
        maxAbsDevPct: Math.max(...devs), irregular: stats.districts.filter((x) => x.irregular).length,
        districts: stats.districts.map((x) => ({ district: x.district, pop: x.pop, deviationPct: x.deviationPct })),
        methodology: 'ESTIMATE: 2020 block geography scaled by county-level Vintage 2025 ratios (July 1, 2025); current (2020-census) apportionment',
      }, null, 1) + '\n');
    }
    ledger[key] = { status: 'done', seats, coverage: Math.round(coverage * 1e4) / 1e4, ms: Date.now() - t0 };
    runs++;
    console.log(`${abbr} 2025: seats=${seats} coverage=${(coverage * 100).toFixed(1)}% (${Date.now() - t0}ms)`);
  } catch (e) {
    ledger[key] = { status: 'failed', error: String(e.message).slice(0, 200) };
    fails++;
    console.log(`${abbr} 2025: FAILED — ${e.message}`);
  }
  saveLedger();
}
console.log(`\n2025 ESTIMATE BATCH: runs=${runs} skipped=${skips} failed=${fails}`);
process.exit(fails > 0 ? 2 : 0);
