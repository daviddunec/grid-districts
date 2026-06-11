// Stage 1: fetch + cache Census source files; extract only what we parse.
// DBF-only contract: we never extract or read TABBLOCK20 .shp geometry (CLAUDE.md rule 4).
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const RAW = path.join(ROOT, 'data/raw');

export const TABBLOCK_URL = (fips) =>
  `https://www2.census.gov/geo/tiger/TIGER2020/TABBLOCK20/tl_2020_${fips}_tabblock20.zip`;
export const STATES_URL =
  'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip';

async function fetchToFile(url, dest, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
      return dest;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
}

/** Download (if missing) and return the path to a state's TABBLOCK20 .dbf, extracted from the zip. */
export async function ensureBlockDbf(fips) {
  const dir = path.join(RAW, fips);
  const dbfName = `tl_2020_${fips}_tabblock20.dbf`;
  const dbfPath = path.join(dir, dbfName);
  if (fs.existsSync(dbfPath)) return dbfPath;

  const zipPath = path.join(dir, `tl_2020_${fips}_tabblock20.zip`);
  if (!fs.existsSync(zipPath)) await fetchToFile(TABBLOCK_URL(fips), zipPath);

  const zip = new AdmZip(zipPath); // throws on a corrupt/partial download — caller re-fetches
  const entry = zip.getEntry(dbfName);
  if (!entry) throw new Error(`${dbfName} not found inside ${zipPath}`);
  zip.extractEntryTo(entry, dir, false, true);
  return dbfPath;
}

/** Download (if missing) and return paths to the national state-boundary .shp/.dbf pair. */
export async function ensureStateBoundary() {
  const zipPath = path.join(RAW, 'cb_2020_us_state_500k.zip');
  const shpPath = path.join(RAW, 'cb_2020_us_state_500k.shp');
  const dbfPath = path.join(RAW, 'cb_2020_us_state_500k.dbf');
  if (fs.existsSync(shpPath) && fs.existsSync(dbfPath)) return { shpPath, dbfPath };
  if (!fs.existsSync(zipPath)) await fetchToFile(STATES_URL, zipPath);
  const zip = new AdmZip(zipPath);
  for (const name of ['cb_2020_us_state_500k.shp', 'cb_2020_us_state_500k.dbf']) {
    const entry = zip.getEntry(name);
    if (!entry) throw new Error(`${name} not found inside ${zipPath}`);
    zip.extractEntryTo(entry, RAW, false, true);
  }
  return { shpPath, dbfPath };
}
