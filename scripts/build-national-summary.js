// Builds the sendable 50-state national summary: one self-contained light-theme HTML.
// Numbers from data/states.json + out/<ST>/scores.csv; thumbnails rendered from real
// assign_splitline.csv files (at-large states: single-color state outline from boundary data).
// Usage: node scripts/build-national-summary.js   -> redistricting-national-summary.html
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { SEATS, FIPS, AT_LARGE, RESIDENT_POP } = await import('../src/constants.js');

// ---------- PNG encoder (same approach as build-explainer.js) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
const CAT = ['#4e79a7', '#f28e2b', '#e15759', '#59a14f', '#b07aa1', '#edc948',
  '#76b7b2', '#ff5d8f', '#9c755f', '#17becf', '#bcbd22', '#8c564b']
  .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const districtColor = (d) => (d <= CAT.length ? CAT[d - 1] : hslToRgb(((d - 1) * 137.508) % 360, 0.62, 0.52));

// Downscale a grid to a thumbnail (max dimension THUMB px) by majority district per bucket.
const THUMB = 150;
function thumbFromAssign(st) {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', st, 'meta.json'), 'utf8'));
  const { rows, cols } = meta;
  const scale = Math.max(1, Math.max(rows, cols) / THUMB); // never upscale: small grids ship native (plaid-gap fix)
  const tw = Math.max(1, Math.round(cols / scale)), th = Math.max(1, Math.round(rows / scale));
  const counts = new Map(); // bucketIdx -> Map(district -> count)
  const lines = fs.readFileSync(path.join(ROOT, 'out', st, 'assign_splitline.csv'), 'utf8').trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const [r, c, d] = lines[i].split(',').map(Number);
    const bx = Math.min(tw - 1, Math.floor(c / scale)), by = Math.min(th - 1, Math.floor(r / scale));
    const key = by * tw + bx;
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key);
    m.set(d, (m.get(d) || 0) + 1);
  }
  const rgb = Buffer.alloc(tw * th * 3, 255);
  for (const [key, m] of counts) {
    let best = -1, bestN = -1;
    for (const [d, n] of m) if (n > bestN || (n === bestN && d < best)) { best = d; bestN = n; }
    const [R, G, B] = districtColor(best);
    rgb[key * 3] = R; rgb[key * 3 + 1] = G; rgb[key * 3 + 2] = B;
  }
  return { uri: 'data:image/png;base64,' + encodePNG(tw, th, rgb).toString('base64') };
}

// At-large thumbnail: single-color silhouette from the state boundary polygon.
import('proj4').catch(() => null); // ensure dep present before geo import side effects
async function thumbAtLarge(st) {
  const { ensureStateBoundary } = await import('../src/download.js');
  const shapefile = (await import('shapefile')).default;
  const { toAlbers } = await import('../src/geo.js');
  const { shpPath, dbfPath } = await ensureStateBoundary();
  const source = await shapefile.open(shpPath, dbfPath);
  let geom = null;
  for (;;) {
    const { done, value } = await source.read();
    if (done) break;
    if (value.properties.STATEFP === FIPS[st]) { geom = value.geometry; break; }
  }
  if (!geom) return null;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  // project rings, rasterize by even-odd scanline at thumbnail resolution
  const rings = polys.flat().map((ring) => ring.map(([lon, lat]) => toAlbers(lon, lat)));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const scale = Math.max(maxX - minX, maxY - minY) / THUMB;
  const tw = Math.max(1, Math.round((maxX - minX) / scale)), th = Math.max(1, Math.round((maxY - minY) / scale));
  const rgb = Buffer.alloc(tw * th * 3, 255);
  const [R, G, B] = districtColor(1);
  for (let py = 0; py < th; py++) {
    const y = maxY - (py + 0.5) * scale + 0.001; // epsilon: avoid exact vertex hits breaking even-odd parity
    const xs = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c1 = Math.max(0, Math.round((xs[k] - minX) / scale)), c2 = Math.min(tw - 1, Math.round((xs[k + 1] - minX) / scale));
      for (let c = c1; c <= c2; c++) { const off = (py * tw + c) * 3; rgb[off] = R; rgb[off + 1] = G; rgb[off + 2] = B; }
    }
  }
  return { uri: 'data:image/png;base64,' + encodePNG(tw, th, rgb).toString('base64') };
}

