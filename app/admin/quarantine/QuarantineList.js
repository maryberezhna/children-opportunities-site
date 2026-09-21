'use client';
import { useState } from 'react';

const box = {
  border: '1px solid #e3e8f0', borderRadius: 10, padding: '14px 16px',
  background: '#fff', marginBottom: 10,
};
const metaS = { fontSize: 12.5, color: '#6b6b6b' };
const btnS = {
  font: 'inherit', fontSize: 13, fontWeight: 600, padding: '6px 12px',
  borderRadius: 999, border: '1px solid #d9e0ea', background: '#fff', cursor: 'pointer',
};

const DONE = {
  pending: '✓ Прийнято — можливість зʼявиться після нічного розбору',
  rejected: '✕ Відхилено',
};

function Item({ row }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);

  const act = async (action) => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/admin/quarantine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setDone(body.status);
      else if (body.error === 'not_in_review') setErr('Уже розібрано — оновіть сторінку.');
      else setErr('Не вийшло. Оновіть сторінку й спробуйте ще раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...box, opacity: done ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15 }}>{row.raw_title || '(без назви)'}</strong>
        <span style={metaS}>
          {row.source_name}
          {row.trust_tier ? ` · довіра ${row.trust_tier}` : ''}
          {row.confidence != null ? ` · впевненість ${Number(row.confidence).toFixed(2)}` : ''}
        </span>
      </div>

      <p style={{ margin: '8px 0', fontSize: 14 }}>
        <b>Вік:</b> {row.snippet.age || <i style={{ color: '#b4530a' }}>у тексті не названо</i>}
        {row.snippet.who ? <><br /><b>Хто може:</b> {row.snippet.who}</> : null}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#54617a', lineHeight: 1.5 }}>
        {open ? row.raw_text : row.snippet.lead}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {done ? (
          <span style={{ ...metaS, fontWeight: 600 }}>{DONE[done]}</span>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => act('accept')}
              style={{ ...btnS, background: '#15803d', borderColor: '#15803d', color: '#fff' }}>
              ➕ Завести можливість
            </button>
            <button type="button" disabled={busy} onClick={() => act('reject')}
              style={{ ...btnS, borderColor: '#b42318', color: '#b42318' }}>
              ✕ Відхилити
            </button>
          </>
        )}
        <button type="button" style={btnS} onClick={() => setOpen((v) => !v)}>
          {open ? 'Згорнути текст' : 'Весь текст'}
        </button>
        {row.url ? (
          <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ ...btnS, textDecoration: 'none', color: '#131b28' }}>
            🔗 Джерело
          </a>
        ) : null}
      </div>
      {err ? <p style={{ ...metaS, color: '#b42318', margin: '8px 0 0' }}>{err}</p> : null}
    </div>
  );
}

export default function QuarantineList({ rows }) {
  if (!rows.length) return <p style={{ color: '#8a94a6' }}>Карантин порожній.</p>;
  return <>{rows.map((r) => <Item key={r.id} row={r} />)}</>;
}
