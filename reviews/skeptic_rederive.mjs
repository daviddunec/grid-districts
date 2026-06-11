/**
 * skeptic_rederive.mjs
 * Independent population re-derivation for the accretion-west arm.
 *
 * HARD RULE: imports NOTHING from src/ or scripts/verify/.
 * Uses only:
 *   - node built-ins (fs, path, readline, url)
 *   - redistricting/node_modules/shapefile (openDbf)
 *   - the four artifact files listed in the task brief
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── require() shim so we can load the CJS shapefile dist ─────────────────────
const require = createRequire(import.meta.url);
const shapefile = require(resolve(PROJECT_ROOT, 'node_modules/shapefile/dist/shapefile.node.js'));

// ── paths ─────────────────────────────────────────────────────────────────────
const DBF_PATH         = resolve(PROJECT_ROOT, 'data/raw/08/tl_2020_08_tabblock20.dbf');
const CELL_BLOCKS_PATH = resolve(PROJECT_ROOT, 'out/CO/cell_blocks.json');
const CSV_PATH         = resolve(PROJECT_ROOT, 'out/CO/assign_accretion-west.csv');
const META_PATH        = resolve(PROJECT_ROOT, 'out/CO/meta.json');
const STATS_PATH       = resolve(PROJECT_ROOT, 'out/CO/stats_accretion-west.json');

// ── helpers ───────────────────────────────────────────────────────────────────
function log(msg) { process.stdout.write(msg + '\n'); }

// ── STEP 1: read raw DBF -> GEOID20 -> POP20 map ─────────────────────────────
async function buildGeoidPopMap() {
  log('[1] Reading raw DBF: ' + DBF_PATH);
  const source = await shapefile.openDbf(DBF_PATH, { encoding: 'utf-8' });
  const geoidPop = new Map();   // string GEOID20 -> int POP20
  let total = 0;
  while (true) {
    const result = await source.read();
    if (result.done) break;
    const rec = result.value;
    // Fields in TIGER tabblock20 DBF: GEOID20, POP20, HOUSING20, ...
    const geoid = String(rec.GEOID20).trim();
    const pop   = parseInt(rec.POP20, 10);
    if (geoidPop.has(geoid)) throw new Error(`Duplicate GEOID20 in DBF: ${geoid}`);
    geoidPop.set(geoid, isNaN(pop) ? 0 : pop);
    total++;
  }
  log(`    Read ${total} DBF records; unique GEOIDs: ${geoidPop.size}`);
  return geoidPop;
}

// ── STEP 2: cell_blocks.json -> per-cell pop (from raw DBF) ──────────────────
function buildCellPopFromDBF(cellBlocks, geoidPop) {
  log('[2] Computing per-cell populations from raw DBF via cell_blocks.json');
  // Also check: no GEOID appears in two cells
  const geoidSeen = new Map();  // geoid -> cellKey (for uniqueness check)
  const cellPopDBF = new Map(); // "r,c" -> pop (int)
  let dupGeoidsFound = 0;

  for (const [cellKey, geoids] of Object.entries(cellBlocks)) {
    let sum = 0;
    for (const geoid of geoids) {
      if (geoidSeen.has(geoid)) {
        log(`    ERROR: GEOID ${geoid} appears in both cell ${geoidSeen.get(geoid)} and ${cellKey}`);
        dupGeoidsFound++;
      } else {
        geoidSeen.set(geoid, cellKey);
      }
      const p = geoidPop.get(geoid);
      if (p === undefined) {
        throw new Error(`GEOID ${geoid} in cell_blocks.json not found in DBF`);
      }
      sum += p;
    }
    cellPopDBF.set(cellKey, sum);
  }
  log(`    Populated cells: ${cellPopDBF.size}; unique GEOIDs across all cells: ${geoidSeen.size}`);
  if (dupGeoidsFound > 0) {
    log(`    FAIL: ${dupGeoidsFound} duplicate GEOIDs detected across cells`);
  }
  return { cellPopDBF, geoidSeen, dupGeoidsFound };
}

// ── STEP 3 & 4: parse CSV -> district mapping + CSV pop ──────────────────────
async function parseCSV() {
  log('[3] Parsing CSV for district mapping and CSV pop column');
  const rl = readline.createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  const csvDistrict = new Map();  // "r,c" -> district (int)
  const csvPop      = new Map();  // "r,c" -> pop (int from CSV)
  let headerSeen = false;
  let rowCount = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!headerSeen) { headerSeen = true; continue; } // skip header
    const parts = trimmed.split(',');
    if (parts.length !== 4) throw new Error(`Bad CSV line: ${line}`);
    const r   = parseInt(parts[0], 10);
    const c   = parseInt(parts[1], 10);
    const d   = parseInt(parts[2], 10);
    const pop = parseInt(parts[3], 10);
    const key = `${r},${c}`;
    if (csvDistrict.has(key)) throw new Error(`Duplicate cell in CSV: ${key}`);
    csvDistrict.set(key, d);
    csvPop.set(key, pop);
    rowCount++;
  }
  log(`    CSV rows (non-header): ${rowCount}`);
  return { csvDistrict, csvPop, csvRowCount: rowCount };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log('=== SKEPTIC RE-DERIVATION — accretion-west, Colorado ===');
  log('');

  // Load artifacts
  const meta     = JSON.parse(readFileSync(META_PATH,        'utf8'));
  const stats    = JSON.parse(readFileSync(STATS_PATH,       'utf8'));
  const cellBlocks = JSON.parse(readFileSync(CELL_BLOCKS_PATH, 'utf8'));

  const REPORTED_TOTAL = meta.residentPop;   // 5,773,714
  const N_SEATS        = meta.seats;         // 8

  log(`Meta: residentPop=${REPORTED_TOTAL}, seats=${N_SEATS}`);
  log('');

  // Step 1: DBF
  const geoidPop = await buildGeoidPopMap();
  log('');

  // Step 2: cell pops from DBF
  const { cellPopDBF, geoidSeen, dupGeoidsFound } = buildCellPopFromDBF(cellBlocks, geoidPop);
  log('');

  // Step 3: CSV
  const { csvDistrict, csvPop, csvRowCount } = await parseCSV();
  log('');

  // ── CHECK A: every populated cell in cell_blocks appears in CSV ─────────────
  log('[CHECK A] Every populated cell in cell_blocks.json appears in the CSV');
  let missingInCSV = 0;
  for (const key of Object.keys(cellBlocks)) {
    if (!csvDistrict.has(key)) {
      log(`    MISSING: cell ${key} is in cell_blocks.json but not in CSV`);
      missingInCSV++;
    }
  }
  const checkA_pass = missingInCSV === 0;
  log(`    Result: ${checkA_pass ? 'PASS' : 'FAIL'} (${missingInCSV} missing cells)`);
  log('');

  // ── CHECK B: CSV pop of every cell == sum of blocks' POP20 ─────────────────
  log('[CHECK B] CSV pop column == DBF-derived pop for each populated cell');
  let cellMismatches = 0;
  let cellMismatchExamples = [];
  for (const [key, dbfPop] of cellPopDBF) {
    const csvP = csvPop.get(key);
    if (csvP === undefined) {
      // Already caught by Check A
      continue;
    }
    if (csvP !== dbfPop) {
      cellMismatches++;
      if (cellMismatchExamples.length < 5) {
        cellMismatchExamples.push(`cell ${key}: CSV=${csvP}, DBF=${dbfPop}`);
      }
    }
  }
  // Also check cells in CSV with pop>0 that are NOT in cell_blocks
  let csvPopWithoutBlocks = 0;
  for (const [key, p] of csvPop) {
    if (p > 0 && !cellPopDBF.has(key)) {
      csvPopWithoutBlocks++;
    }
  }
  const checkB_pass = cellMismatches === 0 && csvPopWithoutBlocks === 0;
  if (cellMismatchExamples.length > 0) {
    log(`    Mismatch examples: ${cellMismatchExamples.join('; ')}`);
  }
  if (csvPopWithoutBlocks > 0) {
    log(`    ${csvPopWithoutBlocks} CSV cells with pop>0 have no entry in cell_blocks.json`);
  }
  log(`    Cell mismatches: ${cellMismatches}; csv-pop-without-blocks: ${csvPopWithoutBlocks}`);
  log(`    Result: ${checkB_pass ? 'PASS' : 'FAIL'}`);
  log('');

  // ── CHECK C: no GEOID in two cells ─────────────────────────────────────────
  log('[CHECK C] No GEOID20 appears in two different cells');
  const checkC_pass = dupGeoidsFound === 0;
  log(`    Duplicate GEOID count: ${dupGeoidsFound}`);
  log(`    Result: ${checkC_pass ? 'PASS' : 'FAIL'}`);
  log('');

  // ── STEP 4: per-district populations, two ways ──────────────────────────────
  log('[4] Computing per-district populations');

  // (a) DBF-via-cell_blocks path
  const distPopA = new Map(); // district -> pop
  for (let d = 1; d <= N_SEATS; d++) distPopA.set(d, 0);

  for (const [key, dbfPop] of cellPopDBF) {
    const d = csvDistrict.get(key);
    if (d === undefined) continue; // already flagged in checkA
    distPopA.set(d, (distPopA.get(d) || 0) + dbfPop);
  }

  // (b) CSV pop column path (sum of CSV pop per district)
  const distPopB = new Map();
  for (let d = 1; d <= N_SEATS; d++) distPopB.set(d, 0);

  for (const [key, p] of csvPop) {
    const d = csvDistrict.get(key);
    if (d === undefined) continue;
    distPopB.set(d, (distPopB.get(d) || 0) + p);
  }

  // ── CHECK D: total sums to REPORTED_TOTAL ───────────────────────────────────
  const totalA = [...distPopA.values()].reduce((s, v) => s + v, 0);
  const totalB = [...distPopB.values()].reduce((s, v) => s + v, 0);

  log('[CHECK D] Both derivations sum to exactly ' + REPORTED_TOTAL);
  log(`    Method A (DBF->cell_blocks->csv-district): ${totalA}`);
  log(`    Method B (CSV pop col): ${totalB}`);
  const checkD_pass = totalA === REPORTED_TOTAL && totalB === REPORTED_TOTAL;
  log(`    Result: ${checkD_pass ? 'PASS' : 'FAIL'}`);
  log('');

  // ── CHECK E: per-district values match stats_accretion-west.json ───────────
  log('[CHECK E] Per-district pops match stats_accretion-west.json');
  let distMismatches = 0;
  const distReported = new Map();
  for (const entry of stats.districts) {
    distReported.set(entry.district, entry.pop);
  }

  const perDistrictRows = [];
  for (let d = 1; d <= N_SEATS; d++) {
    const a    = distPopA.get(d) || 0;
    const b    = distPopB.get(d) || 0;
    const rep  = distReported.get(d);
    const abMatch    = (a === b)   ? 'YES' : 'NO';
    const aRepMatch  = (a === rep) ? 'YES' : 'NO';
    const bRepMatch  = (b === rep) ? 'YES' : 'NO';
    const allMatch   = (a === b && a === rep);
    if (!allMatch) distMismatches++;
    perDistrictRows.push({ d, a, b, rep, abMatch, aRepMatch, bRepMatch, allMatch });
    log(`    District ${d}: derived-A=${a}, derived-B=${b}, reported=${rep} — ${allMatch ? 'MATCH' : 'MISMATCH'}`);
  }
  const checkE_pass = distMismatches === 0;
  log(`    District mismatches: ${distMismatches}`);
  log(`    Result: ${checkE_pass ? 'PASS' : 'FAIL'}`);
  log('');

  // ── VERDICT ─────────────────────────────────────────────────────────────────
  const allPass = checkA_pass && checkB_pass && checkC_pass && checkD_pass && checkE_pass;
  const verdict = allPass ? 'PASS' : 'FAIL';

  log('='.repeat(60));
  log('CHECKS SUMMARY');
  log(`  A. Every populated cell in cell_blocks in CSV:   ${checkA_pass ? 'PASS' : 'FAIL'}`);
  log(`  B. CSV pop == DBF-derived pop per cell:          ${checkB_pass ? 'PASS' : 'FAIL'}`);
  log(`  C. No GEOID20 in two different cells:            ${checkC_pass ? 'PASS' : 'FAIL'}`);
  log(`  D. Both derivations sum to ${REPORTED_TOTAL}: ${checkD_pass ? 'PASS' : 'FAIL'}`);
  log(`  E. Per-district values match stats JSON:         ${checkE_pass ? 'PASS' : 'FAIL'}`);
  log('='.repeat(60));
  log(`VERDICT: ${verdict}`);
  log('');

  // ── Write phase3_results_skeptic.md ─────────────────────────────────────────
  log('[5] Writing phase3_results_skeptic.md ...');

  let md = `# Phase 3 Independent Skeptic Results — accretion-west, Colorado\n\n`;
  md += `**Re-derived independently.** No code from \`src/\` or \`scripts/verify/\` was read or imported.\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += `## Per-District Population Table\n\n`;
  md += `| District | Derived-A (DBF→cell_blocks→csv-district) | Derived-B (CSV pop col) | Reported (stats JSON) | A==B | A==Reported |\n`;
  md += `|----------|------------------------------------------|-------------------------|-----------------------|------|-------------|\n`;

  for (const { d, a, b, rep, abMatch, aRepMatch } of perDistrictRows) {
    md += `| ${d} | ${a.toLocaleString()} | ${b.toLocaleString()} | ${(rep||'N/A').toLocaleString()} | ${abMatch} | ${aRepMatch} |\n`;
  }

  md += `\n**Total (Derived-A):** ${totalA.toLocaleString()}  \n`;
  md += `**Total (Derived-B):** ${totalB.toLocaleString()}  \n`;
  md += `**Expected (meta.residentPop):** ${REPORTED_TOTAL.toLocaleString()}\n\n`;

  md += `## Five Checks\n\n`;
  md += `| # | Check | Result |\n`;
  md += `|---|-------|--------|\n`;
  md += `| A | Every populated cell in \`cell_blocks.json\` appears in the CSV | **${checkA_pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| B | CSV \`pop\` column equals sum of its blocks' POP20 from DBF, for every populated cell | **${checkB_pass ? 'PASS' : 'FAIL'}** (${cellMismatches} mismatches${csvPopWithoutBlocks > 0 ? `, ${csvPopWithoutBlocks} csv-pop-without-blocks` : ''}) |\n`;
  md += `| C | No GEOID20 appears in two different cells | **${checkC_pass ? 'PASS' : 'FAIL'}** (${dupGeoidsFound} duplicates) |\n`;
  md += `| D | Both derivations sum to exactly ${REPORTED_TOTAL.toLocaleString()} | **${checkD_pass ? 'PASS' : 'FAIL'}** (A=${totalA.toLocaleString()}, B=${totalB.toLocaleString()}) |\n`;
  md += `| E | Per-district populations match \`stats_accretion-west.json\` | **${checkE_pass ? 'PASS' : 'FAIL'}** (${distMismatches} district mismatches) |\n`;

  md += `\n## Verdict\n\n`;
  md += `**VERDICT: ${verdict}**\n\n`;

  if (verdict === 'PASS') {
    md += `All five independent checks passed. The reported per-district populations in \`stats_accretion-west.json\` `;
    md += `are consistent with the raw Census DBF (tl_2020_08_tabblock20.dbf) summed through \`cell_blocks.json\`, `;
    md += `and both derivations sum to the correct Colorado resident population of ${REPORTED_TOTAL.toLocaleString()}.\n\n`;
    md += `### Per-District One-Line Summary\n\n`;
    for (const { d, a, rep } of perDistrictRows) {
      const idealTarget = meta.idealTarget;
      const devPct = ((a - idealTarget) / idealTarget * 100).toFixed(4);
      md += `- District ${d}: **${a.toLocaleString()}** — matches reported ${(rep||0).toLocaleString()}, deviation ${devPct}% from ideal ${idealTarget.toLocaleString()}\n`;
    }
  } else {
    md += `One or more checks FAILED. See details above.\n`;
  }

  md += `\n---\n*Script: reviews/skeptic_rederive.mjs — imports only node built-ins + shapefile dist CJS*\n`;

  const OUT_PATH = resolve(__dirname, 'phase3_results_skeptic.md');
  writeFileSync(OUT_PATH, md, 'utf8');
  log(`    Written: ${OUT_PATH}`);
  log('');
  log('Done.');
}

main().catch(err => {
  process.stderr.write('FATAL: ' + err.stack + '\n');
  process.exit(1);
});
