// Диплом листом одразу із сайту, учасники в адмінці й сповіщення в чат
// (Марія, 09.10.2026: «а можеш їх завжди відправляти одразу?», «де ці люди»,
// «чому мені в телеграм-адмінку не приходить»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'm';
process.env.WAYFORPAY_SECRET_KEY = 's';
const { buildDiploma, sendDiploma } = await import('../lib/olimpiada-mail.js');
const read = (f) => readFileSync(f, 'utf8');
const TOKEN = '9cabd081887339b3edeadead8ffb15e2';

test('лист із дипломом: сайт і запасний скрипт — ті самі слова', () => {
  const py = read('scraper/olimpiada_invites.py').replace(/"\s*\n\s*(?:#[^\n]*\n\s*)*f?"/g, '');
  const entry = { token: TOKEN, child_name: 'Оля', score: 23, max_score: 25, open_answer: 'задача' };
  const { subject, text } = buildDiploma(entry);
  assert.equal(subject, 'Диплом онлайн-олімпіади з логіки — Оля');
  for (const phrase of [
    'пройшов або пройшла онлайн-олімпіаду з логіки Dityam.com.ua: результат ',
    'Диплом чекає на сторінці з результатом — там його можна переглянути й завантажити:',
    'Відкрите завдання отримали — воно бере участь у конкурсі на приз місяця. ',
    'Що далі після олімпіади?',
    'А ще підписники першими дізнаються про наші нові олімпіади й конкурси. ',
  ]) {
    assert.ok(text.includes(phrase), `сайт: ${phrase}`);
    assert.ok(py.includes(phrase), `скрипт: ${phrase}`);
  }
});

test('лист із дипломом не йде без тесту, повторно й з тестового сховища', async () => {
  let claimed = 0;
  const store = { dev: false, claim: async () => { claimed += 1; return {}; }, update: async () => ({}) };
  assert.equal(await sendDiploma(store, { token: TOKEN, parent_email: 'a@b.ua' }), false);
  assert.equal(await sendDiploma(store, { token: TOKEN, parent_email: 'a@b.ua', finished_at: 'x', diploma_sent_at: 'x' }), false);
  assert.equal(await sendDiploma({ ...store, dev: true }, { token: TOKEN, parent_email: 'a@b.ua', finished_at: 'x' }), false);
  assert.equal(claimed, 0);
});

test('сторінка результату просить лист одразу; чат отримує тест і відкрите завдання', () => {
  assert.match(read('app/olimpiada/test/page.js'), /<DiplomaMailer token=\{entry\.token\} \/>/);
  assert.match(read('app/api/olimpiada/diploma-mail/route.js'), /sendDiploma\(store, entry\)/);
  assert.match(read('app/api/olimpiada/submit/route.js'), /await notifyAdmin\(/);
  assert.match(read('app/api/olimpiada/open/route.js'), /await notifyAdmin\(/);
  assert.match(read('app/admin/metrics/page.js'), /Учасники · \{olimpPeople\.length\}/);
});

test('лист без вкладення — лише посилання; без друкованого диплома (27.10.2026)', async () => {
  // Лист дитині — без вкладення. Вкладення є лише в подяці педагогу (нижче
  // «Листи педагогам»): її картинка надсилається листом один раз (11.10.2026).
  const mail = read('lib/olimpiada-mail.js').split('// ── Листи педагогам')[0];
  assert.doesNotMatch(mail, /attachments:/);
  assert.doesNotMatch(mail, /у вкладенні/);
  const { text, html } = buildDiploma({ token: TOKEN, child_name: 'Оля', score: 25, max_score: 25 });
  assert.ok(text.includes(`/olimpiada/test?t=${TOKEN}`));
  assert.match(html, /Відкрити диплом/);
  assert.doesNotMatch(read('scraper/olimpiada_invites.py'), /MIMEImage|fetch_diploma/);
  // Платний друкований диплом прибрано 27.10.2026 — у листах його немає.
  for (const part of [text, html]) assert.doesNotMatch(part, /друкован|Нової пошти|#dostavka/);
  // Обіцянки на сторінках — правдиві: на email приходить посилання, не диплом.
  for (const f of ['app/olimpiada/page.js', 'app/olimpiada/test/page.js']) {
    assert.doesNotMatch(read(f), /приходять на email|Диплом також надішлемо на email|на екрані й на email/, f);
  }
});
