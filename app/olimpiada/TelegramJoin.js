'use client';
// «Взяти участь» — через Telegram (Марія, 13.10.2026: «щоб в телеграм боті можна
// було пройти безкоштовну олімпіаду… бо з імейлами проблема, перенеси все туди»).
// Бот записує дитину, дає посилання на тест і надсилає диплом у той самий чат.
// Посилання педагога /olimpiada?vid=<код> їде в бот як ?start=olimp_<код>; код
// памʼятаємо 60 днів, як і форма з поштою до того (EntryForm).
import { useEffect, useState } from 'react';
import { validTeacherCode } from '@/lib/olimpiada';
import { PLUS_BOT } from '@/lib/plus';

const TEACHER_KEY = 'olimp_teacher_ref';
const TEACHER_TTL = 60 * 24 * 60 * 60 * 1000;

function teacherRef() {
  const fromUrl = new URLSearchParams(window.location.search).get('vid');
  if (validTeacherCode(fromUrl)) {
    try { window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ c: fromUrl, at: Date.now() })); } catch { /* ок */ }
    return fromUrl;
  }
  try {
    const v = JSON.parse(window.localStorage.getItem(TEACHER_KEY) || 'null');
    if (v && validTeacherCode(v.c) && Date.now() - Number(v.at) < TEACHER_TTL) return v.c;
  } catch { /* приватний режим — лише з адреси */ }
  return '';
}

export default function TelegramJoin() {
  const [code, setCode] = useState('');
  useEffect(() => { setCode(teacherRef()); }, []);
  const href = `https://t.me/${PLUS_BOT}?start=olimp${code ? `_${code}` : ''}`;
  return (
    <div className="ol-tg-join">
      <a className="ol-btn ol-btn-main" href={href} target="_blank" rel="noopener"
        onClick={() => { if (typeof window.gtag === 'function') window.gtag('event', 'olimpiada_tg_join', { teacher: code ? 1 : 0 }); }}>
        Зареєструватися в Telegram
      </a>
      <ol className="ol-tg-steps">
        <li>Батьки чи вчитель відкривають бот @{PLUS_BOT} і натискають «Записати дитину».</li>
        <li>Пишуть імʼя дитини для диплома — бот дає кнопку «Почати олімпіаду». Учнів класу — по черзі, кожного окремо.</li>
        <li>Диплом з результатом прийде в той самий чат одразу після тесту.</li>
      </ol>
      <p className="ol-note">Підписка не потрібна. Натискаючи «Записати дитину» в боті, ви погоджуєтесь із <a href="#pravyla">правилами олімпіади</a>.</p>
    </div>
  );
}
