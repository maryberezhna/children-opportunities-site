// Підказка про помилку в домені email (11.10.2026): на формі олімпіади
// приблизно кожен 9-й з батьків помилився в домені, листи поверталися.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suggestEmail, editDistance, KNOWN_DOMAINS, COMMON_TYPOS } from '../lib/email-typo.js';
import { SITE_EVENT_NAMES } from '../lib/site-events.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('справжні випадки з продакшну → gmail.com', () => {
  assert.equal(suggestEmail('ninabigununok@gmai.com'), 'ninabigununok@gmail.com');
  assert.equal(suggestEmail('olena@gmali.com'), 'olena@gmail.com');
  assert.equal(suggestEmail('olena@gnmail.com'), 'olena@gmail.com');
  assert.equal(suggestEmail('olena@qmail.com'), 'olena@gmail.com');
});

test('кожна помилка зі списку веде туди, куди треба', () => {
  for (const [typo, right] of Object.entries(COMMON_TYPOS)) {
    assert.equal(suggestEmail(`a.b@${typo}`), `a.b@${right}`, typo);
  }
});

test('помилки поза списком ловить відстань', () => {
  assert.equal(suggestEmail('x@hotmial.com'), 'x@hotmail.com');
  assert.equal(suggestEmail('x@outlok.com'), 'x@outlook.com');
  assert.equal(suggestEmail('x@yaho.com'), 'x@yahoo.com');
  assert.equal(suggestEmail('x@iclod.com'), 'x@icloud.com');
  assert.equal(suggestEmail('x@icloud.cm'), 'x@icloud.com');
  assert.equal(suggestEmail('x@bigmir.ner'), 'x@bigmir.net');
  assert.equal(suggestEmail('x@ukr.ne'), 'x@ukr.net');
  assert.equal(suggestEmail('x@gmaiil.com'), 'x@gmail.com');
});

test('загублена крапка, крапка в кінці, кома', () => {
  assert.equal(suggestEmail('nina@gmailcom'), 'nina@gmail.com');
  assert.equal(suggestEmail('nina@ukrnet'), 'nina@ukr.net');
  assert.equal(suggestEmail('nina@gmail'), 'nina@gmail.com');
  assert.equal(suggestEmail('nina@gmail.com.'), 'nina@gmail.com');
  assert.equal(suggestEmail('nina@ukr.net.'), 'nina@ukr.net');
  assert.equal(suggestEmail('nina@gmail,com'), 'nina@gmail.com');
  assert.equal(suggestEmail('nina@gmai.com.'), 'nina@gmail.com');
});

test('результат — малими літерами', () => {
  assert.equal(suggestEmail('  Nina.K@GMAI.COM '), 'nina.k@gmail.com');
});

test('відомий домен не «виправляємо» — і з великими літерами теж', () => {
  for (const d of KNOWN_DOMAINS) assert.equal(suggestEmail(`nina@${d}`), null, d);
  assert.equal(suggestEmail('mama@gmail.com'), null);
  assert.equal(suggestEmail('Nina@Gmail.Com'), null);
});

// i.ua і ukr.net короткі: 2 помилки вже перетворюють одне на інше чи на чужий домен.
test('короткі домени: i.ua і ukr.net не плутаємо між собою', () => {
  assert.equal(suggestEmail('x@i.ua'), null);
  assert.equal(suggestEmail('x@ukr.net'), null);
  assert.equal(suggestEmail('x@ukr.ua'), null);
  assert.equal(suggestEmail('x@kr.ua'), null);
  assert.equal(suggestEmail('x@ua.fm'), null);
  assert.equal(suggestEmail('x@i.u'), 'x@i.ua');
  assert.equal(suggestEmail('x@meta.ua'), null);
  assert.equal(suggestEmail('x@beta.ua'), 'x@meta.ua'); // 1 помилка — підказка, не заборона
  assert.equal(suggestEmail('x@data.uk'), null);
});

test('справжні незвичні домени лишаємо як є', () => {
  for (const d of [
    'school.edu.ua', 'company.com.ua', 'random.org.ua', 'mail.ua', 'school5.mail.ua', 'lyceum.kiev.ua',
    'mail.com', 'email.com', 'ymail.com', 'gmx.com', 'googlemail.com', 'mac.com', 'pm.me', 'protonmail.ch',
    'yahoo.ca', 'yahoo.co.uk', 'hotmail.co.uk', 'live.ca', 'live.ru', 'mail.ru', 'dataart.com', 'online.ua',
  ]) {
    assert.equal(suggestEmail(`nina@${d}`), null, d);
  }
});

test('не адреса — нічого не підказуємо', () => {
  for (const v of ['', null, undefined, 'gmai.com', '@gmai.com', 'nina@', 'a@b@gmai.com', 'nina@gm ai.com', 42]) {
    assert.equal(suggestEmail(v), null, String(v));
  }
});

test('відстань рахує перестановку як 1 помилку', () => {
  assert.equal(editDistance('gmial.com', 'gmail.com'), 1);
  assert.equal(editDistance('gamil.com', 'gmail.com'), 1);
  assert.equal(editDistance('gnmail.com', 'gmail.com'), 1);
  assert.equal(editDistance('i.ua', 'ukr.net'), 6);
  assert.equal(editDistance('', 'abc'), 3);
});

test('форми олімпіади показують підказку й рахують виправлення', () => {
  assert.ok(SITE_EVENT_NAMES.includes('olimp_email_typo_fixed'));
  const hint = read('app/olimpiada/EmailTypoHint.js');
  assert.match(hint, /aria-live="polite"/);
  assert.match(hint, /suggestEmail/);
  for (const f of ['app/olimpiada/EntryForm.js', 'app/olimpiada/TeacherForm.js']) {
    const src = read(f);
    assert.match(src, /useEmailTypo\(/, f);
    assert.match(src, /blockSubmit\(/, f);
  }
  // Сервер адрес не виправляє — лише перевіряє.
  assert.doesNotMatch(read('app/api/olimpiada/start/route.js'), /email-typo|suggestEmail/);
});
