import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { affectsSite, decide } from '../scripts/vercel-ignore-build.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

test('скрапери, міграції, воркфлоу, тести й документація збірки не запускають', () => {
  for (const path of [
    'scraper/normalizer.py',
    'supabase/migrations/20260920_source_categories.sql',
    '.github/workflows/deploy-alert.yml',
    'tests/timing.test.mjs',
    'scripts/morning-brief.mjs',
    'scripts/telegram-bot.README.md',
    'CLAUDE.md',
    'README.md',
  ]) assert.equal(affectsSite(path), false, path);
});

test('сайт, залежності й скрипти, без яких він не збереться, — збирати', () => {
  for (const path of [
    'app/o/shared.js',
    'lib/supabase.js',
    'public/robots.txt',
    'content/telegram/obminy.html',
    'package.json',
    'package-lock.json',
    'next.config.js',
    'middleware.js',
    'vercel.json',
    'scripts/check-catalogue-queries.mjs',
    'scripts/channel-plan.mjs',
    'scripts/vercel-ignore-build.mjs',
    // Незнайомий шлях — теж збирати: помилитись у бік зайвої збірки дешевше.
    'something-new/file.js',
  ]) assert.equal(affectsSite(path), true, path);
});

test('рішення: пропускаємо лише коли жоден файл не чіпає сайт', () => {
  assert.equal(decide(['scraper/hubs.py', 'tests/timing.test.mjs']).code, 0);
  assert.equal(decide(['scraper/hubs.py', 'app/page.js']).code, 1);
  // Порожній diff — це ручний Redeploy: людина хоче збірку.
  assert.equal(decide([]).code, 1);
  // Примусова збірка з коміту.
  assert.equal(decide(['scraper/hubs.py'], 'fix: щось [build]').code, 1);
});

// ── Інваріант: усе, від чого залежить збірка, класифіковано як «сайт» ────────
//
// Якщо app/ чи lib/ почне імпортувати файл зі scripts/ (як app/admin/today
// імпортує scripts/channel-plan.mjs), а в SITE_SCRIPTS його немає, зміна цього
// файлу пройде без збірки — і на проді лишиться стара версія.

const CODE = /\.(m?js|jsx|tsx?)$/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (CODE.test(name)) out.push(full);
  }
  return out;
}

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else return null; // пакет із node_modules
  for (const cand of [base, `${base}.js`, `${base}.mjs`, `${base}.jsx`, join(base, 'index.js')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

test('усі файли, які імпортує сайт, збірку запускають', () => {
  const entries = [
    ...walk(join(ROOT, 'app')),
    ...walk(join(ROOT, 'lib')),
    join(ROOT, 'middleware.js'),
    join(ROOT, 'next.config.js'),
  ];
  const seen = new Set();
  const queue = [...entries];
  const offenders = [];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const rel = relative(ROOT, file);
    if (!affectsSite(rel)) offenders.push(rel);
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      const target = resolveImport(file, spec);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  assert.deepEqual(offenders, [], `допишіть у SITE_SCRIPTS (scripts/vercel-ignore-build.mjs): ${offenders.join(', ')}`);
});

test('скрипти збірки з package.json запускають збірку', () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const buildSteps = ['prebuild', 'build', 'postbuild'].map((k) => scripts[k]).filter(Boolean).join(' ');
  for (const [path] of buildSteps.matchAll(/[\w./-]+\.(?:m?js|sh)/g)) {
    assert.equal(affectsSite(path), true, `${path} потрібен збірці`);
  }
});

test('vercel.json справді вмикає цей скрипт', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(config.ignoreCommand, 'node scripts/vercel-ignore-build.mjs');
});
