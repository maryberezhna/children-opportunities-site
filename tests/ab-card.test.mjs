import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AB_CARD_COOKIE, AB_CARD_MAX_AGE, AB_CARD_BOOT_SCRIPT, AB_CARD_MODE,
  abCardFromCookie, abCardFromSearch, abCardForRequest, pickAbCard,
} from '../lib/ab-card.js';
import { whenLabel, costLabel, formatPlace, organiserName, cardFacts, shortDate } from '../lib/card-facts.js';

// A/B-тест картки (29.09.2026): варіант живе в cookie ab_card, застосовується
// в браузері атрибутом data-ab-card на <html>, різницю робить CSS.
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('варіант читається з cookie і з адреси, будь-що інше — null', () => {
  assert.equal(abCardFromCookie('dityam_lang=uk; ab_card=B; x=1'), 'B');
  assert.equal(abCardFromCookie('ab_card=A'), 'A');
  assert.equal(abCardFromCookie('ab_card=C'), null);
  assert.equal(abCardFromCookie('xab_card=B'), null);
  assert.equal(abCardFromCookie(''), null);
  assert.equal(abCardFromSearch('?ab_card=B'), 'B');
  assert.equal(abCardFromSearch('?q=табір&ab_card=A'), 'A');
  assert.equal(abCardFromSearch('?ab_card=b'), null);
  assert.equal(abCardFromSearch(''), null);
});

test('завантажувач: та сама cookie, той самий термін, розбирається як JS', () => {
  assert.ok(AB_CARD_BOOT_SCRIPT.includes(`${AB_CARD_COOKIE}=`), 'скрипт читає іншу cookie');
  assert.ok(AB_CARD_BOOT_SCRIPT.includes(`max-age=${AB_CARD_MAX_AGE}`), 'термін cookie розійшовся з константою');
  assert.ok(AB_CARD_BOOT_SCRIPT.includes("setAttribute('data-ab-card','B')"));
  // Компілюється без винятку (як analytics-scope перевіряє свою регулярку).
  assert.doesNotThrow(() => new Function(AB_CARD_BOOT_SCRIPT));
});

test('скрипт стоїть першим у <body>, а CSS і картка знають той самий атрибут', () => {
  const layout = read('app/layout.js');
  assert.ok(layout.includes('AB_CARD_BOOT_SCRIPT'), 'layout.js не вставляє завантажувач варіанта');
  assert.ok(/<body>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<script dangerouslySetInnerHTML=\{\{ __html: AB_CARD_BOOT_SCRIPT \}\}/.test(layout),
    'завантажувач має бути першим у <body>, інакше картка стрибає між варіантами');
  assert.ok(layout.includes('suppressHydrationWarning'), 'без suppressHydrationWarning React у dev скаржиться на атрибут');
  const css = read('app/styles/cards.css');
  assert.ok(css.includes('html[data-ab-card="B"]'), 'cards.css не знає варіанта B');
  const card = read('app/OpportunityCard.js');
  for (const cls of ['chip-cost', 'chip-when', 'className="meta"', 'card-b-line', 'card-b-foot', 'card-more card-a', 'card-more card-b']) {
    assert.ok(card.includes(cls), `у картці немає «${cls}» — CSS варіанта B не має за що зачепитись`);
  }
  // Клас «card» лишається: на нього дивляться card_click і підказка каналу.
  assert.ok(card.includes('className="card"'));
});

test('підбірки й «схожі» віддають картці вартість і джерело', () => {
  const topic = read('app/TopicPage.js');
  assert.ok(/cost_type: o\.cost_type/.test(topic), 'slim() у TopicPage не передає cost_type — рядок «Вартість» порожній');
  assert.ok(/source_url: o\.source_url/.test(topic), 'slim() не передає source_url — чужий канал не відсіється');
  const shared = read('app/o/shared.js');
  const related = (shared.match(/const RELATED_FIELDS =[\s\S]*?;/) || [''])[0];
  for (const f of ['source', 'source_url', 'format', 'cities', 'timing_kind']) {
    assert.ok(new RegExp(`\\b${f}\\b`).test(related), `RELATED_FIELDS без ${f}`);
  }
});

// ── lib/card-facts.js ──────────────────────────────────────────────────────
const today = '2026-09-29';

