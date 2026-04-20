'use client';
import { useState, useMemo } from 'react';

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
];

const NEED_OPTIONS = [
  { label: 'Будь-яка', value: 'all' },
  { label: 'ВПО', value: 'idp' },
  { label: 'Сироти', value: 'orphan' },
  { label: 'Інвалідність', value: 'disability' },
  { label: 'Обдаровані', value: 'gifted' },
  { label: 'Онкохворі', value: 'oncology' },
];

const COST_OPTIONS = [
  { label: 'Будь-яка', value: 'all' },
  { label: 'Безкоштовно', value: 'free' },
  { label: 'З фінансуванням', value: 'partially_free' },
];

export default function OpportunitiesList({ opportunities }) {
  const [age, setAge] = useState('all');
  const [type, setType] = useState('all');
  const [need, setNeed] = useState('all');
  const [cost, setCost] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return opportunities.filter((item) => {
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
      if (query) {
        const q = query.toLowerCase();
        const hay = `${item.title || ''} ${item.summary || ''} ${item.source || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [opportunities, age, type, need, cost, query]);

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

        <div className="filter-row" style={{ marginTop: 16 }}>
          <input
            type="search"
            className="search-input"
            placeholder="Пошук: напр. FLEX, програмування, Київ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="count">Знайдено {filtered.length} можливостей</div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>Нічого не знайдено за вашими фільтрами.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Спробуйте послабити критерії.</p>
        </div>
      ) : (
        filtered.map((item) => (
          <div key={item.id} className="card">
            <div className="chips">
              <span className="chip chip-type">{TYPE_LABELS[item.opportunity_type] || item.opportunity_type}</span>
              <span className="chip chip-age">
                {item.age_from === item.age_to ? `${item.age_from} років` : `${item.age_from}-${item.age_to} років`}
              </span>
              {item.cost_type === 'free' && <span className="chip chip-cost">безкоштовно</span>}
              {item.cost_type === 'partially_free' && <span className="chip chip-cost">з фінансуванням</span>}
              {(item.child_needs || []).map((n) => (
                <span key={n} className="chip chip-need">{NEED_LABELS[n] || n}</span>
              ))}
            </div>

            <h3>{item.title}</h3>
            <p>{item.summary}</p>

            <div className="meta">
              {item.deadline && (
                <div className="meta-box">
                  <div className="meta-label">Дедлайн</div>
                  <div className="meta-val">{item.deadline}</div>
                </div>
              )}
              {item.format && (
                <div className="meta-box">
                  <div className="meta-label">Формат</div>
                  <div className="meta-val">{item.format}</div>
                </div>
              )}
              {item.source && (
                <div className="meta-box">
                  <div className="meta-label">Джерело</div>
                  <div className="meta-val">{item.source}</div>
                </div>
              )}
            </div>

            {item.source_url && (
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="link-btn">
                Детальніше ↗
              </a>
            )}
          </div>
        ))
      )}
    </>
  );
}
