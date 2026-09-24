'use client';
import { useState } from 'react';

/**
 * Проста черга: одна картка — один запис, три кнопки.
 *
 * Велика адмінка на /admin показує чернетки, живі записи й карантин одразу,
 * з пошуком, вкладками й дублями. Людині, яка тільки схвалює, з цього
 * потрібні три дії, тож тут лише вони: схвалити, пропустити, спитати.
 */
const C = {
  ink: '#131b28', ink2: '#54617a', ink3: '#6b6b6b',
  border: '#e2e8f2', bg: '#f7f9fc', green: '#15803d', red: '#b42318', link: '#1e4fd6',
};

const cardS = {
  border: `1px solid ${C.border}`, borderRadius: 14, padding: 18,
  background: '#fff', display: 'flex', flexDirection: 'column', gap: 10,
};
const btnS = {
  padding: '11px 18px', fontSize: 15, fontWeight: 600, borderRadius: 10,
  border: 'none', cursor: 'pointer', color: '#fff',
};

export default function QueueCards({ items }) {
  const [queue, setQueue] = useState(items);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState({ approve: 0, skip: 0, comment: 0 });
  const [asking, setAsking] = useState(null);
  const [question, setQuestion] = useState('');

  async function act(id, action, comment) {
    setBusy(id);
    setError('');
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, comment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        // Найчастіша відмова — бракує обовʼязкового поля. Кажемо прямо, чого
        // саме: інакше кнопка просто «не працює».
        setError(json.error === 'missing_required'
          ? `Не вистачає даних: ${(json.missing || []).join(', ')}. Цей запис хай допише Марія.`
          : 'Не вдалося зберегти. Спробуйте ще раз.');
        return;
      }
      setDone((d) => ({ ...d, [action]: (d[action] || 0) + 1 }));
      setQueue((q) => q.filter((o) => o.id !== id));
      setAsking(null);
      setQuestion('');
    } catch {
      setError('Немає звʼязку. Спробуйте ще раз.');
    } finally {
      setBusy(null);
    }
  }

  if (!queue.length) {
    return (
      <p style={{ fontSize: 15, color: C.ink2 }}>
        Черга порожня — нових записів на перевірку немає.
        {done.approve ? ` Сьогодні ви схвалили ${done.approve}.` : ''}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error ? (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fdecea', color: C.red, fontSize: 14 }}>
          {error}
        </div>
      ) : null}

      {queue.map((o) => (
        <article key={o.id} style={cardS}>
          <div style={{ fontSize: 13, color: C.ink3 }}>{o.facts}</div>
          <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.3 }}>{o.title}</h2>
          {o.summary ? <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: C.ink2 }}>{o.summary}</p> : null}
          {o.source_url ? (
            <a href={o.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: C.link }}>
              {o.source || 'Джерело'} ↗
            </a>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button
              type="button"
              style={{ ...btnS, background: C.green, opacity: busy === o.id ? 0.6 : 1 }}
              disabled={busy === o.id}
              onClick={() => act(o.id, 'approve')}
            >
              Схвалити
            </button>
            <button
              type="button"
              style={{ ...btnS, background: C.ink2, opacity: busy === o.id ? 0.6 : 1 }}
              disabled={busy === o.id}
              onClick={() => act(o.id, 'skip')}
            >
              Пропустити
            </button>
            <button
              type="button"
              style={{ ...btnS, background: '#fff', color: C.ink, border: `1px solid ${C.border}` }}
              disabled={busy === o.id}
              onClick={() => { setAsking(asking === o.id ? null : o.id); setQuestion(''); }}
            >
              Питання до Марії
            </button>
          </div>

          {asking === o.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="Що саме незрозуміло — запис лишиться в черзі"
                style={{ padding: 10, fontSize: 15, borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: 'inherit' }}
              />
              <button
                type="button"
                style={{ ...btnS, background: C.ink, alignSelf: 'flex-start', opacity: question.trim() ? 1 : 0.5 }}
                disabled={!question.trim() || busy === o.id}
                onClick={() => act(o.id, 'comment', question)}
              >
                Надіслати питання
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
