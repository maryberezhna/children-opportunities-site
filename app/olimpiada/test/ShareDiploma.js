'use client';

// Поділитися дипломом: на телефоні — системне вікно з самою картинкою
// (Web Share API з файлом), інакше — Telegram, Viber і копіювання тексту.
// Ділимося сторінкою олімпіади, а не приватним посиланням на результат.
import { useEffect, useState } from 'react';

const PAGE = 'https://dityam.com.ua/olimpiada';

export default function ShareDiploma({ name, score, max, diplomaUrl }) {
  const [note, setNote] = useState('');
  // Чи вміє браузер показати системне вікно «Поділитися» — дізнаємось після
  // гідрації, інакше сервер і клієнт малювали б різні кнопки.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setCanShare(typeof navigator.share === 'function'); }, []);
  const text = `${name} отримує диплом онлайн-олімпіади з логіки Dityam.com.ua: ${score} з ${max} балів! Спробуйте й ви: ${PAGE}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(PAGE)}&text=${encodeURIComponent(text.replace(` ${PAGE}`, ''))}`;
  const viber = `viber://forward?text=${encodeURIComponent(text)}`;

  async function share() {
    try {
      const r = await fetch(diplomaUrl);
      const blob = await r.blob();
      const file = new File([blob], 'dyplom-olimpiada-dityam.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: 'Диплом олімпіади з логіки' });
      } else {
        await navigator.share({ text, url: PAGE, title: 'Диплом олімпіади з логіки' });
      }
      if (typeof window.gtag === 'function') window.gtag('event', 'olimpiada_share', { method: 'native' });
    } catch { /* людина закрила вікно — нічого не кажемо */ }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Текст скопійовано — вставте його в будь-який чат.');
      setTimeout(() => setNote(''), 4000);
    } catch { setNote('Не вдалося скопіювати. Виділіть текст вручну.'); }
  }

  return (
    <div className="ol-share">
      <p className="ol-share-title">Поділитися дипломом</p>
      <div className="ol-share-row">
        {canShare && <button type="button" className="ol-btn ol-btn-main" onClick={share}>Поділитися</button>}
        <a className="ol-btn ol-btn-ghost" href={tg} target="_blank" rel="noopener">Telegram</a>
        <a className="ol-btn ol-btn-ghost ol-share-viber" href={viber}>Viber</a>
        <button type="button" className="ol-btn ol-btn-ghost" onClick={copy}>Скопіювати текст</button>
      </div>
      {note && <p className="ol-share-note" role="status">{note}</p>}
    </div>
  );
}