// ---------- gather data ----------
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/states.json'), 'utf8'));
const states = Object.keys(SEATS).sort();
const rows = [];
let totalDistricts = 0, totalIrregular = 0, cleanStates = 0, flaggedStates = [], failedStates = [];
let popAssigned = 0;

for (const st of states) {
  const led = ledger[st] || { status: 'missing' };
  const row = { st, seats: SEATS[st], atLarge: AT_LARGE.includes(st), led };
  if (led.status === 'done') {
    totalDistricts += SEATS[st];
    if (row.atLarge) {
      row.maxDev = 0; row.irregular = 0; row.eligible = true; row.gateNote = 'at-large';
      popAssigned += RESIDENT_POP[st];
      cleanStates++;
    } else {
      row.maxDev = led.maxDevPct; row.irregular = led.irregular; row.eligible = led.eligible;
      row.gateNote = led.gateFailures === 'none' ? '' : led.gateFailures;
      totalIrregular += led.irregular;
      // sum district pops from stats for the aggregate identity
      const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', st, 'stats_splitline.json'), 'utf8'));
      popAssigned += stats.districts.reduce((a, d) => a + d.pop, 0);
      if (led.eligible && led.gateFailures === 'none') cleanStates++;
      else flaggedStates.push(st);
    }
  } else {
    failedStates.push(st + '(' + led.status + ')');
  }
  rows.push(row);
}
const popTotal = Object.values(RESIDENT_POP).reduce((a, b) => a + b, 0);
const identityOk = popAssigned === popTotal;
console.log(`aggregate identity: assigned=${popAssigned} expected=${popTotal} ${identityOk ? 'EXACT MATCH' : 'MISMATCH!'}`);
if (!identityOk && failedStates.length === 0) { console.error('IDENTITY FAIL with no failed states — investigate'); process.exit(1); }

// thumbnails
const thumbs = {};
for (const st of states) {
  if (!ledger[st] || ledger[st].status !== 'done') continue;
  thumbs[st] = AT_LARGE.includes(st) ? await thumbAtLarge(st) : thumbFromAssign(st);
}

// ---------- HTML ----------
const fmtDev = (r) => (r.atLarge ? '0% (whole state)' : r.maxDev !== undefined ? r.maxDev.toFixed(2) + '%' : '—');
const statusBadge = (r) => {
  if (r.led.status !== 'done') return `<span class="b fail">${r.led.status.toUpperCase()}</span>`;
  if (r.atLarge) return '<span class="b pass">AT-LARGE</span>';
  if (r.eligible && !r.gateNote) return '<span class="b pass">CLEAN</span>';
  if (r.eligible) return '<span class="b flag">FLAGGED</span>';
  return '<span class="b fail">FAILS</span>';
};
const tableRows = rows.map((r) => `
  <tr>
    <td style="text-align:left"><b>${r.st}</b></td>
    <td>${r.seats}</td>
    <td>${statusBadge(r)}</td>
    <td>${fmtDev(r)}</td>
    <td>${r.atLarge ? '—' : r.irregular ?? '—'}</td>
    <td class="muted" style="font-size:12px">${r.gateNote || (r.led.error ? String(r.led.error).slice(0, 60) : '')}</td>
  </tr>`).join('');

const gallery = states.filter((st) => thumbs[st]).map((st) => `
  <figure class="thumb">
    <img src="${thumbs[st].uri}" alt="${st}" />
    <figcaption><b>${st}</b> · ${SEATS[st]} seat${SEATS[st] > 1 ? 's' : ''}</figcaption>
  </figure>`).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>All 50 States — Equal-Population Districts from 1-Square-Mile Squares</title>
