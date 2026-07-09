'use client';
import { useState, useMemo } from 'react';

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
    item.deadline ? `⏰ ${item.deadline}` : null,
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

function Card({ o, mode, onAction, match }) {
  const [comment, setComment] = useState(o.admin_comment || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // 'approved'|'skipped'|'verified'|'removed'|'commented'

  async function act(action) {
    setBusy(true);
    const ok = await onAction(o.id, action, comment);
    setBusy(false);
    if (!ok) { alert('Не вдалося. Спробуй ще раз або перезайди.'); return; }
    setDone(action === 'approve' ? 'approved' : action === 'skip' ? 'skipped'
      : action === 'verify' ? 'verified' : action === 'remove' ? 'removed' : 'commented');
  }

  const gone = done === 'approved' || done === 'skipped' || done === 'removed';
  const bg = done === 'approved' || done === 'verified' ? C.greenBg
    : done === 'skipped' || done === 'removed' ? C.greyBg : '#fff';

  return (
    <article style={{
      border: `1px solid ${C.border}`, borderRadius: 14, padding: '15px 17px', background: bg,
      boxShadow: '0 1px 2px rgba(20,30,60,.05)', transition: 'background .2s, opacity .3s',
      opacity: gone ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: C.ink2, marginBottom: 6, alignItems: 'center' }}>
        <span style={{ background: C.typeBg, color: C.typeInk, padding: '2px 10px', borderRadius: 20 }}>
          {TYPE_LABELS[o.opportunity_type] || o.opportunity_type}
        </span>
        {ageLabel(o) ? <span>{ageLabel(o)}</span> : null}
        {o.cost_type === 'free' ? <span style={{ color: C.green }}>безкоштовно</span> : null}
        {o.deadline ? <span>⏰ {o.deadline}</span> : null}
        {mode === 'active' && o.verified_at
          ? <span style={{ color: C.green, fontWeight: 600 }}>✓ перевірено</span> : null}
      </div>

      {o.dup_of ? (
        <div style={{ background: C.warnBg, borderRadius: 10, padding: '9px 11px', marginBottom: 10, border: '1px solid #f3d3ad' }}>
          <div style={{ color: C.warnInk, fontSize: 13, fontWeight: 600, marginBottom: 7 }}>
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

      <h3 style={{ margin: '0 0 6px', fontSize: 16, lineHeight: 1.3 }}>{o.title}</h3>
      {o.summary ? <p style={{ margin: '0 0 9px', fontSize: 14, color: C.ink2, lineHeight: 1.5 }}>{o.summary}</p> : null}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, color: C.ink2, marginBottom: 11, flexWrap: 'wrap' }}>
        {o.source ? <span>{o.source}</span> : null}
        {o.source_url
          ? <a href={o.source_url} target="_blank" rel="noreferrer" style={{ color: C.link, fontWeight: 600 }}>🔗 відкрити джерело ↗</a>
          : <span style={{ color: C.warnInk }}>⚠ немає посилання</span>}
      </div>

      {done ? (
        <div style={{ fontWeight: 600, color: gone || done === 'skipped' ? C.ink3 : C.green }}>
          {{ approved: '✅ Додано на сайт', skipped: '❌ Пропущено', verified: '✓ Перевірено',
             removed: '🗑 Прибрано', commented: '💬 Коментар збережено' }[done]}
        </div>
      ) : (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Коментар (збережеться в базі + Notion)…"
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 13.5,
              padding: '8px 11px', borderRadius: 9, border: `1px solid ${C.border2}`, resize: 'vertical', marginBottom: 9 }}
          />
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {mode === 'drafts' ? (
              <>
                <Btn onClick={() => act('approve')} busy={busy} bg={C.green} fg="#fff">✅ Додати на сайт</Btn>
                <Btn onClick={() => act('skip')} busy={busy} border>❌ Пропустити</Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => act('verify')} busy={busy} bg={C.green} fg="#fff">🔗 Посилання робоче</Btn>
                <Btn onClick={() => act('remove')} busy={busy} bg="#d92c2c" fg="#fff">🗑 Прибрати</Btn>
              </>
            )}
            <Btn onClick={() => act('comment')} busy={busy || !comment.trim()} border>💬 Лише коментар</Btn>
          </div>
        </>
      )}
    </article>
  );
}

function Btn({ children, onClick, busy, bg, fg, border }) {
  return (
    <button onClick={onClick} disabled={busy}
      style={{
        padding: '8px 15px', fontSize: 13.5, fontWeight: 600, borderRadius: 9, cursor: busy ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: busy ? 0.55 : 1,
        background: border ? '#fff' : bg, color: border ? C.ink2 : fg,
        border: border ? `1px solid ${C.border2}` : 'none',
      }}>
      {children}
    </button>
  );
}

export default function AdminList({ drafts, actives, matches = {} }) {
  const [tab, setTab] = useState('drafts');
  const [search, setSearch] = useState('');

  async function onAction(id, action, comment) {
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, comment }),
      });
      return res.ok;
    } catch { return false; }
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

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)}
      style={{
        padding: '9px 16px', fontSize: 14.5, fontWeight: 600, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${tab === id ? C.ink : C.border2}`,
        background: tab === id ? C.ink : '#fff', color: tab === id ? '#fff' : C.ink2,
      }}>
      {label}
    </button>
  );

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', gap: 9, marginBottom: 18 }}>
        {tabBtn('drafts', `🆕 Кандидати (${drafts.length})`)}
        {tabBtn('active', `✅ Активні (${actives.length})`)}
      </div>

      {tab === 'drafts' ? (
        drafts.length === 0 ? (
          <p style={{ color: C.ink2 }}>Немає кандидатів. Агент додасть нові після наступного щоденного прогону.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {drafts.map((o) => <Card key={o.id} o={o} mode="drafts" onAction={onAction} match={matches[o.dup_of]} />)}
          </div>
        )
      ) : (
        <>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за назвою або джерелом…"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '10px 14px',
              borderRadius: 10, border: `1px solid ${C.border2}`, marginBottom: 14, fontFamily: 'inherit' }}
          />
          <p style={{ color: C.ink3, fontSize: 13, margin: '0 0 12px' }}>
            Показано {activeFiltered.length} із {actives.length}.
            {flaggedCount > 0 ? <> <b style={{ color: C.warnInk }}>⚠ {flaggedCount} можливих дублікатів</b> — вгорі списку.</> : null}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {activeFiltered.slice(0, 150).map((o) => <Card key={o.id} o={o} mode="active" onAction={onAction} match={matches[o.dup_of]} />)}
          </div>
          {activeFiltered.length > 150
            ? <p style={{ color: C.ink3, fontSize: 13, marginTop: 14 }}>Показано перші 150 — звузь пошук, щоб побачити решту.</p>
            : null}
        </>
      )}
    </div>
  );
}
