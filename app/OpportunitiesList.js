'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TYPE_LABELS, TYPE_LABELS_EN } from '@/lib/labels';
import { whenRank, whenState } from '@/lib/timing';
import { cityLabel, itemFormatLabel } from '@/lib/labels';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import { trackSearch, trackFilterApply, filterSignature, trackConversion, trackSubscribeClick } from '@/lib/track';
import { TELEGRAM_URL } from '@/lib/social';
import { daysUntil, kyivToday } from '@/lib/dates';
import { visibleFor } from '@/lib/audience';
import { goesAbroad } from '@/lib/geo';
import { abroadPlaceText, foreignOnly, abroadCodes } from '@/lib/place';
import { countryName } from '@/lib/diaspora';
import { buildHaystack, queryTokens, matchesQuery } from '@/lib/search';
import { TAG_COLORS, TAG_FALLBACK } from '@/lib/tag-colors';
import { readMode, onModeChange } from '@/lib/mode';
import { inlineCardPositions } from '@/lib/inline-card';
import { topWeekCards } from '@/lib/weekly-top';
import { groupMonOlympiads, subjectLabel } from '@/lib/olympiad-group';
import { STAGES, OLYMPIADS_PATH } from '@/lib/olympiads';
import { plural } from '@/lib/plural';
import { HERO_SEARCH_EVENT } from './HomeHero';
import { isoWeek } from '@/lib/week';
import OpportunityCard from './OpportunityCard';
import { PLACE_KINDS, placeOption, pickPlace, isCountryValue, countryValue, COUNTRY_PREFIX } from '@/lib/place-search';
import TelegramCard from './TelegramCard';
import PlaceCombobox from './PlaceCombobox';

// Каталог, версія редизайну (вересень 2026, референс «Dityam — новий дизайн
// головної»). Один компонент обслуговує головну, /en і сторінки міст/тем.
//
// Що змінилось проти старої версії:
// - замість девʼяти розкривних мультифільтрів — ряд пігулок «Тип», селекти й
//   пошук; з 14.09.2026 (рішення Марії) тип, вік, особлива потреба / що дає і
//   місце знову мультивибірні — див. MULTI нижче;
// - зʼявився режим «Підліткам» (перемикач у шапці): свої пігулки, вік
//   класами, фільтр «Що дає» по teen_tags і поля картки «Отримаєш / Треба»;
// - «Топ тижня» — відмічені в адмінці цього тижня (featured_week) плюс
//   найближчі дедлайни до трьох;
// - сортування зафіксоване: найближчий дедлайн угорі, без дедлайну — вкінці.

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const UI = {
  uk: {
    found: 'Знайдено',
    reset: 'Скинути',
    nothingTitle: 'Нічого не знайдено',
    nothingText: 'Спробуйте інший фільтр.',
    showMore: 'Показати ще',
    details: 'Детальніше →',
    topTitle: '⏰ Топ тижня',
    topSub: 'три найближчі дедлайни',
    annual: '🔄 щорічно',
    open: 'набір відкритий',
    today: 'сьогодні',
    tomorrow: 'завтра',
    inDays: (n) => `через ${n} дн.`,
    running: 'триває',
    daysLeft: (n) => `${n} ${n === 1 ? 'день' : 'днів'}`,
    until: (d) => `до ${d}`,
    noDeadline: 'без дедлайну',
    searchParents: 'FLEX, програмування, допомога ВПО…',
    searchTeens: 'FLEX, стажування, НМТ…',
    mSearchParents: 'Табір, FLEX, ВПО…',
    mSearchTeens: 'FLEX, стажування, НМТ…',
    sideSearchTeens: 'FLEX, стажування…',
    filters: 'Фільтри',
    mTopWeek: 'Встигніть цього тижня',
    mTopSoon: 'Найближчі дедлайни',
    swipe: 'листайте →',
    sortHint: 'за дедлайном ↓',
    typeGroup: 'Тип',
    allKids: 'Усі діти',
    resetAll: 'Скинути все',
    remove: 'Зняти фільтр',
    years: 'років',
    close: 'Закрити фільтри',
    resetFilters: 'Скинути фільтри',
    sortLong: 'за дедлайном, найближчі спочатку',
    sortLabel: 'Сортувати',
    sortDeadline: 'Спочатку найближчий дедлайн',
    sortNew: 'Спочатку нові',
    sortBtn: 'Сортування',
    tgBar: 'Telegram-канал',
    filtersBtn: (n) => (n ? `Фільтри (${n})` : 'Фільтри'),
    clearAll: 'Очистити все',
    olymp: {
      title: 'Всеукраїнські учнівські олімпіади 2026/27',
      subjects: (n) => `${n} ${plural(n, 'предмет', 'предмети', 'предметів')}`,
      more: (n) => `+${n} ${plural(n, 'предмет', 'предмети', 'предметів')}`,
      details: 'Детальніше →',
      free: 'безкоштовно',
      href: OLYMPIADS_PATH,
    },
    show: (n) => (n ? `Показати ${n} ${opportunitiesWord(n)}` : 'Нічого не знайдено'),
    ageShort: (a, b) => (a === b ? `${a} р.` : `${a}–${b} р.`),
    f: { format: 'Формат', place: 'Де', source: 'Джерело',
      benefit: 'Отримаєш', requirement: 'Треба', deadline: 'Дедлайн' },
    sel: { age: 'Вік дитини', grade: 'Клас', deadline: 'Дедлайн',
      need: 'Особлива потреба', gives: 'Що дає', cost: 'Вартість', where: 'Де' },
    all: 'Усі', anyCost: 'Будь-яка', anyTime: 'Будь-коли', formatGroup: 'Формат', city: 'Місто',
    abroad: '🌍 За кордоном', online: '💻 Онлайн',
    pickPlace: 'Будь-де', addPlace: '+ Додати ще місце',
    ukraine: '🇺🇦 Україна', pickCity: 'Обрати місто', addCity: '+ Ще одне місто',
    countWord: (n) => opportunitiesWord(n),
    freeWord: (n) => freeWord(n),
  },
  en: {
    found: 'Found',
    reset: 'Reset',
    nothingTitle: 'Nothing found',
    nothingText: 'Try a different filter.',
    showMore: 'Show more',
    details: 'Details →',
    topTitle: '⏰ Top this week',
    topSub: 'three closest deadlines',
    annual: '🔄 every year',
    open: 'enrolment open',
    today: 'today',
    tomorrow: 'tomorrow',
    inDays: (n) => `in ${n} days`,
    running: 'on now',
    daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
    until: (d) => `by ${d}`,
    noDeadline: 'no deadline',
    searchParents: 'FLEX, coding, IDP aid…',
    searchTeens: 'FLEX, internships…',
    mSearchParents: 'Camp, FLEX, IDP…',
    mSearchTeens: 'FLEX, internships…',
    sideSearchTeens: 'FLEX, internships…',
    filters: 'Filters',
    mTopWeek: 'Make it this week',
    mTopSoon: 'Closing soonest',
    swipe: 'swipe →',
    sortHint: 'by deadline ↓',
    typeGroup: 'Type',
    allKids: 'All children',
    resetAll: 'Reset all',
    remove: 'Remove filter',
    years: 'y.o.',
    close: 'Close filters',
    resetFilters: 'Reset filters',
    sortLong: 'by deadline, soonest first',
    sortLabel: 'Sort',
    sortDeadline: 'Soonest deadline first',
    sortNew: 'Newest first',
    sortBtn: 'Sort',
    tgBar: 'Telegram channel',
    filtersBtn: (n) => (n ? `Filters (${n})` : 'Filters'),
    clearAll: 'Clear all',
    olymp: {
      title: 'All-Ukrainian school olympiads 2026/27',
      subjects: (n) => `${n} ${n === 1 ? 'subject' : 'subjects'}`,
      more: (n) => `+${n} ${n === 1 ? 'subject' : 'subjects'}`,
      details: 'Details →',
      free: 'free',
      href: '/en/olympiads',
    },
    show: (n) => (n ? `Show ${n} ${n === 1 ? 'opportunity' : 'opportunities'}` : 'Nothing found'),
    ageShort: (a, b) => (a === b ? `age ${a}` : `${a}–${b} y.o.`),
    f: { format: 'Format', place: 'Where', source: 'Source',
      benefit: 'You get', requirement: 'You need', deadline: 'Deadline' },
    sel: { age: 'Child age', grade: 'Grade', deadline: 'Deadline',
      need: 'Special need', gives: 'What it gives', cost: 'Cost', where: 'Where' },
    all: 'All', anyCost: 'Any', anyTime: 'Any time', formatGroup: 'Format', city: 'City',
    abroad: '🌍 Abroad', online: '💻 Online',
    pickPlace: 'Anywhere', addPlace: '+ Add another place',
    ukraine: '🇺🇦 Ukraine', pickCity: 'Choose a city', addCity: '+ Another city',
    countWord: (n) => (n === 1 ? 'opportunity' : 'opportunities'),
    freeWord: () => 'free',
  },
};

