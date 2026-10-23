// Шаблони відповідей (23.10.2026, Марія: «все, що я апрувлю, — записуй у
// автоматичний процес»): автоматично йде лише схвалений шаблон.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { REPLY_TEMPLATES, autoReplyFor, ambassadorRole } = await import('../lib/reply-templates.js');
const { CONTACT_TYPE_MAP } = await import('../lib/contactTypes.js');

const SAMPLE = { name: 'Тетяна Пупкова', message: 'Роль: Педагог\nМісто чи країна: Іллінці\nПро себе: Чат класу, колеги', program: 'School Svit' };

test('несхвалений шаблон нікому нічого не надсилає', () => {
  for (const [id, t] of Object.entries(REPLY_TEMPLATES)) {
    assert.ok(t.approved === null || /^\d{4}-\d{2}-\d{2}$/.test(t.approved), `${id}: approved — дата або null`);
    if (t.auto) assert.ok(CONTACT_TYPE_MAP[t.auto], `${id}: немає типу звернення ${t.auto}`);
    if (t.auto && !t.approved) assert.equal(autoReplyFor(t.auto), null, `${id} не схвалено, а йде сам`);
    if (t.auto && t.approved) assert.equal(autoReplyFor(t.auto).id, id);
  }
  assert.equal(autoReplyFor('complaint'), null);
});

test('кожен шаблон: тема, текст, HTML, повний підпис, без заборонених слів', () => {
  for (const [id, t] of Object.entries(REPLY_TEMPLATES)) {
    const m = t.build(SAMPLE);
    assert.ok(m.subject && m.text && m.html, id);
    assert.match(m.text, /Марія Шутяк\nЗасновниця платформи Dityam\.com\.ua\nhttps:\/\/dityam\.com\.ua\nhellodityam\.com\.ua@gmail\.com · \+380/, `${id}: підпис`);
    for (const bad of [/каталог/i, /Dityam\+ —/, /Dityam(?![.+]|\.com)/, /живе без реклами/i]) {
      assert.doesNotMatch(m.text, bad, `${id}: ${bad}`);
    }
    // dityam.com.ua у HTML — завжди посиланням (правило листів 20.10.2026).
    const outside = m.html.replace(/<a [^>]*>.*?<\/a>/g, '');
    assert.doesNotMatch(outside, /dityam\.com\.ua(?!@)/i, `${id}: голий dityam.com.ua у HTML`);
    assert.doesNotMatch(m.html, /font-size/, `${id}: без власного розміру шрифту`);
  }
});

test('амбасадор: текст Марії дослівно, схвалений — іде сам', () => {
  const t = REPLY_TEMPLATES.ambassador_welcome;
  assert.equal(t.auto, 'ambassador');
  assert.equal(t.approved, '2026-10-23');
  assert.equal(autoReplyFor('ambassador').id, 'ambassador_welcome');
  assert.equal(ambassadorRole(SAMPLE.message), 'Педагог');
  const m = t.build(SAMPLE).text;
  assert.match(m, /^Тетяно, добрий день!\n\nДякую, що хочете стати амбасадором Dityam\.com\.ua\. Ми підготовлюємо інформацію для амбасадорів\. Ми обов’язково вас повідомимо\.\n\nПідкажіть, будь ласка, які проблеми наразі у розрізі освіти для дітей ви бачите\?\n\nЗ повагою,/);
  assert.match(t.build({ name: 'Olga' }).text, /^Добрий день!/);
});

test('організатору: форма за прямим посиланням і пілотне розміщення', () => {
  const m = REPLY_TEMPLATES.organizer_add.build({ name: 'Юля', program: 'School Svit' });
  assert.match(m.text, /^Юлю, добрий день!/);
  assert.match(m.text, /https:\/\/dityam\.com\.ua\/#zaproponuvaty/);
  assert.match(m.text, /пілотне платне розміщення: за 500 грн/);
});

test('форма звернень відповідає сама лише схваленим шаблоном і лише на email', () => {
  const route = fs.readFileSync(new URL('../app/api/contact/route.js', import.meta.url), 'utf8');
  assert.match(route, /const tpl = autoReplyFor\(type\);/);
  assert.match(route, /if \(tpl && parsed\.kind === 'email'\)/);
  // Спершу зберігаємо звернення, потім лист: пошта не має губити звернення.
  assert.ok(route.indexOf("from('contact_messages').insert") < route.indexOf('autoReplyFor(type)'));
});

test('амбасадор, який уже педагог олімпіади: звертання з повного імені', () => {
  const m = REPLY_TEMPLATES.ambassador_welcome.build({ ...SAMPLE, teacher: { name: 'Тетяна Анатоліївна Пупкова', code: 'stjdjw3z' } }).text;
  assert.match(m, /^Тетяно Анатоліївно, добрий день!/);
  const route = fs.readFileSync(new URL('../app/api/contact/route.js', import.meta.url), 'utf8');
  assert.match(route, /from\('olimpiada_teachers'\)\.select\('name, code'\)/);
});
