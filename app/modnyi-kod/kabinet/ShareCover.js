'use client';
// Поділитися обкладинкою (Марія, 13.10.2026: «нема кнопки поділитися і
// бажано одразу у чат чи соцмережі»). На телефоні «Поділитися» відкриває
// системне вікно з самою картинкою — звідти в Instagram, Telegram, Viber.
// Кнопки месенджерів несуть текст і сторінку олімпіади, не приватний кабінет.
// Instagram не приймає посилань із сайту, тому для нього — «Зберегти картинку».
import { useEffect, useState } from 'react';

const PAGE = 'https://dityam.com.ua/modnyi-kod';
const UTM = '?utm_source=share&utm_medium=social&utm_campaign=modnyi_kod';

export default function ShareCover({ token, name, score }) {
  const [note, setNote] = useState('');
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setCanShare(typeof navigator.share === 'function'); }, []);
  const img = `/api/modnyi-kod/cover?t=${token}`;
  const url = PAGE + UTM;
  const text = `Обкладинка «Модного коду»: ${name}, ${score}! Онлайн-олімпіада з моди для дітей 10–14 років на Dityam.com.ua.`;
  const track = (method) => { if (typeof window.gtag === 'function') window.gtag('event', 'mk_share', { method }); };
  const links = [
    ['Telegram', `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`],
    ['Viber', `viber://forward?text=${encodeURIComponent(`${text} ${url}`)}`],
    ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
  ];

  async function share() {
    try {
      const blob = await (await fetch(img)).blob();
      const file = new File([blob], 'obkladynka-modnyi-kod.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: `${text} ${url}` });
      else await navigator.share({ text, url });
      track('native');
    } catch { /* людина закрила вікно — нічого не кажемо */ }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote('Скопійовано: вставте в будь-який чат.');
      track('copy');
      setTimeout(() => setNote(''), 4000);
    } catch { setNote('Не вдалося скопіювати.'); }
  }

  return (
    <div className="mkS">
      <p className="mk-kick">Поділитися обкладинкою</p>
      <div className="mkS-row">
        {canShare ? <button type="button" className="mk-btn-y" onClick={share}>Поділитися</button> : null}
        {links.map(([label, href]) => (
          <a key={label} className="mkS-btn" href={href} target={label === 'Viber' ? undefined : '_blank'} rel="noopener" onClick={() => track(label.toLowerCase())}>{label}</a>
        ))}
        <a className="mkS-btn" href={img} download="obkladynka-modnyi-kod.png" onClick={() => track('download')}>Зберегти картинку</a>
        <button type="button" className="mkS-btn" onClick={copy}>Скопіювати текст</button>
      </div>
      {note ? <p className="mkS-note" role="status">{note}</p> : null}
    </div>
  );
}
