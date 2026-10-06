// Попап олімпіади на фільтрі, статистика сторінки й дрібні правки 06.10.2026
// (Марія: «створи попап…, коли хтось вибирає підходящий фільтр для дитини»,
// «чітко трекай статистику на цій сторінці», «навіщо нам вік», «додай у
// хедері наші можливості», «дуже довго грузиться диплом»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { olimpFilterMatch, criteriaText, OPEN_TASK } from '../lib/olimpiada.js';
import { olimpSource, SITE_EVENT_NAMES } from '../lib/site-events.js';
import { olimpTraffic } from '../lib/olimpiada-stats.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('попап — на вік 7–11 або «Олімпіади» без віку, що виключає 9–11', () => {
  assert.equal(olimpFilterMatch({ age: ['7-11'] }), true);
  assert.equal(olimpFilterMatch({ age: ['4-6', '7-11'] }), true);
  assert.equal(olimpFilterMatch({ age: ['12-14'] }), false);
  assert.equal(olimpFilterMatch({ age: ['0-3'] }), false);
  assert.equal(olimpFilterMatch({ type: ['olympiad'] }), true);
  assert.equal(olimpFilterMatch({ type: ['olympiad'], age: ['15-17'] }), false);
  assert.equal(olimpFilterMatch({ type: ['camp'] }), false);
  assert.equal(olimpFilterMatch({}), false);
});

test('попап: лише після власного вибору людини, 1 раз, не підліткам і не в /en', () => {
  const list = read('app/OpportunitiesList.js');
  assert.match(list, /if \(prev === null \|\| !now \|\| prev\) return;/, 'перший прохід (фільтри з URL) пропускається');
  assert.match(list, /const now = !isEn && !teens && olimpFilterMatch\(\{ age, type \}\);/);
  assert.match(list, /<OlimpPopup open=\{olimpOpen\}/);
  const pop = read('app/OlimpPopup.js');
  assert.match(pop, /olimp_popup_seen/);
  assert.match(pop, /olimp_wait/, 'хто вже в списку очікування, попапу не бачить');
  assert.match(pop, /source: `popup-\$\{place\}`/);
});

test('звідки прийшли на сторінку: utm, свій шлях, чужий домен, напряму', () => {
  const host = 'dityam.com.ua';
  assert.equal(olimpSource({ search: '?utm_source=telegram', referrer: 'https://www.google.com/', host }), 'utm:telegram');
  assert.equal(olimpSource({ referrer: 'https://dityam.com.ua/olimpiady', host }), '/olimpiady');
  assert.equal(olimpSource({ referrer: 'https://dityam.com.ua/', host }), '/');
  assert.equal(olimpSource({ referrer: 'https://www.google.com/', host }), 'google.com');
  assert.equal(olimpSource({ referrer: '', host }), 'direct');
});

test('події олімпіади дозволені в /api/event і пишуть source', () => {
  for (const n of ['olimp_view', 'olimp_cta', 'olimp_top_click', 'olimp_popup_show', 'olimp_popup_more', 'olimp_popup_close']) {
    assert.ok(SITE_EVENT_NAMES.includes(n), n);
  }
  assert.match(read('app/api/event/route.js'), /insert\(source \? \{ name, source \} : \{ name \}\)/);
  assert.match(read('app/olimpiada/page.js'), /<OlimpTrack \/>/);
});

test('статистика: перегляди, кнопки, попап і email за джерелом', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const ev = (name, source, d) => ({ name, source, created_at: `2026-10-${d}T10:00:00Z` });
  const events = [
    ev('olimp_view', '/', '10'), ev('olimp_view', 'google.com', '09'), ev('olimp_view', '/', '01'),
    ev('olimp_cta', 'hero', '10'), ev('olimp_top_click', '/', '10'),
    ev('olimp_popup_show', 'home', '10'), ev('olimp_popup_show', 'home', '09'), ev('olimp_popup_more', 'home', '10'),
  ];
  const waitlist = [{ source: 'popup-home' }, { source: 'page' }, { source: null }, { source: 'telegram' }];
  const t = olimpTraffic({ events, waitlist, now });
  assert.equal(t.views, 3);
  assert.equal(t.views7, 2);
  assert.equal(t.views1, 1);
  assert.deepEqual(t.viewSources[0], ['/', 2]);
  assert.equal(t.cta, 1);
  assert.equal(t.top, 1);
  assert.equal(t.popupShow, 2);
  assert.equal(t.popupEmails, 1);
  assert.equal(t.pageEmails, 3);
  assert.equal(t.popupRate, 50);
  assert.equal(t.pageRate, 100);
  assert.match(read('app/admin/metrics/page.js'), /olimpTraffic\(/);
});

