'use client';
import { useState } from 'react';
export default function RepayButton({ t, price }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    const r = await fetch('/api/modnyi-kod/repay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (j.url) { window.location.assign(j.url); return; }
    if (j.paid) { window.location.reload(); return; }
    setErr('Оплата не відкрилась. Спробуйте за хвилину.'); setBusy(false);
  }
  return <><button type="button" className="mk-btn-y" disabled={busy} onClick={go}>{busy ? 'Відкриваємо…' : `Оплатити ${price} грн`}</button>{err ? <p className="mkJ-err">{err}</p> : null}</>;
}
