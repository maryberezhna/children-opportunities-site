// IndexNow: сказати Bing про нові сторінки, не чекаючи обходу.
//
// Марія, 05.10.2026: «як ростити присутність в AI». ChatGPT шукає через індекс
// Bing, і 96% нашого AI-трафіку приходить саме звідти. Можливість із дедлайном
// за два тижні не має сенсу, якщо її проіндексують через місяць.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, MAX_URLS, SITE, indexNowBody } from '../lib/indexnow.js';
import { urlsToSubmit } from '../scripts/indexnow.mjs';
import { TOPIC_LIST } from '../lib/topics.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Спільний ендпоінт роздає адреси всім учасникам протоколу, зокрема Яндексу.
// 02.10.2026 ми свідомо закрили сайт від пошуку рф — надсилати їм свої
// сторінки після цього було б дивно.
test('шлемо напряму в Bing, а не в спільний ендпоінт', () => {
  assert.match(INDEXNOW_ENDPOINT, /bing\.com/);
  assert.doesNotMatch(INDEXNOW_ENDPOINT, /api\.indexnow\.org/);
});

test('файл-ключ лежить на сайті й збігається з кодом', () => {
  const files = readdirSync(new URL('../public/', import.meta.url));
  const keyFile = files.find((f) => f === `${INDEXNOW_KEY}.txt`);
  assert.ok(keyFile, `немає public/${INDEXNOW_KEY}.txt — Bing відмовить без нього`);
  assert.equal(read(`public/${keyFile}`).trim(), INDEXNOW_KEY, 'вміст файлу має бути самим ключем');
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{8,128}$/, 'ключ має бути 8–128 знаків');
});

test('чужі адреси не надсилаємо', () => {
  assert.throws(() => indexNowBody(['https://evil.com/x']), /немає жодної адреси/);
  const body = indexNowBody([`${SITE}/o/a`, 'https://evil.com/x']);
  assert.deepEqual(body.urlList, [`${SITE}/o/a`]);
});

test('повтори прибираються', () => {
  assert.equal(indexNowBody([`${SITE}/o/a`, `${SITE}/o/a`]).urlList.length, 1);
});

test('тіло має все, чого вимагає протокол', () => {
  const b = indexNowBody([`${SITE}/o/a`]);
  for (const k of ['host', 'key', 'keyLocation', 'urlList']) assert.ok(b[k], `немає ${k}`);
  assert.equal(b.keyLocation, `${SITE}/${INDEXNOW_KEY}.txt`);
});

test('межа протоколу дотримана', () => {
  const many = Array.from({ length: MAX_URLS + 1 }, (_, i) => `${SITE}/o/${i}`);
  assert.throws(() => indexNowBody(many), /не більше/);
});

test('надсилаємо і свіжі можливості, і всі підбірки', () => {
  // Підбірки міняються щодня разом із записами, а власного сигналу «сторінка
  // оновилась» у них немає — тому вони йдуть завжди.
  const urls = urlsToSubmit([{ slug: 'nova' }], TOPIC_LIST);
  assert.ok(urls.includes(`${SITE}/o/nova`));
  assert.ok(urls.includes(SITE), 'головна має бути в списку');
  for (const t of TOPIC_LIST) {
    assert.ok(urls.includes(`${SITE}/${t.slug}`), `немає підбірки ${t.slug}`);
    if (t.en?.slug) assert.ok(urls.includes(`${SITE}/en/${t.en.slug}`), `немає англійської ${t.en.slug}`);
  }
});

test('без підтвердження нічого не надсилається', () => {
  const src = read('scripts/indexnow.mjs');
  assert.match(src, /CONFIRM !== 'SEND'/);
  const yml = read('.github/workflows/indexnow.yml');
  assert.match(yml, /schedule' && 'SEND'/, 'за розкладом має надсилати само');
});