test('лічильники воронки — count-запитами, а не вибіркою рядків (межа 1000)', () => {
  const m = read('app/admin/metrics/page.js');
  assert.doesNotMatch(m, /from\('site_events'\)\.select\('name'\)/);
  assert.match(m, /count\(supabase, 'site_events', \(q\) => q\.eq\('name', 'visit'\)\)/);
});

test('віку дитини у формі немає; сервер його не вимагає', () => {
  const form = read('app/olimpiada/EntryForm.js');
  assert.doesNotMatch(form, /name="age"|Вік дитини/);
  assert.doesNotMatch(read('app/api/olimpiada/start/route.js'), /error: 'age'/);
});

test('у списку очікування без «1 лист, без розсилок»', () => {
  assert.ok(!read('app/olimpiada/EntryForm.js').includes('без розсилок'));
  assert.ok(!read('app/OlimpPopup.js').includes('без розсилок'));
});

test('шапка: «Наші можливості» з олімпіадою й Dityam+', () => {
  const h = read('app/Header.js');
  assert.match(h, /Наші можливості/);
  assert.match(h, /href: '\/olimpiada'/);
  assert.match(h, /href: '\/plus', label: 'Dityam\+'/);
});

test('критерії журі описані, а в тесті немає примітки про приз', () => {
  assert.equal(OPEN_TASK.criteria.length, 3);
  for (const c of OPEN_TASK.criteria) assert.ok(c.name && c.text.length > 20, c.name);
  assert.match(criteriaText(), /своя ідея — /);
  const runner = read('app/olimpiada/test/TestRunner.js');
  assert.doesNotMatch(runner, /На диплом воно не впливає/);
  assert.doesNotMatch(runner, /Саме воно вирішує/);
  assert.ok(!OPEN_TASK.text.includes('Напиши питання'));
});

test('диплом: заглушка, екранна версія 75%, доставка одразу під дипломом', () => {
  const page = read('app/olimpiada/test/page.js');
  assert.match(page, /<DiplomaImage src=\{`\$\{diploma\}&s=screen`\}/);
  assert.ok(page.indexOf('id="dostavka"') < page.indexOf('<ShareDiploma'), 'доставка вище за «Поділитися»');
  assert.ok(page.indexOf('id="dostavka"') < page.indexOf('{OPEN_TASK.title}'), 'доставка вище за відкрите завдання');
  assert.match(read('app/olimpiada/test/DiplomaImage.js'), /Малюємо диплом…/);
  assert.match(read('app/api/olimpiada/diploma/route.js'), /searchParams\.get\('s'\) === 'screen' && !searchParams\.get\('dl'\) \? 0\.75 : 1/);
});

test('2 варіанти оплати: 150 грн або 249 з друкованим дипломом', async () => {
  const { OLIMP, isBundle } = await import('../lib/olimpiada.js');
  const { olimpStats } = await import('../lib/olimpiada-stats.js');
  assert.equal(OLIMP.bundlePrice, 249);
  assert.equal(isBundle({ amount: 249 }), true);
  assert.equal(isBundle({ amount: 150 }), false);
  const form = read('app/olimpiada/EntryForm.js');
  assert.match(form, /value="print"/);
  assert.match(form, /withPrint: e\.nativeEvent\?\.submitter\?\.value === 'print'/);
  assert.match(read('app/api/olimpiada/start/route.js'), /amount: b\.withPrint === true \? OLIMP\.bundlePrice : OLIMP\.price/);
  // Оплата «з дипломом» одразу позначає доставку оплаченою; адреса — після тесту без рахунку.
  assert.match(read('lib/olimpiada-server.js'), /bundle && !entry\.print_paid_at \? \{ print_paid_at: now \}/);
  assert.match(read('app/api/olimpiada/print/route.js'), /if \(entry\.print_paid_at && !entry\.print_order\) \{\n\s+await savePrintAddress/);
  // Виручка без подвійного рахунку доставки.
  const s = olimpStats({ entries: [
    { paid_at: '2026-10-06', amount: 249, print_paid_at: '2026-10-06' },
    { paid_at: '2026-10-06', amount: 150, print_paid_at: '2026-10-07' },
    { paid_at: '2026-10-06', amount: 150 },
  ] });
  assert.equal(s.revenue, 249 + 150 + 120 + 150);
  assert.equal(s.bundles, 1);
  assert.equal(s.prints, 2);
});