// Пігулки «Тип» — свої на кожен режим. «Онлайн» лишається в обох свідомо,
// хоч у референсі його немає: це найчастіший фільтр родин поза великими
// містами й за кордоном.
const TYPE_CHIPS = {
  parents: [
    { value: 'online', label: '💻 Онлайн', en: '💻 Online' },
    { value: 'club', label: 'Гуртки', en: 'Clubs' },
    { value: 'course', label: 'Курси', en: 'Courses' },
    { value: 'camp', label: 'Табори', en: 'Camps' },
    { value: 'olympiad', label: 'Олімпіади', en: 'Olympiads' },
    { value: 'competition', label: 'Конкурси', en: 'Competitions' },
    { value: 'payments', label: 'Виплати', en: 'Payments' },
    { value: 'medical_aid', label: 'Мед. допомога', en: 'Medical aid' },
  ],
  // Підлітковий набір спершу повторював лише «дорослі» типи (обміни,
  // стажування, стипендії, гранти, волонтерство, конкурси) — а це 160
  // записів з 1006, які підліток бачить. Решту — 543 гуртки, 150 курсів,
  // 37 олімпіад, 34 табори — відфільтрувати не було чим. «Онлайн» переїхав
  // звідси в «Де»: це місце, а не тип, і саме там його шукають.
  teens: [
    { value: 'exchange', label: 'Обміни', en: 'Exchanges' },
    { value: 'scholarship', label: 'Стипендії', en: 'Scholarships' },
    { value: 'grant', label: 'Гранти', en: 'Grants' },
    { value: 'internship', label: 'Стажування', en: 'Internships' },
    { value: 'volunteer', label: 'Волонтерство', en: 'Volunteering' },
    { value: 'competition', label: 'Конкурси', en: 'Competitions' },
    { value: 'olympiad', label: 'Олімпіади', en: 'Olympiads' },
    { value: 'camp', label: 'Табори', en: 'Camps' },
    // Гуртки, курси й воркшопи — одна пігулка: підліток не розрізняє їх за
    // типом у базі, для нього це «вчитися чогось поруч або онлайн».
    { value: 'classes', label: 'Курси та гуртки', en: 'Courses & clubs' },
  ],
};

// Типи, які ховаються за пігулкою «Курси та гуртки».
const CLASSES_TYPES = ['club', 'course', 'workshop'];

const AGE_OPTS = {
  parents: [
    ['0-3', '0–3'], ['4-6', '4–6'], ['7-11', '7–11'],
    ['12-14', '12–14'], ['15-17', '15–17'],
  ],
  // Підліток думає класами, не роками (референс «Підлітки — пропозиція
  // функціоналу»): мапимо клас на віковий діапазон.
  teens: [
    ['12-14', '7–8 клас', '7–8 grade'], ['14-16', '9–10 клас', '9–10 grade'],
    ['16-17', '11 клас', '11 grade'], ['17-18', 'після школи', 'after school'],
  ],
};

const NEED_OPTS = [
  ['idp', 'ВПО', 'Displaced'],
  ['gifted', 'Обдаровані', 'Gifted'],
  ['disability', 'Інвалідність', 'Disability'],
  ['veteran_family', 'Діти ветеранів', "Veterans' children"],
  ['low_income', 'Малозабезпечені', 'Low income'],
  ['orphan', 'Сироти', 'Orphans'],
  ['oncology', 'Онкохворі', 'Cancer patients'],
];

const GIVES_OPTS = [
  ['без досвіду', 'Без досвіду', 'No experience needed'],
  ['гроші', 'Гроші', 'Money'],
  ['поїздка', 'Поїздка', 'A trip'],
  ['досвід', 'Досвід', 'Experience'],
  ['сертифікат', 'Сертифікат', 'Certificate'],
];

// Вартість на сайті — лише два варіанти: платить родина хоч щось чи ні
// (рішення Марії 13.09.2026). Проміжні «з фінансуванням» / «субсидовано»
// нічого не відповідали батькові на питання «скільки це мені коштує».
const COST_OPTS = [
  ['free', 'Безкоштовно', 'Free'],
  // «Платно» видиме нарівні з безкоштовним: інакше платне не можна ні
  // знайти, ні відсіяти (урок #152).
  ['paid', 'Платно', 'Paid'],
];

const DEADLINE_OPTS = [
  ['week', 'Цього тижня', 'This week'],
  ['month', 'Цього місяця', 'This month'],
  ['none', 'Без дедлайну', 'No deadline'],
];

const DL_COLORS = {
  urgent: ['#fde3e3', '#991b1b'],
  soon: ['#fef2d4', '#78350f'],
  calm: ['#f7f1e6', '#6b6b6b'],
  event: ['#e5eefc', '#1b4a8f'],
};

// Підлітковий режим (напрям A): дедлайн, що горить, — чорний стікер на
// білій картці; «відкрито» і «до дати» лишаються спокійними.
const DL_COLORS_TEENS = {
  urgent: ['#1a1a1a', '#f7f1e6'],
  soon: ['#1a1a1a', '#f7f1e6'],
  calm: ['#f1ebde', '#4a4a4a'],
  event: ['#1a1a1a', '#f7f1e6'],
};

const ONLINE_RE = /(онлайн|online|дистанц|гібрид|hybrid|zoom|вебінар)/i;
const isOnline = (item) =>
  ONLINE_RE.test(item.format || '')
  || (item.cities || []).some((c) => ONLINE_RE.test(c))
  || ONLINE_RE.test(`${item.title || ''} ${item.summary || ''}`);

