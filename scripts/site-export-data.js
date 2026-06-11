// SITE DATA EXPORTER -> site/data/
//   grid-<ST>.json      2020 district grid, RLE-compressed, cropped to the in-state bbox
//                       (powers the hover-interactive canvas map on every state page)
//   us-map.json         simplified state outlines as SVG paths (Albers + AK/HI insets)
//                       (powers the clickable US map on the landing page)
//   demo-cuts-CO.json   the actual splitline recursion trace for Colorado
//                       (powers the "watch it draw a real state" animation)
// Also proves the new optional onCut hook changes nothing: runs splitline on CO
// with and without the hook and requires identical district arrays.
// All numbers read from engine outputs; nothing hand-typed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const { SEATS, FIPS, AT_LARGE, PROJ_5070, PROJ_3338, PROJ_HI } = await import('../src/constants.js');
const { runSplitline } = await import('../src/traverse/splitline.js');

fs.mkdirSync('site/data', { recursive: true });

// ---------- shared: RLE over a cropped window ----------
// Flat [value,len, value,len, ...] pairs, row-major over the crop window. 0 = outside.
function rleEncode(get, r0, c0, h, w) {
  const out = [];
  let cur = null, len = 0;
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) {
      const v = get(r, c);
      if (v === cur) len++;
      else { if (cur !== null) out.push(cur, len); cur = v; len = 1; }
    }
  }
  if (cur !== null) out.push(cur, len);
  return out;
}

// ---------- 1) per-state 2020 RLE grids ----------
let gridsBuilt = 0, gridBytes = 0;
for (const abbr of Object.keys(SEATS)) {
  const assignPath = path.join('out', abbr, 'assign_splitline.csv');
  if (!fs.existsSync(assignPath)) continue; // at-large states have no grid run
  const meta = JSON.parse(fs.readFileSync(path.join('out', abbr, 'meta.json'), 'utf8'));
  const stats = JSON.parse(fs.readFileSync(path.join('out', abbr, 'stats_splitline.json'), 'utf8'));
  const { rows, cols } = meta;
  const dist = new Int16Array(rows * cols); // 0 = out of state
  const lines = fs.readFileSync(assignPath, 'utf8').trim().split('\n');
  let rMin = rows, rMax = -1, cMin = cols, cMax = -1;
  for (let i = 1; i < lines.length; i++) {
    const [r, c, d] = lines[i].split(',').map(Number);
    dist[r * cols + c] = d;
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
    if (c < cMin) cMin = c; if (c > cMax) cMax = c;
  }
  const h = rMax - rMin + 1, w = cMax - cMin + 1;
  const rle = rleEncode((r, c) => dist[r * cols + c], rMin, cMin, h, w);
  const payload = {
    abbr, seats: meta.seats, ideal: meta.idealTarget,
    h, w, rle,
    districts: stats.districts.map((x) => ({ d: x.district, pop: x.pop, dev: x.deviationPct, irregular: !!x.irregular })),
  };
  const json = JSON.stringify(payload);
  fs.writeFileSync(path.join('site/data', `grid-${abbr}.json`), json);
  gridsBuilt++; gridBytes += json.length;
}
console.log(`grids: ${gridsBuilt} states, ${(gridBytes / 1024).toFixed(0)} KB total`);

// ---------- 2) US map (simplified outlines, AK/HI insets) ----------
const { ensureStateBoundary } = await import('../src/download.js');
const shapefile = (await import('shapefile')).default;
const { shpPath, dbfPath } = await ensureStateBoundary();

const ringArea = (ring) => { // shoelace, projected m^2 (abs)
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
};

