// Педагоги онлайн-олімпіади (Марія, 11.10.2026): «Ви педагог? Хочете залучити
// дітей до цікавої олімпіади? Отримайте від нас окрему подяку за учнів, які
// пройдуть олімпіаду за вашим посиланням».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import {
  teacherCode, validTeacherCode, teacherName, teacherLink, teacherPagePath, teacherInvite, TEACHER_CODE_LEN, OLIMP,
  TEACHER_THANKS_AT, TEACHER_SAMPLE, teacherThanksDate, teacherThanksNo, DIPLOMA_VERSION,
} from '../lib/olimpiada.js';
import { olimpTeachers } from '../lib/olimpiada-stats.js';
import { SITE_EVENT_NAMES } from '../lib/site-events.js';
import { teacherGreeting, GREETING_FALLBACK } from '../lib/teacher-greeting.js';
import { notifySig, checkNotifySig, notifyPath, notifyKey, NOTIFY_ACTION } from '../lib/olimpiada-sign.js';

// Без ключів і пароля: getStore() дає локальне сховище в памʼяті, листи не йдуть.
delete process.env.DITYAM_GMAIL_APP_PASSWORD;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
const { getStore, thankTeacher } = await import('../lib/olimpiada-server.js');
const { buildTeacherWelcome, buildTeacherThanks } = await import('../lib/olimpiada-mail.js');

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('код педагога: 8 знаків без схожих l/1/o/0, проходить свою ж перевірку', () => {
  for (let i = 0; i < 500; i += 1) {
    const c = teacherCode(crypto.randomBytes(8));
    assert.equal(c.length, TEACHER_CODE_LEN);
    assert.match(c, /^[a-km-np-z2-9]{8}$/);
    assert.ok(validTeacherCode(c), c);
  }
  assert.equal(teacherCode([0, 0, 0, 0, 0, 0, 0, 0]), 'aaaaaaaa');
  assert.equal(teacherCode([31, 32, 63, 255, 0, 1, 2, 3]), '9a99abcd');
});

test('код педагога: чуже й зламане не приймаємо', () => {
  for (const bad of ['', null, undefined, 'abcd234', 'abcd23456', 'ABCD2345', 'abcd2340', 'abcl2345', 'abco2345',
    'abc12345', 'abcd-234', 'abcd 234', '../../x', '<script>', 5]) {
    assert.equal(validTeacherCode(bad), false, String(bad));
  }
  assert.equal(validTeacherCode('k7mnp2xz'), true);
});

test('міграція перевіряє той самий формат коду, що й сайт', () => {
  const sql = read('supabase/migrations/20261011_olimpiada_teachers.sql');
  assert.match(sql, /code ~ '\^\[a-km-np-z2-9\]\{8\}\$'/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.olimpiada_teachers from anon, authenticated/);
  assert.match(sql, /on public\.olimpiada_teachers \(olimp, lower\(email\)\)/);
  assert.match(sql, /add column if not exists teacher_code text/);
});

test('імʼя педагога: без керівних символів і дужок, 2–60 знаків', () => {
  assert.equal(teacherName('  Олена   Петрівна\tКоваль  '), 'Олена Петрівна Коваль');
  assert.equal(teacherName('<b>Олена</b>'), 'bОлена/b');
  assert.equal(teacherName('Оле\u0000на\u0007 К'), 'Олена К');
  assert.equal(teacherName('О'), null);
  assert.equal(teacherName('   '), null);
  assert.equal(teacherName(null), null);
  assert.equal(teacherName('а'.repeat(80)).length, 60);
});

test('посилання педагога й готовий текст для чату — з умов олімпіади', () => {
  assert.equal(teacherLink('k7mnp2xz'), 'https://dityam.com.ua/olimpiada?vid=k7mnp2xz');
  assert.equal(teacherPagePath('k7mnp2xz'), '/olimpiada/pedagog?c=k7mnp2xz');
  const text = teacherInvite(teacherLink('k7mnp2xz'));
  assert.ok(text.endsWith('https://dityam.com.ua/olimpiada?vid=k7mnp2xz'));
  assert.ok(text.includes(OLIMP.groupLabel));
  assert.ok(text.includes(`${OLIMP.questionCount} завдань`));
  assert.ok(text.includes(`${OLIMP.minutes} хвилин`));
  assert.ok(text.includes('безкоштовн'));
});

