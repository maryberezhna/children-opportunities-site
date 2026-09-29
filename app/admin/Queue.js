'use client';
import { useState } from 'react';
import { decisionReason, deadlineNote } from '@/lib/decision-reason';
import { formatDate, formatEventDates } from '@/lib/dates';
import { TYPE_LABELS } from '@/lib/labels';
import { REJECT_REASONS, rejectReason } from '@/lib/reject-reasons';
import { sourceUrlProblem } from '@/lib/source-link';
import { ADMIN_CARD_CSS } from './queueLayout';
import EditForm from './edit/[id]/EditForm';

// Кнопки черги — три кольори, як їх назвала Марія 28.09.2026: зелена
// «відредагувати й опублікувати», жовта «коментар», і «не підходить».
const CSS = `${ADMIN_CARD_CSS}
.q-btn-go { background: #15803d; border-color: #15803d; color: #fff; }
.q-btn-go:hover { background: #126b33; }
.q-btn-note { background: #fbbf24; border-color: #f0ad0e; color: #131b28; }
.q-btn-note:hover { background: #f5b301; }
.q-btn-no { color: #a11b1b; border-color: #f3bcbc; }
.q-btn-no:hover { background: #fdecec; }
.q-panel { border-top: 1px solid #e2e8f2; margin-top: 14px; padding-top: 12px; }
.q-panel select { width: 100%; box-sizing: border-box; font: inherit; font-size: 15px;
  padding: 9px 12px; border-radius: 9px; border: 1px solid #d3dbe9; margin: 0 0 10px; background: #fff; }
.q-hint { font-size: 14px; color: #54617a; margin: 0 0 8px; line-height: 1.5; }
.q-host { color: #54617a; }
.adm-card.ok { background: #e7f6ec; }
.adm-card.off { background: #f3f4f6; opacity: .7; }
`;

const WHY_ICON = { stop: '⛔', check: '⚠️', ready: '✅' };

function ageLabel(o) {
  if (o.age_from == null && o.age_to == null) return '';
  if (o.age_from === 0 && o.age_to >= 17) return '0–18 р.';
  if (o.age_from === o.age_to) return `${o.age_from} р.`;
  return `${o.age_from}–${o.age_to} р.`;
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function post(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.ok !== false, ...json };
  } catch { return { ok: false }; }
}

