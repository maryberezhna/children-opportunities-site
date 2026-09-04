'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import PlusSection from './PlusSection';
import { TYPE_LABELS, TYPE_LABELS_EN, ANNUAL_TYPES, isEvent } from '@/lib/labels';
import { cityLabel } from '@/lib/labels';
import { opportunitiesWord } from '@/lib/plural';
import { daysUntil, kyivToday } from '@/lib/dates';
import { goesAbroad } from '@/lib/geo';
import { buildHaystack, queryTokens, matchesQuery } from '@/lib/search';
import { trackOpportunityClick } from '@/lib/track';
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
    hint: 'спочатку — з найближчим дедлайном',
    reset: 'Скинути',
    nothingTitle: 'Нічого не знайдено',
    nothingText: 'Спробуйте інший фільтр.',
    showMore: 'Показати ще',
    details: 'Детальніше ↗',
    topTitle: '⏰ Топ тижня',
    topSub: 'три дедлайни, які закриваються найближчими днями',
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
    f: { format: 'Формат', place: 'Де', source: 'Джерело',
      benefit: 'Отримаєш', requirement: 'Треба', deadline: 'Дедлайн' },
    sel: { age: 'Вік дитини', grade: 'Клас', deadline: 'Дедлайн',
      need: 'Особлива потреба', gives: 'Що дає', cost: 'Вартість', where: 'Де' },
    all: 'Усі', anyCost: 'Будь-яка', abroad: '🌍 За кордоном',
    countWord: (n) => opportunitiesWord(n),
  },
  en: {
    found: 'Found',
    hint: 'closest deadline first',
    reset: 'Reset',
    nothingTitle: 'Nothing found',
    nothingText: 'Try a different filter.',
    showMore: 'Show more',
    details: 'Details ↗',
    topTitle: '⏰ Top this week',
    topSub: 'three deadlines closing soonest',
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
    f: { format: 'Format', place: 'Where', source: 'Source',
      benefit: 'You get', requirement: 'You need', deadline: 'Deadline' },
    sel: { age: 'Child age', grade: 'Grade', deadline: 'Deadline',
      need: 'Special need', gives: 'What it gives', cost: 'Cost', where: 'Where' },
    all: 'All', anyCost: 'Any', abroad: '🌍 Abroad',
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
  teens: [
    { value: 'online', label: '💻 Онлайн', en: '💻 Online' },
    { value: 'exchange', label: 'Обміни', en: 'Exchanges' },
    { value: 'internship', label: 'Стажування', en: 'Internships' },
    { value: 'scholarship', label: 'Стипендії', en: 'Scholarships' },
    { value: 'grant', label: 'Гранти', en: 'Grants' },
    { value: 'volunteer', label: 'Волонтерство', en: 'Volunteering' },
    { value: 'competition', label: 'Конкурси', en: 'Competitions' },
  ],
};

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

const COST_OPTS = [
  ['free', 'Безкоштовно', 'Free'],
  ['partial', 'З фінансуванням', 'Funded'],
  // «Платно» видиме нарівні з безкоштовним: інакше платне не можна ні
  // знайти, ні відсіяти (урок #152).
  ['paid', 'Платно', 'Paid'],
];

const DEADLINE_OPTS = [
  ['week', 'Цього тижня', 'This week'],
  ['month', 'Цього місяця', 'This month'],
  ['none', 'Без дедлайну', 'No deadline'],
];

