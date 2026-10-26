// Можливості в готовому тексті поста — перевірка перед публікацією (26.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractSlugs, linkProblems, checkPostLinks, formatProblems } from '../scripts/post-links.mjs';

const TEXT = `<b>Обміни</b>
1. <a href="https://dityam.com.ua/o/flex-global-2027-a1b2c3">FLEX</a>
2. <a href="https://dityam.com.ua/en/o/hmc-projects-002466?utm_source=x">HMC</a>
3. ще раз <a href="https://dityam.com.ua/o/flex-global-2027-a1b2c3">FLEX</a>
👉 <a href="https://dityam.com.ua/prohramy-obminu">Усі</a>`;

test('з тексту — лише унікальні slug-и можливостей, і з /en теж', () => {
  assert.deepEqual(extractSlugs(TEXT), ['flex-global-2027-a1b2c3', 'hmc-projects-002466']);
  assert.deepEqual(extractSlugs('без посилань'), []);
});

test('без мережі ловимо: немає в базі, не активна, дубль, минулий дедлайн', () => {
  const rows = [
    { slug: 'a', title: 'A', status: 'active', deadline: '2026-11-02' },
    { slug: 'b', title: 'B', status: 'closed' },
    { slug: 'c', title: 'C', status: 'active', canonical_slug: 'a' },
    { slug: 'd', title: 'D', status: 'active', deadline: '2026-10-25' },
  ];
  const p = linkProblems(['a', 'b', 'c', 'd', 'e'], rows, '2026-10-26');
  assert.deepEqual(p.map((x) => x.slug), ['b', 'c', 'd', 'e']);
  assert.match(p[0].why, /статус closed/);
  assert.match(p[2].why, /2026-10-25 уже минув/);
  assert.match(p[3].why, /немає в базі/);
});

function fakeDb(rows) {
  return { from: () => ({ select: () => ({ in: async () => ({ data: rows, error: null }) }) }) };
}

test('сторінку перевіряємо лише в тих, що пройшли базу; відсіяне перевіркою — теж проблема', async () => {
  const rows = [
    { id: '1', slug: 'flex-global-2027-a1b2c3', title: 'FLEX', status: 'active', deadline: '2026-10-27' },
    { id: '2', slug: 'hmc-projects-002466', title: 'HMC', status: 'active', deadline: '2026-11-02' },
  ];
  let asked = [];
  const verify = async (items) => {
    asked = items.map((r) => r.id);
    return { items: [items[0]], dropped: [{ row: items[1], why: 'ended/closed' }] };
  };
  const { slugs, problems } = await checkPostLinks(TEXT, { supabase: fakeDb(rows), verify, todayIso: '2026-10-26' });
  assert.equal(slugs.length, 2);
  assert.deepEqual(asked, ['1', '2']);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].slug, 'hmc-projects-002466');
  assert.match(formatProblems('content/telegram/obminy.html', problems), /Пост не пішов: content\/telegram\/obminy\.html[\s\S]*«HMC» — сторінка організатора: ended\/closed/);
});

test('помилку бази не ковтаємо', async () => {
  const db = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'timeout' } }) }) }) };
  await assert.rejects(checkPostLinks(TEXT, { supabase: db, verify: null, todayIso: '2026-10-26' }), /база не відповіла/);
});

test('усі шляхи готових текстів перевіряють можливості перед публікацією', () => {
  const plan = readFileSync('scripts/check-deadlines.mjs', 'utf8');
  const fileBranch = plan.slice(plan.indexOf("entry.kind === 'file'"));
  assert.match(fileBranch, /checkPostLinks\(text/);
  assert.match(readFileSync('scripts/post-message.mjs', 'utf8'), /checkPostLinks\(text, \{ supabase, verify: verifyBeforePost/);
  assert.match(readFileSync('app/api/cron/channel-scheduled/route.js', 'utf8'), /staleLinks\(supabase, item\)/);
});
