import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS } from '../lib/topics.js';

// Правила добору підбірок матчать лише ПОЧАТОК слова у НАЗВІ: без цього
// «курс» ловив усі 91 «конКУРС» і сторінка гуртків показувала конкурси.
test('«курс» не матчить «конкурс» (word boundary)', () => {
  const o = { cost_type: 'free', aid_type: null, opportunity_type: null,
              title: 'Конкурс малюнка для дітей', cities: [] };
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(o), false);
  assert.equal(TOPICS['konkursy'].match(o), true);
});

test('гурток за типом потрапляє в підбірку і без слова в назві', () => {
  const o = { cost_type: 'free', aid_type: null, opportunity_type: 'club',
              title: 'Юні натуралісти', cities: [] };
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(o), true);
});

test('держвиплата не потрапляє в гуртки навіть зі словом «курс»', () => {
  const o = { cost_type: 'free', aid_type: 'retraining', opportunity_type: 'course',
              title: 'Курси перекваліфікації УБД', cities: [] };
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(o), false);
});

// «За кордоном»: лише справжні поїздки. Гурток в Ірландії для родин, які вже
// виїхали, і онлайн-курс закордонного організатора сюди не потрапляють.
//
// Обміни — теж ні, хоч дитина й їде: з 28.09.2026 вони живуть тільки в
// /prohramy-obminu. Доти FLEX стояв на обох сторінках (18 спільних записів із
// 29), Google бачив дві сторінки про одне й показував їх поспіль.
test('за кордон: обмін — ні, він у програмах обміну', () => {
  const o = { opportunity_type: 'exchange', title: 'Програма обміну FLEX',
              countries: ['us'], is_international: true, format: 'Офлайн', cities: [] };
  assert.equal(TOPICS['za-kordon'].match(o), false);
  assert.equal(TOPICS['prohramy-obminu'].match(o), true);
});

test('за кордон: табір за кордоном — так', () => {
  const o = { opportunity_type: 'camp', title: 'Літній табір у Польщі',
              countries: ['pl'], is_international: true, format: 'Офлайн', cities: [] };
  assert.equal(TOPICS['za-kordon'].match(o), true);
  assert.equal(TOPICS['prohramy-obminu'].match(o), false);
});

test('за кордон: міжнародна олімпіада без країни — так', () => {
  const o = { opportunity_type: 'olympiad', title: 'Міжнародна біологічна олімпіада',
              countries: [], is_international: true, format: 'Офлайн', cities: ['Міжнародні'] };
  assert.equal(TOPICS['za-kordon'].match(o), true);
});

test('за кордон: гурток для родин, які вже за кордоном — ні', () => {
  const o = { opportunity_type: 'club', title: 'Art classes for Ukrainian families',
              countries: ['ie'], is_international: false, format: 'Офлайн', cities: [] };
  assert.equal(TOPICS['za-kordon'].match(o), false);
});

test('за кордон: онлайн-курс закордонного організатора — ні, підготовка до вступу за кордон — так', () => {
  const online = { opportunity_type: 'course', title: 'English for STEM',
                   countries: ['ie'], is_international: true, format: 'Онлайн', cities: ['Онлайн'] };
  assert.equal(TOPICS['za-kordon'].match(online), false);
  const prep = { opportunity_type: 'course', title: 'Підготовка до вступу в закордонні школи',
                 countries: [], is_international: true, format: 'Онлайн', cities: ['Онлайн'] };
  assert.equal(TOPICS['za-kordon'].match(prep), true);
});

test('за кордон: український гурток із міткою «міжнародний» — ні', () => {
  const o = { opportunity_type: 'club', title: 'Дитячий хор',
              countries: ['ua'], is_international: true, format: 'Офлайн', cities: ['Київ'] };
  assert.equal(TOPICS['za-kordon'].match(o), false);
});

// «Дітям ветеранів»: сюди потрапляє лише те, де статус родини — умова участі.
// Окреме слово «ветеран» будь-де в описі ловило 99 записів, у яких ветерани
// згадані мимохідь: у переліку партнерів, в історії організації, у складі
// журі. Родина, яка витратить сили на таку програму, дізнається про помилку
// вже в заявці, тому правило вимагає звʼязки «діти/родини» + статус.
test('дітям ветеранів: мітка child_needs достатня', () => {
  const o = { title: 'Табір у Карпатах', summary: '', child_needs: ['veteran_family'] };
  assert.equal(TOPICS['dity-zakhysnykiv'].match(o), true);
});

test('дітям ветеранів: звʼязка «діти + загиблі» у тексті — так', () => {
  const o = { title: 'Безкоштовний табір', child_needs: [],
              summary: 'Путівки для дітей загиблих захисників України, 7–17 років.' };
  assert.equal(TOPICS['dity-zakhysnykiv'].match(o), true);
});

