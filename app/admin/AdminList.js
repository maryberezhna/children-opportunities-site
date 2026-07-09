'use client';
import { useState } from 'react';

const TYPE_LABELS = {
  course: 'Курс', workshop: 'Майстер-клас', summer_school: 'Літня школа',
  study_program: 'Навчальна програма', mentorship: 'Менторство', club: 'Гурток',
  camp: 'Табір', olympiad: 'Олімпіада', competition: 'Конкурс', hackathon: 'Хакатон',
  sport_tournament: 'Спорт. турнір', festival: 'Фестиваль', award: 'Премія',
  exchange: 'Обмін', excursion: 'Екскурсія', residency: 'Резиденція',
  scholarship: 'Стипендія', grant: 'Грант', allowance: 'Виплата',
  support_payment: 'Соц. виплата', internship: 'Стажування', volunteer: 'Волонтерство',
  conference: 'Конференція', medical_aid: 'Мед. допомога', psychology: 'Психологія',
  rehabilitation: 'Реабілітація', humanitarian: 'Гум. допомога', legal_aid: 'Правова допомога',
  shelter: 'Прихисток', educational_material: 'Навч. матеріали',
};

function ageLabel(o) {
  if (o.age_from == null && o.age_to == null) return '';
  if (o.age_from === 0 && o.age_to >= 17) return '0–18 р.';
  if (o.age_from === o.age_to) return `${o.age_from} р.`;
  return `${o.age_from}–${o.age_to} р.`;
}

export default function AdminList({ initial }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({}); // id -> 'approved' | 'skipped'

  async function act(id, action) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        setDone((d) => ({ ...d, [id]: action === 'approve' ? 'approved' : 'skipped' }));
        setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 550);
      } else {
        alert('Не вдалося. Спробуй ще раз або перезайди.');
      }
    } catch {
      alert('Помилка мережі.');
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <p style={{ color: '#54617a', marginTop: 24 }}>Немає кандидатів на модерацію. Агент додасть нові після наступного щоденного прогону.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
      {items.map((o) => {
        const state = done[o.id];
        return (
          <article
            key={o.id}
            style={{
              border: '1px solid #e2e8f2', borderRadius: 14, padding: '16px 18px',
              background: state === 'approved' ? '#e7f6ec' : state === 'skipped' ? '#f3f4f6' : '#fff',
              transition: 'background .2s, opacity .3s', opacity: state ? 0.7 : 1,
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: '#54617a', marginBottom: 6 }}>
              <span style={{ background: '#f0e9fd', color: '#4c3d8c', padding: '2px 9px', borderRadius: 20 }}>
                {TYPE_LABELS[o.opportunity_type] || o.opportunity_type}
              </span>
              {ageLabel(o) ? <span>{ageLabel(o)}</span> : null}
              {o.cost_type === 'free' ? <span style={{ color: '#15803d' }}>безкоштовно</span> : null}
              {o.deadline ? <span>⏰ {o.deadline}</span> : null}
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{o.title}</h3>
            {o.summary ? <p style={{ margin: '0 0 10px', fontSize: 14, color: '#3a4557', lineHeight: 1.5 }}>{o.summary}</p> : null}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, color: '#54617a', marginBottom: 12, flexWrap: 'wrap' }}>
              {o.source ? <span>{o.source}</span> : null}
              {o.source_url ? <a href={o.source_url} target="_blank" rel="noreferrer" style={{ color: '#1e4fd6' }}>джерело ↗</a> : null}
            </div>

            {state ? (
              <div style={{ fontWeight: 600, color: state === 'approved' ? '#15803d' : '#6b7280' }}>
                {state === 'approved' ? '✅ Додано на сайт' : '❌ Пропущено'}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => act(o.id, 'approve')}
                  disabled={busy === o.id}
                  style={{ padding: '9px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', opacity: busy === o.id ? 0.6 : 1 }}
                >
                  ✅ Додати на сайт
                </button>
                <button
                  onClick={() => act(o.id, 'skip')}
                  disabled={busy === o.id}
                  style={{ padding: '9px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: '1px solid #d3dbe9', background: '#fff', color: '#54617a', cursor: 'pointer', opacity: busy === o.id ? 0.6 : 1 }}
                >
                  ❌ Пропустити
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
