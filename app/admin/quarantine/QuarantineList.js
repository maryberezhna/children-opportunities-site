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

// «За критеріями» — чотири критерії з правил збоку. Значок і колір лише
// підсилюють слово: зміст має читатися й без них.
const TONE = {
  ok: { icon: '✓', color: '#15803d' },
  bad: { icon: '✕', color: '#a11b1b' },
  check: { icon: '?', color: '#b4530a' },
};

function Crit({ tone, label, children }) {
  const t = TONE[tone];
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '20px 118px minmax(0, 1fr)', columnGap: 6, alignItems: 'baseline' }}>
      <span aria-hidden="true" style={{ color: t.color, fontWeight: 700 }}>{t.icon}</span>
      <b style={{ color: t.color }}>{label}</b>
      <span>{children}</span>
    </li>
  );
}

function Criteria({ c }) {
  const f = c.found;
  const have = [f.age && `вік ${f.age}`, f.date && 'дата', f.cost, f.place].filter(Boolean);
  const miss = [!f.age && 'вік', !f.date && 'дата', !f.cost && 'вартість', !f.place && 'місце чи формат']
    .filter(Boolean);

  let actual;
  if (c.actual === 'yes') {
    actual = [
      c.future.length ? `попереду: ${c.future.slice(0, 3).join(', ')}` : null,
      c.ongoing ? 'постійний набір' : null,
      c.past.length ? `минули: ${c.past.slice(-2).join(', ')}` : null,
    ].filter(Boolean).join(' · ');
  } else if (c.actual === 'no') {
    actual = `усі дати минули: ${c.past.slice(-3).join(', ')}`;
  } else if (c.conflict) {
    actual = `пише «постійний набір», а в тексті лише минулі дати: ${c.past.slice(-2).join(', ')} — звір у джерелі`;
  } else {
    actual = c.undated.length
      ? `дата без року: ${c.undated.slice(0, 2).join(', ')} — звір у джерелі`
      : 'дат у тексті немає — звір у джерелі';
  }

  return (
    <div style={{ margin: '10px 0', padding: '10px 12px', background: '#f7f9fc', borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#54617a', marginBottom: 6 }}>За критеріями</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', rowGap: 5, fontSize: 15, lineHeight: 1.45 }}>
        <Crit tone={{ yes: 'ok', no: 'bad', unknown: 'check' }[c.actual]} label="Актуальна">{actual}</Crit>
        <Crit tone={miss.length ? 'check' : 'ok'} label="Повна">
          {have.length ? `у тексті: ${have.join(' · ')}` : 'у тексті нічого з основного'}
          {miss.length ? `. Не знайдено: ${miss.join(', ')}` : ''}
        </Crit>
        <Crit tone="check" label="Конкретна">
          {c.rubric
            ? 'назва — рубрика каналу: у пості може бути кілька можливостей'
            : 'вирішуєш ти: одна програма, свої умови, як подати'}
        </Crit>
        <Crit tone={c.ukrainian ? 'ok' : 'check'} label="Українською">
          {c.ukrainian ? 'так' : 'ні — модель перекладе при розборі'}
        </Crit>
        {c.orgsOnly ? (
          <Crit tone="bad" label="Для кого">Eurodesk: лише для організацій, не для дитини</Crit>
        ) : null}
      </ul>
    </div>
  );
}

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

      <Criteria c={row.criteria} />
      {/* Вік тепер у рядку «Повна»; «Хто може» лишається окремо. */}
      {row.snippet.who ? (
        <p style={{ margin: '0 0 8px', fontSize: 14 }}><b>Хто може:</b> {row.snippet.who}</p>
      ) : null}
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
