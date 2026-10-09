'use client';

// Невидимий: щойно відкрилась сторінка результату, просить сайт надіслати лист
// із дипломом (/api/olimpiada/diploma-mail). Один раз на відкриття; помилка
// нікого не турбує — лист однаково надішле запасний скрипт.
import { useEffect } from 'react';

export default function DiplomaMailer({ token }) {
  useEffect(() => {
    fetch('/api/olimpiada/diploma-mail', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }),
      keepalive: true,
    }).catch(() => {});
  }, [token]);
  return null;
}