// Кольори чипа типу (bg / текст) — палітра референсу, ключі — наші
// opportunity_type. Все, чого немає в мапі, отримує кремовий.
const TAG_COLORS = {
  club: ['#fde8c7', '#8a5a0a'], internship: ['#fde8c7', '#8a5a0a'],
  course: ['#fef7e0', '#8a5a0a'], workshop: ['#fef7e0', '#8a5a0a'],
  camp: ['#e8f4f2', '#0a5348'], hackathon: ['#e8f4f2', '#0a5348'],
  summer_school: ['#e8f4f2', '#0a5348'],
  olympiad: ['#ede8f8', '#4c3d8c'], exchange: ['#ede8f8', '#4c3d8c'],
  study_program: ['#ede8f8', '#4c3d8c'],
  competition: ['#fde8ef', '#8a1a3a'], volunteer: ['#fde8ef', '#8a1a3a'],
  festival: ['#fde8ef', '#8a1a3a'], sport_tournament: ['#fde8ef', '#8a1a3a'],
  allowance: ['#e4f2d6', '#2d5814'], support_payment: ['#e4f2d6', '#2d5814'],
  medical_aid: ['#e4f2d6', '#2d5814'], scholarship: ['#e4f2d6', '#2d5814'],
  grant: ['#e4f2d6', '#2d5814'], humanitarian: ['#e4f2d6', '#2d5814'],
};

