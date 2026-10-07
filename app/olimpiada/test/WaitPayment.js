'use client';

// Чекаємо підтвердження оплати. Кожне оновлення сторінки сервер сам питає
// WayForPay про статус (syncPayment), тож тест відкривається, щойно оплата
// пройшла, навіть якщо колбек затримався.
//
// До 07.10.2026 вже за 80 секунд тут зʼявлялося «Оплата досі не
// підтвердилась» і кнопка нової заявки — батьки могли заплатити двічі, а
// лічильник був один на всі заявки, тож для другої дитини в тій самій
// вкладці напис зʼявлявся одразу. Тепер: лічильник — свій у кожної заявки;
// поки оплата може ще пройти (state pending), нової оплати не пропонуємо;
// «Оплатити» — лише коли WayForPay сказав, що ця оплата не пройшла (failed)
// або що її й не починали (none), і для тієї самої заявки. Покинуту сторінку
// оплати WayForPay закриває як Expired приблизно за 18 хвилин (06.10.2026),
// тому й чекаємо до 20.
import { useEffect, useState } from 'react';

const FAST = 20;        // перші ~80 секунд — кожні 4 с
const TOTAL = 90;       // далі кожні 15 с, разом ~20 хвилин
const ERRORS = {
  pending: 'Попередня оплата ще обробляється. Зачекайте кілька хвилин — сторінка оновиться сама.',
  closed: 'Оплату тимчасово закрито. Напишіть нам — допоможемо.',
  pay: 'Не вдалося відкрити оплату. Спробуйте ще раз за хвилину.',
  unavailable: 'Не вдалося звʼязатися з WayForPay. Спробуйте ще раз за хвилину.',
};

export default function WaitPayment({ token, state: payState, email, price }) {
  const key = `olimp_wait_${token}`;
  const canPay = payState === 'failed' || payState === 'none';
  const [waiting, setWaiting] = useState(!canPay);
  const [state, setState] = useState('idle'); // idle | sending | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (canPay) {
      try { window.sessionStorage.removeItem(key); } catch { /* ок */ }
      return undefined;
    }
    let n = 0;
    try { n = Number(window.sessionStorage.getItem(key)) || 0; } catch { /* без лічильника */ }
    if (n >= TOTAL) { setWaiting(false); return undefined; }
    const id = setTimeout(() => {
      try { window.sessionStorage.setItem(key, String(n + 1)); } catch { /* ок */ }
      window.location.reload();
    }, n < FAST ? 4000 : 15000);
    return () => clearTimeout(id);
  }, [canPay, key]);

  async function repay() {
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/olimpiada/repay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) {
        setState('error');
        setError(ERRORS[j.error] || ERRORS.unavailable);
        return;
      }
      window.location.assign(j.url);
    } catch {
      setState('error');
      setError(ERRORS.unavailable);
    }
  }

  function again() {
    try { window.sessionStorage.removeItem(key); } catch { /* ок */ }
    window.location.reload();
  }

  if (canPay) {
    return (
      <>
        <p className="ol-text">
          {payState === 'failed' ? 'Оплата не пройшла.' : 'Оплату не завершено.'} Можна оплатити зараз — заявка та сама, імʼя й email уже збережено.
        </p>
        {error && <p className="ol-error" role="alert">{error}</p>}
        <button type="button" className="ol-btn ol-btn-main" onClick={repay} disabled={state === 'sending'}>
          {state === 'sending' ? 'Відкриваємо оплату…' : `${payState === 'failed' ? 'Оплатити ще раз' : 'Оплатити'} · ${price} грн`}
        </button>
        <p className="ol-note">Питання щодо оплати — пишіть на {email}.</p>
      </>
    );
  }

  return (
    <>
      <p className="ol-text">
        {waiting
          ? 'Зазвичай це кілька секунд. Сторінка оновиться сама.'
          : 'WayForPay ще не підтвердив оплату. Не оплачуйте вдруге: щойно оплату підтвердять, тест відкриється за цим самим посиланням, а запрошення прийде на email із заявки.'}
      </p>
      {!waiting && (
        <button type="button" className="ol-btn ol-btn-main" onClick={again}>Перевірити ще раз</button>
      )}
      <p className="ol-note">Гроші списано, а тест так і не відкрився? Напишіть на {email} — розберемося.</p>
    </>
  );
}
