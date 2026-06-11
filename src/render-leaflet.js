/**
 * render-leaflet.js — Leaflet HTML renderer for redistricting output
 * ESM, pure Node fs only, no npm deps, deterministic output, LF UTF-8 no BOM
 *
 * Exports: renderLeaflet({ outDir, arm })
 * CLI:     node src/render-leaflet.js <outDir> <arm>
 *          node src/render-leaflet.js --selftest
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// 12-color fixed palette (district 1 → palette[0], cycled)
const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
  '#9c755f', '#bab0ac', '#86bcb6', '#e49444',
];

function districtColor(d) {
  return PALETTE[(d - 1) % PALETTE.length];
}

function fmt(n, decimals = 2) {
  return Number(n).toFixed(decimals);
}

function buildHtml(meta, geojson, stats) {
  const arm = stats.arm;
  const state = meta.state;

  // Inline the GeoJSON as a JS const — must work from file://
  const geojsonStr = JSON.stringify(geojson);

  // Build district list for the info panel (sorted by district number)
  const sorted = [...stats.districts].sort((a, b) => a.district - b.district);

  const panelRows = sorted.map(d => {
    const color = districtColor(d.district);
    const sign = d.deviationPct >= 0 ? '+' : '';
    return `    <tr>
      <td><span class="swatch" style="background:${color}"></span>D${d.district}</td>
      <td>${d.pop.toLocaleString('en-US')}</td>
      <td>${sign}${fmt(d.deviationPct)}%</td>
      <td>${fmt(d.ppn)}</td>
    </tr>`;
  }).join('\n');

  // Build per-district style entries for the Leaflet layer function
  const styleMapEntries = sorted.map(d => {
    const color = districtColor(d.district);
    const dashed = d.irregular;
    return `  ${d.district}: { color: ${dashed ? "'#ff2222'" : "'#ffffff'"}, weight: 1, `
      + `dashArray: ${dashed ? "'6,4'" : 'null'}, fillColor: '${color}', fillOpacity: 0.55 }`;
  }).join(',\n');

  // Build popup content per district number
  const popupMapEntries = sorted.map(d => {
    const sign = d.deviationPct >= 0 ? '+' : '';
    const reg = d.irregular ? 'IRREGULAR' : 'REGULAR';
    return `  ${d.district}: "District ${d.district} — pop ${d.pop.toLocaleString('en-US')} `
      + `(dev ${sign}${fmt(d.deviationPct)}%) — PPN ${fmt(d.ppn)} — cells ${d.cells} — ${reg}"`;
  }).join(',\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${state} — ${arm}</title>`,
    // No SRI integrity attrs: a wrong hash silently blocks Leaflet and blanks the map (FL-007)
    '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>',
    '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>',
    '<style>',
    'html, body { margin: 0; padding: 0; height: 100%; background: #0b0f1a; color: #e2e8f0; font-family: system-ui, sans-serif; }',
    '#map { width: 100%; height: 100vh; background: #0b0f1a; }',
    '#info {',
    '  position: fixed; top: 12px; right: 12px; z-index: 1000;',
    '  background: rgba(11,15,26,0.92); color: #e2e8f0;',
    '  border: 1px solid #334155; border-radius: 6px;',
    '  padding: 10px 14px; font-size: 12px; max-height: 90vh; overflow-y: auto;',
    '  min-width: 220px;',
    '}',
    '#info h3 { margin: 0 0 8px; font-size: 13px; color: #94a3b8; letter-spacing: 0.03em; }',
    '#info table { border-collapse: collapse; width: 100%; }',
    '#info th { color: #94a3b8; font-weight: 600; text-align: left; padding: 2px 6px 4px; }',
    '#info td { color: #e2e8f0; padding: 2px 6px; }',
    '#info tr:hover td { background: rgba(255,255,255,0.05); }',
    '.swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }',
    '.leaflet-popup-content-wrapper { background: #111827; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; }',
    '.leaflet-popup-tip { background: #111827; }',
    '.leaflet-popup-content { color: #e2e8f0; font-size: 13px; }',
    '</style>',
    '</head>',
    '<body>',
    '<div id="map"></div>',
    '<div id="info">',
    `  <h3>${state} — ${arm}</h3>`,
    '  <table>',
    '    <tr><th>Dist</th><th>Pop</th><th>Dev</th><th>PPN</th></tr>',
    panelRows,
    '  </table>',
    '</div>',
    '<script>',
    '(function () {',
    'var GEOJSON_DATA = ' + geojsonStr + ';',
    '',
    'var styleMap = {',
    styleMapEntries,
    '};',
    '',
    'var popupMap = {',
    popupMapEntries,
    '};',
    '',
    "var map = L.map('map', { zoomControl: true });",
    '',
    "L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {",
    "  attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"https://carto.com/attributions\">CARTO</a>',",
    '  maxZoom: 19',
    '}).addTo(map);',
    '',
    'var geoLayer = L.geoJSON(GEOJSON_DATA, {',
    '  style: function (feature) {',
    '    var d = feature.properties.district;',
    '    return styleMap[d] || { color: "#ffffff", weight: 1, fillColor: "#888888", fillOpacity: 0.55 };',
    '  },',
    '  onEachFeature: function (feature, layer) {',
    '    var d = feature.properties.district;',
    '    var msg = popupMap[d] || ("District " + d);',
    '    layer.bindPopup(msg);',
    '  }',
    '}).addTo(map);',
    '',
    'map.fitBounds(geoLayer.getBounds());',
    '}());',
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * renderLeaflet({ outDir, arm })
 * Reads meta.json, districts_<arm>.geojson, stats_<arm>.json from outDir.
 * Writes map_<arm>.html to outDir.
 * Returns the path of the written file.
 */
