// 50-state production batch runner — splitline arm (the ship arm per the shakeout).
// Resumable: data/states.json is the checkpoint ledger (the go/no-go condition).
// Per state: download(cached) -> grid (V1 exact-sum gate) -> splitline -> repair ->
// score artifacts -> mechanical verifiers -> leaflet render -> ledger row.
// Continue-on-error: a failed state is recorded and the fleet moves on, never silent.
// Usage: node scripts/run-all-states.js [--only TX,CA] [--force]   (run from project root)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const { SEATS, FIPS, requireState } = await import('../src/constants.js');

const LEDGER = path.join(ROOT, 'data/states.json');
const PER_STATE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min wall-clock per state
const HARD_GEOGRAPHIES = ['HI', 'AK', 'MI', 'FL', 'MD', 'LA', 'WV']; // always spot-review

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const force = args.includes('--force');

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const save = () => fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');

// FIPS order = deterministic batch order (sort by the FIPS table — requireState throws for
// not-yet-verified states, and that gate belongs inside the loop, not in the comparator)
const states = Object.keys(SEATS).sort((a, b) => FIPS[a].localeCompare(FIPS[b]));

function runStage(label, cmd, cmdArgs, timeoutMs) {
  const r = spawnSync(process.execPath, [cmd, ...cmdArgs], {
    cwd: ROOT, timeout: timeoutMs, encoding: 'utf8',
  });
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  return {
    ok: !timedOut && r.status === 0,
    timedOut,
    out: ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-4).join(' | '),
    label,
  };
}

let done = 0, failed = 0, skipped = 0;
for (const abbr of states) {
  if (only && !only.includes(abbr)) continue;
  if (!force && ledger[abbr] && ledger[abbr].status === 'done') { skipped++; continue; }
  const st = requireStateSafe(abbr);
  if (!st) { ledger[abbr] = { abbr, status: 'failed', error: 'requireState threw (no confirmed pop?)' }; save(); failed++; continue; }

  const t0 = Date.now();
  const row = { abbr, fips: st.fips, seats: st.seats, atLarge: !!st.atLarge, status: 'running', startedAt: null };
  ledger[abbr] = row; save();
  console.log(`\n=== ${abbr} (FIPS ${st.fips}, ${st.seats} seat${st.seats > 1 ? 's' : ''}) ===`);

  try {
    if (st.atLarge) {
      const r = runStage('at-large', 'cli.js', ['grid', '--state', abbr], 5 * 60 * 1000);
      if (!r.ok) throw new Error(`at-large stage failed: ${r.out}`);
      Object.assign(row, { status: 'done', eligible: true, maxDevPct: 0, irregular: 0, note: 'at-large: district = state polygon' });
    } else {
      const deadline = t0 + PER_STATE_TIMEOUT_MS;
      const stages = [
        ['grid', 'cli.js', ['grid', '--state', abbr]],
        ['run', 'cli.js', ['run', '--state', abbr, '--arm', 'splitline']],
        ['score', 'cli.js', ['score', '--state', abbr]],
        ['v-pop', 'scripts/verify/check-population.js', [abbr]],
        ['v-cov', 'scripts/verify/check-coverage.js', [abbr]],
        ['v-cont', 'scripts/verify/check-contiguity.js', [abbr]],
        ['render', 'src/render-leaflet.js', [path.join(ROOT, 'out', abbr), 'splitline']],
      ];
      const stageLog = [];
      for (const [label, cmd, cargs] of stages) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw Object.assign(new Error('per-state timeout'), { timedOut: true });
        const r = runStage(label, cmd, cargs, remaining);
        stageLog.push(`${label}:${r.ok ? 'ok' : r.timedOut ? 'TIMEOUT' : 'FAIL'}`);
        if (r.timedOut) throw Object.assign(new Error(`timeout in ${label}`), { timedOut: true });
        // verifier failures are recorded but don't abort the state (artifacts exist for review);
        // engine-stage failures abort.
        if (!r.ok && ['grid', 'run', 'score'].includes(label)) throw new Error(`${label} failed: ${r.out}`);
        row[label.replace('-', '_')] = r.ok;
      }
      // read scores.csv for the splitline row
      const scorePath = path.join(ROOT, 'out', abbr, 'scores.csv');
      const lines = fs.readFileSync(scorePath, 'utf8').trim().split('\n');
      const head = lines[0].split(',');
      const sl = lines.map((l) => l.split(',')).find((cells) => cells[0] === 'splitline');
      const get = (k) => sl[head.indexOf(k)];
      Object.assign(row, {
        status: 'done',
        eligible: get('eligible') === 'true',
        gateFailures: get('gateFailures'),
        maxDevPct: Number(get('maxAbsDevPct')),
        irregular: Number(get('irregularCount')),
        meanPpn: Number(get('meanPpn')),
        sha256: get('sha256').slice(0, 12),
        stages: stageLog.join(' '),
      });
    }
  } catch (err) {
    Object.assign(row, { status: err.timedOut ? 'timeout' : 'failed', error: String(err.message).slice(0, 300) });
  }
  row.durationMs = Date.now() - t0;
  row.flaggedForReview = row.status !== 'done' || HARD_GEOGRAPHIES.includes(abbr) ||
    (row.eligible === false) || (row.gateFailures && row.gateFailures !== 'none');
  save();
  if (row.status === 'done') { done++; } else { failed++; }
  console.log(`${abbr}: ${row.status}${row.maxDevPct !== undefined ? ` maxDev=${row.maxDevPct}% irregular=${row.irregular}` : ''}${row.error ? ' — ' + row.error : ''} (${Math.round(row.durationMs / 1000)}s)`);
}

function requireStateSafe(abbr) {
  try { return requireState(abbr); } catch { return null; }
}

// summary
const rows = Object.values(ledger);
const clean = rows.filter((r) => r.status === 'done' && r.eligible && (!r.gateFailures || r.gateFailures === 'none')).length;
const flaggedRows = rows.filter((r) => r.flaggedForReview);
console.log(`\nBATCH SUMMARY: done=${done} skipped(already done)=${skipped} failed/timeout=${failed}`);
console.log(`clean=${clean}/${rows.length}, flagged for review: ${flaggedRows.map((r) => r.abbr + '(' + (r.status !== 'done' ? r.status : r.gateFailures !== 'none' ? r.gateFailures : 'hard-geo') + ')').join(', ') || 'none'}`);
process.exit(failed > 0 ? 2 : 0);
