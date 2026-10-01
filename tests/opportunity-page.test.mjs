import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { intakeStatus, pageFacts, applicantConditions, whereText } from '../lib/opportunity-facts.js';
import { topicOf } from '../lib/topics.js';

// Редизайн сторінки можливості (29.09.2026, макет Opportunity.dc.html).
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const today = '2026-09-29';

test('статус прийому заявок: дедлайн, подія, щорічно, постійно, закрито', () => {
  assert.deepEqual(intakeStatus({ deadline: '2026-10-03' }, today), {
    kind: 'deadline', label: 'Заявки до', value: '3 жовтня 2026', note: '4 дні', urgent: true,
  });
  assert.equal(intakeStatus({ deadline: '2026-11-20' }, today).urgent, false);
  assert.equal(intakeStatus({ deadline: '2026-09-29' }, today).note, 'сьогодні');
  assert.deepEqual(intakeStatus({ event_start_date: '2026-11-06', event_end_date: '2026-11-08' }, today), {
    kind: 'event', label: 'Коли', value: '6 — 8 листопада 2026',
  });
  assert.equal(intakeStatus({ timing_kind: 'periodic' }, today).value, 'Щорічно');
  assert.equal(intakeStatus({ timing_kind: 'permanent' }, today).value, 'Постійно відкритий');
  assert.equal(intakeStatus({ status: 'closed', deadline: '2026-10-03' }, today).kind, 'closed');
  // Дат немає, вид невідомий — статусу немає: вигадувати «відкрито» не можна.
  assert.equal(intakeStatus({ opportunity_type: 'course' }, today), null);
  assert.equal(intakeStatus({ deadline: '2026-10-03' }, today, 'en').label, 'Apply by');
});

test('факти: лише те, що є в записі, у сталому порядку', () => {
  const item = {
    age_from: 13, age_to: 17, cost_type: 'free', deadline: '2026-10-03',
    format: 'онлайн', cities: ['Онлайн'], source: 'Erasmus+', source_url: 'https://erasmus-plus.ec.europa.eu/x',
  };
  const facts = pageFacts(item, today);
  assert.deepEqual(facts.map((f) => f.key), ['age', 'cost', 'intake', 'format', 'where', 'organiser']);
  assert.equal(facts.find((f) => f.key === 'intake').urgent, true);
  assert.equal(facts.find((f) => f.key === 'where').value, 'Онлайн');
  assert.equal(facts.find((f) => f.key === 'organiser').value, 'Erasmus+');

  // Ціна словами дописується до категорії; подача й проведення — два факти.
  const both = pageFacts({
    age_from: 8, age_to: 12, cost_type: 'paid_premium', price_note: '€100 з проживанням',
    deadline: '2026-10-20', event_start_date: '2026-11-06', event_end_date: '2026-11-08',
  }, today);
  assert.equal(both.find((f) => f.key === 'cost').value, 'Платно — €100 з проживанням');
  assert.equal(both.find((f) => f.key === 'when').value, '6 — 8 листопада 2026');

  // Порожній запис — лише вік.
  assert.deepEqual(pageFacts({ age_from: 0, age_to: 18 }, today).map((f) => f.key), ['age']);
});

test('де: місто з країною за кордоном, місто вдома, онлайн', () => {
  assert.equal(whereText({ cities: ['Прага'], countries: ['cz'] }), 'Прага, Чехія');
  assert.equal(whereText({ cities: ['Київ'], countries: ['ua'] }), 'Київ');
  assert.equal(whereText({ format: 'онлайн' }), 'Онлайн');
  assert.equal(whereText({}), null);
});

test('«Хто може подати»: без обставин і вимог — порожньо, ніяких вигаданих умов', () => {
  assert.deepEqual(applicantConditions({ age_from: 13, age_to: 17 }), []);
  assert.deepEqual(applicantConditions({ age_from: 13, age_to: 17, child_needs: ['idp', 'veteran_family'] }),
    ['Вік 13-17 років', 'ВПО', 'Діти захисників']);
  assert.deepEqual(applicantConditions({ age_from: 14, age_to: 18, teen_requirement: 'бути членом молодіжної організації' }),
    ['Вік 14-18 років', 'Бути членом молодіжної організації']);
  assert.equal(applicantConditions({ age_from: 13, age_to: 17, child_needs: ['idp'] }, 'en')[0], 'Age 13–17 yrs');
});

test('підбірка запису: обмін за кордон — «Програми обміну», гурток — «Гуртки та курси»', () => {
  assert.equal(topicOf({ opportunity_type: 'exchange', title: 'Erasmus+ Youth Exchange', countries: ['de'] })?.slug, 'prohramy-obminu');
  assert.equal(topicOf({ opportunity_type: 'club', title: 'Гурток робототехніки', cost_type: 'free', cities: ['Київ'] })?.slug, 'bezkoshtovni-hurtky');
  assert.equal(topicOf(null), null);
});