function formatDeadline(dateStr, lang = 'uk') {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = lang === 'en' ? MONTHS_EN
    : ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function ageMatches(item, value) {
  const [f, tt] = value.split('-').map(Number);
  return item.age_from <= tt && item.age_to >= f;
}

const PSEUDO_CITIES = new Set(['Онлайн', 'Вся Україна', 'Міжнародні']);

// Мультивибір (рішення Марії 14.09.2026): тип, вік, особлива потреба / що дає
// і місце — масиви; усередині групи «або», між групами «і»; порожній масив —
// «усі». Дедлайн і вартість лишились одновибірними: їхні варіанти
// перекриваються («цього тижня» вже входить у «цього місяця»).
const MULTI = ['type', 'age', 'need', 'place'];
const isAll = (v) => (Array.isArray(v) ? v.length === 0 : v === 'all');
const has = (v, x) => (Array.isArray(v) ? v.includes(x) : v === x);
const toggle = (arr, x) => (arr.includes(x) ? arr.filter((v) => v !== x) : [...arr, x]);
const anyOf = (vals, test) => vals.length === 0 || vals.some(test);

// Предикати фільтрів як чиста функція стану: той самий код рахує і
// застосовані фільтри, і чернетку в мобільній шторці — інакше «Показати N»
// у шторці могло б розійтися з тим, що покаже список.
function buildPredicates(s, { teens, todayIso, searchIndex, domestic }) {
  const tokens = queryTokens(s.query);
  return {
    type: (item) => anyOf(s.type, (v) => {
      if (v === 'online') return isOnline(item);
      if (v === 'payments') {
        return item.opportunity_type === 'allowance'
          || item.opportunity_type === 'support_payment'
          || item.aid_type === 'cash';
      }
      if (v === 'classes') return CLASSES_TYPES.includes(item.opportunity_type);
      return item.opportunity_type === v;
    }),
    age: (item) => anyOf(s.age, (v) => ageMatches(item, v)),
    deadline: (item) => {
      if (s.deadline === 'all') return true;
      const days = daysUntil(item.deadline, todayIso);
      if (s.deadline === 'none') return days === null;
      if (s.deadline === 'week') return days !== null && days >= 0 && days <= 7;
      if (s.deadline === 'month') return days !== null && days >= 0 && days <= 31;
      return true;
    },
    need: (item) => anyOf(s.need, (v) => {
      if (teens) {
        if ((item.teen_tags || []).includes(v)) return true;
        // «Поїздка» працює і до розмітки: закордон видно з географії.
        return v === 'поїздка' && goesAbroad(item);
      }
      return (item.child_needs || []).includes(v);
    }),
    cost: (item) => {
      if (s.cost === 'all') return true;
      if (s.cost === 'free') return item.cost_type === 'free';
      return item.cost_type === 'paid_affordable' || item.cost_type === 'paid_premium';
    },
    place: (item) => anyOf(s.place, (v) => {
      if (v === 'abroad') return goesAbroad(item);
      // «Україна» — усе, куди не треба їхати за кордон (дзеркало «За кордоном»).
      if (v === 'ukraine') return !goesAbroad(item);
      if (v === 'online') return isOnline(item);
      if (isCountryValue(v)) return abroadCodes(item).includes(v.slice(COUNTRY_PREFIX.length));
      const cities = item.cities || [];
      if (cities.includes(v)) return true;
      // «Вся Україна» просвічує крізь вибір УКРАЇНСЬКОГО міста. Для закордонного
      // (Malmö) — ні: там показувало 142 = 1 свій запис + 141 «Вся Україна».
      return cities.includes('Вся Україна') && !PSEUDO_CITIES.has(v)
        && (!domestic || domestic.has(v));
    }),
    query: (item) => {
      if (!tokens.length) return true;
      const hay = searchIndex.get(item.id);
      return Boolean(hay) && matchesQuery(tokens, hay);
    },
  };
}

const FACETS = ['type', 'age', 'deadline', 'need', 'cost', 'place', 'query'];

// Лічильники біля кожної опції: скільки лишиться, якщо обрати її при решті
// обраних. Спільні для мобільної шторки (рахує на чернетці) і бічної панелі
// десктопа (рахує на застосованому стані) — щоб цифри не розходились.
function facetCounts(s, { teens, todayIso, searchIndex, domestic, liveItems, t }) {
  const ctx = { teens, todayIso, searchIndex, domestic };
  const dp = buildPredicates(s, ctx);
  const passOthers = (skip) =>
    liveItems.filter((item) => FACETS.every((k) => k === skip || dp[k](item)));
  const countOpts = (facet, values) => {
    const base = passOthers(facet);
    const out = { all: base.length };
    for (const v of values) {
      // Для мультигрупи число — скільки дасть сама ця опція при решті фільтрів.
      const p = buildPredicates({ ...s, [facet]: MULTI.includes(facet) ? [v] : v }, ctx)[facet];
      out[v] = base.filter(p).length;
    }
    return out;
  };
  const place = placeFacet(s, { teens, todayIso, searchIndex, domestic, liveItems, t });
  return {
    total: liveItems.filter((item) => FACETS.every((k) => dp[k](item))).length,
    type: countOpts('type', TYPE_CHIPS[teens ? 'teens' : 'parents'].map((c) => c.value)),
    age: countOpts('age', AGE_OPTS[teens ? 'teens' : 'parents'].map((o) => o[0])),
    deadline: countOpts('deadline', DEADLINE_OPTS.map((o) => o[0])),
    need: countOpts('need', (teens ? GIVES_OPTS : NEED_OPTS).map((o) => o[0])),
    cost: countOpts('cost', COST_OPTS.map((o) => o[0])),
    placeOpts: place.opts,
    place: place.counts,
  };
}

// Лише «Де»: опції [значення, підпис, підпис англійською] і скільки дасть
// кожна при решті фільтрів. Окремо від facetCounts, бо рядку фільтрів поза
// головною (/en) потрібні саме ці числа, а решту груп рахувати нема чого.
function placeFacet(s, { teens, todayIso, searchIndex, domestic, liveItems, t }) {
  const ctx = { teens, todayIso, searchIndex, domestic };
  const dp = buildPredicates(s, ctx);
  const base = liveItems.filter((item) => FACETS.every((k) => k === 'place' || dp[k](item)));
  const places = new Set();
  const countries = new Set();
  base.forEach((item) => {
    if (goesAbroad(item)) abroadCodes(item).forEach((c) => countries.add(c));
    // Прага чи Дублін не стоять у списку поруч зі Львовом: закордонний запис
    // знаходиться через «За кордоном» (29.09.2026).
    if (!foreignOnly(item)) {
      (item.cities || []).forEach((c) => { if (!PSEUDO_CITIES.has(c)) places.add(c); });
    }
    if (goesAbroad(item)) places.add('abroad');
    if (teens && isOnline(item)) places.add('online');
  });
  const opts = [];
  if (places.has('abroad')) opts.push(['abroad', t.abroad, t.abroad]);
  // «Україна» й «Онлайн» мобільна шторка показує поруч із «За кордоном» в обох
  // режимах (Марія 14.09.2026) — рахуємо завжди, ховає шторка нулі сама.
  opts.push(['ukraine', t.ukraine, t.ukraine]);
  opts.push(['online', t.online, t.online]);
  [...countries]
    .map((c) => [countryValue(c), countryName(c, 'uk'), countryName(c, 'en')])
    .sort((a, b) => a[1].localeCompare(b[1], 'uk'))
    .forEach((o) => opts.push(o));
  [...places].filter((p) => p !== 'abroad' && p !== 'online')
    .sort((a, b) => a.localeCompare(b, 'uk'))
    .forEach((c) => opts.push([c, c, cityLabel(c, 'en')]));
  const counts = { all: base.length };
  for (const [v] of opts) {
    const p = buildPredicates({ ...s, place: [v] }, ctx).place;
    counts[v] = base.filter(p).length;
  }
  return { opts, counts };
}

export default function OpportunitiesList({
  opportunities, presetCity, lang = 'uk', today, modeAware = false,
  // Закріплені підбіркою картки (напр. «Лише для дітей захисників»): першими
  // в списку й з позначкою. Без цих параметрів список поводиться як раніше.
  pinnedIds = null, pinnedLabel = null,
  // Скільки карток видно одразу. На головній 6 і «Показати ще»; підбірка —
  // одна сторінка з можливостями, тож там більше (рішення Марії 14.09.2026).
  initialLimit = 6,
  mobileLayout = false, sidebarLayout = false,
}) {
  const todayIso = today || kyivToday();
  const t = UI[lang] || UI.uk;
  const isEn = lang === 'en';
  const pinned = useMemo(() => new Set(pinnedIds || []), [pinnedIds]);

  // Режим «Батькам / Підліткам» вмикається лише там, де в шапці є
  // перемикач (головна). На сторінках міст і тем каталог завжди
  // батьківський — там своя обіцянка в заголовку сторінки.
  const pageSize = useRef(initialLimit);
  const [mode, setMode] = useState('parents');
  // Зміна режиму скидає фільтри: у батьків і підлітків різні словники. Але
  // лише коли людина сама клацнула перемикач — раніше скидання жило в
  // ефекті на [mode] і спрацьовувало ще й при монтуванні, одразу після
  // читання URL, тож посилання ?type=camp&age=7-11 відкривало нефільтрований
  // список.
  useEffect(() => {
    if (!modeAware) return undefined;
    setMode(readMode());
    return onModeChange((m) => {
      setMode(m);
      setType([]); setAge([]); setDeadline('all'); setNeed([]);
      setCost('all'); setQuery(''); setLimit(pageSize.current);
      if (!presetCity) setPlace([]);
    });
  }, [modeAware, presetCity]);
  const teens = mode === 'teens';

  const [type, setType] = useState([]);
  const [age, setAge] = useState([]);
  const [deadline, setDeadline] = useState('all');
  const [need, setNeed] = useState([]);
  const [cost, setCost] = useState('all');
  const [place, setPlace] = useState(presetCity ? [presetCity] : []);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(initialLimit);
  // Сортування (редизайн 29.09.2026): найближчий дедлайн, як було, або нові.
  const [sort, setSort] = useState('deadline');
  // Останній надісланий запит: щоб та сама фраза не йшла в аналітику двічі.
  const searched = useRef('');
  const [hydrated, setHydrated] = useState(false);

  // Мобільна верстка головної (≤900px, референс «Dityam — мобільна версія»,
  // екрани 6a–6c). Розмітка рендериться поруч із десктопною і вмикається
  // медіазапитом у home-mobile.css — так SSR віддає правильний вигляд одразу,
  // без стрибка після гідрації.
  //
  // compact: пошук у хіро пішов за верх екрана → зверху виїжджає компактна
  // шапка з тим самим полем пошуку, а липкий рядок фільтрів сідає під неї.
  const bandRef = useRef(null);
  const [compact, setCompact] = useState(false);
  const [topIndex, setTopIndex] = useState(0);
  const chipsRowRef = useRef(null);
  // Шторка фільтрів (6c): поки відкрита, зміни живуть у чернетці й до
  // списку не доходять — застосовуються лише кнопкою «Показати N».
  // null = шторка закрита.
  const [draft, setDraft] = useState(null);
  const sheetOpen = draft !== null;
  const sheetRef = useRef(null);
  const sheetBodyRef = useRef(null);
  const filtersBtnRef = useRef(null);
  const countRef = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const el = bandRef.current;
    if (!mobileLayout || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      setCompact(!e.isIntersecting && e.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mobileLayout]);

  // Читання фільтрів з URL — щоб відфільтрований вигляд можна було шерити.
  // Мультигрупи — кілька значень через кому (?type=camp,club); дедлайн і
  // вартість беруть перше значення.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const list = (key) => [...new Set((p.get(key) || '').split(',').map((x) => x.trim()).filter(Boolean))];
    for (const [key, setter] of Object.entries({ type: setType, age: setAge, need: setNeed })) {
      const v = list(key);
      if (v.length) setter(v);
    }
    for (const [key, setter] of Object.entries({ deadline: setDeadline, cost: setCost })) {
      const v = list(key)[0];
      if (v) setter(v);
    }
    const cities = list('city').map((c) => (c === 'Міжнародні' ? 'abroad' : c));
    if (cities.length) setPlace(cities);
    const q = p.get('q');
    if (q) setQuery(q);
    if (p.get('sort') === 'new') setSort('new');
    setHydrated(true);
  }, []);

  // Пошук із хіро головної (app/HomeHero.js): поле там, список тут.
  useEffect(() => {
    const onSearch = (e) => setQuery(String(e.detail?.q || ''));
    window.addEventListener(HERO_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(HERO_SEARCH_EVENT, onSearch);
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      const keep = p.get('for'); // режим пише lib/mode — не затираємо
      const next = new URLSearchParams();
      if (keep === 'teens') next.set('for', 'teens');
      const write = (key, v, def = 'all') => { if (v !== def) next.set(key, v); };
      const writeList = (key, v) => { if (v.length) next.set(key, v.join(',')); };
      writeList('type', type); writeList('age', age); write('deadline', deadline);
      writeList('need', need); write('cost', cost);
      if (!(presetCity && place.length === 1 && place[0] === presetCity)) writeList('city', place);
      if (query.trim()) next.set('q', query.trim());
      if (sort !== 'deadline') next.set('sort', sort);
      const qs = next.toString();
      window.history.replaceState(null, '',
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }, 250);
    return () => clearTimeout(timer);
  }, [hydrated, type, age, deadline, need, cost, place, query, sort, presetCity]);

  // Пошуковий індекс: рахується раз на набір записів (див. lib/search).
  const searchIndex = useMemo(() => {
    const m = new Map();
    opportunities.forEach((o) => {
      m.set(o.id, buildHaystack([
        o.title, o.summary, o.source, o.title_en, o.summary_en, o.format,
        ...(o.cities || []),
        ...(o.cities || []).map((c) => cityLabel(c, 'en')),
        TYPE_LABELS[o.opportunity_type], TYPE_LABELS_EN[o.opportunity_type],
        o.teen_benefit, o.teen_requirement,
        goesAbroad(o) ? 'за кордоном abroad' : null,
      ]));
    });
    return m;
  }, [opportunities]);

  // Прострочені разові можливості не показуємо ніде, а в режимі «Підліткам» —
  // ще й те, що закінчується раніше 13 років. Предикати спільні з хіро
  // (lib/audience), щоб цифра над каталогом і цифра в каталозі не розходились.
  const liveItems = useMemo(
    () => visibleFor(opportunities, todayIso, teens),
    [opportunities, todayIso, teens],
  );

  // Міста, що трапляються хоч в одному НЕзакордонному записі, — українські.
  // Лише до них у фільтрі «Де» додаються записи «Вся Україна».
  const domestic = useMemo(() => {
    const set = new Set();
    opportunities.forEach((o) => {
      if (goesAbroad(o)) return;
      (o.cities || []).forEach((c) => { if (!PSEUDO_CITIES.has(c)) set.add(c); });
    });
    return set;
  }, [opportunities]);

  const predicates = useMemo(
    () => buildPredicates(
      { type, age, deadline, need, cost, place, query },
      { teens, todayIso, searchIndex, domestic },
    ),
    [type, age, deadline, need, cost, place, query, teens, todayIso, searchIndex, domestic],
  );

  // На сторінці міста саме місто — не фільтр людини, а рамка сторінки.
  const placeActive = presetCity
    ? !(place.length === 1 && place[0] === presetCity)
    : place.length > 0;
  const hasActive = type.length > 0 || age.length > 0 || deadline !== 'all'
    || need.length > 0 || cost !== 'all' || Boolean(query.trim()) || placeActive;

  // Доступні опції: рахуємо на тому, що проходить усі ІНШІ фільтри, — мертва
  // опція гірша за відсутню (у 3 роки стипендій не буває).
  const available = useMemo(() => {
    const candidates = (skip) =>
      liveItems.filter((item) => FACETS.every((k) => k === skip || predicates[k](item)));
    const chips = new Set();
    candidates('type').forEach((item) => {
      chips.add(item.opportunity_type);
      if (isOnline(item)) chips.add('online');
      if (item.opportunity_type === 'allowance' || item.opportunity_type === 'support_payment'
        || item.aid_type === 'cash') chips.add('payments');
      if (CLASSES_TYPES.includes(item.opportunity_type)) chips.add('classes');
    });
    const ages = new Set();
    const ageList = AGE_OPTS[teens ? 'teens' : 'parents'];
    {
      const items = candidates('age');
      for (const [value] of ageList) {
        if (items.some((i) => ageMatches(i, value))) ages.add(value);
      }
    }
    const needs = new Set();
    candidates('need').forEach((item) => {
      if (teens) {
        (item.teen_tags || []).forEach((x) => needs.add(x));
        if (goesAbroad(item)) needs.add('поїздка');
      } else {
        (item.child_needs || []).forEach((x) => needs.add(x));
      }
    });
    const costs = new Set();
    candidates('cost').forEach((item) => {
      if (item.cost_type === 'free') costs.add('free');
      if (item.cost_type === 'paid_affordable' || item.cost_type === 'paid_premium') costs.add('paid');
    });
    const deadlines = new Set();
    {
      const items = candidates('deadline');
      for (const item of items) {
        const days = daysUntil(item.deadline, todayIso);
        if (days === null) deadlines.add('none');
        else {
          if (days >= 0 && days <= 7) deadlines.add('week');
          if (days >= 0 && days <= 31) deadlines.add('month');
        }
      }
    }
    // Місця («Де») рахує placeFacet — з числами біля кожного.
    return { chips, ages, needs, costs, deadlines };
  }, [liveItems, predicates, teens, todayIso]);

  const filtered = useMemo(() => {
    const list = liveItems.filter((item) => FACETS.every((k) => predicates[k](item)));
    // Найближче угорі: дедлайн, а без нього — початок чи кінець події (раніше
    // подія з датами, але без дедлайну, падала в кінець як «без дати»).
    // Без жодної майбутньої дати — вкінці, свіжіші перші.
    return list.sort((a, b) => {
      const pa = pinned.has(a.id) ? 0 : 1;
      const pb = pinned.has(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (sort !== 'new') {
        const ra = Math.min(whenRank(a, todayIso), 9999);
        const rb = Math.min(whenRank(b, todayIso), 9999);
        if (ra !== rb) return ra - rb;
      }
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [liveItems, predicates, todayIso, pinned, sort]);

  // Топ тижня: спершу відмічені цього тижня в адмінці (так виконується платне
  // просування організаторам), далі — найближчі живі дедлайни. Показується без
  // активних фільтрів і виключається з основної стрічки, щоб не дублювався.
  const topCards = useMemo(() => {
    if (hasActive) return [];
    return topWeekCards({ items: liveItems, week: isoWeek(), todayIso, daysUntil });
  }, [liveItems, hasActive, todayIso]);

  const topIds = useMemo(() => new Set(topCards.map((c) => c.id)), [topCards]);
  const stream = useMemo(
    // Прибираємо зі стрічки лише тоді, коли блок топу справді показано (він
    // рендериться тільки з трьома картками). Раніше з одним-двома живими
    // дедлайнами ці картки зникали звідусіль: «Знайдено 11», а видно 10.
    () => (topCards.length === 3 ? filtered.filter((c) => !topIds.has(c.id)) : filtered),
    [filtered, topCards, topIds],
  );

  useEffect(() => { setLimit(pageSize.current); }, [type, age, deadline, need, cost, place, query]);

  // Обраний тип (зі шторки чи з URL) може стояти за правим краєм рядка —
  // підкручуємо рядок, щоб активний чип було видно.
  useEffect(() => {
    const row = chipsRowRef.current;
    if (!row) return;
    const on = row.querySelector('.m-chip.is-on:not(.m-filters-btn)');
    if (!on) return;
    if (on.offsetLeft + on.offsetWidth > row.scrollLeft + row.clientWidth
      || on.offsetLeft < row.scrollLeft) {
      row.scrollTo({ left: on.offsetLeft - 20, behavior: 'smooth' });
    }
  }, [type, teens]);

  // На телефоні показуємо стільки ж, скільки на десктопі (28.09.2026). До
  // того тут стояло 10 — і прохання «показувати хоча б 40 можливостей, а
  // потім кнопка» на телефон не доходило зовсім, хоча дивилися саме там.
  // Картка-рядок утричі нижча за десктопну, тож сорок рядків не важчі за
  // десяток десктопних карток.
  useEffect(() => {
    if (mobileLayout && window.matchMedia('(max-width: 900px)').matches) {
      pageSize.current = initialLimit;
      setLimit(initialLimit);
    }
  }, [mobileLayout]);

  const reset = () => {
    setType([]); setAge([]); setDeadline('all'); setNeed([]);
    setCost('all'); setQuery(''); setLimit(pageSize.current);
    setPlace(presetCity ? [presetCity] : []);
  };

  const enField = (item, field) => (isEn && item[`${field}_en`]) || item[field] || '';

  // Значок часу — з lib/timing.js, спільного для всього сайту. Дедлайн подачі
  // горить терміновістю завжди, навіть коли сама подія ще далеко: до
  // 17.09.2026 для подій дні рахувались від дедлайну спокійним «📅», і подача,
  // що закривається, виглядала як далека подія.
  const dlChip = (item) => {
    const s = whenState(item, todayIso);
    if (s.state === 'deadline') {
      if (s.days === 0) return { text: `⏰ ${t.today}`, kind: 'urgent' };
      if (s.days <= 7) return { text: `⏰ ${t.daysLeft(s.days)}`, kind: 'urgent' };
      if (s.days <= 30) return { text: `⏳ ${t.daysLeft(s.days)}`, kind: 'soon' };
      return { text: t.until(formatDeadline(item.deadline, lang)), kind: 'calm' };
    }
    if (s.state === 'event') {
      if (s.days === 1) return { text: `📅 ${t.tomorrow}`, kind: 'event' };
      if (s.days <= 30) return { text: `📅 ${t.inDays(s.days)}`, kind: 'event' };
      return {
        text: `📅 ${formatDeadline(s.date, lang).replace(` ${todayIso.slice(0, 4)}`, '')}`,
        kind: 'event',
      };
    }
    if (s.state === 'running') return { text: `📅 ${t.running}`, kind: 'event' };
    if (s.state === 'results') {
      return {
        text: `🏆 ${formatDeadline(s.date, lang).replace(` ${todayIso.slice(0, 4)}`, '')}`,
        kind: 'calm',
      };
    }
    return { text: s.state === 'periodic' ? t.annual : t.open, kind: 'calm' };
  };

  const ageText = (item) => (
    Number.isFinite(item.age_from) && Number.isFinite(item.age_to)
      ? t.ageShort(item.age_from, item.age_to) : null
  );

  const placeText = (item) => {
    if (goesAbroad(item)) return abroadPlaceText(item, lang) || t.abroad.replace('🌍 ', '');
    const real = (item.cities || []).filter((c) => !PSEUDO_CITIES.has(c));
    const shown = real.length ? real
      : (item.cities || []).filter((c) => c !== 'Міжнародні');
    if (!shown.length) return null;
    return shown.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ');
  };

  const renderCard = (item) => {
    const [tagBg, tagFg] = TAG_COLORS[item.opportunity_type] || TAG_FALLBACK;
    const dl = dlChip(item);
    const [dlBg, dlFg] = (teens ? DL_COLORS_TEENS : DL_COLORS)[dl.kind];
    const typeLabel = (isEn ? TYPE_LABELS_EN : TYPE_LABELS)[item.opportunity_type]
      || item.opportunity_type;
    // Підліткова картка відповідає на «що я отримаю і що зробити», а не
    // «формат і джерело». Поки запис без розмітки — батьківські поля.
    const teenReady = teens && (item.teen_benefit || item.teen_requirement);
    // Батьківська картка — без полів «Формат / Де / Джерело» (Марія,
    // 28.09.2026: «без деталей… всюди прибирай, бо не компактно»). Формат і
    // місце лишаються одним рядком унизу (footer). До #537 на десктопі цих
    // полів теж не було видно. У «Підліткам» поля — головний зміст, лишаються.
    const fields = teenReady
      ? [
        [t.f.benefit, item.teen_benefit],
        [t.f.requirement, item.teen_requirement],
        [t.f.deadline, item.deadline ? formatDeadline(item.deadline, lang) : t.noDeadline],
      ]
      : teens
        ? [
          [t.f.format, itemFormatLabel(item, lang) || null],
          [t.f.place, placeText(item)],
          [t.f.deadline, item.deadline ? formatDeadline(item.deadline, lang) : t.noDeadline],
        ]
        : [];

    const age = ageText(item);
    // Set: в онлайн-записів формат і «місто» однакові — без «Онлайн · Онлайн».
    // Рядок «формат · місце» — на кожній картці: тепер це єдине місце, де
    // батько бачить, онлайн це чи ні і де.
    const fmt = [...new Set([itemFormatLabel(item, lang), placeText(item)].filter(Boolean))].join(' · ');
    // Десктопна картка головної: далека дата без року — «до 20 жовт».
    const dlHead = dl.kind === 'calm' && daysUntil(item.deadline, todayIso) > 30
      ? t.until(formatDeadline(item.deadline, lang).replace(` ${todayIso.slice(0, 4)}`, ''))
      : dl.text;
    // «Детальніше» веде на сторінку можливості, а не до джерела (рішення
    // 24.09.2026). Тепер це вся картка: OpportunityCard — одне посилання, і
    // «Детальніше» всередині лишилось підписом, а не вкладеним <a>.

    // Одна картка на весь сайт (app/OpportunityCard.js). До 28.09.2026 каталог
    // мав власну .v2-card із трьома варіантами розкладки — мобільним рядком,
    // бічним і звичайним, — і той самий запис на сторінці можливості виглядав
    // інакше. Марія: «отака всюди».
    //
    // Тип, вік, вартість, дедлайн і обставини тепер пігулки самої картки, тож
    // v2-card-tags / v2-card-meta / v2-card-head більше не потрібні. Поля й
    // футер лишаються: у режимі «Підліткам» саме вони головний зміст.
    return (
      <OpportunityCard
        key={item.id}
        item={item}
        lang={lang}
        today={todayIso}
        prefetch={false}
        extraChip={pinnedLabel && pinned.has(item.id)
          ? <span className="chip chip-need">{pinnedLabel}</span>
          : null}
        fields={fields}
        footer={fmt || null}
        moreLabel={t.details}
      />
    );
  };

  // Картка стрічки «Найближчі дедлайни» на телефоні (макет Mobile.dc.html):
  // помаранчевий квадрат із датою, назва, рядок «тип · вік · безкоштовно» —
  // те саме, що в панелі хіро на десктопі. Без дедлайну (відмічена в
  // адмінці) — «Топ» замість дати.
  const renderTopCard = (item) => {
    const typeLabel = (isEn ? TYPE_LABELS_EN : TYPE_LABELS)[item.opportunity_type]
      || item.opportunity_type;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(item.deadline || ''));
    const months = isEn ? MONTHS_EN
      : ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'];
    const meta = [typeLabel, ageText(item), item.cost_type === 'free' ? (isEn ? 'free' : 'безкоштовно') : null]
      .filter(Boolean).join(' · ');
    return (
      <Link
        key={item.id}
        href={`${isEn ? '/en' : ''}/o/${item.slug}`}
        className="m-top-card"
        lang={isEn && !item.title_en ? 'uk' : undefined}
      >
        <span className="v2-soon-date" aria-hidden="true">
          {m ? (
            <>
              <span className="v2-soon-day">{Number(m[3])}</span>
              <span className="v2-soon-month">{months[Number(m[2]) - 1]}</span>
            </>
          ) : <span className="v2-soon-month">{isEn ? 'Top' : 'Топ'}</span>}
        </span>
        <span className="m-top-text">
          <span className="m-top-name">{enField(item, 'title')}</span>
          <span className="m-top-meta">{meta}</span>
        </span>
      </Link>
    );
  };

  // Всеукраїнські олімпіади МОН одним блоком: «N предметів», найближчий етап
  // з наказу (lib/olympiads.js), чипи предметів на власні сторінки, решта —
  // на путівник /olimpiady. Нічого, крім даних записів і наказу, тут немає.
  const renderGroup = (g) => {
    const first = STAGES[0];
    const allFree = g.items.every((o) => o.cost_type === 'free');
    const subjects = g.items.slice(0, 8);
    const rest = g.items.length - subjects.length;
    return (
      <article key={g.id} className="v2-olymp">
        <div className="v2-olymp-n" aria-hidden="true">
          <span className="v2-olymp-num">{g.items.length}</span>
          <span className="v2-olymp-word">{t.olymp.subjects(g.items.length).replace(/^\d+\s*/, '')}</span>
        </div>
        <div className="v2-olymp-body">
          <h3 className="v2-olymp-title">
            <Link href={t.olymp.href}>{t.olymp.title}</Link>
          </h3>
          <p className="v2-olymp-sub">
            {isEn ? `Stage I: ${first.startDate} — ${first.endDate}` : `${first.n}: ${first.when}`}
            {allFree ? ` · ${t.olymp.free}` : ''}
          </p>
          <div className="v2-olymp-subjects">
            {subjects.map((o) => (
              <Link key={o.id} href={`${isEn ? '/en' : ''}/o/${o.slug}`} className="v2-olymp-chip">
                {subjectLabel(o)}
              </Link>
            ))}
            {rest > 0 ? <Link href={t.olymp.href} className="v2-olymp-chip v2-olymp-rest">{t.olymp.more(rest)}</Link> : null}
          </div>
        </div>
        <Link href={t.olymp.href} className="v2-olymp-more">{t.olymp.details}</Link>
      </article>
    );
  };

  const chips = TYPE_CHIPS[teens ? 'teens' : 'parents']
    .filter((c) => available.chips.has(c.value) || type.includes(c.value));

  const optLabel = (o) => (isEn && o[2] ? o[2] : o[1]);
  const selectOpts = (list, availableSet, current) =>
    list.filter(([value]) => availableSet.has(value) || has(current, value));

  const ageList = AGE_OPTS[teens ? 'teens' : 'parents'];
  const needList = teens ? GIVES_OPTS : NEED_OPTS;

  // Топ віднімається від стрічки лише з трьома картками — тоді й додаємо його
  // назад. Інакше одна-дві картки топу вже є в стрічці й рахувались двічі.
  // Подія пошуку — пауза 600 мс, щоб не рахувати кожну літеру. Стоїть саме
  // тут, після stream: вище він ще в TDZ, і звернення до stream.length у
  // масиві залежностей валило б рендер.
  //
  // Кількість результатів шлемо разом із запитом: порожній пошук важливіший
  // за успішний, бо показує, чого в базі бракує.
  const count = stream.length + (topCards.length === 3 ? topCards.length : 0);
  // Скільки з видимих — безкоштовні. Рахуємо по тому, що людина зараз бачить,
  // а не по всій базі: після фільтра «платно» рядок «540 безкоштовних» був би
  // неправдою. До 28.09.2026 це число стояло в хіро, і на телефоні виходило
  // два однакові лічильники на одному екрані.
  const freeCount = stream.filter((o) => o.cost_type === 'free').length
    + (topCards.length === 3 ? topCards.filter((o) => o.cost_type === 'free').length : 0);
  // Олімпіади МОН — однією карткою на місці найближчої (lib/olympiad-group.js).
  // Лічильник «Знайдено N» і далі рахує записи, а не картки.
  const entries = useMemo(() => groupMonOlympiads(stream), [stream]);
  const shown = entries.slice(0, limit);
  useEffect(() => {
    if (!hydrated) return undefined;
    const q = query.trim();
    if (q.length < 2 || q === searched.current) return undefined;
    const timer = setTimeout(() => {
      searched.current = q;
      trackSearch(q, count);
    }, 600);
    return () => clearTimeout(timer);
  }, [hydrated, query, count]);
  // Фільтр застосовано — подія filter_apply на кожну зміну стану (з паузою,
  // щоб серія кліків по чипах не йшла десятком подій). Стан, з яким людина
  // прийшла за посиланням (?type=…), фільтром людини не вважаємо: його
  // запамʼятовуємо як відправну точку й не шлемо.
  const filtersSent = useRef(null);
  const filterSig = filterSignature({ type, age, deadline, need, cost, place, presetCity });
  useEffect(() => {
    if (!hydrated) return undefined;
    if (filtersSent.current === null) { filtersSent.current = filterSig; return undefined; }
    if (filterSig === filtersSent.current) return undefined;
    const timer = setTimeout(() => {
      filtersSent.current = filterSig;
      trackFilterApply(filterSig, count);
    }, 800);
    return () => clearTimeout(timer);
  }, [hydrated, filterSig, count]);
  // Після четвертої: перша сторінка каталогу — 6 карток на десктопі й 10 на
  // мобільному, а після шостої картка ставала в самий кінець сторінки, поруч
  // із блоком Telegram, що й так стоїть під каталогом.
  const tgAfter = inlineCardPositions(shown.length);

  // Лічильник на кнопці «Фільтри»: лише те, що живе в шторці й не видно в
  // рядку. Тип видно чипом у самому рядку, пошук — у полі.
  const sheetActive = age.length + need.length
    + (deadline !== 'all' ? 1 : 0) + (cost !== 'all' ? 1 : 0)
    + place.filter((v) => v !== presetCity).length;

  const closeSheet = () => {
    setDraft(null);
    filtersBtnRef.current?.focus();
  };

  const applyDraft = () => {
    setType(draft.type); setAge(draft.age); setDeadline(draft.deadline);
    setNeed(draft.need); setCost(draft.cost); setPlace(draft.place);
    setSort(draft.sort || 'deadline');
    setDraft(null);
    // Результат має бути видно одразу: якщо початок списку схований під
    // липкими рядками або далеко внизу — підкручуємо до лічильника.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = countRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < 130 || top > window.innerHeight * 0.6) {
        window.scrollTo({ top: top + window.scrollY - 130, behavior: 'smooth' });
      }
    }));
  };

  // Відкрита шторка: сторінка під нею не скролиться, Esc закриває без
  // застосування, фокус переходить у діалог. Якщо вікно розширили до
  // десктопа — шторку закриваємо, бо там її не видно.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    const mq = window.matchMedia('(max-width: 900px)');
    const onMq = () => { if (!mq.matches) setDraft(null); };
    window.addEventListener('keydown', onKey);
    mq.addEventListener?.('change', onMq);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener?.('change', onMq);
    };
    // closeSheet лише ставить стан і фокус — свіжа копія не потрібна.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  // Свайп униз закриває. Тягнути можна за шапку шторки або за вміст, коли
  // він прокручений до верху, — інакше жест належить прокрутці.
  const onSheetTouchStart = (e) => {
    const body = sheetBodyRef.current;
    // Підказки «Де» прокручуються самі — жест у них не тягне шторку.
    if ((body && body.contains(e.target) && body.scrollTop > 0)
      || e.target.closest?.('.pc-pop')) {
      drag.current = null;
      return;
    }
    drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onSheetTouchMove = (e) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    el.classList.add('is-dragging');
    el.style.transform = d.dy ? `translateY(${d.dy}px)` : '';
  };
  const onSheetTouchEnd = () => {
    const d = drag.current;
    const el = sheetRef.current;
    drag.current = null;
    if (!el) return;
    el.classList.remove('is-dragging');
    if (d && d.dy > 90) closeSheet();
    else el.style.transform = '';
  };

  // Лічильники в шторці рахуються на чернетці: скільки лишиться, якщо
  // обрати цей чип при решті обраних. Нульові опції ховаємо — мертвий чип
  // гірший за відсутній.
  const sheet = useMemo(
    () => (draft ? facetCounts(draft, { teens, todayIso, searchIndex, domestic, liveItems, t }) : null),
    // t змінюється лише з мовою, а мова в межах сторінки стала.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, liveItems, teens, todayIso, searchIndex, domestic],
  );

  // Бічна панель десктопа (≥1100px) рахує те саме, але на застосованих
  // фільтрах: там кожен клік одразу змінює список.
  const side = useMemo(
    () => (sidebarLayout
      ? facetCounts(
        { type, age, deadline, need, cost, place, query },
        { teens, todayIso, searchIndex, domestic, liveItems, t },
      )
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sidebarLayout, type, age, deadline, need, cost, place, query, liveItems, teens, todayIso, searchIndex, domestic],
  );

  // «Де» на десктопі — у бічній панелі й у рядку фільтрів (901–1099px і /en):
  // поле з підказками, ті самі опції й числа, що в шторці, але на застосованих
  // фільтрах. На головній числа вже пораховані для панелі; де панелі немає —
  // рахуємо лише «Де». На сторінці міста місце — рамка сторінки, поля немає.
  const deskPlace = useMemo(() => {
    if (presetCity) return null;
    const f = side
      ? { opts: side.placeOpts, counts: side.place }
      : placeFacet(
        { type, age, deadline, need, cost, place, query },
        { teens, todayIso, searchIndex, domestic, liveItems, t },
      );
    // Нульові опції ховаємо, як і всюди: мертва підказка гірша за відсутню.
    const options = f.opts.filter(([v]) => f.counts[v] > 0)
      .map(([v, uk, en]) => placeOption(v, uk, en, lang));
    return { options, counts: f.counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, presetCity, type, age, deadline, need, cost, place, query, liveItems, teens, todayIso, searchIndex, domestic, lang]);

  const sheetGroup = (key, title, allLabel, opts) => {
    const counts = sheet[key];
    const cur = draft[key];
    const multi = MULTI.includes(key);
    const visible = opts.filter(([v]) => counts[v] > 0 || has(cur, v));
    if (!visible.length) return null;
    const pickAll = () => setDraft({ ...draft, [key]: multi ? [] : 'all' });
    const pick = (v) => setDraft({
      ...draft,
      [key]: multi ? toggle(cur, v) : (cur === v ? 'all' : v),
    });
    return (
      <div className="m-group" role="group" aria-labelledby={`m-group-${key}`} key={key}>
        <h3 id={`m-group-${key}`}>{title}</h3>
        <div className="m-group-chips">
          <button
            type="button"
            className={`m-chip${isAll(cur) ? ' is-on' : ''}`}
            aria-pressed={isAll(cur)}
            onClick={pickAll}
          >
            {allLabel}<span className="m-chip-n">{counts.all}</span>
          </button>
          {visible.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`m-chip${has(cur, v) ? ' is-on' : ''}`}
              aria-pressed={has(cur, v)}
              onClick={() => pick(v)}
            >
              {label}<span className="m-chip-n">{counts[v]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // «Де» в шторці (Марія 14.09.2026): три чипи — «За кордоном», «Україна»,
  // «Онлайн», — а місто окремо: міст десятки, і стіна чипів вимагала довго
  // гортати. Обрані міста — знімними чипами. З 27.09.2026 місто не гортають
  // у рідному списку телефона, а вписують: підказки звужуються з кожною
  // літерою, у підказці — скільки дасть.
  const sheetPlace = () => {
    const counts = sheet.place;
    const togglePlace = (v) => setDraft({ ...draft, place: pickPlace(draft.place, v) });
    const kinds = PLACE_KINDS.filter((v) => counts[v] > 0 || draft.place.includes(v));
    const chosenCities = draft.place.filter((v) => v !== presetCity && !PLACE_KINDS.includes(v));
    const cityOpts = sheet.placeOpts.filter((o) => !PLACE_KINDS.includes(o[0])
      && !draft.place.includes(o[0]) && counts[o[0]] > 0);
    if (!kinds.length && !cityOpts.length && !chosenCities.length) return null;
    // Види місця теж у підказках, але лише коли їх вписали: на порожньому
    // полі вони б дублювали чипи над ним.
    const sheetOptions = sheet.placeOpts.filter(([v]) => counts[v] > 0)
      .map(([v, uk, en]) => placeOption(v, uk, en, lang));
    return (
      <div className="m-group" role="group" aria-labelledby="m-group-place" key="place">
        <h3 id="m-group-place">{t.sel.where}</h3>
        <div className="m-group-chips">
          {kinds.map((v) => (
            <button
              key={v}
              type="button"
              className={`m-chip${draft.place.includes(v) ? ' is-on' : ''}`}
              aria-pressed={draft.place.includes(v)}
              onClick={() => togglePlace(v)}
            >
              {placeLabel(v)}<span className="m-chip-n">{counts[v]}</span>
            </button>
          ))}
          {chosenCities.map((v) => (
            <button
              key={v}
              type="button"
              className="m-chip is-on"
              aria-label={`${t.remove}: ${placeLabel(v)}`}
              onClick={() => togglePlace(v)}
            >
              {placeLabel(v)}<span className="m-chip-x" aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
        {cityOpts.length ? (
          <PlaceCombobox
            id="m-sheet-place"
            className="pc--sheet"
            inline
            kindsWhenEmpty={false}
            options={sheetOptions}
            counts={counts}
            chosen={draft.place}
            onPick={togglePlace}
            placeholder={chosenCities.length ? t.addCity : t.pickCity}
            ariaLabel={t.pickCity}
            emptyText={t.nothingTitle}
          />
        ) : null}
      </div>
    );
  };

  // Знімні чипи над списком (6b): лише те, що налаштовується в шторці.
  const labelOf = (list, v) => {
    const o = list.find((x) => x[0] === v);
    return o ? optLabel(o) : v;
  };
  const placeLabel = (v) => (v === 'abroad' ? t.abroad : v === 'online' ? t.online
    : v === 'ukraine' ? t.ukraine
    : isCountryValue(v) ? `🌍 ${countryName(v.slice(COUNTRY_PREFIX.length), isEn ? 'en' : 'uk')}`
    : (isEn ? cityLabel(v, 'en') : v));
  // Мультигрупи — по чипу на кожне обране значення, щоб зняти можна було одне.
  const activeChips = [
    ...age.map((v) => ({
      key: `age-${v}`,
      label: teens ? labelOf(ageList, v) : `${labelOf(ageList, v)} ${t.years}`,
      clear: () => setAge(age.filter((x) => x !== v)),
    })),
    deadline !== 'all' && { key: 'deadline', label: labelOf(DEADLINE_OPTS, deadline), clear: () => setDeadline('all') },
    ...need.map((v) => ({ key: `need-${v}`, label: labelOf(needList, v), clear: () => setNeed(need.filter((x) => x !== v)) })),
    cost !== 'all' && { key: 'cost', label: labelOf(COST_OPTS, cost), clear: () => setCost('all') },
    ...place.filter((v) => v !== presetCity).map((v) => ({
      key: `place-${v}`,
      label: placeLabel(v),
      clear: () => setPlace(place.filter((x) => x !== v)),
    })),
  ].filter(Boolean);

  // Бічна панель десктопа (≥1100px, референс «Dityam — головна з боковими
  // фільтрами»): ті самі фільтри, що в рядку пігулок і селектах, але списками
  // з лічильниками, і клік застосовується одразу. На цій ширині рядок
  // .v2-filters ховає CSS, нижче 1100px — навпаки, ховається панель.
  const sideSetters = { type: setType, age: setAge, deadline: setDeadline, need: setNeed, cost: setCost };
  const sideApplied = { type, age, deadline, need, cost };
  // Групи панелі за макетом Main.dc.html: вік — пігулки, дедлайн — один
  // перемикач із «Будь-коли», решта — чекбокси з лічильником праворуч.
  // Рядок «Усі» є лише в перемикача: у чекбоксів «нічого не обрано» і є
  // «усі», а в пігулок — теж.
  const sideGroup = (key, title, allLabel, opts, kind = 'check') => {
    const counts = side[key];
    const cur = sideApplied[key];
    const set = sideSetters[key];
    const multi = MULTI.includes(key);
    // Нульові опції ховаємо, як і в шторці: мертвий пункт гірший за відсутній.
    const visible = opts.filter(([v]) => counts[v] > 0 || has(cur, v));
    if (!visible.length) return null;
    if (kind === 'pills') {
      return (
        <div className="v2-side-group" role="group" aria-labelledby={`v2-side-${key}`}>
          <span id={`v2-side-${key}`} className="v2-side-title">{title}</span>
          <div className="v2-side-pills">
            {visible.map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`v2-side-pill${has(cur, v) ? ' is-on' : ''}`}
                aria-pressed={has(cur, v)}
                onClick={() => set(multi ? toggle(cur, v) : (cur === v ? 'all' : v))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    const row = (v, label, on, onClick, n) => (
      <button
        key={v}
        type="button"
        className={`v2-side-item v2-side-${kind}${on ? ' is-on' : ''}`}
        role={kind === 'radio' ? 'radio' : 'checkbox'}
        aria-checked={on}
        onClick={onClick}
      >
        <span className="v2-side-box" aria-hidden="true" />
        <span className="v2-side-label">{label}</span>
        {n !== null ? <span className="v2-side-n">{n}</span> : null}
      </button>
    );
    return (
      <div className="v2-side-group" role={kind === 'radio' ? 'radiogroup' : 'group'} aria-labelledby={`v2-side-${key}`}>
        <span id={`v2-side-${key}`} className="v2-side-title">{title}</span>
        <div className="v2-side-list">
          {kind === 'radio' ? row('all', allLabel, isAll(cur), () => set('all'), null) : null}
          {visible.map(([v, label]) => row(
            v, label, has(cur, v),
            () => set(multi ? toggle(cur, v) : (cur === v ? 'all' : v)),
            counts[v],
          ))}
        </div>
      </div>
    );
  };

  // Порядок груп за макетом (29.09.2026): вік → дедлайн → вартість → де
  // (формат і місце: онлайн, за кордоном, місто) → тип → особлива потреба.
  // Пошуку в панелі немає: поле в хіро шле запит сюди подією.
  // Обставини — усі одразу, без «Ще N» (Марія, 30.09.2026: «показуй усі фільтри»).
  const needOpts = needList.map((o) => [o[0], optLabel(o)]);
  const needShown = needOpts.filter(([v]) => (side?.need?.[v] || 0) > 0 || has(need, v));

  const renderSide = () => (
    <aside className="v2-side" aria-label={t.filters}>
      <span className="v2-side-heading">{t.filters}</span>
      {hasActive ? (
        <button type="button" className="v2-side-reset" onClick={reset}>{t.resetFilters}</button>
      ) : null}
      {sideGroup('age', teens ? t.sel.grade : t.sel.age, t.all,
        ageList.map((o) => [o[0], optLabel(o)]), 'pills')}
      {sideGroup('deadline', t.sel.deadline, t.anyTime,
        DEADLINE_OPTS.map((o) => [o[0], optLabel(o)]), 'radio')}
      {sideGroup('cost', t.sel.cost, t.anyCost,
        COST_OPTS.map((o) => [o[0], optLabel(o)]))}
      {/* «Формат»: онлайн і за кордоном — чекбоксами з лічильниками (як у
          макеті), місто — полем з підказками нижче: міст десятки, повний
          список був би довшим за екран (27.09.2026). Обрані міста й країни —
          рядками, клік знімає. */}
      {deskPlace && (deskPlace.options.length || place.length) ? (
        <div className="v2-side-group" role="group" aria-labelledby="v2-side-place-title">
          <label id="v2-side-place-title" htmlFor="v2-side-place" className="v2-side-title">{t.formatGroup}</label>
          <div className="v2-side-list">
            {['online', 'abroad'].map((v) => {
              const opt = deskPlace.options.find((o) => o.value === v);
              const on = place.includes(v);
              if (!opt && !on) return null;
              return (
                <button
                  key={v}
                  type="button"
                  className={`v2-side-item v2-side-check${on ? ' is-on' : ''}`}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setPlace(pickPlace(place, v))}
                >
                  <span className="v2-side-box" aria-hidden="true" />
                  {/* Без емодзі: у бренд-кіті єдина емодзі — 🧡. */}
                  <span className="v2-side-label">{placeLabel(v).replace(/^[^\p{L}\d]+/u, '')}</span>
                  <span className="v2-side-n">{deskPlace.counts[v] || 0}</span>
                </button>
              );
            })}
          </div>
          {place.filter((v) => v !== 'online' && v !== 'abroad').length ? (
            <div className="v2-side-list">
              {place.filter((v) => v !== 'online' && v !== 'abroad').map((v) => (
                <button
                  key={v}
                  type="button"
                  className="v2-side-item is-on"
                  aria-label={`${t.remove}: ${placeLabel(v)}`}
                  onClick={() => setPlace(place.filter((x) => x !== v))}
                >
                  <span>{placeLabel(v)}</span>
                  <span className="v2-side-n" aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
          ) : null}
          <PlaceCombobox
            id="v2-side-place"
            className="pc--side"
            labelId="v2-side-place-title"
            options={deskPlace.options.filter((o) => o.value !== 'online' && o.value !== 'abroad')}
            counts={deskPlace.counts}
            chosen={place}
            onPick={(v) => setPlace(pickPlace(place, v))}
            placeholder={t.city}
            emptyText={t.nothingTitle}
          />
        </div>
      ) : null}
      {/* «Онлайн» уже стоїть у «Формат» — у типах не дублюємо. */}
      {sideGroup('type', t.typeGroup, t.all,
        TYPE_CHIPS[teens ? 'teens' : 'parents'].filter((c) => c.value !== 'online')
          .map((c) => [c.value, (isEn ? c.en : c.label).replace(/^[^\p{L}\d]+/u, '')]))}
      {needShown.length ? (
        <div className="v2-side-group" role="group" aria-labelledby="v2-side-need">
          <span id="v2-side-need" className="v2-side-title">{teens ? t.sel.gives : t.sel.need}</span>
          <div className="v2-side-list">
            {needShown.map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`v2-side-item v2-side-check${has(need, v) ? ' is-on' : ''}`}
                role="checkbox"
                aria-checked={has(need, v)}
                onClick={() => setNeed(toggle(need, v))}
              >
                <span className="v2-side-box" aria-hidden="true" />
                <span className="v2-side-label">{label}</span>
                <span className="v2-side-n">{side?.need?.[v] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );

  const searchInput = (extra = {}) => (
    <input
      type="search"
      enterKeyHint="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={teens ? t.mSearchTeens : t.mSearchParents}
      aria-label={isEn ? 'Search' : 'Пошук'}
      {...extra}
    />
  );

  return (
    <>
      {mobileLayout ? (
        <>
          <div className="m-band" ref={bandRef}>
            <label className="m-search">
              <span className="m-search-icon" aria-hidden="true">🔍</span>
              {searchInput()}
            </label>
            {/* Вік одразу під пошуком (макет Mobile.dc.html): пʼять груп сайту,
                ті самі, що в шторці й бічній панелі. */}
            <div className="m-ages" role="group" aria-label={teens ? t.sel.grade : t.sel.age}>
              {ageList.filter((o) => available.ages.has(o[0]) || age.includes(o[0])).map((o) => (
                <button
                  key={o[0]}
                  type="button"
                  className={`m-chip m-age${age.includes(o[0]) ? ' is-on' : ''}`}
                  aria-pressed={age.includes(o[0])}
                  onClick={() => setAge(toggle(age, o[0]))}
                >
                  {optLabel(o)}
                </button>
              ))}
            </div>
          </div>

          <div className={`m-compact${compact ? ' is-on' : ''}`} aria-hidden={compact ? undefined : 'true'}>
            <a
              href={isEn ? '/en' : '/'}
              className="m-compact-logo"
              tabIndex={compact ? undefined : -1}
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              dityam.com.ua
            </a>
            <label className="m-search m-search--compact">
              <span className="m-search-icon" aria-hidden="true">🔍</span>
              {searchInput({ tabIndex: compact ? undefined : -1 })}
            </label>
          </div>

        </>
      ) : null}

      <section className="v2-filters" aria-label={isEn ? 'Filters' : 'Фільтри'}>
        <div className="v2-chips">
          <button
            type="button"
            className={`v2-chip${type.length === 0 ? ' is-on' : ''}`}
            aria-pressed={type.length === 0}
            onClick={() => setType([])}
          >
            {t.all}
          </button>
          {chips.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`v2-chip${type.includes(c.value) ? ' is-on' : ''}`}
              aria-pressed={type.includes(c.value)}
              onClick={() => setType(toggle(type, c.value))}
            >
              {isEn ? c.en : c.label}
            </button>
          ))}
          {hasActive ? (
            <button type="button" className="v2-reset" onClick={reset}>{t.reset}</button>
          ) : null}
        </div>

        <div className="v2-selects">
          {/* Селекти на 901–1099px лишились на одне значення; мультивибір —
              у бічній панелі й шторці. Показуємо перше обране. «Де» — виняток,
              мультивибір і тут (поле з підказками нижче). */}
          <Select
            label={teens ? t.sel.grade : t.sel.age}
            allLabel={t.all}
            value={age[0] || 'all'}
            onChange={(v) => setAge(v === 'all' ? [] : [v])}
            options={selectOpts(ageList, available.ages, age).map((o) => [o[0], optLabel(o)])}
          />
          <Select
            label={t.sel.deadline}
            allLabel={t.all}
            value={deadline}
            onChange={setDeadline}
            options={selectOpts(DEADLINE_OPTS, available.deadlines, deadline).map((o) => [o[0], optLabel(o)])}
          />
          <Select
            label={teens ? t.sel.gives : t.sel.need}
            allLabel={t.all}
            value={need[0] || 'all'}
            onChange={(v) => setNeed(v === 'all' ? [] : [v])}
            options={selectOpts(needList, available.needs, need).map((o) => [o[0], optLabel(o)])}
          />
          <Select
            label={t.sel.cost}
            allLabel={t.anyCost}
            value={cost}
            onChange={setCost}
            options={selectOpts(COST_OPTS, available.costs, cost).map((o) => [o[0], optLabel(o)])}
          />
          {/* «Де» — поле з підказками, як у бічній панелі й шторці, і так
              само мультивибір: обрані місця — чипами з ✕ перед полем. */}
          {deskPlace ? (
            <div className="v2-place" role="group" aria-label={t.sel.where}>
              {place.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="v2-chip is-on v2-place-tag"
                  aria-label={`${t.remove}: ${placeLabel(v)}`}
                  onClick={() => setPlace(place.filter((x) => x !== v))}
                >
                  {placeLabel(v)}
                  <span className="v2-place-x" aria-hidden="true">✕</span>
                </button>
              ))}
              <PlaceCombobox
                id="v2-bar-place"
                className="pc--bar"
                ariaLabel={t.sel.where}
                options={deskPlace.options}
                counts={deskPlace.counts}
                chosen={place}
                onPick={(v) => setPlace(pickPlace(place, v))}
                placeholder={place.length ? t.addPlace : `${t.sel.where}: ${t.all}`}
                emptyText={t.nothingTitle}
              />
            </div>
          ) : null}
          <label className="v2-search">
            <span className="v2-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={teens ? t.searchTeens : t.searchParents}
              aria-label={isEn ? 'Search' : 'Пошук'}
            />
          </label>
        </div>

        <div className="v2-found">
          <span>{t.found} <strong>{count}</strong> {t.countWord(count)}</span>
        </div>
      </section>

      {/* Обгортки потрібні лише бічній панелі (сітка «панель | колонка»).
          Нижче 1100px вони display: contents — діти поводяться як прямі
          нащадки контейнера, і решта верстки їх не помічає. */}
      <Wrap on={sidebarLayout} className="v2-catalog">
        {sidebarLayout ? renderSide() : null}
        <Wrap on={sidebarLayout} className="v2-catalog-main">
          {topCards.length === 3 && !sidebarLayout ? (
            <section className="v2-top" aria-label={t.topTitle}>
              <div className="v2-top-head">
                <h2>{t.topTitle}</h2>
                <span>{t.topSub}</span>
              </div>
              <div className="v2-grid">
                {topCards.map((item) => renderCard(item))}
              </div>
            </section>
          ) : null}

          {mobileLayout && topCards.length === 3 ? (
            <section className="m-top" aria-labelledby="m-top-title">
              <div className="m-top-head">
                {/* «Цього тижня» — лише коли всі три справді закриваються за 7
                    днів; інакше заголовок обіцяв би те, чого в стрічці немає. */}
                <h2 id="m-top-title">
                  {topCards.every((c) => {
                    const d = daysUntil(c.deadline, todayIso);
                    return d !== null && d <= 7;
                  }) ? t.mTopWeek : t.mTopSoon}
                </h2>
                <span aria-hidden="true">{`${topIndex + 1} / 3 · ${t.swipe}`}</span>
              </div>
              <div
                className="m-top-strip"
                onScroll={(e) => {
                  const i = Math.round(e.currentTarget.scrollLeft / 272);
                  setTopIndex(Math.min(2, Math.max(0, i)));
                }}
              >
                {topCards.map(renderTopCard)}
              </div>
            </section>
          ) : null}

          {mobileLayout && activeChips.length ? (
            <div className="m-active">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="m-active-chip"
                  aria-label={`${t.remove}: ${c.label}`}
                  onClick={c.clear}
                >
                  {c.label}
                  <span className="m-active-x" aria-hidden="true">✕</span>
                </button>
              ))}
              <button type="button" className="m-active-reset" onClick={reset}>{t.reset}</button>
            </div>
          ) : null}

          {mobileLayout ? (
            <div className="m-count" aria-live="polite" ref={countRef}>
              <span>
                <strong>{count}</strong> {t.countWord(count)}
                {freeCount ? (
                  <span className="m-count-free">
                    {' · '}<strong>{freeCount}</strong> {t.freeWord(freeCount)}
                  </span>
                ) : null}
              </span>
              <span className="m-count-hint">{t.sortHint}</span>
            </div>
          ) : null}

          {sidebarLayout ? (
            <div className="v2-side-head">
              <div className="v2-side-count" aria-live="polite">
                <span><strong>{count}</strong> {t.countWord(count)}</span>
                <label className="v2-sort">
                  <span>{t.sortLabel}</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t.sortLabel}>
                    <option value="deadline">{t.sortDeadline}</option>
                    <option value="new">{t.sortNew}</option>
                  </select>
                </label>
              </div>
              {activeChips.length ? (
                <div className="v2-active">
                  {activeChips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className="v2-active-chip"
                      aria-label={`${t.remove}: ${c.label}`}
                      onClick={c.clear}
                    >
                      {c.label}
                      <span className="v2-active-x" aria-hidden="true">✕</span>
                    </button>
                  ))}
                  <button type="button" className="v2-active-reset" onClick={reset}>{t.clearAll}</button>
                </div>
              ) : null}
            </div>
          ) : null}

          {shown.length ? (
            <section className={`v2-grid${mobileLayout ? ' v2-list' : ''}`}>
              {/* Telegram-картка кожні 20 можливостей (lib/inline-card.js):
                  без таймерів, замість 4-секундної спливної підказки. */}
              {shown.flatMap((item, i) => (
                tgAfter.has(i)
                  ? [item.group ? renderGroup(item) : renderCard(item), <TelegramCard key={`tg-card-${i}`} lang={lang} place="catalog" />]
                  : [item.group ? renderGroup(item) : renderCard(item)]
              ))}
            </section>
          ) : (
            <div className="v2-empty">
              <span style={{ fontSize: 32 }} aria-hidden="true">🔍</span>
              <h3>{t.nothingTitle}</h3>
              <p>{t.nothingText}</p>
            </div>
          )}

          {entries.length > limit ? (
            <div className="v2-more-row">
              <button type="button" className="v2-more-btn" onClick={() => setLimit(limit + pageSize.current)}>
                {t.showMore}
              </button>
            </div>
          ) : null}
        </Wrap>
      </Wrap>

      {/* Панель знизу (Марія, 30.09.2026): ліворуч Telegram-канал — головний
          заклик сайту, праворуч «Фільтри (n)», що відкриває шторку; сортування
          живе в шторці. Замінила липкий рядок чипів угорі. */}
      {mobileLayout ? (
        <div className="m-bottom">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="m-bottom-btn m-bottom-tg"
            onClick={() => {
              trackConversion('telegram_join_click', { event_label: 'home_bar', popup_trigger: 'home_bar' });
              trackSubscribeClick({ target: 'channel', placement: 'home_bar' });
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
            </svg>
            {t.tgBar}
          </a>
          <button
            type="button"
            className={`m-bottom-btn${type.length + sheetActive + (sort !== 'deadline' ? 1 : 0) ? ' is-on' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            ref={filtersBtnRef}
            onClick={() => setDraft({ type, age, deadline, need, cost, place, query, sort })}
          >
            <span aria-hidden="true">⚙︎</span>
            {t.filtersBtn(type.length + sheetActive + (sort !== 'deadline' ? 1 : 0))}
          </button>
        </div>
      ) : null}

      {mobileLayout && sheet ? (
        <div className="m-sheet-root">
          <div className="m-sheet-overlay" onClick={closeSheet} aria-hidden="true" />
          <div
            className="m-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="m-sheet-title"
            tabIndex={-1}
            ref={sheetRef}
            onTouchStart={onSheetTouchStart}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
            onTouchCancel={onSheetTouchEnd}
          >
            <div className="m-sheet-head">
              <button type="button" className="m-sheet-handle" aria-label={t.close} onClick={closeSheet} />
              <div className="m-sheet-title-row">
                <h2 id="m-sheet-title" className="m-sheet-title">{t.filters}</h2>
                <button
                  type="button"
                  className="m-sheet-reset"
                  onClick={() => setDraft({
                    type: [], age: [], deadline: 'all', need: [], cost: 'all',
                    place: presetCity ? [presetCity] : [], query: draft.query, sort: 'deadline',
                  })}
                >
                  {t.resetAll}
                </button>
              </div>
            </div>

            <div className="m-sheet-body" ref={sheetBodyRef}>
              {/* Сортування — тут, а не окремою кнопкою в панелі знизу. */}
              <div className="m-group" role="group" aria-labelledby="m-sort-title">
                <h3 id="m-sort-title">{t.sortBtn}</h3>
                <div className="m-group-chips">
                  {[['deadline', t.sortDeadline], ['new', t.sortNew]].map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      className={`m-chip${(draft.sort || 'deadline') === v ? ' is-on' : ''}`}
                      aria-pressed={(draft.sort || 'deadline') === v}
                      onClick={() => setDraft({ ...draft, sort: v })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {sheetGroup('type', t.typeGroup, t.all,
                TYPE_CHIPS[teens ? 'teens' : 'parents'].map((c) => [c.value, isEn ? c.en : c.label]))}
              {sheetGroup('age', teens ? t.sel.grade : t.sel.age, t.all,
                ageList.map((o) => [o[0], optLabel(o)]))}
              {sheetGroup('deadline', t.sel.deadline, t.all,
                DEADLINE_OPTS.map((o) => [o[0], optLabel(o)]))}
              {sheetGroup('need', teens ? t.sel.gives : t.sel.need, teens ? t.all : t.allKids,
                needList.map((o) => [o[0], optLabel(o)]))}
              {/* Вартість — чипами «Безкоштовно / Платно», а не тумблером
                  «Тільки безкоштовні» з референсу: платне має бути так само
                  знаходиме, як і безкоштовне (урок #152). */}
              {sheetGroup('cost', t.sel.cost, t.anyCost,
                COST_OPTS.map((o) => [o[0], optLabel(o)]))}
              {!presetCity ? sheetPlace() : null}
            </div>

            <div className="m-sheet-foot">
              <button
                type="button"
                className="m-sheet-apply"
                disabled={!sheet.total}
                onClick={applyDraft}
              >
                {t.show(sheet.total)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// Обгортка, яка є лише коли потрібна: без неї розмітка лишається рівно
// такою, як на сторінках міст і тем.
function Wrap({ on, className, children }) {
  return on ? <div className={className}>{children}</div> : children;
}

function FieldRow({ k, v }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

function Select({ label, allLabel, value, onChange, options }) {
  return (
    <select
      className="v2-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      <option value="all">{`${label}: ${allLabel}`}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
