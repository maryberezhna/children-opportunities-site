'use client';
// Поки тест «Модного коду» не готовий, замість оплати — список очікування:
// батьки лишають email, на старті отримають 1 лист. Нічого не продаємо наперед.
import { useState } from 'react';

export default function Waitlist() {
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { email: String(f.get('email') || ''), consent: f.get('consent') === 'on', website: String(f.get('website') || ''),
      source: new URLSearchParams(window.location.search).get('utm_source') || '' };
    if (!body.consent) { setError('Потрібна згода на лист.'); return; }
    setState('sending'); setError('');
    try {
      const r = await fetch('/api/modnyi-kod/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error === 'email' ? 'Перевірте email.' : 'Не вийшло. Спробуйте за хвилину.'); setState('idle'); return; }
      setState('done');
      if (window.gtag) window.gtag('event', 'modnyi_kod_waitlist');
    } catch { setError('Не вийшло. Спробуйте за хвилину.'); setState('idle'); }
  }
  if (state === 'done') return <p className="mk-ok" role="status">Готово! Щойно олімпіада стартує, напишемо на цю пошту. Образ збережено в цьому браузері.</p>;
  return (
    <form className="mk-wait" onSubmit={submit} noValidate>
      <p className="mk-small"><b>Олімпіада стартує незабаром.</b> Залиште email батьків — повідомимо першими.</p>
      <div className="mk-wait-row">
        <input name="email" type="email" autoComplete="email" placeholder="email батьків" required />
        <button type="submit" disabled={state === 'sending'}>{state === 'sending' ? '…' : 'Повідомити'}</button>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="mk-hp" aria-hidden="true" />
      <label className="mk-check"><input type="checkbox" name="consent" /> <span>Я мама, тато чи опікун дитини й погоджуюсь отримати 1 лист про старт олімпіади.</span></label>
      {error ? <p className="mk-err" role="alert">{error}</p> : null}
    </form>
  );
}