test('дітям ветеранів: згадка ветеранів мимохідь — ні', () => {
  const o = { title: 'StudBiz Award — премія для шкільних підприємств', child_needs: [],
              summary: 'Серед партнерів премії — ветеранські організації та бізнес.' };
  assert.equal(TOPICS['dity-zakhysnykiv'].match(o), false);
});

// Блок «Лише для дітей захисників» дивиться тільки на назву: статус у назві —
// це те, що батько бачить першим. Табір для кількох пільгових груп, де діти
// військових згадані в описі, лишається в другому блоці.
test('лише для дітей захисників: статус у назві — так', () => {
  const ex = TOPICS['dity-zakhysnykiv'].exclusive;
  assert.equal(ex({ title: '8 000 грн щомісяця дітям-сиротам, один із батьків яких загинув, захищаючи Україну' }), true);
  assert.equal(ex({ title: 'Стипендія дітям загиблих захисників' }), true);
  assert.equal(ex({ title: 'Supporting Children of Ukrainian Heroes' }), true);
});

test('лише для дітей захисників: пільгові категорії чи «військова агресія» — ні', () => {
  const ex = TOPICS['dity-zakhysnykiv'].exclusive;
  assert.equal(ex({ title: 'Безкоштовне оздоровлення дітей пільгових категорій 2026' }), false);
  assert.equal(ex({ title: 'Фонд «Діти Героїв» — допомога дітям-сиротам від військової агресії' }), false);
  assert.equal(ex({ title: '«Блогер Кемп» — друга осіння зміна' }), false);
});

// Сторожа розведення. 28.09.2026 обидві сторінки виходили в Google на той
// самий запит (5-та і 6-та позиції поспіль) і ділили трафік: 205 входів проти
// 16. Причина — 18 записів із 29 стояли на обох. Правило тепер одне
// (isExchangeProgramme), тож жоден запис не може опинитися на двох сторінках;
// цей тест падає, якщо добір знову розʼїдеться.
test('обміни і «за кордоном» не перетинаються — жодного запису на двох сторінках', () => {
  const types = ['exchange', 'study_program', 'internship', 'residency', 'camp',
                 'olympiad', 'competition', 'volunteer', 'scholarship', 'conference',
                 'summer_school', 'festival', 'hackathon'];
  const titles = ['Програма обміну FLEX', 'AFS: семестр у Європі', 'Літній табір у Польщі',
                  'Erasmus+ для молоді', 'Міжнародний конкурс малюнка', 'Волонтерство в Іспанії'];
  for (const opportunity_type of types) {
    for (const title of titles) {
      for (const is_international of [true, false]) {
        for (const countries of [[], ['pl'], ['ua']]) {
          const o = { opportunity_type, title, countries, is_international,
                      format: 'Офлайн', cities: [] };
          const both = TOPICS['za-kordon'].match(o) && TOPICS['prohramy-obminu'].match(o);
          assert.equal(both, false, `${opportunity_type} / ${title} стоїть на двох сторінках`);
        }
      }
    }
  }
});

// --- нові підбірки під пошук, 30.09.2026 ---

test('волонтерство: бере волонтерські проєкти', () => {
  const o = { opportunity_type: 'volunteer', title: 'SCI Short-Term Volunteering',
              summary: 'короткострокове волонтерство', countries: [], cities: [], format: 'offline' };
  assert.equal(TOPICS['volonterstvo'].match(o), true);
});

// Обміни лишаються за /prohramy-obminu: стажування й резиденції туди
// потрапляють за типом, і без цього винятку ми повторили б історію
// «за кордон проти обмінів» — дві сторінки на той самий запит.
test('волонтерство: програму обміну не забирає', () => {
  const o = { opportunity_type: 'internship', title: 'AIESEC — волонтерське стажування',
              summary: '', countries: [], cities: [], format: 'offline' };
  assert.equal(TOPICS['volonterstvo'].match(o), false);
  assert.equal(TOPICS['prohramy-obminu'].match(o), true);
});

test('виплати: бере грошову допомогу й не бере гурток', () => {
  const pay = { opportunity_type: 'support_payment', title: 'Грошова допомога ЮНІСЕФ',
                summary: '', cities: [], countries: [] };
  const club = { opportunity_type: 'club', title: 'Гурток робототехніки',
                 summary: '', cities: ['Київ'], countries: [] };
  assert.equal(TOPICS['dopomoha-rodynam'].match(pay), true);
  assert.equal(TOPICS['dopomoha-rodynam'].match(club), false);
});

