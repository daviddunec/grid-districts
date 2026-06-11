// INTERACTIVE WEBSITE BUILDER v2 -> site/   (static, GitHub Pages-ready, also works from file://)
//   site/index.html           scrollytelling landing: problem demo, the fix, live cut animation,
//                             clickable US map, history teaser, honest limits
//   site/how-it-works.html    plain-English walkthrough + the same animation, verification story
//   site/state/<ST>.html      hover-interactive 2020 canvas map + 1950->2020 decade slider
//   site/faq.html             hard questions, plain answers (adapted from docs/FAQ-OBJECTIONS.md)
//   site/about.html           methods, data, verification, run-it-yourself
//   site/assets/site.{css,js} shared design system + components (from scripts/site-src/)
//   site/report.html          copy of REPORT.html;  site/slides.html  copy of docs/SLIDES.html
// All numbers are computed from engine outputs at build time; nothing hand-typed.
// Prerequisite: node scripts/site-export-data.js  (grids, us-map, demo cuts)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const { SEATS, FIPS, AT_LARGE, RESIDENT_POP } = await import('../src/constants.js');
const APP = JSON.parse(fs.readFileSync('data/history/apportionment.json', 'utf8'));
const LEDGER = JSON.parse(fs.readFileSync('data/states.json', 'utf8'));
const DECADES = ['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'];
const NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
const statesSorted = Object.keys(SEATS).sort((a, b) => NAMES[a].localeCompare(NAMES[b]));
const fmt = (n) => n.toLocaleString('en-US');
const REPO_URL = 'https://github.com/daviddunec/grid-districts';

// ---------- computed facts (never hand-typed) ----------
const totalDistricts = Object.values(SEATS).reduce((a, b) => a + b, 0);
const popTotal = Object.values(RESIDENT_POP).reduce((a, b) => a + b, 0);
const ledgerRows = Object.values(LEDGER);
const cleanStates = ledgerRows.filter((r) => r.status === 'done' && r.eligible && (!r.gateFailures || r.gateFailures === 'none')).length;
const flaggedRows = ledgerRows.filter((r) => r.gateFailures && r.gateFailures !== 'none');
const nyRow = LEDGER.NY || ledgerRows.find((r) => r.abbr === 'NY');
const nyDev = nyRow ? nyRow.maxDevPct : null;
let histRuns = 0; const coverages = [];
for (const st of fs.readdirSync('out')) {
  const hd = path.join('out', st, 'history');
  if (!fs.existsSync(hd)) continue;
  for (const d of fs.readdirSync(hd)) {
    const p = path.join(hd, d, 'stats.json');
    if (!fs.existsSync(p)) continue;
    histRuns++;
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (typeof s.coverage === 'number') coverages.push(s.coverage);
  }
}
coverages.sort((a, b) => a - b);
const covMin = coverages.length ? coverages[0] : null;
const covMedian = coverages.length ? coverages[Math.floor(coverages.length / 2)] : null;
// real entries only — the FL-NNN template heading doesn't count (review F2)
const flCount = (fs.readFileSync('FAILURE-LOG.md', 'utf8').match(/^## FL-\d/gm) || []).length;

// ---------- site data (from site-export-data.js / estimates-2030.js) ----------
const USMAP = JSON.parse(fs.readFileSync('site/data/us-map.json', 'utf8'));
const CUTS = JSON.parse(fs.readFileSync('site/data/demo-cuts-CO.json', 'utf8'));
CUTS.name = NAMES[CUTS.abbr];
const GRID_CO = JSON.parse(fs.readFileSync('site/data/grid-CO.json', 'utf8'));
const ESTM = fs.existsSync('site/data/estimates.json') ? JSON.parse(fs.readFileSync('site/data/estimates.json', 'utf8')) : null;
if (!ESTM) console.warn('WARN: site/data/estimates.json missing (run scripts/estimates-2030.js) — estimate sections skipped');
// NY's densest one-square-mile cell — the truthful explanation of the NY flag (review F1)
const nyGrid = JSON.parse(fs.readFileSync('out/NY/grid.json', 'utf8'));
let NY_MAX_CELL = 0; for (const p of nyGrid.pop) if (p > NY_MAX_CELL) NY_MAX_CELL = p;
const NY_SHARE = Math.round(RESIDENT_POP.NY / SEATS.NY);
const nyFlagText = (where) => `New York&rsquo;s densest square mile holds about ${fmt(Math.round(NY_MAX_CELL / 1000) * 1000)} people — roughly a ${Math.round(NY_SHARE / NY_MAX_CELL) === 6 ? 'sixth' : '1/' + Math.round(NY_SHARE / NY_MAX_CELL)} of a whole district&rsquo;s ${fmt(NY_SHARE)}-person share — and the rule never splits a square. Cuts that land near such heavy blocks can&rsquo;t fine-tune the count, so ${where}`;

// ---------- gerrymander illustration: built AND verified here ----------
// 10x5 grid; rows 0-2 Purple voters (0), rows 3-4 Gold voters (1) -> 30 P / 20 G.
const GR = { cols: 10, rows: 5, cell: 44 };
const voters = [];
for (let r = 0; r < GR.rows; r++) for (let c = 0; c < GR.cols; c++) voters.push(r < 3 ? 0 : 1);
const A_strips = []; // vertical 2-col strips -> Purple sweep
for (let r = 0; r < GR.rows; r++) for (let c = 0; c < GR.cols; c++) A_strips.push(Math.floor(c / 2) + 1);
const B_rows = []; // horizontal rows -> proportional
for (let r = 0; r < GR.rows; r++) for (let c = 0; c < GR.cols; c++) B_rows.push(r + 1);
const C_pack = new Array(50).fill(0); // pack Purple into rows 0-1, crack the rest
{
  const set = (r, cs, d) => cs.forEach((c) => { C_pack[r * 10 + c] = d; });
  set(0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 1);
  set(1, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 2);
  set(2, [0, 1, 2, 3], 3); set(3, [0, 1, 2], 3); set(4, [0, 1, 2], 3);
  set(2, [4, 5, 6], 4); set(3, [3, 4, 5, 6], 4); set(4, [3, 4, 5], 4);
  set(2, [7, 8, 9], 5); set(3, [7, 8, 9], 5); set(4, [6, 7, 8, 9], 5);
}
function verifyPartition(assign, name) {
  const cells = {};
  assign.forEach((d, i) => { (cells[d] = cells[d] || []).push(i); });
  const dists = Object.keys(cells).map(Number).sort();
  if (dists.length !== 5) throw new Error(`${name}: expected 5 districts`);
  const tally = { P: 0, G: 0 };
  for (const d of dists) {
    const cs = cells[d];
    if (cs.length !== 10) throw new Error(`${name}: district ${d} has ${cs.length} cells`);
    // contiguity BFS
    const seen = new Set([cs[0]]); const q = [cs[0]]; const inD = new Set(cs);
    while (q.length) {
      const i = q.pop(); const r = Math.floor(i / 10), c = i % 10;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nr >= 5 || nc < 0 || nc >= 10) continue;
        const j = nr * 10 + nc;
        if (inD.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
      }
    }
    if (seen.size !== 10) throw new Error(`${name}: district ${d} not contiguous`);
    const p = cs.filter((i) => voters[i] === 0).length;
    if (p === 5) throw new Error(`${name}: district ${d} tied`);
    tally[p > 5 ? 'P' : 'G']++;
  }
  return tally;
}
const DEMO = {
  cols: GR.cols, rows: GR.rows, cell: GR.cell, voters,
  parts: [
    { key: 'fair', label: 'Follow the neighborhoods', assign: B_rows, tally: verifyPartition(B_rows, 'B'), takeaway: 'Lines that follow where people actually live: the 60% side wins 3 seats, the 40% side wins 2. The result roughly matches the voters.' },
    { key: 'strips', label: 'Tidy straight strips', assign: A_strips, tally: verifyPartition(A_strips, 'A'), takeaway: 'Exact same voters, perfectly tidy vertical lines — and Purple wins every single seat. Neat-looking lines are no guarantee of a fair outcome.' },
    { key: 'pack', label: 'Rigged on purpose', assign: C_pack, tally: verifyPartition(C_pack, 'C'), takeaway: 'Now the Gold side draws the lines: it packs Purple voters into two districts they win overwhelmingly, and spreads the rest too thin to win. The 40% minority takes a majority of the seats. (This trick has a name: "packing and cracking.")' },
  ],
};

// ---------- PNG machinery (only used to fill in any missing map images) ----------
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const body = Buffer.concat([Buffer.from(ty), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(body), 0); return Buffer.concat([l, body, cr]); };
const encodePNG = (w, h, rgb) => { const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const st = w * 3; const raw = Buffer.alloc((st + 1) * h); for (let y = 0; y < h; y++) rgb.copy(raw, y * (st + 1) + 1, y * st, y * st + st); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); };
const hsl = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]; };
const CAT = ['#4e79a7', '#f28e2b', '#e15759', '#59a14f', '#b07aa1', '#edc948', '#76b7b2', '#ff5d8f', '#9c755f', '#17becf', '#bcbd22', '#8c564b'].map((x) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]);
const color = (d) => (d <= 12 ? CAT[d - 1] : hsl(((d - 1) * 137.508) % 360, 0.62, 0.52));
function render2020Png(abbr, maxDim = 300) {
  const meta = JSON.parse(fs.readFileSync(path.join('out', abbr, 'meta.json'), 'utf8'));
  const { rows, cols } = meta;
  const scale = Math.max(1, Math.max(rows, cols) / maxDim);
  const tw = Math.max(1, Math.round(cols / scale)), th = Math.max(1, Math.round(rows / scale));
  const counts = new Map();
  const lines = fs.readFileSync(path.join('out', abbr, 'assign_splitline.csv'), 'utf8').trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const [r, c, d] = lines[i].split(',').map(Number);
    const key = Math.min(th - 1, Math.floor(r / scale)) * tw + Math.min(tw - 1, Math.floor(c / scale));
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key); m.set(d, (m.get(d) || 0) + 1);
  }
  const rgb = Buffer.alloc(tw * th * 3, 255);
  for (const [key, m] of counts) {
    let bd = -1, bn = -1;
    for (const [d, n] of m) if (n > bn || (n === bn && d < bd)) { bd = d; bn = n; }
    const [R, G, B] = color(bd); rgb[key * 3] = R; rgb[key * 3 + 1] = G; rgb[key * 3 + 2] = B;
  }
  return encodePNG(tw, th, rgb);
}
async function silhouettePng(abbr, maxDim = 300) {
  const { ensureStateBoundary } = await import('../src/download.js');
  const shapefile = (await import('shapefile')).default;
  const { toAlbers } = await import('../src/geo.js');
  const { shpPath, dbfPath } = await ensureStateBoundary();
  const source = await shapefile.open(shpPath, dbfPath);
  let geom = null;
  for (;;) { const { done, value } = await source.read(); if (done) break; if (value.properties.STATEFP === FIPS[abbr]) { geom = value.geometry; break; } }
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const rings = polys.flat().map((ring) => ring.map(([lon, lat]) => toAlbers(lon, lat)));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const scale = Math.max(maxX - minX, maxY - minY) / maxDim;
  const tw = Math.max(1, Math.round((maxX - minX) / scale)), th = Math.max(1, Math.round((maxY - minY) / scale));
  const rgb = Buffer.alloc(tw * th * 3, 255);
  const [R, G, B] = color(1);
  for (let py = 0; py < th; py++) {
    const y = maxY - (py + 0.5) * scale + 0.001;
    const xs = [];
    for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c1 = Math.max(0, Math.round((xs[k] - minX) / scale)), c2 = Math.min(tw - 1, Math.round((xs[k + 1] - minX) / scale));
      for (let c = c1; c <= c2; c++) { const off = (py * tw + c) * 3; rgb[off] = R; rgb[off + 1] = G; rgb[off + 2] = B; }
    }
  }
  return encodePNG(tw, th, rgb);
}

