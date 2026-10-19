// Календар на сайті: сторінка /events/<slug>/add і .ics беруть дату звідси.
// Приклади спільні з ботом (scraper/tests/test_calendar_link.py), щоб кнопка
// в добірці й сторінка не розходились.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calendarTarget, googleCalendarUrl, botCalendarUrl } from '../lib/calendar-links.js';

const { today, cases } = JSON.parse(readFileSync(new URL('./fixtures/calendar-cases.json', import.meta.url)));

for (const c of cases) {
  test(`ціль: ${c.name}`, () => {
    const got = calendarTarget(c.item, today);
    if (c.target === null) {
      assert.equal(got, null);
      return;
    }
    assert.equal(got.kind, c.target.kind);
    assert.equal(got.start, c.target.start);
    assert.equal(got.end, c.target.end);
  });
}

for (const c of cases.filter((x) => x.target)) {
  test(`посилання: ${c.name}`, () => {
    const t = c.target;
    const url = new URL(googleCalendarUrl({
      title: c.item.title,
      description: c.item.summary,
      date: t.start,
      endDate: t.kind === 'event' ? t.end : undefined,
      url: `https://dityam.com.ua/o/${c.item.slug}`,
    }));
    assert.equal(url.searchParams.get('dates'), c.dates);
    assert.equal(url.searchParams.get('text'), c.text);
    // Порожній проміжок Google не приймає — подія просто не створюється.
    const [from, to] = url.searchParams.get('dates').split('/');
    assert.notEqual(from, to, 'початок і кінець не можуть збігатись');
  });
}

test('дедлайн іде з київським часовим поясом', () => {
  const url = new URL(googleCalendarUrl({
    title: 'Конкурс', date: '2026-10-20', url: 'https://dityam.com.ua/o/x',
  }));
  assert.equal(url.searchParams.get('ctz'), 'Europe/Kyiv');
});

// Перша добірка після оплати (route.js) — те саме пряме посилання, що й
// щоденна (29.09.2026): без сторінки /events/…/add і без минулих дат.
test('botCalendarUrl: пряме посилання в Google, лише з датою попереду', () => {
  const item = { title: 'ISEF', slug: 'isef', summary: 'Опис', deadline: '2026-10-20' };
  const url = botCalendarUrl(item, '2026-09-29');
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
  assert.ok(!url.includes('/events/'));
  assert.ok(url.includes('20261020T090000%2F20261020T095900'));
  assert.equal(botCalendarUrl({ ...item, deadline: '2026-09-01' }, '2026-09-29'), null);
  assert.equal(botCalendarUrl({ title: 'x', slug: 'x' }, '2026-09-29'), null);
  const ev = botCalendarUrl({ title: 'Табір', slug: 't', event_start_date: '2026-10-10', event_end_date: '2026-10-19' }, '2026-09-29');
  assert.ok(ev.includes('20261010%2F20261020'));
});

// ---- Закритий набір: нагадування про наступний (19.10.2026) ----
import { nextIntakeReminder, reminderText, reminderCalendarUrl } from '../lib/calendar-links.js';

const closedToday = '2026-10-19';

test('нагадування: торішній дедлайн + рік − 14 днів, чітка дата', () => {
  const r = nextIntakeReminder({ timing_kind: 'periodic', deadline: '2026-03-15', status: 'closed' }, closedToday);
  assert.deepEqual(r, { date: '2027-03-01', next: '2027-03-15', last: '2026-03-15', basis: 'deadline', lastIsPast: true });
});

test('нагадування: закритий запис із дедлайном попереду — перед цією ж датою, без «торік»', () => {
  const item = { slug: 'x', title: 'X', timing_kind: 'periodic', deadline: '2027-05-01', status: 'closed' };
  const r = nextIntakeReminder(item, closedToday);
  assert.equal(r.date, '2027-04-17');
  assert.equal(r.lastIsPast, false);
  const uk = reminderText(item, r, 'uk');
  assert.doesNotMatch(uk.description, /Торік/);
  assert.match(uk.description, /Відома нам дата: 1 травня 2027/);
});

test('нагадування: без дедлайну — початок події + рік − 30 днів', () => {
  const r = nextIntakeReminder({ timing_kind: 'periodic', event_start_date: '2026-07-10' }, closedToday);
  assert.equal(r.basis, 'event');
  assert.equal(r.date, '2027-06-10');
});

test('нагадування: закрито понад рік тому — рік додається, доки дата попереду', () => {
  const r = nextIntakeReminder({ timing_kind: 'periodic', deadline: '2024-03-15' }, closedToday);
  assert.equal(r.date, '2027-03-01');
  assert.equal(r.next, '2027-03-15');
});

test('нагадування: одноразова, без дат, без виду — нічого не вигадуємо', () => {
  assert.equal(nextIntakeReminder({ timing_kind: 'one_time', deadline: '2026-03-15' }, closedToday), null);
  assert.equal(nextIntakeReminder({ timing_kind: 'periodic' }, closedToday), null);
  assert.equal(nextIntakeReminder({ opportunity_type: 'course', deadline: '2026-03-15' }, closedToday), null);
  assert.equal(nextIntakeReminder(null, closedToday), null);
});

test('нагадування: старий запис без виду, але щорічного типу — за ANNUAL_TYPES', () => {
  const r = nextIntakeReminder({ opportunity_type: 'olympiad', deadline: '2026-03-15' }, closedToday);
  assert.ok(r, 'олімпіада без timing_kind — періодична');
});

test('нагадування: слова чесні — «торік», «ще не оголосив», і ті самі в Google-посиланні', () => {
  const item = { slug: 'ioi-2026', title: 'IOI 2026', timing_kind: 'periodic', deadline: '2026-03-15' };
  const r = nextIntakeReminder(item, closedToday);
  const uk = reminderText(item, r, 'uk');
  assert.equal(uk.summary, 'Чи відкрито набір: IOI 2026');
  assert.match(uk.description, /Торік заявки приймали до 15 березня 2026/);
  assert.match(uk.description, /ще не оголосив/);
  const en = reminderText(item, r, 'en');
  assert.match(en.description, /closed on 15 March 2026/);

  const url = new URL(reminderCalendarUrl(item, r, 'uk'));
  assert.equal(url.searchParams.get('text'), uk.summary);
  // Цілоденна подія на дату нагадування: кінець у Google не включно.
  assert.equal(url.searchParams.get('dates'), '20270301/20270302');
  assert.match(url.searchParams.get('details'), /\/o\/ioi-2026$/);
  assert.match(new URL(reminderCalendarUrl(item, r, 'en')).searchParams.get('details'), /\/en\/o\/ioi-2026$/);
});