test('лист Марії педагогу: текст слово в слово, звертання, посилання, згода на листи', () => {
  const t = { code: 'k7mnp2xz', email: 'olena@example.com', name: 'Олена Петрівна Коваль' };
  const w = buildTeacherWelcome(t, { greeting: 'Олено Петрівно, добрий день!' });
  assert.equal(w.subject, 'Дякую, що долучилися до олімпіади');
  const lines = w.text.split('\n');
  assert.equal(lines[0], 'Олено Петрівно, добрий день!');
  for (const part of [
    'Дякую, що хочете запросити свій клас на нашу олімпіаду. Саме педагоги першими помічають, що дитині щось цікаво, і найчастіше саме від вас діти дізнаються про олімпіади й конкурси. Тому мені важливо написати вам особисто.',
    'Я Марія Шутяк, засновниця Dityam.com.ua — платформи можливостей для дітей 0–18 років. Ми намагаємося зробити так, щоб можливості були рівними для всіх дітей. Тому публікуємо українські й закордонні можливості, а також створюємо власні. Онлайн-олімпіада з логіки — одна з них: безкоштовна, для дітей 9–11 років, 25 завдань за 35 хвилин, диплом одразу після тесту.',
    'Посилання для вашого класу:\nhttps://dityam.com.ua/olimpiada?vid=k7mnp2xz\nКоли за ним олімпіаду пройдуть 5 учнів, ми надішлемо вам подяку від Dityam.com.ua.',
    'Ваша сторінка педагога: https://dityam.com.ua/olimpiada/pedagog?c=k7mnp2xz',
    'Чи можна повідомляти вас і про інші олімпіади та конкурси для ваших учнів?\nТак, повідомляйте мене: https://dityam.com.ua/olimpiada/pedagog?c=k7mnp2xz&notify=1&s=',
    'Мені дуже цікаво, як ви працюєте з олімпіадами й конкурсами: звідки про них дізнаєтесь, чого бракує, що заважає. Якщо знайдете хвилинку, напишіть мені у відповідь на цей лист.',
    'З повагою,\nМарія Шутяк\nзасновниця Dityam.com.ua\nhellodityam.com.ua@gmail.com · dityam.com.ua',
  ]) assert.ok(w.text.includes(part), part.slice(0, 60));
  // Порядок: посилання для класу → згода на листи → «Мені дуже цікаво».
  assert.ok(w.text.indexOf('Посилання для вашого класу') < w.text.indexOf('Чи можна повідомляти'));
  assert.ok(w.text.indexOf('Чи можна повідомляти') < w.text.indexOf('Мені дуже цікаво'));
  // Цифри — з умов олімпіади, а не вписані руками.
  assert.equal(OLIMP.groupLabel, '9–11 років');
  assert.equal(OLIMP.questionCount, 25);
  assert.equal(OLIMP.minutes, 35);
  assert.equal(TEACHER_THANKS_AT, 5);
  // HTML: ті самі посилання явними <a href>, підписане «Так, повідомляйте мене».
  const sig = notifySig('k7mnp2xz');
  assert.ok(w.html.includes('href="https://dityam.com.ua/olimpiada?vid=k7mnp2xz"'));
  assert.ok(w.html.includes('href="https://dityam.com.ua/olimpiada/pedagog?c=k7mnp2xz"'));
  // Посилання веде на підтвердження з кнопкою, а не на запис згоди (сканери пошти).
  assert.ok(w.html.includes(`href="https://dityam.com.ua/olimpiada/pedagog?c=k7mnp2xz&amp;notify=1&amp;s=${sig}"`));
  assert.ok(!w.html.includes('/api/olimpiada/teacher/notify'));
  assert.ok(w.html.includes('>Так, повідомляйте мене</a>'));
  assert.ok(w.html.includes('href="mailto:hellodityam.com.ua@gmail.com"'));
  assert.ok(w.html.startsWith('<div') && w.html.includes('Олено Петрівно, добрий день!'));
  // Без підписаного посилання (немає ключа) — абзацу про згоду немає.
  const bare = buildTeacherWelcome(t, { notifyUrl: null });
  assert.equal(bare.text.split('\n')[0], GREETING_FALLBACK);
  assert.ok(!bare.text.includes('Чи можна повідомляти'));
  assert.ok(!bare.html.includes('Так, повідомляйте мене'));
});

