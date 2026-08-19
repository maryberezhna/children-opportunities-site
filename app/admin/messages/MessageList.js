'use client';
import { useState } from 'react';
import { CONTACT_TYPE_MAP } from '@/lib/contactTypes';

const STATUS_LABEL = {
  new: '🆕 Нове',
  in_progress: '⏳ В роботі',
  done: '✅ Опрацьовано',
};

const box = {
  border: '1px solid #e3e8f0',
  borderRadius: 10,
  padding: '14px 16px',
  background: '#fff',
  marginBottom: 10,
};
const metaS = { fontSize: 12.5, color: '#8a94a6' };
const btnS = {
  font: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid #d9e0ea',
  background: '#fff',
  cursor: 'pointer',
};

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Message({ row, onChange }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(row.admin_note || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const t = CONTACT_TYPE_MAP[row.type] || CONTACT_TYPE_MAP.other;

  const setStatus = async (status, withNote = false) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status, note: withNote ? note : undefined }),
      });
      if (res.ok) onChange(row.id, { status, admin_note: withNote ? note : row.admin_note });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...box, borderLeft: `4px solid ${row.status === 'new' ? '#e85d24' : '#e3e8f0'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15 }}>{t.emoji} {t.label}</strong>
        <span style={metaS}>{STATUS_LABEL[row.status]} · {fmt(row.created_at)}</span>
      </div>

      <p style={{ margin: '10px 0', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {row.message}
      </p>

      {row.url && (
        <p style={{ margin: '0 0 8px' }}>
          <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14 }}>
            🔗 {row.url.slice(0, 80)}
          </a>
        </p>
      )}

      <p style={{ ...metaS, margin: '0 0 10px' }}>
        {row.name || row.contact
          ? <>👤 {[row.name, row.contact].filter(Boolean).join(' · ')}</>
          : <i>без контактів — відповісти не вийде</i>}
        {row.page ? ` · зі сторінки ${row.page}` : ''}
      </p>

      {row.admin_note && !noteOpen && (
        <p style={{ ...metaS, margin: '0 0 10px', color: '#54617a' }}>📝 {row.admin_note}</p>
      )}

      {noteOpen && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Нотатка: що зробили з цим зверненням"
          style={{ width: '100%', font: 'inherit', fontSize: 14, padding: 8, borderRadius: 8, border: '1px solid #d9e0ea', marginBottom: 8 }}
        />
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Пропозиції з поп-апа живуть в opportunity_suggestions — статуси
            їм тут не міняємо, щоб кнопка не вдавала збережену дію. */}
        {row.readOnly && (
          <span style={{ ...metaS, alignSelf: 'center' }}>
            з поп-апа каталогу · опрацьовується при додаванні можливості
          </span>
        )}
        {!row.readOnly && row.status !== 'in_progress' && (
          <button type="button" style={btnS} disabled={busy} onClick={() => setStatus('in_progress')}>
            ⏳ В роботу
          </button>
        )}
        {!row.readOnly && row.status !== 'done' && (
          <button
            type="button"
            style={{ ...btnS, borderColor: '#15803d', color: '#15803d' }}
            disabled={busy}
            onClick={() => setStatus('done', noteOpen)}
          >
            ✅ Опрацьовано
          </button>
        )}
        {!row.readOnly && row.status !== 'new' && (
          <button type="button" style={btnS} disabled={busy} onClick={() => setStatus('new')}>
            ↩︎ Повернути в нові
          </button>
        )}
        {!row.readOnly && (
          <button type="button" style={btnS} onClick={() => setNoteOpen((v) => !v)}>
            📝 {noteOpen ? 'Сховати нотатку' : 'Нотатка'}
          </button>
        )}
        {row.contact?.includes('@') && (
          <a
            href={`mailto:${row.contact}?subject=Dityam.com.ua — відповідь на ваше звернення`}
            style={{ ...btnS, textDecoration: 'none', color: '#131b28' }}
          >
            ✉️ Відповісти
          </a>
        )}
      </div>
    </div>
  );
}

export default function MessageList({ initial }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState('open'); // open | all | done

  const onChange = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'done' ? r.status === 'done' : r.status !== 'done'
  );
  const newCount = rows.filter((r) => r.status === 'new').length;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, margin: '14px 0 16px', flexWrap: 'wrap' }}>
        {[
          ['open', `Активні${newCount ? ` (${newCount} нових)` : ''}`],
          ['done', 'Опрацьовані'],
          ['all', 'Усі'],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            style={{
              ...btnS,
              background: filter === v ? '#131b28' : '#fff',
              color: filter === v ? '#fff' : '#131b28',
              borderColor: filter === v ? '#131b28' : '#d9e0ea',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0
        ? <p style={{ color: '#8a94a6' }}>Порожньо.</p>
        : visible.map((r) => <Message key={r.id} row={r} onChange={onChange} />)}
    </>
  );
}
