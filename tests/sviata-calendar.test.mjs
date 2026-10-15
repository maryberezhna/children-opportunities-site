// Календар свят і дедлайнів (15.10.2026, Марія: «оживи календар… додай туди
// нагадування про підписку і взагалі найкращі конкурси»). Сторінку /sviata і
// підписку .ics прибирали 25.08.2026 (#109) — тут стежимо, щоб вони не зникли
// знову мовчки й щоб .ics лишався валідним.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import holidays from '../data/events.json' with { type: 'json' };
import { allDayEvent, calendarWrap, dtstamp, foldLine, escapeIcs, nextDay } from '../lib/ics.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('свята на місці: два роки, у кожного дата, назва й опис', () => {
  assert.ok(holidays.years.length >= 2, 'має бути щонайменше два роки');
  for (const y of holidays.years) {
    const evs = holidays.by_year[y];
    assert.ok(evs.length > 40, `${y}: замало свят (${evs.length})`);
    for (const e of evs) {
      assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.slug);
      assert.ok(e.summary && e.description, `${e.slug}: порожня назва чи опис`);
      assert.equal(e.date.slice(0, 4), y, `${e.slug}: рік не збігається`);
    }
  }
});

test('рухомі дати перераховані, а не скопійовані між роками', () => {
  const easter = (y) => holidays.by_year[y].find((e) => /Великдень/.test(e.summary));
  const [a, b] = holidays.years;
  assert.ok(easter(a) && easter(b), 'Великдень має бути в обох роках');
  assert.notEqual(easter(a).date.slice(5), easter(b).date.slice(5), 'Великдень не може бути того самого дня');
});

test('DTEND наступного дня — інакше подія зникає з календаря', () => {
  assert.equal(nextDay('2026-12-31'), '20270101');
  assert.equal(nextDay('2027-02-28'), '20270301');
});

test('ics: обовʼязкові поля, екранування й згортання довгих рядків', () => {
  const ev = allDayEvent({
    uid: 'x@dityam.com.ua', date: '2026-12-19', summary: 'Святий Миколай',
    description: 'Опис; з комою, і крапкою з комою', url: 'https://dityam.com.ua/sviata',
    stamp: dtstamp(new Date('2026-10-15T10:00:00Z')), alarmDays: 3,
  });
  const ics = calendarWrap({ name: 'Тест', description: 'Опис', events: ev });
  for (const must of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261219',
    'DTEND;VALUE=DATE:20261220', 'BEGIN:VALARM', 'TRIGGER:-P3D', 'END:VCALENDAR']) {
    assert.ok(ics.includes(must), `немає ${must}`);
  }
  assert.ok(ics.includes('\;') && ics.includes('\\,'), 'крапка з комою й кома мають бути екрановані');
  assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75), 'є рядок довший за 75 байтів');
});

test('довгий рядок складається з пробілом на початку продовження', () => {
  const folded = foldLine(`SUMMARY:${escapeIcs('я'.repeat(200))}`);
  const lines = folded.split('\r\n');
  assert.ok(lines.length > 1);
  assert.ok(lines.slice(1).every((l) => l.startsWith(' ')), 'продовження має починатися з пробілу');
});

// 15.10.2026: складання по байтах різало українські літери навпіл — в описі
// події виходило «безкош<?>овно». Тепер ріжемо по символах.
test('складання не ламає українські літери й не губить текст', () => {
  const text = 'DESCRIPTION:Міжнародний конкурс з української мови для школярів — переможці отримують стипендії Президента.';
  const folded = foldLine(text);
  const lines = folded.split('\r\n');
  assert.ok(lines.every((l) => Buffer.byteLength(l, 'utf8') <= 75), 'рядок довший за 75 байтів');
  assert.equal(lines.map((l, i) => (i ? l.slice(1) : l)).join(''), text, 'текст після розгортання має збігатися');
  assert.equal(folded.includes('\uFFFD'), false, 'зламаний символ у складеному рядку');
});

test('довгий UID теж складається — інакше рядок виходить за 75 байтів', () => {
  const ev = allDayEvent({
    uid: `deadline-${'x'.repeat(90)}@dityam.com.ua`, date: '2026-12-01',
    summary: 'Тест', stamp: dtstamp(new Date('2026-10-15T10:00:00Z')),
  });
  assert.ok(ev.join('\r\n').split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75));
});

test('/calendar.ics віддає свята і дедлайни, падіння бази не лишає порожній календар', () => {
  const route = read('app/calendar.ics/route.js');
  assert.match(route, /text\/calendar/);
  assert.match(route, /CALENDAR_TYPES = \[/);
  // Свята складаємо ДО запиту в базу, а помилку ловимо — інакше збій бази
  // стер би календар у всіх, хто вже підписався.
  assert.ok(route.indexOf('holidayEvent') < route.indexOf('catch'), 'свята мають додаватись до запиту в базу');
  assert.match(route, /console\.error\('\[calendar\.ics\]/);
});

test('сторінка /sviata жива: без редіректу, у sitemap і у футері', () => {
  assert.equal(/source: '\/sviata'/.test(read('next.config.js')), false, 'редірект /sviata має бути знятий');
  assert.match(read('app/sitemap.js'), /\/sviata`/);
  assert.match(read('app/Footer.js'), /h\.sviata &&/);
  const page = read('app/sviata/page.js');
  assert.match(page, /Dityam\+/, 'має бути нагадування про підписку');
  assert.match(page, /sviata-deadlines/, 'має бути блок дедлайнів');
});
