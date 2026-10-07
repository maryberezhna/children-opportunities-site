'use client';

// Відкрите завдання на сторінці результату — якщо дитина пропустила його або
// закрила вкладку на цьому кроці. Таймера на ньому немає (Марія, 07.10.2026),
// тож дописати можна й тут; приймаємо один раз (/api/olimpiada/open).
import { useEffect, useState } from 'react';

export default function OpenTaskLate({ token, maxLength }) {
  const key = `olimp_o_${token}`;
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | error
  useEffect(() => {
    try { setText(window.localStorage.getItem(key) || ''); } catch { /* без чернетки */ }
  }, [key]);

  const write = (v) => {
    setText(v);
    try { window.localStorage.setItem(key, v); } catch { /* ок */ }
  };

  const send = async () => {
    setState('sending');
    try {
      const r = await fetch('/api/olimpiada/open', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, open: text }),
      });
      if (!r.ok) throw new Error('bad');
      try { window.localStorage.removeItem(key); } catch { /* ок */ }
      window.location.reload();
    } catch {
      setState('error');
    }
  };

  return (
    <>
      <label className="ol-field">
        <span>Твоє питання й відповідь</span>
        <textarea
          value={text} onChange={(e) => write(e.target.value)} maxLength={maxLength} rows={8}
          placeholder="Питання… Відповідь… Як до неї дійти…" disabled={state === 'sending'}
        />
      </label>
      <p className="ol-count">{text.length} / {maxLength}</p>
      {state === 'error' && (
        <p className="ol-error" role="alert">Не вдалося надіслати відповідь. Вона збережена — перевірте інтернет і натисніть кнопку ще раз.</p>
      )}
      <button type="button" className="ol-btn ol-btn-main" onClick={send} disabled={state === 'sending' || !text.trim()}>
        {state === 'sending' ? 'Надсилаємо…' : 'Відправити відповідь'}
      </button>
    </>
  );
}
