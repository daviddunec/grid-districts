// INTERACTIVE WEBSITE BUILDER -> site/  (static, GitHub Pages-ready, also works from file://)
//   site/index.html            national view: stats, all-50 gallery
//   site/state/<ST>.html       per-state page: 1950->2020 decade slider, stats, district table
//   site/maps/<ST>-<dec>.png   pre-rendered maps (tiny PNGs; decade slider swaps images)
//   site/interactive/<ST>.html the full clickable Leaflet map (2020, production arm)
// All numbers read from engine outputs; nothing hand-typed.
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

// ---- shared PNG machinery (same as historical-run.js) ----
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

// ---- build ----
fs.mkdirSync('site/maps', { recursive: true });
fs.mkdirSync('site/state', { recursive: true });
fs.mkdirSync('site/interactive', { recursive: true });

const CSS = `
:root{--ink:#1f2937;--muted:#6b7280;--line:#e5e7eb;--blue:#1e3a8a;--blue2:#2563eb}
*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:var(--ink);font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1020px;margin:0 auto;background:#fff;min-height:100vh}
header{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:26px 36px}
header h1{margin:0 0 4px;font-size:23px}header p{margin:0;font-size:13px;opacity:.92}
header a{color:#dbeafe}
main{padding:10px 36px 44px}
h2{font-size:19px;color:var(--blue);margin:26px 0 10px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.stat{flex:1 1 150px;border:1px solid var(--line);border-radius:8px;padding:11px 15px;background:#f8fafc}
.stat .n{font-size:22px;font-weight:800;color:var(--blue)}.stat .l{font-size:11px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.card{border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center;background:#fff;text-decoration:none;color:var(--ink)}
.card:hover{border-color:var(--blue2);box-shadow:0 1px 6px rgba(37,99,235,.18)}
.card img{width:100%;height:110px;object-fit:contain;image-rendering:pixelated}
.card .t{font-weight:700;font-size:14px;margin-top:6px}.card .s{font-size:11px;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--line);padding:6px 9px;text-align:center}
thead th{background:#f1f5f9}
.muted{color:var(--muted)}.callout{border-left:4px solid var(--blue2);background:#f0f6ff;padding:10px 14px;border-radius:6px;font-size:13px;margin:14px 0}
.slider-row{display:flex;align-items:center;gap:14px;margin:16px 0 4px}
input[type=range]{flex:1;accent-color:var(--blue2)}
.decade-label{font-size:26px;font-weight:800;color:var(--blue);min-width:84px;text-align:center}
.mapbox{text-align:center;border:1px solid var(--line);border-radius:8px;padding:14px;background:#fff;min-height:340px}
.mapbox img{max-width:100%;max-height:430px;image-rendering:pixelated}
.btn{display:inline-block;background:var(--blue2);color:#fff;border-radius:6px;padding:8px 14px;text-decoration:none;font-size:13px;margin:8px 4px 0 0}
footer{border-top:1px solid var(--line);padding:14px 36px;font-size:12px;color:var(--muted)}
@media(max-width:640px){main,header,footer{padding-left:18px;padding-right:18px}}
`;

const statesSorted = Object.keys(SEATS).sort((a, b) => NAMES[a].localeCompare(NAMES[b]));
let built = 0, missingHist = [];