// ---------- shared shell ----------
const LOGO = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="9" height="9" rx="1.5" fill="#2c4bd8"/><rect x="12" y="1" width="9" height="9" rx="1.5" fill="#172554"/><rect x="1" y="12" width="9" height="9" rx="1.5" fill="#172554"/><rect x="12" y="12" width="9" height="9" rx="1.5" fill="#b07a1e"/></svg>';
function nav(rel, active) {
  const L = (href, label, key) => `<a class="link" href="${rel}${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="nav" aria-label="Main"><div class="nav-in">
<a class="brand" href="${rel}index.html">${LOGO} Grid Districts</a>
${L('how-it-works.html', 'How it works', 'how')}
${L('index.html#map', 'Your state', 'states')}
${L('faq.html', 'FAQ', 'faq')}
${L('about.html', 'About', 'about')}
</div></nav>`;
}
function footer(rel) {
  return `<footer class="site"><div class="sec-in">
<div style="max-width:340px"><div class="brand" style="color:#fff;margin-bottom:8px">${LOGO}&nbsp; Grid Districts</div>
<p>Every U.S. congressional district, drawn by one open, deterministic rule from census data alone. A benchmark for fair maps — built in the open, mistakes and all.</p>
<p style="color:#dbe3fb">Created by <b>Mark Dunec, CRE, MAI, FRICS</b> and <b>David Dunec</b>.</p></div>
<div class="cols">
<div><p class="foot-h">Explore</p><ul>
<li><a href="${rel}how-it-works.html">How it works</a></li>
<li><a href="${rel}index.html#map">Find your state</a></li>
<li><a href="${rel}faq.html">Hard questions</a></li>
<li><a href="${rel}about.html">About &amp; methods</a></li>
</ul></div>
<div><p class="foot-h">Go deeper</p><ul>
<li><a href="${rel}report.html">The full report</a></li>
<li><a href="${rel}slides.html">Briefing slides</a></li>
<li><a href="${rel}about.html#run">Run it yourself</a></li>
<li><a href="${rel}about.html#verify">How it&rsquo;s verified</a></li>
<li><a href="https://github.com/daviddunec/grid-districts">Source code on GitHub</a></li>
</ul></div>
<div><p class="foot-h">Data</p><ul>
<li>2020 Census PL&nbsp;94-171 blocks</li>
<li>Census TIGER/Line &amp; cartographic boundaries</li>
<li>Decennial county counts, 1950&ndash;2010</li>
<li>Census Vintage 2025 population estimates</li>
<li>Open source &middot; MIT license &middot; made with math</li>
</ul></div>
</div></div></footer>`;
}
function shell({ title, desc, rel, active, head = '', body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="stylesheet" href="${rel}assets/site.css">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(LOGO)}">
${head}</head><body>
<a class="skip" href="#main">Skip to content</a>
<div class="scrollbar" aria-hidden="true"></div>
${nav(rel, active)}
<noscript><div class="sec-in" style="padding:14px 22px"><p class="callout warn">The interactive maps and tables on this page need JavaScript.
All of the underlying data and findings are in <a href="${rel}report.html">the full report</a>, which works without it.</p></div></noscript>
${body}
${footer(rel)}
<script src="${rel}assets/site.js"></script>
<script>GD.reveal();GD.scrollbar();GD.counters();</script>
</body></html>`;
}

// ---------- build prep ----------
fs.mkdirSync('site/maps', { recursive: true });
fs.mkdirSync('site/state', { recursive: true });
fs.mkdirSync('site/interactive', { recursive: true });
fs.mkdirSync('site/assets', { recursive: true });
fs.copyFileSync('scripts/site-src/site.css', 'site/assets/site.css');
fs.copyFileSync('scripts/site-src/site.js', 'site/assets/site.js');
for (const [src, dst] of [['REPORT.html', 'site/report.html'], ['docs/SLIDES.html', 'site/slides.html']]) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
  else console.warn(`WARN: ${src} missing — ${dst} not updated`);
}

// ---------- US map SVG (built once, embedded in index) ----------
function usMapSvg() {
  // each state is a <g class="us-g"> holding its path + label, so hover/focus can recolor both together
  let groups = '';
  for (const abbr of statesSorted) {
    const st = USMAP.states[abbr];
    if (!st) continue;
    const seats = SEATS[abbr];
    let label = '';
    const nums = st.d.match(/-?\d+\.?\d*/g).map(Number);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < nums.length; i += 2) { const x = nums[i], y = nums[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if ((x1 - x0) * (y1 - y0) > 1500 && abbr !== 'AK' && abbr !== 'HI' && abbr !== 'MI' && abbr !== 'LA' && abbr !== 'FL') {
      label = `<text class="us-label" aria-hidden="true" x="${((x0 + x1) / 2).toFixed(0)}" y="${((y0 + y1) / 2 + 4).toFixed(0)}">${abbr}</text>`;
    } else if (abbr === 'AK' || abbr === 'HI' || abbr === 'MI' || abbr === 'LA' || abbr === 'FL') {
      label = `<text class="us-label" aria-hidden="true" x="${st.x.toFixed(0)}" y="${(st.y + 4).toFixed(0)}">${abbr}</text>`;
    }
    groups += `<g class="us-g"><path class="us-state" d="${st.d}" data-abbr="${abbr}" data-name="${NAMES[abbr]}" data-seats="${seats} seat${seats > 1 ? 's' : ''}" tabindex="0" role="link" aria-label="${NAMES[abbr]} — ${seats} seat${seats > 1 ? 's' : ''}"><title>${NAMES[abbr]}</title></path>${label}</g>`;
  }
  return `<svg class="usmap" viewBox="0 0 ${USMAP.w} ${USMAP.h}" role="group" aria-label="Map of the United States — choose a state">${groups}</svg>`;
}
const stateOptions = statesSorted.map((ab) => `<option value="${ab}">${NAMES[ab]} (${SEATS[ab]})</option>`).join('');

// ---------- per-state pages ----------
let built = 0; const missingHist = [];
for (const abbr of statesSorted) {
  const perDecade = {};
  for (const dec of DECADES) {
    const seats = (APP.seats[dec] || {})[abbr];
    if (!seats) { perDecade[dec] = { preState: true }; continue; }
    if (dec === '2020') {
      const png2020 = path.join('site/maps', `${abbr}-2020.png`);
      if (!fs.existsSync(png2020)) {
        const png = AT_LARGE.includes(abbr) && !fs.existsSync(path.join('out', abbr, 'assign_splitline.csv'))
          ? await silhouettePng(abbr) : render2020Png(abbr);
        fs.writeFileSync(png2020, png);
      }
      const entry = { seats };
      const statsPath = path.join('out', abbr, 'stats_splitline.json');
      if (fs.existsSync(statsPath)) {
        const st = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        let maxDev = 0;
        for (const x of st.districts) if (Math.abs(x.deviationPct) > maxDev) maxDev = Math.abs(x.deviationPct);
        entry.maxDev = maxDev;
        entry.districts = st.districts.map((x) => ({ d: x.district, pop: x.pop, dev: x.deviationPct }));
        entry.interactive = fs.existsSync(path.join('out', abbr, 'map_splitline.html'));
      } else if (AT_LARGE.includes(abbr)) entry.atLarge = true;
      else throw new Error(`${abbr} is multi-seat but out/${abbr}/stats_splitline.json is missing — refusing to mislabel it at-large (review MINOR-6)`);
      perDecade[dec] = entry;
    } else {
      const histDir = path.join('out', abbr, 'history', dec);
      const stPath = path.join(histDir, 'stats.json');
      const mapPath = path.join(histDir, 'map.png');
      const sitePng = path.join('site/maps', `${abbr}-${dec}.png`);
      if (!fs.existsSync(stPath)) { perDecade[dec] = { missing: true, seats }; missingHist.push(abbr + ':' + dec); continue; }
      const st = JSON.parse(fs.readFileSync(stPath, 'utf8'));
      if (!fs.existsSync(sitePng)) {
        if (fs.existsSync(mapPath)) fs.copyFileSync(mapPath, sitePng);
        else fs.writeFileSync(sitePng, await silhouettePng(abbr));
      }
      perDecade[dec] = st.atLarge
        ? { seats: 1, atLarge: true, coverage: st.coverage }
        : { seats: st.seats, maxDev: st.maxAbsDevPct, coverage: st.coverage, districts: (st.districts || []).map((x) => ({ d: x.district, pop: x.pop, dev: x.deviationPct })) };
    }
  }
  const leafletSrc = path.join('out', abbr, 'map_splitline.html');
  const leafletDst = path.join('site/interactive', `${abbr}.html`);
  if (fs.existsSync(leafletSrc) && !fs.existsSync(leafletDst)) fs.copyFileSync(leafletSrc, leafletDst);

  const gridPath = path.join('site/data', `grid-${abbr}.json`);
  const gridJson = fs.existsSync(gridPath) ? fs.readFileSync(gridPath, 'utf8') : 'null';
  const seats2020 = SEATS[abbr];
  const idx = statesSorted.indexOf(abbr);
  const prev = statesSorted[(idx + statesSorted.length - 1) % statesSorted.length];
  const next = statesSorted[(idx + 1) % statesSorted.length];
  const ledger = LEDGER[abbr] || {};
  const flagged = ledger.gateFailures && ledger.gateFailures !== 'none';

  const intro = seats2020 === 1
    ? `${NAMES[abbr]} elects one at-large representative, so the whole state is a single district — there are no lines to draw. The decade slider still shows how its seat count and population evolved since 1950.`
    : `${NAMES[abbr]} has <b>${seats2020} congressional seats</b>. Below is what one neutral, open rule draws from census data alone — no politician touched it. Hover over the 2020 map to inspect any district, and slide back through every census since 1950.`;

  const flagNote = flagged
    ? `<div class="callout warn"><p><b>Flagged for refinement.</b> ${nyFlagText(`its worst district deviates ${ledger.maxDevPct.toFixed(2)}% from a perfectly equal share — above the project&rsquo;s self-imposed 2% flag threshold`)}. The fix (subdividing only the densest cells) is specified in the report. We flag it rather than hide it.</p></div>`
    : '';
  const est = ESTM && ESTM.states[abbr];
  const estChip = est
    ? ` &middot; July 2025 estimate: ${fmt(est.est2025)} <span style="color:${est.pctChange >= 0 ? 'var(--good)' : 'var(--coral)'}">(${est.pctChange >= 0 ? '+' : ''}${est.pctChange.toFixed(1)}% since the census)</span>`
    : '';
  const estNote = est && est.seatDelta !== 0
    ? `<div class="callout"><p><b>2030 preview:</b> if the 435 House seats were re-divided today using the Census Bureau&rsquo;s July 2025 population estimates, ${NAMES[abbr]} would get <b>${est.projSeats2030} seats (${est.seatDelta > 0 ? '+' : ''}${est.seatDelta})</b>. The real 2030 reapportionment will use the actual 2030 count — this is a preview of the trend, not a prediction. Source: Census Bureau Vintage 2025 estimates; seat math uses the official Huntington&ndash;Hill method, verified by reproducing the 2020 apportionment exactly.</p></div>`
    : '';

  const body = `
<main id="main">
<section class="section tight"><div class="sec-in">
<div class="statehead"><h1>${NAMES[abbr]}</h1><span class="seats">${seats2020} seat${seats2020 > 1 ? 's' : ''} today &middot; ${fmt(RESIDENT_POP[abbr] ?? 0)} residents (2020 census)${estChip}</span></div>
<p class="lead">${intro}</p>
${estNote}
<div class="slider-row"><span class="decade-label" id="dl">2020</span>
<input type="range" id="slider" min="0" max="${DECADES.length - 1}" value="${DECADES.length - 1}" step="1" aria-label="Census decade" aria-valuetext="2020" autocomplete="off">
</div>
<div class="range-ends"><span>1950</span><span>2020</span></div>
<div class="mapframe">
<canvas id="mapcanvas" class="demo" style="display:none" role="img" aria-label="Interactive 2020 district map of ${NAMES[abbr]}. The table below lists every district.">The table below this map lists every district&rsquo;s population.</canvas>
<img id="mapimg" src="../maps/${abbr}-2020.png" alt="${NAMES[abbr]} district map, 2020">
<div class="note" id="mapnote"></div>
</div>
<div id="btns"></div>
<div id="statsbox"></div>
${flagNote}
<div class="callout"><p><b>About the historical maps (1950&ndash;2010):</b> these are labeled estimates. The same algorithm runs on each decade&rsquo;s real seat count and official county census totals, with today&rsquo;s street-level settlement pattern scaled to match (complete digital block-level data only exists for recent censuses, so every historical decade uses the same county-based method for consistency). They demonstrate the <i>process</i> across history; the 2020 map uses full census-block data. &ldquo;Coverage&rdquo; is the share of the state&rsquo;s population we matched to that decade&rsquo;s county records.</p></div>
<div class="statenav">
<a class="btn btn-ghost" href="${prev}.html">&larr; ${NAMES[prev]}</a>
<a class="btn btn-ghost" href="../index.html#map">All states</a>
<a class="btn btn-ghost" href="${next}.html">${NAMES[next]} &rarr;</a>
</div>
</div></section>
</main>
<div class="maptip2" id="maptip" role="status" aria-live="polite"></div>
<script>
window.addEventListener('DOMContentLoaded',function(){
GD.statePage({abbr:${JSON.stringify(abbr)},name:${JSON.stringify(NAMES[abbr])},decades:${JSON.stringify(DECADES)},data:${JSON.stringify(perDecade)},grid:${gridJson}});
});
</script>`;
  fs.writeFileSync(path.join('site/state', `${abbr}.html`), shell({
    title: `${NAMES[abbr]} — ${seats2020} district${seats2020 > 1 ? 's' : ''} drawn by one neutral rule | Grid Districts`,
    desc: `${NAMES[abbr]}'s congressional districts drawn by an open, deterministic algorithm from 2020 census data — plus every decade back to 1950.`,
    rel: '../', active: '', body, // no aria-current on state pages: no nav link IS this page (review a11y m4)
  }));
  built++;
}

