'use client';

// Колбек WayForPay приходить за кілька секунд після повернення людини на сайт,
// тож сторінку оновлюємо самі, поки оплата не підтвердиться. Лічильник — у
// sessionStorage: стан компонента оновлення сторінки не переживає.
import { useEffect, useState } from 'react';

const KEY = 'olimp_wait';
const MAX = 20;

export default function WaitPayment({ failed, email }) {
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    let n = 0;
    try { n = Number(window.sessionStorage.getItem(KEY)) || 0; } catch { /* без лічильника */ }
    if (n >= MAX) { setWaiting(false); return undefined; }
    const id = setTimeout(() => {
      try { window.sessionStorage.setItem(KEY, String(n + 1)); } catch { /* ок */ }
      window.location.reload();
    }, 4000);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <p className="ol-text">
        {failed
          ? 'Схоже, оплата не пройшла. Можна спробувати ще раз.'
          : waiting ? 'Зазвичай це кілька секунд. Сторінка оновиться сама.' : 'Оплата досі не підтвердилась.'}
      </p>
      {(failed || !waiting) && <a href="/olimpiada#uchast" className="ol-btn ol-btn-main">Повернутися до заявки</a>}
      <p className="ol-note">Оплатили, а тест не відкривається? Напишіть на {email} — відкриємо вручну.</p>
    </>
  );
}
