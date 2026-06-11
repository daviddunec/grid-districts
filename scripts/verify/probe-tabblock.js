// V6 ground-truth probe — THE hard gate for the single external data assumption.
// Asserts: (1) the TABBLOCK20 DBF carries the fields the whole engine depends on,
// (2) Σ POP20 === the published PL 94-171 RESIDENT population, exactly (FL-001 / PR-1).
// Usage: node scripts/verify/probe-tabblock.js [fips=08] [expectedPop=5773714]
import shapefile from 'shapefile';
import { ensureBlockDbf } from '../../src/download.js';

const fips = process.argv[2] || '08';
const expectedPop = Number(process.argv[3] || 5773714); // CO 2020 resident pop (pending CONFIRMED verdict)
const REQUIRED_FIELDS = ['GEOID20', 'POP20', 'HOUSING20', 'ALAND20', 'AWATER20', 'INTPTLAT20', 'INTPTLON20'];

const dbfPath = await ensureBlockDbf(fips);
const source = await shapefile.openDbf(dbfPath);

let n = 0, popSum = 0, popMax = 0, populated = 0;
let fieldsChecked = false;
const missing = [];

for (;;) {
  const { done, value } = await source.read();
  if (done) break;
  if (!fieldsChecked) {
    for (const f of REQUIRED_FIELDS) if (!(f in value)) missing.push(f);
    fieldsChecked = true;
    if (missing.length) break;
    // INTPTLAT20/LON20 must parse as signed decimal degrees (stored as strings with leading +/-)
    const lat = parseFloat(value.INTPTLAT20), lon = parseFloat(value.INTPTLON20);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.error(`FAIL: INTPTLAT20/INTPTLON20 do not parse as numbers: "${value.INTPTLAT20}", "${value.INTPTLON20}"`);
      process.exit(1);
    }
  }
  n++;
  const p = Number(value.POP20);
  popSum += p;
  if (p > 0) populated++;
  if (p > popMax) popMax = p;
}

if (missing.length) {
  console.error(`FAIL: DBF missing required fields: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`blocks=${n} populated=${populated} popSum=${popSum} popMax=${popMax} expected=${expectedPop}`);
if (popSum !== expectedPop) {
  console.error(`FAIL: sum(POP20)=${popSum} !== expected resident population ${expectedPop} (diff ${popSum - expectedPop})`);
  console.error('Check FL-001: are you comparing against RESIDENT (PL 94-171) population, not apportionment population?');
  process.exit(1);
}
console.log('PROBE PASS: all required DBF fields present; POP20 sum matches published resident population exactly.');
