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
