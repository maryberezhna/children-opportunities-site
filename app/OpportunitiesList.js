'use client';
import { Fragment, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import PlusSection from './PlusSection';
import SuggestBlock from './SuggestBlock';
import { THEME_OPTIONS, matchThemes } from '@/lib/themes';
import { TYPE_LABELS, AID_TYPE_LABELS, ANNUAL_TYPES } from '@/lib/labels';
import { opportunitiesWord } from '@/lib/plural';

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
  { label: 'Усі', value: 'all' },
  { label: '0-3', value: '0-3' },
  { label: '4-6', value: '4-6' },
  { label: '7-11', value: '7-11' },
  { label: '12-14', value: '12-14' },
  { label: '15-17', value: '15-17' },
];

const TYPE_OPTIONS = [
  { label: 'Усі', value: 'all' },
  // «Онлайн» — це формат участі, а не тема, тож живе тут, серед типів, і
  // стоїть першим: дистанційна участь знімає питання міста, тому це найчастіший
  // фільтр для родин поза великими містами й за кордоном.
  { label: '💻 Онлайн', value: 'online', highlight: true },
  { label: 'Курси', value: 'course' },
  { label: 'Конкурси', value: 'competition' },
  { label: 'Олімпіади', value: 'olympiad' },
  { label: 'Обміни', value: 'exchange' },
  { label: 'Табори', value: 'camp' },
  { label: 'Стипендії', value: 'scholarship' },
  { label: 'Держдопомога', value: 'gov_aid' },
  { label: 'Гранти', value: 'grant' },
  { label: 'Мед. допомога', value: 'medical_aid' },
  { label: 'Фестивалі', value: 'festival' },
  { label: 'Гуртки', value: 'club' },
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
  { label: 'Грошові виплати', value: 'cash' },
  { label: 'Соц. стипендії', value: 'scholarship' },
  { label: 'Оздоровлення', value: 'recreation' },
  { label: 'Безкоштовні секції', value: 'free_activities' },
  { label: 'Проф. навчання', value: 'vocational' },
];


const NEED_OPTIONS = [
  { label: 'Усі діти', value: 'all' },
  { label: 'ВПО', value: 'idp' },
  { label: 'Інвалідність', value: 'disability' },
  { label: 'Обдаровані', value: 'gifted' },
  { label: 'Онкохворі', value: 'oncology' },
  { label: 'Діти ветеранів і загиблих захисників', value: 'veteran_family' },
  { label: 'Малозабезпечені', value: 'low_income' },
  { label: 'Сироти', value: 'orphan' },
];

const COST_OPTIONS = [
  { label: 'Будь-яка', value: 'all' },
  { label: 'Безкоштовно', value: 'free' },
  { label: 'З фінансуванням', value: 'partially_free' },
];

const DEADLINE_OPTIONS = [
  { label: 'Усі', value: 'all' },
  { label: 'Цього тижня', value: 'week' },
  { label: 'Цього місяця', value: 'month' },
  { label: 'Найближчі 3 місяці', value: 'quarter' },
  { label: 'Без дедлайну (постійні)', value: 'none' },
];

// Cards rendered per batch. Filtering stays client-side (the chips, the city list
// and the result count all need the full set), so this caps the DOM, not the fetch.
const PAGE_SIZE = 24;

// Скільки партій дозвантажуються самі, поки людина гортає. Не безкінечно:
// після трьох (96 карток) повертається кнопка, інакше до підвалу з посиланнями
// на міста й теми доскролити стало б неможливо.
const AUTO_BATCHES = 3;

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

const PROMO_EVERY_CELLS = 9;
const dityamAtCell = (cells) => cells > 0 && cells % PROMO_EVERY_CELLS === 0;

