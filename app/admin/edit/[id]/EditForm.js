'use client';
import { useState } from 'react';

const COST = [['free', 'Безкоштовно'], ['partially_free', 'З фінансуванням'], ['paid_affordable', 'Доступно'], ['paid_premium', 'Преміум'], ['subsidized', 'Субсидовано']];
const TYPES = [
  ['course', 'Курс'], ['workshop', 'Майстер-клас'], ['summer_school', 'Літня школа'], ['study_program', 'Навчальна програма'],
  ['mentorship', 'Менторство'], ['club', 'Гурток'], ['camp', 'Табір'], ['olympiad', 'Олімпіада'], ['competition', 'Конкурс'],
  ['hackathon', 'Хакатон'], ['sport_tournament', 'Спорт. турнір'], ['festival', 'Фестиваль'], ['award', 'Премія'],
  ['exchange', 'Обмін'], ['excursion', 'Екскурсія'], ['residency', 'Резиденція'], ['scholarship', 'Стипендія'], ['grant', 'Грант'],
  ['allowance', 'Виплата'], ['support_payment', 'Соц. виплата'], ['internship', 'Стажування'], ['volunteer', 'Волонтерство'],
  ['conference', 'Конференція'], ['medical_aid', 'Мед. допомога'], ['psychology', 'Психологія'], ['rehabilitation', 'Реабілітація'],
  ['humanitarian', 'Гум. допомога'], ['legal_aid', 'Правова допомога'], ['shelter', 'Прихисток'], ['educational_material', 'Навч. матеріали'],
];

const L = { display: 'block', fontSize: 13, color: '#54617a', margin: '13px 0 4px', fontWeight: 600 };
const I = { width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '9px 12px', borderRadius: 9, border: '1px solid #d3dbe9', fontFamily: 'inherit' };

export default function EditForm({ opp }) {
  const [f, setF] = useState({
    title: opp.title || '', summary: opp.summary || '', deadline: opp.deadline || '',
    age_from: opp.age_from ?? 0, age_to: opp.age_to ?? 18,
    cost_type: opp.cost_type || 'free', opportunity_type: opp.opportunity_type || 'course',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const up = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save(publish) {
    setBusy(true); setDone('');
    try {
      const res = await fetch('/api/admin/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: opp.id, ...f, publish }),
      });
      setDone(res.ok ? (publish ? '✅ Збережено й опубліковано' : '💾 Збережено (лишилось чернеткою)') : 'Помилка. Перезайди в /admin.');
    } catch {
      setDone('Помилка мережі');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <label style={L}>Назва</label>
      <input style={I} value={f.title} onChange={up('title')} />
      <label style={L}>Опис</label>
      <textarea style={{ ...I, resize: 'vertical' }} rows={4} value={f.summary} onChange={up('summary')} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}><label style={L}>Дедлайн</label><input type="date" style={I} value={f.deadline || ''} onChange={up('deadline')} /></div>
        <div style={{ flex: '1 1 80px' }}><label style={L}>Вік від</label><input type="number" min="0" max="18" style={I} value={f.age_from} onChange={up('age_from')} /></div>
        <div style={{ flex: '1 1 80px' }}><label style={L}>Вік до</label><input type="number" min="0" max="18" style={I} value={f.age_to} onChange={up('age_to')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Тип</label><select style={I} value={f.opportunity_type} onChange={up('opportunity_type')}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Вартість</label><select style={I} value={f.cost_type} onChange={up('cost_type')}>{COST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      {opp.source_url ? <p style={{ marginTop: 12, fontSize: 13 }}><a href={opp.source_url} target="_blank" rel="noreferrer" style={{ color: '#1e4fd6' }}>🔗 відкрити джерело ↗</a></p> : null}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => save(false)} disabled={busy} style={{ padding: '10px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: '1px solid #d3dbe9', background: '#fff', color: '#54617a', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>💾 Зберегти чернеткою</button>
        <button onClick={() => save(true)} disabled={busy} style={{ padding: '10px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>✅ Зберегти й опублікувати</button>
        <a href="/admin" style={{ padding: '10px 6px', fontSize: 14, color: '#54617a' }}>← До черги</a>
      </div>
      {done ? <p style={{ marginTop: 12, fontWeight: 600, color: done.startsWith('Помилка') ? '#d92c2c' : '#15803d' }}>{done}</p> : null}
    </div>
  );
}
