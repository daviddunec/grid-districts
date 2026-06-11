// render-svg.js — SVG map renderer for redistricting engine
// Exports: renderSvg({ outDir, arm })
// CLI:     node src/render-svg.js <outDir> <arm>
//          node src/render-svg.js --selftest
// Contract: reads meta.json, grid.json, assign_<arm>.csv, stats_<arm>.json
//           writes map_<arm>.svg
// LF line endings, UTF-8 no BOM, deterministic (no Date/random).

import fs from 'fs';
import path from 'path';
import os from 'os';

// Fixed 12-color palette — distinct, high-contrast, readable on dark background
const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
  '#9c755f', '#bab0ac', '#d37295', '#a0cbe8',
];

const SVG_WIDTH = 1200;
const LEGEND_WIDTH = 220;
const DRAW_WIDTH = SVG_WIDTH - LEGEND_WIDTH; // 980px for map area
const BG = '#0b0f1a';
const TEXT_FILL = '#e2e8f0';

/** Format population as e.g. "721.7k" */
function fmtPop(pop) {
  return (pop / 1000).toFixed(1) + 'k';
}

/** Parse assign_<arm>.csv into Map<"row,col" -> district> and parallel pop map */
function parseCsv(csvText) {
  const cellDistrict = new Map();
  const cellPop = new Map();
  const lines = csvText.split('\n');
  // skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [row, col, district, pop] = line.split(',');
    const key = `${row},${col}`;
    cellDistrict.set(key, parseInt(district, 10));
    cellPop.set(key, parseInt(pop, 10));
  }
  return { cellDistrict, cellPop };
}

/** Build per-district data: cell list, total pop (from stats), bounding box */
function buildDistrictData(cellDistrict, stats) {
  const byDistrict = new Map();
  for (const d of stats.districts) {
    byDistrict.set(d.district, {
      ...d,
      cells: [],
      minRow: Infinity, maxRow: -Infinity,
      minCol: Infinity, maxCol: -Infinity,
    });
  }
  for (const [key, district] of cellDistrict) {
    const [r, c] = key.split(',').map(Number);
    const entry = byDistrict.get(district);
    if (!entry) continue;
    entry.cells.push([r, c]);
    if (r < entry.minRow) entry.minRow = r;
    if (r > entry.maxRow) entry.maxRow = r;
    if (c < entry.minCol) entry.minCol = c;
    if (c > entry.maxCol) entry.maxCol = c;
  }
  return byDistrict;
}

/** Compute centroid (mean row, mean col) of district cells */
function centroid(cells) {
  let sumR = 0, sumC = 0;
  for (const [r, c] of cells) { sumR += r; sumC += c; }
  return [sumR / cells.length, sumC / cells.length];
}

