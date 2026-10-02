// Пошук рф і білорусі закритий (Марія, 02.10.2026: «закрий сайт для пошуку з
// росії і білорусі»). У Semrush сайт стояв на 18 ключових словах у базі RU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRuSearchBot, RU_SEARCH_AGENTS } from '../lib/ru-search.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('їхні роботи впізнаються', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (compatible; YandexImages/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (compatible; YandexVideo/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (compatible; Linux x86_64; Mail.RU_Bot/2.0; +http://go.mail.ru/help/robots)',
    'StackRambler/2.0',
    'SputnikBot/2.3',
  ]) assert.equal(isRuSearchBot(ua), true, ua);
});

// Найважливіше: це робот, а не людина. Яндекс-браузером користуються живі
// люди, зокрема українці за кордоном — їх блокувати ми не збирались.
test('Яндекс-браузер живої людини не чіпаємо', () => {
  for (const ua of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 YaBrowser/23.11.0.2074 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/118 YaBrowser/23.11.3.86.00 SA/3 Mobile Safari/537.36',
  ]) assert.equal(isRuSearchBot(ua), false, ua);
});

test('чужих пошуковиків і людей не зачіпає', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
    'GPTBot/1.0',
    '',
    null,
  ]) assert.equal(isRuSearchBot(ua), false, String(ua));
});

// --- обидва шари мають бути підключені ---
//
// robots.txt — саме за ним Яндекс прибирає сторінки з індексу (їхній
// документований спосіб деіндексації). Відмова на вході — щоб правило діяло й
// тоді, коли robots.txt зігнорували. Одного шару мало: перший сам по собі
// лише просить, другий сам по собі лишає сайт у видачі.
test('robots.txt забороняє їм усе', () => {
  const src = read('app/robots.js');
  assert.match(src, /RU_SEARCH_AGENTS/, 'robots.txt не знає про цей перелік');
  assert.match(src, /disallow: '\/'/, 'немає повної заборони');
});

test('вхід відмовляє їм до всього іншого', () => {
  const src = read('middleware.js');
  assert.match(src, /isRuSearchBot\(/, 'middleware не перевіряє');
  // Перевірка мусить стояти ПЕРЕД захистом від копіювання: інакше правила
  // сперечаються за той самий запит.
  assert.ok(src.indexOf('isRuSearchBot(') < src.indexOf('shouldBlock('),
    'перевірка стоїть після захисту від копіювання');
});

test('яндекса більше немає серед завжди дозволених', () => {
  // Доти lib/bot-guard.js пропускав його безумовно, і два правила сперечались би.
  assert.doesNotMatch(read('lib/bot-guard.js').match(/const ALLOW = [^;]+;/)[0], /yandex/i);
});

test('robots.txt лишається відкритим для них', () => {
  // Інакше робот не прочитає заборону й не дізнається, що йому йти.
  assert.match(read('middleware.js'), /robots\\\\\.txt/, 'robots.txt має бути поза matcher');
});

test('перелік для robots.txt не порожній і покриває Яндекс одним рядком', () => {
  assert.ok(RU_SEARCH_AGENTS.includes('Yandex'));
  assert.ok(RU_SEARCH_AGENTS.length >= 3);
});
