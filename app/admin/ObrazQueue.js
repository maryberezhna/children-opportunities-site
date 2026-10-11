'use client';

// Малюнки челенджу «Намалюй свій образ», що чекають на рішення (11.10.2026).
// Живуть у тій самій «Черзі», а не в новій вкладці (memory: одна черга):
// картка — малюнок, імʼя, вік, назва, слова дитини; дві дії —
// «Опублікувати» (з відзнакою чи без) і «Не підходить». Обидві шлють батькам
// лист (lib/obraz-server.js → decide).
import { useState } from 'react';

const S = {
  box: { margin: '0 0 28px', padding: 16, borderRadius: 14, background: '#fff8f1', border: '1px solid #f6d9bd' },
  card: { display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, padding: '14px 0', borderTop: '1px solid #f6d9bd' },
  img: { width: 140, height: 180, objectFit: 'contain', background: '#fff', borderRadius: 8, border: '1px solid #eee' },
  btn: { minHeight: 40, padding: '0 16px', borderRadius: 999, border: 0, fontWeight: 700, fontSize: 15, cursor: 'pointer' },
};

function Card({ w }) {
  const [award, setAward] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | approved | rejected | error
  async function act(action) {
    if (action === 'reject' && !window.confirm('Не публікувати? Батькам піде лист «надішліть, будь ласка, ще раз».')) return;
    setState('sending');
    const r = await fetch('/api/admin/obraz', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id, action, award: award || null }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setState(action === 'approve' ? 'approved' : 'rejected');
    else setState(j.error === 'already' ? (action === 'approve' ? 'approved' : 'rejected') : 'error');
  }
  if (state === 'approved') return <p style={{ ...S.card, display: 'block', color: '#0e5449' }}>✅ «{w.title}» у галереї. Батькам пішов лист.</p>;
  if (state === 'rejected') return <p style={{ ...S.card, display: 'block', color: '#54617a' }}>Не опубліковано. Батькам пішов лист «надішліть ще раз».</p>;
  return (
    <div style={S.card}>
      <a href={w.img} target="_blank" rel="noopener noreferrer"><img src={w.img} alt="" style={S.img} /></a>
      <div style={{ fontSize: 15, lineHeight: 1.5 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>«{w.title}»</div>
        <div>{w.child_name}, {w.age} · <span style={{ color: '#54617a' }}>{w.parent_email}</span></div>
        {w.story ? <div style={{ margin: '6px 0', color: '#333' }}>{w.story}</div> : null}
        <div style={{ fontSize: 13, color: '#54617a' }}>
          Instagram: {w.consent_instagram ? 'можна' : 'ні'} · {new Date(w.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' })}
        </div>
        <div style={{ fontSize: 13, color: '#a11b1b', margin: '4px 0 8px' }}>Перевір: на фото лише малюнок, без людей, документів, прізвищ.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select value={award} onChange={(e) => setAward(e.target.value)} style={{ minHeight: 40, borderRadius: 8, padding: '0 8px', fontSize: 14 }}>
            <option value="">Без відзнаки</option>
            {w.awards.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="button" disabled={state === 'sending'} onClick={() => act('approve')} style={{ ...S.btn, background: '#c8501a', color: '#fff' }}>Опублікувати</button>
          <button type="button" disabled={state === 'sending'} onClick={() => act('reject')} style={{ ...S.btn, background: '#eef0f4', color: '#131b28' }}>Не підходить</button>
        </div>
        {state === 'error' ? <div style={{ color: '#a11b1b', marginTop: 6 }}>Не вийшло — онови сторінку й спробуй ще раз.</div> : null}
      </div>
    </div>
  );
}

export default function ObrazQueue({ works }) {
  if (!works?.length) return null;
  return (
    <section style={S.box}>
      <h2 style={{ fontSize: 19, margin: '0 0 4px' }}>🎨 Малюнки на перевірку ({works.length})</h2>
      <p style={{ margin: '0 0 6px', fontSize: 14, color: '#54617a' }}>Челендж «Намалюй свій образ». Нічого не публікується, доки не натиснеш «Опублікувати».</p>
      {works.map((w) => <Card key={w.id} w={w} />)}
    </section>
  );
}