export async function renderLeaflet({ outDir, arm }) {
  const metaPath    = path.join(outDir, 'meta.json');
  const geojsonPath = path.join(outDir, `districts_${arm}.geojson`);
  const statsPath   = path.join(outDir, `stats_${arm}.json`);
  const outPath     = path.join(outDir, `map_${arm}.html`);

  const meta    = JSON.parse(fs.readFileSync(metaPath,    'utf8'));
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  const stats   = JSON.parse(fs.readFileSync(statsPath,   'utf8'));

  const html = buildHtml(meta, geojson, stats);
  // LF, UTF-8, no BOM
  fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), { encoding: 'utf8' });
  return outPath;
}

// ── Self-test ─────────────────────────────────────────────────────────────────

function runSelftest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-selftest-'));
  try {
    // Synthetic meta
    const meta = {
      state: 'TS', fips: '00', seats: 2, residentPop: 2000, idealTarget: 1000,
      originX: 0, originYTop: 0, rows: 1, cols: 2, cellSizeM: 1609.344,
      inStateCells: 2, populatedCells: 2, blocks: 2, populatedBlocks: 2,
    };

    // Two square districts side by side in lon/lat space
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { district: 1, pop: 1020, deviationPct: 2.0, cells: 1, ppn: 0.72, irregular: false },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-105, 39], [-104, 39], [-104, 40], [-105, 40], [-105, 39]]],
          },
        },
        {
          type: 'Feature',
          properties: { district: 2, pop: 980, deviationPct: -2.0, cells: 1, ppn: 0.38, irregular: true },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-104, 39], [-103, 39], [-103, 40], [-104, 40], [-104, 39]]],
          },
        },
      ],
    };

    // Synthetic stats
    const stats = {
      arm: 'splitline',
      districts: [
        { district: 1, pop: 1020, cells: 1, deviationPct: 2.0, ppn: 0.72, bboxAspect: 1.0, bboxFill: 1.0, irregular: false },
        { district: 2, pop: 980,  cells: 1, deviationPct: -2.0, ppn: 0.38, bboxAspect: 1.0, bboxFill: 1.0, irregular: true  },
      ],
      repair: { orphanComponentsMoved: 0, orphanCellsMoved: 0, rebalanceMoves: 0 },
      sha256: 'aabbcc',
    };

    fs.writeFileSync(path.join(tmpDir, 'meta.json'),                   JSON.stringify(meta),    'utf8');
    fs.writeFileSync(path.join(tmpDir, 'districts_splitline.geojson'), JSON.stringify(geojson), 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'stats_splitline.json'),        JSON.stringify(stats),   'utf8');

    const html = buildHtml(meta, geojson, stats);

    // Assertions
    const checks = [
      ['inlined GeoJSON const',    html.includes('var GEOJSON_DATA = ')],
      ['Leaflet CSS CDN',          html.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.css')],
      ['Leaflet JS CDN',           html.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.js')],
      ['CARTO dark basemap',       html.includes('basemaps.cartocdn.com/dark_all/')],
      ['dark background color',    html.includes('#0b0f1a')],
      ['info panel header',        html.includes('TS — splitline')],
      ['district 1 panel entry',   html.includes('>D1<')],
      ['district 2 panel entry',   html.includes('>D2<')],
      ['irregular dashed border',  html.includes("'6,4'")],
      ['regular null dashArray',   html.includes('dashArray: null')],
      ['LF line endings',          !html.includes('\r\n')],
    ];

    let passed = true;
    for (const [label, ok] of checks) {
      if (!ok) {
        process.stderr.write(`  FAIL: ${label}\n`);
        passed = false;
      }
    }

    // Write to disk and verify file exists
    const outPath = path.join(tmpDir, 'map_splitline.html');
    fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), 'utf8');
    if (!fs.existsSync(outPath)) {
      process.stderr.write('  FAIL: output file not written\n');
      passed = false;
    }

    if (passed) {
      process.stdout.write('SELFTEST PASS\n');
      process.exit(0);
    } else {
      process.stdout.write('SELFTEST FAIL\n');
      process.exit(1);
    }
  } finally {
    // cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') {
    runSelftest();
  } else if (args.length === 2) {
    const [outDir, arm] = args;
    renderLeaflet({ outDir, arm })
      .then(p => { process.stdout.write(`Written: ${p}\n`); })
      .catch(err => { process.stderr.write(`Error: ${err.message}\n`); process.exit(1); });
  } else {
    process.stderr.write('Usage: node src/render-leaflet.js <outDir> <arm>\n');
    process.stderr.write('       node src/render-leaflet.js --selftest\n');
    process.exit(1);
  }
}