// ---------- landing page ----------
const heroBody = `
<main id="main">
<section class="hero">
<div class="hero-deco" aria-hidden="true">
${[['#4e79a7', '6%', '12%', 26, 0], ['#f28e2b', '88%', '18%', 18, 2], ['#e15759', '12%', '72%', 14, 4], ['#59a14f', '82%', '70%', 22, 1], ['#b07aa1', '20%', '34%', 12, 3], ['#edc948', '92%', '44%', 15, 5], ['#76b7b2', '4%', '48%', 18, 6]].map(([c, l, t, s, d]) => `<span style="background:${c};left:${l};top:${t};width:${s}px;height:${s}px;animation-delay:-${d}s"></span>`).join('')}
</div>
<div class="sec-in section">
<p class="kicker">An open algorithm &middot; all 50 states &middot; no judgment calls</p>
<h1>No politician drew<br>these maps.</h1>
<p class="lead">One open rule just drew all ${fmt(totalDistricts)} U.S. House districts from census data alone.
It can&rsquo;t see race, party, or your address &mdash; and anyone can re-run it and get the <i>identical</i> maps,
every one of ${Math.floor(popTotal / 1e6)} million people accounted for.</p>
<div class="cta-row">
<a class="btn btn-primary" href="#watch">&#9654;&nbsp; Watch it draw a state</a>
<a class="btn btn-ghost" href="#map">Find your state</a>
</div>
<div class="hero-tags"><span>open source</span><span>same answer every time</span><span>verified against the 2020 Census</span></div>
</div></section>

<section class="band-navy"><div class="sec-in section tight">
<div class="stats-row">
<div class="stat"><div class="n" data-count="50">50</div><div class="l">states districted by one identical process</div></div>
<div class="stat"><div class="n" data-count="${totalDistricts}">${fmt(totalDistricts)}</div><div class="l">congressional districts drawn</div></div>
<div class="stat"><div class="n" data-count="${popTotal}">${fmt(popTotal)}</div><div class="l">people &mdash; each counted exactly once, matching the official 50-state census total to the last digit (D.C. has no House seat &mdash; <a href="faq.html" style="color:#9db1f7">why?</a>)</div></div>
<div class="stat"><div class="n">0</div><div class="l">human choices about where any line goes &mdash; the rule was fixed before any map was drawn</div></div>
</div>
</div></section>

<section class="section"><div class="sec-in narrow reveal">
<p class="kicker">The problem, in one minute</p>
<h2>Whoever draws the lines picks the winners</h2>
<p class="lead">Every ten years, each state redraws its congressional districts. In most states, the people drawing the lines
have a direct stake in the result. Here&rsquo;s why that matters &mdash; same fifty voters, three different maps:</p>
<div class="panel">
<div class="tabs" role="group" aria-label="Choose a way to draw the districts">
${DEMO.parts.map((p) => `<button class="tab" data-key="${p.key}" aria-pressed="false">${p.label}</button>`).join('')}
</div>
<svg class="gerry" viewBox="0 0 ${GR.cols * GR.cell} ${GR.rows * GR.cell}" style="width:100%;max-width:560px;display:block;margin:0 auto" role="img" aria-label="A grid of 50 voters divided into 5 districts three different ways, showing how the same voters produce different winners"></svg>
<div class="scoreboard"></div>
<p class="takeaway" aria-live="polite"></p>
<p class="small center" style="margin-top:10px">An illustration, not real data: 30 Purple voters, 20 Gold voters, five equal districts of ten. All three maps are perfectly &ldquo;legal.&rdquo; Only the line-drawer changed.</p>
</div>
<p style="margin-top:18px">This is called <b>gerrymandering</b>, and both parties do it wherever they hold the pen. The Supreme Court has said
federal courts can&rsquo;t police it (<i>Rucho v. Common Cause</i>, 2019). Every reform fight ends up stuck on the same question:
<b>who can be trusted to draw the lines?</b></p>
</div></section>

<section class="band-white"><div class="sec-in section reveal">
<p class="kicker">The fix</p>
<h2>Don&rsquo;t trust anyone. Remove the mapmaker.</h2>
<p class="lead" style="max-width:760px">This project&rsquo;s answer: a fixed, public recipe that turns census counts into districts &mdash; the same recipe
for every state, with no knobs anyone can turn. Four steps:</p>
<div class="cards c4">
<div class="card"><span class="stepnum">1</span>
<svg class="diagram" width="84" height="64" viewBox="0 0 84 64" aria-hidden="true"><path d="M6 14 L50 4 L78 22 L72 52 L30 60 L8 44 Z" fill="#eef1fd" stroke="#2c4bd8" stroke-width="2"/><g stroke="#c7d0f4" stroke-width="1"><line x1="6" y1="24" x2="78" y2="24"/><line x1="6" y1="38" x2="78" y2="38"/><line x1="24" y1="4" x2="24" y2="60"/><line x1="44" y1="4" x2="44" y2="60"/><line x1="62" y1="4" x2="62" y2="60"/></g></svg>
<h3>Lay down a grid</h3><p>Cover the state with squares of exactly one square mile (640 acres) &mdash; the same grid system every time.</p></div>
<div class="card"><span class="stepnum">2</span>
<svg class="diagram" width="84" height="64" viewBox="0 0 84 64" aria-hidden="true"><g font-family="Georgia" font-size="11" fill="#172554" text-anchor="middle"><rect x="4" y="8" width="24" height="22" fill="#eef1fd" stroke="#2c4bd8"/><text x="16" y="23">12</text><rect x="30" y="8" width="24" height="22" fill="#dce4fb" stroke="#2c4bd8"/><text x="42" y="23">847</text><rect x="56" y="8" width="24" height="22" fill="#eef1fd" stroke="#2c4bd8"/><text x="68" y="23">0</text><rect x="4" y="32" width="24" height="22" fill="#c9d6f9" stroke="#2c4bd8"/><text x="16" y="47">3,201</text><rect x="30" y="32" width="24" height="22" fill="#eef1fd" stroke="#2c4bd8"/><text x="42" y="47">96</text><rect x="56" y="32" width="24" height="22" fill="#dce4fb" stroke="#2c4bd8"/><text x="68" y="47">410</text></g></svg>
<h3>Count the people</h3><p>Fill each square with its official Census count. That number is the <i>only</i> thing the algorithm ever sees.</p></div>
<div class="card"><span class="stepnum">3</span>
<svg class="diagram" width="84" height="64" viewBox="0 0 84 64" aria-hidden="true"><path d="M6 14 L50 4 L78 22 L72 52 L30 60 L8 44 Z" fill="#eef1fd" stroke="#2c4bd8" stroke-width="2"/><line x1="40" y1="2" x2="46" y2="62" stroke="#b3552e" stroke-width="2.5" stroke-dasharray="5 3"/><line x1="8" y1="34" x2="44" y2="30" stroke="#b3552e" stroke-width="2" stroke-dasharray="5 3"/><line x1="45" y1="36" x2="76" y2="40" stroke="#b3552e" stroke-width="2" stroke-dasharray="5 3"/></svg>
<h3>Split in halves</h3><p>A fixed rule cuts the state in half by population, then halves the halves, until every district holds an equal share.</p></div>
<div class="card"><span class="stepnum">4</span>
<svg class="diagram" width="84" height="64" viewBox="0 0 84 64" aria-hidden="true"><circle cx="42" cy="30" r="24" fill="#eef7f0" stroke="#1a7f4e" stroke-width="2.5"/><path d="M30 31 L39 40 L56 21" fill="none" stroke="#1a7f4e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>
<h3>Prove it</h3><p>Independent checks confirm every person landed in exactly one district &mdash; and that re-running it reproduces the map bit-for-bit.</p></div>
</div>
<div class="callout" style="max-width:760px"><p><b>The algorithm never sees race, party, income, or addresses.</b> It can&rsquo;t favor anyone,
because it doesn&rsquo;t know who anyone is. It only knows how many people live in each square mile.</p></div>
</div></section>

<section class="section" id="watch"><div class="sec-in reveal">
<p class="kicker">See it with your own eyes</p>
<h2>Watch the rule draw Colorado &mdash; for real</h2>
<p class="lead" style="max-width:760px">This isn&rsquo;t a cartoon &mdash; it&rsquo;s the actual sequence of cuts the algorithm made to draw Colorado&rsquo;s
${CUTS.seats} districts from ${fmt(CUTS.residentPop)} census-counted residents. Every frame below is real engine output.</p>
<div class="panel">
<canvas class="demo" aria-label="Animation of the splitline algorithm cutting Colorado into 8 equal-population districts"></canvas>
<div class="anim-controls">
<button class="btn btn-primary" data-act="play">&#9654; Play</button>
<button class="btn btn-ghost" data-act="step">Next cut</button>
<button class="btn btn-ghost" data-act="reset">&#8634; Restart</button>
</div>
<div class="progress-dots" aria-hidden="true"></div>
<p class="narration" aria-live="polite"></p>
</div>
<p class="center" style="margin-top:16px"><a href="how-it-works.html">Read the full plain-English walkthrough &rarr;</a></p>
</div></section>

<section class="band-white" id="map"><div class="sec-in section reveal">
<p class="kicker">Explore the result</p>
<h2>Find your state</h2>
<p class="lead">Click or tap any state to see its districts &mdash; then slide back through every census since 1950.</p>
<div class="state-jump" style="justify-content:flex-start;margin:0 0 14px">
<label for="statejump"><b>Jump straight to a state:</b></label>
<select id="statejump" autocomplete="off">
<option value="">Choose a state&hellip;</option>
${stateOptions}
</select>
</div>
<div class="usmap-wrap">
${usMapSvg()}
<div class="map-tip" role="status" aria-live="polite"></div>
</div>
</div></section>

<section class="section"><div class="sec-in reveal">
<p class="kicker">It isn&rsquo;t about today&rsquo;s politics</p>
<h2>Same rule, any era: 1950 &rarr; 2020</h2>
<p class="lead" style="max-width:780px">We ran the identical rule for every state in every census year since 1950 &mdash; ${fmt(histRuns)} runs
in all, zero failures. Here&rsquo;s Ohio shrinking from 23 seats to 15 as its share of the nation&rsquo;s population fell. The process never
changes; only the people move.</p>
<div class="hist-strip">
${['1950', '1970', '1990', '2010', '2020'].map((d) => `<figure><img src="maps/OH-${d}.png" alt="Ohio's ${d === '2020' ? '' : 'estimated '}algorithm-drawn districts in ${d}"><figcaption>${d}</figcaption></figure>`).join('')}
</div>
<p class="small center" style="margin-top:10px">Historical maps are estimates: today&rsquo;s street-level population pattern, scaled to each
decade&rsquo;s official county counts (details in <a href="about.html">About</a>). The 2020 map uses full census-block data.</p>
<p class="center" style="margin-top:10px"><a class="btn btn-ghost" href="state/OH.html">Slide through Ohio&rsquo;s decades yourself &rarr;</a></p>
</div></section>

${ESTM ? `<section class="band-white"><div class="sec-in section reveal">
<p class="kicker">Updated with the latest numbers</p>
<h2>America has kept moving since 2020</h2>
<p class="lead" style="max-width:780px">Districts are drawn from the once-a-decade census, but the Census Bureau estimates every state&rsquo;s
population each July. As of <b>July 1, 2025</b>, the 50 states hold an estimated <b>${fmt(ESTM.national.est2025Total)}</b> people
&mdash; up ${ESTM.national.pctChange.toFixed(1)}% since the census. If the 435 seats were re-divided on those numbers today, here&rsquo;s
who would gain and lose:</p>
<div class="cards c2">
<div class="card"><h3>&#128200; Gaining seats</h3><p>${ESTM.seatChanges.filter((s) => s.delta > 0).map((s) => `<b>${NAMES[s.abbr]}</b> ${s.delta > 0 ? '+' : ''}${s.delta} (&rarr; ${s.projSeats})`).join(' &middot; ') || 'none'}</p>
<p class="small">Fastest growth since 2020: ${Object.entries(ESTM.states).sort((a, b) => b[1].pctChange - a[1].pctChange).slice(0, 3).map(([ab, s]) => `${NAMES[ab]} +${s.pctChange.toFixed(1)}%`).join(', ')}.</p></div>
<div class="card"><h3>&#128201; Losing seats</h3><p>${ESTM.seatChanges.filter((s) => s.delta < 0).map((s) => `<b>${NAMES[s.abbr]}</b> ${s.delta} (&rarr; ${s.projSeats})`).join(' &middot; ') || 'none'}</p>
<p class="small">Slowest growth since 2020: ${Object.entries(ESTM.states).sort((a, b) => a[1].pctChange - b[1].pctChange).slice(0, 3).map(([ab, s]) => `${NAMES[ab]} ${s.pctChange >= 0 ? '+' : ''}${s.pctChange.toFixed(1)}%`).join(', ')}.</p></div>
</div>
<p class="small" style="max-width:780px;margin-top:14px">A preview of the trend, not a prediction: official 2030 reapportionment will use the
actual 2030 count. Seat math uses the official Huntington&ndash;Hill method &mdash; our implementation was verified by reproducing the real 2020
apportionment of all 435 seats exactly before touching the estimates. Source: U.S. Census Bureau, Vintage 2025 Population Estimates.
The moment 2030 census data publishes, every map on this site rebuilds automatically.</p>
</div></section>` : ''}

<section class="section"><div class="sec-in reveal">
<p class="kicker">Read the fine print</p>
<h2>What this is &mdash; and what it isn&rsquo;t</h2>
<div class="cards c2">
<div class="card"><h3>A benchmark, not a ballot law</h3>
<p>By law, real enacted maps must be almost perfectly equal in population. That last fraction of a percent takes a final
fine-tuning step we deliberately leave to officials. So the proposal isn&rsquo;t &ldquo;enact these maps&rdquo; &mdash; it&rsquo;s
&ldquo;<b>publish this neutral baseline</b>, and make every state explain, in public, how far its map strays from it and why.&rdquo;</p></div>
<div class="card"><h3>The Voting Rights Act still applies</h3>
<p>A demographics-blind map can&rsquo;t, by itself, guarantee the districts the law sometimes requires so that minority voters can
elect candidates of their choice. States keep drawing their own maps under existing law &mdash; the baseline just makes every departure
visible and measurable. The draft bill says so explicitly, in a <i>savings clause</i>: a line stating that existing voting-rights law
always wins.</p></div>
<div class="card"><h3>One state is flagged, on purpose</h3>
<p>${nyFlagText(`its worst district lands ${nyDev ? nyDev.toFixed(2) : '—'}% from a perfectly equal share &mdash; above our self-imposed 2% flag threshold`)}.
${cleanStates} of 50 states pass the deviation gate clean. We publish the flag instead of hiding it; the fix is specified in the report.</p></div>
<div class="card"><h3>We publish our mistakes</h3>
<p>The project keeps a public defect log &mdash; ${flCount} issues so far, each with its root cause and fix &mdash; plus an adversarial
review trail. You shouldn&rsquo;t have to trust us: every claim on this site can be re-derived from the open code and public census data.</p></div>
</div>
</div></section>

<section class="band-navy"><div class="sec-in section center reveal">
<h2>Dig as deep as you like</h2>
<p class="lead" style="max-width:680px;margin:0 auto 22px;color:#c6d0f2">From a two-minute FAQ to the full technical report, written to be put in front of Congress.</p>
<div class="cta-row">
<a class="btn btn-primary" href="how-it-works.html">How it works</a>
<a class="btn btn-primary" href="faq.html">Hard questions</a>
<a class="btn btn-primary" href="report.html">The full report</a>
<a class="btn btn-primary" href="about.html">About the project</a>
</div>
</div></section>
</main>
<script>
window.addEventListener('DOMContentLoaded',function(){
GD.gerryDemo(document.querySelector('.panel'), ${JSON.stringify(DEMO)});
GD.cutAnim(document.querySelector('#watch .panel'), ${JSON.stringify(CUTS)}, ${JSON.stringify({ h: GRID_CO.h, w: GRID_CO.w, rle: GRID_CO.rle, districts: GRID_CO.districts })});
GD.usMap(document.querySelector('.usmap-wrap'), 'state/');
var sj=document.getElementById('statejump');
sj.addEventListener('change',function(){if(sj.value)location.href='state/'+sj.value+'.html'});
});
</script>`;
fs.writeFileSync('site/index.html', shell({
  title: 'Grid Districts — no politician drew these maps',
  desc: 'An open, deterministic algorithm drew all 435 U.S. House districts from census data alone. Watch it work, explore your state, and see every decade since 1950.',
  rel: '', active: 'home', body: heroBody,
}));

