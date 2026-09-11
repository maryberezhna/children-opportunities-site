'use client';
import { useState } from 'react';
import { missingRequired } from '@/lib/required';

const FORMATS = [['', '— не визначено —'], ['online', 'Онлайн'], ['offline', 'Офлайн'], ['hybrid', 'Онлайн і офлайн']];
// «Не визначено» стоїть першим і порожнім НАВМИСНО: раніше форма підставляла
// «Безкоштовно» кожному запису без вартості, і збереження перетворювало
// «невідомо» на факт. Порожнє поле краще за правдоподібне.
const RECURRENCE = [['', 'Разова подія'], ['annual', 'Щороку'], ['ongoing', 'Постійно доступна']];
const COST = [['', '— не визначено —'], ['free', 'Безкоштовно'], ['partially_free', 'З фінансуванням'], ['paid_affordable', 'Доступно'], ['paid_premium', 'Преміум'], ['subsidized', 'Субсидовано']];
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
    event_end_date: opp.event_end_date || '', recurrence: opp.recurrence || '',
    cost_type: opp.cost_type || '', opportunity_type: opp.opportunity_type || 'course',
    format: opp.format || '', cities: (opp.cities || []).join(', '),
    price_note: opp.price_note || '', details: opp.details || '',
    // Прапорець, а не рядок: модератор думає «так, це в топ цього тижня»,
    // а не «який зараз ISO-тиждень». Тиждень підставляє сервер.
    featured: opp.featured_week === opp.currentWeek,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const up = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Що саме заважає опублікувати — рахуємо на льоту, з того, що в полях
  // просто зараз. Кнопка публікації гасне, поки перелік не порожній
  // (вимога Марії 11.09.2026: ці пʼять полів обовʼязкові перед сайтом).
  const missing = missingRequired({
    age_from: f.age_from === '' ? null : Number(f.age_from),
    age_to: f.age_to === '' ? null : Number(f.age_to),
    deadline: f.deadline || null,
    event_end_date: f.event_end_date || null,
    recurrence: f.recurrence || null,
    cost_type: f.cost_type || null,
    opportunity_type: f.opportunity_type,
    format: f.format || null,
    cities: f.cities.split(',').map((s) => s.trim()).filter(Boolean),
    countries: opp.countries || [],
    is_international: opp.is_international || false,
  });

  async function save(publish) {
    setBusy(true); setDone('');
    try {
      const res = await fetch('/api/admin/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: opp.id, ...f, publish }),
      });
      if (res.ok) {
        setDone(publish ? '✅ Збережено й опубліковано' : '💾 Збережено (лишилось чернеткою)');
      } else if (res.status === 422) {
        const body = await res.json().catch(() => ({}));
        setDone(`Помилка: не вистачає полів — ${(body.missing || []).join(', ')}`);
      } else {
        setDone('Помилка. Перезайди в /admin.');
      }
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
        <div style={{ flex: '1 1 150px' }}><label style={L}>Дедлайн подачі</label><input type="date" style={I} value={f.deadline || ''} onChange={up('deadline')} /></div>
        <div style={{ flex: '1 1 150px' }}><label style={L}>Дата завершення</label><input type="date" style={I} value={f.event_end_date || ''} onChange={up('event_end_date')} /></div>
        <div style={{ flex: '1 1 80px' }}><label style={L}>Вік від</label><input type="number" min="0" max="18" style={I} value={f.age_from} onChange={up('age_from')} /></div>
        <div style={{ flex: '1 1 80px' }}><label style={L}>Вік до</label><input type="number" min="0" max="18" style={I} value={f.age_to} onChange={up('age_to')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Тип</label><select style={I} value={f.opportunity_type} onChange={up('opportunity_type')}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Вартість</label><select style={I} value={f.cost_type} onChange={up('cost_type')}>{COST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Формат</label><select style={I} value={f.format} onChange={up('format')}>{FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Періодичність</label><select style={I} value={f.recurrence} onChange={up('recurrence')}>{RECURRENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <label style={L}>Міста <span style={{ fontWeight: 400, color: '#8a94a6' }}>— через кому; порожньо, якщо онлайн або за кордоном</span></label>
      <input style={I} value={f.cities} onChange={up('cities')} placeholder="Львів, Київ" />
      {/* Іде просто в сніпет Google — за запитами «… ціна» ми показувались і не
          отримували жодного кліку, бо категорії вартості на них не відповідають. */}
      <label style={L}>Вартість словами <span style={{ fontWeight: 400, color: '#8a94a6' }}>— «від 12 000 грн за зміну», «безкоштовно для ВПО»</span></label>
      <input style={I} value={f.price_note} onChange={up('price_note')} placeholder="напр. від 12 000 грн за зміну 14 днів" />
      <label style={L}>Розгорнутий матеріал <span style={{ fontWeight: 400, color: '#8a94a6' }}>— ## заголовок, - список, **жирний**. Короткі описи не ранжуються.</span></label>
      <textarea style={{ ...I, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 13.5 }} rows={14} value={f.details} onChange={up('details')} placeholder={'## Хто може подаватись\n- учні 8-11 класів\n\n## Етапи\n...'} />
      {/* Ручний вибір перебиває правило: щотижневий скрипт бачить позначку
          й лишає її, добираючи решту трійки сам. Знімається так само —
          зняттям галочки, і наступного понеділка вона згасне в будь-якому разі. */}
      <label style={{ ...L, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={f.featured}
          onChange={(e) => setF((s) => ({ ...s, featured: e.target.checked }))}
          style={{ width: 17, height: 17, cursor: 'pointer' }}
        />
        <span>⭐ Топ тижня <span style={{ fontWeight: 400, color: '#8a94a6' }}>— показувати з позначкою й нагорі каталогу до понеділка</span></span>
      </label>
      {missing.length ? (
        <p style={{ marginTop: 16, marginBottom: 0, padding: '10px 12px', borderRadius: 10, background: '#fdecec', border: '1px solid #f3bcbc', color: '#a11b1b', fontSize: 13.5, fontWeight: 600 }}>
          ⛔ Не можна опублікувати — бракує: {missing.join(', ')}
        </p>
      ) : null}
      {opp.source_url ? <p style={{ marginTop: 12, fontSize: 13 }}><a href={opp.source_url} target="_blank" rel="noreferrer" style={{ color: '#1e4fd6' }}>🔗 відкрити джерело ↗</a></p> : null}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => save(false)} disabled={busy} style={{ padding: '10px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: '1px solid #d3dbe9', background: '#fff', color: '#54617a', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>💾 Зберегти чернеткою</button>
        <button onClick={() => save(true)} disabled={busy || missing.length > 0} style={{ padding: '10px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', cursor: busy || missing.length ? 'default' : 'pointer', opacity: busy || missing.length ? 0.45 : 1 }}>✅ Зберегти й опублікувати</button>
        <a href="/admin" style={{ padding: '10px 6px', fontSize: 14, color: '#54617a' }}>← До черги</a>
      </div>
      {done ? <p style={{ marginTop: 12, fontWeight: 600, color: done.startsWith('Помилка') ? '#d92c2c' : '#15803d' }}>{done}</p> : null}
    </div>
  );
}
