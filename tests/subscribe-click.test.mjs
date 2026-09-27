// «Підписались із сайту» Марія рахує подією subscribe_click (27.09.2026).
// Тест стереже її форму — зміна назви параметра тихо обнулила б звіт — і
// дорогу slug підбірки від сторінки до картки каналу.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { subscribeClickParams, trackSubscribeClick } from '../lib/track.js';
import { TOPIC_LIST } from '../lib/topics.js';

const root = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(join(root, f), 'utf8');

test('картка в підбірці: target, placement, hub — і те саме в event_label', () => {
  assert.deepEqual(
    subscribeClickParams({ target: 'channel', placement: 'hub_inline', hub: 'konkursy' }),
    { target: 'channel', placement: 'hub_inline', hub: 'konkursy', event_label: 'hub_inline:konkursy' },
  );
});

test('картка на головній і в містах: без hub', () => {
  assert.deepEqual(
    subscribeClickParams({ target: 'channel', placement: 'catalog_inline', hub: null }),
    { target: 'channel', placement: 'catalog_inline', event_label: 'catalog_inline' },
  );
});

test('подія доходить у gtag під назвою subscribe_click', () => {
  const calls = [];
  globalThis.window = { gtag: (...args) => calls.push(args) };
  try {
    trackSubscribeClick({ target: 'channel', placement: 'hub_inline', hub: 'prohramy-obminu' });
  } finally {
    delete globalThis.window;
  }
  const [event] = calls.filter(([kind, name]) => kind === 'event' && name === 'subscribe_click');
  assert.ok(event, 'subscribe_click не надіслано');
  assert.equal(event[2].target, 'channel');
  assert.equal(event[2].placement, 'hub_inline');
  assert.equal(event[2].hub, 'prohramy-obminu');
});

test('slug підбірки доходить до картки каналу', () => {
  assert.match(read('app/TopicPage.js'), /<TopicCards[\s\S]*?hub=\{topic\.slug\}/);
  assert.match(read('app/topic/TopicCards.js'), /<TelegramCard[^>]*hub=\{hub\}/);
  // Кожна підбірка має slug — інакше hub прийде порожнім.
  for (const t of TOPIC_LIST) assert.ok(t.slug, 'підбірка без slug');
});

test('картка шле і нову подію, і стару telegram_join_click', () => {
  const src = read('app/TelegramCard.js');
  assert.ok(src.includes('trackSubscribeClick('), 'немає subscribe_click');
  assert.ok(src.includes("'telegram_join_click'"), 'зникла telegram_join_click — старі звіти перестануть порівнюватись');
  assert.ok(src.includes("'hub_inline'"));
});

test('заголовок картки — не h-тег: у списку h3 — назви можливостей', () => {
  assert.ok(!/<h[1-6][\s>]/.test(read('app/TelegramCard.js')));
});
