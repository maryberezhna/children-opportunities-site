'use client';
import { useState } from 'react';
import { trackConversion } from '@/lib/track';

/**
 * Збір email під нагадування про дедлайни.
 *
 * Свідомо НЕ гейт: сам календар відкритий. Ховати його за поштою означало б
 * сховати від Google рівно ту сторінку, яка має приводити людей — а органіка
 * зараз головне джерело трафіку. Тож віддаємо все, а пошту просимо за те,
 * чого на сторінці немає: нагадати особисто, поки не пізно.
 */
export default function ReminderForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setState('error');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'deadlines_calendar' }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'server');
      setState('done');
      trackConversion('plus_waitlist_submit', { event_label: 'deadlines_calendar' });
    } catch (err) {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="dl-remind dl-remind-done">
        <strong>Готово.</strong>
        <span>Нагадаємо за три дні до кожного дедлайну, який вам підходить.</span>
      </div>
    );
  }

  return (
    <form className="dl-remind" onSubmit={submit}>
      <div className="dl-remind-text">
        <strong>Не тримайте дати в голові</strong>
        <span>Залиште пошту — нагадаємо за три дні до кожного дедлайну.</span>
      </div>
      <div className="dl-remind-row">
        <label className="sr-only" htmlFor="dl-email">Ваш email</label>
        <input
          id="dl-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ваша@пошта.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
          aria-invalid={state === 'error'}
        />
        <button type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Надсилаємо…' : 'Нагадати'}
        </button>
      </div>
      {state === 'error' && (
        <p className="dl-remind-err" role="alert">Перевірте адресу — щось не так.</p>
      )}
    </form>
  );
}
