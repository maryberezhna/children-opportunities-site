'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import PlusSection from './PlusSection';
import { TYPE_LABELS, TYPE_LABELS_EN, ANNUAL_TYPES, isEvent } from '@/lib/labels';
import { cityLabel, formatLabel } from '@/lib/labels';
import { opportunitiesWord } from '@/lib/plural';
import { daysUntil, kyivToday } from '@/lib/dates';
import { visibleFor } from '@/lib/audience';
import { goesAbroad } from '@/lib/geo';
import { buildHaystack, queryTokens, matchesQuery } from '@/lib/search';
import { trackOpportunityClick } from '@/lib/track';
import { TAG_COLORS, TAG_FALLBACK } from '@/lib/tag-colors';
import { readMode, onModeChange } from '@/lib/mode';

// Каталог, версія редизайну (вересень 2026, референс «Dityam — новий дизайн
// головної»). Один компонент обслуговує головну, /en і сторінки міст/тем.
//
// Що змінилось проти старої версії:
// - фільтри стали одновибірними: ряд пігулок «Тип» + чотири селекти + пошук —
//   замість девʼяти розкривних мультифільтрів;
// - зʼявився режим «Підліткам» (перемикач у шапці): свої пігулки, вік
//   класами, фільтр «Що дає» по teen_tags і поля картки «Отримаєш / Треба»;
// - «Топ тижня» — три найближчі дедлайни автоматично, а не кураторська
//   трійка featured_week;
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
    details: 'Детальніше ↗',
    topTitle: '⏰ Топ тижня',
    annual: '🔄 щорічно',
    open: 'набір відкритий',
    today: 'сьогодні',
    tomorrow: 'завтра',
    inDays: (n) => `через ${n} дн.`,
    daysLeft: (n) => `${n} ${n === 1 ? 'день' : 'днів'}`,
    until: (d) => `до ${d}`,
    noDeadline: 'без дедлайну',
    searchParents: 'FLEX, програмування, допомога ВПО…',
    searchTeens: 'FLEX, стажування, НМТ…',
    mSearchParents: 'Табір, FLEX, ВПО…',
    mSearchTeens: 'FLEX, стажування, НМТ…',
    sideSearchTeens: 'FLEX, стажування…',
    filters: 'Фільтри',
    mTopWeek: '⏰ Встигніть цього тижня',
    mTopSoon: '⏰ Найближчі дедлайни',
    swipe: 'листайте →',
    sortHint: 'за дедлайном ↓',
    typeGroup: 'Тип',
    allKids: 'Усі діти',
    resetAll: 'Скинути все',
    remove: 'Зняти фільтр',
    years: 'років',
    close: 'Закрити фільтри',
    resetFilters: 'Скинути фільтри',
    sortLong: 'спочатку — з найближчим дедлайном',
    show: (n) => (n ? `Показати ${n} ${opportunitiesWord(n)}` : 'Нічого не знайдено'),
    ageShort: (a, b) => (a === b ? `${a} р.` : `${a}–${b} р.`),
    f: { format: 'Формат', place: 'Де', source: 'Джерело',
      benefit: 'Отримаєш', requirement: 'Треба', deadline: 'Дедлайн' },
    sel: { age: 'Вік дитини', grade: 'Клас', deadline: 'Дедлайн',
      need: 'Особлива потреба', gives: 'Що дає', cost: 'Вартість', where: 'Де' },
    all: 'Усі', anyCost: 'Будь-яка', abroad: '🌍 За кордоном', online: '💻 Онлайн',
    countWord: (n) => opportunitiesWord(n),
  },
  en: {
    found: 'Found',
    reset: 'Reset',
    nothingTitle: 'Nothing found',
    nothingText: 'Try a different filter.',
    showMore: 'Show more',
    details: 'Details ↗',
    topTitle: '⏰ Top this week',
    annual: '🔄 every year',
    open: 'enrolment open',
    today: 'today',
    tomorrow: 'tomorrow',
    inDays: (n) => `in ${n} days`,
    daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
    until: (d) => `by ${d}`,
    noDeadline: 'no deadline',
    searchParents: 'FLEX, coding, IDP aid…',
    searchTeens: 'FLEX, internships…',
    mSearchParents: 'Camp, FLEX, IDP…',
    mSearchTeens: 'FLEX, internships…',
    sideSearchTeens: 'FLEX, internships…',
    filters: 'Filters',
    mTopWeek: '⏰ Make it this week',
    mTopSoon: '⏰ Closing soonest',
    swipe: 'swipe →',
    sortHint: 'by deadline ↓',
    typeGroup: 'Type',
    allKids: 'All children',
    resetAll: 'Reset all',
    remove: 'Remove filter',
    years: 'y.o.',
    close: 'Close filters',
    resetFilters: 'Reset filters',
    sortLong: 'closest deadline first',
    show: (n) => (n ? `Show ${n} ${n === 1 ? 'opportunity' : 'opportunities'}` : 'Nothing found'),
    ageShort: (a, b) => (a === b ? `age ${a}` : `${a}–${b} y.o.`),
    f: { format: 'Format', place: 'Where', source: 'Source',
      benefit: 'You get', requirement: 'You need', deadline: 'Deadline' },
    sel: { age: 'Child age', grade: 'Grade', deadline: 'Deadline',
      need: 'Special need', gives: 'What it gives', cost: 'Cost', where: 'Where' },
    all: 'All', anyCost: 'Any', abroad: '🌍 Abroad', online: '💻 Online',
    countWord: (n) => (n === 1 ? 'opportunity' : 'opportunities'),
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
  calm: ['#f7f1e6', '#8a8a8a'],
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

// Предикати фільтрів як чиста функція стану: той самий код рахує і
// застосовані фільтри, і чернетку в мобільній шторці — інакше «Показати N»
// у шторці могло б розійтися з тим, що покаже список.
function buildPredicates(s, { teens, todayIso, searchIndex }) {
  const tokens = queryTokens(s.query);
  return {
    type: (item) => {
      if (s.type === 'all') return true;
      if (s.type === 'online') return isOnline(item);
      if (s.type === 'payments') {
        return item.opportunity_type === 'allowance'
          || item.opportunity_type === 'support_payment'
          || item.aid_type === 'cash';
      }
      if (s.type === 'classes') return CLASSES_TYPES.includes(item.opportunity_type);
      return item.opportunity_type === s.type;
    },
    age: (item) => s.age === 'all' || ageMatches(item, s.age),
    deadline: (item) => {
      if (s.deadline === 'all') return true;
      const days = daysUntil(item.deadline, todayIso);
      if (s.deadline === 'none') return days === null;
      if (s.deadline === 'week') return days !== null && days >= 0 && days <= 7;
      if (s.deadline === 'month') return days !== null && days >= 0 && days <= 31;
      return true;
    },
    need: (item) => {
      if (s.need === 'all') return true;
      if (teens) {
        if ((item.teen_tags || []).includes(s.need)) return true;
        // «Поїздка» працює і до розмітки: закордон видно з географії.
        return s.need === 'поїздка' && goesAbroad(item);
      }
      return (item.child_needs || []).includes(s.need);
    },
    cost: (item) => {
      if (s.cost === 'all') return true;
      if (s.cost === 'free') return item.cost_type === 'free';
      return item.cost_type === 'paid_affordable' || item.cost_type === 'paid_premium';
    },
    place: (item) => {
      if (s.place === 'all') return true;
      if (s.place === 'abroad') return goesAbroad(item);
      if (s.place === 'online') return isOnline(item);
      const cities = item.cities || [];
      if (cities.includes(s.place)) return true;
      // «Вся Україна» просвічує крізь вибір конкретного міста.
      return cities.includes('Вся Україна') && !PSEUDO_CITIES.has(s.place);
    },
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
function facetCounts(s, { teens, todayIso, searchIndex, liveItems, t }) {
  const ctx = { teens, todayIso, searchIndex };
  const dp = buildPredicates(s, ctx);
  const passOthers = (skip) =>
    liveItems.filter((item) => FACETS.every((k) => k === skip || dp[k](item)));
  const countOpts = (facet, values) => {
    const base = passOthers(facet);
    const out = { all: base.length };
    for (const v of values) {
      const p = buildPredicates({ ...s, [facet]: v }, ctx)[facet];
      out[v] = base.filter(p).length;
    }
    return out;
  };
  const places = new Set();
  passOthers('place').forEach((item) => {
    (item.cities || []).forEach((c) => { if (!PSEUDO_CITIES.has(c)) places.add(c); });
    if (goesAbroad(item)) places.add('abroad');
    if (teens && isOnline(item)) places.add('online');
  });
  const placeOpts = [];
  if (places.has('abroad')) placeOpts.push(['abroad', t.abroad, t.abroad]);
  if (places.has('online')) placeOpts.push(['online', t.online, t.online]);
  [...places].filter((p) => p !== 'abroad' && p !== 'online')
    .sort((a, b) => a.localeCompare(b, 'uk'))
    .forEach((c) => placeOpts.push([c, c, cityLabel(c, 'en')]));
  return {
    total: liveItems.filter((item) => FACETS.every((k) => dp[k](item))).length,
    type: countOpts('type', TYPE_CHIPS[teens ? 'teens' : 'parents'].map((c) => c.value)),
    age: countOpts('age', AGE_OPTS[teens ? 'teens' : 'parents'].map((o) => o[0])),
    deadline: countOpts('deadline', DEADLINE_OPTS.map((o) => o[0])),
    need: countOpts('need', (teens ? GIVES_OPTS : NEED_OPTS).map((o) => o[0])),
    cost: countOpts('cost', COST_OPTS.map((o) => o[0])),
    placeOpts,
    place: countOpts('place', placeOpts.map((o) => o[0])),
  };
}

export default function OpportunitiesList({
  opportunities, presetCity, promoProps = null, lang = 'uk', today, modeAware = false,
  mobileLayout = false, sidebarLayout = false,
}) {
  const todayIso = today || kyivToday();
  const t = UI[lang] || UI.uk;
  const isEn = lang === 'en';

  // Режим «Батькам / Підліткам» вмикається лише там, де в шапці є
  // перемикач (головна). На сторінках міст і тем каталог завжди
  // батьківський — там своя обіцянка в заголовку сторінки.
  const pageSize = useRef(6);
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
      setType('all'); setAge('all'); setDeadline('all'); setNeed('all');
      setCost('all'); setQuery(''); setLimit(pageSize.current);
      if (!presetCity) setPlace('all');
    });
  }, [modeAware, presetCity]);
  const teens = mode === 'teens';

  const [type, setType] = useState('all');
  const [age, setAge] = useState('all');
  const [deadline, setDeadline] = useState('all');
  const [need, setNeed] = useState('all');
  const [cost, setCost] = useState('all');
  const [place, setPlace] = useState(presetCity || 'all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
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
  // Старі мультизначення (?type=a,b) читаємо по першому токену.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const one = (key) => (p.get(key) || '').split(',').filter(Boolean)[0];
    const setters = { type: setType, age: setAge, deadline: setDeadline,
      need: setNeed, cost: setCost };
    for (const [key, setter] of Object.entries(setters)) {
      const v = one(key);
      if (v) setter(v);
    }
    const city = one('city');
    if (city) setPlace(city === 'Міжнародні' ? 'abroad' : city);
    const q = p.get('q');
    if (q) setQuery(q);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      const keep = p.get('for'); // режим пише lib/mode — не затираємо
      const next = new URLSearchParams();
      if (keep === 'teens') next.set('for', 'teens');
      const write = (key, v, def = 'all') => { if (v !== def) next.set(key, v); };
      write('type', type); write('age', age); write('deadline', deadline);
      write('need', need); write('cost', cost);
      if (!(presetCity && place === presetCity)) write('city', place);
      if (query.trim()) next.set('q', query.trim());
      const qs = next.toString();
      window.history.replaceState(null, '',
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }, 250);
    return () => clearTimeout(timer);
  }, [hydrated, type, age, deadline, need, cost, place, query, presetCity]);

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

  const predicates = useMemo(
    () => buildPredicates(
      { type, age, deadline, need, cost, place, query },
      { teens, todayIso, searchIndex },
    ),
    [type, age, deadline, need, cost, place, query, teens, todayIso, searchIndex],
  );

  const hasActive = type !== 'all' || age !== 'all' || deadline !== 'all'
    || need !== 'all' || cost !== 'all' || Boolean(query.trim())
    || (presetCity ? place !== presetCity : place !== 'all');

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
    const places = new Set();
    candidates('place').forEach((item) => {
      (item.cities || []).forEach((c) => { if (!PSEUDO_CITIES.has(c)) places.add(c); });
      if (goesAbroad(item)) places.add('abroad');
      // «Онлайн» — місце, а не тип: у батьківському режимі його дає пігулка,
      // у підлітковому він живе тут.
      if (teens && isOnline(item)) places.add('online');
    });
    return { chips, ages, needs, costs, deadlines, places };
  }, [liveItems, predicates, teens, todayIso]);

  const filtered = useMemo(() => {
    const list = liveItems.filter((item) => FACETS.every((k) => predicates[k](item)));
    // Найближчий дедлайн угорі; без дедлайну — вкінці, свіжіші перші.
    return list.sort((a, b) => {
      const da = daysUntil(a.deadline, todayIso);
      const db = daysUntil(b.deadline, todayIso);
      const ra = da === null || da < 0 ? 9999 : da;
      const rb = db === null || db < 0 ? 9999 : db;
      if (ra !== rb) return ra - rb;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [liveItems, predicates, todayIso]);

  // Топ тижня: три найближчі живі дедлайни. Показується без активних
  // фільтрів і виключається з основної стрічки, щоб не дублювався.
  const topCards = useMemo(() => {
    if (hasActive) return [];
    return liveItems
      .filter((item) => {
        const days = daysUntil(item.deadline, todayIso);
        return days !== null && days >= 0;
      })
      .sort((a, b) => daysUntil(a.deadline, todayIso) - daysUntil(b.deadline, todayIso))
      .slice(0, 3);
  }, [liveItems, hasActive, todayIso]);

  const topIds = useMemo(() => new Set(topCards.map((c) => c.id)), [topCards]);
  const stream = useMemo(
    () => (topCards.length ? filtered.filter((c) => !topIds.has(c.id)) : filtered),
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

  // На телефоні підвантажуємо по 10 (референс 6a): картка-рядок утричі
  // нижча за десктопну. Ефект стоїть після скидання ліміту — спрацьовує
  // останнім.
  useEffect(() => {
    if (mobileLayout && window.matchMedia('(max-width: 900px)').matches) {
      pageSize.current = 10;
      setLimit(10);
    }
  }, [mobileLayout]);

  const reset = () => {
    setType('all'); setAge('all'); setDeadline('all'); setNeed('all');
    setCost('all'); setQuery(''); setLimit(pageSize.current);
    setPlace(presetCity || 'all');
  };

  const enField = (item, field) => (isEn && item[`${field}_en`]) || item[field] || '';

  const dlChip = (item) => {
    const days = daysUntil(item.deadline, todayIso);
    const annual = ANNUAL_TYPES.has(item.opportunity_type);
    if (days === null || days < 0) {
      return { text: annual ? t.annual : t.open, kind: 'calm' };
    }
    if (isEvent(item)) {
      if (days === 0) return { text: `📅 ${t.today}`, kind: 'event' };
      if (days === 1) return { text: `📅 ${t.tomorrow}`, kind: 'event' };
      return { text: `📅 ${t.inDays(days)}`, kind: 'event' };
    }
    if (days === 0) return { text: `⏰ ${t.today}`, kind: 'urgent' };
    if (days <= 7) return { text: `⏰ ${t.daysLeft(days)}`, kind: 'urgent' };
    if (days <= 30) return { text: `⏳ ${t.daysLeft(days)}`, kind: 'soon' };
    return { text: t.until(formatDeadline(item.deadline, lang)), kind: 'calm' };
  };

  const ageText = (item) => (
    Number.isFinite(item.age_from) && Number.isFinite(item.age_to)
      ? t.ageShort(item.age_from, item.age_to) : null
  );

  const placeText = (item) => {
    if (goesAbroad(item)) return t.abroad.replace('🌍 ', '');
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
    const fields = teenReady
      ? [
        [t.f.benefit, item.teen_benefit],
        [t.f.requirement, item.teen_requirement],
        [t.f.deadline, item.deadline ? formatDeadline(item.deadline, lang) : t.noDeadline],
      ]
      : [
        [t.f.format, item.format || null],
        [t.f.place, placeText(item)],
        teens
          ? [t.f.deadline, item.deadline ? formatDeadline(item.deadline, lang) : t.noDeadline]
          : [t.f.source, item.source || null],
      ];

    const age = ageText(item);
    const fmt = mobileLayout
      ? [formatLabel(item.format, lang), placeText(item)].filter(Boolean).join(' · ')
      : '';

    return (
      <article key={item.id} className="v2-card">
        <div className="v2-card-tags">
          <span className="v2-tag" style={{ background: tagBg, color: tagFg }}>{typeLabel}</span>
          <span className="v2-tag" style={{ background: dlBg, color: dlFg }}>{dl.text}</span>
        </div>
        {/* Мобільний рядок (6a): тип → дедлайн → вік. Дедлайн помаранчевий
            лише коли горить (≤7 днів), інакше спокійний сірий. */}
        {mobileLayout ? (
          <div className="v2-card-meta">
            <span className="v2-tag" style={{ background: tagBg, color: tagFg }}>{typeLabel}</span>
            <span className={`v2-card-meta-dl${dl.kind === 'urgent' ? ' is-urgent' : ''}`}>{dl.text}</span>
            {age ? <><span className="v2-card-meta-sep" aria-hidden="true">·</span><span>{age}</span></> : null}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3>
            <Link
              href={`${isEn ? '/en' : ''}/o/${item.slug}`}
              lang={isEn && !item.title_en ? 'uk' : undefined}
            >
              {enField(item, 'title')}
            </Link>
          </h3>
          {enField(item, 'summary') ? (
            <p className="v2-card-summary" lang={isEn && !item.summary_en ? 'uk' : undefined}>
              {enField(item, 'summary')}
            </p>
          ) : null}
        </div>
        {fmt ? <div className="v2-card-fmt">{fmt}</div> : null}
        <dl>
          {fields.filter(([, v]) => v).map(([k, v]) => (
            <FieldRow key={k} k={k} v={v} />
          ))}
        </dl>
        {item.source_url ? (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="v2-card-more"
            onClick={() => trackOpportunityClick(item.title, 'list')}
          >
            {t.details}
          </a>
        ) : null}
      </article>
    );
  };

  // Велика картка горизонтальної стрічки (6a): дедлайн — найбільший текст.
  const renderTopCard = (item) => {
    const [tagBg, tagFg] = TAG_COLORS[item.opportunity_type] || TAG_FALLBACK;
    const typeLabel = (isEn ? TYPE_LABELS_EN : TYPE_LABELS)[item.opportunity_type]
      || item.opportunity_type;
    const age = ageText(item);
    return (
      <article key={item.id} className="m-top-card">
        <div className="m-top-row">
          <span className="v2-tag" style={{ background: tagBg, color: tagFg }}>{typeLabel}</span>
          {age ? <span className="m-top-age">{age}</span> : null}
        </div>
        <span className="m-top-dl">{dlChip(item).text}</span>
        <h3>
          <Link
            href={`${isEn ? '/en' : ''}/o/${item.slug}`}
            lang={isEn && !item.title_en ? 'uk' : undefined}
          >
            {enField(item, 'title')}
          </Link>
        </h3>
        {enField(item, 'summary') ? (
          <p lang={isEn && !item.summary_en ? 'uk' : undefined}>{enField(item, 'summary')}</p>
        ) : null}
      </article>
    );
  };

  const chips = TYPE_CHIPS[teens ? 'teens' : 'parents']
    .filter((c) => available.chips.has(c.value) || type === c.value);

  const optLabel = (o) => (isEn && o[2] ? o[2] : o[1]);
  const selectOpts = (list, availableSet, current) =>
    list.filter(([value]) => availableSet.has(value) || current === value);

  const ageList = AGE_OPTS[teens ? 'teens' : 'parents'];
  const needList = teens ? GIVES_OPTS : NEED_OPTS;
  const placeList = useMemo(() => {
    const cities = [...available.places].filter((p) => p !== 'abroad' && p !== 'online')
      .sort((a, b) => a.localeCompare(b, 'uk'));
    const out = [];
    if (available.places.has('abroad') || place === 'abroad') out.push(['abroad', t.abroad, t.abroad]);
    if (available.places.has('online') || place === 'online') out.push(['online', t.online, t.online]);
    for (const c of cities) out.push([c, c, cityLabel(c, 'en')]);
    return out;
  }, [available.places, place, t.abroad, t.online]);

  const count = stream.length + (hasActive ? 0 : topCards.length);
  const shown = stream.slice(0, limit);

  // Лічильник на кнопці «Фільтри»: лише те, що живе в шторці й не видно в
  // рядку. Тип видно чипом у самому рядку, пошук — у полі.
  const sheetActive = [
    age !== 'all', deadline !== 'all', need !== 'all', cost !== 'all',
    presetCity ? place !== presetCity : place !== 'all',
  ].filter(Boolean).length;

  const closeSheet = () => {
    setDraft(null);
    filtersBtnRef.current?.focus();
  };

  const applyDraft = () => {
    setType(draft.type); setAge(draft.age); setDeadline(draft.deadline);
    setNeed(draft.need); setCost(draft.cost); setPlace(draft.place);
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
    if (body && body.contains(e.target) && body.scrollTop > 0) {
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
    () => (draft ? facetCounts(draft, { teens, todayIso, searchIndex, liveItems, t }) : null),
    // t змінюється лише з мовою, а мова в межах сторінки стала.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, liveItems, teens, todayIso, searchIndex],
  );

  // Бічна панель десктопа (≥1100px) рахує те саме, але на застосованих
  // фільтрах: там кожен клік одразу змінює список.
  const side = useMemo(
    () => (sidebarLayout
      ? facetCounts(
        { type, age, deadline, need, cost, place, query },
        { teens, todayIso, searchIndex, liveItems, t },
      )
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sidebarLayout, type, age, deadline, need, cost, place, query, liveItems, teens, todayIso, searchIndex],
  );

  const sheetGroup = (key, title, allLabel, opts) => {
    const counts = sheet[key];
    const visible = opts.filter(([v]) => counts[v] > 0 || draft[key] === v);
    if (!visible.length) return null;
    const pick = (v) => setDraft({ ...draft, [key]: v });
    return (
      <div className="m-group" role="group" aria-labelledby={`m-group-${key}`} key={key}>
        <h3 id={`m-group-${key}`}>{title}</h3>
        <div className="m-group-chips">
          <button
            type="button"
            className={`m-chip${draft[key] === 'all' ? ' is-on' : ''}`}
            aria-pressed={draft[key] === 'all'}
            onClick={() => pick('all')}
          >
            {allLabel}<span className="m-chip-n">{counts.all}</span>
          </button>
          {visible.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`m-chip${draft[key] === v ? ' is-on' : ''}`}
              aria-pressed={draft[key] === v}
              onClick={() => pick(draft[key] === v ? 'all' : v)}
            >
              {label}<span className="m-chip-n">{counts[v]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Знімні чипи над списком (6b): лише те, що налаштовується в шторці.
  const labelOf = (list, v) => {
    const o = list.find((x) => x[0] === v);
    return o ? optLabel(o) : v;
  };
  const activeChips = [
    age !== 'all' && {
      key: 'age',
      label: teens ? labelOf(ageList, age) : `${labelOf(ageList, age)} ${t.years}`,
      clear: () => setAge('all'),
    },
    deadline !== 'all' && { key: 'deadline', label: labelOf(DEADLINE_OPTS, deadline), clear: () => setDeadline('all') },
    need !== 'all' && { key: 'need', label: labelOf(needList, need), clear: () => setNeed('all') },
    cost !== 'all' && { key: 'cost', label: labelOf(COST_OPTS, cost), clear: () => setCost('all') },
    (presetCity ? place !== presetCity : place !== 'all') && {
      key: 'place',
      label: place === 'abroad' ? t.abroad : place === 'online' ? t.online
        : (isEn ? cityLabel(place, 'en') : place),
      clear: () => setPlace(presetCity || 'all'),
    },
  ].filter(Boolean);

  // Бічна панель десктопа (≥1100px, референс «Dityam — головна з боковими
  // фільтрами»): ті самі фільтри, що в рядку пігулок і селектах, але списками
  // з лічильниками, і клік застосовується одразу. На цій ширині рядок
  // .v2-filters ховає CSS, нижче 1100px — навпаки, ховається панель.
  const sideSetters = { type: setType, age: setAge, deadline: setDeadline, need: setNeed, cost: setCost };
  const sideApplied = { type, age, deadline, need, cost };
  const sideGroup = (key, title, allLabel, opts) => {
    const counts = side[key];
    const cur = sideApplied[key];
    const set = sideSetters[key];
    // Нульові опції ховаємо, як і в шторці: мертвий пункт гірший за відсутній.
    const visible = opts.filter(([v]) => counts[v] > 0 || cur === v);
    if (!visible.length) return null;
    return (
      <div className="v2-side-group" role="group" aria-labelledby={`v2-side-${key}`}>
        <span id={`v2-side-${key}`} className="v2-side-title">{title}</span>
        <div className="v2-side-list">
          <button
            type="button"
            className={`v2-side-item${cur === 'all' ? ' is-on' : ''}`}
            aria-pressed={cur === 'all'}
            onClick={() => set('all')}
          >
            <span>{allLabel}</span>
          </button>
          {visible.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`v2-side-item${cur === v ? ' is-on' : ''}`}
              aria-pressed={cur === v}
              onClick={() => set(cur === v ? 'all' : v)}
            >
              <span>{label}</span>
              <span className="v2-side-n">{counts[v]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderSide = () => (
    <aside className="v2-side" aria-label={t.filters}>
      <label className="v2-side-search">
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Поле вузьке (220px) — довгий десктопний плейсхолдер обрізався б.
          placeholder={teens ? t.sideSearchTeens : t.mSearchParents}
          aria-label={isEn ? 'Search' : 'Пошук'}
        />
      </label>
      {sideGroup('type', t.typeGroup, t.all,
        TYPE_CHIPS[teens ? 'teens' : 'parents'].map((c) => [c.value, isEn ? c.en : c.label]))}
      {sideGroup('age', teens ? t.sel.grade : t.sel.age, t.all,
        ageList.map((o) => [o[0], optLabel(o)]))}
      {sideGroup('deadline', t.sel.deadline, t.all,
        DEADLINE_OPTS.map((o) => [o[0], optLabel(o)]))}
      {sideGroup('need', teens ? t.sel.gives : t.sel.need, teens ? t.all : t.allKids,
        needList.map((o) => [o[0], optLabel(o)]))}
      {/* Вартість і «Де» в референсі немає, але на сайті вони є: без них
          платне не відсіяти (урок #152), а закордон — пріоритет контенту.
          Міст десятки — тому «Де» селектом, а не списком. */}
      {sideGroup('cost', t.sel.cost, t.anyCost,
        COST_OPTS.map((o) => [o[0], optLabel(o)]))}
      {!presetCity && placeList.length ? (
        <div className="v2-side-group">
          <label htmlFor="v2-side-place" className="v2-side-title">{t.sel.where}</label>
          <select
            id="v2-side-place"
            className="v2-select v2-side-select"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          >
            <option value="all">{t.all}</option>
            {placeList.map((o) => (
              <option key={o[0]} value={o[0]}>{isEn ? o[2] : o[1]}</option>
            ))}
          </select>
        </div>
      ) : null}
      {hasActive ? (
        <button type="button" className="v2-side-reset" onClick={reset}>{t.resetFilters}</button>
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

          <div className={`m-bar${compact ? ' is-compact' : ''}`}>
            <div className="m-chips" role="group" aria-label={t.filters} ref={chipsRowRef}>
              <button
                type="button"
                className={`m-chip m-filters-btn${sheetActive ? ' is-on' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                ref={filtersBtnRef}
                onClick={() => setDraft({ type, age, deadline, need, cost, place, query })}
              >
                <span aria-hidden="true">⚙︎</span>
                {t.filters}
                {sheetActive ? <span className="m-count-dot">{sheetActive}</span> : null}
              </button>
              <button
                type="button"
                className={`m-chip${type === 'all' ? ' is-on' : ''}`}
                aria-pressed={type === 'all'}
                onClick={() => setType('all')}
              >
                {t.all}
              </button>
              {chips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`m-chip${type === c.value ? ' is-on' : ''}`}
                  aria-pressed={type === c.value}
                  onClick={() => setType(type === c.value ? 'all' : c.value)}
                >
                  {isEn ? c.en : c.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <section className="v2-filters" aria-label={isEn ? 'Filters' : 'Фільтри'}>
        <div className="v2-chips">
          <button
            type="button"
            className={`v2-chip${type === 'all' ? ' is-on' : ''}`}
            onClick={() => setType('all')}
          >
            {t.all}
          </button>
          {chips.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`v2-chip${type === c.value ? ' is-on' : ''}`}
              onClick={() => setType(type === c.value ? 'all' : c.value)}
            >
              {isEn ? c.en : c.label}
            </button>
          ))}
        </div>

        <div className="v2-selects">
          <Select
            label={teens ? t.sel.grade : t.sel.age}
            allLabel={t.all}
            value={age}
            onChange={setAge}
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
            value={need}
            onChange={setNeed}
            options={selectOpts(needList, available.needs, need).map((o) => [o[0], optLabel(o)])}
          />
          <Select
            label={t.sel.cost}
            allLabel={t.anyCost}
            value={cost}
            onChange={setCost}
            options={selectOpts(COST_OPTS, available.costs, cost).map((o) => [o[0], optLabel(o)])}
          />
          {!presetCity ? (
            <Select
              label={t.sel.where}
              allLabel={t.all}
              value={place}
              onChange={setPlace}
              options={placeList.map((o) => [o[0], isEn ? o[2] : o[1]])}
            />
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
          {hasActive ? (
            <button type="button" className="v2-reset" onClick={reset}>{t.reset}</button>
          ) : null}
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
          {topCards.length === 3 ? (
            <section className="v2-top" aria-label={t.topTitle}>
              <div className="v2-top-head">
                <h2>{t.topTitle}</h2>
              </div>
              <div className="v2-grid">
                {topCards.map(renderCard)}
              </div>
            </section>
          ) : null}

          {mobileLayout && topCards.length === 3 ? (
            <section className="m-top" aria-labelledby="m-top-title">
              <div className="m-top-head">
                {/* «Цього тижня» — лише коли всі три справді закриваються за 7
                    днів; інакше заголовок обіцяв би те, чого в стрічці немає. */}
                <h2 id="m-top-title">
                  {topCards.every((c) => daysUntil(c.deadline, todayIso) <= 7) ? t.mTopWeek : t.mTopSoon}
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
              <span><strong>{count}</strong> {t.countWord(count)}</span>
              <span className="m-count-hint">{t.sortHint}</span>
            </div>
          ) : null}

          {sidebarLayout ? (
            <div className="v2-side-count" aria-live="polite">
              <span><strong>{count}</strong> {t.countWord(count)}</span>
              <span className="v2-side-count-hint">{t.sortLong}</span>
            </div>
          ) : null}

          {shown.length ? (
            <section className={`v2-grid${mobileLayout ? ' v2-list' : ''}`}>
              {shown.map(renderCard)}
            </section>
          ) : (
            <div className="v2-empty">
              <span style={{ fontSize: 32 }} aria-hidden="true">🔍</span>
              <h3>{t.nothingTitle}</h3>
              <p>{t.nothingText}</p>
            </div>
          )}

          {stream.length > limit ? (
            <div className="v2-more-row">
              <button type="button" className="v2-more-btn" onClick={() => setLimit(limit + pageSize.current)}>
                {t.showMore}
              </button>
            </div>
          ) : null}
        </Wrap>
      </Wrap>

      {promoProps ? <PlusSection {...promoProps} lang={lang} /> : null}

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
                    type: 'all', age: 'all', deadline: 'all', need: 'all', cost: 'all',
                    place: presetCity || 'all', query: draft.query,
                  })}
                >
                  {t.resetAll}
                </button>
              </div>
            </div>

            <div className="m-sheet-body" ref={sheetBodyRef}>
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
              {!presetCity ? sheetGroup('place', t.sel.where, t.all,
                sheet.placeOpts.map((o) => [o[0], isEn ? o[2] : o[1]])) : null}
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
