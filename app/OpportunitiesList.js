'use client';
import { Fragment, useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import PlusSection from './PlusSection';
import SuggestBlock from './SuggestBlock';
import { THEME_OPTIONS, matchThemes } from '@/lib/themes';
import {
  TYPE_LABELS, TYPE_LABELS_EN, AID_TYPE_LABELS, AID_TYPE_LABELS_EN,
  NEED_LABELS_EN, ANNUAL_TYPES, isEvent, dateLabel, dateLabelEn, formatLabel,
  cityLabel,
} from '@/lib/labels';
import { opportunitiesWord } from '@/lib/plural';
import { trackOpportunityClick } from '@/lib/track';

// Увесь текст каталогу двома мовами. Той самий компонент обслуговує / і /en:
// копія на кожну мову розійшлася б із оригіналом за місяць, як уже сталося з
// підписами підбірок у футері.
const UI = {
  uk: {
    filtersHint: 'Оберіть вік, тему й місто — покажемо лише те, що підходить вашій дитині',
    reset: 'Скинути',
    found: 'Знайдено',
    sort: 'Сортувати',
    nothingTitle: 'Нічого не знайдено',
    nothingText: 'Спробуйте послабити критерії пошуку або скинути фільтри.',
    showMore: 'Показати ще',
    shown: 'Показано',
    of: 'з',
    details: 'Детальніше ↗',
    format: 'Формат',
    city: 'Місто',
    source: 'Джерело',
    stateAid: 'держдопомога',
    free: 'безкоштовно',
    funded: 'з фінансуванням',
    affordable: 'доступно',
    annual: '🔄 щорічно',
    annualPast: '🔄 відкривається щороку',
    today: 'сьогодні',
    tomorrow: 'завтра',
    inDays: (n) => `через ${n} дн.`,
    daysLeft: (n) => `${n} ${n === 1 ? 'день' : 'днів'}`,
    age: (from, to) => (from === to ? `${from} років`
      : from === 0 && to >= 17 ? '0-18 років' : `${from}-${to} років`),
    groups: { age: 'Вік', type: 'Тип', aid: 'Вид допомоги', theme: 'Тема',
      deadline: 'Дедлайн', need: 'Особлива потреба', cost: 'Вартість', city: 'Місто' },
  },
  en: {
    filtersHint: 'Pick an age, a topic and a city — we’ll show only what fits your child',
    reset: 'Reset',
    found: 'Found',
    sort: 'Sort',
    nothingTitle: 'Nothing found',
    nothingText: 'Try relaxing the filters or resetting them.',
    showMore: 'Show',
    shown: 'Showing',
    of: 'of',
    details: 'Details ↗',
    format: 'Format',
    city: 'City',
    source: 'Source',
    stateAid: 'state aid',
    free: 'free',
    funded: 'funded',
    affordable: 'affordable',
    annual: '🔄 every year',
    annualPast: '🔄 opens every year',
    today: 'today',
    tomorrow: 'tomorrow',
    inDays: (n) => `in ${n} days`,
    daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
    age: (from, to) => (from === to ? `age ${from}`
      : from === 0 && to >= 17 ? '0–18 yrs' : `${from}–${to} yrs`),
    groups: { age: 'Age', type: 'Type', aid: 'Aid type', theme: 'Topic',
      deadline: 'Deadline', need: 'Special need', cost: 'Cost', city: 'City' },
  },
};

// Англійська дата: місяць словом, як і в українській версії, але без відмінків.
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const NEED_LABELS = {
  gifted: 'обдаровані',
  disability: 'інвалідність',
  autism: 'РАС',
  idp: 'ВПО',
  veteran_family: 'діти ветеранів і загиблих',
  de_occupied: 'з деокупованих',
  frontline: 'з прифронтових',
  oncology: 'онкохворі',
  rare_disease: 'рідкісні хвороби',
  low_income: 'малозабезпечені',
  orphan: 'сироти',
  large_family: 'багатодітні',
  rural: 'сільська місцевість',
};

const AGE_GROUPS = [
  { label: 'Усі', en: 'All', value: 'all' },
  { label: '0-3', value: '0-3' },
  { label: '4-6', value: '4-6' },
  { label: '7-11', value: '7-11' },
  { label: '12-14', value: '12-14' },
  { label: '15-17', value: '15-17' },
];

const TYPE_OPTIONS = [
  { label: 'Усі', en: 'All', value: 'all' },
  // «Онлайн» — це формат участі, а не тема, тож живе тут, серед типів, і
  // стоїть першим: дистанційна участь знімає питання міста, тому це найчастіший
  // фільтр для родин поза великими містами й за кордоном.
  { label: '💻 Онлайн', en: '💻 Online', value: 'online', highlight: true },
  { label: 'Курси', en: 'Courses', value: 'course' },
  { label: 'Конкурси', en: 'Competitions', value: 'competition' },
  { label: 'Олімпіади', en: 'Olympiads', value: 'olympiad' },
  { label: 'Обміни', en: 'Exchanges', value: 'exchange' },
  { label: 'Табори', en: 'Camps', value: 'camp' },
  { label: 'Стипендії', en: 'Scholarships', value: 'scholarship' },
  { label: 'Держдопомога', en: 'State aid', value: 'gov_aid' },
  { label: 'Гранти', en: 'Grants', value: 'grant' },
  { label: 'Мед. допомога', en: 'Medical aid', value: 'medical_aid' },
  { label: 'Фестивалі', en: 'Festivals', value: 'festival' },
  { label: 'Гуртки', en: 'Clubs', value: 'club' },
];

// Дистанційна участь. Ознаку беремо з трьох місць, бо джерела пишуть формат
// по-різному: поле format («Онлайн», «Гібрид», «online»), місто «Онлайн» у
// cities і згадка в назві/описі, коли формат узагалі не заповнений.
const ONLINE_RE = /(онлайн|online|дистанц|гібрид|hybrid|zoom|вебінар)/i;
const isOnline = (item) =>
  ONLINE_RE.test(item.format || '')
  || (item.cities || []).some((c) => ONLINE_RE.test(c))
  || ONLINE_RE.test(`${item.title || ''} ${item.summary || ''}`);

// Subcategories of state aid (держдопомога). Rendered as a nested sub-filter
// only when the "Держдопомога" type is active. Values match opportunities.aid_type.
const AID_TYPE_OPTIONS = [
  { label: 'Грошові виплати', en: 'Cash payments', value: 'cash' },
  { label: 'Соц. стипендії', en: 'Social scholarships', value: 'scholarship' },
  { label: 'Оздоровлення', en: 'Recreation', value: 'recreation' },
  { label: 'Безкоштовні секції', en: 'Free activities', value: 'free_activities' },
  { label: 'Проф. навчання', en: 'Vocational training', value: 'vocational' },
];


const NEED_OPTIONS = [
  { label: 'Усі діти', en: 'All children', value: 'all' },
  { label: 'ВПО', en: 'Displaced', value: 'idp' },
  { label: 'Інвалідність', en: 'Disability', value: 'disability' },
  { label: 'Обдаровані', en: 'Gifted', value: 'gifted' },
  { label: 'Онкохворі', en: 'Cancer patients', value: 'oncology' },
  { label: 'Діти ветеранів і загиблих захисників', en: 'Veterans’ and fallen soldiers’ children', value: 'veteran_family' },
  { label: 'Малозабезпечені', en: 'Low income', value: 'low_income' },
  { label: 'Сироти', en: 'Orphans', value: 'orphan' },
];

const COST_OPTIONS = [
  { label: 'Будь-яка', en: 'Any', value: 'all' },
  { label: 'Безкоштовно', en: 'Free', value: 'free' },
  { label: 'З фінансуванням', en: 'Funded', value: 'partially_free' },
];

const DEADLINE_OPTIONS = [
  { label: 'Усі', en: 'All', value: 'all' },
  { label: 'Цього тижня', en: 'This week', value: 'week' },
  { label: 'Цього місяця', en: 'This month', value: 'month' },
  { label: 'Найближчі 3 місяці', en: 'Next 3 months', value: 'quarter' },
  { label: 'Без дедлайну (постійні)', en: 'No deadline (ongoing)', value: 'none' },
];

// Cards rendered per batch. Filtering stays client-side (the chips, the city list
// and the result count all need the full set), so this caps the DOM, not the fetch.
//
// Автопідвантаження прибрано (25.08.2026): партії доїжджали самі, поки людина
// гортала, і футер відсувався швидше, ніж до нього доскролювали. Тепер рівно
// одна партія, далі — кнопка, і одразу за нею футер.
const PAGE_SIZE = 30;

// Обидва вставні блоки позиціонуються в КЛІТИНКАХ сітки, а не в картках:
// повноширинний блок Dityam+ має падати рівно на межу рядка (кратність трьом
// на десктопі), інакше сітка лишає перед ним порожні клітинки, а картка
// «Маєте можливість» сама займає клітинку і зсуває все після себе.
//
// Розклад: клітинка 6 — «Маєте можливість» (шоста, як просила Мария),
// після клітинок 9, 18, 27… — Dityam+ (межі рядків, кожні три ряди),
// далі «Маєте можливість» повторюється кожні 30 клітинок (36, 66, 96) —
// там, де вона збігається з кроком Dityam+, той раунд Dityam+ пропускаємо.
const SUGGEST_FIRST = 6;
const SUGGEST_EVERY = 30;
const suggestTakesCell = (n) =>
  n === SUGGEST_FIRST ||
  (n > SUGGEST_FIRST && (n - SUGGEST_FIRST) % SUGGEST_EVERY === 0);

// Крок Dityam+ — приблизно кожні дев'ять клітинок, але сам блок вставляємо
// лише на межі ряду: він на всю ширину, тож посеред ряду лишив би порожні
// клітинки праворуч від останньої картки.
const PROMO_EVERY_CELLS = 9;

// Розкладає картки по клітинках сітки разом із вставними блоками.
// cells — послідовність того, що малюємо; fullRowCells/fullRowCards — остання
// точка, де ряд закінчився рівно (по ній підрізаємо обірваний хвіст).
function planCells(cardCount, cols, withPromo) {
  const cells = [];
  let cellNo = 0;        // клітинки-картки; промо на всю ширину сюди не рахуємо
  let sinceRowStart = 0; // клітинок від початку поточного ряду
  let sincePromo = 0;    // клітинок від останнього Dityam+
  let promoIdx = 0;
  let fullRowCells = 0;
  let fullRowCards = 0;
  for (let i = 0; i < cardCount; i += 1) {
    cells.push({ t: 'card', i });
    cellNo += 1;
    sinceRowStart += 1;
    sincePromo += 1;
    let justSuggested = false;
    if (suggestTakesCell(cellNo + 1)) {
      cells.push({ t: 'suggest' });
      cellNo += 1;
      sinceRowStart += 1;
      sincePromo += 1;
      justSuggested = true;
    }
    const rowClosed = sinceRowStart % cols === 0;
    const lastShort = cardCount < SUGGEST_FIRST - 1 && i === cardCount - 1;
    // justSuggested: коли крок Dityam+ збігається з щойно вставленою карткою
    // пропозиції (клітинка 36), раунд пропускаємо — два банери поспіль
    // читаються як суцільна реклама.
    if (withPromo && !justSuggested && ((sincePromo >= PROMO_EVERY_CELLS && rowClosed) || lastShort)) {
      cells.push({ t: 'promo', idx: promoIdx });
      promoIdx += 1;
      sinceRowStart = 0;
      sincePromo = 0;
    }
    if (sinceRowStart % cols === 0) {
      fullRowCells = cells.length;
      fullRowCards = i + 1;
    }
  }
  return { cells, fullRowCells, fullRowCards };
}

// Скільки колонок малює сітка — видно лише з готового layout, а він є тільки
// в браузері. На сервері useLayoutEffect не виконується й React лається, тож
// там підміняємо його на useEffect.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Поки заміру немає (серверна розмітка й перший рендер), розкладаємо як на
// десктопі — три колонки: так було до цієї зміни, і гідрація не розходиться.
const ASSUMED_COLS = 3;

const SORT_OPTIONS = [
  { label: 'За віком дитини', en: 'By age', value: 'age' },
  { label: 'Найближчий дедлайн', en: 'Deadline soonest', value: 'deadline' },
  { label: 'Назва А-Я', en: 'Title A–Z', value: 'title' },
  { label: 'Нещодавно додані', en: 'Recently added', value: 'recent' },
];

function formatDeadline(dateStr, lang = 'uk') {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = lang === 'en' ? MONTHS_EN
    : ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function daysUntilDeadline(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function deadlineMatches(item, value) {
  const days = daysUntilDeadline(item.deadline);
  if (value === 'none') return days === null;
  if (value === 'week') return days !== null && days >= 0 && days <= 7;
  if (value === 'month') return days !== null && days >= 0 && days <= 31;
  if (value === 'quarter') return days !== null && days >= 0 && days <= 92;
  return false;
}

function ageMatches(item, value) {
  const [f, t] = value.split('-').map(Number);
  return item.age_from <= t && item.age_to >= f;
}


// Одна випадайка фільтра. Панель — той самий набір чипів, що був раніше:
// множинний вибір, «Усі» для скидання секції, приховані порожні опції.
// Змінюється лише подача — дев'ять рядків згорнулись у рядок кнопок.
function FilterButton({ id, label, options, selected, openId, setOpenId }) {
  if (!options.length) return null;
  const isOpen = openId === id;
  const count = selected.size;
  return (
    <button
      type="button"
      id={`fm-btn-${id}`}
      className={`fm-btn ${count ? 'has' : ''} ${isOpen ? 'open' : ''}`}
      aria-expanded={isOpen}
      aria-controls="fm-panel"
      onClick={() => setOpenId(isOpen ? null : id)}
    >
      {label}
      {count > 0 && <span className="fm-count">{count}</span>}
      <span className="fm-caret" aria-hidden="true" />
    </button>
  );
}

// Розкривається під рядком кнопок, а не з-під кожної окремо: панель на всю
// ширину не вилазить за край екрана на телефоні й не перекриває картки.
function FilterPanel({ menu, lang }) {
  if (!menu) return null;
  const { label, options, selected, onToggle } = menu;
  return (
    <div className="fm-panel" id="fm-panel" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === 'all' ? selected.size === 0 : selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={`filter-btn ${on ? 'active' : ''} ${o.highlight ? 'filter-btn-hl' : ''}`}
            onClick={() => onToggle(o.value)}
          >
            {o.en && lang === 'en' ? o.en : o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function OpportunitiesList({ opportunities, presetCity, promoProps = null, lang = 'uk' }) {
  const t = UI[lang] || UI.uk;
  const isEn = lang === 'en';
  const [ages, setAges] = useState(() => new Set());
  const [types, setTypes] = useState(() => new Set());
  const [aidTypes, setAidTypes] = useState(() => new Set());
  const [themes, setThemes] = useState(() => new Set());
  const [needs, setNeeds] = useState(() => new Set());
  const [costs, setCosts] = useState(() => new Set());
  const [deadlines, setDeadlines] = useState(() => new Set());
  const [selectedCities, setSelectedCities] = useState(() =>
    presetCity ? new Set([presetCity]) : new Set()
  );
  const [query, setQuery] = useState('');
  // Одночасно відкрита лише одна випадайка — інакше вони перекривають одна одну.
  const [openId, setOpenId] = useState(null);
  const [sort, setSort] = useState('age');
  // Guards the URL-writing effect below: until the initial read has run, writing
  // would wipe the very query string we're about to parse.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const readSet = (key, setter) => {
      const raw = p.get(key);
      if (raw) setter(new Set(raw.split(',').filter(Boolean)));
    };
    readSet('age', setAges);
    readSet('type', setTypes);
    readSet('aid', setAidTypes);
    readSet('theme', setThemes);
    // Старі посилання з ?theme=online (до переїзду «Онлайн» у фільтр «Тип»)
    // мають і далі показувати онлайн-можливості, а не порожню видачу.
    if ((p.get('theme') || '').split(',').includes('online')) {
      setThemes((prev) => {
        const next = new Set(prev);
        next.delete('online');
        return next;
      });
      setTypes((prev) => new Set([...prev, 'online']));
    }
    readSet('need', setNeeds);
    readSet('cost', setCosts);
    readSet('deadline', setDeadlines);
    readSet('city', setSelectedCities);
    const q = p.get('q');
    if (q) setQuery(q);
    const sortVal = p.get('sort');
    if (sortVal && SORT_OPTIONS.some((o) => o.value === sortVal)) setSort(sortVal);
    setHydrated(true);
  }, []);

  // Mirror filter state back into the URL so a filtered view can be bookmarked,
  // shared and restored. replaceState — not push — because every chip tap would
  // otherwise pile up in the back stack and make ← unusable.
  useEffect(() => {
    if (!hydrated) return;
    // Debounced so typing in the search box doesn't rewrite the URL per keystroke.
    const timer = setTimeout(() => {
      const p = new URLSearchParams();
      const writeSet = (key, set) => {
        if (set.size > 0) p.set(key, [...set].join(','));
      };
      writeSet('age', ages);
      writeSet('type', types);
      writeSet('aid', aidTypes);
      writeSet('theme', themes);
      writeSet('need', needs);
      writeSet('cost', costs);
      writeSet('deadline', deadlines);
      // On a city landing page (/kyiv) the preset is already in the path —
      // repeating it as ?city= would be noise. Any wider selection still gets written.
      const presetOnly =
        presetCity && selectedCities.size === 1 && selectedCities.has(presetCity);
      if (!presetOnly) writeSet('city', selectedCities);
      if (query.trim()) p.set('q', query.trim());
      if (sort !== 'age') p.set('sort', sort);

      const qs = p.toString();
      window.history.replaceState(
        null,
        '',
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [
    hydrated, ages, types, aidTypes, themes, needs, costs, deadlines,
    selectedCities, query, sort, presetCity,
  ]);

  // Theme tags per opportunity, derived from title+summary keywords (lib/themes).
  const themeMap = useMemo(() => {
    const m = new Map();
    opportunities.forEach((o) => {
      m.set(o.id, new Set(matchThemes(`${o.title || ''} ${o.summary || ''}`)));
    });
    return m;
  }, [opportunities]);

  const sortCities = (list) => [...list].sort((a, b) => {
    if (a === 'Онлайн') return -1;
    if (b === 'Онлайн') return 1;
    if (a === 'Вся Україна') return -1;
    if (b === 'Вся Україна') return 1;
    if (a === 'Міжнародні') return 1;
    if (b === 'Міжнародні') return -1;
    return a.localeCompare(b, 'uk');
  });

  const toggle = (setter) => (value) => {
    if (value === 'all') {
      setter(new Set());
      return;
    }
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handlers = {
    age: toggle(setAges),
    // Deselecting the "Держдопомога" umbrella (or resetting to "Усі") also
    // clears any state-aid subcategory selection so it can't linger hidden.
    type: (value) => {
      toggle(setTypes)(value);
      if (value === 'gov_aid' || value === 'all') setAidTypes(new Set());
    },
    aid: toggle(setAidTypes),
    theme: toggle(setThemes),
    need: toggle(setNeeds),
    cost: toggle(setCosts),
    deadline: toggle(setDeadlines),
    city: toggle(setSelectedCities),
  };

  const isActive = (set, value) => (value === 'all' ? set.size === 0 : set.has(value));

  // Клік поза панеллю і Escape закривають випадайку — без цього вона лишалась
  // би відкритою, поки не клікнеш саме по кнопці.
  useEffect(() => {
    if (openId === null) return;
    // Кліки по самій панелі не закривають її: вибір фільтрів множинний,
    // і закриття після кожної позначки зробило б добір неможливим.
    const onDown = (e) => {
      if (!e.target.closest('.fm-btn, .fm-panel')) setOpenId(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  const activeCount =
    ages.size + types.size + aidTypes.size + themes.size + needs.size +
    costs.size + deadlines.size + selectedCities.size + (query.trim() ? 1 : 0);

  // Сортування свідомо НЕ чіпаємо: це не фільтр, і скидати спосіб перегляду
  // разом із вибором — несподіванка для людини.
  const resetAll = () => {
    setAges(new Set());
    setTypes(new Set());
    setAidTypes(new Set());
    setThemes(new Set());
    setNeeds(new Set());
    setCosts(new Set());
    setDeadlines(new Set());
    setSelectedCities(presetCity ? new Set([presetCity]) : new Set());
    setQuery('');
  };

  // Прострочені разові можливості не показуємо ніде — ні в списку, ні при
  // підрахунку доступних опцій фільтрів.
  const liveItems = useMemo(() => opportunities.filter((item) => {
    const days = daysUntilDeadline(item.deadline);
    return !(days !== null && days < 0 && !ANNUAL_TYPES.has(item.opportunity_type));
  }), [opportunities]);

  // Один предикат на секцію фільтрів. Це єдине джерело правди: за ними і
  // фільтрується список, і рахується, які опції взагалі мають сенс показувати.
  // Тримати дві копії цієї логіки означало б, що вони рано чи пізно розійдуться.
  const predicates = useMemo(() => ({
    age: (item) => ages.size === 0 || [...ages].some((v) => ageMatches(item, v)),
    // "gov_aid" — парасолька: підходить будь-яка можливість із aid_type,
    // незалежно від її opportunity_type (виплата, табір, гурток…).
    type: (item) => types.size === 0
      || types.has(item.opportunity_type)
      || (types.has('gov_aid') && Boolean(item.aid_type))
      || (types.has('online') && isOnline(item)),
    aid: (item) => aidTypes.size === 0 || aidTypes.has(item.aid_type),
    theme: (item) => {
      if (themes.size === 0) return true;
      const itemThemes = themeMap.get(item.id);
      return Boolean(itemThemes) && [...themes].some((t) => itemThemes.has(t));
    },
    need: (item) => needs.size === 0
      || (item.child_needs || []).some((n) => needs.has(n)),
    cost: (item) => costs.size === 0 || costs.has(item.cost_type),
    deadline: (item) => deadlines.size === 0
      || [...deadlines].some((v) => deadlineMatches(item, v)),
    city: (item) => {
      if (selectedCities.size === 0) return true;
      const itemCities = item.cities || [];
      if (itemCities.some((c) => selectedCities.has(c))) return true;
      // «Вся Україна» просвічує крізь фільтр за конкретним містом (Київ,
      // Харків…), але НЕ крізь Онлайн / Міжнародні / Вся Україна.
      if (!itemCities.includes('Вся Україна')) return false;
      const VIRTUAL = new Set(['Онлайн', 'Міжнародні', 'Вся Україна']);
      return [...selectedCities].some((c) => !VIRTUAL.has(c));
    },
    // Шукаємо і в оригіналі, і в перекладі одночасно, незалежно від мови
    // сторінки: на англійській людина введе «camp», а на українській хтось
    // вставить назву з англійського листа — обидва запити мають знаходити.
    query: (item) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return [item.title, item.summary, item.source, item.title_en, item.summary_en]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    },
  }), [ages, types, aidTypes, themes, needs, costs, deadlines, selectedCities, query, themeMap]);

  const FACETS = ['age', 'type', 'aid', 'theme', 'need', 'cost', 'deadline', 'city', 'query'];

  const filtered = useMemo(() => {
    let result = liveItems.filter((item) => FACETS.every((k) => predicates[k](item)));

    // Lower rank = higher priority. Urgent deadlines bubble to the very top.
    const deadlineRank = (item) => {
      const days = daysUntilDeadline(item.deadline);
      if (days === null) return 4;
      if (days < 0) return 4;
      if (days <= 7) return 0;
      if (days <= 30) return 1;
      if (days <= 92) return 2;
      return 3;
    };

    if (sort === 'deadline') {
      result.sort((a, b) => {
        const aDays = daysUntilDeadline(a.deadline);
        const bDays = daysUntilDeadline(b.deadline);
        if (aDays === null && bDays === null) return 0;
        if (aDays === null) return 1;
        if (bDays === null) return -1;
        if (aDays < 0 && bDays < 0) return 0;
        if (aDays < 0) return 1;
        if (bDays < 0) return -1;
        return aDays - bDays;
      });
    } else {
      let secondary;
      if (sort === 'age') secondary = (a, b) => a.age_from - b.age_from;
      else if (sort === 'title') {
        const name = (o) => (isEn && o.title_en) || o.title || '';
        secondary = (a, b) => name(a).localeCompare(name(b), isEn ? 'en' : 'uk');
      }
      else if (sort === 'recent') secondary = (a, b) => (b.created_at || '').localeCompare(a.created_at || '');
      else secondary = () => 0;

      result.sort((a, b) => {
        const rank = deadlineRank(a) - deadlineRank(b);
        if (rank !== 0) return rank;
        return secondary(a, b);
      });
    }

    return result;
  }, [liveItems, predicates, sort]);

  // Доступні опції кожної секції: рахуємо на тому, що проходить УСІ ІНШІ
  // фільтри. Саму секцію виключаємо — інакше вибір у ній схлопнув би її власний
  // список до однієї обраної опції.
  //
  // Навіщо: у 3 роки стипендій не буває, і показувати «Стипендії» дитині цього
  // віку — обіцяти порожній екран. Мертвий фільтр гірший за відсутній.
  const available = useMemo(() => {
    const candidates = (skip) =>
      liveItems.filter((item) => FACETS.every((k) => k === skip || predicates[k](item)));

    const set = (skip, extract) => {
      const out = new Set();
      candidates(skip).forEach((item) => extract(item, out));
      return out;
    };

    return {
      age: (() => {
        const items = candidates('age');
        return new Set(AGE_GROUPS
          .filter((g) => g.value !== 'all' && items.some((i) => ageMatches(i, g.value)))
          .map((g) => g.value));
      })(),
      type: set('type', (i, out) => {
        out.add(i.opportunity_type);
        if (i.aid_type) out.add('gov_aid');
        if (isOnline(i)) out.add('online');
      }),
      aid: set('aid', (i, out) => { if (i.aid_type) out.add(i.aid_type); }),
      theme: set('theme', (i, out) => (themeMap.get(i.id) || []).forEach((t) => out.add(t))),
      need: set('need', (i, out) => (i.child_needs || []).forEach((n) => out.add(n))),
      cost: set('cost', (i, out) => { if (i.cost_type) out.add(i.cost_type); }),
      deadline: (() => {
        const items = candidates('deadline');
        return new Set(DEADLINE_OPTIONS
          .filter((d) => d.value !== 'all' && items.some((i) => deadlineMatches(i, d.value)))
          .map((d) => d.value));
      })(),
      city: set('city', (i, out) => (i.cities || []).forEach((c) => out.add(c))),
    };
  }, [liveItems, predicates, themeMap]);

  // Обрану опцію показуємо завжди, навіть якщо вона стала порожньою — інакше
  // її не було б чим зняти, і людина застрягла б у нульовій видачі.
  const isOfferable = (facet, value, selected) =>
    value === 'all' || selected.has(value) || available[facet].has(value);

  // Один опис на фільтр — з нього будуються і кнопки рядка, і вміст розкривної
  // панелі, і чипи обраного. Раніше кожен фільтр був окремим блоком розмітки,
  // і будь-яка зміна доводилось повторювати тричі.
  const menus = useMemo(() => {
    const list = [
      { id: 'age', label: t.groups.age, all: AGE_GROUPS, selected: ages, onToggle: handlers.age },
      { id: 'type', label: t.groups.type, all: TYPE_OPTIONS, selected: types, onToggle: handlers.type },
      // Підтипи держдопомоги мають сенс лише всередині «Держдопомоги».
      ...(types.has('gov_aid')
        ? [{ id: 'aid', label: t.groups.aid, all: AID_TYPE_OPTIONS, selected: aidTypes, onToggle: handlers.aid }]
        : []),
      { id: 'theme', label: t.groups.theme, all: THEME_OPTIONS, selected: themes, onToggle: handlers.theme },
      { id: 'deadline', label: t.groups.deadline, all: DEADLINE_OPTIONS, selected: deadlines, onToggle: handlers.deadline },
      { id: 'need', label: t.groups.need, all: NEED_OPTIONS, selected: needs, onToggle: handlers.need },
      { id: 'cost', label: t.groups.cost, all: COST_OPTIONS, selected: costs, onToggle: handlers.cost },
      {
        id: 'city',
        label: t.groups.city,
        all: sortCities([...new Set([...available.city, ...selectedCities])])
          .map((c) => ({ label: cityLabel(c, lang), value: c })),
        selected: selectedCities,
        onToggle: handlers.city,
      },
    ];
    return list.map((m) => ({
      ...m,
      options: m.all.filter((o) => isOfferable(m.id, o.value, m.selected)),
    }));
  }, [ages, types, aidTypes, themes, deadlines, needs, costs, selectedCities, available]);

  const openMenu = menus.find((m) => m.id === openId && m.options.length) || null;

  // Обране лишається на видноті зі згорнутими випадайками — і знімається
  // одним кліком по чипу.
  const activeChips = useMemo(() => menus.flatMap((m) => [...m.selected]
    .map((value) => {
      const opt = m.all.find((o) => o.value === value);
      return {
        facet: m.id,
        value,
        label: opt ? opt.label : value,
        onRemove: () => m.onToggle(value),
      };
    })), [menus]);

  // Any change to the filtered set puts the user back at the top of a fresh batch —
  // keeping a large `visible` across filter changes would dump hundreds of cards at once.
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filtered]);

  // Ширину колонок задає auto-fill, тож їхню кількість знає лише браузер:
  // читаємо її з порахованих треків сітки й перечитуємо, коли міняється ширина.
  const gridRef = useRef(null);
  const [cols, setCols] = useState(0); // 0 — ще не виміряно
  const hasGrid = filtered.length > 0;
  useIsoLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return undefined;
    const measure = () => {
      // У порахованому вигляді це список ширин («340px 340px 340px»).
      // Якщо сітка ще не розкладена (наприклад, прихована), браузер віддасть
      // вихідне repeat(auto-fill, …) — тоді заміру просто немає.
      const parts = (getComputedStyle(el).gridTemplateColumns || '').split(' ').filter(Boolean);
      const n = parts.length && parts.every((t) => t.endsWith('px')) ? parts.length : 0;
      if (n > 0) setCols((prev) => (prev === n ? prev : n));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasGrid]);

  const ageLabel = (item) => t.age(item.age_from, item.age_to);

  // Англійський текст із бази, з відкатом на оригінал. Переклад доїжджає
  // партіями, тож у будь-який момент частина записів ще без нього — і
  // українська назва тут краща за порожню картку.
  const enField = (item, field) =>
    (isEn && item[`${field}_en`]) || item[field] || '';

  const handleLinkClick = (title) => trackOpportunityClick(title, 'list');

  const deadlineChip = (item) => {
    const days = daysUntilDeadline(item.deadline);
    const annual = ANNUAL_TYPES.has(item.opportunity_type);
    if (days === null) {
      return annual ? <span className="chip chip-annual">{t.annual}</span> : null;
    }
    if (days < 0) {
      return annual ? <span className="chip chip-annual">{t.annualPast}</span> : null;
    }
    // Для події лічильник означає інше: не «лишилось стільки на подачу», а
    // «відбудеться через стільки». «⏰ 3 днів» на фестивалі читається як
    // пекучий дедлайн, хоча подавати нікуди не треба.
    if (isEvent(item)) {
      if (days === 0) return <span className="chip chip-event">📅 {t.today}</span>;
      if (days === 1) return <span className="chip chip-event">📅 {t.tomorrow}</span>;
      if (days <= 30) return <span className="chip chip-event">📅 {t.inDays(days)}</span>;
      return null;
    }
    if (days === 0) return <span className="chip chip-deadline-urgent">⏰ {t.today}</span>;
    if (days <= 7) return <span className="chip chip-deadline-urgent">⏰ {t.daysLeft(days)}</span>;
    if (days <= 30) return <span className="chip chip-deadline-soon">⏳ {t.daysLeft(days)}</span>;
    return null;
  };

  const renderCard = (item) => (
    <article key={item.id} className="card">
      <div className="chips">
        <span className="chip chip-type">
          {(isEn ? TYPE_LABELS_EN : TYPE_LABELS)[item.opportunity_type] || item.opportunity_type}
        </span>
        {item.aid_type ? (
          <span className="chip chip-aid">
            🏛 {(isEn ? AID_TYPE_LABELS_EN : AID_TYPE_LABELS)[item.aid_type] || t.stateAid}
          </span>
        ) : null}
        <span className="chip chip-age">{ageLabel(item)}</span>
        {item.cost_type === 'free' ? <span className="chip chip-free">{t.free}</span> : null}
        {item.cost_type === 'partially_free' ? <span className="chip chip-paid">{t.funded}</span> : null}
        {item.cost_type === 'paid_affordable' ? <span className="chip chip-paid">{t.affordable}</span> : null}
        {deadlineChip(item)}
        {(item.child_needs || []).filter((n) => NEED_LABELS[n]).slice(0, 2).map((n) => (
          <span key={n} className="chip chip-need">
            {(isEn ? NEED_LABELS_EN : NEED_LABELS)[n]}
          </span>
        ))}
      </div>

      {/* Англійське поле з бази, з відкатом на оригінал: доки перекладач не
          дійшов до запису, краще показати українську назву, ніж порожнечу.
          lang на елементі — щоб екранний читач не читав українську з
          англійською вимовою. */}
      <h3>
        <Link href={`${isEn ? '/en' : ''}/o/${item.slug}`} className="card-title-link" lang={isEn && !item.title_en ? 'uk' : undefined}>
          {enField(item, 'title')}
        </Link>
      </h3>
      {enField(item, 'summary') ? (
        <p className="card-summary" lang={isEn && !item.summary_en ? 'uk' : undefined}>
          {enField(item, 'summary')}
        </p>
      ) : null}

      <div className="meta">
        {formatLabel(item.format) ? (
          <div className="meta-row">
            <span className="meta-label">{t.format}</span>
            <span className="meta-val">{formatLabel(item.format)}</span>
          </div>
        ) : null}
        {/* Місто — перше, що питає людина про подію: «а це де?». Досі картка
            цього не показувала взагалі, і «Місце Сили» виглядало як подія
            невідомо де. */}
        {(item.cities || []).length ? (
          <div className="meta-row">
            <span className="meta-label">{t.city}</span>
            <span className="meta-val">{item.cities.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ')}</span>
          </div>
        ) : null}
        {item.deadline ? (
          <div className="meta-row">
            {/* Підпис і логіка — з lib/labels, спільні з ботом. Інакше бот
                пише «Коли», а картка поруч «Дедлайн» про ту саму подію. */}
            <span className="meta-label">{(isEn ? dateLabelEn : dateLabel)(item)}</span>
            <span className="meta-val">
              {isEvent(item) && item.event_end_date
                && item.event_end_date !== item.deadline
                ? `${formatDeadline(item.deadline, lang)} — ${formatDeadline(item.event_end_date, lang)}`
                : formatDeadline(item.deadline, lang)}
            </span>
          </div>
        ) : null}
        {item.source ? (
          <div className="meta-row">
            <span className="meta-label">{t.source}</span>
            <span className="meta-val">{item.source}</span>
          </div>
        ) : null}
      </div>

      {item.source_url ? (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-btn"
          onClick={() => handleLinkClick(item.title)}
        >
          {t.details}
        </a>
      ) : null}
    </article>
  );

  // Обірваний останній ряд лишав порожні клітинки праворуч від останньої
  // картки — це читалося як помилка верстки. Тому хвіст, що не добирає до
  // повного ряду, не малюємо: ці картки приїдуть наступною партією.
  // Виняток — остання партія: далі показувати нічого, тож малюємо все.
  const batchSize = Math.min(visible, filtered.length);
  const plan = useMemo(
    () => planCells(batchSize, cols || ASSUMED_COLS, !!promoProps),
    [batchSize, cols, promoProps],
  );
  const trim = cols > 0 && batchSize < filtered.length && plan.fullRowCards > 0;
  const rendered = trim ? plan.fullRowCards : batchSize;
  const planShown = trim
    ? { ...plan, cells: plan.cells.slice(0, plan.fullRowCells) }
    : plan;

  return (
    <>
      <div className="filters">
        {/* Компактний рядок легко проґавити, а фільтри — головний спосіб
            звузити 400 карток до своїх. Підпис пояснює, навіщо їх чіпати. */}
        <div className="filters-hint">
          <svg className="filters-hint-icon" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 6h9M15 6h2M3 14h2M8 14h9" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="13.5" cy="6" r="2.2" strokeWidth="1.8" />
            <circle cx="6.5" cy="14" r="2.2" strokeWidth="1.8" />
          </svg>
          {t.filtersHint}
        </div>
        <div className="filters-bar">
          {menus.map((m) => (
            <FilterButton
              key={m.id} id={m.id} label={m.label}
              options={m.options} selected={m.selected}
              openId={openId} setOpenId={setOpenId}
            />
          ))}

          {/* Пошук лишається на видноті: це найчастіша дія, ховати її у
              випадайку означало б зробити гірше, а не компактніше. */}
          <div className="search-wrap">
            <input
              type="search"
              className="search-input"
              placeholder={isEn ? 'FLEX, coding, aid for displaced families…' : 'FLEX, програмування, допомога ВПО...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {activeCount > 0 && (
            <button type="button" className="filters-reset" onClick={resetAll}>
              {t.reset}
              <span className="filters-reset-count">{activeCount}</span>
            </button>
          )}
        </div>

        <FilterPanel menu={openMenu} lang={lang} />

        {/* Обране видно й зі згорнутими випадайками — інакше після скролу
            неможливо згадати, що саме звузило видачу. */}
        {activeChips.length > 0 && (
          <div className="filters-active">
            {activeChips.map((c) => (
              <button
                key={`${c.facet}:${c.value}`}
                type="button"
                className="chip-active"
                onClick={c.onRemove}
                aria-label={isEn ? `Remove filter “${c.label}”` : `Прибрати фільтр «${c.label}»`}
              >
                {c.label}
                <span className="chip-x" aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="count">
          {t.found} <strong>{filtered.length}</strong>{' '}
          {isEn
            ? (filtered.length === 1 ? 'opportunity' : 'opportunities')
            : opportunitiesWord(filtered.length)}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label={isEn ? 'Sorting' : 'Сортування'}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{t.sort}: {isEn && s.en ? s.en : s.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <h3>{t.nothingTitle}</h3>
          <p>{t.nothingText}</p>
        </div>
      ) : null}

      {/* Коли видача порожня, карток немає — і промо-блок разом із ними зник
          би зі сторінки. Тут він саме доречний: людина шукала й не знайшла. */}
      {filtered.length === 0 && promoProps ? (
        <div className="grid-promo"><PlusSection {...promoProps} index={0} lang={lang} /></div>
      ) : null}

      {filtered.length === 0 ? null : (
        <>
          <div className="grid" ref={gridRef}>
            {planShown.cells.map((c, n) => {
              if (c.t === 'card') {
                const item = filtered[c.i];
                return <Fragment key={item.id}>{renderCard(item)}</Fragment>;
              }
              if (c.t === 'suggest') return <SuggestBlock key={`sug-${n}`} lang={lang} />;
              return (
                <div className="grid-promo" key={`plus-${n}`}>
                  <PlusSection {...promoProps} index={c.idx} lang={lang} />
                </div>
              );
            })}
          </div>
          {rendered < filtered.length && (
            <div className="load-more-wrap">
              <button
                className="load-more"
                onClick={() => setVisible(rendered + PAGE_SIZE)}
              >
                {t.showMore} {Math.min(PAGE_SIZE, filtered.length - rendered)}{isEn ? ' more' : ''}
              </button>
              <div className="load-more-hint">
                {t.shown} {rendered} {t.of} {filtered.length}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