export function renderSvg({ outDir, arm }) {
  const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8'));
  const grid = JSON.parse(fs.readFileSync(path.join(outDir, 'grid.json'), 'utf8'));
  const csvText = fs.readFileSync(path.join(outDir, `assign_${arm}.csv`), 'utf8');
  const stats = JSON.parse(fs.readFileSync(path.join(outDir, `stats_${arm}.json`), 'utf8'));

  const { rows, cols, inState } = grid;

  // Cell size in px: fit rows/cols into DRAW_WIDTH x proportional height
  const cellPx = DRAW_WIDTH / cols;
  const mapHeight = Math.round(cellPx * rows);
  const svgHeight = Math.max(mapHeight, 400); // at least 400px for legend

  const { cellDistrict } = parseCsv(csvText);
  const byDistrict = buildDistrictData(cellDistrict, stats);

  // Max |dev| for legend title
  const maxAbsDev = stats.districts.reduce(
    (m, d) => Math.max(m, Math.abs(d.deviationPct)), 0
  ).toFixed(2);

  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${svgHeight}">`);

  // Background
  lines.push(`<rect width="${SVG_WIDTH}" height="${svgHeight}" fill="${BG}"/>`);

  // --- Draw in-state cells ---
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!inState[i]) continue;
      const key = `${r},${c}`;
      const district = cellDistrict.get(key);
      if (district == null) continue; // unassigned: skip
      const color = PALETTE[(district - 1) % PALETTE.length];
      const x = (c * cellPx).toFixed(2);
      const y = (r * cellPx).toFixed(2);
      const w = cellPx.toFixed(2);
      lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="${color}"/>`);
    }
  }

  // --- Irregular district bounding boxes (dashed outline + asterisk handled in labels) ---
  for (const [, d] of byDistrict) {
    if (!d.irregular) continue;
    const x = (d.minCol * cellPx).toFixed(2);
    const y = (d.minRow * cellPx).toFixed(2);
    const w = ((d.maxCol - d.minCol + 1) * cellPx).toFixed(2);
    const h = ((d.maxRow - d.minRow + 1) * cellPx).toFixed(2);
    lines.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
      `fill="none" stroke="#111" stroke-width="2" stroke-dasharray="6,3"/>`
    );
  }

  // --- District labels at centroid ---
  for (const [, d] of byDistrict) {
    if (!d.cells.length) continue;
    const [cr, cc] = centroid(d.cells);
    const cx = ((cc + 0.5) * cellPx).toFixed(2);
    const cy = ((cr + 0.5) * cellPx).toFixed(2);
    const label = `D${d.district}${d.irregular ? '*' : ''} ${fmtPop(d.pop)}`;
    lines.push(
      `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="monospace" font-size="11" font-weight="bold" ` +
      `stroke="#000" stroke-width="3" paint-order="stroke" fill="white">${label}</text>`
    );
  }

  // --- Legend (top-right, LEGEND_WIDTH px wide) ---
  const lx = DRAW_WIDTH + 8;
  let ly = 16;
  const lineH = 18;

  // Title
  const title = `${meta.state} — ${arm} — max |dev| ${maxAbsDev}%`;
  lines.push(
    `<text x="${lx}" y="${ly}" font-family="monospace" font-size="10" fill="${TEXT_FILL}">${escapeXml(title)}</text>`
  );
  ly += lineH + 4;

  for (const d of stats.districts) {
    const color = PALETTE[(d.district - 1) % PALETTE.length];
    const swatchY = ly - 10;
    lines.push(`<rect x="${lx}" y="${swatchY}" width="12" height="12" fill="${color}"/>`);
    const label = `D${d.district}${d.irregular ? '*' : ''} ${fmtPop(d.pop)} (${d.deviationPct >= 0 ? '+' : ''}${d.deviationPct.toFixed(2)}%)`;
    lines.push(
      `<text x="${lx + 16}" y="${ly}" font-family="monospace" font-size="10" fill="${TEXT_FILL}">${escapeXml(label)}</text>`
    );
    ly += lineH;
  }

  lines.push(`</svg>`);

  const svgText = lines.join('\n') + '\n';
  const outPath = path.join(outDir, `map_${arm}.svg`);
  // Write LF-only (replace any CRLF that might have slipped in)
  fs.writeFileSync(outPath, svgText.replace(/\r\n/g, '\n'), 'utf8');
  return outPath;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Self-test ----
function selftest() {
  const ROWS = 10, COLS = 10, SEATS = 3;
  // Build synthetic grid: all cells in-state
  const inState = new Array(ROWS * COLS).fill(1);
  const pop = new Array(ROWS * COLS).fill(100);

  // 3 districts: rows 0-2, 3-5, 6-9
  const districtOf = (r, _c) => r < 3 ? 1 : r < 6 ? 2 : 3;

  // meta
  const meta = {
    state: 'TS', fips: '99', seats: SEATS, residentPop: 100 * ROWS * COLS,
    idealTarget: (100 * ROWS * COLS) / SEATS,
    originX: 0, originYTop: 0, rows: ROWS, cols: COLS, cellSizeM: 1609.344,
    inStateCells: ROWS * COLS, populatedCells: ROWS * COLS, blocks: 0, populatedBlocks: 0,
  };

  // grid
  const grid = { rows: ROWS, cols: COLS, inState, pop, bridges: [] };

  // assign csv
  const csvLines = ['row,col,district,pop'];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      csvLines.push(`${r},${c},${districtOf(r, c)},100`);
  const csvText = csvLines.join('\n') + '\n';

  // stats
  const districts = [
    { district: 1, pop: 3000, cells: 30, deviationPct: -10.0, ppn: 0.7, bboxAspect: 1.2, bboxFill: 0.9, irregular: false },
    { district: 2, pop: 3000, cells: 30, deviationPct: -10.0, ppn: 0.3, bboxAspect: 1.2, bboxFill: 0.9, irregular: true },
    { district: 3, pop: 4000, cells: 40, deviationPct:  20.0, ppn: 0.7, bboxAspect: 1.2, bboxFill: 0.9, irregular: false },
  ];
  const stats = {
    arm: 'test',
    districts,
    repair: { orphanComponentsMoved: 0, orphanCellsMoved: 0, rebalanceMoves: 0 },
    sha256: 'abc',
  };

  // Write to temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdist-selftest-'));
  fs.writeFileSync(path.join(tmpDir, 'meta.json'), JSON.stringify(meta));
  fs.writeFileSync(path.join(tmpDir, 'grid.json'), JSON.stringify(grid));
  fs.writeFileSync(path.join(tmpDir, 'assign_test.csv'), csvText);
  fs.writeFileSync(path.join(tmpDir, 'stats_test.json'), JSON.stringify(stats));

  const outPath = renderSvg({ outDir: tmpDir, arm: 'test' });
  const svg = fs.readFileSync(outPath, 'utf8');

  // Assertions
  const rectMatches = svg.match(/<rect /g) || [];
  // rects: background(1) + all in-state assigned cells (100) + 1 irregular bbox + SEATS legend swatches
  const expectedRects = 1 + ROWS * COLS + 1 + SEATS; // bg + cells + bbox + swatches
  const legendEntries = (svg.match(/D\d/g) || []).length;
  // D1, D2, D3 appear in labels + legend = 2 each = 6 total, plus district labels in map
  // More reliably: count legend text lines — each district has one swatch rect + one text
  const legendSwatches = (svg.match(/font-size="10"/g) || []).length;
  // title line + 3 district lines = 4
  const expectedLegendLines = 1 + SEATS;

  let pass = true;
  if (rectMatches.length !== expectedRects) {
    console.error(`FAIL: expected ${expectedRects} <rect> elements, got ${rectMatches.length}`);
    pass = false;
  }
  if (legendSwatches !== expectedLegendLines) {
    console.error(`FAIL: expected ${expectedLegendLines} legend text lines (font-size=10), got ${legendSwatches}`);
    pass = false;
  }
  if (!svg.includes('D2*')) {
    console.error('FAIL: irregular district D2 should have asterisk in label');
    pass = false;
  }
  if (!svg.includes('stroke-dasharray')) {
    console.error('FAIL: irregular district bbox should have stroke-dasharray');
    pass = false;
  }
  if (svg.includes('\r')) {
    console.error('FAIL: SVG contains CRLF line endings');
    pass = false;
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (pass) {
    console.log('SELFTEST PASS');
    process.exit(0);
  } else {
    console.log('SELFTEST FAIL');
    process.exit(1);
  }
}

// ---- CLI entry point ----
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') {
    selftest();
  } else if (args.length >= 2) {
    const [outDir, arm] = args;
    try {
      const out = renderSvg({ outDir, arm });
      console.log(`Written: ${out}`);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  } else {
    console.error('Usage: node src/render-svg.js <outDir> <arm>  |  --selftest');
    process.exit(1);
  }
}