// iterative Douglas-Peucker
function simplify(ring, tol) {
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [i0, i1] = stack.pop();
    if (i1 - i0 < 2) continue;
    const [x0, y0] = ring[i0], [x1, y1] = ring[i1];
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    let best = -1, bestD = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, py] = ring[i];
      let d;
      if (L2 === 0) d = (px - x0) ** 2 + (py - y0) ** 2;
      else {
        const u = ((px - x0) * dx + (py - y0) * dy) / L2;
        const cx = x0 + Math.max(0, Math.min(1, u)) * dx, cy = y0 + Math.max(0, Math.min(1, u)) * dy;
        d = (px - cx) ** 2 + (py - cy) ** 2;
      }
      if (d > bestD) { bestD = d; best = i; }
    }
    if (bestD > t2) { keep[best] = 1; stack.push([i0, best], [best, i1]); }
  }
  const out = [];
  for (let i = 0; i < ring.length; i++) if (keep[i]) out.push(ring[i]);
  return out;
}

const projConus = proj4(PROJ_5070), projAK = proj4(PROJ_3338), projHI = proj4(PROJ_HI);
const source = await shapefile.open(shpPath, dbfPath);
const ABBR_BY_FIPS = Object.fromEntries(Object.entries(FIPS).map(([a, f]) => [f, a]));
const projected = {}; // abbr -> [rings in projected meters]
for (;;) {
  const { done, value } = await source.read();
  if (done) break;
  const abbr = ABBR_BY_FIPS[value.properties.STATEFP];
  if (!abbr) continue; // DC, PR, territories
  const geom = value.geometry;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const proj = abbr === 'AK' ? projAK : abbr === 'HI' ? projHI : projConus;
  const minArea = abbr === 'AK' ? 1.2e9 : abbr === 'HI' ? 1.0e8 : 4.0e8; // m^2: drop specks, keep real islands
  const tol = abbr === 'AK' ? 5000 : abbr === 'HI' ? 700 : 2200; // m
  const rings = [];
  for (const poly of polys) {
    const outer = poly[0].map(([lon, lat]) => proj.forward([abbr === 'AK' && lon > 0 ? lon - 360 : lon, lat]));
    if (ringArea(outer) < minArea) continue;
    const s = simplify(outer, tol);
    if (s.length >= 4) rings.push(s);
  }
  rings.sort((a, b) => ringArea(b) - ringArea(a));
  projected[abbr] = abbr === 'AK' ? rings.slice(0, 14) : rings; // cap Aleutian chain length
}

// CONUS fit: [padX..980-padX] x [pad..~] preserving aspect
const conusAbbrs = Object.keys(projected).filter((a) => a !== 'AK' && a !== 'HI');
let cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity;
for (const a of conusAbbrs) for (const ring of projected[a]) for (const [x, y] of ring) {
  if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y;
}
const W = 980, PAD = 6;
const kC = (W - 2 * PAD) / (cx1 - cx0);
const conusH = (cy1 - cy0) * kC;
const H = Math.round(conusH + 58); // room for the inset row overlapping the empty SW corner
const placeConus = ([x, y]) => [PAD + (x - cx0) * kC, PAD + (cy1 - y) * kC];

// inset fit helper: fit bbox into rect, anchored bottom-left, preserving aspect
function fitRect(abbrs, rect) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const a of abbrs) for (const ring of projected[a]) for (const [x, y] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const k = Math.min(rect.w / (x1 - x0), rect.h / (y1 - y0));
  // anchor bottom-left of rect; SVG y grows downward, projected y grows upward
  return ([x, y]) => [rect.x + (x - x0) * k, rect.y + rect.h - (y - y0) * k];
}
const placeAK = fitRect(['AK'], { x: 8, y: H - 170, w: 215, h: 162 });
const placeHI = fitRect(['HI'], { x: 245, y: H - 102, w: 145, h: 94 });

const fmtPath = (rings, place) => rings.map((ring) => {
  const pts = ring.map(place).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
  return `M${pts.join('L')}Z`;
}).join('');

