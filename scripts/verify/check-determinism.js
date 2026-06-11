#!/usr/bin/env node
// check-determinism.js <csvA> <csvB>
// Verifier: SHA-256 byte equality of two CSV artifacts
// Usage: node scripts/verify/check-determinism.js out/CO/assign_accretion-west.csv out/CO/assign_accretion-west.csv
//        node scripts/verify/check-determinism.js --selftest
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function sha256File(p) {
  const bytes = readFileSync(p);
  return createHash('sha256').update(bytes).digest('hex');
}

function runSelftest() {
  console.log('--- SELFTEST check-determinism.js ---');
  const dir = join(tmpdir(), `verify_det_selftest_${process.pid}`);
  mkdirSync(dir, { recursive: true });

  const content = 'row,col,district,pop\n0,0,1,50\n0,1,1,50\n1,0,2,50\n1,1,2,50\n';
  const pathA = join(dir, 'a.csv');
  const pathB = join(dir, 'b.csv');
  const pathC = join(dir, 'c.csv');

  writeFileSync(pathA, content);
  writeFileSync(pathB, content);                                 // identical to A
  writeFileSync(pathC, content.replace('1,0,2,50', '1,0,2,51')); // differs

  let allPass = true;

  // Test 1: A === B → should be MATCH
  const hashA1 = sha256File(pathA);
  const hashB1 = sha256File(pathB);
  if (hashA1 === hashB1) { console.log('SELFTEST PASS: identical files produce matching hashes'); }
  else { console.log('SELFTEST FAIL: identical files produced different hashes'); allPass = false; }

  // Test 2: A !== C → should be MISMATCH
  const hashA2 = sha256File(pathA);
  const hashC2 = sha256File(pathC);
  if (hashA2 !== hashC2) { console.log('SELFTEST PASS: different files produce different hashes'); }
  else { console.log('SELFTEST FAIL: different files produced same hash'); allPass = false; }

  if (allPass) { console.log('SELFTEST PASS: check-determinism.js'); }
  else { console.log('SELFTEST FAIL: check-determinism.js'); process.exit(1); }
}

// --- MAIN ---
const args = process.argv.slice(2);
if (args.includes('--selftest')) { runSelftest(); process.exit(0); }

const [csvA, csvB] = args;
if (!csvA || !csvB) {
  console.error('Usage: node check-determinism.js <csvA> <csvB> [--selftest]');
  process.exit(1);
}

let hashA, hashB;
try {
  hashA = sha256File(csvA);
} catch (e) {
  console.error(`FAIL: cannot read csvA "${csvA}": ${e.message}`);
  process.exit(1);
}
try {
  hashB = sha256File(csvB);
} catch (e) {
  console.error(`FAIL: cannot read csvB "${csvB}": ${e.message}`);
  process.exit(1);
}

console.log(`csvA: ${hashA}  ${csvA}`);
console.log(`csvB: ${hashB}  ${csvB}`);

if (hashA === hashB) {
  console.log('PASS: SHA-256 hashes match — files are byte-identical');
  process.exit(0);
} else {
  console.log('FAIL: SHA-256 hashes differ — files are NOT byte-identical');
  process.exit(1);
}
