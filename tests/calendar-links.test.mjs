// Календар на сайті: сторінка /events/<slug>/add і .ics беруть дату звідси.
// Приклади спільні з ботом (scraper/tests/test_calendar_link.py), щоб кнопка
// в добірці й сторінка не розходились.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calendarTarget, googleCalendarUrl } from '../lib/calendar-links.js';

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
