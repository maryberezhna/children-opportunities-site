// «Топ тижня» — одна картка, що міняється (Марія, 04.10.2026: «1 можливість
// яку чітко видно… бо ми це продаємо, а зараз це тупо»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SLIDE_MS, dateParts, indexAtScroll, nextIndex, prevIndex, shouldAutoPlay, sliderCards,
} from '../lib/top-week-slider.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('перемикання йде по колу в обидва боки', () => {
  assert.deepEqual([0, 1, 2].map((i) => nextIndex(i, 3)), [1, 2, 0]);
  assert.deepEqual([0, 1, 2].map((i) => prevIndex(i, 3)), [2, 0, 1]);
});

test('порожній список не ламає лічильник', () => {
  assert.equal(nextIndex(0, 0), 0);
  assert.equal(prevIndex(0, 0), 0);
});

// Автокарусель, яка не спиняється, — класична проблема доступності
// (WCAG 2.2.2): людина не встигає ні дочитати, ні натиснути.
test('сама крутиться лише тоді, коли нікому не заважає', () => {
  assert.equal(shouldAutoPlay({ total: 3, touched: false, reducedMotion: false }), true);
  assert.equal(shouldAutoPlay({ total: 3, touched: true, reducedMotion: false }), false);
  assert.equal(shouldAutoPlay({ total: 3, touched: false, reducedMotion: true }), false);
  assert.equal(shouldAutoPlay({ total: 1, touched: false, reducedMotion: false }), false);
});

test('після ручного перемикання таймер більше не втручається', () => {
  // touched лишається true назавжди — далі вирішує людина, а не таймер.
  assert.equal(shouldAutoPlay({ total: 3, touched: true, reducedMotion: false }), false);
});

// Поточна картка рахується з прокрутки стрічки: її гортають і тачпадом, і
// пальцем, і табом, а не лише стрілками.
test('поточна картка — та, що ближче до початку стрічки', () => {
  const offsets = [0, 300, 600];
  assert.equal(indexAtScroll(0, offsets, 520), 0);
  assert.equal(indexAtScroll(140, offsets, 520), 0);
  assert.equal(indexAtScroll(170, offsets, 520), 1);
  // Остання картка не стає на початок — стрічка впирається раніше. У кінці
  // поточна все одно остання, інакше крапка «3» не загорялась би ніколи.
  assert.equal(indexAtScroll(520, offsets, 520), 2);
  assert.equal(indexAtScroll(0, [], 0), 0);
});

test('картка збирається однаково з рядка бази', () => {
  const [a, b] = sliderCards([
    { slug: 'a', title: 'Конкурс', deadline: '2026-10-04', opportunity_type: 'competition', cost_type: 'free' },
    { slug: 'b', title: 'Гурток', deadline: null, opportunity_type: 'club', cost_type: 'paid_affordable' },
  ], {
    lang: 'uk', pinned: 'Топ', free: 'безкоштовно',
    type: { competition: 'Конкурс', club: 'Гурток' }, age: () => '10–14 років',
  });
  assert.equal(a.day, 4);
  assert.equal(a.month, 'жовт');
  assert.equal(a.meta, 'Конкурс · 10–14 років · безкоштовно');
  // Без дедлайну — підпис замість числа, а не порожня плашка.
  assert.equal(b.day, null);
  assert.equal(b.dateLabel, 'Топ');
  assert.equal(b.meta, 'Гурток · 10–14 років', 'платне не підписуємо «безкоштовно»');
});

test('англійська назва береться, коли вона є', () => {
  const [card] = sliderCards([{ slug: 'a', title: 'Конкурс', title_en: 'Contest' }], { lang: 'en' });
  assert.equal(card.title, 'Contest');
});

test('дата без дедлайну не вигадується', () => {
  assert.equal(dateParts(null), null);
  assert.equal(dateParts('нема'), null);
});

