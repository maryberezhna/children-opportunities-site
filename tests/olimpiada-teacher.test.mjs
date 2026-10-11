// Педагоги онлайн-олімпіади (Марія, 11.10.2026): «Ви педагог? Хочете залучити
// дітей до цікавої олімпіади? Отримайте від нас окрему подяку за учнів, які
// пройдуть олімпіаду за вашим посиланням».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import {
  teacherCode, validTeacherCode, teacherName, teacherLink, teacherPagePath, teacherInvite, TEACHER_CODE_LEN, OLIMP,
} from '../lib/olimpiada.js';
import { olimpTeachers } from '../lib/olimpiada-stats.js';
import { buildTeacherWelcome, buildTeacherThanks } from '../lib/olimpiada-mail.js';
import { SITE_EVENT_NAMES } from '../lib/site-events.js';

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

test('листи педагогу: посилання є, імені дитини немає, без «Dityam+ —»', () => {
  const t = { code: 'k7mnp2xz', email: 'olena@example.com', name: 'Олена Петрівна Коваль' };
  const w = buildTeacherWelcome(t);
  assert.ok(w.text.includes('https://dityam.com.ua/olimpiada?vid=k7mnp2xz'));
  assert.ok(w.text.includes('https://dityam.com.ua/olimpiada/pedagog?c=k7mnp2xz'));
  const th = buildTeacherThanks(t, 1);
  assert.equal(th.subject, 'Перший учень за вашим посиланням пройшов олімпіаду — ось ваша подяка');
  assert.ok(th.html.includes('/olimpiada/pedagog?c=k7mnp2xz'));
  assert.ok(!th.text.includes('Учнів, які вже пройшли'), 'при 1 учні число не повторюємо');
  assert.ok(buildTeacherThanks(t, 3).text.includes(': 3.'));
  for (const m of [w, th]) assert.doesNotMatch(`${m.subject}${m.text}${m.html}`, /Dityam\+\s*[—–-]/);
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
  // Блок — після призів і заявки, перед правилами.
  assert.ok(page.indexOf('id="uchast"') < page.indexOf('id="pedagogam"'));
  assert.ok(page.indexOf('id="pedagogam"') < page.indexOf('Правила олімпіади'));
  const form = read('app/olimpiada/TeacherForm.js');
  assert.ok(form.includes('placeholder="Олена Петрівна Коваль"'));
  assert.ok(form.includes('name="website"'), 'приманка для ботів');
  assert.ok(form.includes("trackConversion('olimpiada_teacher_signup'"));
});

test('подяка: kind=teacher, без старого «від батьків» (kind=thanks, імені дитини)', () => {
  const route = read('app/api/olimpiada/diploma/route.js');
  assert.match(route, /searchParams\.get\('kind'\) === 'teacher'/);
  assert.doesNotMatch(route, /kind === 'thanks'|'thanks'/);
  assert.ok(route.includes('ОЛІМПІАДУ ПРОЙШЛИ УЧНІ'));
  assert.ok(route.includes('педагогу'));
  // Рядок розбито вручну на 2: «за те, що залучили учнів» / «до онлайн-олімпіади з логіки».
  assert.ok(route.includes('за те, що залучили учнів</div>'));
  assert.ok(route.includes('до онлайн-олімпіади з логіки</div>'));
  assert.doesNotMatch(route, /ДИПЛОМ ОЛІМПІАДИ ОТРИМАНО/);
});

test('сторінка педагога: без індексу й свіжа', () => {
  const p = read('app/olimpiada/pedagog/page.js');
  assert.match(p, /robots: \{ index: false, follow: false \}/);
  assert.match(p, /export const dynamic = 'force-dynamic';/);
  assert.match(p, /export const fetchCache = 'force-no-store';/);
  assert.ok(p.includes('Завантажити подяку'));
});

test('статистика педагогів: лише учні відомих педагогів, без тестів адміна', () => {
  const s = olimpTeachers({
    teachers: [{ code: 'aaaaaaaa' }, { code: 'bbbbbbbb' }, { code: 'cccccccc' }],
    entries: [
      { teacher_code: 'aaaaaaaa', finished_at: 'x' },
      { teacher_code: 'aaaaaaaa', finished_at: 'x' },
      { teacher_code: 'aaaaaaaa', finished_at: null },
      { teacher_code: 'bbbbbbbb', finished_at: 'x', wfp_last_status: 'Test' },
      { teacher_code: 'zzzzzzzz', finished_at: 'x' },
    ],
  });
  assert.deepEqual(s, { teachers: 3, entries: 3, finished: 2, thanked: 1 });
  assert.ok(SITE_EVENT_NAMES.includes('olimp_teacher_signup'));
});
