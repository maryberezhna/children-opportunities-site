'use client';
// Інше фото до тієї самої заявки — без доплати.
import { useState } from 'react';
import { toJpeg } from '../jpeg';

export default function PhotoReplace({ t, label = 'Надіслати інше фото' }) {
  const [state, setState] = useState('idle'); // idle | sending | error
  const [error, setError] = useState('');
  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState('sending');
    setError('');
    try {
      const blob = await toJpeg(file);
      const f = new FormData();
      f.set('t', t);
      f.set('image', blob, 'malyunok.jpg');
      const r = await fetch('/api/obraz/photo', { method: 'POST', body: f });
      if (r.ok) { window.location.reload(); return; }
      setError('Не вийшло завантажити фото. Спробуйте інше або напишіть нам: hellodityam.com.ua@gmail.com');
    } catch {
      setError('Цей файл не відкривається. Спробуйте інше фото (JPG чи PNG).');
    }
    setState('idle');
  }
  return (
    <div className="ob-replace">
      <label className="ob-btn ob-btn-ghost">
        <input type="file" accept="image/*" onChange={pick} hidden />
        {state === 'sending' ? 'Завантажуємо…' : label}
      </label>
      {error ? <p className="ob-error" role="alert">{error}</p> : null}
    </div>
  );
}
