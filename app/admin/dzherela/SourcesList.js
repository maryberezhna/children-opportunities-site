'use client';
import { useState } from 'react';
import { formatDate } from '@/lib/dates';

// Вигляд — той самий, що в черзі: картка, причина згори, дії внизу. Нічого
// нового людині вчити не треба.
const CSS = `
.src-h { font-size: 19px; margin: 32px 0 4px; }
.src-sub { color: #54617a; font-size: 15px; margin: 0 0 14px; line-height: 1.5; }
.src-card { border: 1px solid #e2e8f2; border-radius: 14px; background: #fff;
  padding: 14px 16px; color: #131b28; font-size: 15px; line-height: 1.5; }
.src-card + .src-card { margin-top: 10px; }
.src-card.gone { background: #f3f4f6; opacity: .65; }
.src-name { font-size: 17px; font-weight: 700; margin: 0 0 4px; }
.src-name a { color: #1e4fd6; }
.src-facts { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 0 0 8px;
  font-size: 14px; color: #54617a; }
.src-facts .chip { background: #f1f4f9; border-radius: 20px; padding: 1px 9px; }
.src-facts .warn { color: #b4530a; font-weight: 600; }
.src-facts .bad { color: #a11b1b; font-weight: 600; }
.src-why { margin: 0 0 10px; font-size: 14px; color: #54617a; }
.src-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.src-btn { font: inherit; font-size: 14px; padding: 7px 13px; border-radius: 9px;
  border: 1px solid #d3dbe9; background: #fff; color: #131b28; cursor: pointer; }
.src-btn:hover { border-color: #8a94a6; }
.src-btn.take { background: #15803d; border-color: #15803d; color: #fff; }
.src-btn.take:hover { background: #126b33; }
.src-btn.no { color: #a11b1b; border-color: #f3bcbc; }
.src-btn.no:hover { background: #fdecec; }
.src-btn[disabled] { opacity: .5; cursor: default; }
.src-row { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: baseline;
  padding: 10px 14px; border: 1px solid #e2e8f2; border-radius: 12px; background: #fff; }
.src-row + .src-row { margin-top: 8px; }
.src-row.off { background: #f3f4f6; }
.src-row .nm { font-weight: 600; flex: 1; min-width: 220px; }
.src-row .meta { font-size: 13px; color: #6b6b6b; }
.src-done { margin: 0; font-weight: 700; }
.src-err { color: #a11b1b; font-weight: 600; margin: 8px 0 0; }
`;

const KIND = {
  government: 'держава', foundation: 'фонд', community: 'спільнота',
  international_org: 'міжнародна організація', school: 'школа', media: 'медіа',
};

async function post(body) {
  try {
    const res = await fetch('/api/admin/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.ok !== false, ...json };
  } catch { return { ok: false }; }
}

function Candidate({ c }) {
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(action) {
    setBusy(true); setError('');
    const r = await post({ kind: 'candidate', id: c.id, action });
    setBusy(false);
    if (!r.ok) { setError('Не зберіглося. Спробуй ще раз або перезайди.'); return; }
    setDone(action);
  }

  if (done) {
    return (
      <article className={`src-card ${done === 'take' ? '' : 'gone'}`}>
        <p className="src-done">
          {c.name || c.domain} — {done === 'take'
            ? '✅ беремо. Сайт чекає на зчитувач.'
            : 'не беремо.'}
        </p>
      </article>
    );
  }

  const link = c.url || `https://${c.domain}`;
  return (
    <article className="src-card">
      <p className="src-name">
        <a href={link} target="_blank" rel="noreferrer">{c.name || c.domain} ↗</a>
      </p>
      <p className="src-facts">
        <span className="chip">{c.domain}</span>
        {c.kind ? <span>{KIND[c.kind] || c.kind}</span> : null}
        {c.language ? <span>мова: {c.language}</span> : null}
        {(c.countries || []).length ? <span>{c.countries.join(', ')}</span> : null}
        {c.score != null ? <span>оцінка {c.score}/100</span> : null}
        {c.scrapable === 'yes' ? <span>читається роботом</span> : null}
        {c.scrapable === 'manual' ? <span className="warn">роботом не читається — лише вручну</span> : null}
        {c.scrapable === 'no' ? <span className="bad">сайт не відповів</span> : null}
      </p>
      {c.score_reason ? <p className="src-why">{c.score_reason}</p> : null}
      <p className="src-why" style={{ color: '#8a94a6', fontSize: 13 }}>
        {c.probe_status ? <>{c.probe_status} · </> : null}
        {c.found_by ? <>{c.found_by} · </> : null}
        знайдено {formatDate(String(c.created_at || '').slice(0, 10))}
      </p>
      {c.admin_comment ? <p className="src-why">«{c.admin_comment}»</p> : null}
      <div className="src-acts">
        <button type="button" className="src-btn take" onClick={() => decide('take')} disabled={busy}>
          Беремо
        </button>
        <button type="button" className="src-btn no" onClick={() => decide('skip')} disabled={busy}>
          Не треба
        </button>
      </div>
      {error ? <p className="src-err">{error}</p> : null}
    </article>
  );
}

function Source({ s }) {
  const [on, setOn] = useState(!!s.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setBusy(true); setError('');
    const r = await post({ kind: 'source', id: s.id, action: on ? 'off' : 'on' });
    setBusy(false);
    if (!r.ok) { setError('Не вдалося перемкнути.'); return; }
    setOn(!on);
  }

  const last = s.last_success_at ? formatDate(String(s.last_success_at).slice(0, 10)) : null;
  return (
    <div className={`src-row ${on ? '' : 'off'}`}>
      <span className="nm">{s.name}</span>
      <span className="meta">
        {s.adapter}
        {s.crawl_interval_days ? ` · раз на ${s.crawl_interval_days} дн.` : ''}
        {last ? ` · востаннє ${last}` : ' · ще не обходилось'}
        {s.consecutive_failures > 2 ? ` · ${s.consecutive_failures} збоїв поспіль` : ''}
      </span>
      <button type="button" className="src-btn" onClick={toggle} disabled={busy}>
        {on ? 'Вимкнути' : 'Увімкнути'}
      </button>
      {error ? <span className="src-err">{error}</span> : null}
    </div>
  );
}

export default function SourcesList({ candidates = [], sources = [] }) {
  const working = sources.filter((s) => s.enabled).length;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <h2 className="src-h">На рішення ({candidates.length})</h2>
      <p className="src-sub">
        «Беремо» не вмикає обхід: під кожен сайт потрібен окремий зчитувач у коді.
        Це рішення, що сайт вартий роботи, — і список того, що підключати далі.
      </p>
      {candidates.length === 0
        ? <p style={{ fontSize: 16 }}>Нових кандидатів немає.</p>
        : candidates.map((c) => <Candidate key={c.id} c={c} />)}

      <h2 className="src-h">Обходяться зараз ({working} з {sources.length})</h2>
      <p className="src-sub">
        Тут перемикач справжній: конвеєр читає саме цей стан.
      </p>
      {sources.map((s) => <Source key={s.id} s={s} />)}
    </>
  );
}