function Notes({ list }) {
  if (!list.length) return null;
  const open = list.filter((n) => !n.resolved_at && !n.attempted_at);
  const stuck = list.filter((n) => !n.resolved_at && n.attempted_at);
  const done = list.filter((n) => n.resolved_at);
  return (
    <>
      {open.length ? (
        <div className="adm-note info">
          <div className="h">💬 Коментар — буде виконано протягом години</div>
          {open.map((n) => <div key={n.id}>«{n.body}»</div>)}
        </div>
      ) : null}
      {stuck.length ? (
        <div className="adm-note warn">
          <div className="h">⚠️ Коментар виконано не повністю</div>
          {stuck.map((n) => (
            <div key={n.id} style={{ marginBottom: 4 }}>
              «{n.body}»{n.resolution ? <><br /><span style={{ color: '#54617a' }}>{n.resolution}</span></> : null}
            </div>
          ))}
        </div>
      ) : null}
      {done.length ? (
        <div className="adm-note info" style={{ background: '#e7f6ec', borderColor: '#b7e2c4' }}>
          <div className="h">✅ Коментар виконано</div>
          {done.map((n) => (
            <div key={n.id} style={{ marginBottom: 4 }}>
              «{n.body}» → {n.resolution || 'виконано'}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Card({ o, notes: initialNotes = [], today }) {
  const [panel, setPanel] = useState(null); // 'edit' | 'note' | 'reject'
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { kind: 'published', slug } | { kind: 'rejected', label }

  const why = decisionReason(o);
  const when = formatEventDates(o);
  const dl = deadlineNote(o, today);
  const srcProblem = o.source_url ? sourceUrlProblem(o.source_url) : 'немає посилання';

  async function sendNote() {
    setBusy(true); setError('');
    const r = await post('/api/admin/review', { id: o.id, action: 'comment', comment: text });
    setBusy(false);
    if (!r.ok) { setError('Коментар не зберігся. Спробуй ще раз.'); return; }
    if (r.note) setNotes((list) => [...list, r.note]);
    setText(''); setPanel(null);
  }

  async function reject() {
    setBusy(true); setError('');
    const r = await post('/api/admin/review', { id: o.id, action: 'reject', reason, comment: text });
    setBusy(false);
    if (!r.ok) {
      setError(r.error === 'reason_text_required' ? 'Для «Інше» напиши причину одним реченням.'
        : r.error === 'bad_reason' ? 'Обери причину зі списку.'
        : 'Не вдалося. Спробуй ще раз або перезайди.');
      return;
    }
    setDone({ kind: 'rejected', label: rejectReason(reason)?.label || '' });
    setPanel(null);
  }

  if (done) {
    return (
      <article className={`adm-card ${done.kind === 'published' ? 'ok' : 'off'}`}>
        <h3 className="adm-title">{o.title}</h3>
        <p className="adm-done">
          {done.kind === 'published'
            ? <>✅ Опубліковано{done.slug ? <> — <a href={`/o/${done.slug}`} target="_blank" rel="noreferrer" style={{ color: '#1e4fd6' }}>подивитись на сайті ↗</a></> : null}</>
            : <>Не підходить: {done.label}</>}
        </p>
      </article>
    );
  }

  const selected = rejectReason(reason);

  return (
    <article className="adm-card">
      {why ? (
        <p className={`adm-why ${why.tone}`}>
          <span aria-hidden="true">{WHY_ICON[why.tone]}</span>
          <span>{why.text}{why.gap ? <span className="gap">{why.gap}</span> : null}</span>
        </p>
      ) : null}

      <h3 className="adm-title">{o.title}</h3>

      <p className="adm-facts">
        <span className="chip">{TYPE_LABELS[o.opportunity_type] || o.opportunity_type || 'тип не вказано'}</span>
        {ageLabel(o) ? <span>{ageLabel(o)}</span> : <span className="soft">вік не вказано</span>}
        {o.cost_type ? <span className={o.cost_type === 'free' ? 'good' : ''}>{o.cost_type === 'free' ? 'безкоштовно' : o.cost_type === 'ask_school' ? 'уточнюйте в школі' : 'платно'}</span> : null}
        {when ? <span>коли: {when}</span> : null}
        {dl ? <span className={dl.past || dl.days <= 7 ? 'hot' : ''}>подача {dl.text}</span> : null}
        {!when && !dl && o.recurrence === 'annual' ? <span className="soft">щорічна</span> : null}
        {!when && !dl && o.recurrence === 'ongoing' ? <span className="soft">постійна</span> : null}
      </p>

      {o.summary ? <p className="adm-sum">{o.summary}</p> : null}

      <p className="adm-src">
        {o.source_url
          ? <a href={o.source_url} target="_blank" rel="noreferrer">🔗 джерело <span className="q-host">{host(o.source_url)}</span> ↗</a>
          : null}
        {srcProblem ? <span style={{ color: '#b4530a', fontWeight: 600 }}>⚠ {srcProblem}</span> : null}
        {o.dup_of ? <a href={`/o/${o.dup_of}`} target="_blank" rel="noreferrer">схожий запис на сайті ↗</a> : null}
      </p>

      <Notes list={notes} />

      {panel === null ? (
        <div className="adm-acts">
          <button type="button" className="adm-btn q-btn-go" onClick={() => setPanel('edit')}>✏️ Відредагувати й опублікувати</button>
          <button type="button" className="adm-btn q-btn-note" onClick={() => { setText(''); setPanel('note'); }}>💬 Коментар</button>
          <button type="button" className="adm-btn q-btn-no" onClick={() => { setText(''); setReason(''); setPanel('reject'); }}>Не підходить</button>
        </div>
      ) : null}

      {panel === 'edit' ? (
        <div className="q-panel">
          <EditForm
            opp={o}
            stub={!!o.stub}
            inline
            onDone={(r) => { if (r.published) setDone({ kind: 'published', slug: r.slug || o.slug }); }}
          />
          <p style={{ marginTop: 10 }}>
            <button type="button" className="adm-btn" onClick={() => setPanel(null)}>Згорнути</button>
          </p>
        </div>
      ) : null}

      {panel === 'note' ? (
        <div className="q-panel">
          <p className="q-hint">
            Напиши, що зробити, — буде виконано протягом години, і картка повернеться сюди.
            Наприклад: «вік 12–17», «дедлайн 15 жовтня», «джерело https://…»,
            «вік 12–17 і опублікуй», «не підходить — це для дорослих».
          </p>
          <textarea className="adm-ta" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          <div className="adm-acts">
            <button type="button" className="adm-btn q-btn-note" onClick={sendNote} disabled={busy || !text.trim()}>Надіслати</button>
            <button type="button" className="adm-btn" onClick={() => setPanel(null)} disabled={busy}>Скасувати</button>
          </div>
        </div>
      ) : null}

      {panel === 'reject' ? (
        <div className="q-panel">
          <p className="q-hint">Чому не підходить? Запис зникне з черги назавжди, а пошук перестане приносити схоже.</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
            <option value="">— обери причину —</option>
            {REJECT_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <textarea
            className="adm-ta" rows={2} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={selected?.needs_text ? 'Чому саме — одним реченням (обовʼязково)' : 'Пояснення, якщо хочеш (необовʼязково)'}
          />
          <div className="adm-acts">
            <button
              type="button" className="adm-btn del" onClick={reject}
              disabled={busy || !selected || (selected.needs_text && !text.trim())}
            >Відхилити</button>
            <button type="button" className="adm-btn" onClick={() => setPanel(null)} disabled={busy}>Скасувати</button>
          </div>
        </div>
      ) : null}

      {error ? <p style={{ color: '#a11b1b', fontWeight: 600, margin: '10px 0 0' }}>{error}</p> : null}
      <p style={{ margin: '10px 0 0', fontSize: 13, color: '#8a94a6' }}>
        у черзі з {formatDate(String(o.created_at || '').slice(0, 10))}
      </p>
    </article>
  );
}

export default function Queue({ drafts, notes = {}, today }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {drafts.length === 0
        ? <p style={{ fontSize: 17 }}>Черга порожня — усе розібрано. Нові кандидати прийдуть після нічного прогону.</p>
        : drafts.map((o) => <Card key={o.id} o={o} notes={notes[o.id] || []} today={today} />)}
    </>
  );
}
