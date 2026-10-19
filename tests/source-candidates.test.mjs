// Джерела-кандидати: домен із посилання й сторінка рішень (19.10.2026).
// Марія: «інколи буває що можливість для дорослих але в цілому джерело
// непогане як тоді».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CANDIDATE_ACTIONS, candidateDomain, domainOf } from '../lib/source-candidates.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('домен — у тому ж вигляді, що пише розвідник', () => {
  assert.equal(domainOf('https://www.UCCI.ie/events/?x=1'), 'ucci.ie');
  assert.equal(domainOf('http://man.gov.ua'), 'man.gov.ua');
  assert.equal(domainOf('не посилання'), null);
  assert.equal(domainOf(null), null);
});

test('наші сторінки й соцмережі джерелом не бувають', () => {
  // Правило «джерело — сторінка, не допис»: чужий канал чи допис у ФБ
  // першоджерелом не є, і брати його на моніторинг нема сенсу.
  for (const u of ['https://t.me/some_channel/12', 'https://www.facebook.com/x',
    'https://instagram.com/y', 'https://dityam.com.ua/o/zapys']) {
    assert.equal(candidateDomain(u), null, u);
  }
  assert.equal(candidateDomain('https://ucci.ie/events/'), 'ucci.ie');
});

test('документ, форма чи диск — сайт сервісу, а не організатора', () => {
  // 19.10.2026: черга пропонувала «візьми сайт docs.google.com на
  // моніторинг». Сторінка однієї форми нічого не каже про інші — такі
  // домени не кандидати, і галочки для них у черзі немає.
  for (const u of ['https://docs.google.com/forms/d/e/1FAIpQLSd/viewform',
    'https://docs.google.com/document/d/abc/edit', 'https://forms.gle/abc',
    'https://drive.google.com/file/d/x', 'https://forms.office.com/r/x',
    'https://m.facebook.com/events/1', 'https://youtu.be/x']) {
    assert.equal(candidateDomain(u), null, u);
  }
  assert.equal(candidateDomain('https://globalkids.ua/osinnij-tabir/'), 'globalkids.ua');
  const queue = read('app/admin/Queue.js');
  assert.ok(queue.includes('{candidateDomain(o.source_url) ? ('),
    'галочка показується для будь-якого посилання, а не лише для придатного домену');
});

test('рішення людини — лише ті статуси, які приймає база', () => {
  // CHECK у source_candidates: pending | approved | rejected | duplicate.
  const allowed = new Set(['pending', 'approved', 'rejected', 'duplicate']);
  for (const status of Object.values(CANDIDATE_ACTIONS)) {
    assert.ok(allowed.has(status), status);
  }
});

test('кандидатів видно: сторінка, пункт меню й лічильник на місці', () => {
  const nav = read('app/admin/AdminNav.js');
  assert.ok(nav.includes('/admin/dzherela'), 'меню не веде на сторінку джерел');
  assert.ok(nav.includes("head('source_candidates'"), 'лічильник кандидатів не рахується');
  const page = read('app/admin/dzherela/page.js');
  assert.ok(page.includes('source_candidates') && page.includes("from('sources')"),
    'сторінка не читає і кандидатів, і підключені джерела');
});

test('«беремо» не вдає, що вмикає обхід', () => {
  // Фейкових дверей не ставимо: під кожен сайт потрібен зчитувач у коді,
  // і кнопка має казати правду про те, що робить.
  const list = read('app/admin/dzherela/SourcesList.js');
  assert.ok(list.includes('зчитувач'), 'сторінка не пояснює, що «беремо» ≠ «увімкнено»');
});

test('у черзі є галочка «джерело добре» і вона йде в запит', () => {
  const queue = read('app/admin/Queue.js');
  assert.ok(queue.includes('keepSource'), 'галочки немає');
  assert.ok(queue.includes("action: 'reject', reason, comment: text, keepSource"),
    'галочка не передається у відмову');
  // Підказка під полем має попереджати, що текст читає пошук.
  assert.ok(queue.includes('читає пошук'), 'не сказано, що пояснення читає пошук');
});
