// FL-012 remediation: re-run the three verifiers for every completed multi-district state,
// scoped to the PRODUCTION arm with the correct gate policy, and update data/states.json's
// v_pop / v_cov / v_cont / stages / flaggedForReview fields to match.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const HARD_GEOGRAPHIES = ['HI', 'AK', 'MI', 'FL', 'MD', 'LA', 'WV'];
const ledger = JSON.parse(fs.readFileSync('data/states.json', 'utf8'));

let changed = 0;
for (const [abbr, row] of Object.entries(ledger)) {
  if (row.status !== 'done' || row.atLarge) continue;
  const gate = abbr === 'CO' ? '1.0' : '2.0';
  const flagNotFail = ['NY', 'CA', 'IL', 'NJ'].includes(abbr) ? ['--flag-not-fail'] : [];
  const results = {};
  for (const [key, script, extra] of [
    ['v_pop', 'scripts/verify/check-population.js', ['--arm', 'splitline', '--gate', gate, ...flagNotFail]],
    ['v_cov', 'scripts/verify/check-coverage.js', ['--arm', 'splitline']],
    ['v_cont', 'scripts/verify/check-contiguity.js', ['--arm', 'splitline']],
  ]) {
    const r = spawnSync(process.execPath, [script, abbr, ...extra], { cwd: ROOT, encoding: 'utf8', timeout: 10 * 60 * 1000 });
    results[key] = r.status === 0;
  }
  const before = JSON.stringify([row.v_pop, row.v_cov, row.v_cont]);
  Object.assign(row, results);
  row.stages = `grid:ok run:ok score:ok v-pop:${results.v_pop ? 'ok' : 'FAIL'} v-cov:${results.v_cov ? 'ok' : 'FAIL'} v-cont:${results.v_cont ? 'ok' : 'FAIL'} render:ok`;
  row.flaggedForReview = row.status !== 'done' || HARD_GEOGRAPHIES.includes(abbr) ||
    row.eligible === false || (row.gateFailures && row.gateFailures !== 'none') ||
    !results.v_pop || !results.v_cov || !results.v_cont;
  if (before !== JSON.stringify([row.v_pop, row.v_cov, row.v_cont])) changed++;
  console.log(`${abbr}: v_pop=${results.v_pop} v_cov=${results.v_cov} v_cont=${results.v_cont} flagged=${row.flaggedForReview}`);
}
fs.writeFileSync('data/states.json', JSON.stringify(ledger, null, 2) + '\n');
const bad = Object.values(ledger).filter((r) => r.status === 'done' && !r.atLarge && (!r.v_pop || !r.v_cov || !r.v_cont));
console.log(`\nrefreshed; ${changed} states changed; verifier failures remaining: ${bad.map((r) => r.abbr).join(',') || 'NONE'}`);
process.exit(bad.length ? 1 : 0);