const SORT_OPTIONS = [
  { label: 'За віком дитини', value: 'age' },
  { label: 'Найближчий дедлайн', value: 'deadline' },
  { label: 'Назва А-Я', value: 'title' },
  { label: 'Нещодавно додані', value: 'recent' },
];

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'];
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
function FilterPanel({ menu }) {
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
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function OpportunitiesList({ opportunities, presetCity, promoProps = null }) {
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
    query: (item) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return `${item.title || ''} ${item.summary || ''} ${item.source || ''}`
        .toLowerCase().includes(q);
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
      else if (sort === 'title') secondary = (a, b) => (a.title || '').localeCompare(b.title || '', 'uk');
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
      { id: 'age', label: 'Вік', all: AGE_GROUPS, selected: ages, onToggle: handlers.age },
      { id: 'type', label: 'Тип', all: TYPE_OPTIONS, selected: types, onToggle: handlers.type },
      // Підтипи держдопомоги мають сенс лише всередині «Держдопомоги».
      ...(types.has('gov_aid')
        ? [{ id: 'aid', label: 'Вид допомоги', all: AID_TYPE_OPTIONS, selected: aidTypes, onToggle: handlers.aid }]
        : []),
      { id: 'theme', label: 'Тема', all: THEME_OPTIONS, selected: themes, onToggle: handlers.theme },
      { id: 'deadline', label: 'Дедлайн', all: DEADLINE_OPTIONS, selected: deadlines, onToggle: handlers.deadline },
      { id: 'need', label: 'Особлива потреба', all: NEED_OPTIONS, selected: needs, onToggle: handlers.need },
      { id: 'cost', label: 'Вартість', all: COST_OPTIONS, selected: costs, onToggle: handlers.cost },
      {
        id: 'city',
        label: 'Місто',
        all: sortCities([...new Set([...available.city, ...selectedCities])])
          .map((c) => ({ label: c, value: c })),
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
  const [autoLoads, setAutoLoads] = useState(0);
  const sentinel = useRef(null);
  useEffect(() => {
    setVisible(PAGE_SIZE);
    setAutoLoads(0);
  }, [filtered]);

  // Дозавантаження без кліку: щойно низ списку наближається на 600px —
  // підвантажуємо наступну партію. Кнопка лишається для тих, хто дійшов до
  // ліміту авто-партій, і для клавіатури.
  useEffect(() => {
    if (visible >= filtered.length) return undefined;
    if (autoLoads >= AUTO_BATCHES) return undefined;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible((v) => v + PAGE_SIZE);
        setAutoLoads((n) => n + 1);
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, filtered.length, autoLoads]);

  const ageLabel = (item) => {
    if (item.age_from === item.age_to) return `${item.age_from} років`;
    if (item.age_from === 0 && item.age_to >= 17) return '0-18 років';
    return `${item.age_from}-${item.age_to} років`;
  };

  const handleLinkClick = (title) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'opportunity_click', {
        event_category: 'engagement',
        event_label: title,
      });
    }
  };

  const deadlineChip = (item) => {
    const days = daysUntilDeadline(item.deadline);
    const annual = ANNUAL_TYPES.has(item.opportunity_type);
    if (days === null) {
      return annual ? <span className="chip chip-annual">🔄 щорічно</span> : null;
    }
    if (days < 0) {
      return annual ? <span className="chip chip-annual">🔄 відкривається щороку</span> : null;
    }
    if (days === 0) return <span className="chip chip-deadline-urgent">⏰ сьогодні</span>;
    if (days <= 7) return <span className="chip chip-deadline-urgent">⏰ {days} {days === 1 ? 'день' : 'днів'}</span>;
    if (days <= 30) return <span className="chip chip-deadline-soon">⏳ {days} днів</span>;
    return null;
  };

  const renderCard = (item) => (
    <article key={item.id} className="card">
      <div className="chips">
        <span className="chip chip-type">{TYPE_LABELS[item.opportunity_type] || item.opportunity_type}</span>
        {item.aid_type ? <span className="chip chip-aid">🏛 {AID_TYPE_LABELS[item.aid_type] || 'держдопомога'}</span> : null}
        <span className="chip chip-age">{ageLabel(item)}</span>
        {item.cost_type === 'free' ? <span className="chip chip-free">безкоштовно</span> : null}
        {item.cost_type === 'partially_free' ? <span className="chip chip-paid">з фінансуванням</span> : null}
        {item.cost_type === 'paid_affordable' ? <span className="chip chip-paid">доступно</span> : null}
        {deadlineChip(item)}
        {(item.child_needs || []).filter((n) => NEED_LABELS[n]).slice(0, 2).map((n) => (
          <span key={n} className="chip chip-need">{NEED_LABELS[n]}</span>
        ))}
      </div>

      <h3>
        <Link href={`/o/${item.slug}`} className="card-title-link">
          {item.title}
        </Link>
      </h3>
      <p className="card-summary">{item.summary}</p>

      <div className="meta">
        {item.format ? (
          <div className="meta-row">
            <span className="meta-label">Формат</span>
            <span className="meta-val">{item.format}</span>
          </div>
        ) : null}
        {item.deadline ? (
          <div className="meta-row">
            <span className="meta-label">Дедлайн</span>
            <span className="meta-val">{formatDeadline(item.deadline)}</span>
          </div>
        ) : null}
        {item.source ? (
          <div className="meta-row">
            <span className="meta-label">Джерело</span>
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
          Детальніше ↗
        </a>
      ) : null}
    </article>
  );

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
          Оберіть вік, тему й місто — покажемо лише те, що підходить вашій дитині
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
              placeholder="FLEX, програмування, допомога ВПО..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {activeCount > 0 && (
            <button type="button" className="filters-reset" onClick={resetAll}>
              Скинути
              <span className="filters-reset-count">{activeCount}</span>
            </button>
          )}
        </div>

        <FilterPanel menu={openMenu} />

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
                aria-label={`Прибрати фільтр «${c.label}»`}
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
          Знайдено <strong>{filtered.length}</strong> {opportunitiesWord(filtered.length)}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Сортування"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>Сортувати: {s.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <h3>Нічого не знайдено</h3>
          <p>Спробуйте послабити критерії пошуку або скинути фільтри.</p>
        </div>
      ) : null}

      {/* Коли видача порожня, карток немає — і промо-блок разом із ними зник
          би зі сторінки. Тут він саме доречний: людина шукала й не знайшла. */}
      {filtered.length === 0 && promoProps ? (
        <div className="grid-promo"><PlusSection {...promoProps} index={0} /></div>
      ) : null}

      {filtered.length === 0 ? null : (
        <>
          <div className="grid">
            {(() => {
              const shown = filtered.slice(0, visible);
              const nodes = [];
              let cells = 0;
              let plusIdx = 0;
              shown.forEach((item, i) => {
                nodes.push(<Fragment key={item.id}>{renderCard(item)}</Fragment>);
                cells += 1;
                let justSuggested = false;
                if (suggestTakesCell(cells + 1)) {
                  nodes.push(<SuggestBlock key={`sug-${i}`} />);
                  cells += 1;
                  justSuggested = true;
                }
                // Коли крок Dityam+ збігається з щойно вставленою карткою
                // пропозиції (клітинка 36), пропускаємо раунд — два банери
                // поспіль читаються як суцільна реклама.
                const lastShort = shown.length < SUGGEST_FIRST - 1 && i === shown.length - 1;
                if (promoProps && !justSuggested && (dityamAtCell(cells) || lastShort)) {
                  nodes.push(
                    <div className="grid-promo" key={`plus-${i}`}>
                      <PlusSection {...promoProps} index={plusIdx} />
                    </div>,
                  );
                  plusIdx += 1;
                }
              });
              return nodes;
            })()}
          </div>
          <div ref={sentinel} aria-hidden="true" />
          {visible < filtered.length && (
            <div className="load-more-wrap">
              {autoLoads >= AUTO_BATCHES ? (
                <button
                  className="load-more"
                  onClick={() => {
                    setVisible((v) => v + PAGE_SIZE);
                    setAutoLoads(0);   // клік дає ще три авто-партії
                  }}
                >
                  Показати ще {Math.min(PAGE_SIZE, filtered.length - visible)}
                </button>
              ) : (
                <div className="load-more-spinner" role="status" aria-live="polite">
                  <span className="load-more-dot" />
                  <span className="load-more-dot" />
                  <span className="load-more-dot" />
                  <span className="sr-only">Завантажуємо ще можливості</span>
                </div>
              )}
              <div className="load-more-hint">
                Показано {visible} з {filtered.length}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
