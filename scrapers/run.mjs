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

  console.log('');
  console.log(`Scraped: ${totalRaw}, kept (pre-URL-check): ${all.length}, rejected: ${rejectLog.length}`);

  const { live, dead } = await filterByUrlReachability(all);
  for (const d of dead) {
    rejectLog.push({ source: d.row.source || '', title: d.row.title, reasons: [d.reason] });
  }
  console.log(`URL check: ${live.length} live, ${dead.length} dead`);

  await mkdir(OUT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const csvPath = join(OUT_DIR, `opportunities-${date}.csv`);
  await writeFile(csvPath, toCsv(live), 'utf8');
  console.log(`CSV → ${csvPath}`);

  if (rejectLog.length > 0) {
    const rejectPath = join(OUT_DIR, `rejects-${date}.txt`);
    const lines = rejectLog.map((r) =>
      `[${r.source}] "${(r.title || '').slice(0, 60)}"\n  → ${r.reasons.join('; ')}`
    );
    await writeFile(rejectPath, lines.join('\n\n'), 'utf8');
    console.log(`Rejects → ${rejectPath}`);
  }

  await upsertToSupabase(live);
}

async function filterByUrlReachability(rows) {
  const CONCURRENCY = 12;
  const TIMEOUT_MS = 10000;
  const UA = 'Mozilla/5.0 (compatible; dityam-scraper/1.0; +https://dityam.com.ua)';

  const live = [];
  const dead = [];
  let done = 0;

  async function check(row) {
    const url = row.source_url;
    if (!url) {
      dead.push({ row, reason: 'no source_url' });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      // HEAD first; some servers reject HEAD, fallback to GET.
      let res;
      try {
        res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
        }
      } catch {
        // some hosts reject HEAD outright — try GET
        res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
      }
      clearTimeout(timer);
      const status = res.status;
      // 403 is usually bot-blocking, not real death — keep
      if (status === 403 || (status >= 200 && status < 400)) {
        live.push(row);
      } else {
        dead.push({ row, reason: `URL returned HTTP ${status}` });
      }
    } catch (err) {
      clearTimeout(timer);
      const reason = err.name === 'AbortError'
        ? 'URL request timed out'
        : `URL unreachable: ${(err.message || String(err)).slice(0, 100)}`;
      dead.push({ row, reason });
    } finally {
      done += 1;
      if (done % 30 === 0) console.log(`  URL check: ${done}/${rows.length}...`);
    }
  }

  const queue = [...rows];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      await check(item);
    }
  }));

  return { live, dead };
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
