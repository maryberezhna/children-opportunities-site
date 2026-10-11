'use client';
import { useState } from 'react';

export default function RemoveButton({ t }) {
  const [state, setState] = useState('idle'); // idle | sending | done | error
  async function remove() {
    setState('sending');
    try {
      const r = await fetch('/api/obraz/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }
  if (state === 'done') return <p className="ob-text" role="status"><b>Готово: малюнок прибрано.</b></p>;
  return (
    <>
      <button type="button" className="ob-btn ob-btn-main" onClick={remove} disabled={state === 'sending'}>
        {state === 'sending' ? 'Прибираємо…' : 'Так, прибрати'}
      </button>
      {state === 'error' ? <p className="ob-error" role="alert">Не вийшло. Перевірте посилання з листа або напишіть нам: hellodityam.com.ua@gmail.com</p> : null}
    </>
  );
}