// ---------- how-it-works ----------
const hiwBody = `
<main id="main">
<section class="section tight"><div class="sec-in narrow">
<p class="kicker">The full walkthrough</p>
<h1 style="font-size:clamp(30px,4.5vw,46px)">How one rule draws every district in America</h1>
<p class="lead">No committees, no consultants, no maps drawn behind closed doors. Just census counts, squares,
and a splitting rule anyone can check. Here&rsquo;s the whole thing, in plain English.</p>
</div></section>

<section class="band-white"><div class="sec-in narrow section tight reveal">
<h2>Step 1 — The only input: where people live</h2>
<p>Every ten years, the Census Bureau counts everyone in America and publishes how many people live in each
<b>census block</b> (a block is the smallest piece of census geography &mdash; often literally a city block). That public dataset
is the algorithm&rsquo;s <i>entire</i> input. Not race. Not party registration. Not election results. Not addresses. Just:
<i>how many people are here?</i></p>
<h2>Step 2 — A grid of one-square-mile squares</h2>
<p>The state is covered with a fixed grid of squares, each exactly one square mile (640 acres), laid out the same way every
time on an equal-area map projection &mdash; so a square in Maine covers the same ground as a square in Arizona. Each census
block&rsquo;s population is placed into the square containing the block&rsquo;s official center point. For Colorado, that&rsquo;s
${fmt(CUTS.residentPop)} people distributed across the grid &mdash; and the grid total must match the state&rsquo;s official census
population <b>exactly</b>, or the build refuses to continue.</p>
<h2>Step 3 — Cut in halves until done</h2>
<p>To draw <i>n</i> districts, the rule splits the state into two regions &mdash; one side gets half the districts, the other side
the rest &mdash; using the straight cut that balances population best. Then it does the same to each half, and keeps going until every
region is exactly one district. The cut can run north&ndash;south, east&ndash;west, or diagonally; the rule always picks the one that
balances people best, with every tie broken by a fixed, published order. <b>There is no randomness anywhere</b> &mdash; that&rsquo;s
why two strangers on two computers get byte-identical maps.</p>
<div class="panel">
<canvas class="demo" aria-label="Animation of the splitline algorithm cutting Colorado into 8 equal-population districts"></canvas>
<div class="anim-controls">
<button class="btn btn-primary" data-act="play">&#9654; Play</button>
<button class="btn btn-ghost" data-act="step">Next cut</button>
<button class="btn btn-ghost" data-act="reset">&#8634; Restart</button>
</div>
<div class="progress-dots" aria-hidden="true"></div>
<p class="narration" aria-live="polite"></p>
</div>
<h2 style="margin-top:30px">Step 4 — Clean up and prove it</h2>
<p>A straight cut can occasionally strand a few cells &mdash; say, across a bay &mdash; from the rest of their district. A cleanup
pass reattaches them to the nearest neighbor district, nudging populations back into balance along the way. Then the
verification gauntlet runs:</p>
<ul>
<li><b>Exact head-count:</b> the sum of every district&rsquo;s population must equal the state&rsquo;s official census population
<i>to the last person</i> &mdash; not approximately, exactly. All 50 states pass this exact head-count match.</li>
<li><b>No double-counting:</b> every square mile belongs to exactly one district.</li>
<li><b>Connected districts:</b> you can walk (or ferry) from any part of a district to any other.</li>
<li><b>Reproducibility:</b> the engine is re-run &mdash; including with the input deliberately shuffled &mdash; and must produce a
byte-identical map, verified with cryptographic hashes (a hash is a short digital fingerprint: change even one byte of the map
and the fingerprint changes).</li>
</ul>
<p>Nationally, the ${fmt(totalDistricts)} districts account for ${fmt(popTotal)} people &mdash; matching the official 50-state census
total exactly.</p>

<h2>What the rule deliberately ignores</h2>
<p>City limits, county lines, freeways, party registration, where incumbents live, even good-faith communities of interest &mdash;
the rule sees none of it. That blindness is the point: every one of those inputs is a knob, and every knob is an invitation to put
a thumb on the scale. The cost is real (districts won&rsquo;t hug county lines; see the <a href="faq.html">FAQ</a>), but the benefit is
a reference map with <b>nothing left to rig once the rule is published</b>. (Could the rule itself have been chosen to favor
someone? That&rsquo;s a fair question &mdash; <a href="faq.html">we answer it head-on in the FAQ</a>.)</p>

<h2>Known limits, stated plainly</h2>
<ul>
<li><b>It&rsquo;s a benchmark.</b> Enacted maps must reach near-zero population deviation; that final block-level refinement is
specified but intentionally left to the official process. The proposal is a public yardstick, not a replacement mapmaker.</li>
<li><b>Dense cities strain one-mile squares.</b> ${nyFlagText(`New York&rsquo;s worst district deviates ${nyDev ? nyDev.toFixed(2) : '—'}%`)}.
${cleanStates} of 50 states come in under the 2% flag threshold; NY is flagged openly, and the refinement that fixes it is in the report.</li>
<li><b>The Voting Rights Act comes first.</b> Where the law requires minority-opportunity districts, states keep drawing them;
the baseline just measures and publicizes each departure. The draft bill has an explicit VRA savings clause.</li>
</ul>

<h2>Glossary</h2>
<details class="faq"><summary>Census block</summary><div class="a"><p>The smallest unit of census geography &mdash; often a literal
city block in town, larger in the countryside. The 2020 census counted the population of every one of them.</p></div></details>
<details class="faq"><summary>Deviation</summary><div class="a"><p>How far a district&rsquo;s population is from a perfectly equal share.
If a state with 8 seats has 8,000,000 people, the equal share is exactly 1,000,000; a district of 1,005,000 deviates +0.5%.</p></div></details>
<details class="faq"><summary>Deterministic</summary><div class="a"><p>No randomness, no judgment calls: the same input always produces
the exact same output. Anyone can re-run the code on public data and verify the maps byte-for-byte.</p></div></details>
<details class="faq"><summary>At-large state</summary><div class="a"><p>A state with only one House seat (six of them in 2020), so the
whole state is its district and there&rsquo;s nothing to draw.</p></div></details>
<details class="faq"><summary>Benchmark / baseline</summary><div class="a"><p>A neutral reference map published next to each state&rsquo;s
real, legally-enacted map &mdash; so everyone can see and measure exactly how far the real lines stray from politics-free ones.</p></div></details>
<details class="faq"><summary>Hash (digital fingerprint)</summary><div class="a"><p>A short string of letters and numbers computed from a file.
Change even one byte of the file and the hash changes completely &mdash; so two people comparing hashes can prove they have the
exact same map without sending the whole thing.</p></div></details>

<p style="margin-top:26px">Want the formal version &mdash; the precise cut rule, tie-breaking order, repair pass, and verification
hashes? It&rsquo;s all in <a href="report.html">the full report</a>, and the source code reproduces every map on this site.</p>
</div></section>
</main>
<script>
window.addEventListener('DOMContentLoaded',function(){
GD.cutAnim(document.querySelector('.panel'), ${JSON.stringify(CUTS)}, ${JSON.stringify({ h: GRID_CO.h, w: GRID_CO.w, rle: GRID_CO.rle, districts: GRID_CO.districts })});
});
</script>`;
fs.writeFileSync('site/how-it-works.html', shell({
  title: 'How it works — Grid Districts',
  desc: 'The plain-English walkthrough: how an open, deterministic rule turns census counts into all 435 congressional districts — and how every map is verified.',
  rel: '', active: 'how', body: hiwBody,
}));

