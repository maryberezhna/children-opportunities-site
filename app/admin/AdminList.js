'use client';
import { useState, useMemo } from 'react';
// Той самий перелік, що й у конвеєрі: модератор бачить у черзі рівно те
// формулювання, яким нормалізатор позначив запис.
import { missingRequired, missingProof, CRITERIA } from '@/lib/required';
import { splitQueue, DAILY_CAP } from '@/lib/queue-risk';
import { formatDate, formatEventDates } from '@/lib/dates';
import { dateWarnings } from '@/lib/date-warnings';
import ModerationRules from './ModerationRules';
import QuarantineList from './QuarantineList';
import { QUEUE_LAYOUT_CSS } from './queueLayout';

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

const C = {
  border: '#e2e8f2', border2: '#d3dbe9', ink: '#131b28', ink2: '#54617a', ink3: '#8a95a9',
  green: '#15803d', greenBg: '#e7f6ec', greyBg: '#f3f4f6', link: '#1e4fd6',
  typeBg: '#f0e9fd', typeInk: '#4c3d8c', warnBg: '#fef1e2', warnInk: '#b4530a',
};

function MiniCol({ label, item, accent }) {
  const meta = [
    ageLabel(item),
    item.cost_type === 'free' ? 'безкоштовно' : null,
    formatEventDates(item) ? `📅 ${formatEventDates(item)}`
      : item.deadline ? `⏰ до ${formatDate(item.deadline)}`
      : item.recurrence === 'annual' ? '🔁 щорічна'
      : item.recurrence === 'ongoing' ? '♾ постійна'
      : '⚠️ без дати',
  ].filter(Boolean).join(' · ');
  return (
    <div style={{ background: '#fff', border: `1px solid ${accent || C.border2}`, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: accent || C.ink3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{item.title}</div>
      <div style={{ fontSize: 12, color: C.ink2, marginBottom: meta ? 5 : 0 }}>
        {item.source || '—'}{meta ? ` · ${meta}` : ''}
      </div>
      {item.source_url
        ? <a href={item.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.link, fontWeight: 600 }}>🔗 відкрити ↗</a>
        : null}
    </div>
  );
}

function Card({ o, mode, onAction, match, notes = [] }) {
  // Поле — лише для нового коментаря людини. Позначки конвеєра
  // (admin_comment) показуємо окремо й не даємо затерти (22.09.2026).
  const [comment, setComment] = useState('');
  const [openNotes, setOpenNotes] = useState(notes);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // 'approved'|'skipped'|'verified'|'removed'

  async function act(action) {
    setBusy(true);
    const res = await onAction(o.id, action, comment);
    setBusy(false);
    if (!res.ok) {
      alert(res.error === 'note_not_saved'
        ? 'Рішення збережено, а коментар — ні. Натисни ще раз.'
        : 'Не вдалося. Спробуй ще раз або перезайди.');
      return;
    }
    if (action === 'comment') {
      if (res.note) setOpenNotes((list) => [...list, res.note]);
      setComment('');
      return;
    }
    setDone({ approve: 'approved', skip: 'skipped', verify: 'verified', remove: 'removed' }[action]);
  }

  // Дата, тип, вік, вартість і місце-або-формат обовʼязкові перед виходом на
  // сайт (вимога Марії 11.09.2026). Неповний запис показуємо з переліком
  // того, чого бракує, і з прямим лінком, де це дозаповнити.
  const missing = missingRequired(o);
  // Світлофор (22.09.2026): поле є, а цитати зі сторінки на нього немає —
  // запис жовтий. Показуємо лише кандидатам: для тих, що вже на сайті,
  // це окремий список «коли буде час» (рішення 21), не щоденна черга.
  const noProof = mode === 'drafts' ? missingProof(o).filter((l) => !missing.includes(l)) : [];
  const quotes = mode === 'drafts'
    ? CRITERIA.order.filter((k) => o.evidence?.[k]).map((k) => [CRITERIA.required[k].label, o.evidence[k]])
    : [];
  const warnings = dateWarnings(o);
  const when = formatEventDates(o);
  const gone = done === 'approved' || done === 'skipped' || done === 'removed';
  const bg = done === 'approved' || done === 'verified' ? C.greenBg
    : done === 'skipped' || done === 'removed' ? C.greyBg : '#fff';

  return (
    <article style={{
      border: `1px solid ${C.border}`, borderRadius: 14, padding: '15px 17px', background: bg,
      boxShadow: '0 1px 2px rgba(20,30,60,.05)', transition: 'background .2s, opacity .3s',
      opacity: gone ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 14.5, color: C.ink2, marginBottom: 7, alignItems: 'center' }}>
        <span style={{ background: C.typeBg, color: C.typeInk, padding: '2px 10px', borderRadius: 20 }}>
          {TYPE_LABELS[o.opportunity_type] || o.opportunity_type}
        </span>
        {/* Вік без цитати зі сторінки — не факт, а здогад машини, і читався
            він у цьому рядку так само впевнено, як прочитаний у тексті
            (Марія, 23.09.2026). Тепер на його місці стоїть правда. */}
        {mode === 'drafts' && !o.evidence?.age
          ? <span style={{ color: C.ink3 }}>вік у джерелі не названий</span>
          : ageLabel(o) ? <span>{ageLabel(o)}</span> : null}
        {o.cost_type === 'free' ? <span style={{ color: C.green }}>безкоштовно</span> : null}
        {/* Коли відбувається і до коли подати — два різні факти й два підписи.
            Раніше тут стояв голий «⏰ 2026-10-27»: так перший день події
            читався як дедлайн, а дат проведення картка не показувала взагалі. */}
        {when ? <span>📅 коли: {when}</span> : null}
        {o.deadline ? <span>⏰ подача до {formatDate(o.deadline)}</span> : null}
        {mode === 'active' && o.verified_at
          ? <span style={{ color: C.green, fontWeight: 600 }}>✓ перевірено</span> : null}
      </div>

      {/* Один блок, а не два (Марія, 22.09.2026: «давай шось одне»). Обидві
          причини кажуть читачеві те саме — «на сайт не піде» — тож і рамка
          одна, з двома рядками. Червона, коли поля бракує зовсім; жовта,
          коли поле є, а цитати на нього немає. */}
      {missing.length || noProof.length ? (
        <div style={{
          background: missing.length ? '#fdecec' : C.warnBg,
          border: `1px solid ${missing.length ? '#f3bcbc' : '#f3d3ad'}`,
          borderRadius: 10, padding: '9px 11px', marginBottom: 10,
        }}>
          <div style={{ color: missing.length ? '#a11b1b' : C.warnInk, fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>
            {missing.length ? '⛔' : '🟡'} {mode === 'drafts' ? 'Не піде на сайт' : 'Уже на сайті, але неповна'}
          </div>
          {missing.length ? (
            <div style={{ fontSize: 14.5, color: C.ink, marginBottom: noProof.length ? 3 : 5 }}>
              Бракує: {missing.join(', ')}
            </div>
          ) : null}
          {noProof.length ? (
            <div style={{ fontSize: 14.5, color: C.ink, marginBottom: 5 }}>
              Без цитати зі сторінки: {noProof.join(', ')} — поле заповнене, але машина
              не знайшла на нього дослівної фрази.
            </div>
          ) : null}
          <a href={`/admin/edit/${o.id}`} style={{ fontSize: 14.5, color: C.link, fontWeight: 600 }}>
            перевірити по джерелу →
          </a>
        </div>
      ) : null}

      {quotes.length ? (
        <div style={{ border: `1px solid ${C.border2}`, borderRadius: 10, padding: '9px 11px', marginBottom: 10, fontSize: 14, color: C.ink2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: C.ink3, marginBottom: 4 }}>Цитати зі сторінки</div>
          {quotes.map(([label, q]) => (
            <div key={label} style={{ marginBottom: 3 }}><b style={{ color: C.ink }}>{label}:</b> «{q}»</div>
          ))}
        </div>
      ) : null}

      {warnings.length ? (
        <div style={{ background: C.warnBg, border: '1px solid #f3d3ad', borderRadius: 10, padding: '9px 11px', marginBottom: 10 }}>
          {warnings.map((w) => (
            <div key={w} style={{ color: C.warnInk, fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>⚠ {w}</div>
          ))}
          <a href={`/admin/edit/${o.id}`} style={{ fontSize: 14.5, color: C.link, fontWeight: 600 }}>виправити →</a>
        </div>
      ) : null}

      {o.dup_of ? (
        <div style={{ background: C.warnBg, borderRadius: 10, padding: '9px 11px', marginBottom: 10, border: '1px solid #f3d3ad' }}>
          <div style={{ color: C.warnInk, fontSize: 14.5, fontWeight: 600, marginBottom: 7 }}>
            ⚠ Можливий дублікат{o.dup_score ? ` (~${Math.round(o.dup_score * 100)}%)` : ''} — порівняй обидва:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
            <MiniCol label="Ця" item={o} accent="#e0a763" />
            {match
              ? <MiniCol label="Схожа (вже в базі)" item={match} />
              : <div style={{ fontSize: 12.5, color: C.ink2, alignSelf: 'center', padding: '0 4px' }}>
                  <a href={`/o/${o.dup_of}`} target="_blank" rel="noreferrer" style={{ color: C.warnInk, fontWeight: 600 }}>переглянути схожу ↗</a>
                </div>}
          </div>
        </div>
      ) : null}

      <h3 style={{ margin: '0 0 7px', fontSize: 18, lineHeight: 1.3 }}>
        <a href={`/admin/edit/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{o.title}</a>
      </h3>
      {o.summary ? <p style={{ margin: '0 0 10px', fontSize: 15.5, color: C.ink2, lineHeight: 1.55 }}>{o.summary}</p> : null}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14.5, color: C.ink2, marginBottom: 11, flexWrap: 'wrap' }}>
        {o.source ? <span>{o.source}</span> : null}
        {o.source_url
          ? <a href={o.source_url} target="_blank" rel="noreferrer" style={{ color: C.link, fontWeight: 600 }}>🔗 відкрити джерело ↗</a>
          : <span style={{ color: C.warnInk }}>⚠ немає посилання</span>}
      </div>

      {done ? (
        <div style={{ fontWeight: 600, fontSize: 15, color: gone || done === 'skipped' ? C.ink2 : C.green }}>
          {{ approved: '✅ Додано на сайт', skipped: '❌ Пропущено', verified: '✓ Перевірено',
             removed: '🗑 Прибрано' }[done]}
        </div>
      ) : (
        <>
          {o.admin_comment ? (
            <p style={{ margin: '0 0 10px', fontSize: 14, color: C.ink2, lineHeight: 1.5 }}>
              <b style={{ fontWeight: 600 }}>Позначки конвеєра:</b> {o.admin_comment}
            </p>
          ) : null}
          {openNotes.length ? (
            <div style={{ background: '#eef4ff', border: '1px solid #cddcfb', borderRadius: 10, padding: '8px 11px', marginBottom: 9 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.link, marginBottom: 4 }}>
                💬 Коментар чекає на обробку
              </div>
              {openNotes.map((n) => (
                <div key={n.id} style={{ fontSize: 15, color: C.ink, lineHeight: 1.5 }}>
                  <span style={{ color: C.ink2 }}>{formatDate(String(n.created_at).slice(0, 10))}:</span> {n.body}
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Коментар: питання, сумнів або причина рішення…"
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 15,
              padding: '9px 12px', borderRadius: 9, border: `1px solid ${C.border2}`, resize: 'vertical', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {mode === 'drafts' ? (
              <>
                <Btn onClick={() => act('approve')} busy={busy || missing.length > 0} bg={C.green} fg="#fff">✅ Додати на сайт</Btn>
                <Btn onClick={() => act('skip')} busy={busy} border>❌ Пропустити</Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => act('verify')} busy={busy} bg={C.green} fg="#fff">🔗 Посилання робоче</Btn>
                <Btn onClick={() => act('remove')} busy={busy} bg="#d92c2c" fg="#fff">🗑 Прибрати</Btn>
              </>
            )}
            {/* Редагування жило лише під назвою картки, і знайти його було
                неможливо (22.09.2026). */}
            <a href={`/admin/edit/${o.id}`} style={{ ...btnStyle(false, { border: true }), textDecoration: 'none' }}>
              ✏️ Редагувати
            </a>
            {/* Питання без рішення: запис лишається в черзі, коментар — у
                moderation_notes відкритим, доки його не оброблять; його
                показує ранкове зведення (Марія, 22.09.2026). */}
            <Btn onClick={() => act('comment')} busy={busy || !comment.trim()} border>💬 Залишити коментар</Btn>
          </div>
        </>
      )}
    </article>
  );
}

const btnStyle = (busy, { bg, fg, border }) => ({
  padding: '10px 17px', fontSize: 15, fontWeight: 600, borderRadius: 9, cursor: busy ? 'default' : 'pointer',
  fontFamily: 'inherit', opacity: busy ? 0.55 : 1,
  background: border ? '#fff' : bg, color: border ? C.ink2 : fg,
  border: border ? `1px solid ${C.border2}` : 'none',
});

function Btn({ children, onClick, busy, bg, fg, border }) {
  return (
    <button onClick={onClick} disabled={busy} style={btnStyle(busy, { bg, fg, border })}>
      {children}
    </button>
  );
}

// Вкладки — кроки одного шляху, у тому порядку, у якому ним іде запис
// (Марія, 22.09.2026). «Неповні» стоять окремо: це не крок, а підмножина
// того, що вже на сайті.
const TABS = ['raw', 'drafts', 'waiting', 'active', 'incomplete'];

export default function AdminList({
  drafts, actives, raw = [], matches = {}, notes = {}, initialTab, children,
}) {
  // Стару адресу /admin/quarantine перенаправлено на /admin?tab=raw, тож
  // закладки й посилання з листів відкривають саме ту вкладку.
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'drafts');
  const [search, setSearch] = useState('');

  async function onAction(id, action, comment) {
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, comment }),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok && json.ok !== false, error: json.error, note: json.note };
    } catch { return { ok: false }; }
  }

  const activeFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? actives.filter((o) => (o.title || '').toLowerCase().includes(q) || (o.source || '').toLowerCase().includes(q))
      : actives;
    // Possible duplicates first, so they're easy to review.
    return [...base].sort((a, b) => (b.dup_of ? 1 : 0) - (a.dup_of ? 1 : 0));
  }, [actives, search]);

  const flaggedCount = useMemo(() => actives.filter((o) => o.dup_of).length, [actives]);

  // Черга людини — за ризиком, а не за сумнівом машини (Марія, 22.09.2026).
  // Вразлива тема першою, далі суперечність, межа «для дітей», рідкісне
  // міжнародне. Усе, чому просто бракує поля чи цитати, чекає машину й у
  // щоденній роботі не показується.
  const { forHuman, waiting } = useMemo(() => splitQueue(drafts), [drafts]);

  // Окрема вкладка для того, що вже на сайті, але без обовʼязкового мінімуму.
  // Ворота конвеєра тримають нові записи, а ці лишились з часу, коли правила
  // ще не було, — і знайти їх інакше нічим (11.09.2026).
  const incomplete = useMemo(
    () => actives.filter((o) => missingRequired(o).length > 0),
    [actives],
  );

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)}
      style={{
        padding: '10px 18px', fontSize: 16, fontWeight: 600, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${tab === id ? C.ink : C.border2}`,
        background: tab === id ? C.ink : '#fff', color: tab === id ? '#fff' : C.ink2,
      }}>
      {label}
    </button>
  );

  return (
    <div className="adm-queue">
      <style dangerouslySetInnerHTML={{ __html: QUEUE_LAYOUT_CSS }} />
      <div className="adm-queue-head">{children}</div>
      <aside className="adm-queue-rules" aria-label="Правила модерації">
        <ModerationRules tab={tab === 'raw' ? 'quarantine' : tab === 'waiting' ? 'drafts' : tab} />
      </aside>
      <div className="adm-queue-body" style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', gap: 9, marginBottom: 18, flexWrap: 'wrap' }}>
          {tabBtn('raw', `1 · Знахідки (${raw.length})`)}
          {tabBtn('drafts', `2 · До рішення (${forHuman.length})`)}
          {tabBtn('waiting', `⏳ Чекає машину (${waiting.length})`)}
          {tabBtn('active', `3 · На сайті (${actives.length})`)}
          {tabBtn('incomplete', `⛔ Неповні (${incomplete.length})`)}
        </div>

        {tab === 'raw' ? (
          <>
            <p style={{ color: C.ink2, fontSize: 14.5, margin: '0 0 12px', lineHeight: 1.5 }}>
              Сирий текст зі скраперів, де модель не певна, що це можливість для дитини.
              Одне питання: <b>це для дітей?</b> «Завести можливість» віддає текст у нічний
              розбір — модель заповнить поля, і запис прийде на вкладку «Кандидати».
              «Відхилити» — назавжди.
            </p>
            <QuarantineList rows={raw} />
          </>
        ) : tab === 'incomplete' ? (
          incomplete.length === 0 ? (
            <p style={{ color: C.ink2, fontSize: 16 }}>Усі активні записи мають дату, тип, вік, вартість і місце. </p>
          ) : (
            <>
              <p style={{ color: C.ink2, fontSize: 14.5, margin: '0 0 12px' }}>
                Ці записи вже на сайті, але без обовʼязкового мінімуму. Нові такими
                не стають — ворота конвеєра їх не пускають.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {incomplete.slice(0, 150).map((o) => <Card key={o.id} o={o} mode="active" onAction={onAction} match={matches[o.dup_of]} notes={notes[o.id]} />)}
              </div>
            </>
          )
        ) : tab === 'waiting' ? (
          waiting.length === 0 ? (
            <p style={{ color: C.ink2, fontSize: 16 }}>Нічого не чекає машину.</p>
          ) : (
            <>
              <p style={{ color: C.ink2, fontSize: 14.5, margin: '0 0 12px', lineHeight: 1.5 }}>
                Ці записи <b>не на сайті й не в щоденній черзі</b>: їм бракує поля або
                цитати зі сторінки. Машина щоночі перечитує до 20 таких сторінок — і коли
                на сторінці зʼявиться потрібна фраза, запис вийде на сайт сам. Заглядай
                сюди, коли є час.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {waiting.slice(0, 150).map(({ row, wait }) => (
                  <div key={row.id}>
                    <div style={{ fontSize: 13, color: C.ink3, marginBottom: 3 }}>⏳ {wait}</div>
                    <Card o={row} mode="drafts" onAction={onAction} match={matches[row.dup_of]} notes={notes[row.id]} />
                  </div>
                ))}
              </div>
              {waiting.length > 150
                ? <p style={{ color: C.ink2, fontSize: 14.5, marginTop: 14 }}>Показано перші 150 зі {waiting.length}.</p>
                : null}
            </>
          )
        ) : tab === 'drafts' ? (
          forHuman.length === 0 ? (
            <p style={{ color: C.ink2, fontSize: 16 }}>
              Нічого не чекає рішення. Нові кандидати прийдуть після нічного прогону.
            </p>
          ) : (
            <>
              <p style={{ color: C.ink2, fontSize: 14.5, margin: '0 0 12px', lineHeight: 1.5 }}>
                За ризиком: спершу вразливі теми, далі суперечності в записі, межа «для дітей»
                і рідкісне міжнародне. {forHuman.length > DAILY_CAP
                  ? <>Показано перші {DAILY_CAP} — решта {forHuman.length - DAILY_CAP} нікуди не дінеться.</>
                  : null}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {forHuman.slice(0, DAILY_CAP).map(({ row, risk }) => (
                  <div key={row.id}>
                    {risk ? <div style={{ fontSize: 13, color: C.warnInk, fontWeight: 600, marginBottom: 3 }}>⚠ {risk.label}</div> : null}
                    <Card o={row} mode="drafts" onAction={onAction} match={matches[row.dup_of]} notes={notes[row.id]} />
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          <>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за назвою або джерелом…"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '11px 14px',
                borderRadius: 10, border: `1px solid ${C.border2}`, marginBottom: 14, fontFamily: 'inherit' }}
            />
            <p style={{ color: C.ink2, fontSize: 14.5, margin: '0 0 12px' }}>
              Показано {activeFiltered.length} із {actives.length}.
              {flaggedCount > 0 ? <> <b style={{ color: C.warnInk }}>⚠ {flaggedCount} можливих дублікатів</b> — вгорі списку.</> : null}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {activeFiltered.slice(0, 150).map((o) => <Card key={o.id} o={o} mode="active" onAction={onAction} match={matches[o.dup_of]} notes={notes[o.id]} />)}
            </div>
            {activeFiltered.length > 150
              ? <p style={{ color: C.ink2, fontSize: 14.5, marginTop: 14 }}>Показано перші 150 — звузь пошук, щоб побачити решту.</p>
              : null}
          </>
        )}
      </div>
    </div>
  );
}