test('лист із подякою: після 5 учнів, вкладення, без імен дітей, без «Dityam+ —»', () => {
  const t = { code: 'k7mnp2xz', email: 'olena@example.com', name: 'Олена Петрівна Коваль' };
  const th = buildTeacherThanks(t, { greeting: 'Олено Петрівно, добрий день!' });
  assert.equal(th.text.split('\n')[0], 'Олено Петрівно, добрий день!');
  assert.ok(th.text.includes('За вашим посиланням онлайн-олімпіаду з логіки пройшли вже 5 учнів. Дякую вам за це! '
    + 'Подяку від Dityam.com.ua додаю до листа, її також можна завантажити на вашій сторінці: https://dityam.com.ua/olimpiada/pedagog?c=k7mnp2xz'));
  assert.ok(th.text.includes('Діти можуть і далі проходити олімпіаду за тим самим посиланням: https://dityam.com.ua/olimpiada?vid=k7mnp2xz'));
  assert.ok(th.text.endsWith('hellodityam.com.ua@gmail.com · dityam.com.ua'));
  assert.ok(th.html.includes('href="https://dityam.com.ua/olimpiada/pedagog?c=k7mnp2xz"'));
  // Картинку не вдалося намалювати — листа не обманюємо «додаю до листа».
  const noPng = buildTeacherThanks(t, { attached: false });
  assert.ok(!noPng.text.includes('додаю до листа'));
  assert.ok(noPng.text.includes('можна переглянути й завантажити на вашій сторінці'));
  const w = buildTeacherWelcome(t);
  for (const m of [w, th]) {
    assert.doesNotMatch(`${m.subject}${m.text}${m.html}`, /Dityam\+\s*[—–-]/);
    assert.doesNotMatch(`${m.text}`, /першого учня|оновлюється/);
  }
  const mail = read('lib/olimpiada-mail.js');
  assert.match(mail, /attachments: \[\{ filename: 'podyaka-pedagogu-dityam\.png', content: png, contentType: 'image\/png' \}\]/);
  assert.match(mail, /const claimed = await store\.claimTeacherThanks\(teacher\.code\);/);
  assert.match(mail, /await store\.releaseTeacherThanks\(teacher\.code\)/);
});

