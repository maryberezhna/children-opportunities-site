import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRow, validate } from './lib/normalize.mjs';
import { toCsv } from './lib/csv.mjs';

import * as acmodasi from './sources/acmodasi-castings.mjs';
import * as constellation from './sources/constellation-ua.mjs';
import * as festPortal from './sources/fest-portal.mjs';
import * as camps from './sources/regional-camps.mjs';
import * as international from './sources/international-competitions.mjs';
import * as langSchools from './sources/regional-language-schools.mjs';

const SOURCES = [acmodasi, constellation, festPortal, camps, international, langSchools];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'output');

async function main() {
  const all = [];
  const seen = new Set();
  let totalRaw = 0;
  let totalInvalid = 0;

  for (const source of SOURCES) {
    process.stdout.write(`→ ${source.name} ... `);
    let partials = [];
    try {
      partials = await source.scrape();
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      continue;
    }
    totalRaw += partials.length;

    let kept = 0;
    for (const p of partials) {
      const row = buildRow(p);
      const errors = validate(row);
      if (errors.length) {
        totalInvalid++;
        console.warn(`  skip "${row.title?.slice(0, 40)}": ${errors.join(', ')}`);
        continue;
      }
      if (seen.has(row.content_hash)) continue;
      seen.add(row.content_hash);
      all.push(row);
      kept++;
    }
    console.log(`${kept} rows`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const csvPath = join(OUT_DIR, `opportunities-${date}.csv`);
  await writeFile(csvPath, toCsv(all), 'utf8');

  console.log('');
  console.log(`Scraped: ${totalRaw}, kept: ${all.length}, invalid: ${totalInvalid}, deduped: ${totalRaw - all.length - totalInvalid}`);
  console.log(`CSV → ${csvPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