test('дедлайн: до 7 днів горить, до 30 — з лічильником, далі лише дата', () => {
  assert.deepEqual(whenLabel({ deadline: '2026-10-03' }, today), {
    label: 'Дедлайн', kind: 'urgent', text: '3 жовт · 4 дні', foot: 'До 3 жовт · 4 дні',
  });
  assert.equal(whenLabel({ deadline: '2026-09-29' }, today).text, '29 вер · сьогодні');
  assert.equal(whenLabel({ deadline: '2026-09-30' }, today).text, '30 вер · завтра');
  assert.equal(whenLabel({ deadline: '2026-10-15' }, today).kind, 'soon');
  assert.equal(whenLabel({ deadline: '2026-10-15' }, today).text, '15 жовт · 16 днів');
  const far = whenLabel({ deadline: '2027-02-01' }, today);
  assert.deepEqual(far, { label: 'Дедлайн', kind: 'calm', text: '1 лют 2027', foot: 'До 1 лют 2027' });
  assert.equal(whenLabel({ deadline: '2026-10-03' }, today, 'en').text, '3 Oct · 4 days');
});

test('подія без дедлайну — «Коли», а без дат і виду — нічого не вигадуємо', () => {
  assert.deepEqual(whenLabel({ event_start_date: '2026-11-06', event_end_date: '2026-11-08' }, today), {
    label: 'Коли', kind: 'event', text: '6 лист', foot: '6 лист',
  });
  assert.equal(whenLabel({ event_start_date: '2026-09-28', event_end_date: '2026-10-02' }, today).text, 'триває');
  assert.equal(whenLabel({ timing_kind: 'periodic' }, today).text, 'щорічно');
  assert.equal(whenLabel({ timing_kind: 'permanent' }, today).text, 'набір відкритий');
  assert.equal(whenLabel({ opportunity_type: 'course' }, today), null);
  // Минулий дедлайн — не «дедлайн», а нічого: такі записи каталог ховає.
  assert.equal(whenLabel({ opportunity_type: 'course', deadline: '2026-09-01' }, today), null);
});

test('жодних емодзі в текстах варіанта B (бренд-кіт: єдина емодзі — 🧡)', () => {
  const texts = [
    whenLabel({ deadline: '2026-10-03' }, today),
    whenLabel({ event_start_date: '2026-11-06' }, today),
    whenLabel({ timing_kind: 'periodic' }, today),
    whenLabel({ results_date: '2026-12-01' }, today),
  ].flatMap((w) => [w.text, w.foot, w.label]);
  for (const s of texts) assert.doesNotMatch(s, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, `емодзі у «${s}»`);
});

test('вартість: два слова й «уточнюйте в школі», без порогів ціни', () => {
  assert.equal(costLabel({ cost_type: 'free' }), 'Безкоштовно');
  assert.equal(costLabel({ cost_type: 'paid_affordable' }), 'Платно');
  assert.equal(costLabel({ cost_type: 'paid_premium' }), 'Платно');
  assert.equal(costLabel({ cost_type: 'ask_school' }), 'Вартість уточнюйте в школі');
  assert.equal(costLabel({ cost_type: 'paid_premium' }, 'en'), 'Paid');
  assert.equal(costLabel({}), null);
});

test('формат · місце — та сама логіка, що в каталозі', () => {
  assert.equal(formatPlace({ format: 'онлайн', cities: ['Онлайн'] }), 'Онлайн');
  assert.equal(formatPlace({ format: 'офлайн', cities: ['Київ'], countries: ['ua'] }), 'На місці · Київ');
  assert.equal(formatPlace({ format: 'онлайн', cities: ['Львів'], countries: ['ua'] }), 'Онлайн · Львів');
  assert.equal(formatPlace({ format: 'offline', cities: ['Вся Україна'] }), 'На місці · Вся Україна');
  // Псевдомісто «Онлайн» не дописується до формату, який уже каже «онлайн».
  assert.equal(formatPlace({ format: 'гібрид', cities: ['Онлайн', 'Вся Україна'] }), 'Онлайн і на місці · Вся Україна');
  assert.equal(formatPlace({ cities: ['Онлайн'] }), 'Онлайн');
  assert.equal(formatPlace({ format: 'офлайн', cities: ['Прага'], countries: ['cz'] }), 'На місці · Прага, Чехія');
  // Виплатам формат не показуємо (lib/labels.js) — лишається місто.
  assert.equal(formatPlace({ opportunity_type: 'allowance', format: 'онлайн', cities: ['Київ'], countries: ['ua'] }), 'Київ');
  assert.equal(formatPlace({ format: 'club' }), null);
});

