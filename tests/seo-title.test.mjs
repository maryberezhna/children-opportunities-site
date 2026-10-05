// Довжина заголовків, якими керуємо ми самі.
//
// Привід — Site Scan у Bing Webmaster Tools 05.10.2026: 678 сторінок, 0
// помилок, 215 попереджень, із них 156 «Title too long». Пошук показує
// близько 60 символів і далі обрізає.
//
// Тест стереже лише ті заголовки, які будує код за шаблоном. Назви самих
// програм не чіпаємо: це власні назви записів, і різати їх означало б
// показувати людині покалічену назву.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TITLE_MAX, fitTitle } from '../lib/seo-title.js';
import { CITY_TOPIC_TEXTS } from '../lib/city-topics.js';
import { CITY_META } from '../lib/cities.js';
import { opportunityTitle } from '../lib/opportunity-seo.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('fitTitle бере найповніший варіант, що вміщається', () => {
  assert.equal(fitTitle('x'.repeat(80), 'коротко'), 'коротко');
  assert.equal(fitTitle('коротко', 'ще коротше'), 'коротко');
  // Не вміщається жоден — лишається останній, найкоротший із написаних.
  assert.equal(fitTitle('x'.repeat(80), 'y'.repeat(70)), 'y'.repeat(70));
  assert.equal(fitTitle(null, '', 'щось'), 'щось');
});

test('місто × тема: заголовок без дубля назви сайту вміщається скрізь', () => {
  for (const [slug, texts] of Object.entries(CITY_TOPIC_TEXTS)) {
    for (const city of Object.values(CITY_META)) {
      const title = texts.title(city);
      assert.ok(title.length <= TITLE_MAX,
        `${slug} × ${city.locative}: ${title.length} символів — «${title}»`);
    }
  }
  // Саме absolute: без нього шаблон із layout.js дописує «| Можливості для
  // дитини» і з'їдає 24 символи — рівно те, через що сторінки й були довгі.
  assert.match(read('app/[city]/[topic]/page.js'), /title: \{ absolute: texts\.title\(cityData\) \}/);
});

test('англійські сторінки не тягнуть українського хвоста', () => {
  for (const f of ['app/en/page.js', 'app/en/[city]/page.js']) {
    assert.match(read(f), /title: \{\s*absolute:/, `${f}: заголовок не absolute`);
  }
  // Назва повна: «Dityam» без домену — заборонена скорочена форма.
  assert.match(read('app/en/page.js'), /Dityam\.com\.ua — opportunities/);
});

test('англійські міста: хвіст лишається, поки вміщається', () => {
  const build = (name) => fitTitle(
    `Opportunities for children in ${name} — courses, olympiads, scholarships`,
    `Opportunities for children in ${name} — courses and scholarships`,
    `Opportunities for children in ${name} — courses and camps`,
    `Opportunities for children in ${name}`,
  );
  for (const city of Object.values(CITY_META)) {
    const name = city.en || city.ua;
    const title = build(name);
    assert.ok(title.length <= TITLE_MAX, `${name}: ${title.length} — «${title}»`);
    // Голий заголовок без жодного ключового слова — ознака, що драбинка
    // закоротка: треба додати ще один варіант, а не лишати місто саме.
    assert.ok(title.includes(' — '), `${name}: лишився без хвоста — «${title}»`);
  }
  // Драбинка в коді, а не одна стрічка.
  const src = read('app/en/[city]/page.js');
  assert.match(src, /fitTitle\(/);
  assert.equal((src.match(/Opportunities for children in \$\{name\}/g) || []).length >= 4, true);
});

test('головна: заголовок вміщається за будь-якого числа програм', () => {
  for (const n of [400, 700, 1000, 5000]) {
    const uk = `Можливості для дитини — ${n}+ програм для українських дітей`;
    assert.ok(uk.length <= TITLE_MAX, `${n}: ${uk.length} — «${uk}»`);
  }
  assert.match(read('app/layout.js'), /Можливості для дитини — \$\{n\}\+ програм для українських дітей/);
  assert.ok('Dityam.com.ua — opportunities for Ukrainian children worldwide'.length <= TITLE_MAX);
});

test('назву програми не ріжемо — скорочуємо лише дописане нами', () => {
  const name = 'Всеукраїнський конкурс дитячого малюнка «Відважним воїнам і рідній Україні»';
  const title = opportunityTitle({ name, typeLabel: 'Конкурс', ageRange: '6-16 років' });
  assert.equal(title, name, 'довга назва програми лишається цілою');
  const short = opportunityTitle({ name: 'ISEF Ukraine', typeLabel: 'Конкурс', ageRange: '14-18 років' });
  assert.ok(short.length <= TITLE_MAX && short.includes('Конкурс'), short);
});
