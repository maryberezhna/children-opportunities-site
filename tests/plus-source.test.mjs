// Звідки прийшла людина з каналу (25.09.2026).
//
// Пости вели на сторінку /plus: із поста треба було відкрити сайт, знайти там
// кнопку й аж тоді дійти до бота. Тепер посилання веде прямо в бот, а мітка
// `from_<звідки>` каже, який формат поста привів.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceArg, plusFromUrl, plusBotUrl } from '../lib/plus.js';

test('посилання з поста веде в бот, а не на сайт', () => {
  const url = plusFromUrl('channel_new');
  assert.equal(url, 'https://t.me/DityamPlusBot?start=from_channel_new');
  assert.ok(!url.includes('dityam.com.ua'), 'жодного проміжного кроку через сайт');
});

test('мітка читається назад', () => {
  assert.equal(parseSourceArg('from_channel_new'), 'channel_new');
  assert.equal(parseSourceArg('from_channel_deadlines'), 'channel_deadlines');
  assert.equal(parseSourceArg('FROM_Channel_Topic'), 'channel_topic');
});

test('не мітка — нічого не вигадуємо', () => {
  // Промокод має власний префікс і роздає знижку — його не можна сплутати.
  assert.equal(parseSourceArg('promo_first_kanal'), null);
  // Токен зі сторінки прив'язує вже створений профіль.
  assert.equal(parseSourceArg('6f84245a-1e17-44a3-9f69-6dc33f16918a'), null);
  assert.equal(parseSourceArg('waitlist'), null);
  assert.equal(parseSourceArg(''), null);
  assert.equal(parseSourceArg(undefined), null);
});

test('звичайний вхід із сайту лишається як був', () => {
  assert.equal(plusBotUrl('site'), 'https://t.me/DityamPlusBot?start=site');
});
