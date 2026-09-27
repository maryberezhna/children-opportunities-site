// «Сходинка»: сайт → канал → Dityam+ (рішення Марії 27.09.2026).
//
// До того на одній підбірці людина бачила до дев'яти закликів у пʼять різних
// місць, а Dityam+ був одночасно «Оформити», «Дізнатися першим» і «скоро,
// стати в список». Тепер головний заклик сайту — канал, а Dityam+ на сайті
// лишився в шапці, на /plus і на /dedlainy. Продає його сам канал.
//
// Тест стереже, щоб Dityam+ тихо не повернувся в списки, картки й підказку —
// блоки промо вже раз додавали й прибирали в паралельних сесіях.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseSourceArg, plusFromUrl } from '../lib/plus.js';
import { CHANNEL_CTA } from '../lib/social.js';

const root = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(join(root, f), 'utf8');

// Місця, де людина гортає або читає можливість: тут веде лише канал.
const CHANNEL_ONLY = [
  'app/OpportunitiesList.js',
  'app/topic/TopicCards.js',
  'app/TopicPage.js',
  'app/o/shared.js',
  'app/SubscribePopup.js',
  'app/StickyBar.js',
  'app/HomeBlocks.js',
  'app/TelegramCard.js',
  'app/TelegramSubscribeBlock.js',
];

const PLUS_LINK = [
  /['"`]\/(en\/)?plus['"`]/,
  /\bplusBotUrl\b/,
  /\bplusFromUrl\b/,
  /\bPLUS_WAITLIST_URL\b/,
  /DityamPlusBot/,
  /\bPlusSection\b/,
  /\bPlusBanner\b/,
];

for (const file of CHANNEL_ONLY) {
  test(`${file}: жодного посилання на Dityam+ — тут веде лише канал`, () => {
    const src = read(file);
    for (const re of PLUS_LINK) {
      assert.ok(!re.test(src), `${file} знову веде в Dityam+ (${re}) — див. рішення 27.09.2026`);
    }
  });
}

test('блоку PlusSection більше немає', () => {
  assert.ok(!existsSync(join(root, 'app/PlusSection.js')));
});

test('усі заклики до каналу говорять тими самими словами', () => {
  for (const file of ['app/TelegramCard.js', 'app/TelegramSubscribeBlock.js', 'app/HomeBlocks.js', 'app/SubscribePopup.js']) {
    assert.ok(read(file).includes('CHANNEL_CTA'), `${file} має брати текст із CHANNEL_CTA (lib/social.js)`);
  }
  for (const lang of ['uk', 'en']) {
    for (const key of ['title', 'text', 'short', 'cta']) {
      assert.ok(CHANNEL_CTA[lang]?.[key], `CHANNEL_CTA.${lang}.${key} порожній`);
    }
  }
});

// Коментарі згадують старі формулювання як історію — перевіряємо лише код.
const code = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

test('жодних обіцянок, що вже неправда: «без реклами», «один пост на день»', () => {
  const all = JSON.stringify(CHANNEL_CTA)
    + ['app/HomeBlocks.js', 'app/TelegramCard.js', 'app/TelegramSubscribeBlock.js', 'app/SubscribePopup.js']
      .map((f) => code(read(f))).join('\n');
  for (const bad of [/без реклами/i, /no ads/i, /один пост/i, /раз на день/i, /одне повідомлення на день/i]) {
    assert.ok(!bad.test(all), `знову ${bad}`);
  }
});

// Бот зберігає джерело лише з мітки `from_<звідки>` (parseSourceArg). До
// 27.09.2026 сайт ставив голі мітки (`plus_uk`, `slot_0`, `deadlines_calendar`)
// — і в усіх пʼяти людей, що відкрили анкету, джерело лишилось порожнім.
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test('посилання з сайту в бот несуть мітку, яку бот записує', () => {
  const pages = walk(join(root, 'app'))
    .filter((p) => p.endsWith('.js'))
    .filter((p) => !/\/app\/(api|admin)\//.test(p));
  const bare = pages.filter((p) => /\bplusBotUrl\(/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(bare.map((p) => p.slice(root.length)), [], 'на сайті — plusFromUrl, а не plusBotUrl');

  for (const place of ['plus_uk', 'plus_en', 'plus_form_uk', 'plus_form_en', 'plus_choice', 'deadlines_calendar']) {
    const arg = new URL(plusFromUrl(place)).searchParams.get('start');
    assert.equal(parseSourceArg(arg), place, `мітку «${place}» бот не прочитає`);
  }
});
