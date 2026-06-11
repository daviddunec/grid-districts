// Stage runner per docs/INTERFACES.md CLI contract.
import fs from 'node:fs';
import path from 'node:path';
import { requireState } from './src/constants.js';
import { buildGrid } from './src/grid.js';
import { runAccretion } from './src/traverse/accretion.js';
import { runSplitline } from './src/traverse/splitline.js';
import { runHilbert } from './src/traverse/hilbert.js';
import { repair } from './src/repair.js';
import { buildCsv, districtStats, buildGeojson, sha256Of, contiguityOk, writeScoresCsv } from './src/score.js';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const ARMS = ['accretion-west', 'accretion-centroid', 'splitline', 'hilbert']; // hilbert: pre-committed contingency arm (CC-2)

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) args[key] = argv[++i];
      else args[key] = true;
    } else args._.push(argv[i]);
  }
  return args;
}

function loadOut(outDir) {
  const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8'));
  const g = JSON.parse(fs.readFileSync(path.join(outDir, 'grid.json'), 'utf8'));
  return {
    meta,
    grid: {
      rows: g.rows, cols: g.cols,
      inState: Uint8Array.from(g.inState),
      pop: Int32Array.from(g.pop),
      bridges: g.bridges,
    },
  };
}

function runArm(outDir, arm) {
  const { meta, grid } = loadOut(outDir);
  let result;
  if (arm === 'accretion-west') result = runAccretion(grid, meta, 'west');
  else if (arm === 'accretion-centroid') result = runAccretion(grid, meta, 'centroid');
  else if (arm === 'splitline') result = runSplitline(grid, meta);
  else if (arm === 'hilbert') result = runHilbert(grid, meta);
  else throw new Error(`Unknown arm ${arm}`);

  const repairStats = repair(grid, meta, result.district, result.anchors);
  const csv = buildCsv(grid, result.district);
  const sha = sha256Of(csv);
  const stats = districtStats(grid, meta, result.district, repairStats, sha, arm);
  const geojson = buildGeojson(grid, meta, result.district, stats);

  fs.writeFileSync(path.join(outDir, `assign_${arm}.csv`), csv);
  fs.writeFileSync(path.join(outDir, `stats_${arm}.json`), JSON.stringify(stats, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, `districts_${arm}.geojson`), JSON.stringify(geojson) + '\n');
  // Always written — absence of the file must never be confused with absence of sealing
  // (devil's advocate condition; an empty array IS the "zero seals" evidence).
  fs.writeFileSync(path.join(outDir, `sealed_${arm}.log`), JSON.stringify(result.sealedLog, null, 1) + '\n');

  const contiguous = contiguityOk(grid, meta, result.district);
  const devs = stats.districts.map((d) => Math.abs(d.deviationPct));
  console.log(
    `${arm}: districts=${stats.districts.length} maxDev=${Math.max(...devs).toFixed(3)}% ` +
    `irregular=${stats.districts.filter((d) => d.irregular).length} contiguous=${contiguous} ` +
    `repair={orphans:${repairStats.orphanCellsMoved},rebalance:${repairStats.rebalanceMoves}} sha=${sha.slice(0, 12)}`
  );
  return { arm, stats, contiguous };
}

const args = parseArgs(process.argv.slice(2));
const stage = args._[0];
const state = args.state || 'CO';
const outDir = args.outdir ? path.resolve(args.outdir) : path.join(ROOT, 'out', state);

// At-large states (AK DE ND SD VT WY): district = the whole state; no grid, no traversal.
// Without this branch the 50-state batch aborts on all six (code review B3).
const stInfo = requireState(state);
if (stInfo.atLarge) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({
    state, fips: stInfo.fips, seats: 1, atLarge: true,
    note: 'At-large state: District 1 = the state polygon. No grid/traversal artifacts by design.',
  }) + '\n');
  console.log(`${state}: at-large — District 1 = state polygon; no grid/traversal (by design)`);
  process.exit(0);
}

if (stage === 'grid') {
  const meta = await buildGrid(state, { shuffle: !!args.shuffle });
  console.log(`grid: ${meta.rows}x${meta.cols}, inState=${meta.inStateCells}, populated=${meta.populatedCells}`);
} else if (stage === 'run') {
  fs.mkdirSync(outDir, { recursive: true });
  if (args.arm) runArm(outDir, args.arm);
  else for (const arm of ARMS) runArm(outDir, arm);
} else if (stage === 'score') {
  const { meta, grid } = loadOut(outDir);
  const arms = [];
  for (const arm of ARMS) {
    const statsPath = path.join(outDir, `stats_${arm}.json`);
    if (!fs.existsSync(statsPath)) continue;
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const csv = fs.readFileSync(path.join(outDir, `assign_${arm}.csv`), 'utf8');
    // rebuild district array from CSV for the contiguity flag
    const district = new Int16Array(grid.rows * grid.cols).fill(-1);
    for (const line of csv.trim().split('\n').slice(1)) {
      const [r, c, d] = line.split(',').map(Number);
      district[r * grid.cols + c] = d;
    }
    arms.push({ arm, stats, contiguous: contiguityOk(grid, meta, district) });
  }
  console.log(writeScoresCsv(outDir, meta, arms));
} else if (stage === 'render') {
  const { renderSvg } = await import('./src/render-svg.js');
  const { renderLeaflet } = await import('./src/render-leaflet.js');
  const armsToRender = args.arm ? [args.arm] : ARMS;
  for (const arm of armsToRender) {
    if (!fs.existsSync(path.join(outDir, `assign_${arm}.csv`))) continue;
    renderSvg({ outDir, arm });
    renderLeaflet({ outDir, arm });
    console.log(`rendered ${arm}: map_${arm}.svg + map_${arm}.html`);
  }
} else if (stage === 'all') {
  await buildGrid(state, { shuffle: !!args.shuffle });
  fs.mkdirSync(outDir, { recursive: true });
  for (const arm of ARMS) runArm(outDir, arm);
  const { spawnSync } = await import('node:child_process');
  for (const sub of ['score', 'render']) {
    const r = spawnSync(process.execPath, ['cli.js', sub, '--state', state], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status);
  }
} else {
  console.error('Usage: node cli.js <grid|run|score|render|all> --state CO [--arm <arm>] [--shuffle] [--outdir dir]');
  process.exit(1);
}