test('організатор: чужий Telegram-канал і переказувачі ховаються', () => {
  assert.equal(organiserName({ source: 'МАН України', source_url: 'https://man.gov.ua/x' }), 'МАН України');
  assert.equal(organiserName({ source: 'Можливості', source_url: 'https://man.gov.ua/x' }), null);
  assert.equal(organiserName({ source: 'Якийсь канал', source_url: 'https://t.me/somechannel/12' }), null);
  assert.equal(organiserName({}), null);
});

test('cardFacts: порожні поля — null, а не заглушки', () => {
  const f = cardFacts({ opportunity_type: 'course' }, today);
  assert.deepEqual(f, { when: null, cost: null, format: null, organiser: null });
  assert.equal(shortDate('2026-10-03', today), '3 жовт');
  assert.equal(shortDate('2027-10-03', today), '3 жовт 2027');
  assert.equal(shortDate(null, today), null);
});

// ── Розподіл 50/50 (middleware.js) ─────────────────────────────────────────
test('жереб дає рівно A або B', () => {
  assert.equal(pickAbCard(() => 0.1), 'A');
  assert.equal(pickAbCard(() => 0.9), 'B');
  const seen = new Set(Array.from({ length: 200 }, () => pickAbCard()));
  assert.deepEqual([...seen].sort(), ['A', 'B']);
});

test('cookie є — варіант сталий і не переставляється', () => {
  assert.deepEqual(abCardForRequest({ cookie: 'ab_card=B', mode: 'split' }), { variant: 'B', set: false });
  assert.deepEqual(abCardForRequest({ cookie: 'dityam_lang=uk; ab_card=A', mode: 'split' }), { variant: 'A', set: false });
});

test('новому відвідувачу — жереб і cookie; боту — A без cookie', () => {
  assert.deepEqual(abCardForRequest({ mode: 'split', random: () => 0.9 }), { variant: 'B', set: true });
  assert.deepEqual(abCardForRequest({ mode: 'split', random: () => 0.1 }), { variant: 'A', set: true });
  assert.deepEqual(abCardForRequest({ mode: 'split', isBot: true }), { variant: 'A', set: false });
});

test('?ab_card= в адресі — явний вибір понад усе', () => {
  assert.deepEqual(abCardForRequest({ cookie: 'ab_card=A', search: '?ab_card=B', mode: 'split' }), { variant: 'B', set: true });
  assert.deepEqual(abCardForRequest({ search: '?x=1&ab_card=A', isBot: true, mode: 'split' }), { variant: 'A', set: true });
});

test('вимикач: режим A чи B переставляє cookie всім', () => {
  assert.deepEqual(abCardForRequest({ cookie: 'ab_card=B', mode: 'A' }), { variant: 'A', set: true });
  assert.deepEqual(abCardForRequest({ cookie: 'ab_card=A', mode: 'A' }), { variant: 'A', set: false });
  assert.deepEqual(abCardForRequest({ mode: 'B', isBot: true }), { variant: 'B', set: true });
  assert.ok(['split', 'A', 'B'].includes(AB_CARD_MODE));
});

test('middleware ставить cookie через abCardForRequest, а події GA4 несуть ab_card', () => {
  const mw = read('middleware.js');
  assert.ok(mw.includes('abCardForRequest('), 'middleware не розподіляє варіант');
  assert.ok(mw.includes('res.cookies.set(AB_CARD_COOKIE'), 'middleware не ставить cookie ab_card');
  assert.ok(/isBot: BOTS\.test/.test(mw), 'боти мають лишатись без cookie');
  const track = read('lib/track.js');
  for (const ev of ["'event', name, withAbCard(", "'card_click', withAbCard(", "'filter_apply', withAbCard(", "'search', withAbCard("]) {
    assert.ok(track.includes(ev), `у lib/track.js подія без ab_card: ${ev}`);
  }
  const analytics = read('app/Analytics.js');
  assert.ok(/gtag\('set', 'user_properties', \{\s*ab_card:/.test(analytics), 'user property ab_card не ставиться');
  assert.ok(analytics.indexOf("'user_properties'") < analytics.indexOf("gtag('config', '${GA_ID}')"),
    'user property має стояти до config, інакше перший page_view без варіанта');
});