test('виплати: бере запис із aid_type cash будь-якого типу', () => {
  const o = { opportunity_type: 'scholarship', aid_type: 'cash', title: 'Виплата родинам',
              summary: '', cities: [], countries: [] };
  assert.equal(TOPICS['dopomoha-rodynam'].match(o), true);
});

// Сторінка обіцяє психологічну допомогу, тож ловити її має тільки за типом.
// Регулярка по тексту тягнула сюди гуртки «з елементами арттерапії» — а це
// обіцянка, якої запис не виконує.
test('психологічна допомога: лише допомога, не гуртки з арттерапією', () => {
  const help = { opportunity_type: 'psychology', title: '«Діти воїнів» — групи підтримки',
                 summary: '', cities: [], countries: [] };
  const club = { opportunity_type: 'club', title: 'Студія малювання з елементами арттерапії',
                 summary: 'заняття з психологом', cities: ['Львів'], countries: [] };
  assert.equal(TOPICS['psykholohichna-dopomoha'].match(help), true);
  assert.equal(TOPICS['psykholohichna-dopomoha'].match(club), false);
});

test('кожна нова підбірка має власні title, description і FAQ', () => {
  for (const slug of ['volonterstvo', 'dopomoha-rodynam', 'psykholohichna-dopomoha']) {
    const t = TOPICS[slug];
    assert.ok(t, slug);
    for (const field of ['title', 'description', 'intro', 'note']) {
      assert.ok(t[field] && t[field].length > 40, `${slug}: ${field}`);
      assert.ok(t.en[field] && t.en[field].length > 40, `${slug}: en.${field}`);
    }
    assert.equal(t.faq.length, 3, `${slug}: FAQ`);
    assert.equal(t.en.faq.length, 3, `${slug}: en FAQ`);
    assert.ok(t.en.slug && t.en.slug !== slug, `${slug}: en.slug`);
  }
});

// Титули двох сторінок не мають починатися з тих самих слів: саме так
// /za-kordon і /prohramy-obminu опинились у Google поруч на один запит.
test('жодні дві підбірки не починаються з однакових трьох слів у title', () => {
  const seen = new Map();
  for (const [slug, t] of Object.entries(TOPICS)) {
    if (!t.title || t.city) continue;
    const key = t.title.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
    assert.ok(!seen.has(key), `«${key}…» — і ${seen.get(key)}, і ${slug}`);
    seen.set(key, slug);
  }
});

// --- онлайн-заняття, 30.09.2026 ---
//
// Доти всі 66 безкоштовних онлайн-занять лежали в «Гуртках», а title тієї
// сторінки прямо обіцяв «онлайн і в містах України» — одна сторінка ловила
// два різні запити й жоден добре.
const onlineCourse = {
  opportunity_type: 'course', cost_type: 'free', aid_type: null, format: 'online',
  title: 'Безкоштовний онлайн-курс програмування', summary: '', cities: ['Онлайн'], countries: [],
};
const cityClub = {
  opportunity_type: 'club', cost_type: 'free', aid_type: null, format: 'offline',
  title: 'Гурток робототехніки', summary: '', cities: ['Київ'], countries: [],
};

test('онлайн-заняття: бере безкоштовний онлайн-курс, гурток у місті — ні', () => {
  assert.equal(TOPICS['bezkoshtovni-onlain-kursy'].match(onlineCourse), true);
  assert.equal(TOPICS['bezkoshtovni-onlain-kursy'].match(cityClub), false);
});

test('«Гуртки» на головній більше не показують онлайн', () => {
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(onlineCourse), false);
  assert.equal(TOPICS['bezkoshtovni-hurtky'].match(cityClub), true);
});

// А на сторінці міста всеукраїнський онлайн-гурток лишається: батькам у малому
// місті він доступний так само, як місцевий.
test('на сторінці міста онлайн-заняття лишається видимим', () => {
  assert.equal(TOPICS['bezkoshtovni-hurtky'].cityMatch(onlineCourse), true);
});

test('онлайн-заняття: платне й конкурс не беремо', () => {
  const paid = { ...onlineCourse, cost_type: 'paid_affordable' };
  const contest = { ...onlineCourse, opportunity_type: 'competition', title: 'Онлайн-конкурс малюнка' };
  assert.equal(TOPICS['bezkoshtovni-onlain-kursy'].match(paid), false);
  assert.equal(TOPICS['bezkoshtovni-onlain-kursy'].match(contest), false);
});

// «Онлайн-курси у Києві» — запит, якого ніхто не ставить.
test('онлайн-заняття не породжують міських сторінок', () => {
  assert.equal(TOPICS['bezkoshtovni-onlain-kursy'].noCityPages, true);
});