// ---------- FAQ ----------
const faqs = [
  ['Doesn’t this hurt minority representation under the Voting Rights Act?',
    `<p>It would if these maps replaced the real ones — that&rsquo;s exactly why the proposal doesn&rsquo;t do that. A demographics-blind
map can&rsquo;t guarantee the minority-opportunity districts the VRA sometimes requires, so states keep drawing their own maps under
existing law. The baseline is published <i>next to</i> the enacted map, and VRA-driven choices simply become documented, justified
departures. The draft bill contains an explicit savings clause: the baseline binds no one and preempts nothing.</p>`],
  ['What about communities — city limits, county lines, neighborhoods?',
    `<p>The rule ignores them, on purpose. Every &ldquo;respect this boundary&rdquo; input is a knob, and history shows every knob gets
turned by whoever holds the pen. The baseline trades community-boundary fit for something no hand-drawn map can offer: proof that
nobody&rsquo;s thumb was on the scale. States that value county integrity can keep it in their enacted maps — and explain the
trade-off in public, with numbers.</p>`],
  ['Why squares? People don’t live in squares.',
    `<p>Squares are equal-area, identical everywhere, and impossible to nudge for advantage. One square mile is small enough to follow
real population patterns (cities get many crowded squares, ranchland gets empty ones) but large enough that the math stays simple
and checkable. The squares are just the unit we count in — like pixels in a photo.</p>`],
  ['Isn’t the deviation worse than real enacted maps?',
    `<p>Yes — and that&rsquo;s disclosed everywhere it appears. (Deviation means how far a district&rsquo;s population strays from a
perfectly equal share.) Enacted maps reach near-zero deviation by splitting individual city blocks, a refinement step this build
intentionally leaves to the official process. The benchmark&rsquo;s job is to show the <i>shape</i> of politics-free lines; the report
specifies exactly how a custodian would do the final block-level trim.</p>`],
  ['Why is New York flagged?',
    `<p>Because we don&rsquo;t hide bad numbers. ${nyFlagText(`New York&rsquo;s worst district deviates about ${nyDev ? nyDev.toFixed(2) : '—'}% from equal`)};
our self-imposed flag-it threshold is 2%. The fix — subdividing only the densest cells — is specified in the report. The other
${cleanStates} states pass the deviation gate clean.</p>`],
  ['Couldn’t someone game the algorithm?',
    `<p>After publication? No: there are no parameters to tune, no randomness to fish, no inputs except published census counts. The code
is open source; the output is deterministic; anyone can re-run it and compare hashes. The only way to change the map is to change where
people actually live — which is the one thing a map is supposed to reflect. The sharper version of this question — couldn&rsquo;t the
<i>rule itself</i> have been picked to favor someone? — gets the next answer.</p>`],
  ['Couldn’t YOU have picked a rule that favors one side?',
    `<p>That&rsquo;s the strongest objection, so here&rsquo;s the straight answer. Every design choice (one-square-mile squares,
split-in-halves, the tie-breaking order) is published with its reasoning, was made on neutral grounds — the algorithm has no party
data to look at — and the development history, including every mistake, ships in the public defect log. The 1950&ndash;2020
demonstration also shows the same rule producing sane maps across eight different political eras; it wasn&rsquo;t tuned to 2020&rsquo;s
politics. And because the proposal is a disclosure standard, not a mandate, anyone who suspects the rule can publish a rival fixed
rule and let the two baselines be compared in the open. The point was never that this rule is sacred — it&rsquo;s that the reference
point should be <i>some</i> fixed, published rule instead of a person with a stake in the outcome.</p>`],
  ['Does this help Democrats or Republicans?',
    `<p>The algorithm can&rsquo;t know — it never sees party data. Geography does correlate with partisanship (cities lean one way,
rural areas the other), so a blind map still has partisan <i>consequences</i>, and they differ by state. The honest answer is that a
published baseline makes that question <b>measurable instead of arguable</b>: compare any enacted map to the baseline and the
difference is the part politicians chose. Both parties gerrymander; this measures both equally.</p>`],
  ['What about Alaska, Hawaii, islands, and water?',
    `<p>Six states have a single at-large seat, so there&rsquo;s nothing to draw. For island geography (Hawaii, Michigan&rsquo;s
peninsulas, the Florida Keys), the engine adds &ldquo;virtual bridges&rdquo; along real-world ferry and causeway connections so every
district stays reachable. Hawaii&rsquo;s two districts came out within 0.02% of an equal share.</p>`],
  ['Why isn’t Washington, D.C. (or Puerto Rico) on the map?',
    `<p>Because they have no voting House seats to draw — the 435 districts belong entirely to the 50 states. That&rsquo;s also why our
total is ${fmt(popTotal)} rather than the famous full-U.S. census figure of 331,449,281: the difference is D.C.&rsquo;s 689,545
residents, who have no House district under current law. (Puerto Rico&rsquo;s 3.3 million residents are likewise outside the 435.)
Whether they <i>should</i> have voting seats is a real debate — but it&rsquo;s a different law than the one this project proposes.</p>`],
  ['Is this just the old &ldquo;shortest splitline&rdquo; idea?',
    `<p>The cutting rule builds on the splitline concept mathematicians proposed in the 2000s — we say so plainly. What&rsquo;s new is
everything that makes it usable: an exact-to-the-person accounting gate, island repair, a published verification suite, a
50-state run with cryptographic reproducibility, the 1950&ndash;2020 historical demonstration, and a draft disclosure law that fits
current Supreme Court doctrine. An idea became an auditable system.</p>`],
  ['Has this actually been run, or is it a concept?',
    `<p>It&rsquo;s run. All 50 states, ${fmt(totalDistricts)} districts, zero failed runs, with the national total matching the official
50-state census total exactly: ${fmt(popTotal)} people. Then it was re-run for every state in every census year back to 1950 —
${fmt(histRuns)} runs in all. Every map on this site is real engine output, and the repository reproduces all of it.</p>`],
  ['The maps use 2020 data. What about today’s population?',
    `<p>By law, districts are drawn from the once-a-decade census count — that&rsquo;s the data with block-by-block precision, and it&rsquo;s
what every state&rsquo;s real map uses too. Between censuses, the Census Bureau publishes yearly state estimates, and this site shows the
latest (July 1, 2025) on every state page — including a preview of which states would gain or lose seats if the House were re-divided
on today&rsquo;s numbers. When the 2030 census block data publishes, the whole site re-draws automatically.</p>`],
  ['Who controls the code?',
    `<p>Nobody, which is the point. It&rsquo;s open source under the MIT license. The draft bill assigns a custodian (such as the
Census Bureau) to <i>run</i> the published specification each cycle — but anyone on earth can run it too, which is what keeps the
custodian honest.</p>`],
  ['How would this actually become law?',
    `<p>The draft bill (Appendix A of the report) is deliberately small: after each census, publish the baseline map for every
state; require each enacted plan to be published alongside its baseline with a standard metrics comparison; require material
deviations to be justified in writing. No district is forced on anyone. The report argues this fits squarely within Congress&rsquo;s
constitutional power to regulate House elections (the Elections Clause).</p>`],
  ['Can I check any of this myself?',
    `<p>Yes — that&rsquo;s the entire design. The code, data pipeline, verification suite, defect log, and this website ship together as
<a href="https://github.com/daviddunec/grid-districts">one open repository</a>. Re-run any state and compare hashes (digital
fingerprints of the output); re-derive any number in the report; the build fails loudly if a single person goes missing. Start with
<a href="about.html#run">Run it yourself</a>.</p>`],
];
const faqBody = `
<main id="main">
<section class="section tight"><div class="sec-in narrow">
<p class="kicker">No softballs</p>
<h1 style="font-size:clamp(30px,4.5vw,46px)">Hard questions, straight answers</h1>
<p class="lead">The strongest objections we know of — including the ones that have real teeth — answered the same way the
report answers them for policymakers, minus the footnotes.</p>
${faqs.map(([q, a]) => `<details class="faq"><summary>${q}</summary><div class="a">${a}</div></details>`).join('\n')}
<p style="margin-top:22px">Want the versions with citations? <a href="report.html">The full report</a> addresses each of these
with case law and data.</p>
</div></section>
</main>`;
fs.writeFileSync('site/faq.html', shell({
  title: 'FAQ — hard questions, straight answers | Grid Districts',
  desc: 'The Voting Rights Act, communities of interest, partisan effects, dense cities, gaming the algorithm — the strongest objections, answered plainly.',
  rel: '', active: 'faq', body: faqBody,
}));

