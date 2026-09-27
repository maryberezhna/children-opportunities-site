'use client';
import { useEffect, useState } from 'react';
import { TELEGRAM_URL, CHANNEL_CTA } from '@/lib/social';
import { trackConversion, trackSubscribeClick } from '@/lib/track';
import { JOINED_KEY } from './SubscribePopup';

// Картка каналу просто в списку можливостей. Замінила 4-секундний тригер
// спливної підказки: за 23.08–22.09 із 3 049 показів підказки 70% зникли
// самі через 10 секунд, ніхто їх не встиг помітити. Картка в стрічці не має
// таймера, не перекриває нічого і її бачить кожен, хто гортає.
//
// Слова — спільні для всіх закликів до каналу (lib/social.js). До 27.09.2026
// картка казала «щодня один пост», хоча формат каналу ще змінюється.
const ARIA = {
  uk: 'Telegram-канал Dityam.com.ua',
  en: 'Dityam.com.ua Telegram channel',
};

// `place`: 'catalog' — головна й міські сторінки, 'topic' — підбірки.
// Іде в GA4 як popup_trigger, щоб рахуватись поруч зі спливною підказкою.
// `hub` — slug підбірки з lib/topics.js: з якої саме підбірки долучаються.
export default function TelegramCard({ lang = 'uk', place = 'catalog', hub = null }) {
  const [joined, setJoined] = useState(false);
  const t = { ...(CHANNEL_CTA[lang] || CHANNEL_CTA.uk), aria: ARIA[lang] || ARIA.uk };

  // Уже долучився (той самий прапорець, що й у підказки) — картку не показуємо.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(JOINED_KEY)) setJoined(true);
    } catch (e) {}
  }, []);

  if (joined) return null;

  const handleClick = () => {
    try {
      window.localStorage.setItem(JOINED_KEY, Date.now().toString());
    } catch (e) {}
    // Стара подія лишається як була, щоб звіти до 27.09.2026 порівнювались.
    trackConversion('telegram_join_click', {
      event_label: 'inline_card',
      popup_trigger: `inline_card_${place}`,
    });
    // Нова — одна на всі входи «підписатись із сайту» (lib/track.js).
    trackSubscribeClick({
      target: 'channel',
      placement: place === 'topic' ? 'hub_inline' : 'catalog_inline',
      hub: place === 'topic' ? hub : null,
    });
  };

  return (
    <aside className="tg-card" aria-label={t.aria}>
      <div className="tg-card-copy">
        <span className="tg-card-badge">Telegram</span>
        {/* Не заголовок: у списку h3 — назви можливостей, і «Щоб не шукати
            вручну» серед них читачі екрана й пошуковики брали б за ще одну. */}
        <p className="tg-card-title">{t.title}</p>
        <p className="tg-card-text">{t.text}</p>
      </div>
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="tg-card-btn"
        onClick={handleClick}
      >
        {t.cta}
      </a>
    </aside>
  );
}
