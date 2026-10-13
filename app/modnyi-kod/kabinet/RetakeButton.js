'use client';
// «Пройти тест ще раз» — спроб скільки завгодно (Марія, 13.10.2026). Образ і
// обкладинка лишаються; на обкладинці — кращий результат.
import { useState } from 'react';

export default function RetakeButton({ t }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/modnyi-kod/retake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t }) });
      if (!r.ok) throw new Error('bad');
      if (typeof window.gtag === 'function') window.gtag('event', 'modnyi_kod_retake');
      window.location.reload();
    } catch { setBusy(false); setErr('Не вдалося. Перевірте інтернет і спробуйте ще раз.'); }
  }
  return (
    <div className="mkK-retake">
      <button type="button" className="mkS-btn" onClick={go} disabled={busy}>{busy ? 'Готуємо завдання…' : 'Пройти тест ще раз'}</button>
      {err ? <p className="mkJ-err">{err}</p> : null}
    </div>
  );
}