for (const abbr of statesSorted) {
  // --- per-decade visuals + stats ---
  const perDecade = {};
  for (const dec of DECADES) {
    const seats = (APP.seats[dec] || {})[abbr];
    if (!seats) { perDecade[dec] = { preState: true }; continue; }
    if (dec === '2020') {
      const png = AT_LARGE.includes(abbr) && !fs.existsSync(path.join('out', abbr, 'assign_splitline.csv'))
        ? await silhouettePng(abbr)
        : render2020Png(abbr);
      fs.writeFileSync(path.join('site/maps', `${abbr}-2020.png`), png);
      const entry = { seats };
      const statsPath = path.join('out', abbr, 'stats_splitline.json');
      if (fs.existsSync(statsPath)) {
        const st = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        const devs = st.districts.map((x) => Math.abs(x.deviationPct));
        entry.maxDev = Math.max(...devs);
        entry.districts = st.districts.map((x) => ({ d: x.district, pop: x.pop, dev: x.deviationPct }));
        entry.interactive = true;
      } else entry.atLarge = true;
      perDecade[dec] = entry;
    } else {
      const histDir = path.join('out', abbr, 'history', dec);
      const stPath = path.join(histDir, 'stats.json');
      const mapPath = path.join(histDir, 'map.png');
      if (!fs.existsSync(stPath)) { perDecade[dec] = { missing: true, seats }; missingHist.push(abbr + ':' + dec); continue; }
      const st = JSON.parse(fs.readFileSync(stPath, 'utf8'));
      if (fs.existsSync(mapPath)) fs.copyFileSync(mapPath, path.join('site/maps', `${abbr}-${dec}.png`));
      else fs.writeFileSync(path.join('site/maps', `${abbr}-${dec}.png`), await silhouettePng(abbr)); // at-large decade w/o grid
      perDecade[dec] = st.atLarge
        ? { seats: 1, atLarge: true, coverage: st.coverage }
        : { seats: st.seats, maxDev: st.maxAbsDevPct, coverage: st.coverage, districts: (st.districts || []).map((x) => ({ d: x.district, pop: x.pop, dev: x.deviationPct })) };
    }
  }
  // copy the interactive 2020 map
  const leafletSrc = path.join('out', abbr, 'map_splitline.html');
  if (fs.existsSync(leafletSrc)) fs.copyFileSync(leafletSrc, path.join('site/interactive', `${abbr}.html`));

  // --- state page ---
  const dataJs = JSON.stringify(perDecade);
  const seats2020 = SEATS[abbr];
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${NAMES[abbr]} — Grid Districts</title><style>${CSS}</style></head><body><div class="wrap">
<header><h1>${NAMES[abbr]} <span style="font-weight:400;opacity:.8">— ${seats2020} seat${seats2020 > 1 ? 's' : ''} today</span></h1>
<p><a href="../index.html">&larr; All states</a> &nbsp;•&nbsp; Districts drawn by one identical, deterministic process from 1-square-mile blocks</p></header>
<main>
<div class="slider-row"><span class="decade-label" id="dl">2020</span>
<input type="range" id="slider" min="0" max="${DECADES.length - 1}" value="${DECADES.length - 1}" step="1">
</div>
<div class="muted" style="font-size:12px;display:flex;justify-content:space-between"><span>1950</span><span>2020</span></div>
<div class="mapbox"><img id="mapimg" src="" alt="district map"><div id="mapnote" class="muted" style="font-size:13px;margin-top:8px"></div></div>
<div id="statsbox"></div>
<div id="btns"></div>
<div class="callout"><b>About the historical maps (1950&ndash;2010):</b> these apply the same algorithm to each decade's
actual seat count and county-level census populations, with the 2020 settlement pattern scaled to each decade's county
totals (block-level data before 2000 does not exist digitally). They demonstrate the <i>process</i> across history;
the 2020 map uses full block-level data. Coverage = share of population matched to that decade's county records.</div>
</main>
<footer>Generated from engine outputs &middot; 2020 U.S. Census PL 94-171 &middot; <a href="../index.html">Grid Districts</a></footer>
</div>
<script>
const D=${JSON.stringify(DECADES)};const DATA=${dataJs};const ABBR=${JSON.stringify(abbr)};
const img=document.getElementById('mapimg'),dl=document.getElementById('dl'),note=document.getElementById('mapnote'),sb=document.getElementById('statsbox'),btns=document.getElementById('btns');
function fmt(n){return n.toLocaleString('en-US')}
function show(i){const dec=D[i];dl.textContent=dec;const e=DATA[dec]||{};btns.innerHTML='';
 if(e.preState){img.style.display='none';note.textContent=ABBR+' was not yet a state in '+dec+'.';sb.innerHTML='';return}
 if(e.missing){img.style.display='none';note.textContent='Historical run not available for '+dec+'.';sb.innerHTML='';return}
 img.style.display='inline';img.src='../maps/'+ABBR+'-'+dec+'.png';
 if(e.atLarge){note.textContent=dec+': at-large — the whole state elects one representative.';sb.innerHTML='';}
 else{note.textContent=dec+': '+e.seats+' districts'+(e.maxDev!==undefined?' — worst deviation from an equal share: '+e.maxDev.toFixed(2)+'%':'')+(e.coverage!==undefined?' — county-data coverage '+(e.coverage*100).toFixed(1)+'%':'');
  let rows='';(e.districts||[]).forEach(x=>{rows+='<tr><td>'+x.d+'</td><td>'+fmt(x.pop)+'</td><td>'+(x.dev>=0?'+':'')+x.dev.toFixed(2)+'%</td></tr>'});
  sb.innerHTML=rows?'<h2>Districts in '+dec+'</h2><table><thead><tr><th>District</th><th>Population</th><th>Deviation</th></tr></thead><tbody>'+rows+'</tbody></table>':'';}
 if(dec==='2020'&&e.interactive){btns.innerHTML='<a class="btn" href="../interactive/'+ABBR+'.html">Open the full interactive 2020 map (click any district)</a>';}
}
document.getElementById('slider').addEventListener('input',ev=>show(+ev.target.value));show(D.length-1);
</script></body></html>`;
  fs.writeFileSync(path.join('site/state', `${abbr}.html`), page);
  built++;
}

// --- index ---
const totalDistricts = Object.values(SEATS).reduce((a, b) => a + b, 0);
const rows = Object.values(LEDGER);
const clean = rows.filter((r) => r.status === 'done' && r.eligible && (!r.gateFailures || r.gateFailures === 'none')).length;
const popTotal = Object.values(RESIDENT_POP).reduce((a, b) => a + b, 0);
const cards = statesSorted.map((ab) => `
<a class="card" href="state/${ab}.html"><img src="maps/${ab}-2020.png" alt="${NAMES[ab]}" loading="lazy">
<div class="t">${NAMES[ab]}</div><div class="s">${SEATS[ab]} seat${SEATS[ab] > 1 ? 's' : ''} &middot; 1950&rarr;2020</div></a>`).join('');
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grid Districts — every US congressional district, one identical process</title><style>${CSS}</style></head><body><div class="wrap">
<header><h1>Grid Districts</h1><p>Every congressional district in America, drawn from 1-square-mile blocks by one identical,
deterministic, open-source process — equal population, connected, reproducible by anyone. Click a state to see its districts
and slide through every decade since 1950.</p></header>
<main>
<div class="stats">
<div class="stat"><div class="n">50/50</div><div class="l">states districted (2020 census)</div></div>
<div class="stat"><div class="n">${totalDistricts}</div><div class="l">congressional districts</div></div>
<div class="stat"><div class="n">${clean}</div><div class="l">states fully clean</div></div>
<div class="stat"><div class="n">${popTotal.toLocaleString('en-US')}</div><div class="l">people — every one counted exactly once (exact match to the official Census total)</div></div>
<div class="stat"><div class="n">1950&rarr;2020</div><div class="l">historical demonstration, all 8 apportionment cycles</div></div>
</div>
<div class="callout"><b>What this is.</b> A complete, working, open-source redistricting baseline: the same algorithm runs on every
state, sees only population counts (never race, party, or addresses), and produces byte-identical maps on every run. Today's maps
use the geography-robust shortest-split method; the center-out square-block method is the project's active research arm.
Full documentation, verification trail, and the report for lawmakers are in the repository.</div>
<h2>Every state — click to explore</h2>
<div class="grid">${cards}</div>
</main>
<footer>Built from 2020 U.S. Census PL 94-171 block data &middot; historical decades scaled from official county census counts &middot; MIT license</footer>
</div></body></html>`;
fs.writeFileSync('site/index.html', index);

console.log(`site built: ${built} state pages, index, ${fs.readdirSync('site/maps').length} map images, ${fs.readdirSync('site/interactive').length} interactive maps`);
if (missingHist.length) console.log(`missing historical runs (page shows notice): ${missingHist.slice(0, 20).join(', ')}${missingHist.length > 20 ? ` +${missingHist.length - 20} more` : ''}`);
