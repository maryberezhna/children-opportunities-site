// «Звідки прийшли» на /admin/plus і subscribe_click з підказки та блоку на
// сторінці можливості (27.09.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countBySource, sourceLabel, NO_SOURCE } from '../lib/plusSources.js';
import { plusFromUrl, parseSourceArg } from '../lib/plus.js';

const root = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(join(root, f), 'utf8');

test('мітка → людська назва; незнайома — як є, канал — за префіксом', () => {
  assert.equal(sourceLabel('deadlines_calendar'), 'Сайт · /dedlainy');
  assert.equal(sourceLabel('channel_deadlines'), 'Канал · пост про дедлайни');
  assert.equal(sourceLabel('channel_story'), 'Канал · story');
  assert.equal(sourceLabel('somewhere_else'), 'somewhere_else');
  assert.equal(sourceLabel(null), NO_SOURCE);
  assert.equal(sourceLabel(''), NO_SOURCE);
});

test('кожна мітка, яку ставить сайт, має назву і читається ботом', () => {
  for (const place of ['plus_uk', 'plus_en', 'plus_form_uk', 'plus_form_en', 'plus_choice', 'deadlines_calendar']) {
    assert.equal(parseSourceArg(new URL(plusFromUrl(place)).searchParams.get('start')), place);
    assert.notEqual(sourceLabel(place), place, `мітка «${place}» без назви в lib/plusSources.js`);
  }
});

test('почали й активні за міткою; «без мітки» — останнім', () => {
  const rows = countBySource([
    { source: null, status: 'active' },
    { source: null, status: 'pending' },
    { source: 'channel_topic', status: 'pending' },
    { source: 'deadlines_calendar', status: 'active' },
    { source: 'deadlines_calendar', status: 'paused' },
    { source: 'deadlines_calendar', status: 'pending' },
  ]);
  assert.deepEqual(rows.map((r) => [r.source, r.started, r.active]), [
    ['deadlines_calendar', 3, 1],
    ['channel_topic', 1, 0],
    [null, 2, 1],
  ]);
  assert.equal(rows[2].label, NO_SOURCE);
});

test('порожньо — порожньо', () => {
  assert.deepEqual(countBySource([]), []);
  assert.deepEqual(countBySource(undefined), []);
});

test('адмінка бере source у вибірці підписників', () => {
  const src = read('app/admin/plus/page.js');
  assert.match(src, /from\('digest_subscribers'\)\s*\n?\s*\.select\('[^']*\bsource\b/);
  assert.ok(src.includes('countBySource(subs)'));
});

test('підказка й блок каналу на сторінці можливості шлють subscribe_click', () => {
  const popup = read('app/SubscribePopup.js');
  assert.match(popup, /trackSubscribeClick\(\{ target: 'channel', placement: 'popup' \}\)/);
  // Стара подія лишається: на ній звіти до 27.09.2026 і конверсія Ads.
  assert.ok(popup.includes("'telegram_join_click'"));

  const block = read('app/TelegramSubscribeBlock.js');
  assert.ok(block.includes("detail_page: 'opportunity_block'"));
  assert.ok(block.includes('trackSubscribeClick('));
  assert.ok(block.includes("'telegram_join_click'"));
});
