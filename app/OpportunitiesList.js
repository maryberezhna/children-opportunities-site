'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
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

export default function OpportunitiesList({ opportunities, presetCity }) {
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
      || (types.has('gov_aid') && Boolean(item.aid_type)),
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

  // Any change to the filtered set puts the user back at the top of a fresh batch —
  // keeping a large `visible` across filter changes would dump hundreds of cards at once.
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filtered]);

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
        {/* Показуємо лише коли є що скидати: порожня кнопка «Скинути» на
            чистому каталозі лише додає шуму. На міській сторінці місто —
            частина адреси, тож повертаємо його, а не знімаємо. */}
        {activeCount > 0 && (
          <button type="button" className="filters-reset" onClick={resetAll}>
            Скинути фільтри
            <span className="filters-reset-count">{activeCount}</span>
          </button>
        )}
        <div className="filter-row">
          <div className="filter-label">Вік дитини</div>
          {AGE_GROUPS.filter((g) => isOfferable('age', g.value, ages)).map((g) => (
            <button
              key={g.value}
              className={`filter-btn ${isActive(ages, g.value) ? 'active' : ''}`}
              onClick={() => handlers.age(g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-label">Тип можливості</div>
          {TYPE_OPTIONS.filter((t) => isOfferable('type', t.value, types)).map((t) => (
            <button
              key={t.value}
              className={`filter-btn ${isActive(types, t.value) ? 'active' : ''}`}
              onClick={() => handlers.type(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {types.has('gov_aid') && (
          <div className="filter-row filter-subrow">
            <div className="filter-label">Вид держдопомоги</div>
            {AID_TYPE_OPTIONS.filter((a) => isOfferable('aid', a.value, aidTypes)).map((a) => (
              <button
                key={a.value}
                className={`filter-btn ${aidTypes.has(a.value) ? 'active' : ''}`}
                onClick={() => handlers.aid(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {available.theme.size > 0 && (
          <div className="filter-row">
            <div className="filter-label">Тема</div>
            {THEME_OPTIONS.filter((t) => isOfferable('theme', t.value, themes)).map((t) => (
              <button
                key={t.value}
                className={`filter-btn ${isActive(themes, t.value) ? 'active' : ''}`}
                onClick={() => handlers.theme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="filter-row">
          <div className="filter-label">Дедлайн</div>
          {DEADLINE_OPTIONS.filter((d) => isOfferable('deadline', d.value, deadlines)).map((d) => (
            <button
              key={d.value}
              className={`filter-btn ${isActive(deadlines, d.value) ? 'active' : ''}`}
              onClick={() => handlers.deadline(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-label">Особлива потреба</div>
          {NEED_OPTIONS.filter((n) => isOfferable('need', n.value, needs)).map((n) => (
            <button
              key={n.value}
              className={`filter-btn ${isActive(needs, n.value) ? 'active' : ''}`}
              onClick={() => handlers.need(n.value)}
            >
              {n.label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-label">Вартість</div>
          {COST_OPTIONS.filter((c) => isOfferable('cost', c.value, costs)).map((c) => (
            <button
              key={c.value}
              className={`filter-btn ${isActive(costs, c.value) ? 'active' : ''}`}
              onClick={() => handlers.cost(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {available.city.size > 0 && (
          <div className="filter-row">
            <div className="filter-label">Місто</div>
            <button
              className={`filter-btn ${selectedCities.size === 0 ? 'active' : ''}`}
              onClick={() => handlers.city('all')}
            >
              Усі
            </button>
            {/* Set обовʼязковий: обране місто майже завжди є і серед доступних,
                і без дедуплікації його чип малювався двічі */}
            {sortCities([...new Set([...available.city, ...selectedCities])]).map((city) => (
              <button
                key={city}
                className={`filter-btn ${selectedCities.has(city) ? 'active' : ''}`}
                onClick={() => handlers.city(city)}
              >
                {city}
              </button>
            ))}
          </div>
        )}

        <div className="filter-row">
          <div className="filter-label">Пошук</div>
          <div className="search-wrap">
            <input
              type="search"
              className="search-input"
              placeholder="FLEX, програмування, допомога ВПО..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
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
      ) : (
        <>
          <div className="grid">
            {filtered.slice(0, visible).map((item) => renderCard(item))}
          </div>
          {visible < filtered.length && (
            <div className="load-more-wrap">
              <button
                className="load-more"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                Показати ще {Math.min(PAGE_SIZE, filtered.length - visible)}
              </button>
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