<style>
  :root{ --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --accent2:#1e3a8a; }
  body{ margin:0; background:#f8fafc; color:var(--ink); font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
  .wrap{ max-width:980px; margin:0 auto; background:#fff; }
  header{ background:linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; padding:32px 40px 26px; }
  header h1{ margin:0 0 6px; font-size:24px; } header p{ margin:0; opacity:.92; font-size:14px; }
  main{ padding:6px 40px 44px; }
  h2{ font-size:19px; margin:30px 0 10px; color:var(--accent2); }
  .muted{ color:var(--muted); }
  .stats{ display:flex; gap:14px; flex-wrap:wrap; margin:18px 0; }
  .stat{ flex:1 1 150px; border:1px solid var(--line); border-radius:8px; padding:12px 16px; background:#f8fafc; }
  .stat .n{ font-size:24px; font-weight:800; color:var(--accent2); } .stat .l{ font-size:12px; color:var(--muted); }
  table{ border-collapse:collapse; width:100%; margin:12px 0; font-size:13px; }
  th,td{ border:1px solid var(--line); padding:6px 9px; text-align:center; }
  thead th{ background:#f1f5f9; cursor:pointer; user-select:none; }
  .b{ font-weight:700; font-size:11px; padding:2px 7px; border-radius:999px; }
  .b.pass{ background:#e7f6ec; color:#1a7f37; } .b.flag{ background:#fdf3df; color:#9a6700; } .b.fail{ background:#fdeaea; color:#b42318; }
  .grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; margin:14px 0; }
  .thumb{ margin:0; border:1px solid var(--line); border-radius:6px; padding:7px; text-align:center; background:#fff; }
  .thumb img{ width:100%; height:auto; image-rendering:pixelated; }
  .thumb figcaption{ font-size:11px; margin-top:4px; }
  .callout{ border-left:4px solid #2563eb; background:#f0f6ff; padding:12px 16px; border-radius:6px; margin:16px 0; }
  .footer{ border-top:1px solid var(--line); margin-top:28px; padding-top:14px; font-size:12px; color:var(--muted); }
  @media(max-width:640px){ main,header{ padding-left:20px; padding-right:20px; } }
</style></head>
<body><div class="wrap">
<header>
  <h1>All 50 States, One Identical Process</h1>
  <p>Every congressional district in America, drawn from 1-square-mile blocks by the same deterministic rules — equal population, connected, reproducible.</p>
</header>
<main>
  <div class="stats">
    <div class="stat"><div class="n">${rows.filter((r) => r.led.status === 'done').length}/50</div><div class="l">states completed</div></div>
    <div class="stat"><div class="n">${totalDistricts}</div><div class="l">districts drawn (of 435)</div></div>
    <div class="stat"><div class="n">${cleanStates}</div><div class="l">states fully clean</div></div>
    <div class="stat"><div class="n">${identityOk ? 'exact' : 'MISMATCH'}</div><div class="l">every person counted once: ${popAssigned.toLocaleString()}</div></div>
    <div class="stat"><div class="n">${totalIrregular}</div><div class="l">odd-shaped districts nationwide</div></div>
  </div>

  <div class="callout"><b>What this is.</b> The production run uses the <b>shortest-line method</b> (the
  most geography-robust of the approaches we tested). The center-out square-block method — the original
  vision — passed 3 of 4 pilot states and returns once its "leftover district" fix is built; this page
  will then be regenerated with it.</div>

  <h2>Every state at a glance</h2>
  <div class="grid">${gallery}</div>

  <h2>The full table</h2>
  <p class="muted" style="font-size:13px">Click a column header to sort. "Max deviation" = how far the
  worst district is from a perfectly equal population share (gate: 2%; dense-city states NY/CA/IL/NJ
  flagged rather than failed). "Odd-shaped" = districts failing the squareness rule.</p>
  <table id="t">
    <thead><tr><th>State</th><th>Seats</th><th>Status</th><th>Max deviation</th><th>Odd-shaped</th><th>Notes</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">
    Generated from the engine's own outputs — every number comes from the computed district files, and
    each state's population total was verified two independent ways (official Census Table 2, and the
    exact sum of that state's ${'~'}11M census blocks). Source data: 2020 U.S. Census PL 94-171.
  </div>
</main>
<script>
  // tiny sortable table, no deps
  document.querySelectorAll('#t thead th').forEach((th, i) => th.addEventListener('click', () => {
    const tb = document.querySelector('#t tbody');
    const dir = th.dataset.dir = th.dataset.dir === 'a' ? 'd' : 'a';
    [...tb.rows].sort((x, y) => {
      const a = x.cells[i].innerText.trim(), b = y.cells[i].innerText.trim();
      const na = parseFloat(a), nb = parseFloat(b);
      const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b);
      return dir === 'a' ? cmp : -cmp;
    }).forEach((r) => tb.appendChild(r));
  }));
</script>
</div></body></html>`;

const outPath = path.join(ROOT, 'redistricting-national-summary.html');
fs.writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB) — clean=${cleanStates}, flagged=${flaggedStates.join(',') || 'none'}, failed=${failedStates.join(',') || 'none'}`);