// ---------- About ----------
const aboutBody = `
<main id="main">
<section class="section tight"><div class="sec-in narrow">
<p class="kicker">About the project</p>
<h1 style="font-size:clamp(30px,4.5vw,46px)">Built in the open, verified to the last person</h1>
<p class="lead">Grid Districts is an open-source project with one goal: give the country a congressional-district baseline that
requires zero trust in any person or party — and make it easy enough that anyone can check it.</p>

<h2>Who made this</h2>
<p>Grid Districts was created by <b>Mark Dunec, CRE, MAI, FRICS</b> and <b>David Dunec</b>. It is not affiliated with any party,
campaign, or government body, and it favors no one: the algorithm never sees race, party, or any person&rsquo;s identity.</p>

<h2>The data</h2>
<ul>
<li><b>2020 Census PL 94-171 block counts</b>, placed with TIGER/Line block coordinates: the official population of every census
block in America — the algorithm&rsquo;s only modern input.</li>
<li><b>Census cartographic state boundaries</b> for grids and the maps on this site.</li>
<li><b>Official decennial county populations, 1950&ndash;2010</b>, for the historical demonstration. Complete digital block-level
data only exists from 1990 onward, so for consistency the historical demonstration uses official county totals for <i>every</i>
decade, scaling today&rsquo;s street-level settlement pattern to match — a labeled estimate that demonstrates the <i>process</i>, not a
literal reconstruction.</li>
<li><b>Census Bureau Vintage 2025 population estimates</b> (July 1, 2025) for the &ldquo;since the census&rdquo; figures and the 2030
seat preview. The preview uses the official Huntington&ndash;Hill apportionment method, and our implementation had to reproduce the
real 2020 apportionment of all 435 seats exactly before it was allowed to touch the estimates.</li>
</ul>
<p class="small">Coverage, defined: the share of that decade&rsquo;s official county population records we located and matched. Across
the ${coverages.length} multi-district historical runs, the median is ${(covMedian * 100).toFixed(1)}% and the lowest is
${(covMin * 100).toFixed(2)}% (Florida&rsquo;s earliest decades); the gap is scaled, not guessed, and every map shows its own number.</p>

<h2 id="verify">How it&rsquo;s verified</h2>
<p>Every state must pass five gates, in order:</p>
<ul>
<li><b>Exact head-count match</b> at grid build — the grid&rsquo;s total must equal the state&rsquo;s official resident population to the
person. A single missing person fails the build.</li>
<li><b>Coverage</b> — every in-state square lands in exactly one district.</li>
<li><b>Contiguity</b> — every district is one connected piece.</li>
<li><b>Deviation gate</b> — the worst district within 2% of an equal share, with dense-state exceptions flagged rather than hidden.</li>
<li><b>Determinism</b> — re-runs, including deliberately shuffled input, must reproduce the map byte-for-byte under cryptographic
hash (a short digital fingerprint that changes if even one byte changes).</li>
</ul>
<p>Nationally, the assigned total across all ${fmt(totalDistricts)} districts equals the official 50-state resident population —
${fmt(popTotal)} — exactly.</p>
<p>Beyond the gates, the project ran adversarial review on itself: independent verification code written against a published data
contract, blind multi-reviewer evaluation of candidate methods, a hostile review of the report that initially ruled it
<i>not publishable</i> (the problems it found were fixed, and the episode is recorded in the public failure log as FL-012), and a
public defect log — <b>${flCount} issues so far</b>, each with root cause and fix. This website itself went through the same
treatment: a four-reviewer adversarial pass on its facts, clarity, accessibility, and code. No external expert has reviewed the
work yet; obtaining that review (from GAO or the Census Bureau) is the report&rsquo;s explicit ask.</p>

<h2 id="run">Run it yourself</h2>
<p>The repository — <a href="${REPO_URL}">github.com/daviddunec/grid-districts</a> — contains the full engine, data pipeline,
verification suite, this website&rsquo;s generator, and the report. With Node.js installed:</p>
<pre tabindex="0" role="region" aria-label="Run commands" style="background:#172554;color:#dbe3fb;padding:14px 18px;border-radius:10px;overflow:auto;font:13.5px/1.6 var(--mono)">git clone ${REPO_URL}.git &amp;&amp; cd grid-districts &amp;&amp; npm install
node cli.js all --state CO     # grid &rarr; districts &rarr; verify &rarr; render, one state
node scripts/run-all-states.js # the full 50-state production run
node scripts/site-export-data.js &amp;&amp; node scripts/site-build.js   # rebuild this website</pre>
<p>The code also checks once a year for newly published census data, so each new decade&rsquo;s baseline can be rebuilt and re-verified
automatically.</p>

<h2>The fine print</h2>
<p>MIT license. The historical maps are labeled estimates. The 2020 maps are a published benchmark — enacted maps must additionally
satisfy near-zero deviation and the Voting Rights Act, which is why the proposal is a disclosure standard, not a replacement
mapmaker. Read the <a href="report.html">full report</a> or the <a href="slides.html">briefing deck</a>.</p>
</div></section>
</main>`;
fs.writeFileSync('site/about.html', shell({
  title: 'About — data, verification, and how to run it yourself | Grid Districts',
  desc: 'The data sources, the verification gates (exact-to-the-person accounting, determinism hashes), the public defect log, and how to reproduce every map.',
  rel: '', active: 'about', body: aboutBody,
}));

console.log(`site v2 built: index, how-it-works, faq, about, ${built} state pages`);
console.log(`facts: ${totalDistricts} districts, pop ${fmt(popTotal)}, clean ${cleanStates}/50, NY ${nyDev}%, hist ${histRuns} runs, cov median ${(covMedian * 100).toFixed(1)}% min ${(covMin * 100).toFixed(1)}%, FL entries ${flCount}`);
if (missingHist.length) console.log(`missing historical runs (page shows notice): ${missingHist.join(', ')}`);
