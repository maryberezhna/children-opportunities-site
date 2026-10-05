'use client';

// Відкрите завдання місяця: відповідь надсилається 1 раз.
import { useState } from 'react';

export default function OpenTask({ token, done, max }) {
  const [state, setState] = useState(done ? 'sent' : 'idle'); // idle | sending | sent | error
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  if (state === 'sent') {
    return <p className="ol-ok" role="status">Відповідь надіслано. Переможців місяця оголосимо в Telegram-каналі Dityam.com.ua.</p>;
  }

  async function submit(e) {
    e.preventDefault();
    if (text.trim().length < 20) { setError('Напиши задачу й розвʼязок — хоча б кілька речень.'); return; }
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/olimpiada/open', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, text }),
      });
      if (!r.ok) throw new Error('bad');
      setState('sent');
    } catch {
      setState('error');
      setError('Не вдалося надіслати. Спробуй ще раз.');
    }
  }

  return (
    <form className="ol-open-form" onSubmit={submit}>
      <label className="ol-field">
        <span>Твоя задача й розвʼязок</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={max} rows={7} placeholder="Умова задачі… Розвʼязок…" />
      </label>
      <p className="ol-count">{text.length} / {max}</p>
      {error && <p className="ol-error" role="alert">{error}</p>}
      <button type="submit" className="ol-btn ol-btn-main" disabled={state === 'sending'}>
        {state === 'sending' ? 'Надсилаємо…' : 'Надіслати відповідь'}
      </button>
      <p className="ol-note">Надіслати можна 1 раз, тож перечитай перед відправкою.</p>
    </form>
  );
}