test('звертання в кличному відмінку: імʼя + по батькові, інакше лише імʼя, сумнів — «Добрий день!»', () => {
  const cases = [
    ['Олена Петрівна Коваль', 'Олено Петрівно, добрий день!'],
    ['Коваль Олена Петрівна', 'Олено Петрівно, добрий день!'],
    ['Олена Коваль', 'Олено, добрий день!'],
    ['Коваль Олена', 'Олено, добрий день!'],
    ['Олена', 'Олено, добрий день!'],
    ['Ігор Миколайович Шевчук', 'Ігорю Миколайовичу, добрий день!'],
    ['Шевчук Ігор Миколайович', 'Ігорю Миколайовичу, добрий день!'],
    ['Олег Петрович', 'Олеже Петровичу, добрий день!'],
    ['Петро Іванович', 'Петре Івановичу, добрий день!'],
    ['Андрій Васильович', 'Андрію Васильовичу, добрий день!'],
    ['Олександр Сергійович Бондар', 'Олександре Сергійовичу, добрий день!'],
    ['Василь', 'Василю, добрий день!'],
    ['Іван Ткаченко', 'Іване, добрий день!'],
    ['Ольга Миколаївна', 'Ольго Миколаївно, добрий день!'],
    ['Марія', 'Маріє, добрий день!'],
    ['Галина Степанівна', 'Галино Степанівно, добрий день!'],
    ['Юлія Ковальчук', 'Юліє, добрий день!'],
    ['Надія Петрівна', 'Надіє Петрівно, добрий день!'],
    ['Ірина', 'Ірино, добрий день!'],
    ['Тетяна Олегівна', 'Тетяно Олегівно, добрий день!'],
    ['Ганна Іллівна', 'Ганно Іллівно, добрий день!'],
    ['Наталя Іванівна', 'Наталю Іванівно, добрий день!'],
    ['Любов Іванівна Мельник', 'Любове Іванівно, добрий день!'],
    ['Микола Ілліч', 'Миколо Іллічу, добрий день!'],
    ['ОЛЕНА ПЕТРІВНА КОВАЛЬ', 'Олено Петрівно, добрий день!'],
    ['олена петрівна', 'Олено Петрівно, добрий день!'],
    ['Олександра-Вікторія Костянтинівна Миколаєнко-Шевчук', 'Олександро-Вікторіє Костянтинівно, добрий день!'],
    ['Дар’я Сергіївна', 'Дарʼє Сергіївно, добрий день!'],
    ['Олена Бабич', 'Олено, добрий день!'],
    // Немає певності — без імені.
    ['Коваль', GREETING_FALLBACK],
    ['Шевчук Коваль', GREETING_FALLBACK],
    ['Olena Koval', GREETING_FALLBACK],
    ['Олена Koval', GREETING_FALLBACK],
    ['О. П. Коваль', GREETING_FALLBACK],
    ['Петрівна Олена', GREETING_FALLBACK],
    ['Елена Петровна', GREETING_FALLBACK],
    ['Олена Миколайович', GREETING_FALLBACK],
    ['Іван123', GREETING_FALLBACK],
    // Імені немає в словнику — без імені, навіть із по батькові.
    ['Аделіна Петрівна', GREETING_FALLBACK],
    ['Мирослава-Аделіна Петрівна', GREETING_FALLBACK],
    ['', GREETING_FALLBACK],
    [null, GREETING_FALLBACK],
    ['Олена Петрівна Коваль Друга Третя', GREETING_FALLBACK],
  ];
  for (const [name, want] of cases) assert.equal(teacherGreeting(name), want, String(name));
  // Без важких залежностей: словник і правила у самому модулі.
  assert.doesNotMatch(read('lib/teacher-greeting.js'), /import /);
  const pkg = read('package.json');
  assert.doesNotMatch(pkg, /shevchenko|tensorflow/);
});

