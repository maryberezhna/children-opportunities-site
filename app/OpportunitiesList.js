'use client';
import { useState, useMemo } from 'react';
import SubscribeSection from './SubscribeSection';

// Після якої картки вставляти форму підписки у списку
const SUBSCRIBE_AFTER = 15;

const TYPE_LABELS = {
  course: 'Курс',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  club: 'Гурток',
  exchange: 'Обмін',
  camp: 'Табір',
  study_abroad: 'Навчання за кордоном',
  scholarship: 'Стипендія',
  allowance: 'Виплата',
  grant: 'Грант',
  festival: 'Фестиваль',
  sport_event: 'Спорт',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
};

const NEED_LABELS = {
  gifted: 'обдаровані',
  disability: 'інвалідність',
  autism: 'РАС',
  orphan: 'сироти',
  idp: 'ВПО',
  veteran_family: 'діти ветеранів',
  de_occupied: 'з деокупованих',
  frontline: 'з прифронтових',
  oncology: 'онкохворі',
  rare_disease: 'рідкісні хвороби',
  low_income: 'малозабезпечені',
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
  { label: 'Виплати', value: 'allowance' },
  { label: 'Гранти', value: 'grant' },
  { label: 'Мед. допомога', value: 'medical_aid' },
  { label: 'Фестивалі', value: 'festival' },
  { label: 'Гуртки', value: 'club' },
];

const NEED_OPTIONS = [
  { label: 'Усі діти', value: 'all' },
  { label: 'ВПО', value: 'idp' },
  { label: 'Сироти', value: 'orphan' },
  { label: 'Інвалідність', value: 'disability' },
  { label: 'Обдаровані', value: 'gifted' },
  { label: 'Онкохворі', value: 'oncology' },
  { label: 'Діти ветеранів', value: 'veteran_family' },
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

const SORT_OPTIONS = [
  { label: 'За віком дитини', value: 'age' },
  { label: 'Найближчий дедлайн', value: 'deadline' },
  { label: 'Назва А-Я', value: 'title' },
  { label: 'Нещодавно додані', value: 'recent' },
];

// Форматування дати з ISO у читабельний формат
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

export default function OpportunitiesList({ opportunities }) {
  const [age, setAge] = useState('all');
  const [type, setType] = useState('all');
  const [need, setNeed] = useState('all');
  const [cost, setCost] = useState('all');
  const [deadline, setDeadline] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('age');

  const filtered = useMemo(() => {
    let result = opportunities.filter((item) => {
      if (age !== 'all') {
        const [f, t] = age.split('-').map(Number);
        if (!(item.age_from <= t && item.age_to >= f)) return false;
      }
      if (type !== 'all' && item.opportunity_type !== type) return false;
      if (need !== 'all') {
        const needs = item.child_needs || [];
        if (!needs.includes(need)) return false;
      }
      if (cost !== 'all' && item.cost_type !== cost) return false;

      if (deadline !== 'all') {
        const days = daysUntilDeadline(item.deadline);
        if (deadline === 'none') {
          if (days !== null) return false;
        } else if (deadline === 'week') {
          if (days === null || days < 0 || days > 7) return false;
        } else if (deadline === 'month') {
          if (days === null || days < 0 || days > 31) return false;
        } else if (deadline === 'quarter') {
          if (days === null || days < 0 || days > 92) return false;
        }
      }

      if (query) {
        const q = query.toLowerCase();
        const hay = `${item.title || ''} ${item.summary || ''} ${item.source || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'age') {
      result.sort((a, b) => a.age_from - b.age_from);
    } else if (sort === 'deadline') {
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
    } else if (sort === 'title') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk'));
    } else if (sort === 'recent') {
      result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }

    return result;
  }, [opportunities, age, type, need, cost, deadline, query, sort]);

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
    if (days === null) return null;
    if (days < 0) return <span className="chip chip-deadline-past">прострочено</span>;
    if (days === 0) return <span className="chip chip-deadline-urgent">⏰ сьогодні</span>;
    if (days <= 7) return <span className="chip chip-deadline-urgent">⏰ {days} {days === 1 ? 'день' : 'днів'}</span>;
    if (days <= 30) return <span className="chip chip-deadline-soon">⏳ {days} днів</span>;
    return null;
  };

  const renderCard = (item) => (
    <article key={item.id} className="card">
      <div className="chips">
        <span className="chip chip-type">{TYPE_LABELS[item.opportunity_type] || item.opportunity_type}</span>
        <span className="chip chip-age">{ageLabel(item)}</span>
        {item.cost_type === 'free' ? <span className="chip chip-free">безкоштовно</span> : null}
        {item.cost_type === 'partially_free' ? <span className="chip chip-paid">з фінансуванням</span> : null}
        {item.cost_type === 'paid_affordable' ? <span className="chip chip-paid">доступно</span> : null}
        {deadlineChip(item)}
        {(item.child_needs || []).slice(0, 2).map((n) => (
          <span key={n} className="chip chip-need">{NEED_LABELS[n] || n}</span>
        ))}
      </div>

      <h3>{item.title}</h3>
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
        <div className="filter-row">
          <div className="filter-label">Вік дитини</div>
          {AGE_GROUPS.map((g) => (
            <button
              key={g.value}
              className={`filter-btn ${age === g.value ? 'active' : ''}`}
              onClick={() => setAge(g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-label">Тип можливості</div>
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t.value}
              className={`filter-btn ${type === t.value ? 'active' : ''}`}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-label">Дедлайн</div>
          {DEADLINE_OPTIONS.map((d) => (
            <button
              key={d.value}
              className={`filter-btn ${deadline === d.value ? 'active' : ''}`}
              onClick={() => setDeadline(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-label">Особлива потреба</div>
          {NEED_OPTIONS.map((n) => (
            <button
              key={n.value}
              className={`filter-btn ${need === n.value ? 'active' : ''}`}
              onClick={() => setNeed(n.value)}
            >
              {n.label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-label">Вартість</div>
          {COST_OPTIONS.map((c) => (
            <button
              key={c.value}
              className={`filter-btn ${cost === c.value ? 'active' : ''}`}
              onClick={() => setCost(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>

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
          Знайдено <strong>{filtered.length}</strong> можлив{filtered.length === 1 ? 'ість' : filtered.length >= 2 && filtered.length <= 4 ? 'ості' : 'остей'}
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
        <div className="grid">
          {filtered.flatMap((item, idx) => {
            const card = renderCard(item);
            // Після 15-ї картки вставляємо форму підписки (якщо карток більше 15)
            if (idx === SUBSCRIBE_AFTER - 1 && filtered.length > SUBSCRIBE_AFTER) {
              return [card, <SubscribeSection key="subscribe-section" />];
            }
            return [card];
          })}
        </div>
      )}
    </>
  );
}
