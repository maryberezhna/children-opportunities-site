'use client';

// Друкований диплом із доставкою Новою поштою — за бажанням, після тесту.
import { useState } from 'react';

const ERRORS = {
  name: 'Вкажіть імʼя та прізвище отримувача.',
  phone: 'Перевірте номер телефону — на нього прийде повідомлення Нової пошти.',
  city: 'Вкажіть місто чи село.',
  branch: 'Вкажіть номер відділення або поштомата Нової пошти.',
  pay: 'Не вдалося відкрити оплату. Спробуйте ще раз за хвилину.',
  unavailable: 'Замовлення тимчасово недоступне. Спробуйте трохи пізніше.',
};

export default function PrintOrder({ token, price, paid, order }) {
  // Доставку оплачено разом з участю (249 грн), адреси ще немає — одразу форма,
  // без оплати.
  const prepaid = paid && !order;
  const [open, setOpen] = useState(prepaid);
  const [state, setState] = useState('idle'); // idle | sending | error
  const [error, setError] = useState('');

  if (paid && order) {
    return (
      <p className="ol-ok" role="status">
        Друкований диплом замовлено. Надішлемо Новою поштою: {order?.city}, {order?.branch}.
      </p>
    );
  }

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      t: token,
      name: String(f.get('name') || ''),
      phone: String(f.get('phone') || ''),
      city: String(f.get('city') || ''),
      branch: String(f.get('branch') || ''),
    };
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/olimpiada/print', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) {
        setState('error');
        setError(ERRORS[j.error] || ERRORS.unavailable);
        return;
      }
      if (typeof window.gtag === 'function' && !prepaid) window.gtag('event', 'olimpiada_print_order', { value: price });
      window.location.assign(j.url);
    } catch {
      setState('error');
      setError(ERRORS.unavailable);
    }
  }

  if (!open) {
    return (
      <button type="button" className="ol-btn ol-btn-main" onClick={() => setOpen(true)}>
        Так, замовити · {price} грн
      </button>
    );
  }

  return (
    <form className="ol-open-form" onSubmit={submit} noValidate>
      <label className="ol-field">
        <span>Прізвище та імʼя отримувача</span>
        <input name="name" type="text" autoComplete="name" maxLength={80} required />
      </label>
      <label className="ol-field">
        <span>Телефон</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} required placeholder="+380" />
      </label>
      <label className="ol-field">
        <span>Місто чи село</span>
        <input name="city" type="text" autoComplete="address-level2" maxLength={80} required />
      </label>
      <label className="ol-field">
        <span>Відділення або поштомат Нової пошти</span>
        <input name="branch" type="text" maxLength={80} required placeholder="Наприклад: відділення 12" />
      </label>
      {error && <p className="ol-error" role="alert">{error}</p>}
      <button type="submit" className="ol-btn ol-btn-main" disabled={state === 'sending'}>
        {prepaid
          ? (state === 'sending' ? 'Зберігаємо…' : 'Надіслати сюди')
          : (state === 'sending' ? 'Відкриваємо оплату…' : `Замовити й оплатити · ${price} грн`)}
      </button>
    </form>
  );
}