// --- блок стоїть там, де його продають ---
//
// Марія: «помісти топ 3 у всіх добірках». Трійка на підбірці рахується з УСІХ
// живих записів, а не з тих, що підпадають під підбірку: інакше оплачене
// місце з'являлось би на одних сторінках і зникало на інших.
test('і головна, і підбірки показують той самий блок', () => {
  for (const f of ['app/HomeHero.js', 'app/TopicPage.js']) {
    const src = read(f);
    assert.match(src, /<TopWeekSlider/, `${f}: блоку немає`);
    assert.match(src, /sliderCards\(/, `${f}: картки збираються не спільною функцією`);
  }
});

test('у підбірці трійка рахується з усіх живих записів', () => {
  const src = read('app/TopicPage.js');
  assert.match(src, /topWeekCards\(\{ items: liveRows/,
    'трійка має бути та сама, що на головній, інакше її нічим продати');
});

// Марія, 07.10.2026: «має бути одразу видно, що це слайдер». Картки стосом,
// що мінялись на місці, виглядали як одна картка — тепер вони стоять у ряд,
// і край наступної видно праворуч.
test('видно, що це слайдер: край наступної картки й стрілки', () => {
  const src = read('app/TopWeekSlider.js');
  assert.match(src, /cards\.map/, 'усі картки мають бути в розмітці');
  assert.doesNotMatch(src, /aria-hidden=\{all \|\| n === i/,
    'картки знову ховаються — тоді краю наступної не видно');
  const css = read('app/styles/home-v2.css');
  const card = css.match(/\.v2-tw-card \{[^}]*\}/)[0];
  assert.match(card, /flex: 0 0 calc\(100% - \d+px\)/, 'картка на всю ширину — наступної не видно');
  assert.match(card, /scroll-snap-align: start/);
  assert.match(css, /\.v2-tw-track \{[^}]*overflow-x: auto/, 'стрічку не гортає тачпад');
  assert.match(src, /className="v2-tw-arrow"/);
});

// --- широкий розклад (Марія, 04.10.2026: «там можна всі 3 помістити») ---
//
// У підбірці блок на всю ширину, і одна картка в ньому виглядала порожньою
// коробкою. Три поруч — і каруселі там не треба зовсім.
test('у широкому розкладі каруселі немає', () => {
  const src = read('app/TopWeekSlider.js');
  assert.match(src, /const auto = slider && shouldAutoPlay/, 'таймер має мовчати, коли видно всі три');
  assert.match(src, /const slider = total > 1 && !all;/, 'крапок і стрілок при трьох картках поруч бути не має');
  assert.match(src, /slider \? \(\s*<div className="v2-tw-dots/);
  assert.match(src, /v2-tw--all/, 'немає класу широкого розкладу');
});

test('підбірка бере широкий розклад, головна — вузький', () => {
  assert.match(read('app/TopicPage.js'), /<TopWeekSlider\s*\n\s*all\b/, 'у підбірці мають бути всі три');
  assert.doesNotMatch(read('app/HomeHero.js'), /<TopWeekSlider\s*\n\s*all\b/,
    'у хіро колонка вузька — там одна картка, що міняється');
});

// Таймер — це анімація смужки на поточній крапці: картка міняється, коли
// вона добігає. Тому пауза — це пауза анімації, і смужка з таймером не
// розходяться. Людина бачить, що під мишею блок чекає, а не зламався.
test('пауза під мишею й на фокусі — смужка й таймер стають разом', () => {
  const src = read('app/TopWeekSlider.js');
  assert.match(src, /onAnimationEnd=\{\(\) => show\(nextIndex\(i, total\)\)\}/,
    'картку має міняти кінець смужки, а не окремий таймер');
  assert.doesNotMatch(src, /setInterval/, 'окремий таймер розійдеться зі смужкою під мишею');
  const css = read('app/styles/home-v2.css');
  assert.match(css, /\.v2-tw:hover \.v2-tw-fill,\s*\.v2-tw:focus-within \.v2-tw-fill \{ animation-play-state: paused; \}/,
    'карусель крутитиметься під рукою');
});

test('картку видно достатньо, щоб прочитати назву', () => {
  assert.ok(SLIDE_MS >= 5000, 'швидше 5 секунд назву не дочитати');
});

// На телефоні «Топ 3 цього тижня» показується рівно один раз і рівно одним
// виглядом — компактною смужкою.
//
// 05.10.2026 Марія: «о боже, як так сталося, що на мобільному 2 рази майже
// поруч показуються топ 3 тижня». На головній справді стояли обидва вигляди:
// великий блок у хіро (283px) і смужка над списком (787px). А в підбірці був
// лише великий — три картки одна під одною на ~700px до першої можливості
// («у підбірках мають бути видно так само, як на головній»).
test('великий блок ховається на телефоні, смужка — в обох місцях', () => {
  const css = read('app/styles/home-v2.css');
  // Поріг той самий, на якому .m-top вмикається в home-mobile.css, інакше
  // знайдеться ширина з двома блоками або з жодним.
  assert.match(css, /@media \(max-width: 900px\) \{\s*\.v2-tw \{ display: none; \}/,
    'великий «Топ тижня» не схований на телефоні');
  assert.match(read('app/styles/home-mobile.css'), /@media \(max-width: 900px\)/);

  for (const f of ['app/OpportunitiesList.js', 'app/TopicPage.js']) {
    assert.match(read(f), /<TopWeekStrip/, `${f}: немає компактної смужки`);
  }
});

// Розмітка смужки — одна на головну й підбірки. Доти картку збирав
// OpportunitiesList у себе, і в підбірці такої просто не існувало.
test('смужка одна на обидва місця й бере ті самі дані', () => {
  const strip = read('app/TopWeekStrip.js');
  assert.match(strip, /className="m-top-card"/);
  assert.match(strip, /o\.dateLabel/, 'закріплені без дати лишаються з підписом «Топ»');
  // Дані — з sliderCards, тієї самої функції, що годує великий блок.
  for (const f of ['app/OpportunitiesList.js', 'app/TopicPage.js']) {
    const src = read(f);
    assert.ok(/sliderCards\(/.test(src) || /cards=\{topWeek\}/.test(src),
      `${f}: смужка годується не з sliderCards`);
  }
  assert.doesNotMatch(read('app/OpportunitiesList.js'), /renderTopCard/,
    'у списку лишилась власна копія картки — підписи знову розійдуться');
});

test('sliderCards позначає назву, що лишилась українською', () => {
  const [uk] = sliderCards([{ slug: 'a', title: 'Назва', cost_type: 'free' }], { lang: 'en', free: 'free' });
  assert.equal(uk.titleIsUk, true);
  const [en] = sliderCards([{ slug: 'b', title: 'Назва', title_en: 'Name' }], { lang: 'en' });
  assert.equal(en.titleIsUk, false);
});

// У підбірці смужка стоїть одразу за кнопками хіро.
//
// 05.10.2026 Марія прислала скриншот /bezkoshtovni-tabory з обведеною
// порожнечею між «Поділитися підбіркою» і «Топ 3 цього тижня»: 40px ритму
// .tp-main плюс власні 16px смужки = 56px діри. Смужка — продовження хіро, а
// не новий розділ сторінки.
test('у підбірці смужка не відірвана від хіро', () => {
  const css = read('app/styles/topic-v2.css');
  const rule = css.match(/\.tp-main > \.m-top \{[^}]*\}/);
  assert.ok(rule, 'немає правила проміжку перед смужкою в підбірці');
  assert.match(rule[0], /padding-top: 0/, 'лишились власні 16px смужки');
  assert.match(rule[0], /margin-top: -24px/, 'проміжок .tp-main не звужено');
  // Правило має бути в мобільному медіа-блоці: на десктопі смужки немає.
  const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert.ok(mobile.includes('.tp-main > .m-top'), 'правило поза мобільним блоком');
});
