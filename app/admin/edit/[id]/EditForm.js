'use client';
import { useState } from 'react';
import { missingRequired } from '@/lib/required';
import { sourceUrlProblem } from '@/lib/source-link';
import { PAYMENT_TYPES } from '@/lib/labels';
import { countryFieldValue, countryOptions, countryPatch } from '@/lib/country-field';

const FORMATS = [['', '— не визначено —'], ['online', 'Онлайн'], ['offline', 'Офлайн'], ['hybrid', 'Онлайн і офлайн']];
// «Не визначено» стоїть першим і порожнім НАВМИСНО: раніше форма підставляла
// «Безкоштовно» кожному запису без вартості, і збереження перетворювало
// «невідомо» на факт. Порожнє поле краще за правдоподібне.
const RECURRENCE = [['', 'Разова подія'], ['annual', 'Щороку'], ['ongoing', 'Постійно доступна']];
// «Уточнюйте в школі» публікується лише для шкіл і студій діаспори (28.09.2026);
// будь-якому іншому запису перевірка при публікації скаже «бракує: вартість».
const COST = [['', '— не визначено —'], ['free', 'Безкоштовно'], ['paid_affordable', 'Платно'],
  ['ask_school', 'Уточнюйте в школі (лише школи діаспори)']];
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

// Домен джерела поруч із кнопкою: модератор одразу бачить, чи запис веде на
// сайт організатора, чи в телеграм-канал.
function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * inline — та сама форма всередині картки черги (Марія, 28.09.2026: зелена
 * кнопка «Відредагувати, а потім опублікувати»). Без розгорнутого матеріалу
 * й топу тижня — вони лишаються на повній сторінці редагування; onDone
 * отримує результат, щоб картка сказала «опубліковано» й дала лінк на сайт.
 */