const usMap = { w: W, h: H, states: {} };
for (const abbr of Object.keys(projected)) {
  const place = abbr === 'AK' ? placeAK : abbr === 'HI' ? placeHI : placeConus;
  const rings = projected[abbr];
  // label anchor: centroid-ish of the largest ring's bbox
  let lx0 = Infinity, lx1 = -Infinity, ly0 = Infinity, ly1 = -Infinity;
  for (const [x, y] of rings[0]) { if (x < lx0) lx0 = x; if (x > lx1) lx1 = x; if (y < ly0) ly0 = y; if (y > ly1) ly1 = y; }
  const [labX, labY] = place([(lx0 + lx1) / 2, (ly0 + ly1) / 2]);
  usMap.states[abbr] = { d: fmtPath(rings, place), x: +labX.toFixed(1), y: +labY.toFixed(1) };
}
const usJson = JSON.stringify(usMap);
fs.writeFileSync('site/data/us-map.json', usJson);
console.log(`us-map: ${Object.keys(usMap.states).length} states, ${(usJson.length / 1024).toFixed(0)} KB, viewBox ${W}x${H}`);

// ---------- 3) CO splitline trace + hook A/B proof ----------
{
  const abbr = 'CO';
  const meta = JSON.parse(fs.readFileSync(path.join('out', abbr, 'meta.json'), 'utf8'));
  const g = JSON.parse(fs.readFileSync(path.join('out', abbr, 'grid.json'), 'utf8'));
  const grid = { rows: g.rows, cols: g.cols, inState: g.inState, pop: g.pop };

  const baseline = runSplitline(grid, meta);            // no hook
  const steps = [];
  const KEYS = { V: (r, c) => c, H: (r, c) => r, D1: (r, c) => r + c, D2: (r, c) => r - c };
  const traced = runSplitline(grid, meta, (cells, cut, s, a, b) => {
    const key = KEYS[cut.fam];
    let popA = 0, popR = 0;
    const present = new Set(cells);
    for (const i of cells) {
      popR += g.pop[i];
      if (key(Math.floor(i / g.cols), i % g.cols) <= cut.t) popA += g.pop[i];
    }
    steps.push({ fam: cut.fam, t: cut.t, s, a, b, popA, popB: popR - popA, cells: present });
  });
  // A/B proof: hook must not change the result
  let same = baseline.district.length === traced.district.length;
  if (same) for (let i = 0; i < baseline.district.length; i++) if (baseline.district[i] !== traced.district[i]) { same = false; break; }
  if (!same) throw new Error('onCut hook changed splitline output — REFUSING to export trace');
  console.log('hook A/B proof: with-hook output identical to without-hook ✓');

  // crop to the same bbox as grid-CO.json
  const gridCo = JSON.parse(fs.readFileSync('site/data/grid-CO.json', 'utf8'));
  // recompute bbox from inState (identical to assign bbox since repair covers all in-state cells)
  let rMin = g.rows, rMax = -1, cMin = g.cols, cMax = -1;
  for (let i = 0; i < g.rows * g.cols; i++) if (g.inState[i]) {
    const r = Math.floor(i / g.cols), c = i % g.cols;
    if (r < rMin) rMin = r; if (r > rMax) rMax = r; if (c < cMin) cMin = c; if (c > cMax) cMax = c;
  }
  const h = rMax - rMin + 1, w = cMax - cMin + 1;
  if (h !== gridCo.h || w !== gridCo.w) throw new Error(`bbox mismatch: trace ${h}x${w} vs grid-CO ${gridCo.h}x${gridCo.w}`);
  const out = {
    abbr, seats: meta.seats, ideal: meta.idealTarget, residentPop: meta.residentPop,
    h, w,
    steps: steps.map((st) => ({
      fam: st.fam, t: st.t, s: st.s, a: st.a, b: st.b, popA: st.popA, popB: st.popB,
      rle: rleEncode((r, c) => (st.cells.has(r * g.cols + c) ? 1 : 0), rMin, cMin, h, w),
    })),
    // cut thresholds are in absolute grid coords; client needs the crop offset
    r0: rMin, c0: cMin,
  };
  const json = JSON.stringify(out);
  fs.writeFileSync('site/data/demo-cuts-CO.json', json);
  console.log(`demo-cuts-CO: ${out.steps.length} cuts, ${(json.length / 1024).toFixed(0)} KB`);
}
console.log('site data export complete');
