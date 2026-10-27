'use client';
// «Поділитися в Instagram» наприкінці сторінки результату (Марія, 13.10.2026:
// «в кінці після розбору — … поділитися в інстаграм»).
// Сайт не може опублікувати в Instagram сам: на телефоні відкриваємо системне
// вікно з картинкою диплома (там є Instagram), на компʼютері — завантажуємо
// диплом і підказуємо додати його в сторіс із позначкою @dityam.com.ua.
import { useEffect, useState } from 'react';

export default function InstagramShare({ diplomaUrl }) {
  const [canFiles, setCanFiles] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => {
    try {
      const probe = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' });
      setCanFiles(Boolean(navigator.canShare && navigator.canShare({ files: [probe] })));
    } catch { setCanFiles(false); }
  }, []);
  const track = (method) => { if (typeof window.gtag === 'function') window.gtag('event', 'olimpiada_share', { method }); };

  async function share() {
    try {
      const blob = await (await fetch(diplomaUrl)).blob();
      const file = new File([blob], 'dyplom-olimpiada-dityam.png', { type: 'image/png' });
      await navigator.share({ files: [file] });
      track('instagram_native');
    } catch { /* людина закрила вікно */ }
  }

  if (canFiles) return <button type="button" className="ol-btn ol-btn-ghost" onClick={share}>Поділитися в Instagram</button>;
  return (
    <>
      <a className="ol-btn ol-btn-ghost" href={`${diplomaUrl}&dl=1`} download
        onClick={() => { track('instagram_download'); setNote('Диплом завантажується — додайте його в Instagram-сторіс і позначте @dityam.com.ua.'); }}>
        Поділитися в Instagram
      </a>
      {note ? <p className="ol-note" role="status">{note}</p> : null}
    </>
  );
}
