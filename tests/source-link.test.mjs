// Чужі Telegram-канали не показуються на сайті (Марія, 27.09.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { isForeignTelegram, publicLink, publicSource } = await import('../lib/source-link.js');

test('дописи чужих каналів — чужі', () => {
  for (const u of [
    'https://t.me/Mozhlyvosti/10521',
    'https://t.me/tviyspace/11844',
    'https://t.me/s/grantovyphishky/8881',
    'http://telegram.me/youth_Ukraine/2119',
    'https://t.me/+AbCdEf123',
    'https://t.me/joinchat/XYZ',
    'tg://resolve?domain=Mozhlyvosti',
    'https://www.t.me/lcnpubd/2622',
  ]) assert.equal(isForeignTelegram(u), true, u);
});

test('наш канал і бот — свої', () => {
  assert.equal(isForeignTelegram('https://t.me/dityam_com_ua'), false);
  assert.equal(isForeignTelegram('https://t.me/dityam_com_ua/512'), false);
  assert.equal(isForeignTelegram('https://t.me/DityamPlusBot?start=site'), false);
});

test('звичайні сайти й порожнє — не Telegram', () => {
  for (const u of ['https://man.gov.ua/x', 'https://forms.gle/abc', 'https://t.mex.com/a', '', null, undefined, 'не адреса']) {
    assert.equal(isForeignTelegram(u), false, String(u));
  }
});

test('publicLink ховає лише чужий Telegram', () => {
  assert.equal(publicLink('https://t.me/tviyspace/1'), null);
  assert.equal(publicLink('https://man.gov.ua/x'), 'https://man.gov.ua/x');
  assert.equal(publicLink(null), null);
});

test('допис чужого каналу + форма: кнопка веде на форму, ні назви, ні лінка каналу', () => {
  const r = publicSource({
    source: 'Твій космос можливостей',
    source_url: 'https://t.me/tviyspace/11797',
    apply_url: 'https://forms.gle/1uvoZqQJCMc7pztHA',
  });
  assert.equal(r.sourceUrl, null);
  assert.equal(r.sourceName, null);
  assert.equal(r.applyUrl, 'https://forms.gle/1uvoZqQJCMc7pztHA');
  assert.equal(r.primaryUrl, 'https://forms.gle/1uvoZqQJCMc7pztHA');
});

test('лише допис чужого каналу — показати нічого', () => {
  const r = publicSource({ source: 'Можливості', source_url: 'https://t.me/Mozhlyvosti/10521', apply_url: null });
  assert.deepEqual(r, { sourceUrl: null, sourceName: null, applyUrl: null, primaryUrl: null });
});

test('звичайний запис — як і був', () => {
  const r = publicSource({ source: 'МАН', source_url: 'https://man.gov.ua/p', apply_url: 'https://man.gov.ua/p' });
  assert.equal(r.sourceUrl, 'https://man.gov.ua/p');
  assert.equal(r.sourceName, 'МАН');
  assert.equal(r.applyUrl, null);          // збігається з джерелом — другої кнопки не треба
  assert.equal(r.primaryUrl, 'https://man.gov.ua/p');
});

// 28.09.2026: допис уже замінено сторінкою організатора, а назва каналу
// лишилась — «Джерело: Можливості ↗» з лінком на ninjaschool.io (11 сторінок).
test('назва каналу-переказувача не показується й з лінком на організатора', () => {
  const r = publicSource({ source: 'Можливості', source_url: 'https://www.ninjaschool.io/', apply_url: null });
  assert.equal(r.sourceName, null);
  assert.equal(r.sourceUrl, 'https://www.ninjaschool.io/');
  assert.equal(r.primaryUrl, 'https://www.ninjaschool.io/');
  // У картці тематичної сторінки source_url немає — ховаємо за самою назвою.
  assert.equal(publicSource({ source: 'Нова школа' }).sourceName, null);
});

test('канал самої організації — назва лишається', () => {
  const r = publicSource({ source: 'UNICEF Ukraine', source_url: 'https://www.unicef.org/ukraine/x' });
  assert.equal(r.sourceName, 'UNICEF Ukraine');
});

// Кожен канал, який читає скрапер, має рішення: переказувач чи організація.
// Інакше новий агрегатор мовчки світитиме своєю назвою на сайті.
const ORGANIZER_CHANNELS = new Set([
  'UNICEF Ukraine', 'FLEX Alumni Ukraine', 'EducationUSA Ukraine',
  'Goethe-Institut Ukraine', 'Українська волонтерська служба',
]);

test('кожен канал зі скрапера — або переказувач, або організація', async () => {
  const { readFile } = await import('node:fs/promises');
  const { RETELLING_CHANNELS } = await import('../lib/source-link.js');
  const py = await readFile(new URL('../scraper/scrapers/telegram_web.py', import.meta.url), 'utf8');
  const block = py.slice(py.indexOf('CHANNELS: list'), py.indexOf(']\n', py.indexOf('CHANNELS: list')));
  const names = [...block.matchAll(/\(\s*"[^"]+",\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
  assert.ok(names.length >= 10, `розібрано каналів: ${names.length}`);
  for (const n of names) {
    assert.ok(RETELLING_CHANNELS.has(n) || ORGANIZER_CHANNELS.has(n), `канал «${n}» без рішення`);
  }
});
