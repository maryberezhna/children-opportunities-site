import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildRow, validate } from './lib/normalize.mjs';
import { applyRules } from './lib/rules.mjs';
import { toCsv } from './lib/csv.mjs';

import * as acmodasi from './sources/acmodasi-castings.mjs';
import * as constellation from './sources/constellation-ua.mjs';
import * as festPortal from './sources/fest-portal.mjs';
import * as camps from './sources/regional-camps.mjs';
import * as international from './sources/international-competitions.mjs';
import * as langSchools from './sources/regional-language-schools.mjs';
import * as manContests from './sources/man-contests.mjs';

const SOURCES = [acmodasi, constellation, festPortal, camps, international, langSchools, manContests];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'output');

async function main() {
  const all = [];
  const ctx = { seenHashes: new Set(), seenUrls: new Set() };
  const rejectLog = [];
  let totalRaw = 0;

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

      // Schema-level validation (types, required fields)
      const schemaErrors = validate(row);
      if (schemaErrors.length) {
        rejectLog.push({ source: source.name, title: row.title, reasons: schemaErrors });
        continue;
      }

      // Insertion rules (dedup, format normalization, hard blocks, quality)
      const rules = applyRules(row, ctx);
      if (!rules.ok) {
        rejectLog.push({ source: source.name, title: row.title, reasons: rules.reasons });
        continue;
      }
      if (rules.warnings.length) {
        console.warn(`\n  ⚠️  "${row.title?.slice(0, 50)}": ${rules.warnings.join('; ')}`);
      }

      ctx.seenHashes.add(row.content_hash);
      ctx.seenUrls.add(row.source_url);
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
  console.log(`Scraped: ${totalRaw}, kept: ${all.length}, rejected: ${rejectLog.length}`);
  console.log(`CSV → ${csvPath}`);

  if (rejectLog.length > 0) {
    const rejectPath = join(OUT_DIR, `rejects-${date}.txt`);
    const lines = rejectLog.map((r) =>
      `[${r.source}] "${(r.title || '').slice(0, 60)}"\n  → ${r.reasons.join('; ')}`
    );
    await writeFile(rejectPath, lines.join('\n\n'), 'utf8');
    console.log(`Rejects → ${rejectPath}`);
  }

  await upsertToSupabase(all);
}

async function upsertToSupabase(rows) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log('');
    console.log('Skipping Supabase upsert (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set).');
    return;
  }
  if (rows.length === 0) {
    console.log('');
    console.log('No rows to upsert.');
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('');
  console.log(`Upserting ${rows.length} rows to Supabase (onConflict=content_hash, ignoreDuplicates)...`);

  const BATCH_SIZE = 100;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('opportunities')
      .upsert(batch, { onConflict: 'content_hash', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error(`✗ batch ${i}-${i + batch.length}: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += data?.length || 0;
    }
  }

  const skipped = rows.length - inserted - failed;
  console.log(`Upsert done: ${inserted} new, ${skipped} duplicates skipped, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