test('підпис «Так, повідомляйте мене»: правильний, підроблений, відсутній', () => {
  const key = 'test-key';
  const sig = notifySig('k7mnp2xz', key);
  assert.match(sig, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(notifySig('k7mnp2xz', key), sig, 'той самий код — той самий підпис');
  assert.equal(checkNotifySig('k7mnp2xz', sig, key), true);
  assert.equal(checkNotifySig('k7mnp2xz', `${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`, key), false);
  assert.equal(checkNotifySig('k7mnp2xa', sig, key), false, 'підпис чужого коду');
  assert.equal(checkNotifySig('k7mnp2xz', sig, 'other-key'), false);
  assert.equal(checkNotifySig('k7mnp2xz', '', key), false);
  assert.equal(checkNotifySig('k7mnp2xz', undefined, key), false);
  assert.equal(checkNotifySig('k7mnp2xz', sig.slice(0, 10), key), false);
  assert.equal(notifyPath('k7mnp2xz', key), `/olimpiada/pedagog?c=k7mnp2xz&notify=1&s=${sig}`);
  assert.equal(NOTIFY_ACTION, '/api/olimpiada/teacher/notify');
  // Ключ — сервісний ключ Supabase; у продакшні без нього підпису немає зовсім.
  assert.equal(notifyKey({ SUPABASE_SERVICE_ROLE_KEY: 'srv', NODE_ENV: 'production' }), 'srv');
  assert.equal(notifyKey({ NODE_ENV: 'production' }), null);
  assert.equal(notifySig('k7mnp2xz', null), null);
  assert.equal(checkNotifySig('k7mnp2xz', sig, null), false);
  // Згоду записує лише POST кнопки; GET (сканер посилань) — лише на підтвердження.
  const route = read('app/api/olimpiada/teacher/notify/route.js');
  const [getPart, postPart] = route.split('export async function POST');
  assert.ok(postPart, 'є POST');
  assert.doesNotMatch(getPart, /setTeacherNotify/);
  assert.match(getPart, /&notify=1&s=/);
  assert.match(postPart, /await request\.formData\(\)/);
  assert.match(postPart, /if \(!checkNotifySig\(code, s\)\) return go\(request, teacherPagePath\(code\)\);/);
  assert.match(postPart, /await store\.setTeacherNotify\(code\)/);
  assert.match(postPart, /`\$\{teacherPagePath\(code\)\}&ok=1`/);
  const sql = read('supabase/migrations/20261011b_olimpiada_teachers_notify.sql');
  assert.match(sql, /add column if not exists notify_ok_at timestamptz/);
});

test('згода на листи: повторне натискання не перезаписує першу дату', async () => {
  const store = getStore();
  assert.ok(store?.dev);
  const { row } = await store.createTeacher({ code: 'nnnnnnn2', olimp: OLIMP.slug, name: 'Олена Коваль', email: 'notify@example.com' });
  assert.equal(row.notify_ok_at, null);
  const first = await store.setTeacherNotify('nnnnnnn2');
  assert.ok(first.notify_ok_at);
  await new Promise((r) => setTimeout(r, 5));
  const again = await store.setTeacherNotify('nnnnnnn2');
  assert.equal(again.notify_ok_at, first.notify_ok_at);
  assert.equal(await store.setTeacherNotify('zzzzzzzz'), null);
  const server = read('lib/olimpiada-server.js');
  assert.match(server, /\.eq\('code', code\)\.is\('notify_ok_at', null\)/);
});

test('подяка видається один раз — на 5-му учневі', async () => {
  const store = getStore();
  const code = 'ttttttt5';
  await store.createTeacher({ code, olimp: OLIMP.slug, name: 'Олена Петрівна Коваль', email: 'thanks@example.com' });
  const finish = async (i) => {
    const e = await store.create({ child_name: `Учень ${i}`, parent_email: `k${i}@example.com`, teacher_code: code });
    await store.update(e.token, { finished_at: new Date().toISOString() });
  };
  for (let i = 1; i < TEACHER_THANKS_AT; i += 1) {
    await finish(i);
    assert.equal(await thankTeacher(store, code), false, `учень ${i}`);
    assert.equal((await store.teacherByCode(code)).thanks_sent_at, null);
  }
  await finish(TEACHER_THANKS_AT);
  assert.equal(await thankTeacher(store, code), true);
  const issued = (await store.teacherByCode(code)).thanks_sent_at;
  assert.ok(issued);
  await finish(TEACHER_THANKS_AT + 1);
  assert.equal(await thankTeacher(store, code), false, 'другої подяки немає');
  assert.equal((await store.teacherByCode(code)).thanks_sent_at, issued);
});

test('номер подяки: ПД- і uuid педагога, не код посилання', async () => {
  const t = { id: '3f9a1c2e-7b4d-4e1a-9c3b-0a1b2c3d4e5f', code: 'k7mnp2xz' };
  assert.equal(teacherThanksNo(t), 'ПД-3F9A1C2E');
  assert.equal(teacherThanksNo(t), teacherThanksNo({ ...t }), 'сталий — кеш на рік правдивий');
  assert.ok(!teacherThanksNo(t).includes(t.code.toUpperCase()));
  assert.equal(teacherThanksNo({ code: 'k7mnp2xz' }), null);
  assert.equal(teacherThanksNo(null), null);
  // Локальне сховище теж дає педагогам id.
  const { row } = await getStore().createTeacher({ code: 'iiiiiii2', olimp: OLIMP.slug, name: 'Олена Коваль', email: 'id@example.com' });
  assert.match(teacherThanksNo(row), /^ПД-[0-9A-F]{8}$/);
  const route = read('app/api/olimpiada/diploma/route.js');
  assert.match(route, /const no = teacherThanksNo\(teacher\);/);
  assert.match(route, /no: 'зразок'/);
  assert.doesNotMatch(route, /teacherThanksNo\(code\)|`№ \$\{code/);
  const img = read('lib/olimpiada-thanks-image.js');
  assert.match(img, /no: no \? `№ \$\{no\}` : null/);
});

test('дата на подяці — місяць і рік видачі, за Києвом', () => {
  assert.equal(teacherThanksDate('2026-10-11T10:00:00Z'), 'Жовтень 2026');
  assert.equal(teacherThanksDate('2026-10-31T22:30:00Z'), 'Листопад 2026');
  assert.equal(teacherThanksDate('2027-01-05T00:00:00Z'), 'Січень 2027');
});

test('заявка: код педагога — лише якщо педагог є; здача тесту шле подяку', () => {
  const start = read('app/api/olimpiada/start/route.js');
  assert.match(start, /const teacher = await teacherForEntry\(store, b\.teacher\);/);
  assert.match(start, /\.\.\.\(teacher \? \{ teacher_code: teacher\.code \} : \{\}\)/);
  const submit = read('app/api/olimpiada/submit/route.js');
  assert.match(submit, /if \(entry\.teacher_code\) await thankTeacher\(store, entry\.teacher_code\);/);
  const form = read('app/olimpiada/EntryForm.js');
  assert.match(form, /teacher: teacherRef\(\),/);
  assert.match(form, /get\('vid'\)/);
});

test('сторінка олімпіади: блок для педагогів із формою й зразком подяки', () => {
  const page = read('app/olimpiada/page.js');
  assert.ok(page.includes('<p className="ol-kicker">Для педагогів</p>'));
  assert.ok(page.includes('Ви педагог? Залучіть учнів до цікавої олімпіади'));
  assert.ok(page.includes('Отримайте від нас окрему подяку за учнів, які пройдуть олімпіаду за вашим посиланням.'));
  assert.ok(page.includes('id="pedagogam"'));
  assert.ok(page.includes('data-cta="teacher"'));
  assert.ok(page.includes('<TeacherForm />'));
  assert.ok(page.includes('/api/olimpiada/diploma?kind=teacher&sample=1'));
  assert.ok(page.includes('<figcaption>Подяку надсилаємо, коли за вашим посиланням олімпіаду пройдуть {TEACHER_THANKS_AT} учнів</figcaption>'));
  assert.doesNotMatch(page, /число учнів оновлюється|з першого учня/);
  // Блок — після призів і заявки, перед правилами.
  assert.ok(page.indexOf('id="uchast"') < page.indexOf('id="pedagogam"'));
  assert.ok(page.indexOf('id="pedagogam"') < page.indexOf('Правила олімпіади'));
  const form = read('app/olimpiada/TeacherForm.js');
  assert.ok(form.includes('placeholder="Олена Петрівна Коваль"'));
  assert.ok(form.includes('name="website"'), 'приманка для ботів');
  assert.ok(form.includes("trackConversion('olimpiada_teacher_signup'"));
});

test('подяка: дорослий дизайн, без числа учнів, 404 до видачі, довгий кеш', () => {
  const route = read('app/api/olimpiada/diploma/route.js');
  assert.match(route, /searchParams\.get\('kind'\) === 'teacher'/);
  assert.doesNotMatch(route, /kind === 'thanks'|'thanks'/);
  assert.match(route, /const LONG_CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';/);
  assert.match(route, /if \(!name \|\| !teacher\.thanks_sent_at\) return notFound\(\);/);
  assert.match(route, /date: teacherThanksDate\(teacher\.thanks_sent_at\)/);
  assert.match(route, /renderThanks\(\{ name: TEACHER_SAMPLE\.name, date: 'Жовтень 2026', no: 'зразок', k: 0\.5 \}\), \{ 'Cache-Control': LONG_CACHE \}/);
  assert.doesNotMatch(route, /teacherFinished|ОЛІМПІАДУ ПРОЙШЛИ УЧНІ/);
  assert.equal(TEACHER_SAMPLE.name, 'Олена Петрівна Коваль');
  assert.equal(TEACHER_SAMPLE.count, undefined);
  assert.ok(DIPLOMA_VERSION >= 9, 'старий дитячий зразок не має лишитись у кеші');

  const img = read('lib/olimpiada-thanks-image.js');
  for (const c of ['#14254a', '#fbf8f1', '#d9b77a', '#e85d24']) assert.ok(img.includes(`'${c}'`), c);
  assert.ok(img.includes("'linear-gradient(135deg, #14254a 0%, #3a3f8f 45%, #e85d24 100%)'"), 'рамка-градієнт');
  assert.ok(DIPLOMA_VERSION >= 11, 'зразок із градієнтом і номером — нова адреса');
  assert.ok(img.includes('>dityam.com.ua</div>'), 'лого');
  assert.match(img, /fontFamily: 'Caveat', fontWeight: 700, fontSize: px\(64\), color: ORANGE/);
  assert.ok(img.includes('>ПОДЯКА</div>'));
  assert.ok(img.includes('>НАГОРОДЖУЄТЬСЯ</div>'));
  // Медалі з «D» і будь-яких монограм — ніколи (Марія, 11.10.2026).
  assert.doesNotMatch(img, />D<\/div>|Medal|radialGradient|<circle/);
  assert.ok(img.includes('за залучення учнів до онлайн-олімпіади</div>'));
  assert.ok(img.includes('з логіки та внесок у розвиток</div>'));
  assert.ok(img.includes('їхнього логічного мислення</div>'));
  assert.ok(img.includes('>Марія Шутяк</div>'));
  assert.ok(img.includes('засновниця Dityam.com.ua'));
  assert.ok(img.includes("'Lora-SemiBold.ttf'"));
  assert.doesNotMatch(img, /count|учні:|Monster|Cloud/);
  // Шрифт справді в репозиторії і з кирилицею (cmap перевіряли при додаванні).
  const font = readFileSync(new URL('../public/fonts/Lora-SemiBold.ttf', import.meta.url));
  assert.ok(font.length > 100000);
});

test('сторінка педагога: без індексу й свіжа', () => {
  const p = read('app/olimpiada/pedagog/page.js');
  assert.match(p, /robots: \{ index: false, follow: false \}/);
  assert.match(p, /export const dynamic = 'force-dynamic';/);
  assert.match(p, /export const fetchCache = 'force-no-store';/);
  assert.ok(p.includes('Завантажити подяку'));
  // До видачі — поступ «N з 5», після — подяка; адреса картинки без числа учнів.
  assert.ok(p.includes('Олімпіаду пройшли <b>{done} з {TEACHER_THANKS_AT}</b> учнів'));
  assert.ok(p.includes('role="progressbar"'));
  assert.match(p, /const issued = Boolean\(teacher\.thanks_sent_at\);/);
  assert.match(p, /const img = `\/api\/olimpiada\/diploma\?kind=teacher&c=\$\{code\}&v=\$\{DIPLOMA_VERSION\}`;/);
  assert.doesNotMatch(p, /&n=\$\{count\}|оновлюється/);
  assert.ok(p.includes('Дякуємо! Повідомлятимемо вас про олімпіади й конкурси для ваших учнів'));
  assert.ok(p.includes("(searchParams?.ok === '1' || searchParams?.notify === '1') && notifyOk"));
  // Підтвердження з листа: перевіряємо підпис і показуємо форму з POST.
  assert.ok(p.includes("searchParams?.notify === '1' && checkNotifySig(code, searchParams?.s)"));
  assert.ok(p.includes('<form method="post" action={NOTIFY_ACTION}'));
  assert.ok(p.includes('<button type="submit" className="ol-btn ol-btn-main">Так, повідомляйте мене</button>'));
});

test('статистика педагогів: лише учні відомих педагогів, без тестів адміна', () => {
  const s = olimpTeachers({
    teachers: [{ code: 'aaaaaaaa', thanks_sent_at: 'x', notify_ok_at: 'y' }, { code: 'bbbbbbbb', notify_ok_at: 'y' }, { code: 'cccccccc' }],
    entries: [
      { teacher_code: 'aaaaaaaa', finished_at: 'x' },
      { teacher_code: 'aaaaaaaa', finished_at: 'x' },
      { teacher_code: 'aaaaaaaa', finished_at: null },
      { teacher_code: 'bbbbbbbb', finished_at: 'x', wfp_last_status: 'Test' },
      { teacher_code: 'zzzzzzzz', finished_at: 'x' },
    ],
  });
  assert.deepEqual(s, { teachers: 3, entries: 3, finished: 2, active: 1, thanked: 1, notifyOk: 2 });
  assert.ok(read('app/admin/metrics/page.js').includes('погодились на листи: ${olimpTeach.notifyOk}'));
  assert.ok(SITE_EVENT_NAMES.includes('olimp_teacher_signup'));
});