test('сторінка: крихта з підбірки, основна кнопка з apply_click, «Повідомити», панель без 🧡', () => {
  const src = read('app/o/shared.js');
  assert.ok(src.includes('topicOf(item)'), 'крихта має братись із підбірки запису');
  assert.ok(/className="o-btn o-btn-primary"[\s\S]{0,80}place=\{primaryPlace\}\s*apply/.test(src), 'основна кнопка має слати apply_click');
  assert.ok(/className="o-m-apply"[\s\S]{0,120}apply\s*>/.test(src), 'панель на телефоні має слати apply_click');
  assert.ok(src.includes('<ReportButton'), 'немає «Щось не так? Повідомити»');
  assert.ok(src.includes('className="o-m-share" icon'), 'у панелі має бути «Поділитися»');
  assert.ok(!src.includes('MONOBANK_URL'), '🧡 у панелі замінено на «Поділитися» (рішення Марії 29.09.2026)');
  assert.ok(!/opportunity-meta/.test(src), 'старий перелік фактів замінено сіткою .o-facts');
  assert.ok(src.includes('<TelegramSubscribeBlock'), 'блок каналу лишається в картці дії');
  assert.ok(src.includes('<PlusPromo'), 'блок Dityam+ унизу (рішення Марії 30.09.2026)');
  // Основна кнопка чесна: без прямого посилання на подачу — «Перейти до офіційного сайту».
  assert.ok(/primaryLabel = applyUrl \? \(clubSignup \? t\.applyClub : t\.apply\) : t\.goSite/.test(src));
});

test('«Повідомити» пише в opportunity_feedback як report із сайту, міграція це дозволяє', () => {
  const route = read('app/api/feedback/route.js');
  assert.ok(route.includes("value: 'report'") && route.includes("source: 'site'"));
  assert.ok(/UUID\.test\(id\)/.test(route), 'id має бути UUID');
  const sql = read('supabase/migrations/20260929_feedback_site_report.sql');
  assert.ok(sql.includes("check (value in ('yes', 'no', 'report'))"));
  assert.ok(sql.includes('unique (opportunity_id, telegram_user_id)'), 'upsert бота тримається на звичайному UNIQUE');
  assert.ok(sql.includes('drop not null'), 'у відвідувача сайту немає Telegram-id');
  const digest = read('scripts/feedback-digest.mjs');
  assert.ok(digest.includes("r.value === 'report'"), 'тижневий діджест має показувати повідомлення з сайту');
  const track = read('lib/track.js');
  assert.ok(/export function trackApplyClick/.test(track) && track.includes("trackConversion('apply_click'"));
});

// --- примітка біля дати, 30.09.2026 ---
//
// Великий шрифт без переносів у блоці прийому заявок призначений лише для
// відліку днів. Для щорічного набору туди потрапляла ціла фраза «стежте за
// новим набором»: вона не переносилась і вилазила за межі блока, налазячи на
// сусідній текст (знімок Марії). Тепер розмір обирає status.kind, тож кожен
// вид мусить його мати — інакше в розмітку піде o-m-days--undefined і стиль
// не застосується взагалі.
const KINDS = ['closed', 'deadline', 'event', 'results', 'periodic', 'permanent'];

test('у кожного статусу прийому є kind', () => {
  const cases = [
    { status: 'closed' },
    { deadline: '2026-12-31' },
    { event_start_date: '2026-12-20', event_end_date: '2026-12-21' },
    { results_date: '2026-12-25' },
    { timing_kind: 'periodic', recurrence: 'annual' },
    { timing_kind: 'permanent' },
  ];
  for (const item of cases) {
    const s = intakeStatus({ status: 'active', ...item }, '2026-09-30');
    if (!s) continue;
    assert.ok(KINDS.includes(s.kind), `невідомий kind: ${s.kind}`);
  }
});

// Довгу примітку великим шрифтом показувати не можна — саме на цьому й
// зламалась верстка.
test('довга примітка буває лише не в дедлайна', () => {
  const periodic = intakeStatus({ status: 'active', timing_kind: 'periodic', recurrence: 'annual' }, '2026-09-30');
  if (periodic?.note) {
    assert.notEqual(periodic.kind, 'deadline');
    assert.ok(periodic.note.length > 12, 'примітка щорічного набору коротка — перевірте тест');
  }
  const soon = intakeStatus({ status: 'active', deadline: '2026-10-02' }, '2026-09-30');
  assert.equal(soon.kind, 'deadline');
  assert.ok(soon.note.length <= 12, `відлік задовгий для великого шрифту: «${soon.note}»`);
});

// --- ворота цитат, 01.10.2026 ---
//
// «Ніколи такого не роби» (Марія): запис не виходить на сайт без дослівних
// цитат зі сторінки. Перевірка missingProof існувала з 22.09.2026, але ні
// publish-draft, ні кнопка в адмінці її не кликали — і повз неї пройшли і
// старі записи, і ті, що публікувалися 01.10.2026.
//
// Тест читає самі файли: зібрати маршрут чи скрипт у тесті нічим, а дірка
// була саме в тому, що виклику немає.
test('публікація не проходить без цитат — і скриптом, і кнопкою', () => {
  for (const f of ['scripts/publish-draft.mjs', 'app/api/admin/review/route.js']) {
    const src = read(f);
    assert.ok(/missingProof/.test(src), `${f}: цитати не перевіряються`);
    assert.ok(/evidence/.test(src), `${f}: поле evidence не читається з бази — перевірка була б сліпа`);
  }
});
