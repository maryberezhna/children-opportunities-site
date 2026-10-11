'use client';
import { useState } from 'react';

export default function PayButton({ t, price }) {
  const [state, setState] = useState('idle'); // idle | sending | error
  async function pay() {
    setState('sending');
    try {
      const r = await fetch('/api/obraz/start-pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t }) });
      const j = await r.json().catch(() => ({}));
      if (j.url) { if (window.gtag) window.gtag('event', 'obraz_pay_start'); window.location.href = j.url; return; }
      if (j.paid) { window.location.reload(); return; }
      setState('error');
    } catch { setState('error'); }
  }
  return (
    <>
      <button type="button" className="ob-btn ob-btn-main ob-btn-big" onClick={pay} disabled={state === 'sending'}>
        {state === 'sending' ? 'Відкриваємо оплату…' : `Оплатити ${price} грн і поставити на обкладинку`}
      </button>
      {state === 'error' ? <p className="ob-error" role="alert">Оплата не відкрилась. Спробуйте ще раз за хвилину або напишіть нам: hellodityam.com.ua@gmail.com</p> : null}
    </>
  );
}