const DL_COLORS = {
  urgent: ['#fde3e3', '#991b1b'],
  soon: ['#fef2d4', '#78350f'],
  calm: ['#f7f1e6', '#8a8a8a'],
  event: ['#e5eefc', '#1b4a8f'],
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

export default function OpportunitiesList({
  opportunities, presetCity, promoProps = null, lang = 'uk', today, modeAware = false,
}) {
  const todayIso = today || kyivToday();
  const t = UI[lang] || UI.uk;
  const isEn = lang === 'en';

  // Режим «Батькам / Підліткам» вмикається лише там, де в шапці є
  // перемикач (головна). На сторінках міст і тем каталог завжди
  // батьківський — там своя обіцянка в заголовку сторінки.
  const [mode, setMode] = useState('parents');
  useEffect(() => {
    if (!modeAware) return undefined;
    setMode(readMode());
    return onModeChange(setMode);
  }, [modeAware]);
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

  // Зміна режиму скидає фільтри: у батьків і підлітків різні словники.
  useEffect(() => {
    if (!modeAware) return;
    setType('all'); setAge('all'); setDeadline('all'); setNeed('all');
    setCost('all'); setQuery(''); setLimit(6);
    if (!presetCity) setPlace('all');
  }, [mode, modeAware, presetCity]);

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

  // Прострочені разові можливості не показуємо ніде.
  const liveItems = useMemo(() => opportunities.filter((item) => {
    const days = daysUntil(item.deadline, todayIso);
    if (days !== null && days < 0 && !ANNUAL_TYPES.has(item.opportunity_type)) return false;
    // База підліткового режиму: все, що доступне у 13+.
    if (teens && item.age_to < 13) return false;
    return true;
  }), [opportunities, todayIso, teens]);

  const predicates = useMemo(() => ({
    type: (item) => {
      if (type === 'all') return true;
      if (type === 'online') return isOnline(item);
      if (type === 'payments') {
        return item.opportunity_type === 'allowance'
          || item.opportunity_type === 'support_payment'
          || item.aid_type === 'cash';
      }
      return item.opportunity_type === type;
    },
    age: (item) => age === 'all' || ageMatches(item, age),
    deadline: (item) => {
      if (deadline === 'all') return true;
      const days = daysUntil(item.deadline, todayIso);
      if (deadline === 'none') return days === null;
      if (deadline === 'week') return days !== null && days >= 0 && days <= 7;
      if (deadline === 'month') return days !== null && days >= 0 && days <= 31;
      return true;
    },
    need: (item) => {
      if (need === 'all') return true;
      if (teens) {
        if ((item.teen_tags || []).includes(need)) return true;
        // «Поїздка» працює і до розмітки: закордон видно з географії.
        return need === 'поїздка' && goesAbroad(item);
      }
      return (item.child_needs || []).includes(need);
    },
    cost: (item) => {
      if (cost === 'all') return true;
      if (cost === 'free') return item.cost_type === 'free';
      if (cost === 'partial') return item.cost_type === 'partially_free';
      return item.cost_type === 'paid_affordable' || item.cost_type === 'paid_premium';
    },
    place: (item) => {
      if (place === 'all') return true;
      if (place === 'abroad') return goesAbroad(item);
      const cities = item.cities || [];
      if (cities.includes(place)) return true;
      // «Вся Україна» просвічує крізь вибір конкретного міста.
      return cities.includes('Вся Україна') && !PSEUDO_CITIES.has(place);
    },
    query: (item) => {
      const tokens = queryTokens(query);
      if (!tokens.length) return true;
      const hay = searchIndex.get(item.id);
      return Boolean(hay) && matchesQuery(tokens, hay);
    },
  }), [type, age, deadline, need, cost, place, query, teens, todayIso, searchIndex]);

  const FACETS = ['type', 'age', 'deadline', 'need', 'cost', 'place', 'query'];

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
      if (item.cost_type === 'partially_free') costs.add('partial');
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

  useEffect(() => { setLimit(6); }, [type, age, deadline, need, cost, place, query]);

  const reset = () => {
    setType('all'); setAge('all'); setDeadline('all'); setNeed('all');
    setCost('all'); setQuery(''); setLimit(6);
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

  const placeText = (item) => {
    if (goesAbroad(item)) return t.abroad.replace('🌍 ', '');
    const real = (item.cities || []).filter((c) => !PSEUDO_CITIES.has(c));
    const shown = real.length ? real
      : (item.cities || []).filter((c) => c !== 'Міжнародні');
    if (!shown.length) return null;
    return shown.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ');
  };

  const renderCard = (item) => {
    const [tagBg, tagFg] = TAG_COLORS[item.opportunity_type] || ['#f7f1e6', '#4a4a4a'];
    const dl = dlChip(item);
    const [dlBg, dlFg] = DL_COLORS[dl.kind];
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

    return (
      <article key={item.id} className="v2-card">
        <div className="v2-card-tags">
          <span className="v2-tag" style={{ background: tagBg, color: tagFg }}>{typeLabel}</span>
          <span className="v2-tag" style={{ background: dlBg, color: dlFg }}>{dl.text}</span>
        </div>
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

  const chips = TYPE_CHIPS[teens ? 'teens' : 'parents']
    .filter((c) => available.chips.has(c.value) || type === c.value);

  const optLabel = (o) => (isEn && o[2] ? o[2] : o[1]);
  const selectOpts = (list, availableSet, current) =>
    list.filter(([value]) => availableSet.has(value) || current === value);

  const ageList = AGE_OPTS[teens ? 'teens' : 'parents'];
  const needList = teens ? GIVES_OPTS : NEED_OPTS;
  const placeList = useMemo(() => {
    const cities = [...available.places].filter((p) => p !== 'abroad')
      .sort((a, b) => a.localeCompare(b, 'uk'));
    const out = [];
    if (available.places.has('abroad') || place === 'abroad') out.push(['abroad', t.abroad, t.abroad]);
    for (const c of cities) out.push([c, c, cityLabel(c, 'en')]);
    return out;
  }, [available.places, place, t.abroad]);

  const count = stream.length + (hasActive ? 0 : topCards.length);
  const shown = stream.slice(0, limit);

  return (
    <>
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
          <span className="v2-found-hint">{t.hint}</span>
        </div>
      </section>

      {topCards.length === 3 ? (
        <section className="v2-top" aria-label={t.topTitle}>
          <div className="v2-top-head">
            <h2>{t.topTitle}</h2>
            <span>{t.topSub}</span>
          </div>
          <div className="v2-grid">
            {topCards.map(renderCard)}
          </div>
        </section>
      ) : null}

      {shown.length ? (
        <section className="v2-grid">
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
          <button type="button" className="v2-more-btn" onClick={() => setLimit(limit + 6)}>
            {t.showMore}
          </button>
        </div>
      ) : null}

      {promoProps ? <PlusSection {...promoProps} lang={lang} /> : null}
    </>
  );
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