export default function EditForm({ opp, stub = false, inline = false, onDone }) {
  const [f, setF] = useState({
    source_url: opp.source_url || '',
    title: opp.title || '', summary: opp.summary || '', deadline: opp.deadline || '',
    // stub — чернетка, створена кнопкою «Додати на сайт» з пропозиції: у базі
    // тип «Курс» і вік 0–18 лише тому, що без них запис не зберегти. Показати
    // їх тут — означало б видати заглушку за факт.
    age_from: stub ? '' : (opp.age_from ?? 0), age_to: stub ? '' : (opp.age_to ?? 18),
    event_start_date: opp.event_start_date || '',
    event_end_date: opp.event_end_date || '', recurrence: opp.recurrence || '',
    results_date: opp.results_date || '',
    apply_url: opp.apply_url || '',
    cost_type: opp.cost_type || '', opportunity_type: stub ? '' : (opp.opportunity_type || 'course'),
    format: opp.format || '', cities: (opp.cities || []).join(', '),
    country: countryFieldValue(opp),
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
  // Країна з селекта — так, як її запише сервер (lib/country-field.js).
  const initialCountry = countryFieldValue(opp);
  const geo = {
    countries: opp.countries || [],
    is_international: opp.is_international || false,
    ...(f.country !== initialCountry ? countryPatch(f.country) : null),
  };
  const missing = missingRequired({
    age_from: f.age_from === '' ? null : Number(f.age_from),
    age_to: f.age_to === '' ? null : Number(f.age_to),
    deadline: f.deadline || null,
    event_start_date: f.event_start_date || null,
    event_end_date: f.event_end_date || null,
    results_date: f.results_date || null,
    recurrence: f.recurrence || null,
    cost_type: f.cost_type || null,
    opportunity_type: f.opportunity_type,
    format: f.format || null,
    // Назва потрібна винятку «вартість уточнюйте в школі» (школа діаспори).
    title: f.title,
    cities: f.cities.split(',').map((s) => s.trim()).filter(Boolean),
    countries: geo.countries,
    is_international: geo.is_international,
  });
  // Нове джерело мусить бути сторінкою, а не формою чи каналом — тоді кнопки
  // гаснуть. Старе (досі допис) лише підсвічуємо: людина вирішує сама.
  const srcChanged = f.source_url.trim() && f.source_url.trim() !== (opp.source_url || '');
  const sourceProblem = srcChanged ? sourceUrlProblem(f.source_url) : null;
  const sourceWarn = !srcChanged && opp.source_url ? sourceUrlProblem(opp.source_url) : null;

  async function save(publish) {
    setBusy(true); setDone('');
    try {
      const payload = { id: opp.id, ...f, publish };
      // Країну шлемо, лише якщо її змінили: «Кілька країн» і ручні позначки
      // конвеєра інакше перезаписались би тим, що показує один селект.
      if (f.country === initialCountry) delete payload.country;
      // Поля, яких у картці немає, не надсилаємо: сервер лишить їх як є.
      if (inline) { delete payload.details; delete payload.featured; }
      const res = await fetch('/api/admin/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        setDone(publish ? '✅ Збережено й опубліковано' : '💾 Збережено (лишилось чернеткою)');
        onDone?.({ published: publish, slug: body.slug || null });
      } else if (res.status === 422) {
        const body = await res.json().catch(() => ({}));
        setDone(body.error === 'bad_source'
          ? `Помилка: ${body.problem}`
          : `Помилка: не вистачає полів — ${(body.missing || []).join(', ')}`);
      } else {
        setDone('Помилка. Перезайди в /admin.');
      }
    } catch {
      setDone('Помилка мережі');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: inline ? 6 : 18 }}>
      <label style={L}>Назва</label>
      <input style={I} value={f.title} onChange={up('title')} />
      {/* Джерело — одразу під назвою і помітним блоком (Марія, 24.09.2026).
          Доти це був дрібний рядок аж під кнопками: щоб звірити запис зі
          сторінкою, треба було спершу прокрутити всю форму. Домен показуємо
          поруч — видно, чи це сайт організатора, чи допис у каналі. */}
      {opp.source_url ? (
        <a
          href={opp.source_url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
            margin: '2px 0 6px', padding: '9px 14px', borderRadius: 10,
            border: '1px solid #b9c9f2', background: '#eef3fe', color: '#1e4fd6',
            fontSize: 14.5, fontWeight: 600, textDecoration: 'none',
          }}
        >
          🔗 Відкрити джерело
          <span style={{ fontWeight: 400, color: '#54617a' }}>{sourceHost(opp.source_url)}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ) : null}
      <label style={L}>Джерело <span style={{ fontWeight: 400, color: '#8a94a6' }}>— сторінка організатора про цю можливість, не допис і не форма</span></label>
      <input style={{ ...I, borderColor: sourceProblem ? '#d92c2c' : I.border }} value={f.source_url} onChange={up('source_url')} placeholder="https://сайт-організатора/сторінка" />
      {sourceProblem ? <p style={{ margin: '5px 0 0', color: '#a11b1b', fontSize: 13.5, fontWeight: 600 }}>{sourceProblem}</p> : null}
      {sourceWarn ? <p style={{ margin: '5px 0 0', color: '#b4530a', fontSize: 13.5, fontWeight: 600 }}>⚠ {sourceWarn}</p> : null}
      <label style={L}>Опис</label>
      <textarea style={{ ...I, resize: 'vertical' }} rows={4} value={f.summary} onChange={up('summary')} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}><label style={L}>Дедлайн подачі</label><input type="date" style={I} value={f.deadline || ''} onChange={up('deadline')} /></div>
        <div style={{ flex: '1 1 150px' }}><label style={L}>Початок події</label><input type="date" style={I} value={f.event_start_date || ''} onChange={up('event_start_date')} /></div>
        <div style={{ flex: '1 1 150px' }}><label style={L}>Завершення події</label><input type="date" style={I} value={f.event_end_date || ''} onChange={up('event_end_date')} /></div>
        <div style={{ flex: '1 1 150px' }}><label style={L}>Результати / розіграш</label><input type="date" style={I} value={f.results_date || ''} onChange={up('results_date')} /></div>
        <div style={{ flex: '1 1 80px' }}><label style={L}>Вік від</label><input type="number" min="0" max="18" style={I} value={f.age_from} onChange={up('age_from')} /></div>
        <div style={{ flex: '1 1 80px' }}><label style={L}>Вік до</label><input type="number" min="0" max="18" style={I} value={f.age_to} onChange={up('age_to')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Тип</label><select style={I} value={f.opportunity_type} onChange={up('opportunity_type')}>{f.opportunity_type === '' ? <option value="">— не визначено —</option> : null}{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div style={{ flex: '1 1 170px' }}><label style={L}>Вартість</label><select style={I} value={f.cost_type} onChange={up('cost_type')}>{COST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* Виплатам формат не потрібен — на сайті його теж не показуємо (lib/labels.js, PAYMENT_TYPES). */}
        {PAYMENT_TYPES.includes(f.opportunity_type) ? null : (
          <div style={{ flex: '1 1 170px' }}><label style={L}>Формат</label><select style={I} value={f.format} onChange={up('format')}>{FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        )}
        <div style={{ flex: '1 1 170px' }}><label style={L}>Періодичність</label><select style={I} value={f.recurrence} onChange={up('recurrence')}>{RECURRENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={L}>Країна</label>
          <select style={I} value={f.country} onChange={up('country')}>
            {countryOptions(opp).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ flex: '2 1 260px' }}>
          <label style={L}>Місто <span style={{ fontWeight: 400, color: '#8a94a6' }}>— кілька через кому; порожньо, якщо онлайн</span></label>
          <input style={I} value={f.cities} onChange={up('cities')} placeholder={f.country && f.country !== 'ua' ? 'Ньюкасл-апон-Тайн' : 'Львів, Київ'} />
        </div>
      </div>
      {/* Іде просто в сніпет Google — за запитами «… ціна» ми показувались і не
          отримували жодного кліку, бо категорії вартості на них не відповідають. */}
      <label style={L}>Вартість словами <span style={{ fontWeight: 400, color: '#8a94a6' }}>— «від 12 000 грн за зміну», «безкоштовно для ВПО»</span></label>
      <input style={I} value={f.price_note} onChange={up('price_note')} placeholder="напр. від 12 000 грн за зміну 14 днів" />
      <label style={L}>Посилання на подачу <span style={{ fontWeight: 400, color: '#8a94a6' }}>— форма або реєстрація, якщо адреса не та сама, що в джерелі</span></label>
      <input style={I} value={f.apply_url} onChange={up('apply_url')} placeholder="https://forms.gle/…" />
      {inline ? null : (<>
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
      </>)}
      {missing.length ? (
        <p style={{ marginTop: 16, marginBottom: 0, padding: '10px 12px', borderRadius: 10, background: '#fdecec', border: '1px solid #f3bcbc', color: '#a11b1b', fontSize: 13.5, fontWeight: 600 }}>
          ⛔ Не можна опублікувати — бракує: {missing.join(', ')}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* У картці черги головна дія — публікація: вона перша й велика. */}
        <button onClick={() => save(true)} disabled={busy || missing.length > 0 || !!sourceProblem} style={{ padding: inline ? '12px 22px' : '10px 18px', fontSize: inline ? 16 : 14, fontWeight: 700, borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', cursor: busy || missing.length || sourceProblem ? 'default' : 'pointer', opacity: busy || missing.length || sourceProblem ? 0.45 : 1 }}>{inline ? '✅ Опублікувати на сайт' : '✅ Зберегти й опублікувати'}</button>
        <button onClick={() => save(false)} disabled={busy || !!sourceProblem} style={{ padding: '10px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: '1px solid #d3dbe9', background: '#fff', color: '#54617a', cursor: 'pointer', opacity: busy || sourceProblem ? 0.6 : 1 }}>{inline ? '💾 Лише зберегти' : '💾 Зберегти чернеткою'}</button>
        {inline
          ? <a href={`/admin/edit/${opp.id}`} style={{ padding: '10px 6px', fontSize: 14, color: '#54617a' }}>Усі поля →</a>
          : <a href="/admin" style={{ padding: '10px 6px', fontSize: 14, color: '#54617a' }}>← До черги</a>}
      </div>
      {done ? <p style={{ marginTop: 12, fontWeight: 600, color: done.startsWith('Помилка') ? '#d92c2c' : '#15803d' }}>{done}</p> : null}
    </div>
  );
}
