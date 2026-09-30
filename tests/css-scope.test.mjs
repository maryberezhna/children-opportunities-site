import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Стилі однієї сторінки не їдуть на всі (30.09.2026, «чи можна сайт зробити
 * ще швидшим»). До того globals.css тягнув усі 310 КБ CSS на кожну сторінку;
 * тепер підбірки, сторінка можливості, /plus, /about, /press, /contacts,
 * /dedlainy і /dyakuyu підключають своє самі, а в globals.css лишається
 * спільне. Тест тримає межу: маршрутний файл не має повернутись у globals,
 * а сторінка — лишитись без свого файлу.
 */
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const globals = read('app/globals.css');

test('globals.css не підключає стилі окремих сторінок', () => {
  for (const f of ['support-section', 'topic-v2', 'opportunity-page', 'opportunity-mobile', 'plus-promo',
    'plus-landing', 'press-v2', 'about-v2', 'contact-form', 'deadlines', 'legal-pages']) {
    assert.ok(!globals.includes(`styles/${f}.css`), `${f}.css має підключати сторінка, не globals`);
  }
  // Спільне лишається спільним: крихти, картки, шапка, футер, статичні сторінки.
  for (const f of ['base', 'cards', 'site-header', 'static-pages', 'home-v2', 'home-mobile', 'responsive']) {
    assert.ok(globals.includes(`styles/${f}.css`), `${f}.css має бути в globals`);
  }
});

test('кожна сторінка підключає свій пакет стилів', () => {
  const pairs = [
    ['app/TopicPage.js', 'styles/routes/topic.css'],
    ['app/olimpiady/page.js', 'styles/routes/topic.css'],
    ['app/erasmus/page.js', 'styles/routes/topic.css'],
    ['app/CollectionsHub.js', 'styles/routes/topic.css'],
    ['app/o/shared.js', 'styles/routes/opportunity.css'],
    ['app/events/[slug]/add/page.js', 'styles/routes/opportunity.css'],
    ['app/plus/PlusLanding.js', 'styles/plus-landing.css'],
    ['app/about/page.js', 'styles/routes/about.css'],
    ['app/en/about/page.js', 'styles/routes/about.css'],
    ['app/press/page.js', 'styles/press-v2.css'],
    ['app/contacts/ContactForm.js', 'styles/contact-form.css'],
    ['app/dedlainy/page.js', 'styles/deadlines.css'],
    ['app/dyakuyu/ThankYou.js', 'styles/legal-pages.css'],
  ];
  for (const [js, css] of pairs) assert.ok(read(js).includes(css), `${js} має імпортувати ${css}`);
  // Пакети зберігають порядок каскаду, що був у globals.css.
  const topic = read('app/styles/routes/topic.css');
  assert.ok(topic.indexOf('support-section.css') < topic.indexOf('topic-v2.css'));
  const opp = read('app/styles/routes/opportunity.css');
  assert.ok(opp.indexOf('opportunity-page.css') < opp.indexOf('opportunity-mobile.css'), 'мобільні правила — останніми');
});

test('правила, потрібні всюди, живуть у глобальних файлах', () => {
  // Крихти є на сторінці можливості, юридичних сторінках і «місто × підбірка».
  assert.ok(read('app/styles/static-pages.css').includes('.opportunity-breadcrumbs {'));
  assert.ok(!read('app/styles/opportunity-page.css').includes('.opportunity-breadcrumbs'));
  // Клікабельна картка — на кожній сторінці з картками.
  assert.ok(read('app/styles/cards.css').includes('.card-title-link::after'));
  // Мертві файли не повертаються.
  for (const f of ['filters', 'footer', 'subscribe-section', 'subscribe-modal']) {
    assert.ok(!fs.existsSync(new URL(`../app/styles/${f}.css`, import.meta.url)), `${f}.css мертвий`);
  }
});
